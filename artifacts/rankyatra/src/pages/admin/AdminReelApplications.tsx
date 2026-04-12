import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Film, CheckCircle, XCircle, Clock, User, ExternalLink, Search } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";

type AppStatus = "pending" | "approved" | "rejected";

interface ReelApp {
  id: number;
  userId: number;
  instagramHandle: string | null;
  youtubeChannel: string | null;
  facebookHandle: string | null;
  twitterHandle: string | null;
  contentType: string | null;
  reason: string;
  status: AppStatus;
  adminNote: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userAvatarUrl: string | null;
  canPostReels: boolean;
}

const STATUS_CONFIG: Record<AppStatus, { label: string; icon: any; color: string }> = {
  pending: { label: "Pending Review", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200" },
  approved: { label: "Approved", icon: CheckCircle, color: "text-green-700 bg-green-50 border-green-200" },
  rejected: { label: "Rejected", icon: XCircle, color: "text-red-700 bg-red-50 border-red-200" },
};

export default function AdminReelApplications() {
  const { toast } = useToast();
  const [apps, setApps] = useState<ReelApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AppStatus | "all">("pending");
  const [search, setSearch] = useState("");
  const [noteInputs, setNoteInputs] = useState<Record<number, string>>({});
  const [actioning, setActioning] = useState<number | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/reel-applications", {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApps(data);
        const initNotes: Record<number, string> = {};
        data.forEach((a: ReelApp) => { initNotes[a.id] = a.adminNote ?? ""; });
        setNoteInputs(initNotes);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchApps(); }, []);

  const handleStatus = async (app: ReelApp, status: "approved" | "rejected") => {
    setActioning(app.id);
    try {
      const res = await fetch(`/api/admin/reel-applications/${app.id}/status`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: noteInputs[app.id] ?? "" }),
      });
      if (!res.ok) { const e = await res.json(); throw e; }
      toast({ title: status === "approved" ? "Application approved! User can now post reels." : "Application rejected." });
      fetchApps();
    } catch (e: any) {
      toast({ title: "Error", description: e?.error ?? "Failed", variant: "destructive" });
    } finally { setActioning(null); }
  };

  const filtered = apps.filter((a) => {
    const matchFilter = filter === "all" || a.status === filter;
    const matchSearch = !search.trim() || (a.userName ?? "").toLowerCase().includes(search.toLowerCase()) || (a.userEmail ?? "").toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pendingCount = apps.filter((a) => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-100 rounded-xl">
            <Film className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Reel Applications</h1>
            <p className="text-sm text-muted-foreground">Review and approve user applications to post reels</p>
          </div>
          {pendingCount > 0 && (
            <Badge className="ml-auto bg-amber-100 text-amber-700 border border-amber-200 text-sm font-bold px-3 py-1">
              {pendingCount} pending
            </Badge>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all border ${
                  filter === s
                    ? "bg-primary text-white border-primary"
                    : "bg-muted border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {s === "all" ? "All" : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Film className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground font-semibold">No applications found</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((app) => {
              const statusCfg = STATUS_CONFIG[app.status];
              const StatusIcon = statusCfg.icon;
              return (
                <Card key={app.id} className={app.status === "pending" ? "border-amber-200 shadow-sm" : ""}>
                  <CardContent className="pt-5 space-y-4">
                    {/* User info row */}
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={app.userAvatarUrl ?? undefined} />
                        <AvatarFallback className="bg-purple-100 text-purple-700 font-bold text-sm">
                          {(app.userName ?? "U")[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">{app.userName ?? "Unknown"}</p>
                          <Link href={`/admin/users/${app.userId}`}>
                            <a className="text-xs text-primary flex items-center gap-1 hover:underline">
                              <ExternalLink className="h-3 w-3" /> View Profile
                            </a>
                          </Link>
                        </div>
                        <p className="text-xs text-muted-foreground">{app.userEmail}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Applied {new Date(app.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${statusCfg.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Social handles */}
                    {(app.instagramHandle || app.youtubeChannel || app.facebookHandle || app.twitterHandle || app.contentType) && (
                      <div className="flex flex-wrap gap-2">
                        {app.instagramHandle && (
                          <span className="text-xs bg-pink-50 border border-pink-200 text-pink-700 px-2.5 py-1 rounded-full font-semibold">
                            📸 @{app.instagramHandle}
                          </span>
                        )}
                        {app.youtubeChannel && (
                          <span className="text-xs bg-red-50 border border-red-200 text-red-700 px-2.5 py-1 rounded-full font-semibold">
                            ▶️ {app.youtubeChannel}
                          </span>
                        )}
                        {app.facebookHandle && (
                          <span className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                            📘 {app.facebookHandle}
                          </span>
                        )}
                        {app.twitterHandle && (
                          <span className="text-xs bg-sky-50 border border-sky-200 text-sky-700 px-2.5 py-1 rounded-full font-semibold">
                            🐦 @{app.twitterHandle}
                          </span>
                        )}
                        {app.contentType && (
                          <span className="text-xs bg-purple-50 border border-purple-200 text-purple-700 px-2.5 py-1 rounded-full font-semibold">
                            🎬 {app.contentType}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Reason */}
                    {app.reason && (
                      <div className="bg-muted rounded-xl p-3.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Why they want to post reels</p>
                        <p className="text-sm leading-relaxed">{app.reason}</p>
                      </div>
                    )}

                    {/* Admin note (existing) */}
                    {app.status !== "pending" && app.adminNote && (
                      <div className="bg-muted rounded-lg px-3 py-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-semibold">Admin note:</span> {app.adminNote}
                        </p>
                      </div>
                    )}

                    {/* Actions for pending */}
                    {app.status === "pending" && (
                      <div className="space-y-3 pt-1 border-t border-border">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground block mb-1">Admin note (optional, shown to user if rejected)</label>
                          <Input
                            placeholder="Add a note for the applicant..."
                            value={noteInputs[app.id] ?? ""}
                            onChange={(e) => setNoteInputs((prev) => ({ ...prev, [app.id]: e.target.value }))}
                            className="text-sm"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="bg-green-600 hover:bg-green-700 text-white flex-1"
                            onClick={() => handleStatus(app, "approved")}
                            disabled={actioning === app.id}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            className="border-destructive/50 text-destructive hover:bg-destructive/10 flex-1"
                            onClick={() => handleStatus(app, "rejected")}
                            disabled={actioning === app.id}
                          >
                            <XCircle className="h-4 w-4 mr-1.5" />
                            Reject
                          </Button>
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
    </div>
  );
}
