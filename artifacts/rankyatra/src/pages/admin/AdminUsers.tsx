import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Search, UserX, UserCheck, Wallet, Eye, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Trash2, Crown, Shield } from "lucide-react";
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
  const [walletAmount, setWalletAmount] = useState("");
  const [walletNote, setWalletNote] = useState("");
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
        toast({ title: "Wallet updated!" });
        setWalletUser(null);
        setWalletAmount("");
        setWalletNote("");
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
                        className="h-8 w-8 text-blue-600 hover:text-blue-700"
                        title="Adjust wallet"
                        onClick={() => setWalletUser(u)}
                      >
                        <Wallet className="h-4 w-4" />
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

      {/* Wallet adjust dialog */}
      <Dialog open={!!walletUser} onOpenChange={(o) => !o && setWalletUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Wallet — {walletUser?.name}</DialogTitle>
            <DialogDescription>
              Current balance: {formatCurrency(walletUser?.walletBalance ?? 0)}. Enter a positive amount to credit, negative to debit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              placeholder="Amount (e.g. 100 or -50)"
              value={walletAmount}
              onChange={(e) => setWalletAmount(e.target.value)}
            />
            <Input
              placeholder="Note / reason"
              value={walletNote}
              onChange={(e) => setWalletNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWalletUser(null)}>Cancel</Button>
            <Button
              disabled={!walletAmount || adjusting}
              onClick={() => adjustWallet({
                userId: walletUser?.id,
                data: { amount: String(Math.abs(Number(walletAmount))), type: Number(walletAmount) >= 0 ? "credit" as const : "debit" as const, description: walletNote || "Admin adjustment" },
              })}
            >
              {adjusting ? "Updating..." : "Update Wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
