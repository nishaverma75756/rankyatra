import { Router, type IRouter } from "express";
import { db, usersTable, referralsTable, referralClicksTable } from "@workspace/db";
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

  const [{ total }] = await db.select({ total: count() }).from(referralsTable).where(eq(referralsTable.referrerId, userId));
  const [{ paid }] = await db.select({ paid: count() }).from(referralsTable).where(and(eq(referralsTable.referrerId, userId), eq(referralsTable.bonusPaid, true)));
  const [{ clicks }] = await db.select({ clicks: count() }).from(referralClicksTable).where(eq(referralClicksTable.referralCode, code ?? ""));

  res.json({
    referralCode: code,
    referralLink: code ? `https://rankyatra.in/ref/${code}` : null,
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

export default router;
