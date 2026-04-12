import { useCallback, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Bookmark, RefreshCw, Radio, Clock, Archive,
  BarChart2, Play, LogIn, Gift, ChevronRight, Users,
} from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { ExamCard } from "@/components/ExamCard";
import { useGetMyRegistrations, useListExams } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import type { Exam } from "@workspace/api-client-react";

type Tab = "upcoming" | "completed";

function getExamStatus(exam: Exam): "live" | "upcoming" | "ended" {
  const now = Date.now();
  const start = new Date((exam as any).startTime ?? (exam as any).start_time).getTime();
  const end = new Date((exam as any).endTime ?? (exam as any).end_time).getTime();
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "ended";
}

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<Tab>("upcoming");

  const { data: examsData, isLoading: examsLoading, refetch: refetchExams, isRefetching } = useListExams({});
  const { data: regsData, isLoading: regsLoading, refetch: refetchRegs } = useGetMyRegistrations();

  // Auto-refresh every 30 seconds so completed exams appear without manual refresh
  useEffect(() => {
    const interval = setInterval(() => {
      refetchExams();
      refetchRegs();
    }, 30000);
    return () => clearInterval(interval);
  }, [refetchExams, refetchRegs]);

  const onRefresh = useCallback(() => {
    refetchExams();
    refetchRegs();
  }, [refetchExams, refetchRegs]);

  const allExams: Exam[] = (examsData ?? []) as Exam[];

  const registeredExamIds = new Set(
    (regsData ?? []).map((r: any) => r.examId ?? r.exam_id)
  );

  const submittedExamIds = new Set(
    (regsData ?? [])
      .filter((r: any) => r.hasSubmitted)
      .map((r: any) => r.examId ?? r.exam_id)
  );

  const myExams = allExams.filter((e) => registeredExamIds.has(e.id));

  const getEndMs = (e: Exam) => new Date((e as any).endTime ?? (e as any).end_time ?? 0).getTime();

  // Completed = exam ended OR user has submitted (even if exam still live) — most recent first
  const completedTabExams = myExams
    .filter((e) => getExamStatus(e) === "ended" || submittedExamIds.has(e.id))
    .sort((a, b) => getEndMs(b) - getEndMs(a));
  // Upcoming = not ended AND not yet submitted
  const notCompletedExams = myExams.filter(
    (e) => getExamStatus(e) !== "ended" && !submittedExamIds.has(e.id)
  );
  const liveExams = notCompletedExams.filter((e) => getExamStatus(e) === "live");
  const upcomingExams = notCompletedExams.filter((e) => getExamStatus(e) === "upcoming");
  const upcomingTabExams = [...liveExams, ...upcomingExams];

  const isLoading = examsLoading || regsLoading;

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-4">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bookmark className="h-10 w-10 text-primary" />
          </div>
          <h2 className="text-2xl font-black text-foreground">My Exams</h2>
          <p className="text-muted-foreground text-center max-w-xs">
            Sign in to see your registered exams and track your upcoming contests.
          </p>
          <Button className="w-full max-w-xs gap-2" asChild>
            <Link href="/login"><LogIn className="h-4 w-4" /> Sign In</Link>
          </Button>
          <Button variant="outline" className="w-full max-w-xs" asChild>
            <Link href="/signup">Create Account</Link>
          </Button>
          <button onClick={() => setLocation("/")} className="text-sm text-muted-foreground font-semibold hover:text-foreground transition-colors mt-1">
            Browse Exams →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 max-w-2xl pb-24">

        {/* Refer & Earn Card */}
        <Link href="/referral">
          <div className="mt-5 mb-4 rounded-2xl p-4 flex items-center gap-3 cursor-pointer hover:opacity-90 transition-opacity" style={{ background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" }}>
            <div className="p-2.5 bg-white/20 rounded-xl shrink-0">
              <Gift className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-base">Refer & Earn ₹20!</p>
              <p className="text-xs text-white/80">Refer a friend and both of you get a ₹20 bonus 🎉</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/70 shrink-0" />
          </div>
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-1">
          <h1 className="text-2xl font-black text-foreground tracking-tight">My Exams</h1>
          {myExams.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-xl text-sm font-black" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
              {myExams.length}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={isRefetching}
            className="ml-auto p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 px-1 py-3 mr-7 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "upcoming"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock className="h-4 w-4" />
            My Upcoming
            {upcomingTabExams.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === "upcoming" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {upcomingTabExams.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("completed")}
            className={`flex items-center gap-2 px-1 py-3 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-4 w-4" />
            Completed
            {completedTabExams.length > 0 && (
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-black ${
                activeTab === "completed" ? "bg-primary text-white" : "bg-muted text-muted-foreground"
              }`}>
                {completedTabExams.length}
              </span>
            )}
          </button>
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>

        /* No exams joined at all */
        ) : myExams.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-4">
            <div className="h-18 w-18 rounded-2xl bg-muted flex items-center justify-center p-4">
              <Bookmark className="h-9 w-9 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-black text-foreground mt-2">No Exams Joined Yet</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Browse exams and pay ₹5 to join and compete for cash prizes
            </p>
            <Button className="mt-2" asChild>
              <Link href="/">Browse Exams</Link>
            </Button>
          </div>

        /* Upcoming Tab */
        ) : activeTab === "upcoming" ? (
          upcomingTabExams.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-20 text-center px-4">
              <div className="h-18 w-18 rounded-2xl bg-muted flex items-center justify-center p-4">
                <Clock className="h-9 w-9 text-muted-foreground opacity-50" />
              </div>
              <h3 className="text-lg font-black text-foreground mt-2">No Upcoming Exams</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                You have no live or upcoming exams right now
              </p>
              <Button className="mt-2" asChild>
                <Link href="/">Browse Exams</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 🔴 Live Now */}
              {liveExams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse inline-block" />
                    <h2 className="text-base font-black text-red-500">Live Now</h2>
                  </div>
                  <div className="space-y-3">
                    {liveExams.map((exam) => {
                      const alreadySubmitted = submittedExamIds.has(exam.id);
                      return (
                        <div
                          key={exam.id}
                          onClick={() =>
                            setLocation(alreadySubmitted ? `/exam/${exam.id}/results` : `/exam/${exam.id}/take`)
                          }
                          className="rounded-2xl border-2 p-5 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                          style={{
                            backgroundColor: alreadySubmitted ? "#22c55e10" : "#ef444410",
                            borderColor: alreadySubmitted ? "#22c55e40" : "#ef444440",
                          }}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full inline-block"
                              style={{ backgroundColor: alreadySubmitted ? "#22c55e" : "#ef4444", animation: alreadySubmitted ? "none" : "pulse 1.5s infinite" }}
                            />
                            <span className="text-xs font-black tracking-widest" style={{ color: alreadySubmitted ? "#22c55e" : "#ef4444" }}>
                              {alreadySubmitted ? "SUBMITTED" : "LIVE"}
                            </span>
                          </div>
                          <h3 className="text-lg font-black text-foreground leading-tight mb-1">{exam.title}</h3>
                          <p className="text-xs text-muted-foreground mb-1 font-medium">
                            Ends: {new Date((exam as any).endTime ?? (exam as any).end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {new Date((exam as any).endTime ?? (exam as any).end_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-sm text-muted-foreground mb-4">
                            {alreadySubmitted ? "You have submitted this exam" : "Tap to start — exam is live now!"}
                          </p>
                          <div
                            className="flex items-center justify-center gap-2 rounded-xl py-3.5 font-black text-white text-sm"
                            style={{ backgroundColor: alreadySubmitted ? "#22c55e" : "#ef4444" }}
                          >
                            {alreadySubmitted
                              ? <><BarChart2 className="h-4 w-4" /> Check Your Result</>
                              : <><Play className="h-4 w-4" /> Start Exam Now</>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upcoming */}
              {upcomingExams.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-4 w-4 text-amber-500" />
                    <h2 className="text-base font-black text-foreground">Upcoming</h2>
                  </div>
                  <div className="space-y-3">
                    {upcomingExams.map((exam) => (
                      <ExamCard key={exam.id} exam={exam} isRegistered />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )

        /* Completed Tab */
        ) : completedTabExams.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-4">
            <div className="h-18 w-18 rounded-2xl bg-muted flex items-center justify-center p-4">
              <Archive className="h-9 w-9 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-lg font-black text-foreground mt-2">No Completed Exams</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Exams you've taken will appear here with your results
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Archive className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-black text-foreground">Completed Exams</h2>
            </div>
            <div className="space-y-3">
              {completedTabExams.map((exam) => (
                <ExamCard key={exam.id} exam={exam} isRegistered hasSubmitted={submittedExamIds.has(exam.id)} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
