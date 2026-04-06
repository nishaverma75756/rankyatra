import { useState } from "react";
import { useParams, Link } from "wouter";
import { ArrowLeft, Plus, Edit2, Trash2, CheckCircle, Circle } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  useGetExam,
  useGetExamQuestions,
  useAddQuestion,
  useUpdateQuestion,
  useDeleteQuestion,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getExamStatus, formatCurrency } from "@/lib/utils";

type CorrectOption = "A" | "B" | "C" | "D";

const EMPTY_FORM = {
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A" as CorrectOption,
  explanationA: "",
  explanationB: "",
  explanationC: "",
  explanationD: "",
};

const OPTION_LABELS: CorrectOption[] = ["A", "B", "C", "D"];
const OPTION_COLORS: Record<CorrectOption, string> = {
  A: "bg-blue-50 border-blue-200 text-blue-700",
  B: "bg-purple-50 border-purple-200 text-purple-700",
  C: "bg-orange-50 border-orange-200 text-orange-700",
  D: "bg-teal-50 border-teal-200 text-teal-700",
};

export default function AdminExamDetail() {
  const { id } = useParams();
  const examId = parseInt(id ?? "0");
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editQuestion, setEditQuestion] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: exam } = useGetExam(examId);
  const { data: questions = [], refetch } = useGetExamQuestions(examId) as { data: any[]; refetch: () => void };

  const { mutate: addQuestion, isPending: adding } = useAddQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question added!" });
        setDialogOpen(false);
        setForm(EMPTY_FORM);
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Failed to add question", variant: "destructive" }),
    },
  });

  const { mutate: updateQuestion, isPending: updating } = useUpdateQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question updated!" });
        setDialogOpen(false);
        setEditQuestion(null);
        setForm(EMPTY_FORM);
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Failed to update", variant: "destructive" }),
    },
  });

  const { mutate: deleteQuestion } = useDeleteQuestion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Question deleted." });
        setDeleteId(null);
        refetch();
      },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });

  const openAdd = () => {
    setEditQuestion(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (q: any) => {
    setEditQuestion(q);
    setForm({
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: (q.correctOption ?? "A").toUpperCase() as CorrectOption,
      explanationA: q.explanationA ?? "",
      explanationB: q.explanationB ?? "",
      explanationC: q.explanationC ?? "",
      explanationD: q.explanationD ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.questionText.trim() || !form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) {
      toast({ title: "All fields required", description: "Fill in the question and all 4 options.", variant: "destructive" });
      return;
    }
    const data = {
      questionText: form.questionText,
      optionA: form.optionA,
      optionB: form.optionB,
      optionC: form.optionC,
      optionD: form.optionD,
      correctOption: form.correctOption as any,
      explanationA: form.explanationA.trim() || undefined,
      explanationB: form.explanationB.trim() || undefined,
      explanationC: form.explanationC.trim() || undefined,
      explanationD: form.explanationD.trim() || undefined,
      orderIndex: editQuestion ? editQuestion.orderIndex : questions.length + 1,
    };
    if (editQuestion) {
      updateQuestion({ examId, questionId: editQuestion.id, data });
    } else {
      addQuestion({ examId, data });
    }
  };

  const examStatus = exam ? getExamStatus((exam as any).startTime, (exam as any).endTime) : null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/exams"><ArrowLeft className="h-4 w-4 mr-1" /> Exams</Link>
            </Button>
            <div>
              <h1 className="text-2xl font-black text-foreground">{(exam as any)?.title ?? "Exam Questions"}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                {(exam as any)?.category && <Badge variant="secondary" className="text-xs">{(exam as any).category}</Badge>}
                {examStatus === "live" && <Badge className="bg-green-500 text-white text-xs animate-pulse">🔴 LIVE</Badge>}
                {examStatus === "upcoming" && <Badge variant="outline" className="text-xs">Upcoming</Badge>}
                {examStatus === "ended" && <Badge variant="secondary" className="text-xs">Completed</Badge>}
                <span className="text-xs text-muted-foreground">{questions.length} questions</span>
              </div>
            </div>
          </div>
          <Button onClick={openAdd} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </div>

        {/* Exam info strip */}
        {exam && (
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="font-bold text-sm">{formatCurrency((exam as any).entryFee)}</p>
              <p className="text-xs text-muted-foreground">Entry Fee</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="font-bold text-sm text-primary">{formatCurrency((exam as any).prizePool)}</p>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="font-bold text-sm">{(exam as any).registeredCount ?? 0}</p>
              <p className="text-xs text-muted-foreground">Registered</p>
            </div>
          </div>
        )}

        {/* Questions list */}
        {questions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <p className="text-muted-foreground font-medium">No questions yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Click "Add Question" to create the first one.</p>
              <Button className="mt-4" onClick={openAdd}>
                <Plus className="h-4 w-4 mr-2" /> Add First Question
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((q: any, idx: number) => (
              <Card key={q.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="h-6 w-6 rounded-full bg-secondary text-secondary-foreground text-xs font-black flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <p className="font-semibold text-sm leading-relaxed">{q.questionText}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {OPTION_LABELS.map((opt) => {
                          const isCorrect = (q.correctOption ?? "").toUpperCase() === opt;
                          const text = q[`option${opt}`];
                          return (
                            <div
                              key={opt}
                              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${isCorrect ? "bg-green-50 border-green-300 text-green-800" : "bg-muted/40 border-border text-muted-foreground"}`}
                            >
                              {isCorrect
                                ? <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                : <Circle className="h-3.5 w-3.5 shrink-0 opacity-40" />
                              }
                              <span className="font-bold mr-0.5">{opt}.</span> {text}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(q)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80"
                        onClick={() => setDeleteId(q.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Question Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) { setDialogOpen(false); setEditQuestion(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editQuestion ? "Edit Question" : "Add New Question"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Question Text <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Enter the question..."
                rows={3}
                value={form.questionText}
                onChange={(e) => setForm({ ...form, questionText: e.target.value })}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Answer Options <span className="text-destructive">*</span></Label>
              <p className="text-xs text-muted-foreground -mt-1">Click the option letter to mark it as correct. Add explanation below each option (optional).</p>
              <div className="space-y-3">
                {OPTION_LABELS.map((opt) => {
                  const fieldKey = `option${opt}` as keyof typeof form;
                  const expKey = `explanation${opt}` as keyof typeof form;
                  const isCorrect = form.correctOption === opt;
                  return (
                    <div key={opt} className={`rounded-xl border p-3 space-y-2 transition-colors ${isCorrect ? "border-green-300 bg-green-50/50" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, correctOption: opt })}
                          className={`h-8 w-8 rounded-full border-2 text-xs font-black flex items-center justify-center shrink-0 transition-all ${
                            isCorrect
                              ? "bg-green-500 border-green-500 text-white shadow-md"
                              : "border-border text-muted-foreground hover:border-green-400 hover:text-green-600"
                          }`}
                          title={`Mark ${opt} as correct`}
                        >
                          {opt}
                        </button>
                        <Input
                          placeholder={`Option ${opt}...`}
                          value={form[fieldKey] as string}
                          onChange={(e) => setForm({ ...form, [fieldKey]: e.target.value })}
                          className={`flex-1 ${isCorrect ? "border-green-300 bg-white" : ""}`}
                        />
                        {isCorrect && (
                          <span className="text-xs text-green-600 font-bold whitespace-nowrap">✓ Sahi</span>
                        )}
                      </div>
                      <Textarea
                        placeholder={isCorrect ? `Ye option sahi kyun hai? Samjhao...` : `Ye option galat kyun hai? Samjhao...`}
                        rows={2}
                        value={form[expKey] as string}
                        onChange={(e) => setForm({ ...form, [expKey]: e.target.value })}
                        className={`resize-none text-xs ${isCorrect ? "border-green-200 bg-white" : "bg-white"}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setForm(EMPTY_FORM); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={adding || updating}>
              {adding || updating ? "Saving..." : editQuestion ? "Update Question" : "Add Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the question from the exam.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => deleteId && deleteQuestion({ examId, questionId: deleteId })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
