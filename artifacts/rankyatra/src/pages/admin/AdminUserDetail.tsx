import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Save, Wallet, Shield, ShieldOff, UserX, UserCheck, KeyRound, BadgeCheck,
  TrendingUp, CreditCard, CheckCircle, XCircle, Clock, AlertCircle, Phone, Eye, EyeOff,
  GraduationCap, Star, Megaphone, Handshake, Crown, X, Lock, Settings2, Edit2
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAdminGetUser, useAdminUpdateUser, useAdminBlockUser, useAdminAdjustWallet } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatUID } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getAuthToken } from "@/lib/auth";

const ROLE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  teacher:    { label: "Teacher",    icon: GraduationCap, color: "#2563eb", bg: "#eff6ff" },
  influencer: { label: "Influencer", icon: Star,          color: "#7c3aed", bg: "#f5f3ff" },
  promoter:   { label: "Promoter",   icon: Megaphone,     color: "#d97706", bg: "#fffbeb" },
  partner:    { label: "Partner",    icon: Handshake,     color: "#059669", bg: "#ecfdf5" },
  premium:    { label: "Premium",    icon: Crown,         color: "#f97316", bg: "#fff7ed" },
};

const ALL_PERMISSIONS = [
  { key: "users",       label: "Manage Users",        desc: "View users, block/unblock, and manage profiles" },
  { key: "exams",       label: "Manage Exams",         desc: "Create/edit exams and distribute prizes" },
  { key: "deposits",    label: "Deposit Requests",     desc: "Approve or reject deposit requests" },
  { key: "withdrawals", label: "Withdrawal Requests",  desc: "Approve or reject withdrawal requests" },
  { key: "kyc",         label: "KYC Verifications",    desc: "Approve or reject identity verifications" },
  { key: "reports",     label: "User Reports",         desc: "Review user reports and take action" },
  { key: "banners",     label: "Banner Slider",        desc: "Manage promotional banners" },
  { key: "categories",  label: "Exam Categories",      desc: "Manage exam categories" },
  { key: "roles",       label: "Roles & Groups",       desc: "Assign special roles to users" },
];

