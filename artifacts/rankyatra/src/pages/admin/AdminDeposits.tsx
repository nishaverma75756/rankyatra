import { useState, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, XCircle, Clock, Upload, Shield, ArrowLeft, QrCode, RefreshCw, ExternalLink, Search } from "lucide-react";
import { Link } from "wouter";

interface Deposit {
  id: number;
  amount: string;
  utrNumber: string | null;
  paymentMethod: string;
  paymentRequestId: string | null;
  status: "pending" | "success" | "rejected";
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  user: { id: number; name: string; email: string; avatarUrl?: string } | null;
}

interface PaymentSettings {
  qrCodeUrl: string | null;
  upiId: string | null;
}

function statusBadge(status: string) {
  if (status === "success") return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
  if (status === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
}

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AdminDeposits() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "success" | "rejected">("pending");
  const [noteMap, setNoteMap] = useState<Record<number, string>>({});
  const [upiId, setUpiId] = useState("");
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const token = getAuthToken();

  const { data: deposits = [], isLoading } = useQuery<Deposit[]>({
    queryKey: ["admin-deposits"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/admin/deposits"), { headers: { Authorization: `Bearer ${token}` } });
      return res.json();
    },
    refetchInterval: 15000,
  });

  const { data: settings } = useQuery<PaymentSettings>({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/payment/settings"));
      return res.json();
    },
    select: (data) => {
      if (data?.upiId && !upiId) setUpiId(data.upiId);
      return data;
    },
  });

  const updateDeposit = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await fetch(getApiUrl(`/api/admin/deposits/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, adminNote }),
      });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-deposits"] }),
  });

  const verifyInstamojo = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(getApiUrl(`/api/admin/deposits/${id}/instamojo-verify`), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error || "Verification failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-deposits"] }),
  });

  const handleSaveSettings = async () => {
    setUploadingQr(true);
    setSaveSuccess(false);
    try {
      const body: Record<string, string> = {};
      if (upiId) body.upiId = upiId;
      if (qrBase64) body.qrCodeUrl = qrBase64;

      const res = await fetch(getApiUrl("/api/admin/payment/settings"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        await qc.invalidateQueries({ queryKey: ["payment-settings"] });
        setQrBase64(null);
        setQrPreview(null);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } finally {
      setUploadingQr(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setQrBase64(dataUrl);
      setQrPreview(dataUrl);
    };
    reader.readAsDataURL(f);
  };

  const filtered = filter === "all" ? deposits : deposits.filter((d) => d.status === filter);
  const counts = { all: deposits.length, pending: deposits.filter((d) => d.status === "pending").length, success: deposits.filter((d) => d.status === "success").length, rejected: deposits.filter((d) => d.status === "rejected").length };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <Shield className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-black">Deposit Requests</h1>
            <p className="text-muted-foreground text-sm">Review and approve wallet top-ups</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto gap-1" onClick={() => qc.invalidateQueries({ queryKey: ["admin-deposits"] })}>
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Deposits list */}
          <div className="lg:col-span-2 space-y-4">
            {/* Filter Tabs */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "pending", "success", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Clock className="w-10 h-10 opacity-30" />
                <p className="font-medium">No {filter !== "all" ? filter : ""} requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((d) => (
                  <Card key={d.id} className={`border ${d.status === "pending" ? "border-amber-200 bg-amber-50/30" : d.status === "success" ? "border-green-200 bg-green-50/30" : "border-red-200 bg-red-50/30"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          {d.user?.avatarUrl ? (
                            <img src={d.user.avatarUrl} alt={d.user.name} className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                              <span className="text-primary text-xs font-bold">{d.user ? getInitials(d.user.name) : "?"}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">{d.user?.name ?? "Unknown"}</span>
                            <span className="text-muted-foreground text-xs">{d.user?.email}</span>
                            {statusBadge(d.status)}
                          </div>
                          <div className="flex items-center gap-4 mt-1.5 text-sm flex-wrap">
                            <span className="text-2xl font-black text-primary">₹{Number(d.amount).toLocaleString("en-IN")}</span>
                            {d.paymentMethod === "instamojo" ? (
                              <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">Instamojo</span>
                            ) : (
                              <span className="font-mono bg-muted px-2 py-0.5 rounded text-xs text-muted-foreground">
                                UTR: {d.utrNumber || "—"}
                              </span>
                            )}
                          </div>
                          {d.paymentMethod === "instamojo" && d.paymentRequestId && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                ID: {d.paymentRequestId}
                              </span>
                              <a
                                href={`https://www.instamojo.com/api/1.1/payment-requests/${d.paymentRequestId}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="Check on Instamojo"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                          {d.paymentMethod === "instamojo" && d.utrNumber && (
                            <p className="text-xs text-muted-foreground mt-0.5">Payment ID: <span className="font-mono">{d.utrNumber}</span></p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(d.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {d.adminNote && <p className="text-xs text-muted-foreground mt-1 italic">Note: {d.adminNote}</p>}
                        </div>
                      </div>

                      {d.status === "pending" && (
                        <div className="mt-3 space-y-2">
                          {d.paymentMethod === "instamojo" && d.paymentRequestId && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                              onClick={() => verifyInstamojo.mutate(d.id)}
                              disabled={verifyInstamojo.isPending}
                            >
                              <Search className="w-4 h-4 mr-1.5" />
                              {verifyInstamojo.isPending ? "Checking Instamojo..." : "Auto-Verify via Instamojo"}
                            </Button>
                          )}
                          <Input
                            placeholder="Admin note (optional)"
                            className="text-sm h-8"
                            value={noteMap[d.id] ?? ""}
                            onChange={(e) => setNoteMap((p) => ({ ...p, [d.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white flex-1"
                              onClick={() => updateDeposit.mutate({ id: d.id, status: "success", adminNote: noteMap[d.id] })}
                              disabled={updateDeposit.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve ₹{Number(d.amount).toLocaleString("en-IN")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => updateDeposit.mutate({ id: d.id, status: "rejected", adminNote: noteMap[d.id] })}
                              disabled={updateDeposit.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT: Payment Settings */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><QrCode className="w-4 h-4" /> Payment QR Code</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {settings?.qrCodeUrl && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Current QR</p>
                    <img src={settings.qrCodeUrl} alt="Payment QR" className="w-full rounded-lg border" />
                    {settings.upiId && <p className="text-sm text-center font-mono text-muted-foreground">{settings.upiId}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">UPI ID</label>
                  <Input
                    placeholder="yourname@upi"
                    value={upiId || settings?.upiId || ""}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground font-medium">Upload New QR</label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center text-sm text-muted-foreground hover:border-primary/40 transition-colors"
                  >
                    {qrPreview ? (
                      <img src={qrPreview} alt="Preview" className="w-32 h-32 object-contain mx-auto rounded" />
                    ) : (
                      <><Upload className="w-6 h-6 mx-auto mb-1" /><span>Click to upload QR image</span></>
                    )}
                  </button>
                </div>

                <Button
                  className={`w-full ${saveSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
                  onClick={handleSaveSettings}
                  disabled={(!qrBase64 && !upiId) || uploadingQr}
                >
                  {uploadingQr ? "Saving..." : saveSuccess ? "✓ Saved!" : "Save Payment Settings"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quick Stats</p>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Pending</span><span className="font-bold text-amber-600">{counts.pending}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Approved</span><span className="font-bold text-green-600">{counts.success}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Rejected</span><span className="font-bold text-red-600">{counts.rejected}</span></div>
                <div className="flex justify-between text-sm border-t pt-2 mt-1"><span className="text-muted-foreground">Total Approved</span><span className="font-bold text-primary">₹{deposits.filter((d) => d.status === "success").reduce((s, d) => s + Number(d.amount), 0).toLocaleString("en-IN")}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
