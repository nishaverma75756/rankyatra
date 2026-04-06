import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  CreditCard, ArrowDownCircle, ArrowUpCircle, Clock,
  Plus, ArrowUp, Lock, RefreshCw, LayoutList,
  Trophy, Wallet, ShieldCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useGetWalletBalance, useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth";

type HistoryTab = "all" | "deposits" | "withdrawals";

interface WalletTransaction {
  id: number;
  amount: string | number;
  type: "credit" | "debit";
  description: string;
  balanceAfter: string | number;
  createdAt: string;
}

interface Deposit {
  id: number;
  amount: string | number;
  utrNumber?: string;
  utr_number?: string;
  status: string;
  createdAt?: string;
  created_at?: string;
}

interface Withdrawal {
  id: number;
  amount: string | number;
  bankName?: string;
  bank_name?: string;
  accountNumber?: string;
  account_number?: string;
  utrNumber?: string;
  utr_number?: string;
  status: string;
  createdAt?: string;
  created_at?: string;
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:  { bg: "#f59e0b22", text: "#d97706" },
  approved: { bg: "#10b98122", text: "#059669" },
  success:  { bg: "#10b98122", text: "#059669" },
  credited: { bg: "#10b98122", text: "#059669" },
  rejected: { bg: "#ef444422", text: "#dc2626" },
};
function statusStyle(s: string) {
  return STATUS_COLOR[s?.toLowerCase()] ?? { bg: "#6b728022", text: "#6b7280" };
}

