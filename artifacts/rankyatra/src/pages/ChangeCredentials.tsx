import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Mail, Phone, RefreshCw, Check, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useGetProfile } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/auth";

export default function ChangeCredentials() {
  const { data: profile, refetch } = useGetProfile();
  const u = profile as any;
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const currentEmail = u?.email ?? "";
  const currentPhone = u?.phone ?? "";

  const hasEmailChanged = email.trim() !== "" && email.trim() !== currentEmail;
  const hasPhoneChanged = phone.trim() !== "" && phone.trim() !== currentPhone;
  const hasChanges = hasEmailChanged || hasPhoneChanged;

  const handleSave = async () => {
    if (hasEmailChanged && !email.includes("@")) {
      toast({ title: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (hasPhoneChanged && phone.trim().length < 6) {
      toast({ title: "Please enter a valid mobile number", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (hasEmailChanged) body.email = email.trim();
      if (hasPhoneChanged) body.phone = phone.trim();

      const token = getAuthToken();
      const res = await fetch("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Update failed", variant: "destructive" }); return; }
      refetch();
      setEmail(""); setPhone("");
    } catch {
      toast({ title: "Network error. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-6 max-w-lg pb-20">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/profile"><ArrowLeft className="h-4 w-4 mr-1" /> Profile</Link>
          </Button>
          <h1 className="text-xl font-black">Change Email & Mobile</h1>
        </div>

        {/* Info Banner */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-primary font-medium mb-6">
          You can update your registered email ID and mobile number here. Make sure the new details are correct.
        </div>

        {/* Current Details */}
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Current Details</p>
        <div className="rounded-xl border border-border bg-card overflow-hidden mb-6">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-14">Email</span>
            <span className="text-sm font-semibold text-foreground flex-1">{currentEmail || "—"}</span>
          </div>
          <Separator />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground w-14">Mobile</span>
            <span className="text-sm font-semibold text-foreground flex-1">{currentPhone || "Not added"}</span>
          </div>
        </div>

        {/* New Details Form */}
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">New Details</p>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-semibold">New Email ID</Label>
            <div className={`flex items-center gap-2 rounded-xl border-2 px-3 transition-colors ${hasEmailChanged ? "border-primary" : "border-border"} bg-card`}>
              <Mail className={`h-4 w-4 shrink-0 ${hasEmailChanged ? "text-primary" : "text-muted-foreground"}`} />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={currentEmail || "Enter new email"}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {hasEmailChanged && (
                <button onClick={() => setEmail("")}><X className="h-4 w-4 text-muted-foreground" /></button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold">New Mobile Number</Label>
            <div className={`flex items-center gap-2 rounded-xl border-2 px-3 transition-colors ${hasPhoneChanged ? "border-primary" : "border-border"} bg-card`}>
              <Phone className={`h-4 w-4 shrink-0 ${hasPhoneChanged ? "text-primary" : "text-muted-foreground"}`} />
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={currentPhone || "Enter new mobile number"}
                className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
              />
              {hasPhoneChanged && (
                <button onClick={() => setPhone("")}><X className="h-4 w-4 text-muted-foreground" /></button>
              )}
            </div>
          </div>

          <Button
            className="w-full mt-2"
            disabled={!hasChanges || saving}
            onClick={handleSave}
          >
            {saving ? (
              <><div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" /> Saving...</>
            ) : (
              <><Check className="h-4 w-4 mr-1.5" /> Save Changes</>
            )}
          </Button>

          <Button variant="ghost" className="w-full" asChild>
            <Link href="/profile">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
