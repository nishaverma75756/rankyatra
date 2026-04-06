import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle, XCircle, MinusCircle, Award, Clock } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";

type AnswerQuestion = {
  index: number;
  id: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  explanationA: string | null;
  explanationB: string | null;
  explanationC: string | null;
  explanationD: string | null;
  selectedOption: string | null;
  isCorrect: boolean;
  isSkipped: boolean;
};

type AnswerSheet = {
  exam: { id: number; title: string; category: string };
  submission: {
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    rank: number | null;
    timeTakenSeconds: number;
  } | null;
  questions: AnswerQuestion[];
};

type Filter = "all" | "correct" | "wrong" | "skipped";

function getOptionText(q: AnswerQuestion, opt: string): string {
  if (opt === "A") return q.optionA;
  if (opt === "B") return q.optionB;
  if (opt === "C") return q.optionC;
  return q.optionD;
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export default function AnswerSheet() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const token = getAuthToken();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, error } = useQuery<AnswerSheet>({
    queryKey: ["answer-sheet", id],
    queryFn: async () => {
      const r = await fetch(getApiUrl(`/api/exams/${id}/answer-sheet`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to load");
      }
      return r.json();
    },
    enabled: !!id && !!token,
  });

  const correctCount = data?.questions.filter((q) => q.isCorrect).length ?? 0;
  const wrongCount = data?.questions.filter((q) => !q.isCorrect && !q.isSkipped).length ?? 0;
  const skippedCount = data?.questions.filter((q) => q.isSkipped).length ?? 0;
  const total = data?.questions.length ?? 0;
  const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const filteredQs = data?.questions.filter((q) => {
    if (filter === "correct") return q.isCorrect;
    if (filter === "wrong") return !q.isCorrect && !q.isSkipped;
    if (filter === "skipped") return q.isSkipped;
    return true;
  }) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 max-w-2xl pb-16 pt-5">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/exam/${id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-foreground">Answer Sheet</h1>
            {data && (
              <p className="text-sm text-muted-foreground truncate">{data.exam.title}</p>
            )}
          </div>
          {data?.exam.category && (
            <Badge variant="secondary">{data.exam.category}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground font-semibold">Loading answer sheet…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <XCircle className="h-12 w-12 text-destructive" />
            <h3 className="text-lg font-black text-foreground">{(error as Error).message}</h3>
            <Button onClick={() => setLocation(`/exam/${id}`)}>Go Back</Button>
          </div>
        ) : data ? (
          <>
            {/* Score Summary Card — click to filter */}
            <div className="rounded-2xl border mb-6 overflow-hidden" style={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))" }}>
              <div className="grid grid-cols-5 divide-x divide-border">
                {/* All */}
                <button
                  onClick={() => setFilter("all")}
                  className={`flex flex-col items-center gap-1 py-4 px-2 transition-all cursor-pointer hover:bg-primary/5 ${filter === "all" ? "bg-primary/10 ring-2 ring-inset ring-primary" : ""}`}
                >
                  <p className="text-2xl font-black text-primary">{total}</p>
                  <p className={`text-xs font-bold ${filter === "all" ? "text-primary" : "text-muted-foreground"}`}>All</p>
                </button>
                {/* Correct */}
                <button
                  onClick={() => setFilter("correct")}
                  className={`flex flex-col items-center gap-1 py-4 px-2 transition-all cursor-pointer hover:bg-green-500/5 ${filter === "correct" ? "bg-green-500/10 ring-2 ring-inset ring-green-500" : ""}`}
                >
                  <p className="text-2xl font-black text-green-500">{correctCount}</p>
                  <p className={`text-xs font-bold ${filter === "correct" ? "text-green-600" : "text-muted-foreground"}`}>Correct</p>
                </button>
                {/* Wrong */}
                <button
                  onClick={() => setFilter("wrong")}
                  className={`flex flex-col items-center gap-1 py-4 px-2 transition-all cursor-pointer hover:bg-red-500/5 ${filter === "wrong" ? "bg-red-500/10 ring-2 ring-inset ring-red-500" : ""}`}
                >
                  <p className="text-2xl font-black text-red-500">{wrongCount}</p>
                  <p className={`text-xs font-bold ${filter === "wrong" ? "text-red-600" : "text-muted-foreground"}`}>Wrong</p>
                </button>
                {/* Skipped */}
                <button
                  onClick={() => setFilter("skipped")}
                  className={`flex flex-col items-center gap-1 py-4 px-2 transition-all cursor-pointer hover:bg-gray-500/5 ${filter === "skipped" ? "bg-gray-500/10 ring-2 ring-inset ring-gray-400" : ""}`}
                >
                  <p className="text-2xl font-black text-gray-400">{skippedCount}</p>
                  <p className={`text-xs font-bold ${filter === "skipped" ? "text-gray-500" : "text-muted-foreground"}`}>Skipped</p>
                </button>
                {/* Accuracy — not clickable */}
                <div className="flex flex-col items-center gap-1 py-4 px-2">
                  <p className={`text-2xl font-black ${accuracy >= 60 ? "text-green-500" : accuracy >= 40 ? "text-amber-500" : "text-red-500"}`}>{accuracy}%</p>
                  <p className="text-xs font-bold text-muted-foreground">Accuracy</p>
                </div>
              </div>

              {data.submission && (
                <div className="flex items-center gap-4 px-5 py-3 border-t border-border">
                  {data.submission.rank && (
                    <div className="flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-foreground">Rank <span className="text-primary font-black">#{data.submission.rank}</span></span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground font-semibold">{fmtTime(data.submission.timeTakenSeconds)}</span>
                  </div>
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Tap stats above to filter</span>
                  </div>
                </div>
              )}
            </div>


            {/* Questions */}
            {filteredQs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-semibold">
                No questions in this filter
              </div>
            ) : (
              <div className="space-y-4">
                {filteredQs.map((q) => (
                  <div
                    key={q.id}
                    className="rounded-2xl border-2 p-5"
                    style={{
                      borderColor: q.isCorrect ? "#22c55e40" : q.isSkipped ? "hsl(var(--border))" : "#ef444440",
                      backgroundColor: q.isCorrect ? "#22c55e06" : q.isSkipped ? "transparent" : "#ef444406",
                    }}
                  >
                    {/* Q Header */}
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-xs font-black px-2 py-1 rounded-lg text-white"
                        style={{ backgroundColor: q.isCorrect ? "#22c55e" : q.isSkipped ? "#9ca3af" : "#ef4444" }}
                      >
                        Q{q.index}
                      </span>
                      <span
                        className="text-xs font-black px-2 py-1 rounded-lg"
                        style={{
                          backgroundColor: q.isCorrect ? "#22c55e15" : q.isSkipped ? "#9ca3af15" : "#ef444415",
                          color: q.isCorrect ? "#22c55e" : q.isSkipped ? "#9ca3af" : "#ef4444",
                        }}
                      >
                        {q.isCorrect ? "CORRECT" : q.isSkipped ? "SKIPPED" : "WRONG"}
                      </span>
                    </div>

                    {/* Question Text */}
                    <p className="text-sm font-bold text-foreground mb-3 leading-relaxed">{q.questionText}</p>

                    {/* Options with per-option explanations */}
                    <div className="space-y-2">
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const text = getOptionText(q, opt);
                        const isCorrect = q.correctOption === opt;
                        const isSelected = q.selectedOption === opt;
                        const isWrong = isSelected && !isCorrect;
                        const expKey = `explanation${opt}` as keyof typeof q;
                        const explanation = q[expKey] as string | null;

                        return (
                          <div key={opt} className="space-y-0">
                            <div
                              className="flex items-start gap-2.5 p-2.5 rounded-xl border"
                              style={{
                                backgroundColor: isCorrect ? "#22c55e12" : isWrong ? "#ef444412" : "transparent",
                                borderColor: isCorrect ? "#22c55e60" : isWrong ? "#ef444460" : "hsl(var(--border))",
                                borderBottomLeftRadius: explanation ? "0" : undefined,
                                borderBottomRightRadius: explanation ? "0" : undefined,
                                borderBottom: explanation ? "none" : undefined,
                              }}
                            >
                              <span
                                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-black"
                                style={{
                                  backgroundColor: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : "hsl(var(--muted))",
                                  color: (isCorrect || isWrong) ? "#fff" : "hsl(var(--muted-foreground))",
                                }}
                              >
                                {opt}
                              </span>
                              <span
                                className="text-sm flex-1"
                                style={{
                                  color: isCorrect ? "#22c55e" : isWrong ? "#ef4444" : "hsl(var(--foreground))",
                                  fontWeight: isCorrect ? 700 : 500,
                                }}
                              >
                                {text}
                              </span>
                              {isCorrect && <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />}
                              {isWrong && <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />}
                            </div>
                            {explanation && (
                              <div
                                className="px-3 py-2 rounded-b-xl text-xs leading-relaxed border border-t-0"
                                style={{
                                  backgroundColor: isCorrect ? "#f0fdf4" : isWrong ? "#fef2f2" : "#f8fafc",
                                  borderColor: isCorrect ? "#22c55e60" : isWrong ? "#ef444460" : "hsl(var(--border))",
                                  color: isCorrect ? "#16a34a" : isWrong ? "#dc2626" : "hsl(var(--muted-foreground))",
                                }}
                              >
                                💡 {explanation}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Correct answer hint for wrong/skipped (when no explanation given) */}
                    {!q.isCorrect && !q.explanationA && !q.explanationB && !q.explanationC && !q.explanationD && (
                      <div className="mt-3 flex items-start gap-2 p-2.5 rounded-xl" style={{ backgroundColor: "#22c55e10", borderColor: "#22c55e30" }}>
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <p className="text-xs font-bold text-green-600">
                          Correct Answer: ({q.correctOption}) {getOptionText(q, q.correctOption)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
