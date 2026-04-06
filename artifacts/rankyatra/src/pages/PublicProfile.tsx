import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Shield, Trophy, Target, BarChart2, Award, Users, Star, Zap, UserPlus, UserCheck, UserMinus, MessageCircle, Loader2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatUID } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

async function apiFetch(url: string, options?: RequestInit) {
  const token = getAuthToken();
  const res = await fetch(url, {
    ...options,
    headers: { ...(options?.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { const j = JSON.parse(text); msg = j.detail ?? j.message ?? text; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

function usePublicProfile(userId: number) {
  return useQuery<any>({
    queryKey: ["/api/users", userId, "public-profile"],
    queryFn: () => apiFetch(`/api/users/${userId}/public-profile`),
    enabled: userId > 0,
    staleTime: 30_000,
  });
}

const SKILL_COLORS: Record<string, string> = {
  Champion: "#f59e0b", Advanced: "#ef4444", Warrior: "#8b5cf6", Explorer: "#0891b2", Beginner: "#6b7280",
};

function StatBox({ icon, value, label, color }: { icon: React.ReactNode; value: string | number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-2xl border border-border bg-card">
      <div className="rounded-xl p-2.5" style={{ backgroundColor: color + "18" }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <p className="text-2xl font-black" style={{ color }}>{value}</p>
      <p className="text-xs text-muted-foreground font-semibold text-center leading-tight">{label}</p>
    </div>
  );
}

export default function PublicProfile() {
  const { id } = useParams();
  const userId = parseInt(id ?? "0");
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [msgLoading, setMsgLoading] = useState(false);
  const { data: profile, isLoading, isError } = usePublicProfile(userId);

  const invalidateCounts = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/users", userId, "public-profile"] });
    if ((me as any)?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/users", (me as any).id, "public-profile"] });
    }
  };

  const followMutation = useMutation({
    mutationFn: () => apiFetch(`/api/users/${userId}/follow`, { method: "POST" }),
    onSuccess: invalidateCounts,
  });
  const unfollowMutation = useMutation({
    mutationFn: () => apiFetch(`/api/users/${userId}/follow`, { method: "DELETE" }),
    onSuccess: invalidateCounts,
  });

  const u = profile as any;
  const isSelf = me && u && (me as any).id === u?.id;
  const initials = (u?.name ?? "?").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
  const skillColor = SKILL_COLORS[u?.skillLevel] ?? "#6b7280";
  const isKyc = u?.verificationStatus === "verified";

  const isFollowing: boolean = u?.isFollowing ?? false;
  const followsYou: boolean = u?.followsYou ?? false;
  const isMutating = followMutation.isPending || unfollowMutation.isPending;

  function FollowButton() {
    if (!me || isSelf) return null;
    if (isFollowing) {
      return (
        <Button size="sm" variant="outline" disabled={isMutating}
          className="gap-1.5 font-bold border-2"
          onClick={() => unfollowMutation.mutate()}>
          <UserMinus className="h-4 w-4 text-primary" /> Unfollow
        </Button>
      );
    }
    return (
      <Button size="sm" disabled={isMutating}
        className="gap-1.5 font-bold"
        style={{ backgroundColor: followsYou ? "#8b5cf6" : undefined }}
        onClick={() => followMutation.mutate()}>
        {followsYou ? <><UserPlus className="h-4 w-4" /> Follow Back</> : <><UserPlus className="h-4 w-4" /> Follow</>}
      </Button>
    );
  }

  if (isLoading) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />)}
      </div>
    </div>
  );

  if (isError || !u) return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
        <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
        <h2 className="text-xl font-black mb-2">User Not Found</h2>
        <p className="text-muted-foreground mb-6">This profile doesn't exist or has been removed.</p>
        <Link href="/leaderboard" className="text-primary font-semibold hover:underline">← Back to Leaderboard</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 font-semibold transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Leaderboard
        </Link>

        {/* Hero Card */}
        <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)" }}>
          <div className="p-6">
            <div className="flex items-start gap-4">
              <Avatar className="h-20 w-20 border-4 border-white/20 shrink-0">
                <AvatarImage src={u.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-white/10 text-white font-black text-2xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-2xl font-black text-white">{u.name}</h1>
                  {u.isAdmin && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white">👑 Admin</span>}
                  {followsYou && !isSelf && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/70">Follows you</span>
                  )}
                </div>
                <p className="text-white/60 text-xs font-mono font-bold tracking-widest mb-2">UID-{u.id ? formatUID(u.id) : "—"}</p>
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  {isKyc && (
                    <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#05966922", color: "#34d399" }}>
                      <Shield className="h-3 w-3" /> KYC Verified
                    </span>
                  )}
                  {u.skillLevel && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: skillColor + "30", color: skillColor }}>
                      {u.skillIcon} {u.skillLevel}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-white/40" />
                    <p className="text-xs text-white/50 font-semibold">{u.rankPoints ?? 0} pts</p>
                    <span className="text-white/30">·</span>
                    <p className="text-xs text-white/40">Joined {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <FollowButton />
                    {me && !isSelf && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={msgLoading}
                        className="border-white/20 text-white hover:bg-white/10 hover:text-white bg-transparent disabled:opacity-60"
                        onClick={async () => {
                          if (msgLoading) return;
                          setMsgLoading(true);
                          try {
                            const res = await apiFetch(`/api/chat/conversations/start/${userId}`, { method: "POST" });
                            navigate(`/chat/${res.id}`);
                          } catch (err: any) {
                            alert(err?.message ?? "Message bhejne mein error aayi, please retry.");
                          } finally {
                            setMsgLoading(false);
                          }
                        }}
                      >
                        {msgLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5 mr-1" />}
                        {msgLoading ? "Opening..." : "Message"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats strip — Contests / Played / Won + Followers / Following */}
          <div className="grid grid-cols-5 border-t border-white/10">
            <div className="flex flex-col items-center py-4 gap-0.5 border-r border-white/10">
              <p className="text-base font-black text-white">{u.examsParticipated ?? 0}</p>
              <p className="text-[10px] text-white/50 font-semibold">Contests</p>
            </div>
            <div className="flex flex-col items-center py-4 gap-0.5 border-r border-white/10">
              <p className="text-base font-black text-white">{u.examsCompleted ?? 0}</p>
              <p className="text-[10px] text-white/50 font-semibold">Played</p>
            </div>
            <div className="flex flex-col items-center py-4 gap-0.5 border-r border-white/10">
              <p className="text-base font-black text-amber-400">{u.examsWon ?? 0}</p>
              <p className="text-[10px] text-white/50 font-semibold">Won</p>
            </div>
            <Link href={`/user/${userId}/followers`} className="flex flex-col items-center py-4 gap-0.5 border-r border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
              <p className="text-base font-black text-white">{u.followersCount}</p>
              <p className="text-[10px] text-white/50 font-semibold">Followers</p>
            </Link>
            <Link href={`/user/${userId}/following`} className="flex flex-col items-center py-4 gap-0.5 cursor-pointer hover:bg-white/10 transition-colors">
              <p className="text-base font-black text-white">{u.followingCount}</p>
              <p className="text-[10px] text-white/50 font-semibold">Following</p>
            </Link>
          </div>
        </div>

        {/* Performance Grid */}
        <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">Performance</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
          <StatBox icon={<Target className="h-5 w-5" />} value={`${u.accuracyPercent ?? 0}%`} label="Accuracy" color="#2563eb" />
          <StatBox icon={<Trophy className="h-5 w-5" />} value={`${u.winRatio ?? 0}%`} label="Win Ratio" color="#059669" />
          <StatBox icon={<Award className="h-5 w-5" />} value={formatCurrency(u.totalWinnings ?? 0)} label="Total Winnings" color="#f59e0b" />
          <StatBox icon={<Star className="h-5 w-5" />} value={u.highestRank ? `#${u.highestRank}` : "—"} label="Best Rank" color="#8b5cf6" />
          <StatBox icon={<Users className="h-5 w-5" />} value={u.podiumFinishes ?? 0} label="Podium Finishes" color="#0891b2" />
          <StatBox icon={<BarChart2 className="h-5 w-5" />} value={u.rankPoints ?? 0} label="Rank Points" color="#ef4444" />
        </div>

        {/* Recent Exams */}
        {u.recentResults?.length > 0 && (
          <>
            <h2 className="text-sm font-black text-muted-foreground uppercase tracking-widest mb-3 px-1">Recent Exams</h2>
            <div className="space-y-2">
              {u.recentResults.map((r: any) => {
                const pct = r.totalQuestions > 0 ? Math.round((r.correctAnswers / r.totalQuestions) * 100) : 0;
                const pctColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
                return (
                  <div key={r.examId + r.submittedAt} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
                    <div className="w-9 text-center font-black text-lg shrink-0">
                      {r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : r.rank === 3 ? "🥉" : r.rank ? `#${r.rank}` : "—"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{r.examTitle}</p>
                      <p className="text-xs text-muted-foreground">{r.category} · {new Date(r.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black text-sm" style={{ color: pctColor }}>{pct}%</p>
                      <p className="text-xs text-muted-foreground">{r.correctAnswers}/{r.totalQuestions}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {u.recentResults?.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No exams played yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
