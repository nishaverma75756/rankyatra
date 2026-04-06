import { useQuery } from "@tanstack/react-query";
import { customFetch } from "./custom-fetch";

export interface MyStats {
  examsParticipated: number;
  examsCompleted: number;
  examsWon: number;
  podiumFinishes: number;
  highestRank: number | null;
  totalCorrect: number;
  totalQuestions: number;
  accuracyPercent: number;
  avgScore: number;
  avgTimeTakenSeconds: number;
  totalWinnings: number;
  skillLevel: string;
  skillIcon: string;
  categoryBreakdown: Array<{ category: string; count: number; accuracy: number }>;
  recentResults: Array<{
    examId: number;
    examTitle: string;
    category: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    rank: number | null;
    timeTakenSeconds: number;
    submittedAt: string;
  }>;
}

export function useGetMyStats() {
  return useQuery<MyStats>({
    queryKey: ["me", "stats"],
    queryFn: () => customFetch<MyStats>("/api/me/stats"),
    staleTime: 30_000,
  });
}
