import { Router, type IRouter } from "express";
import {
  db,
  walletDepositsTable,
  paymentSettingsTable,
  usersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { sendDepositConfirmedEmail, sendDepositRejectedEmail } from "../lib/email";

const router: IRouter = Router();

const APP_URL = process.env.APP_URL || "https://rankyatra.in";
const INSTAMOJO_API_KEY = process.env.INSTAMOJO_API_KEY || "";
const INSTAMOJO_AUTH_TOKEN = process.env.INSTAMOJO_AUTH_TOKEN || "";
const INSTAMOJO_BASE = "https://www.instamojo.com/api/1.1";

router.get("/payment/settings", async (_req, res): Promise<void> => {
  const [settings] = await db.select().from(paymentSettingsTable).limit(1);
  res.json(settings ?? { qrCodeUrl: null, upiId: null });
});

router.post("/admin/payment/settings", requireAdmin, async (req, res): Promise<void> => {
  const { upiId, qrCodeUrl } = req.body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (upiId !== undefined) updateData.upiId = upiId;
  if (qrCodeUrl !== undefined) updateData.qrCodeUrl = qrCodeUrl;

  const [existing] = await db.select().from(paymentSettingsTable).limit(1);
  if (existing) {
    await db.update(paymentSettingsTable).set(updateData as any).where(eq(paymentSettingsTable.id, existing.id));
  } else {
    await db.insert(paymentSettingsTable).values({ upiId, qrCodeUrl });
  }
  res.json({ success: true });
});

const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;

async function getDepositTotal(userId: number, since: Date): Promise<number> {
  const rows = await db
    .select()
    .from(walletDepositsTable)
    .where(
      and(
        eq(walletDepositsTable.userId, userId),
        gte(walletDepositsTable.createdAt, since),
        sql`${walletDepositsTable.status} != 'rejected'`
      )
    );
  return rows.reduce((sum, r) => sum + parseFloat(String(r.amount)), 0);
}

router.get("/wallet/deposit/limits", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyUsed, monthlyUsed] = await Promise.all([
    getDepositTotal(req.user!.id, todayStart),
    getDepositTotal(req.user!.id, monthStart),
  ]);

  res.json({
    dailyLimit: DAILY_LIMIT,
    monthlyLimit: MONTHLY_LIMIT,
    dailyUsed: Math.min(dailyUsed, DAILY_LIMIT),
    monthlyUsed: Math.min(monthlyUsed, MONTHLY_LIMIT),
    dailyRemaining: Math.max(0, DAILY_LIMIT - dailyUsed),
    monthlyRemaining: Math.max(0, MONTHLY_LIMIT - monthlyUsed),
  });
});

