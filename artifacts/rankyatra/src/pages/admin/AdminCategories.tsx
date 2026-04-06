import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, ChevronLeft, Eye, EyeOff, Tag } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getApiUrl } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

type Category = {
  id: number;
  name: string;
  displayOrder: number;
  isActive: boolean;
};

export default function AdminCategories() {
  const qc = useQueryClient();
  const token = getAuthToken();
  const { toast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: "", displayOrder: 0 });

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/admin/categories"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing
        ? getApiUrl(`/api/admin/categories/${editing.id}`)
        : getApiUrl("/api/admin/categories");
      const r = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: form.name.trim(), displayOrder: form.displayOrder, isActive: true }),
      });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.error ?? "Failed to save");
      }
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setShowForm(false);
      setEditing(null);
      setForm({ name: "", displayOrder: 0 });
      toast({ title: editing ? "Category updated" : "Category created" });
    },
    onError: (e: any) => toast({ title: e.message ?? "Error", variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      await fetch(getApiUrl(`/api/admin/categories/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      toast({ title: "Category deleted" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Category) => {
      await fetch(getApiUrl(`/api/admin/categories/${c.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !c.isActive }),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-categories"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });

  function openNew() {
    setEditing(null);
    setForm({ name: "", displayOrder: categories.length });
    setShowForm(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, displayOrder: c.displayOrder });
    setShowForm(true);
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 max-w-xl pb-24 pt-5">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-black">Exam Categories</h1>
            <p className="text-sm text-muted-foreground">{categories.length} categories · shown in Browse Exams</p>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {showForm && (
          <Card className="mb-5 border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{editing ? "Edit Category" : "New Category"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs mb-1 block">Category Name *</Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. State PSC, NDA, CTET..."
                  onKeyDown={e => e.key === "Enter" && form.name.trim() && save.mutate()}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Display Order</Label>
                <Input
                  type="number"
                  value={form.displayOrder}
                  onChange={e => setForm(f => ({ ...f, displayOrder: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => save.mutate()}
                  disabled={save.isPending || !form.name.trim()}
                  className="flex-1"
                >
                  {save.isPending ? "Saving…" : editing ? "Update" : "Create"}
                </Button>
                <Button variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Tag className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-semibold">No categories yet</p>
            <p className="text-sm mt-1">Add categories to show in Browse Exams filter</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((c) => (
              <Card key={c.id} className={`transition-opacity ${c.isActive ? "" : "opacity-40"}`}>
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <Tag className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Order: {c.displayOrder}</p>
                  </div>
                  <Badge variant={c.isActive ? "default" : "secondary"} className="text-xs">
                    {c.isActive ? "Active" : "Hidden"}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive.mutate(c)}>
                    {c.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6 p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground mb-1">How it works</p>
          <p>Categories you create here appear as filter tabs in the Browse Exams section. When you create an exam and select a category, it will automatically appear under that filter.</p>
        </div>
      </div>
    </div>
  );
}
