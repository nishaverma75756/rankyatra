import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ChevronDown, ChevronUp, Trophy, Users, CheckCircle,
  XCircle, Gift, Clock, Medal,
} from "lucide-react";

type Participant = {
  userId: number;
  name: string;
  email: string;
  submitted: boolean;
  score: number | null;
  timeTakenSeconds: number | null;
};

type TopEntry = {
  rank: number;
  userId: number;
  name: string;
  email: string;
  score: number;
  timeTakenSeconds: number;
};

type CompletedExam = {
  id: number;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  prizePool: string;
  entryFee: string;
  rewardsDistributed: boolean;
  totalRegistered: number;
  totalSubmitted: number;
  totalNotSubmitted: number;
  participants: Participant[];
  topFive: TopEntry[];
};

function fmtTime(s: number | null) {
  if (s === null) return "—";
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function RewardModal({ exam, onClose }: { exam: CompletedExam; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const token = getAuthToken();
  const [prizes, setPrizes] = useState<Record<number, string>>(
    Object.fromEntries(exam.topFive.map((e) => [e.rank, ""]))
  );

  const { mutate: sendRewards, isPending } = useMutation({
    mutationFn: async () => {
      const payload = exam.topFive
        .filter((e) => prizes[e.rank] && parseFloat(prizes[e.rank]) > 0)
        .map((e) => ({ rank: e.rank, amount: prizes[e.rank] }));
      const r = await fetch(getApiUrl(`/api/admin/exams/${exam.id}/reward`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prizes: payload }),
      });
      if (!r.ok) throw new Error("Failed to distribute rewards");
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: `Rewards sent to ${data.rewarded?.length ?? 0} winners!` });
      queryClient.invalidateQueries({ queryKey: ["admin-completed-exams"] });
      onClose();
    },
    onError: () => toast({ title: "Failed to send rewards", variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Gift className="h-5 w-5 text-amber-500" />
          <h2 className="text-lg font-black">Distribute Rewards</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">{exam.title}</p>
        <div className="space-y-3 mb-6">
          {exam.topFive.map((entry) => (
            <div key={entry.rank} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black text-white ${
                entry.rank === 1 ? "bg-amber-500" : entry.rank === 2 ? "bg-slate-400" : entry.rank === 3 ? "bg-amber-700" : "bg-muted"
              }`}>
                {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{entry.name}</p>
                <p className="text-xs text-muted-foreground">Score: {entry.score} · {fmtTime(entry.timeTakenSeconds)}</p>
              </div>
              <div className="relative w-24">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={prizes[entry.rank] ?? ""}
                  onChange={(e) => setPrizes((p) => ({ ...p, [entry.rank]: e.target.value }))}
                  className="w-full pl-6 pr-2 py-1.5 text-sm border rounded-lg bg-background focus:ring-2 focus:ring-primary/30 outline-none"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1 bg-amber-500 hover:bg-amber-600 text-white" onClick={() => sendRewards()} disabled={isPending}>
            {isPending ? "Sending..." : "Send Rewards"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExamRow({ exam }: { exam: CompletedExam }) {
  const [expanded, setExpanded] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "submitted" | "not">("all");

  const displayedParticipants = exam.participants.filter((p) =>
    activeTab === "all" ? true : activeTab === "submitted" ? p.submitted : !p.submitted
  );

  return (
    <>
      {showReward && <RewardModal exam={exam} onClose={() => setShowReward(false)} />}
      <Card className="overflow-hidden">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex h-10 w-10 rounded-xl bg-primary/10 items-center justify-center shrink-0">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-foreground truncate">{exam.title}</p>
                <Badge variant="secondary" className="text-xs">{exam.category}</Badge>
                {exam.rewardsDistributed && (
                  <Badge className="text-xs bg-green-100 text-green-700 border-green-200">✓ Rewards Sent</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ended {new Date(exam.endTime).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <div className="hidden sm:flex gap-4 text-center">
              <div>
                <p className="text-lg font-black text-foreground">{exam.totalRegistered}</p>
                <p className="text-xs text-muted-foreground">Joined</p>
              </div>
              <div>
                <p className="text-lg font-black text-green-600">{exam.totalSubmitted}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <div>
                <p className="text-lg font-black text-red-500">{exam.totalNotSubmitted}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>
            {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </div>

        {expanded && (
          <div className="border-t px-4 pb-4">
            {/* Mobile stats */}
            <div className="sm:hidden flex gap-4 py-3 text-center">
              <div className="flex-1">
                <p className="text-xl font-black">{exam.totalRegistered}</p>
                <p className="text-xs text-muted-foreground">Joined</p>
              </div>
              <div className="flex-1">
                <p className="text-xl font-black text-green-600">{exam.totalSubmitted}</p>
                <p className="text-xs text-muted-foreground">Submitted</p>
              </div>
              <div className="flex-1">
                <p className="text-xl font-black text-red-500">{exam.totalNotSubmitted}</p>
                <p className="text-xs text-muted-foreground">Absent</p>
              </div>
            </div>

            {/* Top 5 */}
            {exam.topFive.length > 0 && (
              <div className="mt-3 mb-4">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2">🏆 Top Performers</p>
                <div className="space-y-1.5">
                  {exam.topFive.map((e) => (
                    <div key={e.rank} className="flex items-center gap-2 text-sm">
                      <span className="w-6 font-black text-center">
                        {e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : e.rank === 3 ? "🥉" : `#${e.rank}`}
                      </span>
                      <span className="flex-1 font-semibold truncate">{e.name}</span>
                      <span className="text-muted-foreground text-xs">{e.email}</span>
                      <span className="font-bold text-primary w-10 text-right">{e.score}</span>
                      <span className="text-muted-foreground text-xs w-12 text-right">{fmtTime(e.timeTakenSeconds)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reward button */}
            <div className="flex justify-end mb-4">
              {exam.rewardsDistributed ? (
                <Badge className="bg-green-50 text-green-700 border-green-200 px-3 py-1.5">
                  <CheckCircle className="h-3.5 w-3.5 mr-1" /> Rewards already distributed
                </Badge>
              ) : exam.topFive.length > 0 ? (
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5"
                  onClick={() => setShowReward(true)}
                >
                  <Gift className="h-4 w-4" /> Distribute Rewards
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground italic">No submissions yet — no rewards to distribute</p>
              )}
            </div>

            {/* Participant tabs */}
            <div className="flex gap-2 mb-3">
              {(["all", "submitted", "not"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70"
                  }`}
                >
                  {tab === "all" ? `All (${exam.totalRegistered})` : tab === "submitted" ? `Submitted (${exam.totalSubmitted})` : `Absent (${exam.totalNotSubmitted})`}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {displayedParticipants.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No participants</p>
              ) : (
                displayedParticipants.map((p) => (
                  <div key={p.userId} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                    {p.submitted
                      ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      : <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                    <span className="flex-1 font-medium truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground truncate hidden sm:inline">{p.email}</span>
                    {p.submitted && (
                      <>
                        <span className="font-bold text-primary text-xs">{p.score} pts</span>
                        <span className="text-xs text-muted-foreground">{fmtTime(p.timeTakenSeconds)}</span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

export default function AdminCompletedExams() {
  const token = getAuthToken();
  const { data: exams = [], isLoading } = useQuery<CompletedExam[]>({
    queryKey: ["admin-completed-exams"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/admin/exams/completed"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Admin</Link>
          </Button>
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Completed Exams</h1>
            <p className="text-sm text-muted-foreground">{exams.length} exams · Participant breakdown & reward distribution</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-foreground">{exams.length}</p>
              <p className="text-xs text-muted-foreground font-semibold">Total Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-green-600">{exams.filter(e => e.rewardsDistributed).length}</p>
              <p className="text-xs text-muted-foreground font-semibold">Rewards Sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-amber-600">{exams.filter(e => !e.rewardsDistributed && e.topFive.length > 0).length}</p>
              <p className="text-xs text-muted-foreground font-semibold">Pending Rewards</p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : exams.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">No completed exams yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {exams.map(exam => <ExamRow key={exam.id} exam={exam} />)}
          </div>
        )}
      </div>
    </div>
  );
}
