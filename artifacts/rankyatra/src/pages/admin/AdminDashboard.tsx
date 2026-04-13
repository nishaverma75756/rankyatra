import { Link } from "wouter";
import { Users, BookOpen, Trophy, DollarSign, TrendingUp, Shield, Wallet, ShieldCheck, Flag, Crown, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminGetStats } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminGetStats();
  const { isSuperAdmin, adminPermissions } = useAuth();
  const hasPerm = (perm: string) => isSuperAdmin || adminPermissions.includes(perm);
  const token = getAuthToken();
  const { data: deposits = [] } = useQuery<any[]>({
    queryKey: ["admin-deposits-count"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/deposits"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pendingCount = Array.isArray(deposits) ? deposits.filter((d: any) => d.status === "pending").length : 0;

  const { data: withdrawals = [] } = useQuery<any[]>({
    queryKey: ["admin-withdrawals-count"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/withdrawals"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pendingWithdrawals = Array.isArray(withdrawals) ? withdrawals.filter((w: any) => w.status === "pending").length : 0;

  const { data: verifications = [] } = useQuery<any[]>({
    queryKey: ["admin-verifications-count"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/verifications"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 30000,
  });
  const pendingVerifications = Array.isArray(verifications) ? verifications.filter((v: any) => v.status === "pending").length : 0;

  const { data: reports = [] } = useQuery<any[]>({
    queryKey: ["admin-reports-count"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/reports"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 60000,
  });
  const pendingReports = Array.isArray(reports) ? reports.filter((r: any) => r.status === "pending").length : 0;

  const statCards = [
    { icon: Users, label: "Total Users", value: (stats as any)?.totalUsers ?? 0, sub: `${(stats as any)?.activeUsers ?? 0} active`, color: "text-blue-600 bg-blue-50" },
    { icon: BookOpen, label: "Total Exams", value: (stats as any)?.totalExams ?? 0, sub: `${(stats as any)?.liveExams ?? 0} live now`, color: "text-purple-600 bg-purple-50" },
    { icon: Trophy, label: "Registrations", value: (stats as any)?.totalRegistrations ?? 0, sub: "Total entries", color: "text-amber-600 bg-amber-50" },
    { icon: DollarSign, label: "Total Revenue", value: formatCurrency((stats as any)?.totalRevenue ?? 0), sub: "Entry fees collected", color: "text-green-600 bg-green-50" },
    { icon: TrendingUp, label: "Prizes Distributed", value: formatCurrency((stats as any)?.totalPrizesDistributed ?? 0), sub: "To winners", color: "text-primary bg-primary/10" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${isSuperAdmin ? "bg-amber-500" : "bg-primary"}`}>
            {isSuperAdmin ? <Crown className="h-6 w-6 text-white" /> : <Shield className="h-6 w-6 text-primary-foreground" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-foreground">Admin Panel</h1>
              {isSuperAdmin && (
                <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                  <Crown className="h-3 w-3" /> Super Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {isSuperAdmin ? "Full access — manage all platform settings and admins" : "Manage your assigned sections"}
            </p>
          </div>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-3 mb-8">
          {hasPerm("users") && (
            <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
              <Link href="/admin/users">Manage Users</Link>
            </Button>
          )}
          {hasPerm("exams") && (
            <Button asChild variant="outline" className="border-primary/30 text-primary hover:bg-primary/10">
              <Link href="/admin/exams">Manage Exams</Link>
            </Button>
          )}
          {hasPerm("deposits") && (
            <Button asChild variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50 relative">
              <Link href="/admin/deposits">
                Deposit Requests
                {pendingCount > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-tight">{pendingCount}</span>
                )}
              </Link>
            </Button>
          )}
          {hasPerm("withdrawals") && (
            <Button asChild variant="outline" className="border-blue-400 text-blue-700 hover:bg-blue-50 relative">
              <Link href="/admin/withdrawals">
                Withdrawal Requests
                {pendingWithdrawals > 0 && (
                  <span className="ml-2 bg-blue-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-tight">{pendingWithdrawals}</span>
                )}
              </Link>
            </Button>
          )}
          {hasPerm("kyc") && (
            <Button asChild variant="outline" className="border-green-400 text-green-700 hover:bg-green-50 relative">
              <Link href="/admin/verifications">
                KYC Verifications
                {pendingVerifications > 0 && (
                  <span className="ml-2 bg-green-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 leading-tight">{pendingVerifications}</span>
                )}
              </Link>
            </Button>
          )}
          {hasPerm("banners") && (
            <Button asChild variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-50">
              <Link href="/admin/banners">🖼️ Banner Slider</Link>
            </Button>
          )}
          {hasPerm("categories") && (
            <Button asChild variant="outline" className="border-indigo-400 text-indigo-700 hover:bg-indigo-50">
              <Link href="/admin/categories">🏷️ Exam Categories</Link>
            </Button>
          )}
          {hasPerm("exams") && (
            <>
              <Button asChild variant="outline" className="border-amber-500 text-amber-700 hover:bg-amber-50">
                <Link href="/admin/completed-exams">🏆 Completed Exams</Link>
              </Button>
              <Button asChild variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50">
                <Link href="/admin/upcoming-exams">📅 Upcoming Exams</Link>
              </Button>
            </>
          )}
          {hasPerm("reports") && (
            <Button asChild variant="outline" className="border-red-400 text-red-700 hover:bg-red-50 relative">
              <Link href="/admin/reports" className="flex items-center gap-2">
                <Flag className="h-4 w-4" /> User Reports
                {pendingReports > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{pendingReports}</span>
                )}
              </Link>
            </Button>
          )}
          {hasPerm("roles") && (
            <Button asChild variant="outline" className="border-purple-500 text-purple-700 hover:bg-purple-50">
              <Link href="/admin/roles" className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> Roles &amp; Groups
              </Link>
            </Button>
          )}
          {isSuperAdmin && (
            <Button asChild variant="outline" className="border-violet-500 text-violet-700 hover:bg-violet-50 relative">
              <Link href="/admin/reel-applications" className="flex items-center gap-2">
                🎬 Reel Applications
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" className="border-primary text-primary hover:bg-primary/10">
            <Link href="/admin/broadcast" className="flex items-center gap-2">
              <Bell className="h-4 w-4" /> Broadcast Notifications
            </Link>
          </Button>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {statCards.map(({ icon: Icon, label, value, sub, color }) => (
              <Card key={label}>
                <CardContent className="p-5">
                  <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${color} mb-3`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-2xl font-black text-foreground">{value}</div>
                  <div className="text-sm font-semibold text-foreground mt-0.5">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="border-primary/30 bg-primary/5 md:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5 text-primary" /> Broadcast Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-muted-foreground flex-1">
                Send custom push + in-app notifications to all users or specific users. Supports personal template variables like <code className="bg-primary/10 text-primary text-xs px-1 rounded">{"{name}"}</code>, <code className="bg-primary/10 text-primary text-xs px-1 rounded">{"{uid}"}</code>, <code className="bg-primary/10 text-primary text-xs px-1 rounded">{"{wallet}"}</code> — har user ko personalized message milega.
              </p>
              <Button asChild className="shrink-0">
                <Link href="/admin/broadcast">Open Broadcast →</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="h-5 w-5 text-primary" /> User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                View, edit, block/unblock users, adjust wallet balances, and manage profiles.
              </p>
              <Button asChild>
                <Link href="/admin/users">Go to User Management →</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" /> Exam Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Create, edit, and delete exams. Manage questions, distribute rewards to winners.
              </p>
              <Button asChild>
                <Link href="/admin/exams">Go to Exam Management →</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className={pendingCount > 0 ? "border-amber-300 bg-amber-50/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5 text-amber-600" /> Deposit Requests
                {pendingCount > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingCount} pending</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Review UPI payment requests from users, approve or reject wallet top-ups, and manage payment QR code.
              </p>
              <Button asChild className="bg-amber-500 hover:bg-amber-600 text-white">
                <Link href="/admin/deposits">Manage Deposits →</Link>
              </Button>
            </CardContent>
          </Card>
          <Card className={pendingWithdrawals > 0 ? "border-blue-300 bg-blue-50/40" : ""}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-blue-600" /> Withdrawal Requests
                {pendingWithdrawals > 0 && (
                  <span className="ml-auto bg-blue-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingWithdrawals} pending</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Process user withdrawal requests. Enter UTR number after payment and approve to notify users.
              </p>
              <Button asChild className="bg-blue-600 hover:bg-blue-700 text-white">
                <Link href="/admin/withdrawals">Manage Withdrawals →</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
