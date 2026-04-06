import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrency } from "@/lib/utils";
import { Trophy, Medal, Star, Target, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

const RANK_COLORS: Record<number, { bg: string; border: string }> = {
  1: { bg: "bg-amber-50", border: "border-amber-300" },
  2: { bg: "bg-slate-50", border: "border-slate-300" },
  3: { bg: "bg-orange-50", border: "border-orange-300" },
};

type Period = "daily" | "weekly" | "alltime";
const TABS: { key: Period; label: string }[] = [
  { key: "daily", label: "Today" },
  { key: "weekly", label: "This Week" },
  { key: "alltime", label: "All Time" },
];

type LeaderboardEntry = {
  rank: number;
  userId: number;
  userName: string;
  avatarUrl?: string | null;
  totalScore: number;
  examsParticipated: number;
  totalWinnings: string;
  winCount: number;
  winRatio: number;
  isCurrentUser: boolean;
};

function useLeaderboard(period: Period) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard/global", period],
    queryFn: async () => {
      const token = localStorage.getItem("rankyatra_token");
      const url = period === "alltime"
        ? "/api/leaderboard/global"
        : `/api/leaderboard/global?period=${period}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      return res.json();
    },
    staleTime: 30_000,
  });
}

export default function Leaderboard() {
  const { user } = useAuth();
  const [activePeriod, setActivePeriod] = useState<Period>("alltime");
  const { data: entries = [], isLoading } = useLeaderboard(activePeriod);
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8 max-w-3xl">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Trophy className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">Leaderboard</h1>
              <p className="text-muted-foreground text-sm">Ranked by total prize winnings</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar pb-1">
          {TABS.map((tab) => {
            const active = activePeriod === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActivePeriod(tab.key)}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Medal className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-semibold">No rankings yet.</p>
            <p className="text-sm">Be the first to compete and win!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => {
              const rank = entry.rank;
              const isMe = entry.userId === (user as any)?.id;
              const initials = (entry.userName ?? "?")[0].toUpperCase();
              const colors = RANK_COLORS[rank];
              const winnings = parseFloat(String(entry.totalWinnings ?? 0));
              const winRatio = entry.winRatio ?? 0;

              return (
                <div
                  key={entry.userId}
                  onClick={() => setLocation(`/user/${entry.userId}`)}
                  className={`rounded-2xl border-2 overflow-hidden transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] ${
                    isMe
                      ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
                      : colors
                      ? `${colors.bg} ${colors.border}`
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center gap-3 p-4">
                    <div className="w-9 text-center font-black text-xl shrink-0">
                      {MEDALS[rank] ?? `#${rank}`}
                    </div>
                    <Avatar className="h-10 w-10 border-2 border-border shrink-0">
                      <AvatarImage src={entry.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-secondary text-secondary-foreground font-bold text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate leading-tight">
                        {entry.userName}
                        {isMe && <span className="ml-1.5 text-xs font-normal text-primary">(You)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">Rank #{rank}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-black ${winnings > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {winnings > 0 ? formatCurrency(winnings) : "₹0"}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Won</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-0 border-t border-border/50">
                    <div className="flex items-center gap-1.5 px-4 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 shrink-0">
                        <Star className="h-3 w-3 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground leading-none">{entry.totalScore}</p>
                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Points</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-x border-border/50">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-purple-100 shrink-0">
                        <Users className="h-3 w-3 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground leading-none">{entry.examsParticipated}</p>
                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Exams</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-4 py-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-100 shrink-0">
                        <Target className="h-3 w-3 text-green-600" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-foreground leading-none">{winRatio}%</p>
                        <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Win Rate</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
