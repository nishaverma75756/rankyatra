import { Router, type IRouter } from "express";
import {
  db,
  walletWithdrawalsTable,
  usersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { sendWithdrawalRequestEmail, sendWithdrawalApprovedEmail, sendWithdrawalRejectedEmail } from "../lib/email";

const router: IRouter = Router();

router.post("/wallet/withdraw", requireAuth, async (req, res): Promise<void> => {
  const { amount, paymentMethod, paymentDetails } = req.body;

  if (!amount || !paymentMethod || !paymentDetails) {
    res.status(400).json({ error: "Amount, payment method and payment details are required" });
    return;
  }

  const parsedAmount = parseFloat(String(amount));
  if (isNaN(parsedAmount) || parsedAmount < 10) {
    res.status(400).json({ error: "Minimum withdrawal amount is ₹10" });
    return;
  }

  if (!["upi", "bank"].includes(paymentMethod)) {
    res.status(400).json({ error: "Invalid payment method" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const currentWinning = parseFloat(String(user.winningBalance ?? "0"));
  if (currentWinning < parsedAmount) {
    res.status(400).json({
      error: `Insufficient winning balance. Only winnings (₹${currentWinning.toFixed(2)}) can be withdrawn. Deposit balance cannot be withdrawn.`,
    });
    return;
  }

  const currentBalance = parseFloat(String(user.walletBalance));
  const newBalance = Math.max(0, currentBalance - parsedAmount);
  const newWinning = Math.max(0, currentWinning - parsedAmount);

  await db
    .update(usersTable)
    .set({ walletBalance: String(newBalance), winningBalance: String(newWinning) })
    .where(eq(usersTable.id, req.user!.id));

  const [withdrawal] = await db
    .insert(walletWithdrawalsTable)
    .values({
      userId: req.user!.id,
      amount: String(parsedAmount),
      paymentMethod,
      paymentDetails: String(paymentDetails).trim(),
      status: "pending",
    })
    .returning();

  await db.insert(walletTransactionsTable).values({
    userId: req.user!.id,
    amount: String(parsedAmount),
    type: "debit",
    description: `Withdrawal request via ${paymentMethod === "upi" ? "UPI" : "Bank Transfer"} (ID: #${withdrawal.id})`,
    balanceAfter: String(newBalance),
  });

  try {
    await sendWithdrawalRequestEmail(user.email, user.name, String(parsedAmount), paymentMethod, String(paymentDetails).trim(), withdrawal.id);
  } catch (err) { console.error("Withdrawal request email failed:", err); }

  res.status(201).json({
    id: withdrawal.id,
    amount: withdrawal.amount,
    paymentMethod: withdrawal.paymentMethod,
    paymentDetails: withdrawal.paymentDetails,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt.toISOString(),
  });
});

router.get("/wallet/withdrawals/my", requireAuth, async (req, res): Promise<void> => {
  const withdrawals = await db
    .select()
    .from(walletWithdrawalsTable)
    .where(eq(walletWithdrawalsTable.userId, req.user!.id))
    .orderBy(desc(walletWithdrawalsTable.createdAt));

  res.json(
    withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      paymentMethod: w.paymentMethod,
      paymentDetails: w.paymentDetails,
      status: w.status,
      adminUtrNumber: w.adminUtrNumber,
      adminNote: w.adminNote,
      createdAt: w.createdAt.toISOString(),
      updatedAt: w.updatedAt.toISOString(),
    }))
  );
});

router.get("/admin/withdrawals", requireAdmin, async (_req, res): Promise<void> => {
  const withdrawals = await db
    .select()
    .from(walletWithdrawalsTable)
    .orderBy(desc(walletWithdrawalsTable.createdAt));

  const results = await Promise.all(
    withdrawals.map(async (w) => {
      const [user] = await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, avatarUrl: usersTable.avatarUrl, walletBalance: usersTable.walletBalance })
        .from(usersTable)
        .where(eq(usersTable.id, w.userId));
      return {
        id: w.id,
        amount: w.amount,
        paymentMethod: w.paymentMethod,
        paymentDetails: w.paymentDetails,
        status: w.status,
        adminUtrNumber: w.adminUtrNumber,
        adminNote: w.adminNote,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
        user: user ?? null,
      };
    })
  );

  res.json(results);
});

router.patch("/admin/withdrawals/:id", requireAdmin, async (req, res): Promise<void> => {
  const withdrawalId = parseInt(req.params.id);
  const { status, adminUtrNumber, adminNote } = req.body;

  if (!["approved", "rejected", "pending"].includes(status)) {
    res.status(400).json({ error: "Invalid status. Use approved, rejected or pending" });
    return;
  }

  const [withdrawal] = await db
    .select()
    .from(walletWithdrawalsTable)
    .where(eq(walletWithdrawalsTable.id, withdrawalId));

  if (!withdrawal) {
    res.status(404).json({ error: "Withdrawal not found" });
    return;
  }

  if (status === "approved" && !adminUtrNumber?.trim()) {
    res.status(400).json({ error: "UTR number is required to approve a withdrawal" });
    return;
  }

  await db
    .update(walletWithdrawalsTable)
    .set({
      status,
      adminUtrNumber: adminUtrNumber?.trim() ?? null,
      adminNote: adminNote?.trim() ?? null,
      updatedAt: new Date(),
    })
    .where(eq(walletWithdrawalsTable.id, withdrawalId));

  if (status === "approved" && withdrawal.status !== "approved") {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));
    if (user) {
      try {
        await sendWithdrawalApprovedEmail(user.email, user.name, String(withdrawal.amount), withdrawal.paymentMethod, adminUtrNumber?.trim() ?? null);
      } catch (err) { console.error("Withdrawal approved email failed:", err); }
    }
  }

  if (status === "rejected" && withdrawal.status !== "rejected") {
    const amount = parseFloat(String(withdrawal.amount));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));

    if (user) {
      const newBalance = parseFloat(String(user.walletBalance)) + amount;
      const newWinning = parseFloat(String(user.winningBalance ?? "0")) + amount;
      await db.update(usersTable).set({
        walletBalance: String(newBalance),
        winningBalance: String(newWinning),
      }).where(eq(usersTable.id, withdrawal.userId));
      await db.insert(walletTransactionsTable).values({
        userId: withdrawal.userId,
        amount: String(amount),
        type: "credit",
        description: `Withdrawal #${withdrawal.id} rejected — amount refunded`,
        balanceAfter: String(newBalance),
      });
      try {
        await sendWithdrawalRejectedEmail(user.email, user.name, String(amount), String(newBalance), adminNote?.trim() ?? null);
      } catch (err) { console.error("Withdrawal rejected email failed:", err); }
    }
  }

  if (status === "approved" && withdrawal.status === "rejected") {
    const amount = parseFloat(String(withdrawal.amount));
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, withdrawal.userId));

    if (user) {
      const newBalance = Math.max(0, parseFloat(String(user.walletBalance)) - amount);
      await db.update(usersTable).set({ walletBalance: String(newBalance) }).where(eq(usersTable.id, withdrawal.userId));
      await db.insert(walletTransactionsTable).values({
        userId: withdrawal.userId,
        amount: String(amount),
        type: "debit",
        description: `Withdrawal #${withdrawal.id} re-approved — amount re-deducted`,
        balanceAfter: String(newBalance),
      });
    }
  }

  res.json({ success: true, status });
});

export default router;
