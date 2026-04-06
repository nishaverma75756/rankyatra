import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  User, Mail, Phone, CreditCard, LogOut, ChevronRight,
  BookOpen, CheckCircle, Award, Wallet, Plus, ArrowUp,
  Target, TrendingUp, Star, Zap, BarChart2, Activity,
  AlertCircle, Clock, XCircle, RefreshCw, Camera,
  Instagram, MessageCircle, HelpCircle, FileText,
  Edit2, X, Check, Shield, Users, UserCheck,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { useGetProfile, useUpdateProfile, updateProfile } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, formatUID } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  SSC: "#2563eb", UPSC: "#7c3aed", Banking: "#059669",
  Railways: "#dc2626", Defence: "#d97706",
};

const VERIFY_STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_submitted: { label: "Need Verify", color: "#ef4444", icon: <AlertCircle className="h-3.5 w-3.5" /> },
  under_review:  { label: "Under Review", color: "#f59e0b", icon: <Clock className="h-3.5 w-3.5" /> },
  verified:      { label: "Verified",      color: "#059669", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  rejected:      { label: "Rejected",      color: "#dc2626", icon: <XCircle className="h-3.5 w-3.5" /> },
};

function useMyStats() {
  return useQuery({
    queryKey: ["/api/me/stats"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch("/api/me/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: !!getAuthToken(),
    staleTime: 30000,
  });
}

function useFollowCounts(userId: number | undefined) {
  return useQuery({
    queryKey: ["/api/users", userId, "public-profile"],
    queryFn: async () => {
      const token = getAuthToken();
      const res = await fetch(`/api/users/${userId}/public-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      const d = await res.json();
      return { followersCount: d.followersCount ?? 0, followingCount: d.followingCount ?? 0 };
    },
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 mb-3 mt-6">
      <span className="text-muted-foreground">{icon}</span>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</h3>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex-1 rounded-xl border border-border bg-card p-4 flex flex-col items-center gap-1">
      <div className="rounded-lg p-2" style={{ backgroundColor: color + "18" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function MenuCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {children}
    </div>
  );
}

function MenuItem({
  icon, iconBg, iconColor, label, value, badge, onClick, href, danger,
}: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string;
  value?: string; badge?: React.ReactNode; onClick?: () => void; href?: string;
  danger?: boolean;
}) {
  const inner = (
    <div className={`flex items-center gap-3 px-4 py-3.5 cursor-pointer transition-colors ${danger ? "hover:bg-destructive/5" : "hover:bg-muted/40"}`}>
      <div className="rounded-lg p-1.5 shrink-0" style={{ backgroundColor: iconBg }}>
        <span style={{ color: iconColor }}>{icon}</span>
      </div>
      <span className={`flex-1 text-sm font-semibold ${danger ? "text-destructive" : "text-foreground"}`}>{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {badge}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  if (onClick) return <div onClick={onClick}>{inner}</div>;
  return inner;
}

export default function Profile() {
  const { user: authUser, logout } = useAuth();
  const { data: profile, refetch } = useGetProfile({ query: { refetchInterval: 15000 } });
  const { data: stats, isLoading: statsLoading } = useMyStats();
  const u0 = (profile ?? authUser) as any;
  const { data: followCounts } = useFollowCounts(u0?.id);

  useEffect(() => { refetch(); }, []);

  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const u = (profile ?? authUser) as any;

  const initials = (u?.name ?? "U")
    .split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const skillColor =
    stats?.skillLevel === "Champion" ? "#f59e0b" :
    stats?.skillLevel === "Advanced"  ? "#ef4444" :
    stats?.skillLevel === "Warrior"   ? "#8b5cf6" :
    stats?.skillLevel === "Explorer"  ? "#0891b2" : "#94a3b8";

  const isKycVerified = (u as any)?.verificationStatus === "verified" || (authUser as any)?.verificationStatus === "verified";

  const rankPoints: number = (stats as any)?.rankPoints ?? stats?.totalCorrect ?? 0;
  const toNextTier = rankPoints <= 100 ? 101 - rankPoints
    : rankPoints <= 200 ? 201 - rankPoints
    : rankPoints <= 400 ? 401 - rankPoints
    : rankPoints <= 700 ? 701 - rankPoints : 0;

  const formatTime = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const handlePickAvatar = () => fileInputRef.current?.click();

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const token = getAuthToken();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/users/avatar", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarBase64: base64, mimeType: file.type }),
      });
      if (res.ok) {
        refetch();
      } else {
        toast({ title: "Upload failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const startEdit = () => { setName(u?.name ?? ""); setEditing(true); };
  const cancelEdit = () => { setEditing(false); setName(u?.name ?? ""); };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateProfile({ name: name.trim() });
      refetch();
      setEditing(false);
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    if (confirm("Are you sure you want to sign out?")) {
      logout();
    }
  };

  const effectiveVerifyStatus = (u as any)?.verificationStatus ?? (authUser as any)?.verificationStatus ?? "not_submitted";
  const vs = VERIFY_STATUS[effectiveVerifyStatus] ?? VERIFY_STATUS.not_submitted;

  if (!authUser) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
          <div className="h-20 w-20 rounded-full bg-primary flex items-center justify-center">
            <Award className="h-10 w-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-black text-foreground">RankYatra</h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Sign in to view your profile, track performance, and compete for cash prizes.
          </p>
          <Button className="w-full max-w-xs" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
          <Button variant="outline" className="w-full max-w-xs" asChild>
            <Link href="/signup">Create Account</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Navbar />
      <div className="w-full px-4 py-6 max-w-2xl mx-auto pb-20">

        {/* Hero Card */}
        <div className="rounded-2xl bg-secondary text-white p-5 mb-4 flex items-center gap-4">
          <div className="relative shrink-0">
            <button
              onClick={handlePickAvatar}
              disabled={uploadingAvatar}
              className="relative rounded-full overflow-hidden w-20 h-20 border-2 border-white/30 bg-white/10 hover:opacity-80 transition-opacity"
            >
              {u?.avatarUrl ? (
                <img src={u.avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl font-black text-white">
                  {initials}
                </span>
              )}
              <div className="absolute bottom-0 right-0 bg-black/50 rounded-full p-1">
                {uploadingAvatar
                  ? <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera className="h-3 w-3 text-white" />}
              </div>
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="flex items-center gap-2 mb-1">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-8 text-base font-bold bg-white/10 border-white/30 text-white placeholder:text-white/50"
                  autoFocus
                />
                {saving
                  ? <div className="h-4 w-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                  : <>
                      <button onClick={handleSave}><Check className="h-5 w-5 text-green-400" /></button>
                      <button onClick={cancelEdit}><X className="h-5 w-5 text-white/50" /></button>
                    </>}
              </div>
            ) : (
              <button
                onClick={startEdit}
                className="flex items-center gap-2 mb-1 hover:opacity-80 transition-opacity"
              >
                <span className="text-xl font-black text-white">{u?.name}</span>
                <Edit2 className="h-3.5 w-3.5 text-white/50" />
              </button>
            )}
            <p className="text-sm text-white/70">{u?.email}</p>
            {u?.id && (
              <p className="text-xs font-mono font-bold text-white/50 mt-0.5 tracking-widest">UID-{formatUID(u.id)}</p>
            )}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {u?.isAdmin && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">👑 Admin</span>
              )}
              {isKycVerified && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "#059669", color: "#fff" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  KYC Verified
                </span>
              )}
              {stats && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: skillColor, color: "#fff" }}>
                  {stats.skillIcon} {stats.skillLevel}
                </span>
              )}
            </div>
            {stats && (
              <div className="flex items-center gap-1.5 mt-1 text-white/60">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                <span className="text-[11px] font-semibold text-white/80">{rankPoints} pts</span>
                {toNextTier > 0
                  ? <span className="text-[10px]">· {toNextTier} pts to next tier</span>
                  : <span className="text-[10px] text-amber-400">· Max Tier 🏆</span>
                }
              </div>
            )}
          </div>
        </div>

        {/* Followers / Following Strip */}
        {u?.id && (
          <div className="flex gap-3 mb-4">
            <Link
              href={`/user/${u.id}/followers`}
              className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-3 flex items-center gap-2 hover:bg-muted/40 transition-colors cursor-pointer overflow-hidden"
            >
              <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: "#8b5cf618" }}>
                <Users className="h-4 w-4" style={{ color: "#8b5cf6" }} />
              </div>
              <p className="text-lg font-black shrink-0" style={{ color: "#8b5cf6" }}>
                {followCounts?.followersCount ?? 0}
              </p>
              <p className="text-sm text-muted-foreground font-medium truncate">Followers</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            </Link>
            <Link
              href={`/user/${u.id}/following`}
              className="flex-1 min-w-0 rounded-xl border border-border bg-card px-3 py-3 flex items-center gap-2 hover:bg-muted/40 transition-colors cursor-pointer overflow-hidden"
            >
              <div className="rounded-lg p-2 shrink-0" style={{ backgroundColor: "#0891b218" }}>
                <UserCheck className="h-4 w-4" style={{ color: "#0891b2" }} />
              </div>
              <p className="text-lg font-black shrink-0" style={{ color: "#0891b2" }}>
                {followCounts?.followingCount ?? 0}
              </p>
              <p className="text-sm text-muted-foreground font-medium truncate">Following</p>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
            </Link>
          </div>
        )}

        {/* Wallet Banner */}
        <div
          className="rounded-2xl bg-secondary text-white p-4 mb-4 flex flex-col gap-4 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setLocation("/wallet")}
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-2.5 shrink-0">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[11px] text-white/60 font-semibold uppercase tracking-wider">Wallet Balance</p>
              <p className="text-xl font-black text-white mt-0.5">
                ₹{Number(u?.walletBalance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setLocation("/wallet/deposit"); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
            >
              <Plus className="h-4 w-4" /> Add Money
            </button>
            {!isKycVerified ? (
              <button
                onClick={(e) => { e.stopPropagation(); setLocation("/verify"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-500/25 text-red-300 border border-red-500/40 text-sm font-bold hover:opacity-90 transition-opacity"
              >
                <Shield className="h-4 w-4" /> Need Verify
              </button>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setLocation("/wallet/withdraw"); }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/15 text-white text-sm font-bold hover:bg-white/25 transition-colors"
              >
                <ArrowUp className="h-4 w-4" /> Withdraw
              </button>
            )}
          </div>
        </div>

        {/* Performance Dashboard */}
        <SectionHeader title="Performance Dashboard" icon={<BarChart2 className="h-3.5 w-3.5" />} />
        <div className="rounded-xl border border-border bg-card p-4 space-y-4">
          {/* Quick Stats inside dashboard */}
          <div className="grid grid-cols-3 gap-3 pb-4 border-b border-border">
            {[
              { label: "Participated", value: stats?.examsParticipated ?? 0, icon: <BookOpen className="h-4 w-4" />, color: "#3b82f6" },
              { label: "Completed",    value: stats?.examsCompleted ?? 0,    icon: <CheckCircle className="h-4 w-4" />, color: "#059669" },
              { label: "Won",          value: stats?.examsWon ?? 0,          icon: <Award className="h-4 w-4" />, color: "#f59e0b" },
            ].map((s) => (
              <div key={s.label} className="text-center space-y-1">
                <div className="flex justify-center">
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: s.color + "18" }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Accuracy",  value: `${stats?.accuracyPercent ?? 0}%`, icon: <Target className="h-4 w-4" />,     color: "#6366f1" },
              { label: "Avg Score", value: `${stats?.avgScore ?? 0}%`,         icon: <TrendingUp className="h-4 w-4" />, color: "#0891b2" },
              { label: "Best Rank", value: stats?.highestRank ? `#${stats.highestRank}` : "—", icon: <Star className="h-4 w-4" />, color: "#f59e0b" },
              { label: "Podium",    value: `${stats?.podiumFinishes ?? 0}x`,   icon: <Zap className="h-4 w-4" />,        color: "#ef4444" },
            ].map((s) => (
              <div key={s.label} className="text-center space-y-1">
                <div className="flex justify-center">
                  <div className="rounded-lg p-1.5" style={{ backgroundColor: s.color + "18" }}>
                    <span style={{ color: s.color }}>{s.icon}</span>
                  </div>
                </div>
                <p className="text-base font-black" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {statsLoading && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!statsLoading && (stats?.examsCompleted ?? 0) > 0 && (
            <div className="space-y-3 pt-2 border-t border-border">
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-muted-foreground font-medium">Overall Accuracy</span>
                  <span className="font-bold text-foreground">{stats?.accuracyPercent}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${stats?.accuracyPercent ?? 0}%`,
                      backgroundColor:
                        (stats?.accuracyPercent ?? 0) >= 70 ? "#059669" :
                        (stats?.accuracyPercent ?? 0) >= 50 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg Time</span>
                  <span className="font-semibold">{formatTime(stats?.avgTimeTakenSeconds ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Won</span>
                  <span className="font-semibold text-green-600">₹{Number(stats?.totalWinnings ?? 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-muted-foreground">Questions</span>
                  <span className="font-semibold">{stats?.totalCorrect ?? 0} / {stats?.totalQuestions ?? 0} correct</span>
                </div>
              </div>
            </div>
          )}

          {!statsLoading && (stats?.examsCompleted ?? 0) === 0 && (
            <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
              <Activity className="h-7 w-7" />
              <p className="text-sm text-center">Participate in exams to see your performance stats</p>
            </div>
          )}
        </div>

        {/* Knowledge Skill Predictor */}
        {(stats?.categoryBreakdown?.length ?? 0) > 0 && (
          <>
            <SectionHeader title="Knowledge Skill Predictor" icon={<Zap className="h-3.5 w-3.5" />} />
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <p className="text-xs text-muted-foreground">Your strongest subjects based on exam performance</p>
              {stats?.categoryBreakdown.map((cat: any) => {
                const catColor = CATEGORY_COLORS[cat.category] ?? "#6366f1";
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: catColor }} />
                    <span className="text-sm font-semibold text-foreground w-20 shrink-0">{cat.category}</span>
                    <span className="text-xs text-muted-foreground w-14 shrink-0">{cat.count} exam{cat.count !== 1 ? "s" : ""}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${cat.accuracy}%`, backgroundColor: catColor }} />
                    </div>
                    <span className="text-xs font-bold w-10 text-right" style={{ color: catColor }}>{cat.accuracy}%</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Recent Results */}
        {(stats?.recentResults?.length ?? 0) > 0 && (
          <>
            <SectionHeader title="Recent Results" icon={<Clock className="h-3.5 w-3.5" />} />
            <div className="space-y-2">
              {stats?.recentResults.map((r: any, i: number) => {
                const catColor = CATEGORY_COLORS[r.category] ?? "#6366f1";
                const pct = r.totalQuestions > 0 ? Math.round((r.correctAnswers / r.totalQuestions) * 100) : 0;
                return (
                  <div key={i} className="rounded-xl border border-border bg-card flex items-center overflow-hidden">
                    <div className="w-16 shrink-0 flex flex-col items-center justify-center py-4 px-2" style={{ backgroundColor: catColor + "15" }}>
                      <span className="text-lg font-black" style={{ color: catColor }}>{r.rank ? `#${r.rank}` : "—"}</span>
                      <span className="text-xs font-medium" style={{ color: catColor + "99" }}>rank</span>
                    </div>
                    <div className="flex-1 px-3 py-3 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{r.examTitle}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: catColor + "20", color: catColor }}>
                          {r.category}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTime(r.timeTakenSeconds ?? 0)}</span>
                      </div>
                    </div>
                    <div className="px-3 text-right shrink-0">
                      <p className="text-base font-black" style={{ color: pct >= 70 ? "#059669" : pct >= 50 ? "#f59e0b" : "#ef4444" }}>
                        {pct}%
                      </p>
                      <p className="text-xs text-muted-foreground">{r.correctAnswers}/{r.totalQuestions}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* My Account */}
        <SectionHeader title="My Account" icon={<User className="h-3.5 w-3.5" />} />
        <MenuCard>
          {[
            { icon: <User className="h-3.5 w-3.5" />, iconBg: "#3b82f618", iconColor: "#3b82f6", label: "Name",         value: u?.name ?? "—" },
            { icon: <Phone className="h-3.5 w-3.5" />, iconBg: "#7c3aed18", iconColor: "#7c3aed", label: "Phone Number", value: u?.phone ?? "Not added" },
            { icon: <Mail className="h-3.5 w-3.5" />,  iconBg: "#0891b218", iconColor: "#0891b2", label: "Email ID",     value: u?.email ?? "—" },
            { icon: <CreditCard className="h-3.5 w-3.5" />, iconBg: "#d9770618", iconColor: "#d97706", label: "Govt ID", value: u?.govtId ?? "Not added" },
          ].map((row, i) => (
            <div key={row.label}>
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="rounded-lg p-1.5 shrink-0" style={{ backgroundColor: row.iconBg }}>
                  <span style={{ color: row.iconColor }}>{row.icon}</span>
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground">{row.label}</span>
                <span className="text-sm text-muted-foreground">{row.value}</span>
              </div>
              {i < 3 && <Separator />}
            </div>
          ))}
          <Separator />
          {/* Profile Status */}
          <Link href="/verify">
            <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors">
              <div className="rounded-lg p-1.5 shrink-0" style={{ backgroundColor: vs.color + "18" }}>
                <span style={{ color: vs.color }}>{vs.icon}</span>
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">Profile Status</span>
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: vs.color + "18", color: vs.color }}>
                {vs.icon} {vs.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
          <Separator />
          {/* Change Email & Mobile */}
          <Link href="/change-credentials">
            <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors">
              <div className="rounded-lg p-1.5 shrink-0 bg-sky-500/10">
                <RefreshCw className="h-3.5 w-3.5 text-sky-600" />
              </div>
              <span className="flex-1 text-sm font-semibold text-foreground">Change Email & Mobile</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </MenuCard>

        {/* App */}
        <SectionHeader title="App" icon={<Star className="h-3.5 w-3.5" />} />
        <MenuCard>
          {[
            { icon: <Star className="h-3.5 w-3.5" />,         iconBg: "#2563eb18", iconColor: "#2563eb", label: "Rate us on Play Store",  href: "https://play.google.com/store/games?hl=en_IN" },
            { icon: <Instagram className="h-3.5 w-3.5" />,     iconBg: "#e1306c18", iconColor: "#e1306c", label: "Follow on Instagram",     href: "https://instagram.com/rankyatraapp" },
            { icon: <MessageCircle className="h-3.5 w-3.5" />, iconBg: "#1877f218", iconColor: "#1877f2", label: "Follow on Facebook",      href: "https://facebook.com/rankyatraapp" },
            { icon: <span className="h-3.5 w-3.5 font-black text-xs flex items-center justify-center text-foreground">𝕏</span>, iconBg: "hsl(var(--foreground) / 0.08)", iconColor: "inherit", label: "Follow on X",             href: "https://x.com/rankyatraapp" },
            { icon: <span className="h-3.5 w-3.5 font-black text-xs flex items-center justify-center">▶</span>, iconBg: "#ff000018", iconColor: "#ff0000", label: "Subscribe on YouTube",    href: "https://youtube.com/@rankyatraapp" },
          ].map((row, i, arr) => (
            <div key={row.label}>
              <a href={row.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors no-underline">
                <div className="rounded-lg p-1.5 shrink-0" style={{ backgroundColor: row.iconBg }}>
                  <span style={{ color: row.iconColor }}>{row.icon}</span>
                </div>
                <span className="flex-1 text-sm font-semibold text-foreground">{row.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </a>
              {i < arr.length - 1 && <Separator />}
            </div>
          ))}
        </MenuCard>

        {/* Support */}
        <SectionHeader title="Support" icon={<HelpCircle className="h-3.5 w-3.5" />} />
        <MenuCard>
          <Link href="/faq" className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors no-underline">
            <div className="rounded-lg p-1.5 shrink-0 bg-primary/10">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">Help & FAQ</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Separator />
          <Link href="/terms" className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors no-underline">
            <div className="rounded-lg p-1.5 shrink-0 bg-violet-500/10">
              <FileText className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">Terms & Conditions</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <Separator />
          <Link href="/privacy" className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 cursor-pointer transition-colors no-underline">
            <div className="rounded-lg p-1.5 shrink-0 bg-green-500/10">
              <Shield className="h-3.5 w-3.5 text-green-600" />
            </div>
            <span className="flex-1 text-sm font-semibold text-foreground">Privacy Policy</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </MenuCard>

        {/* Sign Out */}
        <div className="mt-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 transition-colors py-4 text-destructive font-bold"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  );
}
