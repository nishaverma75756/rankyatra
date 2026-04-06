import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import {
  ArrowLeft, Flag, CheckCircle, XCircle, Clock,
  ExternalLink, User, ShieldOff, Shield, ChevronDown, ChevronUp, MessageSquare
} from "lucide-react";

type ChatMessage = {
  id: number;
  content: string;
  createdAt: string;
  sender: { id: number; name: string; avatarUrl: string | null };
};

type Report = {
  id: number;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
  conversationId: number | null;
  postId: number | null;
  reporter: { id: number; name: string; email: string };
  reportedUser: { id: number; name: string; email: string };
};

const REASON_LABELS: Record<string, string> = {
  spam: "Spam or misleading",
  harassment: "Harassment",
  fake: "Fake or impersonation",
  inappropriate: "Inappropriate Content",
  hate: "Hate speech or harassment",
  other: "Other",
};

function ConversationMessages({ convId, reporterId, reportedUserId, token }: {
  convId: number;
  reporterId: number;
  reportedUserId: number;
  token: string;
}) {
  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["admin-conv-messages", convId],
    queryFn: async () => {
      const res = await fetch(getApiUrl(`/api/admin/conversations/${convId}/messages`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
      </div>
    );
  }

  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">No messages found</p>;
  }

  return (
    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
      {messages.map(msg => {
        const isReporter = msg.sender.id === reporterId;
        const isReported = msg.sender.id === reportedUserId;
        return (
          <div key={msg.id} className={`flex gap-2 ${isReporter ? "justify-start" : "justify-end"}`}>
            {isReporter && (
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                ${isReporter ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600" : "bg-red-100 dark:bg-red-900/30 text-red-500"}`}>
                {msg.sender.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm
              ${isReporter
                ? "bg-slate-200 dark:bg-slate-700 text-foreground rounded-bl-sm"
                : isReported
                ? "bg-orange-100 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 text-foreground rounded-br-sm"
                : "bg-muted text-foreground"
              }`}
            >
              <p className={`text-xs font-semibold mb-0.5 ${isReporter ? "text-blue-600 dark:text-blue-400" : "text-red-500"}`}>
                {msg.sender.name} {isReporter ? "(reporter)" : isReported ? "(reported)" : ""}
              </p>
              <p className="leading-snug">{msg.content}</p>
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {new Date(msg.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
              </p>
            </div>
            {!isReporter && (
              <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-500">
                {msg.sender.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReportCard({ r, token }: { r: Report; token: string }) {
  const qc = useQueryClient();
  const [showMessages, setShowMessages] = useState(false);
  const [reportedBlocked, setReportedBlocked] = useState(false);

  const updateStatus = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      const res = await fetch(getApiUrl(`/api/admin/reports/${r.id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-reports"] }),
  });

  const blockUser = useMutation({
    mutationFn: async (block: boolean) => {
      const res = await fetch(getApiUrl(`/api/admin/users/${r.reportedUser.id}/block`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: block }),
      });
      if (!res.ok) throw new Error("Failed");
      setReportedBlocked(block);
    },
  });

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      {/* Status + Reason + Time */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
          r.status === "pending"
            ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
            : r.status === "resolved"
            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            : "bg-muted text-muted-foreground"
        }`}>
          {r.status === "pending" ? <Clock className="h-3 w-3" />
            : r.status === "resolved" ? <CheckCircle className="h-3 w-3" />
            : <XCircle className="h-3 w-3" />}
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </span>
        <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2.5 py-1 rounded-full font-semibold">
          {REASON_LABELS[r.reason] ?? r.reason}
        </span>
        {r.postId && (
          <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2.5 py-1 rounded-full font-semibold">
            Post Report
          </span>
        )}
        {!r.postId && (
          <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2.5 py-1 rounded-full font-semibold">
            Profile Report
          </span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(r.createdAt).toLocaleString("en-IN")}
          {r.conversationId && ` · Chat #${r.conversationId}`}
          {r.postId && ` · Post #${r.postId}`}
        </span>
      </div>

      {/* User cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Reporter */}
        <div className="bg-muted/50 rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reported By</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{r.reporter.name}</p>
              <p className="text-xs text-muted-foreground truncate">{r.reporter.email}</p>
              <p className="text-xs font-mono text-blue-500 mt-0.5">UID: {r.reporter.id}</p>
            </div>
            <a
              href={`/user/${r.reporter.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 transition-colors"
              title="View profile"
            >
              <ExternalLink className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </a>
          </div>
        </div>

        {/* Reported User */}
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-3">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-2">Reported User</p>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-red-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{r.reportedUser.name}</p>
              <p className="text-xs text-muted-foreground truncate">{r.reportedUser.email}</p>
              <p className="text-xs font-mono text-red-500 mt-0.5">UID: {r.reportedUser.id}</p>
            </div>
            <div className="flex gap-1.5">
              <a
                href={`/user/${r.reportedUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 transition-colors"
                title="View profile"
              >
                <ExternalLink className="h-3.5 w-3.5 text-red-500" />
              </a>
              <a
                href={`/admin/users/${r.reportedUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 p-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 transition-colors"
                title="Admin panel"
              >
                <Shield className="h-3.5 w-3.5 text-red-500" />
              </a>
            </div>
          </div>
          {/* Block / Unblock reported user */}
          <button
            onClick={() => blockUser.mutate(!reportedBlocked)}
            disabled={blockUser.isPending}
            className={`mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              reportedBlocked
                ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-200"
                : "bg-red-100 dark:bg-red-900/20 text-red-600 hover:bg-red-200"
            }`}
          >
            {blockUser.isPending
              ? <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
              : reportedBlocked
              ? <><Shield className="h-3 w-3" /> Unblock Profile</>
              : <><ShieldOff className="h-3 w-3" /> Block Profile</>
            }
          </button>
        </div>
      </div>

      {/* Details */}
      {r.details && (
        <div className="bg-muted/40 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Complaint Details</p>
          <p className="text-sm italic text-foreground">"{r.details}"</p>
        </div>
      )}

      {/* View Post */}
      {r.postId && (
        <a
          href={`/post/${r.postId}/comments`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/30 rounded-xl text-sm font-semibold text-orange-700 dark:text-orange-400 hover:bg-orange-100 transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
          View Reported Post (Post #{r.postId})
        </a>
      )}

      {/* View Conversation */}
      {r.conversationId && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowMessages(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              View Conversation (last 20 messages)
            </span>
            {showMessages ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showMessages && (
            <div className="p-3 bg-background/50">
              <ConversationMessages
                convId={r.conversationId}
                reporterId={r.reporter.id}
                reportedUserId={r.reportedUser.id}
                token={token}
              />
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {r.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => updateStatus.mutate({ status: "resolved" })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <CheckCircle className="h-4 w-4" /> Resolve
          </button>
          <button
            onClick={() => updateStatus.mutate({ status: "dismissed" })}
            disabled={updateStatus.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-muted hover:bg-muted/80 disabled:opacity-60 text-muted-foreground text-sm font-semibold rounded-xl transition-colors"
          >
            <XCircle className="h-4 w-4" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminReports() {
  const token = getAuthToken();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<"all" | "pending" | "resolved" | "dismissed">("pending");

  const { data: reports = [], isLoading, isError } = useQuery<Report[]>({
    queryKey: ["admin-reports"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/reports"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  const filtered = reports.filter(r => filter === "all" || r.status === filter);
  const pendingCount = reports.filter(r => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/admin")} className="p-2 rounded-full hover:bg-muted transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <Flag className="h-6 w-6 text-red-500" />
            <h1 className="text-2xl font-bold">User Reports</h1>
            {pendingCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{pendingCount}</span>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["pending", "resolved", "dismissed", "all"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f === "pending" && pendingCount > 0 && ` (${pendingCount})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Could not load reports</p>
            <p className="text-sm mt-1">Run deploy.sh on server to create DB tables.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Flag className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No {filter === "all" ? "" : filter} reports</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(r => (
              <ReportCard key={r.id} r={r} token={token!} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
