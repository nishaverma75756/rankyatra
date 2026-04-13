import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, MessageSquare, Lightbulb, Clock, CheckCircle, XCircle, Trash2, Eye, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type FeedbackItem = {
  id: number;
  type: "feedback" | "suggestion";
  message: string;
  imageUrl: string | null;
  status: "pending" | "reviewed" | "resolved";
  adminNote: string | null;
  createdAt: string;
  userId: number;
  userName: string | null;
  userAvatar: string | null;
  userEmail: string | null;
};

type FilterTab = "all" | "pending" | "reviewed" | "resolved" | "feedback" | "suggestion";

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  reviewed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

export default function AdminFeedback() {
  const qc = useQueryClient();
  const token = getAuthToken();
  const { toast } = useToast();

  const [filter, setFilter] = useState<FilterTab>("all");
  const [selected, setSelected] = useState<FeedbackItem | null>(null);
  const [note, setNote] = useState("");
  const [imageModal, setImageModal] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery<FeedbackItem[]>({
    queryKey: ["admin-feedback"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/admin/feedback"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const r = await fetch(getApiUrl(`/api/admin/feedback/${id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, adminNote: adminNote ?? selected?.adminNote }),
      });
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast({ title: "Updated" });
      setSelected(null);
    },
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await fetch(getApiUrl(`/api/admin/feedback/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-feedback"] });
      setSelected(null);
      toast({ title: "Deleted" });
    },
  });

  const filtered = items.filter(item => {
    if (filter === "all") return true;
    if (filter === "feedback" || filter === "suggestion") return item.type === filter;
    return item.status === filter;
  });

  const counts = {
    all: items.length,
    pending: items.filter(i => i.status === "pending").length,
    reviewed: items.filter(i => i.status === "reviewed").length,
    resolved: items.filter(i => i.status === "resolved").length,
    feedback: items.filter(i => i.type === "feedback").length,
    suggestion: items.filter(i => i.type === "suggestion").length,
  };

  const FILTER_TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "reviewed", label: `Reviewed (${counts.reviewed})` },
    { key: "resolved", label: `Resolved (${counts.resolved})` },
    { key: "feedback", label: `Feedback (${counts.feedback})` },
    { key: "suggestion", label: `Suggestions (${counts.suggestion})` },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Image modal */}
      {imageModal && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setImageModal(null)}>
          <img src={imageModal} alt="Attachment" className="max-w-full max-h-full rounded-xl object-contain" />
          <button className="absolute top-4 right-4 text-white" onClick={() => setImageModal(null)}>
            <X size={28} />
          </button>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-3xl pb-24 pt-5">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black">Feedback & Suggestions</h1>
            <p className="text-sm text-muted-foreground">{counts.pending} pending · {items.length} total</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === tab.key ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No feedback yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <Card key={item.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {item.userAvatar ? (
                        <img src={item.userAvatar} alt={item.userName ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-primary">{(item.userName ?? "?")[0].toUpperCase()}</span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-sm truncate">{item.userName ?? "Unknown User"}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.type === "suggestion" ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"}`}>
                          {item.type === "suggestion" ? "💡 Suggestion" : "💬 Feedback"}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[item.status]}`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">{timeAgo(item.createdAt)}</span>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-foreground/90 leading-relaxed mb-2">{item.message}</p>

                      {/* Image */}
                      {item.imageUrl && (
                        <button onClick={() => setImageModal(item.imageUrl!)} className="mb-2">
                          <img src={item.imageUrl} alt="Attachment" className="h-20 rounded-lg object-cover border hover:opacity-80 transition-opacity" />
                        </button>
                      )}

                      {/* Admin note */}
                      {item.adminNote && (
                        <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground mt-1 mb-2">
                          <span className="font-semibold text-foreground/70">Note: </span>{item.adminNote}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { setSelected(item); setNote(item.adminNote ?? ""); }}>
                          <Eye className="h-3 w-3" /> Manage
                        </Button>
                        {item.status === "pending" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-blue-600" onClick={() => updateStatus.mutate({ id: item.id, status: "reviewed" })}>
                            <CheckCircle className="h-3 w-3" /> Reviewed
                          </Button>
                        )}
                        {item.status === "reviewed" && (
                          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600" onClick={() => updateStatus.mutate({ id: item.id, status: "resolved" })}>
                            <CheckCircle className="h-3 w-3" /> Resolve
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive ml-auto" onClick={() => { if (confirm("Delete?")) del.mutate(item.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-lg mx-auto bg-background rounded-t-3xl p-6 z-50 space-y-4 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-black text-base">Manage Feedback</h3>
              <button onClick={() => setSelected(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="bg-muted/40 rounded-xl p-4 text-sm">{selected.message}</div>

            {selected.imageUrl && (
              <img src={selected.imageUrl} alt="Attachment" className="w-full rounded-xl object-cover max-h-48 cursor-pointer" onClick={() => setImageModal(selected.imageUrl!)} />
            )}

            <div>
              <label className="text-xs font-semibold block mb-1.5">Admin Note</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Add an internal note..." rows={3} className="resize-none" />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="text-xs h-9" onClick={() => updateStatus.mutate({ id: selected.id, status: "pending", adminNote: note })}>
                <Clock className="h-3.5 w-3.5 mr-1" /> Pending
              </Button>
              <Button variant="outline" className="text-xs h-9 text-blue-600" onClick={() => updateStatus.mutate({ id: selected.id, status: "reviewed", adminNote: note })}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Reviewed
              </Button>
              <Button variant="outline" className="text-xs h-9 text-green-600" onClick={() => updateStatus.mutate({ id: selected.id, status: "resolved", adminNote: note })}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Resolved
              </Button>
            </div>

            <Button variant="destructive" className="w-full text-sm" onClick={() => del.mutate(selected.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
