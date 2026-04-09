import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Info, Inbox,
  CreditCard, Zap,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";

const AMOUNTS = [10, 20, 30, 50, 100];
const DAILY_LIMIT = 100;
const MONTHLY_LIMIT = 3000;

type PageTab = "add" | "history";

interface Deposit {
  id: number;
  amount: string;
  utrNumber?: string | null;
  paymentMethod?: string;
  status: string;
  adminNote?: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    pending:  { bg: "#fef3c7", text: "#92400e", icon: <Clock className="h-3 w-3" />,        label: "Under Review" },
    approved: { bg: "#d1fae5", text: "#065f46", icon: <CheckCircle className="h-3 w-3" />,  label: "Credited" },
    success:  { bg: "#d1fae5", text: "#065f46", icon: <CheckCircle className="h-3 w-3" />,  label: "Credited" },
    rejected: { bg: "#fee2e2", text: "#991b1b", icon: <XCircle className="h-3 w-3" />,      label: "Rejected" },
  };
  const c = cfg[status] ?? { bg: "#f3f4f6", text: "#374151", icon: null, label: status };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.icon}{c.label}
    </span>
  );
}

export default function WalletDeposit() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<PageTab>("add");
  const [customAmount, setCustomAmount] = useState("");
  const [paying, setPaying] = useState(false);
  const [history, setHistory] = useState<Deposit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [limits, setLimits] = useState<{ dailyUsed: number; monthlyUsed: number; dailyRemaining: number; monthlyRemaining: number } | null>(null);

  const finalAmount = customAmount ? parseFloat(customAmount) : 0;

  // Handle Instamojo callback redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get("instamojo");
    const amount = params.get("amount");
    if (status === "success") {
      toast({ title: `₹${amount || ""} added to your wallet!`, description: "Payment verified. Amount credited instantly." });
      window.history.replaceState({}, "", window.location.pathname);
      setTab("history");
    } else if (status === "pending") {
      toast({ title: "Payment received — under review", description: "Your payment was received by Instamojo. It will be credited shortly. If not, contact support with your Instamojo receipt." });
      window.history.replaceState({}, "", window.location.pathname);
      setTab("history");
    } else if (status === "failed") {
      const reason = params.get("reason");
      const msg =
        reason === "cancelled" ? "Payment was cancelled." :
        reason === "amount" ? "Amount mismatch. Contact support." :
        "Payment could not be verified. If money was deducted, contact support.";
      toast({ title: "Payment Failed", description: msg, variant: "destructive" });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    fetch("/api/wallet/deposit/limits", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setLimits(d); })
      .catch(() => {});
  }, []);

  const fetchHistory = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/wallet/deposits/my", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handlePayInstamojo = async () => {
    if (!finalAmount || finalAmount < 10) {
      toast({ title: "Minimum deposit is ₹10", variant: "destructive" });
      return;
    }
    if (limits && finalAmount > limits.dailyRemaining) {
      toast({ title: "Daily limit exceeded", description: `You can deposit ₹${limits.dailyRemaining.toFixed(0)} more today.`, variant: "destructive" });
      return;
    }
    if (limits && finalAmount > limits.monthlyRemaining) {
      toast({ title: "Monthly limit exceeded", description: `You can deposit ₹${limits.monthlyRemaining.toFixed(0)} more this month.`, variant: "destructive" });
      return;
    }

    setPaying(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/wallet/deposit/instamojo/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Payment initiation failed", variant: "destructive" });
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setPaying(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-4 max-w-lg pb-20">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {tab !== "add" ? (
            <button onClick={() => setTab("add")} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/wallet"><ArrowLeft className="h-4 w-4" /> Wallet</Link>
            </Button>
          )}
          <h1 className="text-xl font-black flex-1">
            {tab === "history" ? "Deposit History" : "Add Money"}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-4">
          {(["add", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "history") fetchHistory(); }}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {t === "add" ? "Add Money" : `History${history.length > 0 ? ` (${history.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ─── ADD MONEY ─── */}
        {tab === "add" && (
          <div className="space-y-5">

            {/* Instamojo badge */}
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5">
              <Zap className="h-4 w-4 text-blue-600 shrink-0" />
              <p className="text-xs text-blue-700 font-semibold">Powered by Instamojo — Instant, secure payment</p>
            </div>

            {/* Amount selection */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">Select Amount</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {AMOUNTS.map((amt) => {
                  const sel = customAmount === String(amt);
                  return (
                    <button
                      key={amt}
                      onClick={() => setCustomAmount(String(amt))}
                      className={`py-3.5 rounded-xl border-2 text-base font-bold transition-colors ${sel ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom amount */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Or enter custom amount</Label>
              <div className={`flex items-center gap-2 rounded-xl border-2 px-4 bg-card transition-colors ${finalAmount >= 10 ? "border-primary" : "border-border"}`}>
                <span className="text-xl font-black text-amber-500">₹</span>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg font-bold py-4 px-0"
                />
              </div>
            </div>

            {/* Limits info */}
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2">
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium">Minimum ₹10. Money credited instantly after payment.</p>
              </div>
              {limits && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-lg bg-white border border-amber-200 px-3 py-2">
                    <p className="text-xs text-amber-600 font-semibold">Today's Limit</p>
                    <p className="text-sm font-black text-amber-800">₹{limits.dailyRemaining.toFixed(0)} left</p>
                    <p className="text-xs text-amber-500">of ₹{DAILY_LIMIT}/day</p>
                  </div>
                  <div className="rounded-lg bg-white border border-amber-200 px-3 py-2">
                    <p className="text-xs text-amber-600 font-semibold">Monthly Limit</p>
                    <p className="text-sm font-black text-amber-800">₹{limits.monthlyRemaining.toFixed(0)} left</p>
                    <p className="text-xs text-amber-500">of ₹{MONTHLY_LIMIT}/month</p>
                  </div>
                </div>
              )}
            </div>

            {/* Pay button */}
            <Button
              className="w-full gap-2 h-12 text-base font-bold"
              disabled={finalAmount < 10 || paying}
              onClick={handlePayInstamojo}
            >
              {paying ? (
                <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Redirecting to Instamojo...</>
              ) : (
                <><CreditCard className="h-5 w-5" /> Pay ₹{finalAmount || "—"} via Instamojo</>
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              You will be redirected to Instamojo's secure payment page. Money is credited instantly after successful payment.
            </p>
          </div>
        )}

        {/* ─── HISTORY ─── */}
        {tab === "history" && (
          <div className="mt-2">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">No deposits yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((d) => {
                  const isGood = d.status === "approved" || d.status === "success";
                  const isBad = d.status === "rejected";
                  const isInstamojo = d.paymentMethod === "instamojo";
                  return (
                    <div key={d.id} className="rounded-xl border-2 bg-card p-4 space-y-3" style={{
                      borderColor: isGood ? "#bbf7d0" : isBad ? "#fecaca" : "hsl(var(--border))",
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-black text-foreground">₹{Number(d.amount).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(d.createdAt)}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${isInstamojo ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                            {isInstamojo ? "Instamojo" : "UPI Manual"}
                          </span>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>

                      {d.utrNumber && (
                        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                          <span className="text-xs text-muted-foreground">Ref: <span className="font-bold text-foreground font-mono">{d.utrNumber}</span></span>
                        </div>
                      )}

                      {isGood && (
                        <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                          <CheckCircle className="h-4 w-4 text-green-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-green-700">Payment Verified — Amount Credited ✅</p>
                            <p className="text-xs text-green-600 mt-0.5">₹{Number(d.amount).toLocaleString("en-IN")} added to your wallet</p>
                          </div>
                        </div>
                      )}
                      {isBad && (
                        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                          <XCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-red-700">Payment Failed / Rejected</p>
                            <p className="text-xs text-red-600 mt-0.5">{d.adminNote ?? "Contact support if money was deducted."}</p>
                          </div>
                        </div>
                      )}
                      {!isGood && !isBad && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">
                            {isInstamojo ? "Payment initiated — verifying..." : "Under review · Will be credited within 1–4 hours"}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
