import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Lock, Shield, Clock, CheckCircle, XCircle,
  ArrowUpCircle, Smartphone, CreditCard, Info, ChevronDown,
  Check, Inbox,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetWalletBalance, useGetProfile } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";

const AMOUNTS = [50, 100, 200, 500, 1000, 2000];

const STORAGE_KEY = "rankyatra_saved_payment";

const BANKS = [
  "State Bank of India (SBI)", "Punjab National Bank (PNB)", "Bank of Baroda (BoB)",
  "Bank of India (BoI)", "Union Bank of India", "Canara Bank", "Bank of Maharashtra",
  "Central Bank of India", "Indian Overseas Bank (IOB)", "Indian Bank", "UCO Bank",
  "Punjab & Sind Bank", "HDFC Bank", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank",
  "IndusInd Bank", "Yes Bank", "Federal Bank", "Bandhan Bank", "IDBI Bank",
  "City Union Bank", "South Indian Bank", "Karur Vysya Bank", "Tamilnad Mercantile Bank",
];

interface SavedPayment {
  method: "upi" | "bank";
  upiId?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  accountHolderName?: string;
}

interface Withdrawal {
  id: number;
  amount: string;
  paymentMethod: string;
  paymentDetails: string;
  status: string;
  adminUtrNumber?: string | null;
  adminNote?: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
    pending:  { bg: "#fef3c7", text: "#92400e", icon: <Clock className="h-3 w-3" />,       label: "Under Review" },
    approved: { bg: "#d1fae5", text: "#065f46", icon: <CheckCircle className="h-3 w-3" />, label: "Approved" },
    rejected: { bg: "#fee2e2", text: "#991b1b", icon: <XCircle className="h-3 w-3" />,     label: "Rejected" },
  };
  const c = cfg[status] ?? { bg: "#f3f4f6", text: "#374151", icon: null, label: status };
  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: c.bg, color: c.text }}>
      {c.icon}{c.label}
    </span>
  );
}