// ── INSTAMOJO: Create payment request ──────────────────────────────────────
router.post("/wallet/deposit/instamojo/create", requireAuth, async (req, res): Promise<void> => {
  const { amount, source } = req.body; // source = 'mobile' | undefined

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount < 10) {
    res.status(400).json({ error: "Minimum deposit is ₹10" });
    return;
  }
  if (parsedAmount > DAILY_LIMIT) {
    res.status(400).json({ error: `Maximum deposit is ₹${DAILY_LIMIT}` });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyUsed, monthlyUsed] = await Promise.all([
    getDepositTotal(req.user!.id, todayStart),
    getDepositTotal(req.user!.id, monthStart),
  ]);

  if (dailyUsed + parsedAmount > DAILY_LIMIT) {
    const remaining = Math.max(0, DAILY_LIMIT - dailyUsed);
    res.status(400).json({ error: `Daily limit exceeded. You can deposit ₹${remaining} more today.` });
    return;
  }
  if (monthlyUsed + parsedAmount > MONTHLY_LIMIT) {
    const remaining = Math.max(0, MONTHLY_LIMIT - monthlyUsed);
    res.status(400).json({ error: `Monthly limit exceeded. You can deposit ₹${remaining} more this month.` });
    return;
  }

  const user = req.user!;

  // Create pending deposit record first
  const [deposit] = await db
    .insert(walletDepositsTable)
    .values({
      userId: user.id,
      amount: String(parsedAmount),
      paymentMethod: "instamojo",
      status: "pending",
    })
    .returning();

  // Call Instamojo API to create payment request
  const formData = new URLSearchParams({
    purpose: `RankYatra Wallet Top-up ₹${parsedAmount}`,
    amount: String(parsedAmount),
    buyer_name: user.name || "RankYatra User",
    email: user.email || "",
    redirect_url: `${APP_URL}/api/wallet/deposit/instamojo/callback?deposit_id=${deposit.id}${source === "mobile" ? "&source=mobile" : ""}`,
    allow_repeated_payments: "False",
    send_email: "True",
    send_sms: "False",
  });

  try {
    const imRes = await fetch(`${INSTAMOJO_BASE}/payment-requests/`, {
      method: "POST",
      headers: {
        "X-Api-Key": INSTAMOJO_API_KEY,
        "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const imData = await imRes.json() as any;

    if (!imRes.ok || !imData.success) {
      console.error("Instamojo create error:", imData);
      await db.update(walletDepositsTable).set({ status: "rejected", adminNote: "Payment creation failed" }).where(eq(walletDepositsTable.id, deposit.id));
      res.status(502).json({ error: "Payment gateway error. Please try again." });
      return;
    }

    const paymentRequestId = imData.payment_request.id;
    const paymentUrl = imData.payment_request.longurl;

    // Save payment request ID
    await db
      .update(walletDepositsTable)
      .set({ paymentRequestId })
      .where(eq(walletDepositsTable.id, deposit.id));

    res.json({ paymentUrl, depositId: deposit.id });
  } catch (err) {
    console.error("Instamojo fetch error:", err);
    await db.update(walletDepositsTable).set({ status: "rejected", adminNote: "Payment creation failed" }).where(eq(walletDepositsTable.id, deposit.id));
    res.status(502).json({ error: "Could not connect to payment gateway. Please try again." });
  }
});

// ── INSTAMOJO: Callback after payment ──────────────────────────────────────
router.get("/wallet/deposit/instamojo/callback", async (req, res): Promise<void> => {
  const { payment_id, payment_request_id, payment_status, deposit_id, source } = req.query as Record<string, string>;
  const isMobile = source === "mobile";

  function redirectTo(path: string, params: Record<string, string>) {
    const qs = new URLSearchParams(params).toString();
    if (isMobile) {
      res.redirect(`rankyatra://wallet-deposit?${qs}`);
    } else {
      res.redirect(`${APP_URL}/wallet/deposit?${qs}`);
    }
  }

  if (!deposit_id) {
    redirectTo("", { instamojo: "failed", reason: "invalid" });
    return;
  }

  const depositIdNum = parseInt(deposit_id);
  const [deposit] = await db.select().from(walletDepositsTable).where(eq(walletDepositsTable.id, depositIdNum));

  if (!deposit) {
    redirectTo("", { instamojo: "failed", reason: "notfound" });
    return;
  }

  if (deposit.status === "success") {
    redirectTo("", { instamojo: "success", amount: String(deposit.amount) });
    return;
  }

  if (!payment_id || payment_status !== "Credit") {
    await db.update(walletDepositsTable)
      .set({ status: "rejected", adminNote: "Payment cancelled or failed", updatedAt: new Date() })
      .where(eq(walletDepositsTable.id, depositIdNum));
    redirectTo("", { instamojo: "failed", reason: "cancelled" });
    return;
  }

  // Verify payment with Instamojo
  try {
    const verifyRes = await fetch(`${INSTAMOJO_BASE}/payments/${payment_id}/`, {
      headers: {
        "X-Api-Key": INSTAMOJO_API_KEY,
        "X-Auth-Token": INSTAMOJO_AUTH_TOKEN,
      },
    });

    const verifyData = await verifyRes.json() as any;

    if (!verifyRes.ok || !verifyData.success) {
      console.error("Instamojo verify error:", verifyData);
      await db.update(walletDepositsTable)
        .set({ status: "rejected", adminNote: "Payment verification failed", updatedAt: new Date() })
        .where(eq(walletDepositsTable.id, depositIdNum));
      redirectTo("", { instamojo: "failed", reason: "verify" });
      return;
    }

    const payment = verifyData.payment;
    const paidAmount = parseFloat(payment.amount);
    const expectedAmount = parseFloat(String(deposit.amount));

    if (payment.status !== "Credit" || paidAmount < expectedAmount) {
      await db.update(walletDepositsTable)
        .set({ status: "rejected", adminNote: `Amount mismatch or not credited. Got: ${paidAmount}`, updatedAt: new Date() })
        .where(eq(walletDepositsTable.id, depositIdNum));
      redirectTo("", { instamojo: "failed", reason: "amount" });
      return;
    }

    // All checks passed — credit the wallet
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
    if (!user) {
      redirectTo("", { instamojo: "failed", reason: "user" });
      return;
    }

    const newBalance = parseFloat(String(user.walletBalance)) + expectedAmount;

    await db.update(usersTable)
      .set({ walletBalance: String(newBalance) })
      .where(eq(usersTable.id, user.id));

    await db.update(walletDepositsTable)
      .set({ status: "success", utrNumber: payment_id, updatedAt: new Date() })
      .where(eq(walletDepositsTable.id, depositIdNum));

    await db.insert(walletTransactionsTable).values({
      userId: user.id,
      amount: String(expectedAmount),
      type: "credit",
      description: `Wallet top-up via Instamojo (ID: ${payment_id})`,
      balanceAfter: String(newBalance),
    });

    try {
      await sendDepositConfirmedEmail(user.email, user.name, String(expectedAmount), String(newBalance), payment_id);
    } catch (err) { console.error("Deposit email failed:", err); }

    redirectTo("", { instamojo: "success", amount: String(expectedAmount) });
  } catch (err) {
    console.error("Instamojo callback error:", err);
    redirectTo("", { instamojo: "failed", reason: "error" });
  }
});

// ── MANUAL UPI DEPOSIT ──────────────────────────────────────────────────────
router.post("/wallet/deposit", requireAuth, async (req, res): Promise<void> => {
  const { amount, utrNumber } = req.body;

  if (!amount || !utrNumber) {
    res.status(400).json({ error: "Amount and UTR number are required" });
    return;
  }

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (parsedAmount > DAILY_LIMIT) {
    res.status(400).json({ error: `Maximum single deposit is ₹${DAILY_LIMIT}` });
    return;
  }

  const utr = String(utrNumber).trim();
  if (utr.length < 6) {
    res.status(400).json({ error: "Invalid UTR number" });
    return;
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [dailyUsed, monthlyUsed] = await Promise.all([
    getDepositTotal(req.user!.id, todayStart),
    getDepositTotal(req.user!.id, monthStart),
  ]);

  if (dailyUsed + parsedAmount > DAILY_LIMIT) {
    const remaining = Math.max(0, DAILY_LIMIT - dailyUsed);
    res.status(400).json({ error: `Daily deposit limit exceeded. You can deposit ₹${remaining} more today (limit: ₹${DAILY_LIMIT}/day).` });
    return;
  }
  if (monthlyUsed + parsedAmount > MONTHLY_LIMIT) {
    const remaining = Math.max(0, MONTHLY_LIMIT - monthlyUsed);
    res.status(400).json({ error: `Monthly deposit limit exceeded. You can deposit ₹${remaining} more this month (limit: ₹${MONTHLY_LIMIT}/month).` });
    return;
  }

  const [deposit] = await db
    .insert(walletDepositsTable)
    .values({
      userId: req.user!.id,
      amount: String(parsedAmount),
      utrNumber: utr,
      paymentMethod: "manual",
      status: "pending",
    })
    .returning();

  res.status(201).json({
    id: deposit.id,
    amount: deposit.amount,
    utrNumber: deposit.utrNumber,
    status: deposit.status,
    createdAt: deposit.createdAt.toISOString(),
  });
});

router.get("/wallet/deposits/my", requireAuth, async (req, res): Promise<void> => {
  const deposits = await db
    .select()
    .from(walletDepositsTable)
    .where(eq(walletDepositsTable.userId, req.user!.id))
    .orderBy(desc(walletDepositsTable.createdAt));

  res.json(
    deposits.map((d) => ({
      id: d.id,
      amount: d.amount,
      utrNumber: d.utrNumber,
      paymentMethod: d.paymentMethod,
      status: d.status,
      adminNote: d.adminNote,
      createdAt: d.createdAt.toISOString(),
    }))
  );
});

router.get("/admin/deposits", requireAdmin, async (_req, res): Promise<void> => {
  const deposits = await db
    .select()
    .from(walletDepositsTable)
    .orderBy(desc(walletDepositsTable.createdAt));

  const results = await Promise.all(
    deposits.map(async (d) => {
      const [user] = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, d.userId));
      return {
        id: d.id,
        amount: d.amount,
        utrNumber: d.utrNumber,
        paymentMethod: d.paymentMethod,
        status: d.status,
        adminNote: d.adminNote,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
        user: user ?? null,
      };
    })
  );

  res.json(results);
});

router.patch("/admin/deposits/:id", requireAdmin, async (req, res): Promise<void> => {
  const depositId = parseInt(req.params.id);
  const { status, adminNote } = req.body;

  if (!["success", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status" });
    return;
  }

  const [deposit] = await db
    .select()
    .from(walletDepositsTable)
    .where(eq(walletDepositsTable.id, depositId));

  if (!deposit) {
    res.status(404).json({ error: "Deposit not found" });
    return;
  }

  await db
    .update(walletDepositsTable)
    .set({ status, adminNote: adminNote ?? null, updatedAt: new Date() })
    .where(eq(walletDepositsTable.id, depositId));

  if (status === "success" && deposit.status !== "success") {
    const amount = parseFloat(String(deposit.amount));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));

    if (user) {
      const newBalance = parseFloat(String(user.walletBalance)) + amount;

      await db
        .update(usersTable)
        .set({ walletBalance: String(newBalance) })
        .where(eq(usersTable.id, deposit.userId));

      const ref = deposit.utrNumber || deposit.paymentRequestId || String(deposit.id);
      const method = deposit.paymentMethod === "instamojo" ? "Instamojo" : "UPI";

      await db.insert(walletTransactionsTable).values({
        userId: deposit.userId,
        amount: String(amount),
        type: "credit",
        description: `Wallet top-up via ${method} (Ref: ${ref})`,
        balanceAfter: String(newBalance),
      });

      try {
        await sendDepositConfirmedEmail(user.email, user.name, String(amount), String(newBalance), ref);
      } catch (err) { console.error("Deposit confirmed email failed:", err); }
    }
  }

  if (status === "rejected" && deposit.status === "success") {
    const amount = parseFloat(String(deposit.amount));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));

    if (user) {
      const newBalance = Math.max(0, parseFloat(String(user.walletBalance)) - amount);
      await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, deposit.userId));
      const ref = deposit.utrNumber || String(deposit.id);
      await db.insert(walletTransactionsTable).values({
        userId: deposit.userId,
        amount: String(amount),
        type: "debit",
        description: `Deposit reversal (Ref: ${ref})`,
        balanceAfter: String(newBalance),
      });
      try {
        await sendDepositRejectedEmail(user.email, user.name, String(amount), ref, adminNote);
      } catch (err) { console.error("Deposit rejected email failed:", err); }
    }
  }

  if (status === "rejected" && deposit.status !== "success" && deposit.status !== "rejected") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
    if (user) {
      const ref = deposit.utrNumber || String(deposit.id);
      try {
        await sendDepositRejectedEmail(user.email, user.name, String(deposit.amount), ref, adminNote);
      } catch (err) { console.error("Deposit rejected email failed:", err); }
    }
  }

  res.json({ success: true, status });
});

export default router;
