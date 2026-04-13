import { useState, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronLeft, Eye, EyeOff, GripVertical, Image, Upload, X } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type Banner = {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  linkUrl: string;
  linkLabel: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
};

const EMPTY: Omit<Banner, "id"> = {
  title: "",
  subtitle: "",
  emoji: "⚡",
  bgFrom: "#f97316",
  bgTo: "#ea580c",
  linkUrl: "/",
  linkLabel: "Join Now",
  imageUrl: null,
  displayOrder: 0,
  isActive: true,
};

export default function AdminBanners() {
  const qc = useQueryClient();
  const token = getAuthToken();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState<Omit<Banner, "id">>(EMPTY);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [bannerType, setBannerType] = useState<"text" | "image">("text");

  const { data: banners = [], isLoading } = useQuery<Banner[]>({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/admin/banners"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const r = await fetch(getApiUrl("/api/admin/banners/upload-image"), {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!r.ok) throw new Error("Upload failed");
      const data = await r.json();
      setForm(f => ({ ...f, imageUrl: data.url }));
      toast({ title: "Image uploaded!" });
    } catch {
      toast({ title: "Image upload failed", variant: "destructive" });
    } finally {
      setUploadingImage(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      const url = editing
        ? getApiUrl(`/api/admin/banners/${editing.id}`)
        : getApiUrl("/api/admin/banners");
      const payload = bannerType === "image"
        ? { ...form, title: form.title || "Image Banner", subtitle: "", emoji: "" }
        : { ...form, imageUrl: null };
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error("Failed to save banner");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY);
      setBannerType("text");
      toast({ title: editing ? "Banner updated" : "Banner created" });
    },
    onError: () => toast({ title: "Error saving banner", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await fetch(getApiUrl(`/api/admin/banners/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-banners"] });
      toast({ title: "Banner deleted" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (b: Banner) => {
      await fetch(getApiUrl(`/api/admin/banners/${b.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...b, isActive: !b.isActive }),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-banners"] }),
  });

  function openNew() {
    setEditing(null);
    setForm({ ...EMPTY, displayOrder: banners.length });
    setBannerType("text");
    setShowForm(true);
  }

  function openEdit(b: Banner) {
    setEditing(b);
    setForm({ title: b.title, subtitle: b.subtitle, emoji: b.emoji, bgFrom: b.bgFrom, bgTo: b.bgTo, linkUrl: b.linkUrl, linkLabel: b.linkLabel, imageUrl: b.imageUrl, displayOrder: b.displayOrder, isActive: b.isActive });
    setBannerType(b.imageUrl ? "image" : "text");
    setShowForm(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 max-w-2xl pb-24 pt-5">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black">Banner Management</h1>
            <p className="text-sm text-muted-foreground">{banners.length} banners · home page slider</p>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add Banner
          </Button>
        </div>

        {showForm && (
          <Card className="mb-6 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editing ? "Edit Banner" : "New Banner"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Banner type selector */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={bannerType === "text" ? "default" : "outline"}
                  onClick={() => setBannerType("text")}
                  className="flex-1"
                >
                  Text Banner
                </Button>
                <Button
                  size="sm"
                  variant={bannerType === "image" ? "default" : "outline"}
                  onClick={() => setBannerType("image")}
                  className="flex-1"
                >
                  <Image className="h-4 w-4 mr-1" /> Image Banner
                </Button>
              </div>

              {bannerType === "image" ? (
                /* ── Image Banner Fields ── */
                <div className="space-y-3">
                  {/* Image upload */}
                  <div>
                    <Label className="text-xs mb-1 block">Banner Image (PNG recommended) *</Label>
                    <div className="text-xs text-muted-foreground mb-2">
                      Recommended size: <strong>1200 × 375px</strong> · Aspect ratio 16:5 · Max 5MB
                    </div>
                    {form.imageUrl ? (
                      <div className="relative rounded-xl overflow-hidden border">
                        <img src={form.imageUrl} alt="Banner preview" className="w-full h-32 object-cover" />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={() => setForm(f => ({ ...f, imageUrl: null }))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <div
                        className="border-2 border-dashed border-primary/30 rounded-xl p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {uploadingImage ? (
                          <p className="text-sm text-muted-foreground">Uploading...</p>
                        ) : (
                          <>
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                            <p className="text-sm font-medium">Click to upload banner image</p>
                            <p className="text-xs text-muted-foreground mt-1">PNG, JPG · 1200×375px</p>
                          </>
                        )}
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Title (shown as alt text)</Label>
                      <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Image Banner" />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs mb-1 block">Link URL</Label>
                      <Input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="/" />
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">Display Order</Label>
                      <Input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Text Banner Fields ── */
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs mb-1 block">Title *</Label>
                    <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Win ₹50,000+ Cash Prizes" />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs mb-1 block">Subtitle</Label>
                    <Input value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Pay ₹5 · Compete with top aspirants" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Emoji / Icon</Label>
                    <Input value={form.emoji} onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))} placeholder="⚡" className="text-xl" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Button Label</Label>
                    <Input value={form.linkLabel} onChange={e => setForm(f => ({ ...f, linkLabel: e.target.value }))} placeholder="Join Now" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Gradient Start</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.bgFrom} onChange={e => setForm(f => ({ ...f, bgFrom: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={form.bgFrom} onChange={e => setForm(f => ({ ...f, bgFrom: e.target.value }))} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Gradient End</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={form.bgTo} onChange={e => setForm(f => ({ ...f, bgTo: e.target.value }))} className="h-9 w-12 rounded border cursor-pointer" />
                      <Input value={form.bgTo} onChange={e => setForm(f => ({ ...f, bgTo: e.target.value }))} className="font-mono text-xs" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs mb-1 block">Link URL</Label>
                    <Input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} placeholder="/" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Display Order</Label>
                    <Input type="number" value={form.displayOrder} onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))} />
                  </div>

                  {/* Preview */}
                  <div className="col-span-2 rounded-xl p-4 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${form.bgFrom}, ${form.bgTo})` }}>
                    <span className="text-2xl">{form.emoji || "⚡"}</span>
                    <div className="flex-1">
                      <p className="text-white font-black text-sm leading-tight">{form.title || "Banner Title"}</p>
                      <p className="text-white/70 text-xs mt-0.5">{form.subtitle || "Subtitle goes here"}</p>
                    </div>
                    <span className="text-xs font-bold text-white bg-white/20 px-2 py-1 rounded-lg">{form.linkLabel}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || (bannerType === "image" ? !form.imageUrl : !form.title)}
                  className="flex-1"
                >
                  {save.isPending ? "Saving…" : editing ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); setForm(EMPTY); }}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading banners…</div>
        ) : banners.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No banners yet</p>
            <p className="text-sm mt-1">Add banners to show on the home page slider</p>
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b) => (
              <Card key={b.id} className={`transition-opacity ${b.isActive ? "" : "opacity-50"}`}>
                <CardContent className="p-0 overflow-hidden rounded-xl">
                  {b.imageUrl ? (
                    <div className="relative rounded-t-xl overflow-hidden h-28">
                      <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/20" />
                      <span className="absolute top-2 left-2 text-xs font-bold text-white bg-black/40 px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Image className="h-3 w-3" /> Image Banner
                      </span>
                    </div>
                  ) : (
                    <div className="rounded-t-xl p-3 flex items-center gap-3" style={{ background: `linear-gradient(135deg, ${b.bgFrom}, ${b.bgTo})` }}>
                      <span className="text-xl">{b.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-black text-sm truncate">{b.title}</p>
                        {b.subtitle && <p className="text-white/70 text-xs truncate">{b.subtitle}</p>}
                      </div>
                      <span className="text-xs font-bold text-white bg-white/20 px-2 py-0.5 rounded-lg shrink-0">{b.linkLabel}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground flex-1">Order: {b.displayOrder} · {b.linkUrl}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive.mutate(b)} title={b.isActive ? "Hide" : "Show"}>
                      {b.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this banner?")) del.mutate(b.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