export default function WalletWithdraw() {
  const { user: authUser } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: walletData, refetch: refetchBalance } = useGetWalletBalance();
  const balance = parseFloat(String((walletData as any)?.balance ?? 0));
  const winningBalance = parseFloat(String((walletData as any)?.winningBalance ?? 0));
  const depositBalance = parseFloat(String((walletData as any)?.depositBalance ?? 0));
  const { data: profileData } = useGetProfile({ query: { refetchInterval: 15000 } });

  const verificationStatus = (profileData as any)?.verificationStatus ?? (authUser as any)?.verificationStatus ?? "not_submitted";
  const isVerified = verificationStatus === "verified";
  const isUnderReview = verificationStatus === "under_review";

  const [tab, setTab] = useState<"request" | "history">("request");
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "bank">("upi");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [savedPayment, setSavedPayment] = useState<SavedPayment | null>(null);
  const [usingSaved, setUsingSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const finalAmount = customAmount ? parseFloat(customAmount) : 0;
  const amountExceedsBalance = finalAmount > 0 && finalAmount > winningBalance;

  const filteredBanks = BANKS.filter((b) => b.toLowerCase().includes(bankSearch.toLowerCase()));

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved: SavedPayment = JSON.parse(raw);
      setSavedPayment(saved);
      applyPaymentData(saved);
      setUsingSaved(true);
    } catch {}
  }, []);

  const applyPaymentData = (data: SavedPayment) => {
    setPaymentMethod(data.method);
    if (data.method === "upi") {
      setUpiId(data.upiId ?? "");
    } else {
      setBankName(data.bankName ?? "");
      setAccountNumber(data.accountNumber ?? "");
      setIfscCode(data.ifscCode ?? "");
      setAccountHolderName(data.accountHolderName ?? "");
    }
  };

  const clearSaved = () => {
    setUsingSaved(false);
    setUpiId(""); setBankName(""); setAccountNumber(""); setIfscCode(""); setAccountHolderName("");
  };

  const fetchHistory = useCallback(async () => {
    const token = getAuthToken();
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/wallet/withdrawals/my", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const buildPaymentDetails = () => {
    if (paymentMethod === "upi") return upiId.trim();
    return [
      `Account Number: ${accountNumber.trim()}`,
      `IFSC Code: ${ifscCode.trim().toUpperCase()}`,
      `Account Holder Name: ${accountHolderName.trim()}`,
      `Bank Name: ${bankName}`,
    ].join("\n");
  };

  const isFormValid = (() => {
    if (!finalAmount || finalAmount < 10 || amountExceedsBalance || winningBalance <= 0) return false;
    if (paymentMethod === "upi") return !!upiId.trim();
    return !!(bankName && accountNumber.trim() && ifscCode.trim() && accountHolderName.trim());
  })();

  const handleSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount, paymentMethod, paymentDetails: buildPaymentDetails() }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Submission failed", variant: "destructive" }); return; }

      const toSave: SavedPayment =
        paymentMethod === "upi"
          ? { method: "upi", upiId: upiId.trim() }
          : { method: "bank", bankName, accountNumber: accountNumber.trim(), ifscCode: ifscCode.trim().toUpperCase(), accountHolderName: accountHolderName.trim() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
      setSavedPayment(toSave); setUsingSaved(true);

      await refetchBalance();
      setCustomAmount("");
      await fetchHistory();
      setTab("history");
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  // ─── KYC Lock Screen ───
  if (!isVerified) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-6 max-w-lg pb-20">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/wallet"><ArrowLeft className="h-4 w-4" /> Wallet</Link>
            </Button>
            <h1 className="text-xl font-black">Withdraw Money</h1>
          </div>
          <div className="flex flex-col items-center gap-5 py-10 text-center">
            <div className={`h-20 w-20 rounded-2xl flex items-center justify-center ${isUnderReview ? "bg-amber-100" : "bg-red-100"}`}>
              {isUnderReview
                ? <Clock className="h-10 w-10 text-amber-500" />
                : <Lock className="h-10 w-10 text-red-500" />}
            </div>
            <h2 className="text-xl font-black text-foreground">
              {isUnderReview ? "Verification Under Review" : "KYC Verification Required"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {isUnderReview
                ? "Your documents are being reviewed by our team. Withdrawal will be unlocked once verified (usually 24–48 hours)."
                : "KYC verification is required before you can withdraw. Please submit your Government ID and PAN card."}
            </p>
            {isUnderReview && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4 text-left max-w-xs">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">Documents received. Admin review in progress — please wait.</p>
              </div>
            )}
            {!isUnderReview && (
              <Button className="gap-2 w-full max-w-xs" asChild>
                <Link href="/verify"><Shield className="h-4 w-4" /> Verify My Profile</Link>
              </Button>
            )}
            <Button variant="outline" className="w-full max-w-xs" asChild>
              <Link href="/wallet">Go Back</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-4 max-w-lg pb-20">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/wallet"><ArrowLeft className="h-4 w-4" /> Wallet</Link>
          </Button>
          <h1 className="text-xl font-black">Withdraw Money</h1>
        </div>

        {/* Balance Pills */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-green-50 border border-green-200">
            <ArrowUpCircle className="h-4 w-4 text-green-600 shrink-0" />
            <div>
              <p className="text-xs text-green-600 font-semibold">Withdrawable</p>
              <p className="text-sm font-black text-green-800">₹{winningBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted border border-border">
            <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Deposit (play only)</p>
              <p className="text-sm font-black text-foreground">₹{depositBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Page Tabs */}
        <div className="flex border-b border-border mb-4">
          {(["request", "history"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); if (t === "history") fetchHistory(); }}
              className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            >
              {t === "request" ? "New Request" : `History${history.length > 0 ? ` (${history.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ─── REQUEST TAB ─── */}
        {tab === "request" && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">Withdrawal Amount</Label>
              <div className="grid grid-cols-3 gap-2.5">
                {AMOUNTS.map((amt) => {
                  const sel = customAmount === String(amt);
                  const disabled = amt > winningBalance;
                  return (
                    <button
                      key={amt}
                      onClick={() => { if (!disabled) setCustomAmount(String(amt)); }}
                      disabled={disabled}
                      className={`py-3.5 rounded-xl border-2 text-base font-bold transition-colors ${disabled ? "opacity-40 cursor-not-allowed border-border text-foreground" : sel ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className={`flex items-center gap-3 rounded-xl border-2 px-4 bg-card transition-colors ${amountExceedsBalance ? "border-destructive" : finalAmount >= 10 ? "border-primary" : "border-border"}`}>
                <span className="text-xl font-black text-amber-500">₹</span>
                <Input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount"
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 text-lg font-bold py-4 px-0"
                />
              </div>
              {amountExceedsBalance && (
                <p className="text-xs text-destructive mt-1 font-medium">⚠ Exceeds withdrawable winnings of ₹{winningBalance.toFixed(2)}</p>
              )}
              {winningBalance <= 0 && (
                <p className="text-xs text-amber-600 mt-1 font-medium">ℹ You have no winning balance to withdraw. Win exams to earn withdrawable balance.</p>
              )}
            </div>

            {/* Payment Method */}
            <div>
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3 block">Payment Method</Label>
              <div className="flex gap-3">
                {(["upi", "bank"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-bold text-sm transition-colors ${paymentMethod === m ? "bg-primary border-primary text-primary-foreground" : "bg-card border-border text-foreground hover:border-primary/50"}`}
                  >
                    {m === "upi" ? <Smartphone className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                    {m === "upi" ? "UPI" : "Bank Transfer"}
                  </button>
                ))}
              </div>
            </div>

            {/* Saved Payment Banner */}
            {usingSaved && savedPayment && (
              <div className="rounded-xl border border-border bg-card p-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Saved Method</p>
                  {savedPayment.method === "upi" ? (
                    <p className="text-sm font-bold text-foreground mt-0.5">UPI · {savedPayment.upiId}</p>
                  ) : (
                    <p className="text-sm font-bold text-foreground mt-0.5">{savedPayment.bankName} · A/C: {savedPayment.accountNumber}</p>
                  )}
                </div>
                <button onClick={clearSaved} className="text-xs font-bold text-primary border border-primary/30 rounded-lg px-3 py-1.5 hover:bg-primary/10 transition-colors">
                  Change
                </button>
              </div>
            )}

            {/* UPI Form */}
            {paymentMethod === "upi" && (
              <div className="space-y-1.5">
                <Label className="font-semibold">Your UPI ID</Label>
                <div className="flex items-center gap-3 rounded-xl border-2 px-4 bg-card border-border">
                  <span className="text-sm text-muted-foreground font-bold">@</span>
                  <Input
                    type="email"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                    autoCapitalize="none"
                  />
                </div>
              </div>
            )}

            {/* Bank Form */}
            {paymentMethod === "bank" && (
              <div className="space-y-3">
                <Label className="font-semibold block">Bank Details</Label>

                {/* Bank Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setBankSearch(""); setShowBankDropdown(!showBankDropdown); }}
                    className="w-full flex items-center gap-3 rounded-xl border-2 border-border bg-card px-4 py-3 text-sm font-semibold hover:border-primary/50 transition-colors"
                  >
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className={`flex-1 text-left ${bankName ? "text-foreground" : "text-muted-foreground"}`}>
                      {bankName || "Select Bank"}
                    </span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showBankDropdown ? "rotate-180" : ""}`} />
                  </button>
                  {showBankDropdown && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border">
                        <Input
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search bank..."
                          className="h-8 text-sm"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-44 overflow-y-auto">
                        {filteredBanks.map((b) => (
                          <button
                            key={b}
                            onClick={() => { setBankName(b); setShowBankDropdown(false); }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-muted transition-colors ${bankName === b ? "font-bold text-primary" : "text-foreground"}`}
                          >
                            {bankName === b && <Check className="h-3 w-3 inline mr-2" />}{b}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {[
                  { label: "Account Number", value: accountNumber, onChange: setAccountNumber, placeholder: "Account Number", type: "text" },
                  { label: "IFSC Code", value: ifscCode, onChange: (v: string) => setIfscCode(v.toUpperCase()), placeholder: "SBIN0001234", type: "text" },
                  { label: "Account Holder Name", value: accountHolderName, onChange: setAccountHolderName, placeholder: "Full name as on bank account", type: "text" },
                ].map((f) => (
                  <div key={f.label} className="space-y-1.5">
                    <Label className="font-semibold text-sm">{f.label}</Label>
                    <Input
                      value={f.value}
                      onChange={(e) => f.onChange(e.target.value)}
                      placeholder={f.placeholder}
                      type={f.type}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-green-200 bg-green-50 p-3.5 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">Only your winning balance (₹{winningBalance.toFixed(2)}) can be withdrawn. Deposit balance is used only for joining exams. Money transferred within 24 hours after admin approval.</p>
            </div>

            <Button
              className="w-full gap-2"
              disabled={!isFormValid || submitting}
              onClick={() => setShowConfirm(true)}
            >
              <ArrowUpCircle className="h-4 w-4" />
              Withdraw ₹{finalAmount || "—"}
            </Button>
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {tab === "history" && (
          <div>
            {historyLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-7 w-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14 text-muted-foreground">
                <Inbox className="h-10 w-10 opacity-30" />
                <p className="text-sm">No withdrawal requests yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((w) => {
                  const isGood = w.status === "approved";
                  const isBad = w.status === "rejected";
                  return (
                    <div key={w.id} className="rounded-xl border-2 bg-card p-4 space-y-3" style={{
                      borderColor: isGood ? "#bbf7d0" : isBad ? "#fecaca" : "hsl(var(--border))",
                    }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-black text-foreground">₹{Number(w.amount).toLocaleString("en-IN")}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(w.createdAt)}</p>
                        </div>
                        <StatusBadge status={w.status} />
                      </div>
                      <div className="rounded-lg bg-muted px-3 py-2">
                        <p className="text-xs text-muted-foreground font-medium">{w.paymentMethod === "upi" ? "UPI" : "Bank"}: <span className="text-foreground font-semibold">{w.paymentDetails?.split("\n")[0]}</span></p>
                      </div>
                      {isGood && (
                        <div className="flex items-start gap-2 rounded-lg bg-green-50 border border-green-200 p-3">
                          <CheckCircle className="h-4 w-4 text-green-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-green-700">Withdrawal Approved ✅</p>
                            {w.adminUtrNumber && <p className="text-xs text-green-600 mt-0.5">UTR: {w.adminUtrNumber}</p>}
                          </div>
                        </div>
                      )}
                      {isBad && (
                        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
                          <XCircle className="h-4 w-4 text-red-700 shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-black text-red-700">Withdrawal Rejected</p>
                            <p className="text-xs text-red-600 mt-0.5">{w.adminNote ?? "Please contact support for details."}</p>
                          </div>
                        </div>
                      )}
                      {!isGood && !isBad && (
                        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                          <Clock className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700">Under review · Will be processed within 24 hours</p>
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

      {/* Confirm Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-foreground">Confirm Withdrawal</h3>
            <p className="text-sm text-muted-foreground">
              ₹{finalAmount} will be deducted from your wallet immediately and transferred to your{" "}
              {paymentMethod === "upi" ? "UPI ID" : "bank account"} after admin approval.
              <br /><br />Proceed?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting}>
                {submitting ? <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
