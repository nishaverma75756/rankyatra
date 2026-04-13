import { useState, useRef } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import {
  Bell, Users, User, ChevronLeft, Send, Eye, Sparkles,
  CheckCircle2, AlertCircle, Info, Image as ImageIcon,
  Upload, X, Link2,
} from "lucide-react";

const TEMPLATE_VARS = [
  { key: "{name}",   label: "User Name",      example: "Rahul",                desc: "User ka full name" },
  { key: "{uid}",    label: "UID",            example: "RY0000000042",         desc: "User ka unique ID" },
  { key: "{email}",  label: "Email",          example: "rahul@gmail.com",      desc: "User ka email address" },
  { key: "{wallet}", label: "Wallet Balance", example: "₹485",                 desc: "User ka current wallet balance" },
  { key: "{phone}",  label: "Phone",          example: "9876543210",           desc: "User ka phone number" },
];

const SAMPLE_USER = {
  name: "Rahul Kumar",
  uid: "RY0000000042",
  email: "rahul@gmail.com",
  wallet: "₹485",
  phone: "9876543210",
};

function resolvePreview(text: string): string {
  return text
    .replace(/\{name\}/g, SAMPLE_USER.name)
    .replace(/\{uid\}/g, SAMPLE_USER.uid)
    .replace(/\{email\}/g, SAMPLE_USER.email)
    .replace(/\{wallet\}/g, SAMPLE_USER.wallet)
    .replace(/\{phone\}/g, SAMPLE_USER.phone);
}

const QUICK_TEMPLATES = [
  {
    label: "Exam Reminder",
    title: "Aaj ka exam yaad hai? 📚",
    body: "Hello {name}! Aaj ek naya exam hai RankYatra pe. Register karo abhi aur ₹ prize jeeto! 🏆",
  },
  {
    label: "Welcome Back",
    title: "Welcome back, {name}! 👋",
    body: "Aapka wallet balance {wallet} hai. Aaj koi naya exam join karo aur apna rank badhao!",
  },
  {
    label: "Wallet Low",
    title: "Wallet recharge karo 💰",
    body: "Hi {name} ({uid})! Aapka wallet balance {wallet} hai. Recharge karo aur exams mein participate karte raho!",
  },
  {
    label: "New Feature",
    title: "RankYatra pe nayi feature! 🎉",
    body: "Hello {name}! Humne ek naya feature launch kiya hai. App open karo aur dekho kya naya aaya hai.",
  },
  {
    label: "Motivational",
    title: "Aaj kuch naya seekho! 🌟",
    body: "Hey {name}! Practice makes perfect. Aaj RankYatra pe ek exam do aur apni knowledge test karo. You got this! 💪",
  },
];

