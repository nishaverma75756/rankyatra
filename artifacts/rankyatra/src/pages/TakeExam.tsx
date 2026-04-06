import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Clock, ChevronLeft, ChevronRight, Send, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGetExam, useGetExamQuestions, useSubmitExam } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import type { Question } from "@workspace/api-client-react";

const OPTIONS = ["a", "b", "c", "d"] as const;
type Option = typeof OPTIONS[number];

export default function TakeExam() {
  const { id } = useParams();
  const examId = parseInt(id ?? "0");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<number, Option>>({});
  const [timeLeft, setTimeLeft] = useState(20 * 60);
  const [showSubmit, setShowSubmit] = useState(false);
  const startTimeRef = useRef(Date.now());

  const { data: exam } = useGetExam(examId);
  const { data: questionsRaw = [], isLoading } = useGetExamQuestions(examId);
  const questions: Question[] = questionsRaw as Question[];

  const { mutate: submitExam, isPending: submitting } = useSubmitExam({
    mutation: {
      onSuccess: () => {
        // Invalidate all caches so My Exams updates immediately
        queryClient.invalidateQueries();
        setLocation(`/exam/${examId}/results`);
      },
      onError: (e: any) => {
        toast({ title: "Submit Error", description: e?.response?.data?.message ?? "Failed to submit.", variant: "destructive" });
      },
    },
  });

  useEffect(() => {
    if (!exam) return;
    const end = new Date(exam.endTime).getTime();
    const updateTimer = () => {
      const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setTimeLeft(left);
      if (left === 0) doSubmit(true);
    };
    updateTimer();
    const id = setInterval(updateTimer, 1000);
    return () => clearInterval(id);
  }, [exam]);

  const doSubmit = useCallback((forced = false) => {
    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000);
    const payload = questions
      .filter((q) => answers[q.id] !== undefined)
      .map((q) => ({
        questionId: q.id,
        selectedOption: answers[q.id]!.toUpperCase() as any,
      }));
    submitExam({ examId, data: { answers: payload, timeTakenSeconds: timeTaken } });
  }, [questions, answers, examId, submitExam]);

  const handleSubmit = () => {
    const answered = Object.keys(answers).length;
    if (answered < questions.length) {
      setShowSubmit(true);
    } else {
      doSubmit();
    }
  };

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isWarning = timeLeft < 60;
  const progress = Object.keys(answers).length / Math.max(questions.length, 1) * 100;
  const q = questions[currentQ];

  const optionLabels: Record<Option, string> = {
    a: q?.optionA ?? "",
    b: q?.optionB ?? "",
    c: q?.optionC ?? "",
    d: q?.optionD ?? "",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading exam...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-50 bg-background border-b border-border px-4 py-3">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-semibold">
              Q {currentQ + 1}/{questions.length}
            </Badge>
            <span className="text-sm text-muted-foreground hidden sm:block">{exam?.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 font-mono text-xl font-black px-4 py-2 rounded-lg ${isWarning ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-foreground"}`}>
              <Clock className="h-4 w-4" />
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground"
              onClick={handleSubmit}
              disabled={submitting}
            >
              <Send className="h-4 w-4 mr-1" />
              {submitting ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-background border-b border-border px-4 py-2">
        <div className="container mx-auto max-w-4xl">
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1 h-2" />
            <span className="text-xs text-muted-foreground shrink-0">
              {Object.keys(answers).length}/{questions.length} answered
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Question navigator */}
          <div className="md:col-span-1">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-3">QUESTIONS</p>
                <div className="grid grid-cols-5 md:grid-cols-3 gap-1.5">
                  {questions.map((_, i) => (
                    <Button
                      key={i}
                      size="sm"
                      variant={i === currentQ ? "default" : answers[questions[i]?.id] ? "secondary" : "outline"}
                      className={`h-8 w-8 p-0 text-xs font-bold ${answers[questions[i]?.id] && i !== currentQ ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" : ""}`}
                      onClick={() => setCurrentQ(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
                <div className="mt-4 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-green-100 border border-green-200" />
                    <span className="text-muted-foreground">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-primary" />
                    <span className="text-muted-foreground">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded border border-border" />
                    <span className="text-muted-foreground">Not attempted</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question + options */}
          <div className="md:col-span-3 space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Badge variant="outline" className="text-xs">Question {currentQ + 1}</Badge>
                  <Badge variant="outline" className="text-xs text-primary border-primary/30">+2 marks</Badge>
                </div>
                <h2 className="text-lg font-bold text-foreground leading-relaxed">
                  {q?.questionText}
                </h2>
              </CardContent>
            </Card>

            <div className="space-y-3">
              {OPTIONS.map((opt) => {
                const isSelected = answers[q?.id] === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => {
                      if (q) setAnswers((prev) => ({ ...prev, [q.id]: opt }));
                    }}
                    className={`w-full text-left flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-150 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:border-primary/40 hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    }`}>
                      {opt.toUpperCase()}
                    </div>
                    <span className={`mt-1 font-medium ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                      {optionLabels[opt]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Nav buttons */}
            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                disabled={currentQ === 0}
                onClick={() => setCurrentQ((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              {currentQ < questions.length - 1 ? (
                <Button onClick={() => setCurrentQ((p) => p + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button className="bg-primary text-primary-foreground" onClick={handleSubmit} disabled={submitting}>
                  <Send className="h-4 w-4 mr-2" />
                  {submitting ? "Submitting..." : "Submit Exam"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit confirm dialog */}
      <AlertDialog open={showSubmit} onOpenChange={setShowSubmit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Submit with unanswered questions?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You've answered {Object.keys(answers).length} of {questions.length} questions. Unanswered questions get 0 marks.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction onClick={() => doSubmit()} className="bg-primary">Submit Anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
