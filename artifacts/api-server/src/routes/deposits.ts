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

// Helper to get user's total non-rejected deposits in a time window
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
    res.status(400).json({
      error: `Daily deposit limit exceeded. You can deposit ₹${remaining} more today (limit: ₹${DAILY_LIMIT}/day).`,
    });
    return;
  }

  if (monthlyUsed + parsedAmount > MONTHLY_LIMIT) {
    const remaining = Math.max(0, MONTHLY_LIMIT - monthlyUsed);
    res.status(400).json({
      error: `Monthly deposit limit exceeded. You can deposit ₹${remaining} more this month (limit: ₹${MONTHLY_LIMIT}/month).`,
    });
    return;
  }

  const [deposit] = await db
    .insert(walletDepositsTable)
    .values({
      userId: req.user!.id,
      amount: String(parsedAmount),
      utrNumber: utr,
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

      await db.insert(walletTransactionsTable).values({
        userId: deposit.userId,
        amount: String(amount),
        type: "credit",
        description: `Wallet top-up via UPI (UTR: ${deposit.utrNumber})`,
        balanceAfter: String(newBalance),
      });

      try {
        await sendDepositConfirmedEmail(user.email, user.name, String(amount), String(newBalance), deposit.utrNumber);
      } catch (err) { console.error("Deposit confirmed email failed:", err); }
    }
  }

  if (status === "rejected" && deposit.status === "success") {
    const amount = parseFloat(String(deposit.amount));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));

    if (user) {
      const newBalance = Math.max(0, parseFloat(String(user.walletBalance)) - amount);

      await db
        .update(usersTable)
        .set({ walletBalance: String(newBalance) })
        .where(eq(usersTable.id, deposit.userId));

      await db.insert(walletTransactionsTable).values({
        userId: deposit.userId,
        amount: String(amount),
        type: "debit",
        description: `Deposit reversal (UTR: ${deposit.utrNumber})`,
        balanceAfter: String(newBalance),
      });

      try {
        await sendDepositRejectedEmail(user.email, user.name, String(amount), deposit.utrNumber, adminNote);
      } catch (err) { console.error("Deposit rejected email failed:", err); }
    }
  }

  if (status === "rejected" && deposit.status !== "success" && deposit.status !== "rejected") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, deposit.userId));
    if (user) {
      try {
        await sendDepositRejectedEmail(user.email, user.name, String(deposit.amount), deposit.utrNumber, adminNote);
      } catch (err) { console.error("Deposit rejected email failed:", err); }
    }
  }

  res.json({ success: true, status });
});

export default router;
