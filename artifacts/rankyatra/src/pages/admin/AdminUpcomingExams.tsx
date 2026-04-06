import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Calendar, Users, ChevronDown, ChevronUp, Radio } from "lucide-react";

type Participant = {
  userId: number;
  name: string;
  email: string;
  joinedAt: string;
};

type UpcomingExam = {
  id: number;
  title: string;
  category: string;
  startTime: string;
  endTime: string;
  prizePool: string;
  entryFee: string;
  isLive: boolean;
  totalRegistered: number;
  participants: Participant[];
};

function ExamRow({ exam }: { exam: UpcomingExam }) {
  const [expanded, setExpanded] = useState(false);

  const startDt = new Date(exam.startTime);
  const endDt = new Date(exam.endTime);
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
    " · " +
    d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`hidden sm:flex h-10 w-10 rounded-xl items-center justify-center shrink-0 ${
            exam.isLive ? "bg-red-100" : "bg-blue-100"
          }`}>
            {exam.isLive
              ? <Radio className="h-5 w-5 text-red-600" />
              : <Calendar className="h-5 w-5 text-blue-600" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-foreground truncate">{exam.title}</p>
              <Badge variant="secondary" className="text-xs">{exam.category}</Badge>
              {exam.isLive && (
                <Badge className="text-xs bg-red-100 text-red-700 border-red-200 animate-pulse">
                  🔴 LIVE
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {exam.isLive ? `Ends ${fmt(endDt)}` : `Starts ${fmt(startDt)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-3">
          <div className="text-center">
            <p className="text-xl font-black text-foreground">{exam.totalRegistered}</p>
            <p className="text-xs text-muted-foreground">Joined</p>
          </div>
          <div className="hidden sm:block text-center">
            <p className="text-sm font-bold text-primary">₹{Number(exam.prizePool).toLocaleString("en-IN")}</p>
            <p className="text-xs text-muted-foreground">Prize Pool</p>
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4">
          {/* Exam details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-3 mb-3">
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-sm font-black text-foreground">₹{exam.entryFee}</p>
              <p className="text-xs text-muted-foreground">Entry Fee</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-sm font-black text-primary">₹{Number(exam.prizePool).toLocaleString("en-IN")}</p>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-sm font-black text-foreground">{fmt(startDt)}</p>
              <p className="text-xs text-muted-foreground">Start</p>
            </div>
            <div className="bg-muted/40 rounded-lg p-2.5 text-center">
              <p className="text-sm font-black text-foreground">{fmt(endDt)}</p>
              <p className="text-xs text-muted-foreground">End</p>
            </div>
          </div>

          <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-2">
            Registered Participants ({exam.totalRegistered})
          </p>
          {exam.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 italic">No one has joined yet</p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {exam.participants.map((p, idx) => (
                <div key={p.userId} className="flex items-center gap-3 py-1.5 border-b last:border-0 text-sm">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{idx + 1}</span>
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{p.name[0]?.toUpperCase()}</span>
                  </div>
                  <span className="flex-1 font-medium truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[160px]">{p.email}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(p.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function AdminUpcomingExams() {
  const token = getAuthToken();
  const { data: exams = [], isLoading } = useQuery<UpcomingExam[]>({
    queryKey: ["admin-upcoming-exams"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/admin/exams/upcoming"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    refetchInterval: 15000,
  });

  const liveExams = exams.filter(e => e.isLive);
  const upcomingOnly = exams.filter(e => !e.isLive);
  const totalJoined = exams.reduce((s, e) => s + e.totalRegistered, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Admin</Link>
          </Button>
          <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">Upcoming Exams</h1>
            <p className="text-sm text-muted-foreground">{exams.length} exams · {totalJoined} total registrations</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-red-600">{liveExams.length}</p>
              <p className="text-xs text-muted-foreground font-semibold">Live Now</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-blue-600">{upcomingOnly.length}</p>
              <p className="text-xs text-muted-foreground font-semibold">Upcoming</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-black text-foreground">{totalJoined}</p>
              <p className="text-xs text-muted-foreground font-semibold">Total Joined</p>
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
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-semibold text-muted-foreground">No upcoming exams scheduled</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {liveExams.length > 0 && (
              <>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">🔴 Live Now</p>
                {liveExams.map(e => <ExamRow key={e.id} exam={e} />)}
              </>
            )}
            {upcomingOnly.length > 0 && (
              <>
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mt-4">📅 Upcoming</p>
                {upcomingOnly.map(e => <ExamRow key={e.id} exam={e} />)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
