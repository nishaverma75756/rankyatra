import { Router, type IRouter } from "express";
import crypto from "crypto";
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
const INSTAMOJO_BASE = "https://www.instamojo.com/api/1.1";

function getInstamojoKeys() {
  return {
    apiKey: process.env.INSTAMOJO_API_KEY || "",
    authToken: process.env.INSTAMOJO_AUTH_TOKEN || "",
    salt: process.env.INSTAMOJO_SALT || "",
  };
}

async function creditDepositAndWallet(depositId: number, paymentId: string): Promise<boolean> {
  const [deposit] = await db.select().from(walletDepositsTable).where(eq(walletDepositsTable.id, depositId));
  if (!deposit || deposit.status === "success") return false;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
  if (!user) return false;

  const amount = parseFloat(String(deposit.amount));
  const newBalance = parseFloat(String(user.walletBalance)) + amount;

  await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, user.id));
  await db.update(walletDepositsTable)
    .set({ status: "success", utrNumber: paymentId, updatedAt: new Date() })
    .where(eq(walletDepositsTable.id, depositId));
  await db.insert(walletTransactionsTable).values({
    userId: user.id,
    amount: String(amount),
    type: "credit",
    description: `Wallet top-up via Instamojo (ID: ${paymentId})`,
    balanceAfter: String(newBalance),
  });

  try {
    await sendDepositConfirmedEmail(user.email, user.name, String(amount), String(newBalance), paymentId, depositId);
  } catch (_) {}

  return true;
}

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
        sql`${walletDepositsTable.status} != 'rejected'`,
        sql`${walletDepositsTable.paymentMethod} != 'referral_bonus'`
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

  // Fetch full user record to get phone number
  const [fullUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id));
  const buyerPhone = fullUser?.phone?.replace(/\D/g, "").slice(-10) || "";

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

  if (buyerPhone.length === 10) formData.append("phone", buyerPhone);

  const { apiKey, authToken } = getInstamojoKeys();

  try {
    const imRes = await fetch(`${INSTAMOJO_BASE}/payment-requests/`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "X-Auth-Token": authToken,
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

function htmlPage(icon: string, title: string, message: string, color: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
  .card{background:#1e293b;border-radius:20px;padding:40px 32px;max-width:380px;width:100%;text-align:center;border:1px solid #334155}
  .icon{font-size:64px;margin-bottom:20px}.title{font-size:22px;font-weight:800;margin-bottom:12px;color:${color}}
  .msg{font-size:15px;color:#94a3b8;line-height:1.6}.note{margin-top:20px;font-size:13px;color:#475569;border-top:1px solid #334155;padding-top:16px}</style></head>
  <body><div class="card"><div class="icon">${icon}</div><div class="title">${title}</div><div class="msg">${message}</div>
  <div class="note">Aap ab yeh window band kar sakte hain — app mein apne aap update ho jayega.</div></div></body></html>`;
}

// ── INSTAMOJO: Callback after payment ──────────────────────────────────────
router.get("/wallet/deposit/instamojo/callback", async (req, res): Promise<void> => {
  const { payment_id, payment_request_id, payment_status, deposit_id } = req.query as Record<string, string>;

  const sendHtml = (icon: string, title: string, message: string, color: string) => {
    res.setHeader("Content-Type", "text/html");
    res.send(htmlPage(icon, title, message, color));
  };

  if (!deposit_id) {
    sendHtml("❌", "Invalid Request", "Payment link is invalid or expired.", "#ef4444");
    return;
  }

  const depositIdNum = parseInt(deposit_id);
  const [deposit] = await db.select().from(walletDepositsTable).where(eq(walletDepositsTable.id, depositIdNum));

  if (!deposit) {
    sendHtml("❌", "Not Found", "Payment record not found. Please contact support.", "#ef4444");
    return;
  }

  if (deposit.status === "success") {
    sendHtml("✅", "Payment Already Credited!", `₹${deposit.amount} has been added to your wallet.`, "#22c55e");
    return;
  }

  if (!payment_id || payment_status !== "Credit") {
    await db.update(walletDepositsTable)
      .set({ status: "rejected", adminNote: "Payment cancelled or failed", updatedAt: new Date() })
      .where(eq(walletDepositsTable.id, depositIdNum));
    sendHtml("❌", "Payment Cancelled", "Your payment was not completed. No money has been deducted.", "#ef4444");
    return;
  }

  // Verify payment with Instamojo API
  const { apiKey, authToken } = getInstamojoKeys();
  try {
    const verifyRes = await fetch(`${INSTAMOJO_BASE}/payments/${payment_id}/`, {
      headers: { "X-Api-Key": apiKey, "X-Auth-Token": authToken },
    });

    const verifyData = await verifyRes.json() as any;

    if (!verifyRes.ok || !verifyData.success) {
      console.error("Instamojo verify error:", verifyData);
      await db.update(walletDepositsTable)
        .set({ status: "rejected", adminNote: "Payment verification failed", updatedAt: new Date() })
        .where(eq(walletDepositsTable.id, depositIdNum));
      sendHtml("❌", "Verification Failed", "Payment could not be verified. Contact support if money was deducted.", "#ef4444");
      return;
    }

    const payment = verifyData.payment;
    const paidAmount = parseFloat(payment.amount);
    const expectedAmount = parseFloat(String(deposit.amount));

    if (payment.status !== "Credit" || paidAmount < expectedAmount) {
      await db.update(walletDepositsTable)
        .set({ status: "rejected", adminNote: `Amount mismatch or not credited. Got: ${paidAmount}`, updatedAt: new Date() })
        .where(eq(walletDepositsTable.id, depositIdNum));
      sendHtml("⚠️", "Amount Mismatch", "Paid amount does not match. Please contact support.", "#f97316");
      return;
    }

    // All good — credit wallet
    await creditDepositAndWallet(depositIdNum, payment_id);
    sendHtml("✅", `₹${expectedAmount} Added to Wallet!`, "Your payment was successful. Your wallet has been topped up. Close this window and check your app.", "#22c55e");
  } catch (err) {
    console.error("Instamojo callback error:", err);
    await db.update(walletDepositsTable)
      .set({ adminNote: "Callback error — awaiting auto-verify", updatedAt: new Date() })
      .where(eq(walletDepositsTable.id, depositIdNum))
      .catch(() => {});
    sendHtml("⏳", "Processing...", "Your payment is being processed. Please close this window — your wallet will update shortly.", "#f97316");
  }
});

// ── INSTAMOJO: Webhook (server-to-server, browser-independent) ──────────────
router.post("/wallet/deposit/instamojo/webhook", async (req, res): Promise<void> => {
  const { salt } = getInstamojoKeys();

  const {
    payment_id,
    payment_request_id,
    buyer,
    buyer_name,
    buyer_phone,
    amount,
    fees,
    status,
    longurl,
    mac,
  } = req.body as Record<string, string>;

  // Verify MAC signature (Instamojo security)
  if (salt) {
    const fields = { payment_id, payment_request_id, buyer, buyer_name, buyer_phone, amount, fees, status, longurl };
    const sortedValues = Object.keys(fields).sort().map((k) => (fields as any)[k]).join("|");
    const expectedMac = crypto.createHmac("sha1", salt).update(sortedValues).digest("hex");
    if (mac !== expectedMac) {
      console.error("Instamojo webhook MAC mismatch");
      res.status(400).json({ error: "Invalid MAC" });
      return;
    }
  }

  if (status !== "Credit" || !payment_request_id) {
    res.json({ ok: true });
    return;
  }

  // Find deposit by payment_request_id
  const [deposit] = await db
    .select()
    .from(walletDepositsTable)
    .where(eq(walletDepositsTable.paymentRequestId, payment_request_id));

  if (!deposit) {
    console.error("Instamojo webhook: deposit not found for payment_request_id", payment_request_id);
    res.json({ ok: true });
    return;
  }

  if (deposit.status === "success") {
    res.json({ ok: true, already: true });
    return;
  }

  try {
    const credited = await creditDepositAndWallet(deposit.id, payment_id);
    console.log(`[Webhook] Deposit ${deposit.id} ${credited ? "credited" : "already credited"}`);
    res.json({ ok: true, credited });
  } catch (err) {
    console.error("Instamojo webhook credit error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

// ── INSTAMOJO: User auto-verify pending deposits ───────────────────────────
router.post("/wallet/deposit/instamojo/verify-pending", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.id;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours

  const pendingDeposits = await db
    .select()
    .from(walletDepositsTable)
    .where(
      and(
        eq(walletDepositsTable.userId, userId),
        eq(walletDepositsTable.paymentMethod, "instamojo"),
        eq(walletDepositsTable.status, "pending"),
        gte(walletDepositsTable.createdAt, since)
      )
    );

  if (pendingDeposits.length === 0) {
    res.json({ credited: 0 });
    return;
  }

  const { apiKey, authToken } = getInstamojoKeys();
  let credited = 0;

  for (const deposit of pendingDeposits) {
    if (!deposit.paymentRequestId) continue;
    try {
      const verifyRes = await fetch(`${INSTAMOJO_BASE}/payment-requests/${deposit.paymentRequestId}/`, {
        headers: { "X-Api-Key": apiKey, "X-Auth-Token": authToken },
      });
      if (!verifyRes.ok) continue;
      const verifyData = await verifyRes.json() as any;
      if (!verifyData.success) continue;

      const payments: any[] = verifyData.payment_request?.payments || [];
      const creditedPayment = payments.find((p: any) => p.status === "Credit");
      if (!creditedPayment) continue;

      const ok = await creditDepositAndWallet(deposit.id, creditedPayment.payment_id);
      if (ok) credited++;
    } catch (_) {}
  }

  res.json({ credited });
});

// ── INSTAMOJO: Admin manual re-verify ──────────────────────────────────────
router.post("/admin/deposits/:id/instamojo-verify", requireAdmin, async (req, res): Promise<void> => {
  const depositId = parseInt(req.params.id);
  const [deposit] = await db.select().from(walletDepositsTable).where(eq(walletDepositsTable.id, depositId));

  if (!deposit || deposit.paymentMethod !== "instamojo") {
    res.status(404).json({ error: "Instamojo deposit not found" });
    return;
  }

  if (deposit.status === "success") {
    res.json({ success: true, message: "Already credited" });
    return;
  }

  if (!deposit.paymentRequestId) {
    res.status(400).json({ error: "No payment_request_id — cannot verify" });
    return;
  }

  const { apiKey, authToken } = getInstamojoKeys();
  try {
    const verifyRes = await fetch(`${INSTAMOJO_BASE}/payment-requests/${deposit.paymentRequestId}/`, {
      headers: { "X-Api-Key": apiKey, "X-Auth-Token": authToken },
    });
    const verifyData = await verifyRes.json() as any;

    if (!verifyRes.ok || !verifyData.success) {
      res.status(502).json({ error: "Instamojo verification failed", detail: verifyData });
      return;
    }

    const payments: any[] = verifyData.payment_request?.payments || [];
    const credited = payments.find((p: any) => p.status === "Credit");

    if (!credited) {
      res.status(400).json({ error: "No credited payment found on Instamojo" });
      return;
    }

    await creditDepositAndWallet(depositId, credited.payment_id);
    res.json({ success: true, message: "Wallet credited successfully" });
  } catch (err) {
    console.error("Admin re-verify error:", err);
    res.status(500).json({ error: "Internal error" });
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

router.get("/wallet/deposits/:id", requireAuth, async (req, res): Promise<void> => {
  const depositId = parseInt(req.params.id);
  if (isNaN(depositId)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [d] = await db
    .select()
    .from(walletDepositsTable)
    .where(and(eq(walletDepositsTable.id, depositId), eq(walletDepositsTable.userId, req.user!.id)));

  if (!d) { res.status(404).json({ error: "Deposit not found" }); return; }

  res.json({
    id: d.id,
    amount: d.amount,
    utrNumber: d.utrNumber,
    paymentMethod: d.paymentMethod,
    paymentRequestId: d.paymentRequestId,
    status: d.status,
    adminNote: d.adminNote,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  });
});

router.get("/admin/deposits", requireAdmin, async (_req, res): Promise<void> => {
  const deposits = await db
    .select()
    .from(walletDepositsTable)
    .where(sql`${walletDepositsTable.paymentMethod} != 'referral_bonus'`)
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
        paymentRequestId: d.paymentRequestId,
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
        await sendDepositConfirmedEmail(user.email, user.name, String(amount), String(newBalance), ref, depositId);
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
