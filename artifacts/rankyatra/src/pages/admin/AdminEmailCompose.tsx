import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";
import {
  Mail, ChevronLeft, Send, Eye, EyeOff, Users, User,
  Sparkles, CheckCircle2, AlertCircle, Code, FileText, Zap,
} from "lucide-react";

// ─── Template Variables ────────────────────────────────────────────────────────
const VARS = [
  { key: "{name}", label: "Name", example: "Rahul Kumar" },
  { key: "{uid}", label: "UID", example: "RY0000000042" },
  { key: "{email}", label: "Email", example: "rahul@gmail.com" },
  { key: "{wallet}", label: "Wallet", example: "₹485" },
  { key: "{phone}", label: "Phone", example: "9876543210" },
];

const SAMPLE = { name: "Rahul Kumar", uid: "RY0000000042", email: "rahul@gmail.com", wallet: "₹485", phone: "9876543210" };

function resolvePreview(text: string) {
  return text
    .replace(/\{name\}/g, SAMPLE.name).replace(/\{uid\}/g, SAMPLE.uid)
    .replace(/\{email\}/g, SAMPLE.email).replace(/\{wallet\}/g, SAMPLE.wallet)
    .replace(/\{phone\}/g, SAMPLE.phone);
}

// ─── 5 Professional Email Templates ───────────────────────────────────────────
const BASE = `font-family:Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f0e17;color:#fffffe;padding:36px 32px;border-radius:16px;`;
const HDR = `<div style="text-align:center;margin-bottom:28px;border-bottom:2px solid #f5a62330;padding-bottom:24px;"><div style="font-size:28px;font-weight:900;color:#f5a623;letter-spacing:1px;">RANKYATRA</div><div style="color:#a7a9be;font-size:12px;margin-top:4px;letter-spacing:2px;">COMPETE · RANK · WIN</div></div>`;
const FTR = `<div style="border-top:1px solid #2e2d3d;margin-top:32px;padding-top:20px;text-align:center;"><p style="color:#a7a9be;font-size:12px;margin:0 0 6px;">RankYatra — India's #1 Competitive Exam Platform</p><p style="color:#666;font-size:11px;margin:0;">rankyatra.in | support@rankyatra.in</p><p style="color:#555;font-size:10px;margin-top:8px;">© ${new Date().getFullYear()} RankYatra. All rights reserved.</p></div>`;
const BTN = (txt: string, url: string) => `<div style="text-align:center;margin:28px 0;"><a href="${url}" style="background:#f5a623;color:#0f0e17;padding:14px 36px;border-radius:10px;font-weight:800;font-size:15px;text-decoration:none;display:inline-block;">${txt}</a></div>`;

