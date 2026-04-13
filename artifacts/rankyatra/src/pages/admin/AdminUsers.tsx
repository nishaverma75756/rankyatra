import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, UserX, UserCheck, Wallet, Eye, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Trash2, Crown, Shield, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminListUsers, useAdminBlockUser, useAdminAdjustWallet, useAdminDeleteUser } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatUID } from "@/lib/utils";

export default function AdminUsers() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [walletUser, setWalletUser] = useState<any>(null);
  const [walletMode, setWalletMode] = useState<"credit" | "debit">("debit");
  const [walletAmount, setWalletAmount] = useState("");
  const [walletReason, setWalletReason] = useState("");
  const [walletCustomReason, setWalletCustomReason] = useState("");
  const [walletConfirm, setWalletConfirm] = useState(false);

  const DEBIT_REASONS = [
    "Scam / Fraudulent Activity",
    "Account Hacked — Security Reversal",
    "Chargeback / Payment Reversal",
    "Terms of Service Violation",
    "Duplicate Payment Refund",
    "Admin Correction",
    "Other (specify below)",
  ];

  const openWallet = (u: any, mode: "credit" | "debit") => {
    setWalletUser(u);
    setWalletMode(mode);
    setWalletAmount("");
    setWalletReason("");
    setWalletCustomReason("");
    setWalletConfirm(false);
  };
  const [deleteUser, setDeleteUser] = useState<any>(null);

  const { data, isLoading, refetch } = useAdminListUsers();
  const allUsers: any[] = Array.isArray(data) ? data : (data as any)?.users ?? [];
  const users: any[] = search
    ? allUsers.filter((u: any) => {
        const s = search.toLowerCase().trim();
        const displayId = u.customUid ?? u.id;
        const uid = `uid-${formatUID(displayId)}`.toLowerCase();
        const paddedNum = String(displayId).padStart(10, "0");
        const plainNum = String(u.id);
        return (
          u.name?.toLowerCase().includes(s) ||
          u.email?.toLowerCase().includes(s) ||
          uid.includes(s) ||
          paddedNum.includes(s) ||
          plainNum === s
        );
      })
    : allUsers;
  const total: number = users.length;
  const totalPages = Math.ceil(total / 20);

  const { mutate: blockUser } = useAdminBlockUser({
    mutation: {
      onSuccess: (_, vars) => {
        toast({ title: "Done", description: `User status updated.` });
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });

  const { mutate: deleteUserMutate, isPending: deleting } = useAdminDeleteUser({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "User Deleted", description: data?.message ?? "User has been permanently deleted." });
        setDeleteUser(null);
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Could not delete user.", variant: "destructive" }),
    },
  });

  const { mutate: adjustWallet, isPending: adjusting } = useAdminAdjustWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: walletMode === "debit" ? "💸 Amount Debited" : "✅ Amount Credited", description: `₹${walletAmount} ${walletMode === "debit" ? "debited from" : "credited to"} ${walletUser?.name}'s wallet.` });
        setWalletUser(null);
        setWalletAmount("");
        setWalletReason("");
        setWalletCustomReason("");
        setWalletConfirm(false);
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Admin</Link>
          </Button>
          <h1 className="text-2xl font-black text-foreground">User Management</h1>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email or UID (e.g. UID-RY000001)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground font-normal">
              {total} users found
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
                    <Avatar className="h-10 w-10 border border-border shrink-0">
                      <AvatarImage src={u.avatarUrl ?? undefined} />
                      <AvatarFallback className="text-sm font-bold">{(u.name?.[0] ?? "U").toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{u.name}</p>
                        {u.isSuperAdmin && (
                          <Badge className="text-xs bg-amber-500 text-white flex items-center gap-1 py-0">
                            <Crown className="h-3 w-3" /> Super Admin
                          </Badge>
                        )}
                        {u.isAdmin && !u.isSuperAdmin && (
                          <Badge className="text-xs bg-primary/10 text-primary flex items-center gap-1 py-0">
                            <Shield className="h-3 w-3" /> Admin
                          </Badge>
                        )}
                        {u.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                        {u.verificationStatus === "verified" ? (
                          <Badge className="text-xs bg-green-100 text-green-700 border border-green-200 flex items-center gap-1 py-0">
                            <CheckCircle className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-gray-100 text-gray-500 border border-gray-200 flex items-center gap-1 py-0">
                            <AlertCircle className="h-3 w-3" /> Not Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <p className="text-xs font-mono text-muted-foreground/60 font-semibold">UID-{formatUID(u.customUid ?? u.id)}</p>
                    </div>
                    <div className="hidden sm:block text-right mr-2">
                      <p className="font-bold text-sm text-primary">{formatCurrency(u.walletBalance)}</p>
                      <p className="text-xs text-muted-foreground">wallet</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="View user"
                        onClick={() => setLocation(`/admin/users/${u.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        title="Credit wallet"
                        onClick={() => openWallet(u, "credit")}
                      >
                        <TrendingUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Debit wallet (scam/hack/penalty)"
                        onClick={() => openWallet(u, "debit")}
                      >
                        <TrendingDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${u.isBlocked ? "text-green-600 hover:text-green-700" : "text-amber-600 hover:text-amber-700"}`}
                        title={u.isBlocked ? "Unblock user" : "Block user"}
                        disabled={u.isAdmin}
                        onClick={() => blockUser({ userId: u.id, data: { isBlocked: !u.isBlocked } })}
                      >
                        {u.isBlocked ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete user permanently"
                        disabled={u.isAdmin}
                        onClick={() => setDeleteUser(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete user confirmation dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Delete User Permanently
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to <strong>permanently delete</strong>{" "}
              <strong>{deleteUser?.name}</strong> ({deleteUser?.email})?
              <br /><br />
              <span className="text-destructive font-semibold">
                This will delete ALL their data — chats, posts, reels, exam history, wallet, and everything else. This action CANNOT be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => deleteUserMutate({ userId: deleteUser?.id })}
            >
              {deleting ? "Deleting..." : "Yes, Delete Permanently"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet Credit / Debit dialog */}
      <Dialog open={!!walletUser} onOpenChange={(o) => { if (!o) { setWalletUser(null); setWalletConfirm(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${walletMode === "debit" ? "text-red-600" : "text-green-600"}`}>
              {walletMode === "debit"
                ? <><TrendingDown className="h-5 w-5" /> Debit Wallet — {walletUser?.name}</>
                : <><TrendingUp className="h-5 w-5" /> Credit Wallet — {walletUser?.name}</>
              }
            </DialogTitle>
            <DialogDescription asChild>
              <div className={`rounded-lg p-3 mt-1 text-sm font-medium ${walletMode === "debit" ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>
                Current balance: <strong>{formatCurrency(walletUser?.walletBalance ?? 0)}</strong>
              </div>
            </DialogDescription>
          </DialogHeader>

          {!walletConfirm ? (
            <div className="space-y-4">
              {/* Amount */}
              <div>
                <label className="text-sm font-semibold text-foreground mb-1 block">
                  Amount (₹) <span className="text-destructive">*</span>
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Enter amount"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className={walletMode === "debit" ? "border-red-200 focus-visible:ring-red-400" : "border-green-200 focus-visible:ring-green-400"}
                />
              </div>

              {/* Reason — dropdown for debit, text for credit */}
              {walletMode === "debit" ? (
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 block">
                    Reason <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="w-full rounded-md border border-red-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                    value={walletReason}
                    onChange={(e) => setWalletReason(e.target.value)}
                  >
                    <option value="">— Select a reason —</option>
                    {DEBIT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {walletReason === "Other (specify below)" && (
                    <Input
                      className="mt-2 border-red-200 focus-visible:ring-red-400"
                      placeholder="Describe the reason..."
                      value={walletCustomReason}
                      onChange={(e) => setWalletCustomReason(e.target.value)}
                    />
                  )}
                </div>
              ) : (
                <div>
                  <label className="text-sm font-semibold text-foreground mb-1 block">Note / Reason</label>
                  <Input
                    placeholder="e.g. Bonus, Referral correction, Manual credit..."
                    value={walletReason}
                    onChange={(e) => setWalletReason(e.target.value)}
                    className="border-green-200 focus-visible:ring-green-400"
                  />
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setWalletUser(null)}>Cancel</Button>
                <Button
                  className={walletMode === "debit" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                  disabled={
                    !walletAmount ||
                    Number(walletAmount) <= 0 ||
                    (walletMode === "debit" && !walletReason) ||
                    (walletReason === "Other (specify below)" && !walletCustomReason)
                  }
                  onClick={() => setWalletConfirm(true)}
                >
                  {walletMode === "debit" ? "Review Debit →" : "Review Credit →"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            /* Confirmation step */
            <div className="space-y-4">
              <div className={`rounded-xl border-2 p-4 space-y-2 ${walletMode === "debit" ? "border-red-300 bg-red-50" : "border-green-300 bg-green-50"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className={`h-5 w-5 ${walletMode === "debit" ? "text-red-600" : "text-green-600"}`} />
                  <span className={`font-bold text-sm ${walletMode === "debit" ? "text-red-700" : "text-green-700"}`}>
                    Confirm {walletMode === "debit" ? "Debit" : "Credit"}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">User</span><strong>{walletUser?.name}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Action</span><strong className={walletMode === "debit" ? "text-red-600" : "text-green-600"}>{walletMode === "debit" ? `−₹${walletAmount}` : `+₹${walletAmount}`}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Current Balance</span><strong>{formatCurrency(walletUser?.walletBalance ?? 0)}</strong></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">After {walletMode}</span>
                    <strong className={walletMode === "debit" ? "text-red-600" : "text-green-600"}>
                      {formatCurrency(Math.max(0, parseFloat(walletUser?.walletBalance ?? "0") + (walletMode === "credit" ? 1 : -1) * Number(walletAmount)))}
                    </strong>
                  </div>
                  <div className="flex justify-between items-start gap-2 pt-1 border-t border-current/20">
                    <span className="text-muted-foreground shrink-0">Reason</span>
                    <strong className="text-right text-xs">{walletReason === "Other (specify below)" ? walletCustomReason : walletReason || "Admin adjustment"}</strong>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setWalletConfirm(false)} disabled={adjusting}>← Back</Button>
                <Button
                  className={walletMode === "debit" ? "bg-red-600 hover:bg-red-700 text-white" : "bg-green-600 hover:bg-green-700 text-white"}
                  disabled={adjusting}
                  onClick={() => {
                    const finalReason = walletReason === "Other (specify below)" ? walletCustomReason : (walletReason || "Admin adjustment");
                    adjustWallet({
                      userId: walletUser?.id,
                      data: {
                        amount: String(Number(walletAmount)),
                        type: walletMode,
                        description: `[Admin ${walletMode === "debit" ? "Debit" : "Credit"}] ${finalReason}`,
                      },
                    });
                  }}
                >
                  {adjusting ? "Processing..." : walletMode === "debit" ? "✓ Confirm Debit" : "✓ Confirm Credit"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
