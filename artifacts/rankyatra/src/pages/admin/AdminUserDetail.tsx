import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Save, Wallet, Shield, ShieldOff, UserX, UserCheck, KeyRound, BadgeCheck, TrendingUp, CreditCard, CheckCircle, XCircle, Clock, AlertCircle, Phone, Eye, EyeOff, GraduationCap, Star, Megaphone, Handshake, Crown, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminGetUser, useAdminUpdateUser, useAdminBlockUser, useAdminAdjustWallet } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatUID } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  teacher:    { label: "Teacher",    icon: GraduationCap, color: "#2563eb", bg: "#eff6ff" },
  influencer: { label: "Influencer", icon: Star,          color: "#7c3aed", bg: "#f5f3ff" },
  promoter:   { label: "Promoter",   icon: Megaphone,     color: "#d97706", bg: "#fffbeb" },
  partner:    { label: "Partner",    icon: Handshake,     color: "#059669", bg: "#ecfdf5" },
  premium:    { label: "Premium",    icon: Crown,         color: "#f97316", bg: "#fff7ed" },
};

export default function AdminUserDetail() {
  const { id } = useParams();
  const userId = parseInt(id ?? "0");
  const { toast } = useToast();

  const { data: user, refetch, isLoading } = useAdminGetUser(userId);
  const u = user as any;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showIdCard, setShowIdCard] = useState(false);
  const [walletAmount, setWalletAmount] = useState("");
  const [walletType, setWalletType] = useState<"credit" | "debit">("credit");
  const [walletNote, setWalletNote] = useState("");
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);

  const fetchRoles = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("rankyatra_token")}` },
      });
      const data = await res.json();
      setUserRoles(data.map((r: any) => r.role));
    } catch {}
  };

  useEffect(() => {
    if (u) {
      setName(u.name ?? "");
      setEmail(u.email ?? "");
    }
  }, [u?.id]);

  useEffect(() => { fetchRoles(); }, [userId]);

  const handleAssignRole = async (role: string) => {
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("rankyatra_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: `${ROLE_META[role]?.label} role assigned!` });
      fetchRoles();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setRolesLoading(false); }
  };

  const handleRevokeRole = async (role: string) => {
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles/${role}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("rankyatra_token")}` },
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: `${ROLE_META[role]?.label} role revoked.` });
      fetchRoles();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setRolesLoading(false); }
  };

  const { mutate: updateUser, isPending: updating } = useAdminUpdateUser({
    mutation: {
      onSuccess: () => { toast({ title: "Profile updated!" }); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Update failed", variant: "destructive" }),
    },
  });

  const { mutate: blockUser, isPending: blocking } = useAdminBlockUser({
    mutation: {
      onSuccess: () => { toast({ title: u?.isBlocked ? "User unblocked." : "User blocked." }); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });

  const { mutate: adjustWallet, isPending: adjusting } = useAdminAdjustWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: "Wallet updated!", description: `${walletType === "credit" ? "Added" : "Deducted"} ₹${walletAmount}` });
        setWalletAmount("");
        setWalletNote("");
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });

  const handleSaveProfile = () => {
    const data: any = {};
    if (name && name !== u?.name) data.name = name;
    if (email && email !== u?.email) data.email = email;
    if (password) data.password = password;
    if (Object.keys(data).length === 0) {
      toast({ title: "No changes", description: "Make a change first.", variant: "destructive" });
      return;
    }
    updateUser({ userId, data });
  };

  const handleToggleAdmin = () => {
    updateUser({ userId, data: { isAdmin: !u?.isAdmin } });
  };

  const handleWalletAdjust = () => {
    if (!walletAmount || Number(walletAmount) <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive amount.", variant: "destructive" });
      return;
    }
    adjustWallet({
      userId,
      data: {
        amount: String(Number(walletAmount)),
        type: walletType,
        description: walletNote || `Admin ${walletType}`,
      },
    });
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}
      </div>
    </div>
  );

  const initials = (u?.name ?? "U").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> All Users</Link>
          </Button>
          <h1 className="text-2xl font-black">User Profile</h1>
        </div>

        {/* Overview card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 border-2 border-border shrink-0">
                <AvatarImage src={u?.avatarUrl ?? undefined} />
                <AvatarFallback className="font-black text-xl bg-secondary text-secondary-foreground">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-xl font-black">{u?.name}</h2>
                  {u?.isAdmin && <Badge className="bg-primary text-primary-foreground text-xs">Admin</Badge>}
                  {u?.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{u?.email}</p>
                {u?.id && (
                  <p className="text-xs font-mono font-bold text-primary/70 mt-0.5 tracking-widest">UID-{formatUID(u.id)}</p>
                )}
                <p className="text-sm text-muted-foreground mt-0.5">Joined {u?.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="bg-primary/5 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-primary">{formatCurrency(u?.walletBalance ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Wallet</p>
              </div>
              <div className="bg-muted rounded-lg p-3 text-center">
                <p className="text-lg font-black">{u?.totalExamsTaken ?? 0}</p>
                <p className="text-xs text-muted-foreground">Exams Taken</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-lg font-black text-green-600">{formatCurrency(u?.totalWinnings ?? 0)}</p>
                <p className="text-xs text-muted-foreground">Total Won</p>
              </div>
            </div>

            <div className="flex gap-2 mt-4 flex-wrap">
              {!u?.isAdmin && (
                <Button
                  size="sm"
                  variant={u?.isBlocked ? "outline" : "destructive"}
                  disabled={blocking}
                  onClick={() => blockUser({ userId, data: { isBlocked: !u?.isBlocked } })}
                >
                  {u?.isBlocked ? <><UserCheck className="h-3.5 w-3.5 mr-1" />Unblock</> : <><UserX className="h-3.5 w-3.5 mr-1" />Block User</>}
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={updating}
                onClick={handleToggleAdmin}
              >
                {u?.isAdmin ? <><ShieldOff className="h-3.5 w-3.5 mr-1" />Revoke Admin</> : <><Shield className="h-3.5 w-3.5 mr-1" />Grant Admin</>}
              </Button>
            </div>

            {/* ── Role Management ── */}
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Assign Roles</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ROLE_META).map(([role, meta]) => {
                  const hasRole = userRoles.includes(role);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={role}
                      disabled={rolesLoading}
                      onClick={() => hasRole ? handleRevokeRole(role) : handleAssignRole(role)}
                      style={{ background: hasRole ? meta.bg : undefined, borderColor: hasRole ? meta.color : undefined, color: hasRole ? meta.color : undefined }}
                      className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${hasRole ? "border-2" : "border border-border text-muted-foreground bg-muted hover:bg-secondary"}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                      {hasRole && <X className="h-3 w-3 opacity-60" />}
                    </button>
                  );
                })}
              </div>
              {userRoles.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2">Click a role to revoke it. Group dashboard auto-created.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KYC / ID Verification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" /> KYC & Identity Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status + Govt ID row */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Phone:</span>
                <span className="text-sm font-semibold">{u?.phone ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Govt ID:</span>
                <span className="text-sm font-semibold font-mono">{u?.govtId ?? "Not submitted"}</span>
              </div>
              {/* Verification Status Badge */}
              {u?.verificationStatus === "verified" ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1.5 px-3 py-1">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Verified
                </Badge>
              ) : u?.verificationStatus === "under_review" ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1.5 px-3 py-1">
                  <Clock className="h-3.5 w-3.5" />
                  Under Review
                </Badge>
              ) : u?.verificationStatus === "rejected" ? (
                <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1.5 px-3 py-1">
                  <XCircle className="h-3.5 w-3.5" />
                  Rejected
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1.5 px-3 py-1">
                  <AlertCircle className="h-3.5 w-3.5" />
                  Not Verified
                </Badge>
              )}
            </div>

            {/* KYC note if any */}
            {u?.kycNote && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <strong>Admin Note:</strong> {u.kycNote}
              </p>
            )}

            {/* ID Card Image */}
            {u?.panCardUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground">Submitted ID Card</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowIdCard(!showIdCard)}
                    className="h-7 text-xs gap-1.5"
                  >
                    {showIdCard ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> View ID Card</>}
                  </Button>
                </div>
                {showIdCard && (
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                    <img
                      src={u.panCardUrl}
                      alt="Submitted ID Card"
                      className="w-full max-h-72 object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/30 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4" />
                No ID card submitted yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BadgeCheck className="h-4 w-4 text-primary" /> Edit Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><KeyRound className="h-3.5 w-3.5" /> New Password <span className="text-muted-foreground font-normal">(leave blank to keep current)</span></Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button size="sm" onClick={handleSaveProfile} disabled={updating}>
              <Save className="h-4 w-4 mr-1" />
              {updating ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>

        {/* Wallet Adjustment */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wallet className="h-4 w-4 text-primary" /> Wallet Adjustment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm">Current balance: <strong>{formatCurrency(u?.walletBalance ?? 0)}</strong></span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={walletType} onValueChange={(v) => setWalletType(v as "credit" | "debit")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">
                      <span className="text-green-600 font-semibold">Credit (Add ₹)</span>
                    </SelectItem>
                    <SelectItem value="debit">
                      <span className="text-red-600 font-semibold">Debit (Deduct ₹)</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 500"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reason / Note</Label>
                <Input
                  placeholder="e.g. Bonus, Refund..."
                  value={walletNote}
                  onChange={(e) => setWalletNote(e.target.value)}
                />
              </div>
            </div>
            <Button
              onClick={handleWalletAdjust}
              disabled={!walletAmount || adjusting}
              className={walletType === "credit" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {adjusting ? "Updating..." : walletType === "credit" ? `Credit ₹${walletAmount || "0"}` : `Debit ₹${walletAmount || "0"}`}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
