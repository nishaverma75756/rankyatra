import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Shield, ArrowLeft, RefreshCw, ArrowUpCircle, Hash, Smartphone, CreditCard } from "lucide-react";
import { Link } from "wouter";

interface Withdrawal {
  id: number;
  amount: string;
  paymentMethod: "upi" | "bank";
  paymentDetails: string;
  status: "pending" | "approved" | "rejected";
  adminUtrNumber: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; email: string; avatarUrl?: string; walletBalance: string } | null;
}

function statusBadge(status: string) {
  if (status === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle className="w-3 h-3" />Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200 gap-1"><XCircle className="w-3 h-3" />Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="w-3 h-3" />Pending</Badge>;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminWithdrawals() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [utrMap, setUtrMap] = useState<Record<number, string>>({});
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const token = getAuthToken();

  const { data: withdrawals = [], isLoading } = useQuery<Withdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/withdrawals"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const updateWithdrawal = useMutation({
    mutationFn: async ({ id, status, adminUtrNumber, adminNote }: { id: number; status: string; adminUtrNumber?: string; adminNote?: string }) => {
      const res = await fetch(getApiUrl(`/api/admin/withdrawals/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, adminUtrNumber, adminNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] }),
    onError: (e: any) => alert(e.message),
  });

  const filtered = filter === "all" ? withdrawals : withdrawals.filter((w) => w.status === filter);
  const counts = {
    all: withdrawals.length,
    pending: withdrawals.filter((w) => w.status === "pending").length,
    approved: withdrawals.filter((w) => w.status === "approved").length,
    rejected: withdrawals.filter((w) => w.status === "rejected").length,
  };
  const totalPending = withdrawals.filter((w) => w.status === "pending").reduce((s, w) => s + Number(w.amount), 0);
  const totalApproved = withdrawals.filter((w) => w.status === "approved").reduce((s, w) => s + Number(w.amount), 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <ArrowUpCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black">Withdrawal Requests</h1>
            <p className="text-muted-foreground text-sm">Review and process user withdrawals</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => qc.invalidateQueries({ queryKey: ["admin-withdrawals"] })}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <ArrowUpCircle className="w-10 h-10 opacity-30" />
                <p className="font-medium">No {filter !== "all" ? filter : ""} withdrawal requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((w) => (
                  <Card key={w.id} className={`border-2 ${w.status === "pending" ? "border-amber-200 bg-amber-50/20" : w.status === "approved" ? "border-green-200 bg-green-50/20" : "border-red-200 bg-red-50/20"}`}>
                    <CardContent className="p-4 space-y-3">
                      {/* User + Amount row */}
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          {w.user?.avatarUrl ? (
                            <img src={w.user.avatarUrl} alt={w.user.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary text-xs font-bold">{w.user ? getInitials(w.user.name) : "?"}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold">{w.user?.name ?? "Unknown"}</span>
                            <span className="text-muted-foreground text-xs">{w.user?.email}</span>
                            {statusBadge(w.status)}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-2xl font-black text-primary">₹{Number(w.amount).toLocaleString("en-IN")}</span>
                            <span className="text-xs text-muted-foreground">Current balance: ₹{Number(w.user?.walletBalance ?? 0).toLocaleString("en-IN")}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {new Date(w.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      {/* Payment details */}
                      <div className="flex items-start gap-2 bg-muted/60 rounded-lg p-3">
                        {w.paymentMethod === "upi" ? <Smartphone className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" /> : <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />}
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase mb-0.5">{w.paymentMethod === "upi" ? "UPI ID" : "Bank Details"}</p>
                          <p className="text-sm font-mono whitespace-pre-line">{w.paymentDetails}</p>
                        </div>
                      </div>

                      {/* Already approved — show UTR */}
                      {w.status === "approved" && w.adminUtrNumber && (
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-green-700">Paid · UTR: <span className="font-mono">{w.adminUtrNumber}</span></p>
                            {w.adminNote && <p className="text-xs text-green-600">{w.adminNote}</p>}
                          </div>
                        </div>
                      )}

                      {w.status === "rejected" && (
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                          <p className="text-xs text-red-700">{w.adminNote ? `Rejected: ${w.adminNote}` : "Rejected — amount refunded to user"}</p>
                        </div>
                      )}

                      {/* Admin action for pending */}
                      {w.status === "pending" && (
                        <div className="space-y-2 pt-1 border-t">
                          <div className="flex items-center gap-2">
                            <Hash className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <Input
                              placeholder="Enter UTR / Transaction reference (required for approve)"
                              className="text-sm h-9"
                              value={utrMap[w.id] ?? ""}
                              onChange={(e) => setUtrMap((p) => ({ ...p, [w.id]: e.target.value }))}
                            />
                          </div>
                          <Textarea
                            placeholder="Admin note (optional)"
                            className="text-sm min-h-[60px] resize-none"
                            value={noteMap[w.id] ?? ""}
                            onChange={(e) => setNoteMap((p) => ({ ...p, [w.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
                              size="sm"
                              onClick={() => updateWithdrawal.mutate({ id: w.id, status: "approved", adminUtrNumber: utrMap[w.id], adminNote: noteMap[w.id] })}
                              disabled={updateWithdrawal.isPending || !utrMap[w.id]?.trim()}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve & Mark Paid
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              className="flex-1 gap-1"
                              onClick={() => updateWithdrawal.mutate({ id: w.id, status: "rejected", adminNote: noteMap[w.id] })}
                              disabled={updateWithdrawal.isPending}
                            >
                              <XCircle className="w-4 h-4" />
                              Reject & Refund
                            </Button>
                          </div>
                          {!utrMap[w.id]?.trim() && (
                            <p className="text-xs text-amber-600">⚠ Enter UTR number before approving</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Stats */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Pending</span>
                  <div className="text-right">
                    <p className="font-bold text-amber-600">{counts.pending}</p>
                    <p className="text-xs text-muted-foreground">₹{totalPending.toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{counts.approved}</p>
                    <p className="text-xs text-muted-foreground">₹{totalApproved.toLocaleString("en-IN")}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center py-1.5">
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" /> Rejected</span>
                  <p className="font-bold text-red-600">{counts.rejected}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50/50 border-amber-200">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">How it works</p>
                <ul className="text-xs text-amber-800 space-y-1.5 mt-2">
                  <li>• User submits request — wallet deducted immediately</li>
                  <li>• Enter the UTR after you send the money</li>
                  <li>• Click "Approve" — user sees UTR on their end</li>
                  <li>• "Reject" refunds the amount back to wallet</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