const TEMPLATES = [
  {
    id: "promotional",
    label: "🎉 Promotional",
    subject: "🎉 Special Offer Just For You, {name}!",
    html: `<div style="${BASE}">${HDR}
  <div style="background:linear-gradient(135deg,#f5a62322,#f97316 11);border:1px solid #f5a62340;border-radius:14px;padding:24px;text-align:center;margin-bottom:24px;">
    <div style="font-size:40px;margin-bottom:8px;">🎁</div>
    <div style="color:#f5a623;font-size:22px;font-weight:900;margin-bottom:6px;">Special Offer For You!</div>
    <div style="color:#d4d6e0;font-size:15px;">Limited time — don't miss out</div>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#d4d6e0;">Hello <strong style="color:#fffffe;">{name}</strong> 👋</p>
  <p style="font-size:15px;line-height:1.7;color:#d4d6e0;">
    We have an exciting offer exclusively for you! Join our latest contests on RankYatra and win real cash prizes. The more you participate, the higher your rank — and the bigger your rewards!
  </p>
  <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;border-left:4px solid #f5a623;">
    <div style="color:#f5a623;font-weight:800;font-size:16px;margin-bottom:8px;">✨ Why Join Now?</div>
    <div style="color:#d4d6e0;font-size:14px;line-height:1.8;">
      ✅ 100% Safe & Secure Platform<br/>
      🏆 Win Real Cash Every Day<br/>
      📊 Track Your Performance Live<br/>
      💸 Instant Withdrawals to Your Bank
    </div>
  </div>
  <p style="color:#a7a9be;font-size:14px;">Your current wallet balance: <strong style="color:#f5a623;">{wallet}</strong></p>
  ${BTN("Browse Contests →", "https://rankyatra.in/exams")}
  <p style="color:#666;font-size:11px;text-align:center;">This is a promotional email from RankYatra. You're receiving this because you're a registered user.</p>
${FTR}</div>`,
  },
  {
    id: "announcement",
    label: "📢 Official Announcement",
    subject: "📢 Important Announcement from RankYatra",
    html: `<div style="${BASE}">${HDR}
  <div style="background:#1a1929;border:1px solid #2e2d3d;border-radius:12px;padding:16px 20px;margin-bottom:24px;display:flex;align-items:center;gap:12px;">
    <div style="background:#3b82f620;border-radius:8px;padding:10px;text-align:center;min-width:44px;font-size:22px;">📢</div>
    <div>
      <div style="color:#93c5fd;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Official Announcement</div>
      <div style="color:#fffffe;font-size:16px;font-weight:700;margin-top:2px;">Important Update from RankYatra</div>
    </div>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#d4d6e0;">Dear <strong style="color:#fffffe;">{name}</strong>,</p>
  <p style="font-size:15px;line-height:1.8;color:#d4d6e0;">
    We are writing to inform you of an important update regarding our platform. Please read this message carefully as it may affect your account and participation in upcoming contests.
  </p>
  <p style="font-size:15px;line-height:1.8;color:#d4d6e0;">
    [Write your official announcement here. This template is designed for formal communications, policy updates, or platform changes.]
  </p>
  <div style="background:#1a1929;border-radius:12px;padding:20px;margin:20px 0;">
    <div style="color:#93c5fd;font-weight:800;font-size:14px;margin-bottom:10px;">Key Information:</div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;border-bottom:1px solid #2e2d3d;">Your Account ID</td><td style="color:#fffffe;font-weight:700;text-align:right;padding:8px 0;font-size:14px;border-bottom:1px solid #2e2d3d;">{uid}</td></tr>
      <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Wallet Balance</td><td style="color:#f5a623;font-weight:700;text-align:right;padding:8px 0;font-size:14px;">{wallet}</td></tr>
    </table>
  </div>
  <p style="font-size:14px;line-height:1.7;color:#d4d6e0;">If you have any questions or concerns, please contact our support team at <a href="mailto:support@rankyatra.in" style="color:#f5a623;">support@rankyatra.in</a>.</p>
  <p style="font-size:15px;color:#d4d6e0;margin-top:24px;">Regards,<br/><strong style="color:#fffffe;">RankYatra Team</strong></p>
${FTR}</div>`,
  },
  {
    id: "personal",
    label: "✉️ Personal Letter",
    subject: "👋 A Special Message for You, {name}!",
    html: `<div style="${BASE}">${HDR}
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:56px;">👋</div>
    <div style="color:#fffffe;font-size:22px;font-weight:800;margin-top:8px;">Hello, {name}!</div>
    <div style="color:#a7a9be;font-size:14px;margin-top:4px;">We wanted to reach out personally</div>
  </div>
  <p style="font-size:16px;line-height:1.8;color:#d4d6e0;">
    Thank you for being a valued member of the RankYatra family. Your participation means the world to us, and we wanted to take a moment to personally connect with you.
  </p>
  <div style="background:linear-gradient(135deg,#1a1929,#0f1629);border:1px solid #3b82f620;border-radius:14px;padding:24px;margin:24px 0;">
    <p style="color:#d4d6e0;font-size:15px;line-height:1.8;margin:0;">
      "Education is the most powerful weapon you can use to change the world. At RankYatra, we believe in helping you unlock your full potential through competitive learning."
    </p>
    <p style="color:#a7a9be;font-size:13px;margin:12px 0 0;font-style:italic;">— RankYatra Team</p>
  </div>
  <p style="font-size:15px;line-height:1.7;color:#d4d6e0;">
    We have some exciting things planned for you. Keep participating, keep learning, and keep growing. Your journey with RankYatra is just getting started!
  </p>
  <div style="background:#1a1929;border-radius:10px;padding:16px 20px;margin:20px 0;border-left:3px solid #4ade80;">
    <div style="color:#4ade80;font-size:13px;font-weight:700;">Your Stats at a Glance</div>
    <div style="color:#a7a9be;font-size:13px;margin-top:6px;">Account: <strong style="color:#fffffe;">{uid}</strong></div>
    <div style="color:#a7a9be;font-size:13px;margin-top:4px;">Wallet Balance: <strong style="color:#f5a623;">{wallet}</strong></div>
  </div>
  ${BTN("Visit RankYatra →", "https://rankyatra.in")}
  <p style="font-size:15px;color:#d4d6e0;text-align:center;">With warm regards,<br/><strong style="color:#f5a623;">Team RankYatra 🏆</strong></p>
${FTR}</div>`,
  },
  {
    id: "notice",
    label: "⚠️ Notice / Warning",
    subject: "⚠️ Important Notice Regarding Your Account — RankYatra",
    html: `<div style="${BASE}">${HDR}
  <div style="background:#7f1d1d30;border:1px solid #f8717140;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;">
    <div style="font-size:36px;margin-bottom:8px;">⚠️</div>
    <div style="color:#f87171;font-size:18px;font-weight:800;">Account Notice</div>
    <div style="color:#a7a9be;font-size:13px;margin-top:4px;">Action may be required from your end</div>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#d4d6e0;">Dear <strong style="color:#fffffe;">{name}</strong>,</p>
  <p style="font-size:15px;line-height:1.8;color:#d4d6e0;">
    This is an official notice from RankYatra regarding your account <strong style="color:#f87171;">{uid}</strong>. Please read this notice carefully.
  </p>
  <div style="background:#1c1017;border:1px solid #f8717130;border-radius:12px;padding:20px;margin:20px 0;">
    <div style="color:#f87171;font-weight:800;font-size:15px;margin-bottom:12px;">⚠️ Notice Details</div>
    <p style="color:#d4d6e0;font-size:14px;line-height:1.7;margin:0;">
      [Write your notice or warning details here. Clearly explain what the issue is and what action the user needs to take.]
    </p>
  </div>
  <div style="background:#1a1929;border-radius:10px;padding:16px 20px;margin:16px 0;">
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;border-bottom:1px solid #2e2d3d;">Account UID</td><td style="color:#f87171;font-weight:700;text-align:right;padding:8px 0;font-size:14px;border-bottom:1px solid #2e2d3d;">{uid}</td></tr>
      <tr><td style="color:#a7a9be;padding:8px 0;font-size:14px;">Registered Email</td><td style="color:#fffffe;font-weight:600;text-align:right;padding:8px 0;font-size:14px;">{email}</td></tr>
    </table>
  </div>
  <p style="font-size:14px;line-height:1.7;color:#d4d6e0;">
    If you believe this notice was sent by mistake or you have already resolved the issue, please contact us immediately at <a href="mailto:support@rankyatra.in" style="color:#f5a623;">support@rankyatra.in</a>.
  </p>
  <p style="font-size:14px;color:#a7a9be;">
    Failure to take action within the specified timeframe may result in temporary or permanent suspension of your account.
  </p>
  <p style="font-size:15px;color:#d4d6e0;margin-top:24px;">
    Sincerely,<br/>
    <strong style="color:#fffffe;">RankYatra Compliance Team</strong>
  </p>
${FTR}</div>`,
  },
  {
    id: "contest",
    label: "🏆 Contest Alert",
    subject: "🏆 New Contest Alert — Register Now, {name}!",
    html: `<div style="${BASE}">${HDR}
  <div style="text-align:center;background:linear-gradient(135deg,#f5a62320,#92400e20);border:1px solid #f5a62340;border-radius:16px;padding:28px;margin-bottom:28px;">
    <div style="font-size:52px;margin-bottom:12px;">🏆</div>
    <div style="color:#f5a623;font-size:24px;font-weight:900;margin-bottom:6px;">New Contest Live!</div>
    <div style="color:#d4d6e0;font-size:15px;">Register now before seats fill up</div>
  </div>
  <p style="font-size:16px;line-height:1.7;color:#d4d6e0;">Hey <strong style="color:#fffffe;">{name}</strong>! 🎯</p>
  <p style="font-size:15px;line-height:1.8;color:#d4d6e0;">
    A brand new contest has just gone live on RankYatra! This is your chance to compete with thousands of students across India, showcase your knowledge, and win real cash prizes.
  </p>
  <div style="background:#1a1929;border-radius:14px;padding:0;margin:24px 0;overflow:hidden;border:1px solid #2e2d3d;">
    <div style="background:#f5a62315;padding:14px 20px;border-bottom:1px solid #2e2d3d;">
      <div style="color:#f5a623;font-weight:900;font-size:15px;letter-spacing:0.5px;">📋 CONTEST DETAILS</div>
    </div>
    <table style="width:100%;border-collapse:collapse;padding:0;">
      <tr style="border-bottom:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 20px;font-size:14px;">Contest Name</td><td style="color:#fffffe;font-weight:700;text-align:right;padding:12px 20px;font-size:14px;">[Contest Name Here]</td></tr>
      <tr style="border-bottom:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 20px;font-size:14px;">Start Time</td><td style="color:#fbbf24;font-weight:700;text-align:right;padding:12px 20px;font-size:14px;">[Date & Time]</td></tr>
      <tr style="border-bottom:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 20px;font-size:14px;">Entry Fee</td><td style="color:#f87171;font-weight:700;text-align:right;padding:12px 20px;font-size:14px;">₹[Amount]</td></tr>
      <tr style="border-bottom:1px solid #2e2d3d;"><td style="color:#a7a9be;padding:12px 20px;font-size:14px;">Prize Pool</td><td style="color:#4ade80;font-weight:900;text-align:right;padding:12px 20px;font-size:16px;">₹[Prize]</td></tr>
      <tr><td style="color:#a7a9be;padding:12px 20px;font-size:14px;">Your Wallet</td><td style="color:#f5a623;font-weight:700;text-align:right;padding:12px 20px;font-size:14px;">{wallet}</td></tr>
    </table>
  </div>
  <p style="font-size:14px;color:#a7a9be;text-align:center;">⚡ Limited seats available. Register before it's too late!</p>
  ${BTN("Register Now →", "https://rankyatra.in/exams")}
  <p style="color:#666;font-size:11px;text-align:center;">Good luck, {name}! May the best rank win. 🎯</p>
${FTR}</div>`,
  },
];

