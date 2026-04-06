import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import {
  ArrowLeft, Hash, CheckCircle, XCircle, Clock, Info, ArrowRight,
  Smartphone, Send, Inbox,
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

type Step = "amount" | "payment" | "utr";
type PageTab = "add" | "history";

interface Deposit {
  id: number;
  amount: string;
  utrNumber: string;
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

function StepIndicator({ step }: { step: Step }) {
  const steps: Step[] = ["amount", "payment", "utr"];
  const idx = steps.indexOf(step);
  return (
    <div className="flex items-center justify-center gap-0 py-3">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i <= idx ? "bg-primary" : "bg-muted"}`}>
            {i < idx ? <CheckCircle className="h-4 w-4" /> : i + 1}
          </div>
          {i < 2 && <div className={`w-12 h-0.5 ${i < idx ? "bg-primary" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

export default function WalletDeposit() {
  const { toast } = useToast();
  const [tab, setTab] = useState<PageTab>("add");
  const [step, setStep] = useState<Step>("amount");
  const [customAmount, setCustomAmount] = useState("");
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [settings, setSettings] = useState<{ qrCodeUrl?: string | null; upiId?: string | null }>({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [history, setHistory] = useState<Deposit[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [limits, setLimits] = useState<{ dailyUsed: number; monthlyUsed: number; dailyRemaining: number; monthlyRemaining: number } | null>(null);

  const finalAmount = customAmount ? parseFloat(customAmount) : 0;

  useEffect(() => {
    fetch("/api/payment/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
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

  const handleContinue = () => {
    if (!finalAmount || finalAmount < 10) {
      toast({ title: "Minimum deposit is ₹10", variant: "destructive" });
      return;
    }
    if (limits && finalAmount > limits.dailyRemaining) {
      toast({ title: `Daily limit exceeded`, description: `You can only deposit ₹${limits.dailyRemaining.toFixed(2)} more today (₹${DAILY_LIMIT}/day limit).`, variant: "destructive" });
      return;
    }
    if (limits && finalAmount > limits.monthlyRemaining) {
      toast({ title: `Monthly limit exceeded`, description: `You can only deposit ₹${limits.monthlyRemaining.toFixed(2)} more this month (₹${MONTHLY_LIMIT}/month limit).`, variant: "destructive" });
      return;
    }
    setStep("payment");
  };

  const handleSubmitUtr = async () => {
    if (utr.trim().length < 6) {
      toast({ title: "Please enter a valid UTR (min 6 chars)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount, utrNumber: utr.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Submission failed", variant: "destructive" }); return; }
      await fetchHistory();
      setCustomAmount(""); setUtr(""); setStep("amount"); setTab("history");
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const headerTitle = tab === "history"
    ? "Deposit History"
    : step === "amount" ? "Add Money" : step === "payment" ? "Scan & Pay" : "Enter UTR";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-4 max-w-lg pb-20">

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {(tab !== "add" || step !== "amount") ? (
            <button
              onClick={() => {
                if (tab === "history") { setTab("add"); return; }
                if (step === "utr") setStep("payment");
                else if (step === "payment") setStep("amount");
              }}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
          ) : (
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/wallet"><ArrowLeft className="h-4 w-4" /> Wallet</Link>
            </Button>
          )}
          <h1 className="text-xl font-black flex-1">{headerTitle}</h1>
        </div>

        {/* Page Tabs */}
        <div className="flex border-b border-border mb-1">
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

        {/* Step Indicator */}
        {tab === "add" && <StepIndicator step={step} />}

        {/* ─── ADD MONEY STEPS ─── */}
        {tab === "add" && step === "amount" && (
          <div className="space-y-5 mt-2">
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

            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2">
              <div className="flex items-start gap-2.5">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-medium">Minimum deposit ₹10. Money credited after payment verification (1–4 hours).</p>
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

            <Button
              className="w-full gap-2"
              disabled={finalAmount < 10}
              onClick={handleContinue}
            >
              Continue with ₹{finalAmount || "—"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {tab === "add" && step === "payment" && (
          <div className="space-y-5 mt-2">
            <div className="flex justify-center">
              <span className="px-5 py-2 rounded-full bg-amber-100 text-amber-700 font-black text-lg">Pay ₹{finalAmount}</span>
            </div>

            {settingsLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : settings.qrCodeUrl ? (
              <div className="rounded-2xl border-2 border-border bg-card p-5 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground font-semibold">Scan QR to pay</p>
                <img src={settings.qrCodeUrl} alt="QR Code" className="w-52 h-52 object-contain rounded-xl" />
                {settings.upiId && (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted w-full justify-center">
                    <Smartphone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold text-foreground">{settings.upiId}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-10 flex flex-col items-center gap-3">
                <Info className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">Payment QR not set up yet. Please contact admin.</p>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="font-bold text-sm text-foreground">How to pay:</p>
              {[
                "Open your UPI app (GPay, PhonePe, Paytm, etc.)",
                `Scan the QR code above and pay ₹${finalAmount}`,
                "Copy the UTR/Transaction ID shown after payment",
                "Click 'I have paid' and enter the UTR below",
              ].map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0 mt-0.5">{i + 1}</div>
                  <p className="text-sm text-muted-foreground">{s}</p>
                </div>
              ))}
            </div>

            <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" onClick={() => setStep("utr")}>
              <CheckCircle className="h-4 w-4" /> I have Paid — Enter UTR
            </Button>
          </div>
        )}

        {tab === "add" && step === "utr" && (
          <div className="space-y-5 mt-2">
            <div className="flex justify-center">
              <span className="px-5 py-2 rounded-full bg-amber-100 text-amber-700 font-black text-lg">Amount: ₹{finalAmount}</span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">UTR / Transaction Reference</Label>
              <div className={`flex items-center gap-3 rounded-xl border-2 px-4 bg-card transition-colors ${utr.trim().length >= 6 ? "border-primary" : "border-border"}`}>
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <Input
                  value={utr}
                  onChange={(e) => setUtr(e.target.value.toUpperCase())}
                  placeholder="Enter UTR / Ref number"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 font-mono text-base"
                  autoCapitalize="characters"
                />
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-3.5 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">UTR is the 12-digit reference number shown in your payment receipt. Example: 123456789012</p>
            </div>

            <Button
              className="w-full gap-2"
              disabled={utr.trim().length < 6 || submitting}
              onClick={handleSubmitUtr}
            >
              {submitting
                ? <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Submitting...</>
                : <><Send className="h-4 w-4" /> Submit Payment Request</>}
            </Button>

            <p className="text-center text-xs text-muted-foreground">Your request will be reviewed and money credited within 1–4 hours.</p>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {tab === "history" && (
          <div className="mt-4">
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">No deposit requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((d) => {
                  const isGood = d.status === "approved" || d.status === "success";
                  const isBad = d.status === "rejected";
                  return (
                    <div key={d.id} className="rounded-xl border-2 bg-card p-4 space-y-3" style={{
                      borderColor: isGood ? "#bbf7d0" : isBad ? "#fecaca" : "hsl(var(--border))",
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-black text-foreground">₹{Number(d.amount).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(d.createdAt)}</p>
                        </div>
                        <StatusBadge status={d.status} />
                      </div>

                      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                        <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">UTR: <span className="font-bold text-foreground">{d.utrNumber}</span></span>
                      </div>

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
                            <p className="text-xs font-black text-red-700">Payment Rejected</p>
                            <p className="text-xs text-red-600 mt-0.5">{d.adminNote ?? "Invalid or duplicate UTR. Please contact support."}</p>
                          </div>
                        </div>
                      )}
                      {!isGood && !isBad && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">Under review · Will be credited within 1–4 hours</p>
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
