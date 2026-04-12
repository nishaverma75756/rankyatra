import { Router, type IRouter } from "express";
import { db, usersTable, referralsTable, referralClicksTable, walletTransactionsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

// Track referral link click (public — no auth needed)
router.post("/referral/click", async (req, res): Promise<void> => {
  const { referralCode, deviceFingerprint } = req.body;
  if (!referralCode || typeof referralCode !== "string") {
    res.status(400).json({ error: "referralCode required" });
    return;
  }
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
  await db.insert(referralClicksTable).values({
    referralCode: referralCode.toUpperCase(),
    ip,
    deviceFingerprint: typeof deviceFingerprint === "string" ? deviceFingerprint : null,
  });
  res.json({ success: true });
});

// Generate unique referral code (utility)
async function ensureReferralCode(userId: number): Promise<string> {
  const [user] = await db.select({ referralCode: usersTable.referralCode }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.referralCode) return user.referralCode;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    if (!existing) {
      await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, userId));
      return code;
    }
  }
  const fallback = "RY" + Date.now().toString(36).toUpperCase().slice(-6);
  await db.update(usersTable).set({ referralCode: fallback }).where(eq(usersTable.id, userId));
  return fallback;
}

// Get own referral stats (auth required)
router.get("/referral/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const code = await ensureReferralCode(userId);

  const [userRow] = await db
    .select({ referredById: usersTable.referredById })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const [{ total }] = await db.select({ total: count() }).from(referralsTable).where(eq(referralsTable.referrerId, userId));
  const [{ paid }] = await db.select({ paid: count() }).from(referralsTable).where(and(eq(referralsTable.referrerId, userId), eq(referralsTable.bonusPaid, true)));
  const [{ clicks }] = await db.select({ clicks: count() }).from(referralClicksTable).where(eq(referralClicksTable.referralCode, code ?? ""));

  res.json({
    referralCode: code,
    referralLink: code ? `https://rankyatra.in/ref/${code}` : null,
    isReferred: userRow?.referredById != null,
    totalReferrals: Number(total),
    successfulReferrals: Number(paid),
    pendingReferrals: Number(total) - Number(paid),
    totalEarnings: Number(paid) * 20,
    totalClicks: Number(clicks),
  });
});

// Get list of referred users (auth required)
router.get("/referral/list", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const list = await db
    .select({
      id: referralsTable.id,
      bonusPaid: referralsTable.bonusPaid,
      fraudBlocked: referralsTable.fraudBlocked,
      createdAt: referralsTable.createdAt,
      referredName: usersTable.name,
      referredEmail: usersTable.email,
    })
    .from(referralsTable)
    .leftJoin(usersTable, eq(referralsTable.referredId, usersTable.id))
    .where(eq(referralsTable.referrerId, userId))
    .orderBy(desc(referralsTable.createdAt))
    .limit(50);

  res.json(list.map((r) => ({
    id: r.id,
    name: r.referredName ?? "Unknown",
    email: r.referredEmail ?? "",
    bonusPaid: r.bonusPaid,
    fraudBlocked: r.fraudBlocked,
    status: r.fraudBlocked ? "blocked" : r.bonusPaid ? "completed" : "pending",
    joinedAt: r.createdAt.toISOString(),
  })));
});

// Manually apply a referral code after signup (auth required)
router.post("/referral/apply", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const { referralCode, deviceFingerprint } = req.body;

  if (!referralCode || typeof referralCode !== "string") {
    res.status(400).json({ error: "referralCode is required." });
    return;
  }

  const code = referralCode.trim().toUpperCase();

  // Check if user is already referred
  const [me] = await db
    .select({ referredById: usersTable.referredById, walletBalance: usersTable.walletBalance, name: usersTable.name, registrationIp: usersTable.registrationIp })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (me?.referredById != null) {
    res.status(400).json({ error: "You have already used a referral code." });
    return;
  }

  // Find the referrer by code
  const [referrer] = await db
    .select({ id: usersTable.id, walletBalance: usersTable.walletBalance, name: usersTable.name, referralCode: usersTable.referralCode, registrationIp: usersTable.registrationIp })
    .from(usersTable)
    .where(eq(usersTable.referralCode, code));

  if (!referrer) {
    res.status(404).json({ error: "Invalid referral code. Please check and try again." });
    return;
  }

  // Cannot self-refer
  if (referrer.id === userId) {
    res.status(400).json({ error: "You cannot use your own referral code." });
    return;
  }

  // Device fingerprint check — one device can only benefit from one referral
  if (deviceFingerprint && typeof deviceFingerprint === "string") {
    const [existingDevice] = await db
      .select({ id: referralsTable.id })
      .from(referralsTable)
      .where(eq(referralsTable.deviceFingerprint, deviceFingerprint))
      .limit(1);

    if (existingDevice) {
      res.status(400).json({ error: "This device has already been used for a referral. Each device can only benefit from one referral code." });
      return;
    }
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;
  const sameIp = ip && referrer.registrationIp && ip === referrer.registrationIp;
  const fraudBlocked = !!sameIp;

  // Link the referral
  await db.update(usersTable).set({ referredById: referrer.id }).where(eq(usersTable.id, userId));

  await db.insert(referralsTable).values({
    referrerId: referrer.id,
    referredId: userId,
    bonusPaid: !fraudBlocked,
    fraudBlocked,
    deviceFingerprint: deviceFingerprint && typeof deviceFingerprint === "string" ? deviceFingerprint : null,
  });

  if (!fraudBlocked) {
    // Credit ₹20 to referrer
    const [updatedReferrer] = await db
      .update(usersTable)
      .set({ walletBalance: String(Number(referrer.walletBalance) + 20) })
      .where(eq(usersTable.id, referrer.id))
      .returning({ walletBalance: usersTable.walletBalance });

    await db.insert(walletTransactionsTable).values({
      userId: referrer.id,
      amount: "20.00",
      type: "credit",
      description: `Referral bonus — ${me?.name ?? "A friend"} joined using your code!`,
      balanceAfter: updatedReferrer?.walletBalance ?? "0.00",
    });

    // Credit ₹20 to current user
    const [updatedMe] = await db
      .update(usersTable)
      .set({ walletBalance: String(Number(me?.walletBalance ?? "0") + 20) })
      .where(eq(usersTable.id, userId))
      .returning({ walletBalance: usersTable.walletBalance });

    await db.insert(walletTransactionsTable).values({
      userId,
      amount: "20.00",
      type: "credit",
      description: `Welcome bonus — joined via ${referrer.name}'s referral code!`,
      balanceAfter: updatedMe?.walletBalance ?? "0.00",
    });

    res.json({ success: true, bonusCredited: true, message: "Referral code applied! ₹20 has been added to both wallets." });
  } else {
    res.json({ success: true, bonusCredited: false, message: "Referral code applied. Bonus was not credited due to suspicious activity." });
  }
});

export default router;