export default function AdminBroadcast() {
  const { toast } = useToast();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageMode, setImageMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<"all" | "specific">("all");
  const [userIdsInput, setUserIdsInput] = useState("");
  const [inApp, setInApp] = useState(true);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast({ title: "Error", description: "Sirf image files allowed hain", variant: "destructive" }); return; }
    if (file.size > 8 * 1024 * 1024) { toast({ title: "Error", description: "Image 8MB se kam honi chahiye", variant: "destructive" }); return; }
    setImageUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve((e.target?.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/admin/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setImageUrl(data.url);
      setImagePreview(URL.createObjectURL(file));
      toast({ title: "Image uploaded!" });
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setImageUploading(false);
    }
  };

  const clearImage = () => { setImageUrl(""); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; };

  const insertVar = (variable: string, field: "title" | "body") => {
    if (field === "title" && titleRef.current) {
      const el = titleRef.current;
      const start = el.selectionStart ?? title.length;
      const end = el.selectionEnd ?? title.length;
      const newVal = title.slice(0, start) + variable + title.slice(end);
      setTitle(newVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + variable.length;
        el.focus();
      }, 0);
    } else if (field === "body" && bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const newVal = body.slice(0, start) + variable + body.slice(end);
      setBody(newVal);
      setTimeout(() => {
        el.selectionStart = el.selectionEnd = start + variable.length;
        el.focus();
      }, 0);
    }
  };

  const applyTemplate = (tmpl: typeof QUICK_TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setBody(tmpl.body);
    setResult(null);
  };

  const parseUserIds = (): number[] => {
    return userIdsInput
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  };

  const canSend = title.trim() && body.trim() && (target === "all" || parseUserIds().length > 0);

  const handleSend = async () => {
    if (!canSend || sending) return;

    const userIds = target === "specific" ? parseUserIds() : undefined;
    const targetLabel = target === "all" ? "ALL USERS" : `${userIds?.length} specific users`;

    const confirmed = window.confirm(
      `Are you sure you want to send this notification to ${targetLabel}?\n\nTitle: ${title}\nMessage: ${body.slice(0, 80)}${body.length > 80 ? "..." : ""}`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/notifications/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          imageUrl: imageUrl.trim() || undefined,
          target,
          userIds,
          inApp,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");

      setResult({ sent: data.sent, failed: data.failed, total: data.total });
      toast({ title: `Notification sent to ${data.sent} users!` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/admin"><ChevronLeft className="h-4 w-4 mr-1" />Admin</Link>
          </Button>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Broadcast Notification</h1>
            <p className="text-muted-foreground text-sm">Send custom push notifications to all or specific users</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left: Compose ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Quick Templates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Quick Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.label}
                      onClick={() => applyTemplate(tmpl)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-muted hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors font-medium"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Title */}
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Notification Title *</Label>
                  <Input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Aaj ka exam yaad hai? 📚"
                    maxLength={80}
                    className="text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Max 80 characters</p>
                    <span className="text-xs text-muted-foreground">{title.length}/80</span>
                  </div>
                  {/* Variable insertion for title */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVar(v.key, "title")}
                        className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono transition-colors"
                        title={v.desc}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Message Body */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Message Body *</Label>
                  <textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="e.g. Hello {name}! Aaj ek naya exam hai, register karo abhi..."
                    rows={5}
                    maxLength={500}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Max 500 characters</p>
                    <span className="text-xs text-muted-foreground">{body.length}/500</span>
                  </div>
                  {/* Variable insertion for body */}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {TEMPLATE_VARS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVar(v.key, "body")}
                        className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono transition-colors"
                        title={v.desc}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Notification Image
                    <span className="text-xs text-muted-foreground font-normal">(optional, Android only)</span>
                  </Label>

                  {/* Mode toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setImageMode("upload"); clearImage(); }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${imageMode === "upload" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      <Upload className="h-3.5 w-3.5" /> Upload Image
                    </button>
                    <button
                      onClick={() => { setImageMode("url"); clearImage(); }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${imageMode === "url" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      <Link2 className="h-3.5 w-3.5" /> Paste URL
                    </button>
                  </div>

                  {imageMode === "upload" ? (
                    <div>
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
                      />

                      {imagePreview ? (
                        /* Preview with remove button */
                        <div className="relative rounded-xl overflow-hidden border border-border bg-muted" style={{ maxHeight: 180 }}>
                          <img src={imagePreview} alt="preview" className="w-full object-cover" style={{ maxHeight: 180 }} />
                          <button
                            onClick={clearImage}
                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-1.5">
                            <p className="text-white text-xs truncate font-mono">{imageUrl}</p>
                          </div>
                        </div>
                      ) : (
                        /* Drop zone */
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleImageFile(f); }}
                          className="border-2 border-dashed border-border hover:border-primary/50 rounded-xl p-6 text-center cursor-pointer transition-colors group"
                        >
                          {imageUploading ? (
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-8 w-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                              <p className="text-sm text-muted-foreground">Uploading...</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2">
                              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                <Upload className="h-5 w-5 text-primary" />
                              </div>
                              <p className="text-sm font-semibold text-foreground">Click ya drag & drop karo</p>
                              <p className="text-xs text-muted-foreground">PNG, JPG, WebP — max 8MB</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Input
                        value={imageUrl}
                        onChange={(e) => { setImageUrl(e.target.value); setImagePreview(null); }}
                        placeholder="https://rankyatra.in/logo.png"
                        className="text-sm font-mono"
                      />
                      {imageUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-border bg-muted mt-1" style={{ maxHeight: 120 }}>
                          <img
                            src={imageUrl}
                            alt="preview"
                            className="w-full object-cover"
                            style={{ maxHeight: 120 }}
                            onError={(e) => (e.currentTarget.style.display = "none")}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Target */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Send To
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-3">
                  <button
                    onClick={() => setTarget("all")}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${target === "all" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    <Users className="h-4 w-4" />
                    All Users
                  </button>
                  <button
                    onClick={() => setTarget("specific")}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${target === "specific" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    <User className="h-4 w-4" />
                    Specific Users
                  </button>
                </div>

                {target === "specific" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      User IDs (comma or newline separated) — find IDs on the Users page
                    </Label>
                    <textarea
                      value={userIdsInput}
                      onChange={(e) => setUserIdsInput(e.target.value)}
                      placeholder="e.g. 1, 5, 13, 42"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-mono"
                    />
                    {userIdsInput && (
                      <p className="text-xs text-muted-foreground">
                        {parseUserIds().length} valid user ID(s) entered
                      </p>
                    )}
                  </div>
                )}

                {/* In-app notification toggle */}
                <div className="flex items-center justify-between py-2 border-t border-border mt-2">
                  <div>
                    <p className="text-sm font-semibold">Also create in-app notification</p>
                    <p className="text-xs text-muted-foreground">Appears in user's notification bell inside the app</p>
                  </div>
                  <button
                    onClick={() => setInApp(!inApp)}
                    className={`relative w-10 h-6 rounded-full transition-colors ${inApp ? "bg-primary" : "bg-muted-foreground/30"}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow ${inApp ? "left-5" : "left-1"}`} />
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Hide" : "Preview"}
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="flex-1 flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
              >
                {sending ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Send Notification
                  </>
                )}
              </Button>
            </div>

            {/* Result */}
            {result && (
              <Card className={result.failed === 0 ? "border-green-300 bg-green-50/40" : "border-amber-300 bg-amber-50/40"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-2">
                    {result.failed === 0
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : <AlertCircle className="h-5 w-5 text-amber-600" />
                    }
                    <span className="font-semibold text-sm">
                      {result.failed === 0 ? "Broadcast complete!" : "Broadcast finished with some issues"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center mt-3">
                    <div>
                      <div className="text-xl font-black text-foreground">{result.total}</div>
                      <div className="text-xs text-muted-foreground">Total Users</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-green-600">{result.sent}</div>
                      <div className="text-xs text-muted-foreground">Sent</div>
                    </div>
                    <div>
                      <div className="text-xl font-black text-red-500">{result.failed}</div>
                      <div className="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="space-y-5">
            {/* Preview */}
            {showPreview && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-primary">
                    <Eye className="h-4 w-4" /> Preview (sample data)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Phone notification mockup */}
                  <div className="bg-white rounded-xl p-3 shadow-sm border border-border/60">
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
                        <Bell className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className="text-xs font-bold text-gray-900 truncate">RankYatra</p>
                          <p className="text-xs text-gray-400 shrink-0">now</p>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 mt-0.5 line-clamp-1">
                          {title ? resolvePreview(title) : <span className="text-gray-400 italic">Title will appear here</span>}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-3">
                          {body ? resolvePreview(body) : <span className="text-gray-400 italic">Message will appear here</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Sample user: {SAMPLE_USER.name}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Template Variables Guide */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" /> Template Variables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  In title ya message mein yeh variables likho — har user ke liye automatically unka personal data fill ho jayega.
                </p>
                {TEMPLATE_VARS.map((v) => (
                  <div key={v.key} className="flex flex-col gap-0.5 py-2 border-b border-border last:border-0">
                    <div className="flex items-center justify-between">
                      <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{v.key}</code>
                      <span className="text-xs text-muted-foreground">{v.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pl-1">
                      Example: <span className="text-foreground font-medium">{v.example}</span>
                    </p>
                    <p className="text-xs text-muted-foreground pl-1 italic">{v.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-amber-50/40 border-amber-200">
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Tips for better reach
                </p>
                <ul className="text-xs text-amber-700 space-y-1.5 list-disc list-inside">
                  <li>Title short rakho — 40–60 characters best hain</li>
                  <li><code className="bg-amber-100 px-1 rounded">{"{name}"}</code> se personal lagta hai, CTR badhta hai</li>
                  <li>Emoji use karo — notification me zyada stand out karta hai</li>
                  <li>Message mein action clear hona chahiye (Register karo, Check karo, etc.)</li>
                  <li>Test karne ke liye pehle apna user ID use karo "Specific Users" mein</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
