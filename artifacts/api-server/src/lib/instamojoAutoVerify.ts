import {
  db,
  walletDepositsTable,
  usersTable,
  walletTransactionsTable,
} from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { sendDepositConfirmedEmail } from "./email";

const INSTAMOJO_BASE = "https://www.instamojo.com/api/1.1";
const POLL_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes

function getKeys() {
  return {
    apiKey: process.env.INSTAMOJO_API_KEY || "",
    authToken: process.env.INSTAMOJO_AUTH_TOKEN || "",
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
    description: `Wallet top-up (Auto-verified, ID: ${paymentId})`,
    balanceAfter: String(newBalance),
  });

  try {
    await sendDepositConfirmedEmail(user.email, user.name, String(amount), String(newBalance), paymentId, depositId);
  } catch (_) {}

  return true;
}

async function runAutoVerify() {
  const { apiKey, authToken } = getKeys();
  if (!apiKey || !authToken) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  let pending: typeof walletDepositsTable.$inferSelect[];
  try {
    pending = await db
      .select()
      .from(walletDepositsTable)
      .where(
        and(
          eq(walletDepositsTable.paymentMethod, "instamojo"),
          eq(walletDepositsTable.status, "pending"),
          gte(walletDepositsTable.createdAt, since)
        )
      );
  } catch (err) {
    console.error("[AutoVerify] DB query failed:", err);
    return;
  }

  if (pending.length === 0) return;

  console.log(`[AutoVerify] Checking ${pending.length} pending Instamojo deposit(s)...`);

  for (const deposit of pending) {
    if (!deposit.paymentRequestId) continue;

    try {
      const res = await fetch(`${INSTAMOJO_BASE}/payment-requests/${deposit.paymentRequestId}/`, {
        headers: { "X-Api-Key": apiKey, "X-Auth-Token": authToken },
      });

      if (!res.ok) continue;
      const data = await res.json() as any;
      if (!data.success) continue;

      const payments: any[] = data.payment_request?.payments ?? [];
      const credited = payments.find((p: any) => p.status === "Credit");
      if (!credited) continue;

      const ok = await creditDepositAndWallet(deposit.id, credited.payment_id);
      if (ok) {
        console.log(`[AutoVerify] Deposit #${deposit.id} auto-credited ₹${deposit.amount} (payment: ${credited.payment_id})`);
      }
    } catch (err) {
      console.error(`[AutoVerify] Error checking deposit #${deposit.id}:`, err);
    }
  }
}

export function startInstamojoAutoVerify() {
  // Run once after 30s on startup (handles any deposits from before server restart)
  setTimeout(() => runAutoVerify(), 30_000);
  // Then run every 3 minutes
  setInterval(() => runAutoVerify(), POLL_INTERVAL_MS);
  console.log("[AutoVerify] Instamojo auto-verifier started (every 3 minutes)");
}
