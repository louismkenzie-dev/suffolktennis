import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Upload, X } from "lucide-react";
import CoachDirectory from "./CoachDirectory";

export type CoachRow = {
  id: string;
  linked_user_id: string | null;
  name: string;
  role: string | null;
  experience: string | null;
  qualification: string | null;
  specialty: string | null;
  photo_url: string | null;
  quote: string | null;
  bio: string | null;
  philosophy: string | null;
  achievements: string[];
  display_order: number;
  published: boolean;
};

type Form = Omit<CoachRow, "id" | "achievements"> & { achievements: string[] };

const emptyForm = (): Form => ({
  linked_user_id: null,
  name: "", role: "", experience: "", qualification: "",
  specialty: "", photo_url: "", quote: "", bio: "", philosophy: "",
  achievements: [], display_order: 0, published: true,
});

const uploadFile = async (file: File): Promise<string | null> => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `coaches/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("news-media").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
  return supabase.storage.from("news-media").getPublicUrl(path).data.publicUrl;
};

const CoachesPanel = ({ onEmailCoaches }: { onEmailCoaches?: (groupId: string) => void }) => {
  const [items, setItems] = useState<CoachRow[]>([]);
  const [users, setUsers] = useState<{ user_id: string; first_name: string; last_name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [newAch, setNewAch] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [{ data }, { data: p }] = await Promise.all([
      supabase.from("coaches").select("*").order("display_order").order("name"),
      supabase.from("profiles").select("user_id, first_name, last_name"),
    ]);
    setItems((data as unknown as CoachRow[]) ?? []);
    setUsers(p ?? []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditingId(null); setForm(emptyForm()); };
  const startEdit = (c: CoachRow) => {
    setEditingId(c.id);
    setForm({
      linked_user_id: c.linked_user_id,
      name: c.name, role: c.role ?? "", experience: c.experience ?? "",
      qualification: c.qualification ?? "", specialty: c.specialty ?? "",
      photo_url: c.photo_url ?? "", quote: c.quote ?? "",
      bio: c.bio ?? "", philosophy: c.philosophy ?? "",
      achievements: Array.isArray(c.achievements) ? c.achievements : [],
      display_order: c.display_order, published: c.published,
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      ...form,
      name: form.name.trim(),
      role: form.role?.trim() || null,
      experience: form.experience?.trim() || null,
      qualification: form.qualification?.trim() || null,
      specialty: form.specialty?.trim() || null,
      photo_url: form.photo_url?.trim() || null,
      quote: form.quote?.trim() || null,
      bio: form.bio?.trim() || null,
      philosophy: form.philosophy?.trim() || null,
      linked_user_id: form.linked_user_id || null,
      achievements: form.achievements as unknown as never,
    };
    const { error } = editingId
      ? await supabase.from("coaches").update(payload).eq("id", editingId)
      : await supabase.from("coaches").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Coach updated" : "Coach added");
    startNew(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this coach?")) return;
    const { error } = await supabase.from("coaches").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { if (editingId === id) startNew(); load(); toast.success("Deleted"); }
  };

  const togglePublished = async (c: CoachRow) => {
    const { error } = await supabase.from("coaches").update({ published: !c.published }).eq("id", c.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card ref={formRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{editingId ? "Edit coach" : "Add a coach"}</CardTitle>
            {editingId && <Button size="sm" variant="ghost" onClick={startNew}><Plus className="w-4 h-4 mr-1" />New</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Role</Label>
              <Input value={form.role ?? ""} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="10U Performance Lead" />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Experience</Label>
              <Input value={form.experience ?? ""} onChange={e => setForm({ ...form, experience: e.target.value })} placeholder="25 years" />
            </div>
            <div>
              <Label>Qualification</Label>
              <Input value={form.qualification ?? ""} onChange={e => setForm({ ...form, qualification: e.target.value })} placeholder="LTA Level 4" />
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.display_order}
                onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div>
            <Label>Specialty</Label>
            <Input value={form.specialty ?? ""} onChange={e => setForm({ ...form, specialty: e.target.value })} />
          </div>

          <div>
            <Label>Photo</Label>
            <div className="flex gap-2 items-center">
              <Input value={form.photo_url ?? ""} onChange={e => setForm({ ...form, photo_url: e.target.value })} placeholder="https://…" />
              <label className="shrink-0">
                <input type="file" accept="image/*" className="hidden"
                  onChange={async e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    setBusyPhoto(true);
                    const url = await uploadFile(f);
                    setBusyPhoto(false);
                    if (url) setForm(fm => ({ ...fm, photo_url: url }));
                  }} />
                <Button asChild size="sm" variant="outline" disabled={busyPhoto}>
                  <span>{busyPhoto ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}</span>
                </Button>
              </label>
            </div>
            {form.photo_url && <img src={form.photo_url} alt="" className="mt-2 rounded-md w-32 h-32 object-cover" />}
          </div>

          <div>
            <Label>Quote</Label>
            <Textarea rows={2} value={form.quote ?? ""} onChange={e => setForm({ ...form, quote: e.target.value })} />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea rows={3} value={form.bio ?? ""} onChange={e => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div>
            <Label>Philosophy</Label>
            <Textarea rows={3} value={form.philosophy ?? ""} onChange={e => setForm({ ...form, philosophy: e.target.value })} />
          </div>

          <div>
            <Label>Key achievements</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.achievements.map((a, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {a}
                  <button onClick={() => setForm(fm => ({ ...fm, achievements: fm.achievements.filter((_, ix) => ix !== i) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newAch} onChange={e => setNewAch(e.target.value)}
                placeholder="e.g. 25 years developing tennis talent"
                onKeyDown={e => {
                  if (e.key === "Enter" && newAch.trim()) {
                    e.preventDefault();
                    setForm(fm => ({ ...fm, achievements: [...fm.achievements, newAch.trim()] }));
                    setNewAch("");
                  }
                }} />
              <Button type="button" variant="outline" onClick={() => {
                if (!newAch.trim()) return;
                setForm(fm => ({ ...fm, achievements: [...fm.achievements, newAch.trim()] }));
                setNewAch("");
              }}>Add</Button>
            </div>
          </div>

          <div>
            <Label>Link to user account (optional — lets them edit their own profile)</Label>
            <Select value={form.linked_user_id ?? "none"}
              onValueChange={v => setForm({ ...form, linked_user_id: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Not linked" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not linked</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} />
            Published (visible on website)
          </label>

          <Button className="w-full" onClick={save}>{editingId ? "Save changes" : "Add coach"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Website coaches ({items.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Coach</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {c.photo_url ? <img src={c.photo_url} className="w-10 h-10 rounded-full object-cover" /> : <div className="w-10 h-10 rounded-full bg-muted" />}
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.role}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{c.display_order}</TableCell>
                  <TableCell>
                    <button onClick={() => togglePublished(c)}>
                      <Badge variant={c.published ? "default" : "secondary"}>{c.published ? "Live" : "Hidden"}</Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {items.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No coaches yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CoachDirectory onEmailCoaches={onEmailCoaches} />
    </div>
  );
};

export default CoachesPanel;