export default function AdminUserDetail() {
  const { id } = useParams();
  const userId = parseInt(id ?? "0");
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const currentUserAny = currentUser as any;
  const isSuperAdmin = currentUserAny?.isSuperAdmin ?? false;

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

  // Grant admin modal state
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantPerms, setGrantPerms] = useState<string[]>([]);
  const [savingGrant, setSavingGrant] = useState(false);

  // Edit permissions modal (for existing admins)
  const [showEditPermsModal, setShowEditPermsModal] = useState(false);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [savingEditPerms, setSavingEditPerms] = useState(false);

  // Custom UID edit
  const [showUidModal, setShowUidModal] = useState(false);
  const [uidInput, setUidInput] = useState("");
  const [savingUid, setSavingUid] = useState(false);

  // Full data reset
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  // Reel application
  const [reelApp, setReelApp] = useState<any>(null);
  const [reelAppLoading, setReelAppLoading] = useState(false);
  const [reelAppNote, setReelAppNote] = useState("");
  const [reelAccessLoading, setReelAccessLoading] = useState(false);

  const fetchReelApp = async () => {
    if (!userId) return;
    setReelAppLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reel-application`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      const data = await res.json();
      setReelApp(data.application ?? null);
      if (data.application?.adminNote) setReelAppNote(data.application.adminNote);
    } catch {}
    setReelAppLoading(false);
  };

  const handleReelAppStatus = async (status: "approved" | "rejected") => {
    if (!reelApp) return;
    setReelAccessLoading(true);
    try {
      const res = await fetch(`/api/admin/reel-applications/${reelApp.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: reelAppNote }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: status === "approved" ? "Reel access approved!" : "Application rejected." });
      fetchReelApp();
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setReelAccessLoading(false); }
  };

  const handleDirectReelAccess = async (grant: boolean) => {
    setReelAccessLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reel-access`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ canPostReels: grant }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: grant ? "Reel access granted!" : "Reel access revoked." });
      fetchReelApp();
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setReelAccessLoading(false); }
  };

  const fetchRoles = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
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

  useEffect(() => { fetchRoles(); fetchReelApp(); }, [userId]);

  const handleAssignRole = async (role: string) => {
    setRolesLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/roles`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
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
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: `${ROLE_META[role]?.label} role revoked.` });
      fetchRoles();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setRolesLoading(false); }
  };

  // Confirm grant admin with selected permissions
  const handleConfirmGrant = async () => {
    setSavingGrant(true);
    try {
      // First make them admin
      const r1 = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: true }),
      });
      if (!r1.ok) { const e = await r1.json(); throw e; }

      // Then assign permissions
      const r2 = await fetch(`/api/admin/users/${userId}/admin-permissions`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: grantPerms, isAdmin: true }),
      });
      if (!r2.ok) { const e = await r2.json(); throw e; }

      toast({ title: "Admin access granted!", description: grantPerms.length > 0 ? `${grantPerms.length} permissions assigned.` : "No permissions assigned yet." });
      setShowGrantModal(false);
      setGrantPerms([]);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setSavingGrant(false); }
  };

  // Revoke admin
  const handleRevokeAdmin = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin: false }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      // Also clear permissions
      await fetch(`/api/admin/users/${userId}/admin-permissions`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: [], isAdmin: false }),
      });
      toast({ title: "Admin access revoked." });
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    }
  };

  // Save edited permissions for existing admin
  const handleSaveEditPerms = async () => {
    setSavingEditPerms(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/admin-permissions`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: editPerms, isAdmin: true }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: "Permissions updated!", description: `${editPerms.length} permissions saved.` });
      setShowEditPermsModal(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setSavingEditPerms(false); }
  };

  const handleSaveCustomUid = async () => {
    const num = uidInput.trim() === "" ? null : Number(uidInput.trim());
    if (uidInput.trim() !== "" && (isNaN(num as number) || (num as number) < 1)) {
      toast({ title: "Invalid UID", description: "Please enter a positive number", variant: "destructive" });
      return;
    }
    setSavingUid(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/custom-uid`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ customUid: num }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: num ? `Custom UID set to ${num}` : "Custom UID removed" });
      setShowUidModal(false);
      refetch();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed to save UID", variant: "destructive" });
    } finally { setSavingUid(false); }
  };

  const { mutate: updateUser, isPending: updating } = useAdminUpdateUser({
    mutation: {
      onSuccess: () => { toast({ title: "Profile updated!" }); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error ?? "Update failed", variant: "destructive" }),
    },
  });

  const { mutate: blockUser, isPending: blocking } = useAdminBlockUser({
    mutation: {
      onSuccess: () => { toast({ title: u?.isBlocked ? "User unblocked." : "User blocked." }); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error, variant: "destructive" }),
    },
  });

  const { mutate: adjustWallet, isPending: adjusting } = useAdminAdjustWallet({
    mutation: {
      onSuccess: () => {
        toast({ title: "Wallet updated!", description: `${walletType === "credit" ? "Added" : "Deducted"} ₹${walletAmount}` });
        setWalletAmount(""); setWalletNote(""); refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.error, variant: "destructive" }),
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

  const handleWalletAdjust = () => {
    if (!walletAmount || Number(walletAmount) <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    adjustWallet({
      userId,
      data: { amount: String(Number(walletAmount)), type: walletType, description: walletNote || `Admin ${walletType}` },
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
  const isTargetSuperAdmin = u?.isSuperAdmin ?? false;
  const isTargetAdmin = u?.isAdmin ?? false;
  const targetPermissions: string[] = u?.adminPermissions ?? [];

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
                  {isTargetSuperAdmin && (
                    <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                      <Crown className="h-3 w-3" /> Super Admin
                    </Badge>
                  )}
                  {isTargetAdmin && !isTargetSuperAdmin && (
                    <Badge className="bg-primary text-primary-foreground text-xs flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Admin
                    </Badge>
                  )}
                  {u?.isBlocked && <Badge variant="destructive" className="text-xs">Blocked</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{u?.email}</p>
                {u?.id && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-xs font-mono font-bold text-primary/70 tracking-widest">UID-{formatUID(u.customUid ?? u.id)}</p>
                    {isSuperAdmin && (
                      <button
                        onClick={() => { setUidInput(u.customUid ? String(u.customUid) : ""); setShowUidModal(true); }}
                        className="text-muted-foreground/50 hover:text-primary transition-colors"
                        title="Edit custom UID"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-0.5">
                  Joined {u?.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </p>
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

            {/* Action buttons */}
            <div className="flex gap-2 mt-4 flex-wrap">
              {!isTargetAdmin && !isTargetSuperAdmin && (
                <Button
                  size="sm"
                  variant={u?.isBlocked ? "outline" : "destructive"}
                  disabled={blocking}
                  onClick={() => blockUser({ userId, data: { isBlocked: !u?.isBlocked } })}
                >
                  {u?.isBlocked
                    ? <><UserCheck className="h-3.5 w-3.5 mr-1" />Unblock</>
                    : <><UserX className="h-3.5 w-3.5 mr-1" />Block User</>}
                </Button>
              )}

              {/* Super admin only: Grant/Revoke admin */}
              {isSuperAdmin && !isTargetSuperAdmin && (
                <>
                  {!isTargetAdmin ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10"
                      onClick={() => { setGrantPerms([]); setShowGrantModal(true); }}
                    >
                      <Shield className="h-3.5 w-3.5 mr-1" /> Grant Admin Access
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500 text-blue-700 hover:bg-blue-50"
                        onClick={() => { setEditPerms([...targetPermissions]); setShowEditPermsModal(true); }}
                      >
                        <Settings2 className="h-3.5 w-3.5 mr-1" /> Edit Permissions
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10"
                        onClick={handleRevokeAdmin}
                      >
                        <ShieldOff className="h-3.5 w-3.5 mr-1" /> Revoke Admin
                      </Button>
                    </>
                  )}
                </>
              )}

              {!isSuperAdmin && isTargetAdmin && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5">
                  <Lock className="h-3 w-3" /> Admin access managed by Super Admin
                </div>
              )}
            </div>

            {/* Super admin: Danger Zone — Full Data Reset */}
            {isSuperAdmin && !isTargetSuperAdmin && (
              <div className="mt-4 pt-4 border-t border-destructive/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-destructive uppercase tracking-widest">Danger Zone</p>
                    <p className="text-xs text-muted-foreground mt-0.5">All of this user's data will be permanently deleted</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white transition-colors"
                    onClick={() => setShowResetModal(true)}
                  >
                    <X className="h-3.5 w-3.5 mr-1" /> Full Data Reset
                  </Button>
                </div>
              </div>
            )}

            {/* Current permissions display (for existing admins) */}
            {isTargetAdmin && !isTargetSuperAdmin && targetPermissions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Assigned Permissions ({targetPermissions.length}/{ALL_PERMISSIONS.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PERMISSIONS.map(p => (
                    <span
                      key={p.key}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                        targetPermissions.includes(p.key)
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground border-border opacity-40"
                      }`}
                    >
                      {p.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {isTargetAdmin && !isTargetSuperAdmin && targetPermissions.length === 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200 flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No permissions assigned — click "Edit Permissions" to assign sections.
                </p>
              </div>
            )}

            {/* Role Management */}
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
            </div>
          </CardContent>
        </Card>

        {/* Reel Access */}
        {isSuperAdmin && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-purple-600">🎬</span> Reel Posting Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Current status */}
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    u?.canPostReels
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {u?.canPostReels ? "✅ Authorized to Post Reels" : "🔒 Not Authorized"}
                  </span>
                </div>
                <div className="flex gap-2">
                  {u?.canPostReels ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-destructive/50 text-destructive hover:bg-destructive/10 text-xs"
                      onClick={() => handleDirectReelAccess(false)}
                      disabled={reelAccessLoading}
                    >
                      Revoke Access
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-purple-600 hover:bg-purple-700 text-white text-xs"
                      onClick={() => handleDirectReelAccess(true)}
                      disabled={reelAccessLoading}
                    >
                      Grant Access Directly
                    </Button>
                  )}
                </div>
              </div>

              {/* Application */}
              {reelAppLoading ? (
                <p className="text-xs text-muted-foreground">Loading application...</p>
              ) : reelApp ? (
                <div className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Reel Application</p>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      reelApp.status === "approved"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : reelApp.status === "rejected"
                        ? "bg-red-50 text-red-700 border-red-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }`}>
                      {reelApp.status === "approved" ? "✅ Approved" : reelApp.status === "rejected" ? "❌ Rejected" : "⏳ Pending"}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {reelApp.instagramHandle && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-2">
                        <span className="text-muted-foreground">Instagram:</span>
                        <span className="font-semibold">@{reelApp.instagramHandle}</span>
                      </div>
                    )}
                    {reelApp.youtubeChannel && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-2">
                        <span className="text-muted-foreground">YouTube:</span>
                        <span className="font-semibold">{reelApp.youtubeChannel}</span>
                      </div>
                    )}
                    {reelApp.facebookHandle && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-2">
                        <span className="text-muted-foreground">Facebook:</span>
                        <span className="font-semibold">{reelApp.facebookHandle}</span>
                      </div>
                    )}
                    {reelApp.twitterHandle && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-2">
                        <span className="text-muted-foreground">Twitter:</span>
                        <span className="font-semibold">@{reelApp.twitterHandle}</span>
                      </div>
                    )}
                    {reelApp.contentType && (
                      <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2.5 py-2 col-span-2">
                        <span className="text-muted-foreground">Content Type:</span>
                        <span className="font-semibold">{reelApp.contentType}</span>
                      </div>
                    )}
                  </div>

                  {reelApp.reason && (
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Why they want to post reels:</p>
                      <p className="text-sm">{reelApp.reason}</p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    Applied {new Date(reelApp.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  {reelApp.status === "pending" && (
                    <div className="space-y-2 pt-1 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground">Admin note (optional)</p>
                      <input
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background"
                        placeholder="Add a note for the user..."
                        value={reelAppNote}
                        onChange={(e) => setReelAppNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          onClick={() => handleReelAppStatus("approved")}
                          disabled={reelAccessLoading}
                        >
                          ✅ Approve Application
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-destructive/50 text-destructive hover:bg-destructive/10 flex-1"
                          onClick={() => handleReelAppStatus("rejected")}
                          disabled={reelAccessLoading}
                        >
                          ❌ Reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                  This user has not submitted a reel application yet.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* KYC / ID Verification */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4 text-primary" /> KYC & Identity Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              {u?.verificationStatus === "verified" ? (
                <Badge className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1.5 px-3 py-1">
                  <CheckCircle className="h-3.5 w-3.5" /> Verified
                </Badge>
              ) : u?.verificationStatus === "under_review" ? (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200 flex items-center gap-1.5 px-3 py-1">
                  <Clock className="h-3.5 w-3.5" /> Under Review
                </Badge>
              ) : u?.verificationStatus === "rejected" ? (
                <Badge className="bg-red-100 text-red-700 border-red-200 flex items-center gap-1.5 px-3 py-1">
                  <XCircle className="h-3.5 w-3.5" /> Rejected
                </Badge>
              ) : (
                <Badge className="bg-gray-100 text-gray-600 border-gray-200 flex items-center gap-1.5 px-3 py-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Not Verified
                </Badge>
              )}
            </div>
            {u?.kycNote && (
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <strong>Admin Note:</strong> {u.kycNote}
              </p>
            )}
            {u?.panCardUrl ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted-foreground">Submitted ID Card</p>
                  <Button variant="ghost" size="sm" onClick={() => setShowIdCard(!showIdCard)} className="h-7 text-xs gap-1.5">
                    {showIdCard ? <><EyeOff className="h-3.5 w-3.5" /> Hide</> : <><Eye className="h-3.5 w-3.5" /> View ID Card</>}
                  </Button>
                </div>
                {showIdCard && (
                  <div className="rounded-xl overflow-hidden border border-border bg-muted/30">
                    <img src={u.panCardUrl} alt="Submitted ID Card" className="w-full max-h-72 object-contain" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground text-sm bg-muted/30 rounded-lg px-4 py-3">
                <AlertCircle className="h-4 w-4" /> No ID card submitted yet
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
              <Label className="flex items-center gap-1">
                <KeyRound className="h-3.5 w-3.5" /> New Password
                <span className="text-muted-foreground font-normal">(leave blank to keep current)</span>
              </Label>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit"><span className="text-green-600 font-semibold">Credit (Add ₹)</span></SelectItem>
                    <SelectItem value="debit"><span className="text-red-600 font-semibold">Debit (Deduct ₹)</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Amount (₹)</Label>
                <Input type="number" min="1" placeholder="e.g. 500" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Reason / Note</Label>
                <Input placeholder="e.g. Bonus, Refund..." value={walletNote} onChange={(e) => setWalletNote(e.target.value)} />
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

      {/* ── Grant Admin Modal ── */}
      <Dialog open={showGrantModal} onOpenChange={(o) => { if (!o) { setShowGrantModal(false); setGrantPerms([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Shield className="h-5 w-5" /> Grant Admin Access
            </DialogTitle>
            <DialogDescription>
              Select which sections <strong>{u?.name}</strong> will have access to as an admin:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {/* Select All */}
            <label className="flex items-center gap-3 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors mb-1">
              <Checkbox
                checked={grantPerms.length === ALL_PERMISSIONS.length}
                onCheckedChange={(checked) => {
                  setGrantPerms(checked ? ALL_PERMISSIONS.map(p => p.key) : []);
                }}
              />
              <div>
                <p className="text-sm font-bold text-primary">All Permissions (Full Access)</p>
                <p className="text-xs text-muted-foreground">Grant access to all sections</p>
              </div>
            </label>

            {ALL_PERMISSIONS.map((perm) => (
              <label key={perm.key} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={grantPerms.includes(perm.key)}
                  onCheckedChange={(checked) => {
                    setGrantPerms(prev =>
                      checked ? [...prev, perm.key] : prev.filter(p => p !== perm.key)
                    );
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{perm.label}</p>
                  <p className="text-xs text-muted-foreground">{perm.desc}</p>
                </div>
              </label>
            ))}
          </div>

          {grantPerms.length === 0 && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No permissions selected — this admin will have no section access.
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGrantModal(false)} disabled={savingGrant}>Cancel</Button>
            <Button onClick={handleConfirmGrant} disabled={savingGrant} className="bg-primary">
              <Shield className="h-4 w-4 mr-1.5" />
              {savingGrant ? "Granting..." : `Grant Admin${grantPerms.length > 0 ? ` (${grantPerms.length} permissions)` : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Permissions Modal ── */}
      <Dialog open={showEditPermsModal} onOpenChange={(o) => { if (!o) setShowEditPermsModal(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" /> Edit Admin Permissions
            </DialogTitle>
            <DialogDescription>
              Update permissions for <strong>{u?.name}</strong>:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            <label className="flex items-center gap-3 p-2.5 rounded-lg border-2 border-primary/30 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors mb-1">
              <Checkbox
                checked={editPerms.length === ALL_PERMISSIONS.length}
                onCheckedChange={(checked) => {
                  setEditPerms(checked ? ALL_PERMISSIONS.map(p => p.key) : []);
                }}
              />
              <div>
                <p className="text-sm font-bold text-primary">All Permissions (Full Access)</p>
                <p className="text-xs text-muted-foreground">Grant access to all sections</p>
              </div>
            </label>

            {ALL_PERMISSIONS.map((perm) => (
              <label key={perm.key} className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/40 cursor-pointer transition-colors">
                <Checkbox
                  checked={editPerms.includes(perm.key)}
                  onCheckedChange={(checked) => {
                    setEditPerms(prev =>
                      checked ? [...prev, perm.key] : prev.filter(p => p !== perm.key)
                    );
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{perm.label}</p>
                  <p className="text-xs text-muted-foreground">{perm.desc}</p>
                </div>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditPermsModal(false)} disabled={savingEditPerms}>Cancel</Button>
            <Button onClick={handleSaveEditPerms} disabled={savingEditPerms}>
              {savingEditPerms ? "Saving..." : `Save (${editPerms.length} permissions)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom UID Edit Modal — super admin only */}
      <Dialog open={showUidModal} onOpenChange={(o) => { if (!o) setShowUidModal(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Set Custom UID
            </DialogTitle>
            <DialogDescription>
              Assign a unique custom UID to <strong>{u?.name}</strong>. Leave blank to use the default ID.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Custom UID Number</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 1, 42, 100"
                value={uidInput}
                onChange={(e) => setUidInput(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground mt-1">Will display as: <span className="font-mono font-bold text-primary">UID-RY{uidInput ? String(Number(uidInput)).padStart(10, "0") : "—"}</span></p>
            </div>
            {u?.customUid && (
              <p className="text-xs text-amber-600 font-medium">Current custom UID: {u.customUid} → Leave blank to remove it</p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowUidModal(false)} disabled={savingUid}>Cancel</Button>
            {u?.customUid && (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={savingUid}
                onClick={async () => {
                  setSavingUid(true);
                  try {
                    const res = await fetch(`/api/admin/users/${userId}/custom-uid`, {
                      method: "PATCH",
                      headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
                      body: JSON.stringify({ customUid: null }),
                    });
                    if (!res.ok) { const e = await res.json(); throw e; }
                    toast({ title: "Custom UID removed" });
                    setShowUidModal(false);
                    refetch();
                  } catch (e: any) {
                    toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
                  } finally { setSavingUid(false); }
                }}
              >
                Remove UID
              </Button>
            )}
            <Button onClick={handleSaveCustomUid} disabled={savingUid}>
              {savingUid ? "Saving..." : "Save UID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Full Data Reset Modal */}
      <Dialog open={showResetModal} onOpenChange={(o) => { if (!o) { setShowResetModal(false); setResetConfirmText(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" /> Full Data Reset
            </DialogTitle>
            <DialogDescription>
              <strong>All data for {u?.name}</strong> will be <strong>permanently deleted</strong>:<br />
              Posts, reels, exam history, wallet balance, follows, KYC, roles — everything.
              <br /><br />
              The account (name, email, password) and custom UID will remain intact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-xs text-destructive font-medium">
              This action cannot be undone. Type <strong>RESET</strong> below to confirm.
            </div>
            <Input
              placeholder='Type "RESET" to confirm'
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              className="font-mono border-destructive/40 focus-visible:ring-destructive/30"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetModal(false); setResetConfirmText(""); }} disabled={resetting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={resetConfirmText !== "RESET" || resetting}
              onClick={async () => {
                setResetting(true);
                try {
                  const res = await fetch(`/api/admin/users/${userId}/reset-data`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
                  });
                  if (!res.ok) { const e = await res.json(); throw e; }
                  toast({ title: "Data reset ho gaya!", description: `${u?.name} ka saara data clean kar diya gaya.` });
                  setShowResetModal(false);
                  setResetConfirmText("");
                  refetch();
                } catch (e: any) {
                  toast({ title: "Error", description: e?.error ?? "Reset failed", variant: "destructive" });
                } finally { setResetting(false); }
              }}
            >
              {resetting ? "Resetting..." : "Permanently Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
