import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, emailVerificationsTable, referralsTable, walletTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { generateToken, requireAuth } from "../middlewares/auth";
import { sendVerificationOtpEmail } from "../lib/email";

const router: IRouter = Router();

function userPayload(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    govtId: user.govtId,
    walletBalance: user.walletBalance,
    avatarUrl: user.avatarUrl,
    isAdmin: user.isAdmin,
    isSuperAdmin: user.isSuperAdmin ?? false,
    adminPermissions: user.adminPermissions ?? [],
    customUid: user.customUid ?? null,
    referralCode: user.referralCode ?? null,
    isBlocked: user.isBlocked,
    emailVerified: user.emailVerified,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt.toISOString(),
  };
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function generateUniqueReferralCode(): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.referralCode, code));
    if (!existing) return code;
  }
  return "RY" + Date.now().toString(36).toUpperCase().slice(-6);
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();
  const referralCode = typeof req.body.referralCode === "string" ? req.body.referralCode.trim().toUpperCase() : null;

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newReferralCode = await generateUniqueReferralCode();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || null;

  // Find referrer (if referral code provided)
  let referrer: typeof usersTable.$inferSelect | null = null;
  if (referralCode) {
    const [found] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode));
    referrer = found ?? null;
  }

  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash,
      phone: phone ?? null,
      emailVerified: false,
      referralCode: newReferralCode,
      referredById: referrer?.id ?? null,
      registrationIp: ip,
    })
    .returning();

  // Process referral bonus (if valid referrer found)
  if (referrer) {
    const sameDevice = ip && referrer.registrationIp && ip === referrer.registrationIp;
    const fraudBlocked = !!sameDevice;

    await db.insert(referralsTable).values({
      referrerId: referrer.id,
      referredId: user.id,
      bonusPaid: !fraudBlocked,
      fraudBlocked,
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
        description: `Referral bonus — ${user.name} joined using your code!`,
        balanceAfter: updatedReferrer?.walletBalance ?? "0.00",
      });

      // Credit ₹20 to new user
      const [updatedUser] = await db
        .update(usersTable)
        .set({ walletBalance: "20.00" })
        .where(eq(usersTable.id, user.id))
        .returning({ walletBalance: usersTable.walletBalance });

      await db.insert(walletTransactionsTable).values({
        userId: user.id,
        amount: "20.00",
        type: "credit",
        description: "Welcome bonus — joined via a referral code!",
        balanceAfter: updatedUser?.walletBalance ?? "0.00",
      });
    }
  }

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(emailVerificationsTable).values({ userId: user.id, otp, expiresAt });

  try {
    await sendVerificationOtpEmail(user.email, otp, user.name);
  } catch (err) {
    console.error("OTP email failed:", err);
  }

  res.status(201).json({ requiresVerification: true, email: user.email });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  if (user.isBlocked) {
    res.status(403).json({ error: "Account blocked. Contact admin." });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({ error: "This account uses Google login. Please sign in with Google." });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: user.isAdmin,
    isBlocked: user.isBlocked,
  });

  res.json({ token, user: userPayload(user) });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true, message: "Logged out" });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(userPayload(user));
});

export default router;
