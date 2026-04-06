import { Router, type IRouter } from "express";
import { db, usersTable, emailVerificationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { generateToken } from "../middlewares/auth";
import { sendVerificationOtpEmail, sendWelcomeEmail } from "../lib/email";

const router: IRouter = Router();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

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

router.post("/auth/resend-otp", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "Email required" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.emailVerified) { res.json({ message: "Email already verified" }); return; }

  await db.update(emailVerificationsTable).set({ used: true }).where(eq(emailVerificationsTable.userId, user.id));

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await db.insert(emailVerificationsTable).values({ userId: user.id, otp, expiresAt });

  try {
    await sendVerificationOtpEmail(user.email, otp, user.name);
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("OTP email failed:", err);
    res.status(500).json({ error: "OTP bhejne mein error aaya. Dobara try karein." });
  }
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "Email aur OTP required hai" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.emailVerified) {
    const token = generateToken({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isBlocked: user.isBlocked });
    res.json({ token, user: userPayload(user) });
    return;
  }

  const now = new Date();
  const [record] = await db
    .select()
    .from(emailVerificationsTable)
    .where(
      and(
        eq(emailVerificationsTable.userId, user.id),
        eq(emailVerificationsTable.otp, otp.trim()),
        eq(emailVerificationsTable.used, false),
        gt(emailVerificationsTable.expiresAt, now)
      )
    );

  if (!record) {
    res.status(400).json({ error: "OTP galat hai ya expire ho gaya. Dobara bhejein." });
    return;
  }

  await db.update(usersTable).set({ emailVerified: true }).where(eq(usersTable.id, user.id));
  await db.update(emailVerificationsTable).set({ used: true }).where(eq(emailVerificationsTable.id, record.id));

  try {
    await sendWelcomeEmail(user.email, user.name);
  } catch (err) {
    console.error("Welcome email failed:", err);
  }

  const token = generateToken({ id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, isBlocked: user.isBlocked });
  res.json({ token, user: { ...userPayload(user), emailVerified: true } });
});

export { generateOtp };
export default router;