// ─── User search ──────────────────────────────────────────────────────────────
type UserOption = { id: number; name: string; email: string };

export default function AdminEmailCompose() {
  const { toast } = useToast();
  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [html, setHtml] = useState(TEMPLATES[0].html);
  const [activeTemplate, setActiveTemplate] = useState("promotional");
  const [showPreview, setShowPreview] = useState(true);
  const [target, setTarget] = useState<"all" | "specific">("all");
  const [userIdInput, setUserIdInput] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; failedEmails?: string[] } | null>(null);
  const [mode, setMode] = useState<"template" | "html">("template");

  const applyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setActiveTemplate(tmpl.id);
    setSubject(tmpl.subject);
    setHtml(tmpl.html);
    setResult(null);
  };

  const insertVar = (v: string) => {
    const el = htmlRef.current;
    if (!el) return;
    const s = el.selectionStart ?? html.length;
    const e = el.selectionEnd ?? html.length;
    const next = html.slice(0, s) + v + html.slice(e);
    setHtml(next);
    setTimeout(() => { el.selectionStart = el.selectionEnd = s + v.length; el.focus(); }, 0);
  };

  const parseUserId = () => {
    const n = parseInt(userIdInput.trim());
    return isNaN(n) ? null : n;
  };

  const canSend = subject.trim() && html.trim() && (target === "all" || parseUserId() !== null);

  const handleSend = async () => {
    if (!canSend || sending) return;
    const uid = parseUserId();
    const targetLabel = target === "all" ? "ALL USERS" : `User ID ${uid}`;
    const confirmed = window.confirm(
      `Send this email to ${targetLabel}?\n\nSubject: ${subject.slice(0, 60)}${subject.length > 60 ? "..." : ""}`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAuthToken()}` },
        body: JSON.stringify({
          subject: subject.trim(),
          html: html.trim(),
          target,
          userId: target === "specific" ? uid : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setResult({ sent: data.sent, failed: data.failed, total: data.total, failedEmails: data.failedEmails });
      toast({ title: `Email sent to ${data.sent} user(s)!` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
            <Link href="/admin"><ChevronLeft className="h-4 w-4 mr-1" />Admin</Link>
          </Button>
        </div>
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10">
            <Mail className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Email Compose</h1>
            <p className="text-muted-foreground text-sm">Send professional emails via SMTP — supports HTML templates & personalization</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* ── Left: Compose ── */}
          <div className="lg:col-span-3 space-y-5">

            {/* Template Selector */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Quick Templates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => applyTemplate(t)}
                      className={`text-xs px-3 py-1.5 rounded-full border font-semibold transition-all ${
                        activeTemplate === t.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground hover:border-primary/40 hover:text-primary"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Subject */}
            <Card>
              <CardContent className="pt-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Subject Line *</Label>
                  <Input
                    ref={subjectRef}
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. 🎉 Special Offer Just For You, {name}!"
                    className="text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {VARS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => {
                          const el = subjectRef.current;
                          if (!el) return;
                          const s = el.selectionStart ?? subject.length;
                          const e = el.selectionEnd ?? subject.length;
                          setSubject(subject.slice(0, s) + v.key + subject.slice(e));
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Toggle */}
                <div className="flex items-center gap-2 border-t pt-3">
                  <button
                    onClick={() => setMode("template")}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${mode === "template" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    <FileText className="h-3.5 w-3.5" /> Template HTML
                  </button>
                  <button
                    onClick={() => setMode("html")}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${mode === "html" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  >
                    <Code className="h-3.5 w-3.5" /> Custom HTML
                  </button>
                </div>

                {/* HTML Editor */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold flex items-center justify-between">
                    <span>Email Body (HTML) *</span>
                    <span className="text-xs text-muted-foreground font-normal">{html.length} chars</span>
                  </Label>
                  <textarea
                    ref={htmlRef}
                    value={html}
                    onChange={(e) => setHtml(e.target.value)}
                    rows={14}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y font-mono"
                    placeholder="Write HTML email body here..."
                    spellCheck={false}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {VARS.map((v) => (
                      <button
                        key={v.key}
                        onClick={() => insertVar(v.key)}
                        className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-mono"
                        title={`Example: ${v.example}`}
                      >
                        {v.key}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Selector */}
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
                    <Users className="h-4 w-4" /> All Users
                  </button>
                  <button
                    onClick={() => setTarget("specific")}
                    className={`flex-1 flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-semibold transition-all ${target === "specific" ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  >
                    <User className="h-4 w-4" /> Specific User
                  </button>
                </div>

                {target === "specific" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">User ID (find on Users page)</Label>
                    <Input
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      placeholder="e.g. 42"
                      className="text-sm font-mono"
                      type="number"
                    />
                    {userIdInput && parseUserId() === null && (
                      <p className="text-xs text-red-500">Please enter a valid numeric user ID</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2"
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showPreview ? "Hide" : "Preview"}
              </Button>
              <Button
                onClick={handleSend}
                disabled={!canSend || sending}
                className="flex-1 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sending ? (
                  <><span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</>
                ) : (
                  <><Send className="h-4 w-4" />Send Email</>
                )}
              </Button>
            </div>

            {/* Result */}
            {result && (
              <Card className={result.failed === 0 ? "border-green-300 bg-green-50/40" : "border-amber-300 bg-amber-50/40"}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2 mb-3">
                    {result.failed === 0
                      ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                      : <AlertCircle className="h-5 w-5 text-amber-600" />}
                    <span className="font-semibold text-sm">
                      {result.failed === 0 ? "All emails sent successfully!" : "Emails sent with some failures"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div><div className="text-xl font-black">{result.total}</div><div className="text-xs text-muted-foreground">Total</div></div>
                    <div><div className="text-xl font-black text-green-600">{result.sent}</div><div className="text-xs text-muted-foreground">Sent</div></div>
                    <div><div className="text-xl font-black text-red-500">{result.failed}</div><div className="text-xs text-muted-foreground">Failed</div></div>
                  </div>
                  {result.failedEmails && result.failedEmails.length > 0 && (
                    <div className="mt-3 text-xs text-muted-foreground">
                      Failed: {result.failedEmails.slice(0, 5).join(", ")}{result.failedEmails.length > 5 ? ` +${result.failedEmails.length - 5} more` : ""}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right: Preview + Tips ── */}
          <div className="lg:col-span-2 space-y-5">
            {/* Email Preview */}
            {showPreview && (
              <Card className="border-blue-200 dark:border-blue-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Eye className="h-4 w-4" /> Email Preview
                    <span className="text-xs text-muted-foreground font-normal ml-auto">sample data</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {/* Subject preview */}
                  <div className="bg-muted rounded-lg px-3 py-2 mb-2 text-xs">
                    <span className="text-muted-foreground">Subject: </span>
                    <span className="font-semibold text-foreground">{resolvePreview(subject) || "(no subject)"}</span>
                  </div>
                  {/* HTML preview in iframe */}
                  <div className="rounded-lg overflow-hidden border border-border" style={{ height: 480 }}>
                    <iframe
                      srcDoc={resolvePreview(html)}
                      className="w-full h-full"
                      sandbox="allow-same-origin"
                      title="Email Preview"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Variables Guide */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> Personalization Variables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <p className="text-xs text-muted-foreground mb-3">
                  Subject aur HTML dono mein use karo — har user ko unka personal data fill ho jayega automatically.
                </p>
                {VARS.map((v) => (
                  <div key={v.key} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                    <code className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">{v.key}</code>
                    <span className="text-xs text-muted-foreground">{v.example}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Tips */}
            <Card className="bg-blue-50/40 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4 pb-4 space-y-2">
                <p className="text-xs font-bold text-blue-800 dark:text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Email Best Practices
                </p>
                <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1.5 list-disc list-inside">
                  <li>Subject mein <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{`{name}`}</code> se open rate 30% badhti hai</li>
                  <li>Dark background email (like templates) Gmail mein perfectly render hota hai</li>
                  <li>Pehle ek specific user ko test email bhejo</li>
                  <li>HTML inline styles use karo — CSS class Gmail support nahi karta</li>
                  <li>Images ke liye absolute URLs use karo (https://...)</li>
                  <li>SMTP limit check karo agar bahut users hain</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
