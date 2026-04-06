import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldX, Clock, AlertCircle, Eye, EyeOff, Check, X } from "lucide-react";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

interface Verification {
  id: number;
  userId: number;
  govtId: string;
  panCardUrl: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  userPhone: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700 border-amber-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "approved") return <ShieldCheck className="h-4 w-4 text-green-600" />;
  if (status === "rejected") return <ShieldX className="h-4 w-4 text-red-600" />;
  return <Clock className="h-4 w-4 text-amber-600" />;
}

function VerificationCard({ v, onAction }: { v: Verification; onAction: (id: number, action: string, note?: string) => void }) {
  const [showPan, setShowPan] = useState(false);
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState<"approve" | "reject" | null>(null);

  return (
    <Card className="border overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold">{v.userName ?? "Unknown User"}</CardTitle>
            <p className="text-sm text-muted-foreground">{v.userEmail}</p>
            {v.userPhone && <p className="text-sm text-muted-foreground">{v.userPhone}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${STATUS_COLOR[v.status] ?? "bg-gray-100 text-gray-700"} border text-xs font-semibold`}>
              <StatusIcon status={v.status} />
              <span className="ml-1 capitalize">{v.status}</span>
            </Badge>
            <Link href={`/admin/users/${v.userId}`}>
              <Button size="sm" variant="ghost" className="text-xs h-7 px-2">View User</Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Govt ID</p>
            <p className="font-mono font-semibold">{v.govtId}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1 font-medium">Submitted</p>
            <p className="font-semibold">{new Date(v.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </div>
        </div>

        {v.adminNote && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
            <span className="font-semibold">Admin note:</span> {v.adminNote}
          </div>
        )}

        {/* PAN Card Preview */}
        <div>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 mb-2"
            onClick={() => setShowPan(prev => !prev)}
          >
            {showPan ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPan ? "Hide" : "View"} PAN Card
          </Button>
          {showPan && (
            <div className="rounded-xl overflow-hidden border border-border max-w-sm">
              <img src={v.panCardUrl} alt="PAN Card" className="w-full object-contain max-h-64" />
            </div>
          )}
        </div>

        {/* Action Buttons — only for pending */}
        {v.status === "pending" && (
          <div className="space-y-3">
            {!confirming ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white gap-2 flex-1"
                  onClick={() => setConfirming("approve")}
                >
                  <Check className="h-4 w-4" /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-2 flex-1"
                  onClick={() => setConfirming("reject")}
                >
                  <X className="h-4 w-4" /> Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {confirming === "approve" ? "Confirm approval?" : "Reject with reason:"}
                </p>
                {confirming === "reject" && (
                  <input
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Reason for rejection (optional)"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={confirming === "approve" ? "bg-green-600 hover:bg-green-700 text-white flex-1" : "flex-1"}
                    variant={confirming === "reject" ? "destructive" : "default"}
                    onClick={() => { onAction(v.id, confirming, note); setConfirming(null); setNote(""); }}
                  >
                    Confirm {confirming === "approve" ? "Approval" : "Rejection"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminVerifications() {
  const token = getAuthToken();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");

  const { data: verifications = [], isLoading } = useQuery<Verification[]>({
    queryKey: ["admin-verifications"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/verifications"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    },
    refetchInterval: 30000,
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action, adminNote }: { id: number; action: string; adminNote?: string }) => {
      const res = await fetch(getApiUrl(`/api/admin/verifications/${id}`), {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote }),
      });
      if (!res.ok) throw new Error("Action failed");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-verifications"] }),
  });

  const filtered = Array.isArray(verifications)
    ? filter === "all" ? verifications : verifications.filter(v => v.status === filter)
    : [];

  const pendingCount = Array.isArray(verifications) ? verifications.filter(v => v.status === "pending").length : 0;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <ShieldCheck className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">KYC Verifications</h1>
            <p className="text-muted-foreground text-sm">Review and approve user identity documents</p>
          </div>
          {pendingCount > 0 && (
            <span className="ml-auto bg-amber-100 text-amber-700 border border-amber-200 text-sm font-bold px-3 py-1 rounded-full">
              {pendingCount} pending
            </span>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {(["pending", "approved", "rejected", "all"] as const).map(f => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              className="capitalize"
              onClick={() => setFilter(f)}
            >
              {f}{f !== "all" && Array.isArray(verifications) ? ` (${verifications.filter(v => f === "all" || v.status === f).length})` : ""}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="h-12 w-12 text-muted-foreground/40" />
            <p className="text-muted-foreground text-lg font-medium">No {filter} verifications</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filtered.map(v => (
              <VerificationCard
                key={v.id}
                v={v}
                onAction={(id, action, note) => actionMutation.mutate({ id, action, adminNote: note })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
