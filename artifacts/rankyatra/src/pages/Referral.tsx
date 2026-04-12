import { useState, useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, Copy, Share2, Users, IndianRupee, Gift, CheckCircle, Clock, XCircle, TrendingUp, Link2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";

interface ReferralStats {
  referralCode: string | null;
  referralLink: string | null;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalEarnings: number;
  totalClicks: number;
}

interface ReferralEntry {
  id: number;
  name: string;
  email: string;
  bonusPaid: boolean;
  fraudBlocked: boolean;
  status: "completed" | "pending" | "blocked";
  joinedAt: string;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 rounded-xl bg-muted/40 border border-border">
      <div className={`p-2 rounded-full`} style={{ background: `${color}20` }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <p className="text-xl font-black">{value}</p>
      <p className="text-xs text-muted-foreground text-center">{label}</p>
    </div>
  );
}

export default function ReferralPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    Promise.all([
      fetch("/api/referral/stats", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch("/api/referral/list", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([s, l]) => {
        setStats(s);
        setReferrals(Array.isArray(l) ? l : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = () => {
    if (!stats?.referralLink) return;
    navigator.clipboard.writeText(stats.referralLink).then(() => {
      setCopied(true);
      toast({ title: "Link copied!", description: "Ab friends ke saath share karo." });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShare = () => {
    if (!stats?.referralLink) return;
    const text = `🚀 RankYatra pe join karo aur ₹20 bonus pao!\n\nMera referral link: ${stats.referralLink}`;
    if (navigator.share) {
      navigator.share({ title: "RankYatra — Refer & Earn", text, url: stats.referralLink });
    } else {
      navigator.clipboard.writeText(text);
      toast({ title: "Text copied!", description: "Share karo apne friends ke saath." });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground">Login karo referral program access karne ke liye.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Link>
          </Button>
          <h1 className="text-2xl font-black">Refer & Earn</h1>
        </div>

        {/* Hero Banner */}
        <div className="rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-white/20 rounded-full">
              <Gift className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black">Dono ko milega ₹20!</h2>
              <p className="text-sm text-white/80">Apne friend ko refer karo — dono ko ₹20 bonus milega</p>
            </div>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
              <span>✅ Aap ko ₹20</span>
            </div>
            <div className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1">
              <span>✅ Friend ko ₹20</span>
            </div>
          </div>
        </div>

        {/* Referral Link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" /> Aapka Referral Link
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="h-10 bg-muted animate-pulse rounded-lg" />
            ) : (
              <>
                <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
                  <p className="text-sm font-mono text-primary flex-1 truncate">{stats?.referralLink ?? "Loading..."}</p>
                  <Badge className="shrink-0 bg-primary/10 text-primary border-0 font-mono text-xs">
                    {stats?.referralCode}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCopy} className="flex-1 gap-2" variant={copied ? "secondary" : "default"}>
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button onClick={handleShare} variant="outline" className="flex-1 gap-2">
                    <Share2 className="h-4 w-4" /> Share
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)
          ) : (
            <>
              <StatCard icon={Users} label="Total Referrals" value={stats?.totalReferrals ?? 0} color="#f97316" />
              <StatCard icon={CheckCircle} label="Successful" value={stats?.successfulReferrals ?? 0} color="#059669" />
              <StatCard icon={IndianRupee} label="Total Earnings" value={`₹${stats?.totalEarnings ?? 0}`} color="#6366f1" />
              <StatCard icon={TrendingUp} label="Total Clicks" value={stats?.totalClicks ?? 0} color="#0891b2" />
            </>
          )}
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kaise Kaam Karta Hai?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { step: "1", text: "Apna referral link copy karo ya share karo" },
                { step: "2", text: "Friend us link se sign up kare" },
                { step: "3", text: "Dono ke wallet mein ₹20-₹20 automatically credit ho jaega!" },
              ].map(({ step, text }) => (
                <div key={step} className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-primary text-white text-xs font-black flex items-center justify-center shrink-0">
                    {step}
                  </div>
                  <p className="text-sm">{text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Referral List */}
        {referrals.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referred Users ({referrals.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {referrals.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(r.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    {r.status === "completed" && (
                      <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
                        <CheckCircle className="h-3 w-3" /> ₹20 Credited
                      </Badge>
                    )}
                    {r.status === "pending" && (
                      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 gap-1">
                        <Clock className="h-3 w-3" /> Pending
                      </Badge>
                    )}
                    {r.status === "blocked" && (
                      <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" /> Blocked
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && referrals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Abhi koi referral nahi. Link share karo!</p>
          </div>
        )}
      </div>
    </div>
  );
}
