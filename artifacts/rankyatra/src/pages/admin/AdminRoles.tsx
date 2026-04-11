import { useState, useEffect } from "react";
import { Link } from "wouter";
import { GraduationCap, Star, Megaphone, Handshake, Crown, Users, TrendingUp, IndianRupee, ChevronRight, Filter } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatCurrency, formatUID } from "@/lib/utils";


const ROLE_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  teacher:    { label: "Teacher",    icon: GraduationCap, color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
  influencer: { label: "Influencer", icon: Star,          color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  promoter:   { label: "Promoter",   icon: Megaphone,     color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  partner:    { label: "Partner",    icon: Handshake,     color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  premium:    { label: "Premium",    icon: Crown,         color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
};

export default function AdminRoles() {
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const token = localStorage.getItem("rankyatra_token");
    fetch("/api/admin/roles", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => setAllRoles(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter === "all" ? allRoles : allRoles.filter(r => r.role === filter);

  const totalCommission = allRoles.reduce((s, r) => s + Number(r.availableCommission ?? 0), 0);
  const totalRevenue    = allRoles.reduce((s, r) => s + Number(r.totalRevenue ?? 0), 0);
  const totalMembers    = allRoles.reduce((s, r) => s + (r.memberCount ?? 0), 0);

  const countByRole = (role: string) => allRoles.filter(r => r.role === role).length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">Roles & Groups</h1>
          <Badge variant="secondary" className="text-sm">{allRoles.length} role holders</Badge>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">{totalMembers}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Total Group Members</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-green-600">{formatCurrency(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Member Revenue</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-orange-500">{formatCurrency(totalCommission)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">Pending Commission</p>
          </CardContent></Card>
        </div>

        {/* Role tabs */}
        <div className="flex gap-2 flex-wrap">
          {[["all", "All", null], ...Object.entries(ROLE_META).map(([k, m]) => [k, m.label, m])].map(([role, label, meta]: any) => {
            const cnt = role === "all" ? allRoles.length : countByRole(role);
            const active = filter === role;
            return (
              <button
                key={role}
                onClick={() => setFilter(role as string)}
                style={active && meta ? { background: meta.bg, borderColor: meta.color, color: meta.color } : {}}
                className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${active ? "border-2" : "border-border text-muted-foreground bg-muted hover:bg-secondary"}`}
              >
                {meta && <meta.icon className="h-3.5 w-3.5" />}
                {label} ({cnt})
              </button>
            );
          })}
        </div>

        {/* Role holders list */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground">No role holders found.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => {
              const meta = ROLE_META[row.role];
              if (!meta) return null;
              const Icon = meta.icon;
              const initials = (row.userName ?? "U").split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase();
              return (
                <Card key={row.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border">
                        <AvatarImage src={row.userAvatar ?? undefined} />
                        <AvatarFallback className="text-sm font-bold bg-secondary">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">{row.userName}</span>
                          <span
                            className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            <Icon className="h-3 w-3" />{meta.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{row.userEmail}</p>
                        {row.groupName && (
                          <p className="text-xs font-medium mt-0.5">Group: <span className="text-foreground">{row.groupName}</span></p>
                        )}
                      </div>
                      <Link href={`/admin/users/${row.userId}`} className="shrink-0">
                        <button className="p-1.5 rounded-lg hover:bg-muted">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </Link>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="text-center bg-muted rounded-lg py-2">
                        <p className="text-sm font-black flex items-center justify-center gap-1">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" />{row.memberCount ?? 0}
                        </p>
                        <p className="text-xs text-muted-foreground">Members</p>
                      </div>
                      <div className="text-center bg-green-50 rounded-lg py-2">
                        <p className="text-sm font-black text-green-600">{formatCurrency(row.totalRevenue ?? 0)}</p>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                      </div>
                      <div className="text-center bg-orange-50 rounded-lg py-2">
                        <p className="text-sm font-black text-orange-500">{formatCurrency(row.commission ?? 0)}</p>
                        <p className="text-xs text-muted-foreground">Commission</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
