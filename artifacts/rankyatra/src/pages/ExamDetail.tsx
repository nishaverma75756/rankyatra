import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { ArrowLeft, Clock, Trophy, Tag, Users, AlertCircle, CheckCircle, Play, BarChart2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Navbar } from "@/components/Navbar";
import { useGetExam, useGetRegistrationStatus, useRegisterForExam, useGetLeaderboard } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency, getExamStatus, formatTimeLeft } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import type { LeaderboardEntry } from "@workspace/api-client-react";

export default function ExamDetail() {
  const { id } = useParams();
  const examId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const hasToken = !!getAuthToken();

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const { data: exam, isLoading } = useGetExam(examId, { query: { refetchInterval: 15000 } } as any);
  const { data: regStatus, refetch: refetchReg } = useGetRegistrationStatus(examId, {
    query: { enabled: hasToken, refetchInterval: 15000 } as any,
  });
  const { data: leaderboard = [] } = useGetLeaderboard(examId) as { data: LeaderboardEntry[] };

  const { mutate: register, isPending: registering } = useRegisterForExam({
    mutation: {
      onSuccess: () => {
        refetchReg();
      },
      onError: (e: any) => {
        toast({ title: "Error", description: e?.response?.data?.message ?? "Registration failed.", variant: "destructive" });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="h-96 rounded-xl bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!exam) return null;

  const status = getExamStatus(exam.startTime, exam.endTime);
  const isRegistered = (regStatus as any)?.isRegistered ?? (regStatus as any)?.registered ?? false;
  const hasSubmitted = (regStatus as any)?.hasSubmitted ?? false;
  const canTake = isRegistered && status === "live" && !hasSubmitted;
  const walletBalance = Number((user as any)?.walletBalance ?? 0);
  const entryFee = Number(exam.entryFee);
  const hasEnoughBalance = walletBalance >= entryFee;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-6 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Exams
        </Button>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <Badge className="bg-secondary text-secondary-foreground">{exam.category}</Badge>
                {status === "live" && <Badge className="bg-green-500 text-white animate-pulse">🔴 LIVE NOW</Badge>}
                {status === "upcoming" && <Badge variant="outline" className="border-amber-300 text-amber-600">⏰ {formatTimeLeft(exam.startTime)}</Badge>}
                {status === "ended" && <Badge variant="secondary">Ended</Badge>}
                {isRegistered && <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Registered</Badge>}
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-foreground">{exam.title}</h1>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Trophy, label: "Prize Pool", value: formatCurrency(exam.prizePool), highlight: true },
                { icon: Tag, label: "Entry Fee", value: formatCurrency(exam.entryFee) },
                { icon: Clock, label: "Duration", value: "20 minutes" },
                { icon: Users, label: "10 Questions", value: "2 pts each" },
              ].map(({ icon: Icon, label, value, highlight }) => (
                <Card key={label} className={highlight ? "border-primary/30 bg-primary/5" : ""}>
                  <CardContent className="p-4 text-center">
                    <Icon className={`h-5 w-5 mx-auto mb-2 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
                    <div className={`font-bold text-lg ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Rules */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Exam Rules
                </h3>
                <ul className="space-y-3">
                  {[
                    "Pay ₹5 entry fee from your wallet to register",
                    "20-minute timer starts when the exam goes live",
                    "10 MCQ questions · 2 marks each · Total 20 marks",
                    "Highest score wins · Tie-breaker: lowest time taken",
                    "Solutions PDF released after exam ends",
                    "Prize credited to winner's wallet automatically",
                    "No negative marking",
                  ].map((rule, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Leaderboard (if ended) */}
            {status === "ended" && leaderboard.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" /> Results
                  </h3>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 10).map((entry: LeaderboardEntry, i: number) => {
                      const rank = i + 1;
                      const medals: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };
                      const isMe = entry.userId === (user as any)?.id;
                      return (
                        <div key={entry.userId} className={`flex items-center gap-3 p-3 rounded-lg ${isMe ? "bg-primary/10 border border-primary/20" : "bg-muted/40"}`}>
                          <span className="w-8 text-center font-bold">{medals[rank] ?? `#${rank}`}</span>
                          <span className="flex-1 font-semibold text-sm">{entry.userName}{isMe ? " (You)" : ""}</span>
                          <span className="text-sm font-bold">{entry.score}pts</span>
                          <span className="text-xs text-muted-foreground">{entry.timeTakenSeconds}s</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar CTA */}
          <div className="space-y-4">
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-black text-primary">{formatCurrency(exam.prizePool)}</div>
                  <div className="text-sm text-muted-foreground">Total Prize Pool</div>
                </div>
                <Separator />

                {/* ── NOT LOGGED IN ── */}
                {!hasToken ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 p-3 rounded-lg text-sm" style={{ backgroundColor: "hsl(var(--secondary) / 0.3)", color: "hsl(var(--secondary-foreground))" }}>
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>Login required to join this exam</span>
                    </div>
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-primary text-primary-foreground font-bold" onClick={() => setLocation("/login")}>
                        <Users className="h-4 w-4 mr-2" /> Login to Join
                      </Button>
                      <Button variant="outline" className="font-bold" onClick={() => setLocation("/register")}>
                        Sign Up
                      </Button>
                    </div>
                  </div>

                /* ── ENDED ── */
                ) : status === "ended" ? (
                  isRegistered && hasSubmitted ? (
                    <div className="space-y-2">
                      <Button className="w-full font-bold" style={{ backgroundColor: "hsl(var(--secondary))", color: "#fff" }} onClick={() => setLocation(`/exam/${examId}/results`)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Check Your Exam Result
                      </Button>
                      <Button className="w-full font-bold" style={{ backgroundColor: "#7c3aed", color: "#fff" }} onClick={() => setLocation(`/exam/${examId}/answer-sheet`)}>
                        <FileText className="h-4 w-4 mr-2" /> See Right Answer Sheet
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button className="w-full font-bold" variant="outline" onClick={() => setLocation(`/exam/${examId}/results`)}>
                        <BarChart2 className="h-4 w-4 mr-2" /> View Leaderboard
                      </Button>
                    </div>
                  )

                /* ── LIVE ── */
                ) : status === "live" ? (
                  isRegistered ? (
                    hasSubmitted ? (
                      <Button className="w-full font-bold" style={{ backgroundColor: "hsl(var(--secondary))", color: "#fff" }} onClick={() => setLocation(`/exam/${examId}/results`)}>
                        <CheckCircle className="h-4 w-4 mr-2" /> Check Your Exam Result
                      </Button>
                    ) : (
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold" onClick={() => setLocation(`/exam/${examId}/take`)}>
                        <Play className="h-4 w-4 mr-2" /> Start Exam Now!
                      </Button>
                    )
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-muted-foreground text-sm font-semibold">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      Registration closed — Exam is Live
                    </div>
                  )

                /* ── UPCOMING + REGISTERED ── */
                ) : isRegistered ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: "#22c55e12", borderColor: "#22c55e30" }}>
                      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-green-600">You are already joined!</p>
                        <p className="text-xs text-muted-foreground">Sit tight — exam starts soon</p>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full font-semibold text-muted-foreground" onClick={() => setLocation("/")}>
                      <Tag className="h-4 w-4 mr-2" /> Explore Other Exams
                    </Button>
                  </div>

                /* ── UPCOMING + NOT REGISTERED ── */
                ) : (
                  <div className="space-y-3">
                    {!hasEnoughBalance ? (
                      <>
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                          <span>Insufficient balance. Please add money to your wallet first.</span>
                        </div>
                        <Button className="w-full font-bold" variant="outline" onClick={() => setLocation("/wallet")}>
                          Add Money to Wallet
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          className="w-full bg-primary text-primary-foreground font-bold"
                          disabled={registering}
                          onClick={() => register({ examId })}
                        >
                          {registering ? "Registering..." : `Join for ${formatCurrency(exam.entryFee)}`}
                        </Button>
                        <div className="text-xs text-muted-foreground text-center">
                          Wallet balance: {formatCurrency((user as any)?.walletBalance ?? 0)}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-secondary text-secondary-foreground">
              <CardContent className="p-5">
                <h4 className="font-bold mb-2">Prize Distribution</h4>
                <div className="space-y-2 text-sm">
                  {[
                    { rank: "🥇 Rank 1", pct: "40%" },
                    { rank: "🥈 Rank 2", pct: "25%" },
                    { rank: "🥉 Rank 3", pct: "15%" },
                    { rank: "Rank 4-5", pct: "10% each" },
                  ].map(({ rank, pct }) => (
                    <div key={rank} className="flex justify-between">
                      <span>{rank}</span>
                      <span className="font-semibold text-primary">{pct}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
