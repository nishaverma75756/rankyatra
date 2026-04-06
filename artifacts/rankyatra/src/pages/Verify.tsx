import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { ArrowLeft, AlertCircle, Clock, CheckCircle, XCircle, Upload, X, Eye, EyeOff } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode; desc: string }> = {
  not_submitted: {
    label: "Not Verified", color: "#ef4444", bg: "#fef2f2",
    icon: <AlertCircle className="h-6 w-6" />,
    desc: "Submit your Govt ID and a photo of your ID card to verify your account.",
  },
  under_review: {
    label: "Under Review", color: "#f59e0b", bg: "#fffbeb",
    icon: <Clock className="h-6 w-6" />,
    desc: "Your verification is being reviewed by our team. This usually takes 24-48 hours.",
  },
  verified: {
    label: "Verified", color: "#059669", bg: "#f0fdf4",
    icon: <CheckCircle className="h-6 w-6" />,
    desc: "Your account is verified. You can now withdraw winnings and enjoy all features.",
  },
  rejected: {
    label: "Rejected", color: "#dc2626", bg: "#fef2f2",
    icon: <XCircle className="h-6 w-6" />,
    desc: "Your verification was rejected. Please resubmit with a clear, valid ID card image.",
  },
};

export default function VerifyPage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [statusData, setStatusData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [govtId, setGovtId] = useState("");
  const [idCard, setIdCard] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCard, setShowCard] = useState(false);

  const fetchStatus = async () => {
    const token = getAuthToken();
    if (!token) return;
    try {
      const res = await fetch("/api/verify/status", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStatusData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const [meta, base64] = dataUrl.split(",");
      const mimeType = meta.split(":")[1].split(";")[0];
      setIdCard({ base64, mimeType, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!govtId.trim()) { toast({ title: "Please enter your Govt ID number", variant: "destructive" }); return; }
    if (!idCard) { toast({ title: "Please upload your ID card image", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const token = getAuthToken();
      const res = await fetch("/api/verify/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ govtId: govtId.trim(), panCardBase64: idCard.base64, panCardMimeType: idCard.mimeType }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Submission failed", variant: "destructive" }); return; }
      toast({ title: "Submitted successfully!", description: "Your verification is under review." });
      setGovtId(""); setIdCard(null);
      fetchStatus();
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const vs = statusData ? (STATUS_CONFIG[statusData.verificationStatus] ?? STATUS_CONFIG.not_submitted) : null;
  const canSubmit = !statusData?.verificationStatus ||
    statusData.verificationStatus === "not_submitted" ||
    statusData.verificationStatus === "rejected";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-lg pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profile"><ArrowLeft className="h-4 w-4 mr-1" /> Profile</Link>
          </Button>
          <h1 className="text-xl font-black">Profile Verification</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Status Banner */}
            {vs && (
              <div className="rounded-2xl p-5 mb-6 flex items-start gap-4" style={{ backgroundColor: vs.bg, borderWidth: 1, borderColor: vs.color + "30" }}>
                <span style={{ color: vs.color }}>{vs.icon}</span>
                <div>
                  <p className="font-black text-base" style={{ color: vs.color }}>{vs.label}</p>
                  <p className="text-sm text-foreground/70 mt-0.5">{vs.desc}</p>
                  {statusData?.latestRequest?.adminNote && (
                    <p className="text-sm mt-2 font-semibold" style={{ color: vs.color }}>
                      Note: {statusData.latestRequest.adminNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Verified State */}
            {statusData?.verificationStatus === "verified" && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center space-y-3">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <p className="font-black text-lg text-green-700">Account Verified!</p>
                <p className="text-sm text-green-600">You can now withdraw winnings and use all platform features.</p>
                <Button asChild className="w-full mt-2">
                  <Link href="/profile">Back to Profile</Link>
                </Button>
              </div>
            )}

            {/* Under Review State */}
            {statusData?.verificationStatus === "under_review" && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center space-y-3">
                <Clock className="h-12 w-12 text-amber-500 mx-auto" />
                <p className="font-black text-lg text-amber-700">Review in Progress</p>
                <p className="text-sm text-amber-600">
                  Submitted on {statusData.latestRequest?.createdAt ? new Date(statusData.latestRequest.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </p>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/profile">Back to Profile</Link>
                </Button>
              </div>
            )}

            {/* Submission Form */}
            {canSubmit && (
              <div className="space-y-5">
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary font-medium">
                  Submit a valid Government ID (Aadhaar, Voter ID, PAN, Passport) along with a photo of the document.
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold">Govt ID Number</Label>
                  <Input
                    value={govtId}
                    onChange={(e) => setGovtId(e.target.value)}
                    placeholder="e.g. XXXX XXXX XXXX (Aadhaar)"
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-semibold">ID Card Photo</Label>
                  {idCard ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        {showCard
                          ? <img src={idCard.preview} alt="ID Card" className="w-full max-h-52 object-contain bg-muted/30" />
                          : <div className="h-20 bg-muted/30 flex items-center justify-center">
                              <span className="text-sm text-muted-foreground font-medium">Image selected (hidden)</span>
                            </div>
                        }
                        <button
                          onClick={() => setIdCard(null)}
                          className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowCard(!showCard)} className="h-7 text-xs gap-1.5">
                        {showCard ? <><EyeOff className="h-3.5 w-3.5" /> Hide Image</> : <><Eye className="h-3.5 w-3.5" /> View Image</>}
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl py-10 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm font-semibold text-muted-foreground">Click to upload ID card photo</span>
                      <span className="text-xs text-muted-foreground">JPG, PNG supported</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                <Button
                  className="w-full"
                  disabled={!govtId.trim() || !idCard || submitting}
                  onClick={handleSubmit}
                >
                  {submitting ? (
                    <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Submitting...</>
                  ) : "Submit for Verification"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
