import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import {
  ArrowLeft, Users, IndianRupee, TrendingUp, Clock, CheckCircle,
  GraduationCap, Star, Megaphone, Handshake, Crown, BookOpen, Wallet
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";

const ROLE_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  teacher:    { label: "Teacher",    icon: GraduationCap, color: "#2563eb", bg: "#eff6ff" },
  influencer: { label: "Influencer", icon: Star,          color: "#7c3aed", bg: "#f5f3ff" },
  promoter:   { label: "Promoter",   icon: Megaphone,     color: "#d97706", bg: "#fffbeb" },
  partner:    { label: "Partner",    icon: Handshake,     color: "#059669", bg: "#ecfdf5" },
  premium:    { label: "Premium",    icon: Crown,         color: "#f97316", bg: "#fff7ed" },
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  accepted: { label: "Joined",   color: "#059669", bg: "#ecfdf5" },
  pending:  { label: "Pending",  color: "#d97706", bg: "#fffbeb" },
  declined: { label: "Declined", color: "#dc2626", bg: "#fef2f2" },
};

export default function AdminGroupDetail() {
  const { userId } = useParams<{ userId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("accepted");

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem("rankyatra_token");
    fetch(`/api/admin/groups/${userId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data || !data.owner) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-8 max-w-4xl text-center text-muted-foreground">
          User not found.
        </div>
      </div>
    );
  }

  const { owner, role, group, members, stats } = data;
  const meta = role ? ROLE_META[role] : null;
  const RoleIcon = meta?.icon;
  const initials = (owner.name ?? "U").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();

  const filtered = statusFilter === "all"
    ? members
    : members.filter((m: any) => m.status === statusFilter);

  const countByStatus = (s: string) => members.filter((m: any) => m.status === s).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        {/* Back button */}
        <div className="flex items-center gap-3">
          <Link href="/admin/roles">
            <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Roles
            </button>
          </Link>
        </div>

        {/* Owner card */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-border">
                <AvatarImage src={owner.avatarUrl ?? undefined} />
                <AvatarFallback className="text-lg font-black bg-secondary">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg font-black">{owner.name}</h1>
                  {meta && RoleIcon && (
                    <span
                      className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                      style={{ background: meta.bg, color: meta.color }}
                    >
                      <RoleIcon className="h-3.5 w-3.5" />{meta.label}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{owner.email}</p>
                {group && (
                  <p className="text-sm font-medium mt-0.5">
                    Group: <span className="text-foreground font-bold">{group.name}</span>
                  </p>
                )}
              </div>
              <Link href={`/admin/users/${owner.id}`}>
                <button className="text-xs font-bold px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                  View Profile
                </button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {!group ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            No group created yet.
          </CardContent></Card>
        ) : (
          <>
            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-2xl font-black">{stats.totalMembers ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Active Members</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Clock className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-2xl font-black text-amber-500">{stats.pendingInvites ?? 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Pending Invites</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                  </div>
                  <p className="text-2xl font-black text-green-600">{formatCurrency(stats.totalRevenue ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Member Revenue</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-1">
                    <Wallet className="h-5 w-5 text-orange-500" />
                  </div>
                  <p className="text-2xl font-black text-orange-500">{formatCurrency(stats.availableCommission ?? 0)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Available Commission</p>
                </CardContent>
              </Card>
            </div>

            {/* Commission breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-orange-500" />
                  Commission Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-green-50 rounded-lg p-3">
                    <p className="text-sm font-black text-green-700">{formatCurrency(stats.totalCommission ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Total Earned (5%)</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3">
                    <p className="text-sm font-black text-red-600">{formatCurrency(stats.withdrawnAmount ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Withdrawn</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <p className="text-sm font-black text-orange-600">{formatCurrency(stats.availableCommission ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pending Payout</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Members section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black flex items-center gap-2">
                  <Users className="h-4 w-4" /> Members
                </h2>
                <div className="flex gap-2">
                  {[
                    ["all", "All", members.length],
                    ["accepted", "Joined", countByStatus("accepted")],
                    ["pending", "Pending", countByStatus("pending")],
                    ["declined", "Declined", countByStatus("declined")],
                  ].map(([val, lbl, cnt]) => (
                    <button
                      key={val}
                      onClick={() => setStatusFilter(String(val))}
                      className={`text-xs font-bold px-2.5 py-1 rounded-full border transition-all ${
                        statusFilter === val
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {lbl} ({cnt})
                    </button>
                  ))}
                </div>
              </div>

              {filtered.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center text-muted-foreground text-sm">
                    No members in this category.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filtered.map((m: any) => {
                    const st = STATUS_STYLE[m.status] ?? STATUS_STYLE.pending;
                    const mi = (m.name ?? "U").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
                    return (
                      <Card key={m.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border shrink-0">
                              <AvatarImage src={m.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs font-bold bg-secondary">{mi}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm">{m.name ?? "Unknown"}</span>
                                <span
                                  className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: st.bg, color: st.color }}
                                >
                                  {st.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">{m.email}</p>
                              {m.joinedAt && (
                                <p className="text-xs text-muted-foreground">
                                  Joined: {new Date(m.joinedAt).toLocaleDateString("en-IN")}
                                </p>
                              )}
                            </div>
                            <Link href={`/admin/users/${m.userId}`}>
                              <button className="text-xs text-primary hover:underline font-medium shrink-0">View</button>
                            </Link>
                          </div>

                          {m.status === "accepted" && (
                            <div className="grid grid-cols-3 gap-2 mt-3">
                              <div className="text-center bg-blue-50 rounded-lg py-2">
                                <p className="text-sm font-black text-blue-600 flex items-center justify-center gap-1">
                                  <BookOpen className="h-3.5 w-3.5" />{m.examsTaken}
                                </p>
                                <p className="text-xs text-muted-foreground">Exams</p>
                              </div>
                              <div className="text-center bg-green-50 rounded-lg py-2">
                                <p className="text-sm font-black text-green-600">{formatCurrency(m.totalSpent)}</p>
                                <p className="text-xs text-muted-foreground">Spent</p>
                              </div>
                              <div className="text-center bg-orange-50 rounded-lg py-2">
                                <p className="text-sm font-black text-orange-500">{formatCurrency(m.commission)}</p>
                                <p className="text-xs text-muted-foreground">Commission</p>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
