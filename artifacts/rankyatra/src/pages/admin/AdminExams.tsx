import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Plus, Edit2, Trash2, Trophy, Gift, BookOpen } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListExams, useCreateExam, useUpdateExam, useDeleteExam, useAdminRewardWinners } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, getExamStatus } from "@/lib/utils";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import type { Exam } from "@workspace/api-client-react";

const EMPTY_FORM = {
  title: "",
  category: "",
  start_time: "",
  end_time: "",
  entry_fee: "5",
  prize_pool: "100",
};

const toLocalDT = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const addMins = (localDT: string, mins: number) => {
  const d = new Date(localDT);
  d.setMinutes(d.getMinutes() + mins);
  return toLocalDT(d);
};

export default function AdminExams() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editExam, setEditExam] = useState<Exam | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const token = getAuthToken();

  const { data: CATEGORIES = [] } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/categories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
    staleTime: 60_000,
  });

  const { data: examsRaw = [], isLoading, refetch } = useListExams() as { data: Exam[]; isLoading: boolean; refetch: () => void };

  const exams = [...examsRaw].sort((a, b) => {
    const order: Record<string, number> = { live: 0, upcoming: 1, ended: 2 };
    const sa = getExamStatus(a.startTime, a.endTime);
    const sb = getExamStatus(b.startTime, b.endTime);
    if (sa !== sb) return order[sa] - order[sb];
    if (sa === "live" || sa === "upcoming") return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    return new Date(b.endTime).getTime() - new Date(a.endTime).getTime();
  });

  const { mutate: createExam, isPending: creating } = useCreateExam({
    mutation: {
      onSuccess: () => { toast({ title: "Exam created!" }); setDialogOpen(false); setForm(EMPTY_FORM); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });
  const { mutate: updateExam, isPending: updating } = useUpdateExam({
    mutation: {
      onSuccess: () => { toast({ title: "Exam updated!" }); setDialogOpen(false); setEditExam(null); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });
  const { mutate: deleteExam } = useDeleteExam({
    mutation: {
      onSuccess: () => { toast({ title: "Exam deleted." }); setDeleteId(null); refetch(); },
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message, variant: "destructive" }),
    },
  });
  const { mutate: rewardWinners } = useAdminRewardWinners({
    mutation: {
      onSuccess: () => toast({ title: "Rewards distributed!" }),
      onError: (e: any) => toast({ title: "Error", description: e?.response?.data?.message ?? "Already distributed or error.", variant: "destructive" }),
    },
  });

  const openCreate = () => {
    const now = new Date();
    const start = toLocalDT(new Date(now.getTime() + 5 * 60000));
    const end = addMins(start, 20);
    setForm({ ...EMPTY_FORM, start_time: start, end_time: end });
    setEditExam(null);
    setDialogOpen(true);
  };

  const openEdit = (exam: Exam) => {
    setEditExam(exam);
    const start = toLocalDT(new Date(exam.startTime));
    setForm({
      title: exam.title,
      category: exam.category ?? "SSC",
      start_time: start,
      end_time: toLocalDT(new Date(exam.endTime)),
      entry_fee: String(exam.entryFee),
      prize_pool: String(exam.prizePool),
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const payload = {
      title: form.title,
      category: form.category,
      startTime: new Date(form.start_time).toISOString(),
      endTime: new Date(form.end_time).toISOString(),
      entryFee: form.entry_fee,
      prizePool: form.prize_pool,
    };
    if (editExam) {
      updateExam({ examId: editExam.id, data: payload });
    } else {
      createExam({ data: payload });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Admin</Link>
            </Button>
            <h1 className="text-2xl font-black text-foreground">Exam Management</h1>
          </div>
          <Button onClick={openCreate} className="bg-primary text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" /> Create Exam
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {exams.map((exam: Exam) => {
              const status = getExamStatus(exam.startTime, exam.endTime);
              const rewardsDistributed = (exam as any).rewards_distributed === "true" || (exam as any).rewards_distributed === true;
              return (
                <Card key={exam.id} className="overflow-hidden">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="secondary" className="text-xs">{exam.category}</Badge>
                        {status === "live" && <Badge className="bg-green-500 text-white text-xs animate-pulse">🔴 LIVE</Badge>}
                        {status === "upcoming" && <Badge variant="outline" className="text-xs">Upcoming</Badge>}
                        {status === "ended" && <Badge variant="secondary" className="text-xs">Ended</Badge>}
                        {rewardsDistributed && <Badge className="bg-green-100 text-green-700 text-xs"><Gift className="h-3 w-3 mr-1" />Rewards Sent</Badge>}
                      </div>
                      <p className="font-bold text-foreground text-sm truncate">{exam.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(exam.startTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        {" · "}{formatCurrency(exam.prizePool)} prize · {formatCurrency(exam.entryFee)} entry
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {status === "ended" && !rewardsDistributed && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-600 border-green-200 hover:bg-green-50 text-xs"
                          onClick={() => rewardWinners({ examId: exam.id, data: { prizes: [] } })}
                        >
                          <Trophy className="h-3.5 w-3.5 mr-1" />
                          Reward
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-primary border-primary/30 hover:bg-primary/5"
                        title="Manage Questions"
                        onClick={() => setLocation(`/admin/exams/${exam.id}/questions`)}
                      >
                        <BookOpen className="h-3.5 w-3.5 mr-1" />
                        Questions ({(exam as any).questionCount ?? 0})
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(exam)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive/80"
                        onClick={() => setDeleteId(exam.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editExam ? "Edit Exam" : "Create New Exam"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input placeholder="e.g. SSC CGL Mock Test 2026" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => {
                    const start = e.target.value;
                    const autoEnd = start ? addMins(start, 20) : form.end_time;
                    setForm({ ...form, start_time: start, end_time: autoEnd });
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input type="datetime-local" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Entry Fee (₹)</Label>
                <Input type="number" value={form.entry_fee} onChange={(e) => setForm({ ...form, entry_fee: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>Prize Pool (₹)</Label>
                <Input type="number" value={form.prize_pool} onChange={(e) => setForm({ ...form, prize_pool: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={creating || updating || !form.title}>
              {creating || updating ? "Saving..." : editExam ? "Update Exam" : "Create Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Exam?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the exam and all associated questions and registrations.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={() => deleteId && deleteExam({ examId: deleteId })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
