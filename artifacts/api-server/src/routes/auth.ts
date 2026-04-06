import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, emailVerificationsTable } from "@workspace/db";
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
    isBlocked: user.isBlocked,
    emailVerified: user.emailVerified,
    verificationStatus: user.verificationStatus,
    createdAt: user.createdAt.toISOString(),
  };
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/auth/signup", async (req, res): Promise<void> => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, password, phone } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash, phone: phone ?? null, emailVerified: false })
    .returning();

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
