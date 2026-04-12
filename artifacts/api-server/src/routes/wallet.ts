import { Router, type IRouter } from "express";
import { db, walletTransactionsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/wallet/transactions", requireAuth, async (req, res): Promise<void> => {
  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.userId, req.user!.id))
    .orderBy(desc(walletTransactionsTable.createdAt));

  res.json(
    transactions.map((t) => ({
      id: t.id,
      userId: t.userId,
      amount: t.amount,
      type: t.type,
      description: t.description,
      balanceAfter: t.balanceAfter,
      createdAt: t.createdAt.toISOString(),
    }))
  );
});

router.get("/wallet/transactions/:id", requireAuth, async (req, res): Promise<void> => {
  const txId = parseInt(req.params.id);
  const [tx] = await db
    .select()
    .from(walletTransactionsTable)
    .where(and(eq(walletTransactionsTable.id, txId), eq(walletTransactionsTable.userId, req.user!.id)));

  if (!tx) {
    res.status(404).json({ error: "Transaction not found" });
    return;
  }

  res.json({
    id: tx.id,
    userId: tx.userId,
    amount: tx.amount,
    type: tx.type,
    description: tx.description,
    balanceAfter: tx.balanceAfter,
    createdAt: tx.createdAt.toISOString(),
  });
});

router.get("/wallet/balance", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    balance: user.walletBalance,
    winningBalance: user.winningBalance ?? "0.00",
    depositBalance: (parseFloat(String(user.walletBalance)) - parseFloat(String(user.winningBalance ?? "0"))).toFixed(2),
  });
});

export default router;