function fmtDateTime(raw?: string) {
  if (!raw) return "—";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

async function apiFetch(url: string) {
  const token = getAuthToken();
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  return res.json();
}

function getTxIcon(desc: string, type: string) {
  const d = desc.toLowerCase();
  if (d.startsWith("prize") || d.includes("reward"))
    return <Trophy className="h-5 w-5 text-yellow-500" />;
  if (d.startsWith("exam registration") || d.includes("contest"))
    return <ArrowUpCircle className="h-5 w-5 text-orange-500" />;
  if (d.includes("withdrawal") || d.includes("bank"))
    return <ArrowUpCircle className="h-5 w-5 text-red-600" />;
  if (d.includes("top-up") || d.includes("deposit"))
    return <ArrowDownCircle className="h-5 w-5 text-green-600" />;
  if (d.includes("admin"))
    return <ShieldCheck className="h-5 w-5 text-blue-500" />;
  return type === "credit"
    ? <ArrowDownCircle className="h-5 w-5 text-green-600" />
    : <ArrowUpCircle className="h-5 w-5 text-red-600" />;
}

function getTxIconBg(desc: string, type: string) {
  const d = desc.toLowerCase();
  if (d.startsWith("prize") || d.includes("reward")) return "bg-yellow-500/10";
  if (d.startsWith("exam registration") || d.includes("contest")) return "bg-orange-500/10";
  if (d.includes("withdrawal") || d.includes("bank")) return "bg-red-500/10";
  if (d.includes("top-up") || d.includes("deposit")) return "bg-green-500/10";
  if (d.includes("admin")) return "bg-blue-500/10";
  return type === "credit" ? "bg-green-500/10" : "bg-red-500/10";
}

export default function WalletPage() {
  const { user: authUser } = useAuth();
  const [, setLocation] = useLocation();
  const { data: balanceData, refetch: refetchBalance, isRefetching } = useGetWalletBalance();
  const { data: profileData } = useGetProfile({ query: { refetchInterval: 15000 } });

  const [tab, setTab] = useState<HistoryTab>("all");
  const [allTx, setAllTx] = useState<WalletTransaction[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadingDep, setLoadingDep] = useState(false);
  const [loadingWd, setLoadingWd] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!authUser) return;
    setLoadingAll(true);
    try { setAllTx(await apiFetch("/api/wallet/transactions")); }
    finally { setLoadingAll(false); }
  }, [authUser]);

  const fetchDeposits = useCallback(async () => {
    if (!authUser) return;
    setLoadingDep(true);
    try { setDeposits(await apiFetch("/api/wallet/deposits/my")); }
    finally { setLoadingDep(false); }
  }, [authUser]);

  const fetchWithdrawals = useCallback(async () => {
    if (!authUser) return;
    setLoadingWd(true);
    try { setWithdrawals(await apiFetch("/api/wallet/withdrawals/my")); }
    finally { setLoadingWd(false); }
  }, [authUser]);

  useEffect(() => {
    if (authUser) { fetchAll(); fetchDeposits(); fetchWithdrawals(); }
  }, [authUser]);

  const handleRefresh = async () => {
    await Promise.all([refetchBalance(), fetchAll(), fetchDeposits(), fetchWithdrawals()]);
  };

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CreditCard className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black">Your Wallet</h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Log in to view your balance, add money, and track transactions.
          </p>
          <Button className="w-full max-w-xs" asChild><Link href="/login">Sign In</Link></Button>
          <Button variant="outline" className="w-full max-w-xs" asChild><Link href="/signup">Create Account</Link></Button>
        </div>
      </div>
    );
  }

  const balance = Number((balanceData as any)?.balance ?? 0);
  const isVerified = (profileData as any)?.verificationStatus === "verified" || (authUser as any)?.verificationStatus === "verified";

  const isLoading =
    tab === "all" ? loadingAll :
    tab === "deposits" ? loadingDep : loadingWd;

  const TABS = [
    { key: "all" as HistoryTab,         label: "All",          icon: <LayoutList className="h-3.5 w-3.5" />,      count: allTx.length },
    { key: "deposits" as HistoryTab,    label: "Deposits",     icon: <ArrowDownCircle className="h-3.5 w-3.5" />, count: deposits.length },
    { key: "withdrawals" as HistoryTab, label: "Withdrawals",  icon: <ArrowUpCircle className="h-3.5 w-3.5" />,   count: withdrawals.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-2xl pb-24">

        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-black text-foreground">Wallet</h1>
          <button onClick={handleRefresh} disabled={isRefetching}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Wallet Banner */}
        <div className="rounded-2xl bg-secondary text-white p-5 mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="rounded-xl bg-white/10 p-2.5 shrink-0">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-white/60 font-semibold uppercase tracking-wide">Wallet Balance</p>
              <p className="text-2xl font-black text-white leading-tight">
                ₹{balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => setLocation("/wallet/deposit")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Add Money
            </button>
            <button
              onClick={() => setLocation(isVerified ? "/wallet/withdraw" : "/verify")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 ${
                isVerified
                  ? "bg-white/15 text-white hover:bg-white/25"
                  : "bg-red-500/25 text-red-300 border border-red-500/40 hover:bg-red-500/35"
              }`}
            >
              {isVerified
                ? <><ArrowUp className="h-4 w-4" /> Withdraw</>
                : <><Lock className="h-4 w-4" /> Need Verify</>}
            </button>
          </div>
        </div>

        {/* How to add money */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-5 flex items-start gap-3">
          <Wallet className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm text-foreground">How to add money</p>
            <p className="text-xs text-muted-foreground mt-1">
              Contact admin or use UPI/Bank Transfer. Ask the admin to credit your wallet via the admin panel. Minimum ₹5 required to join any exam.
            </p>
          </div>
        </div>

        <h2 className="text-lg font-black text-foreground mb-3">Transaction History</h2>

        {/* 3 Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted border border-border mb-4">
          {TABS.map(({ key, label, icon, count }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-colors ${
                tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}>
              {icon}{label}{count > 0 ? ` (${count})` : ""}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "all" ? (
          allTx.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <Clock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allTx.map((tx) => {
                const isCredit = tx.type === "credit";
                return (
                  <div key={tx.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${getTxIconBg(tx.description, tx.type)}`}>
                      {getTxIcon(tx.description, tx.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(tx.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-sm ${isCredit ? "text-green-600" : "text-red-600"}`}>
                        {isCredit ? "+" : "-"}₹{Number(tx.amount).toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground">Bal: ₹{Number(tx.balanceAfter).toLocaleString("en-IN")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : tab === "deposits" ? (
          deposits.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <Clock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No deposits yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {deposits.map((d) => {
                const st = statusStyle(d.status);
                const utr = d.utrNumber ?? d.utr_number;
                const ts = d.createdAt ?? d.created_at;
                const statusLabel = (d.status === "success" || d.status === "approved") ? "Credited" : d.status.charAt(0).toUpperCase() + d.status.slice(1);
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                      <ArrowDownCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">Deposit{utr ? ` • UTR: ${utr}` : ""}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(ts)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-green-600">+₹{Number(d.amount).toLocaleString("en-IN")}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: st.bg, color: st.text }}>{statusLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          withdrawals.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
              <Clock className="h-10 w-10 opacity-30" />
              <p className="text-sm">No withdrawals yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => {
                const st = statusStyle(w.status);
                const bank = w.bankName ?? w.bank_name;
                const acct = w.accountNumber ?? w.account_number;
                const utr = w.utrNumber ?? w.utr_number;
                const ts = w.createdAt ?? w.created_at;
                const statusLabel = (w.status === "success" || w.status === "approved") ? "Transferred" : w.status.charAt(0).toUpperCase() + w.status.slice(1);
                return (
                  <div key={w.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5">
                    <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                      <ArrowUpCircle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {bank ? `${bank}${acct ? ` ••${acct.slice(-4)}` : ""}` : "Withdrawal"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(ts)}{utr ? ` • UTR: ${utr}` : ""}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm text-red-600">-₹{Number(w.amount).toLocaleString("en-IN")}</p>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: st.bg, color: st.text }}>{statusLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}
