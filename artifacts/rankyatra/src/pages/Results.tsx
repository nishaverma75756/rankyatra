import { useParams, Link, useLocation } from "wouter";
import { Trophy, Home, BarChart2, Clock, CheckCircle, XCircle, MinusCircle, FileText, Award } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useGetLeaderboard, useGetExam, useGetRegistrationStatus, useGetMyResult } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import type { LeaderboardEntry } from "@workspace/api-client-react";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

function formatTime(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function getRankEmoji(rank: number | null) {
  if (!rank) return "—";
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function Results() {
  const { id } = useParams();
  const examId = parseInt(id ?? "0");
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: exam } = useGetExam(examId);
  const { data: entries = [], isLoading } = useGetLeaderboard(examId) as { data: LeaderboardEntry[]; isLoading: boolean };
  const { data: regStatus } = useGetRegistrationStatus(examId, { query: { enabled: !!user } } as any);
  const { data: myResult } = useGetMyResult(examId, { query: { retry: false, enabled: !!user } } as any);

  const hasSubmitted = (regStatus as any)?.hasSubmitted ?? false;
  const isRegistered = (regStatus as any)?.isRegistered ?? (regStatus as any)?.registered ?? false;

  const result = myResult as any;
  const correct = result?.correctAnswers ?? 0;
  const total = result?.totalQuestions ?? 0;
  const wrong = result?.wrongAnswers ?? (total - correct);
  const skipped = result?.skippedAnswers ?? 0;
  const timeTaken = result?.timeTakenSeconds ?? 0;
  const score = result?.score ?? 0;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  const myEntry = (entries as LeaderboardEntry[]).find((e) => e.userId === (user as any)?.id);
  const myRank = myEntry ? (entries as LeaderboardEntry[]).indexOf(myEntry) + 1 : (result?.rank ?? null);

  const pctColor = pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : pct >= 40 ? "#f97316" : "#ef4444";
  const pctLabel = pct >= 80 ? "Excellent! 🎉" : pct >= 60 ? "Good Job! 👍" : pct >= 40 ? "Keep Practicing! 📚" : "Better Luck Next Time 💪";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Back nav */}
        <div className="flex gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <Home className="h-4 w-4 mr-1" /> Dashboard
            </Link>
          </Button>
        </div>

        {/* Exam title */}
        <h1 className="text-2xl font-black text-foreground mb-6">{exam?.title}</h1>

        {/* ── Personal Result Card ── */}
        {hasSubmitted && result ? (
          <div
            className="rounded-2xl p-6 mb-6 text-white"
            style={{ background: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs font-bold tracking-widest opacity-60 mb-1">EXAM COMPLETE</p>
                <p className="text-xl font-black">{pctLabel}</p>
              </div>
              <div className="bg-white/10 rounded-full px-4 py-3 text-center min-w-[64px]">
                <p className="text-3xl leading-none">{getRankEmoji(myRank)}</p>
                {myRank && myRank > 3 && (
                  <p className="text-xs opacity-60 mt-1">Rank</p>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/20 overflow-hidden mb-1">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: pctColor }}
              />
            </div>
            <p className="text-xs text-white/60 text-right mb-4">{pct}% accuracy</p>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-500/20 rounded-xl p-3 flex flex-col items-center gap-1">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <p className="text-2xl font-black text-green-400">{correct}</p>
                <p className="text-xs text-white/60 font-semibold">Correct</p>
              </div>
              <div className="bg-red-500/20 rounded-xl p-3 flex flex-col items-center gap-1">
                <XCircle className="h-5 w-5 text-red-400" />
                <p className="text-2xl font-black text-red-400">{wrong}</p>
                <p className="text-xs text-white/60 font-semibold">Wrong</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center gap-1">
                <MinusCircle className="h-5 w-5 text-white/50" />
                <p className="text-2xl font-black text-white">{skipped}</p>
                <p className="text-xs text-white/60 font-semibold">Skipped</p>
              </div>
            </div>

            {/* Bottom row */}
            <div className="flex items-center justify-around border-t border-white/10 pt-4">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-amber-400" />
                  <p className="font-black text-amber-400">{score}/{total} pts</p>
                </div>
                <p className="text-xs text-white/60 font-semibold">Score</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <p className="font-black">{formatTime(timeTaken)}</p>
                </div>
                <p className="text-xs text-white/60 font-semibold">Time Taken</p>
              </div>
              <div className="w-px h-10 bg-white/10" />
              <div className="flex flex-col items-center gap-1">
                <p className="font-black text-lg">{myRank ? `#${myRank}` : "—"}</p>
                <p className="text-xs text-white/60 font-semibold">Your Rank</p>
              </div>
            </div>
          </div>
        ) : isRegistered && !hasSubmitted ? (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart2 className="h-5 w-5 text-amber-600" />
              <p className="text-sm font-semibold text-amber-700">You did not submit this exam</p>
            </CardContent>
          </Card>
        ) : !isRegistered ? (
          <Card className="mb-6">
            <CardContent className="p-4 flex items-center gap-3">
              <BarChart2 className="h-5 w-5 text-muted-foreground" />
              <p className="text-sm font-semibold text-muted-foreground">You were not registered for this exam</p>
            </CardContent>
          </Card>
        ) : null}

        {/* ── Check Answer Sheet Button ── */}
        {hasSubmitted && (
          <Button
            className="w-full mb-6 font-bold text-base py-6"
            style={{ backgroundColor: "#7c3aed", color: "#fff" }}
            onClick={() => setLocation(`/exam/${examId}/answer-sheet`)}
          >
            <FileText className="h-5 w-5 mr-2" />
            Check Answer Sheet
          </Button>
        )}

        {/* ── Leaderboard ── */}
        <h2 className="text-lg font-bold mb-4">All Participants ({(entries as LeaderboardEntry[]).length})</h2>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (entries as LeaderboardEntry[]).length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No submissions yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(entries as LeaderboardEntry[]).map((entry: LeaderboardEntry, i: number) => {
              const rank = i + 1;
              const isMe = entry.userId === (user as any)?.id;
              const init = (entry.userName ?? "?")[0].toUpperCase();
              const isWinner = rank === 1;
              return (
                <Card
                  key={entry.userId}
                  onClick={() => setLocation(`/user/${entry.userId}`)}
                  className={`cursor-pointer hover:shadow-md transition-shadow ${isMe ? "border-2 border-purple-400/50 bg-purple-50" : ""} ${isWinner ? "border-amber-300 bg-amber-50" : ""}`}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 text-center font-black text-lg">
                      {MEDALS[rank] ?? `#${rank}`}
                    </div>
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={entry.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-sm">
                        {init}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{entry.userName}</p>
                        {isMe && (
                          <Badge className="text-[9px] px-1.5 py-0 bg-purple-500 text-white font-bold">YOU</Badge>
                        )}
                        {isWinner && (
                          <span className="text-xs font-bold text-amber-600">🏆 Winner</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className={`font-black ${isWinner ? "text-amber-600" : "text-foreground"}`}>{entry.score}</div>
                        <div className="text-xs text-muted-foreground">pts</div>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTime(entry.timeTakenSeconds ?? 0)}
                        </div>
                        <div className="text-xs text-muted-foreground">time</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Back to home */}
        <Button variant="outline" className="w-full mt-6 font-semibold" asChild>
          <Link href="/dashboard">
            <Home className="h-4 w-4 mr-2" /> Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
