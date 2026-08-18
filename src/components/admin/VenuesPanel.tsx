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

export type VenueRow = {
  id: string;
  venue_type: "partner" | "feeder";
  name: string;
  slug: string | null;
  tagline: string | null;
  location: string | null;
  intro: string | null;
  detail: string | null;
  image_url: string | null;
  logo_url: string | null;
  logo_bg_color: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  google_maps_url: string | null;
  highlights: { label: string }[];
  display_order: number;
  published: boolean;
};

type Form = Omit<VenueRow, "id" | "highlights"> & { highlights: { label: string }[] };

const emptyForm = (): Form => ({
  venue_type: "partner",
  name: "",
  slug: "",
  tagline: "",
  location: "",
  intro: "",
  detail: "",
  image_url: "",
  logo_url: "",
  logo_bg_color: "",
  website_url: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  google_maps_url: "",
  highlights: [],
  display_order: 0,
  published: true,
});

const uploadFile = async (file: File, prefix: string): Promise<string | null> => {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${prefix}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("news-media").upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
  return supabase.storage.from("news-media").getPublicUrl(path).data.publicUrl;
};

const ImageDropzone = ({
  value, onChange, prefix, label, aspect = "logo",
}: {
  value: string;
  onChange: (url: string) => void;
  prefix: string;
  label: string;
  aspect?: "logo" | "image";
  bg?: string;
}) => {
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) { toast.error("Please drop an image file"); return; }
    setBusy(true);
    const url = await uploadFile(f, prefix);
    setBusy(false);
    if (url) onChange(url);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-1 relative cursor-pointer rounded-md border-2 border-dashed transition-colors ${
          drag ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        } ${aspect === "logo" ? "p-3" : "p-4"}`}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => handleFile(e.target.files?.[0])} />
        {value ? (
          <div className="flex items-center gap-3">
            {aspect === "logo" ? (
              <div className="w-16 h-16 rounded-full overflow-hidden border bg-white shrink-0">
                <img src={value} alt="" className="w-full h-full object-contain p-1" />
              </div>
            ) : (
              <img src={value} alt="" className="w-24 h-16 rounded object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{value}</div>
              <div className="text-xs mt-1">Click or drop a new image to replace</div>
            </div>
            <Button size="sm" variant="ghost" type="button" onClick={e => { e.stopPropagation(); onChange(""); }}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-4 text-center text-sm text-muted-foreground">
            {busy ? <Loader2 className="w-6 h-6 animate-spin mb-1" /> : <Upload className="w-6 h-6 mb-1" />}
            <div>{busy ? "Uploading…" : "Drag & drop an image, or click to choose"}</div>
          </div>
        )}
      </div>
      <Input
        className="mt-2 text-xs"
        value={value}
        placeholder="or paste an image URL…"
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
};

const VenuesPanel = () => {
  const [items, setItems] = useState<VenueRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm());
  const [newHl, setNewHl] = useState("");
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("venues").select("*")
      .order("venue_type").order("display_order").order("name");
    setItems((data as unknown as VenueRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const startNew = () => { setEditingId(null); setForm(emptyForm()); };
  const startEdit = (v: VenueRow) => {
    setEditingId(v.id);
    setForm({
      venue_type: v.venue_type, name: v.name, slug: v.slug ?? "",
      tagline: v.tagline ?? "", location: v.location ?? "",
      intro: v.intro ?? "", detail: v.detail ?? "",
      image_url: v.image_url ?? "", logo_url: v.logo_url ?? "",
      logo_bg_color: v.logo_bg_color ?? "", website_url: v.website_url ?? "",
      contact_email: v.contact_email ?? "", contact_phone: v.contact_phone ?? "",
      address: v.address ?? "", google_maps_url: v.google_maps_url ?? "",
      highlights: Array.isArray(v.highlights) ? v.highlights : [],
      display_order: v.display_order, published: v.published,
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      ...form,
      name: form.name.trim(),
      slug: form.slug?.trim() || null,
      tagline: form.tagline?.trim() || null,
      location: form.location?.trim() || null,
      intro: form.intro?.trim() || null,
      detail: form.detail?.trim() || null,
      image_url: form.image_url?.trim() || null,
      logo_url: form.logo_url?.trim() || null,
      logo_bg_color: form.logo_bg_color?.trim() || null,
      website_url: form.website_url?.trim() || null,
      contact_email: form.contact_email?.trim() || null,
      contact_phone: form.contact_phone?.trim() || null,
      address: form.address?.trim() || null,
      google_maps_url: form.google_maps_url?.trim() || null,
      highlights: form.highlights as unknown as never,
    };
    const { error } = editingId
      ? await supabase.from("venues").update(payload).eq("id", editingId)
      : await supabase.from("venues").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Venue updated" : "Venue added");
    startNew(); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this venue?")) return;
    const { error } = await supabase.from("venues").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { if (editingId === id) startNew(); load(); toast.success("Deleted"); }
  };

  const togglePublished = async (v: VenueRow) => {
    const { error } = await supabase.from("venues").update({ published: !v.published }).eq("id", v.id);
    if (error) toast.error(error.message); else load();
  };

  const partners = items.filter(v => v.venue_type === "partner");
  const feeders = items.filter(v => v.venue_type === "feeder");

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card ref={formRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{editingId ? "Edit venue" : "Add a venue"}</CardTitle>
            {editingId && <Button size="sm" variant="ghost" onClick={startNew}><Plus className="w-4 h-4 mr-1" />New</Button>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Venue type</Label>
              <Select value={form.venue_type} onValueChange={(v) => setForm({ ...form, venue_type: v as "partner"|"feeder" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Partner venue (Performance hub)</SelectItem>
                  <SelectItem value="feeder">Feeder club</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.display_order}
                onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Slug (URL, optional)</Label>
              <Input value={form.slug ?? ""} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="david-lloyd" />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Tagline</Label>
              <Input value={form.tagline ?? ""} onChange={e => setForm({ ...form, tagline: e.target.value })} />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={form.location ?? ""} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Ipswich, Suffolk" />
            </div>
          </div>

          <div>
            <Label>Intro (shown on venues page)</Label>
            <Textarea rows={3} value={form.intro ?? ""} onChange={e => setForm({ ...form, intro: e.target.value })} />
          </div>
          <div>
            <Label>Detail (extra paragraph)</Label>
            <Textarea rows={3} value={form.detail ?? ""} onChange={e => setForm({ ...form, detail: e.target.value })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <ImageDropzone
              label="Main image"
              prefix="venues"
              aspect="image"
              value={form.image_url ?? ""}
              onChange={url => setForm(fm => ({ ...fm, image_url: url }))}
            />
            <div>
              <ImageDropzone
                label="Logo"
                prefix="venues"
                aspect="logo"
                value={form.logo_url ?? ""}
                onChange={url => setForm(fm => ({ ...fm, logo_url: url }))}
              />
              {form.logo_url && (
                <div className="mt-2 flex items-center gap-2">
                  <Label className="text-xs whitespace-nowrap">Logo bg:</Label>
                  <Input className="max-w-[140px]" placeholder="#ffffff"
                    value={form.logo_bg_color ?? ""}
                    onChange={e => setForm({ ...form, logo_bg_color: e.target.value })} />
                </div>
              )}
            </div>
          </div>


          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Website URL</Label>
              <Input value={form.website_url ?? ""} onChange={e => setForm({ ...form, website_url: e.target.value })} placeholder="https://…" />
            </div>
            <div>
              <Label>Google Maps URL</Label>
              <Input value={form.google_maps_url ?? ""} onChange={e => setForm({ ...form, google_maps_url: e.target.value })} />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input value={form.contact_email ?? ""} onChange={e => setForm({ ...form, contact_email: e.target.value })} />
            </div>
            <div>
              <Label>Contact phone</Label>
              <Input value={form.contact_phone ?? ""} onChange={e => setForm({ ...form, contact_phone: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Address</Label>
            <Textarea rows={2} value={form.address ?? ""} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>

          <div>
            <Label>Highlights (partner venues only)</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {form.highlights.map((h, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {h.label}
                  <button onClick={() => setForm(fm => ({ ...fm, highlights: fm.highlights.filter((_, ix) => ix !== i) }))}>
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={newHl} onChange={e => setNewHl(e.target.value)}
                placeholder="e.g. 6 Indoor Courts"
                onKeyDown={e => {
                  if (e.key === "Enter" && newHl.trim()) {
                    e.preventDefault();
                    setForm(fm => ({ ...fm, highlights: [...fm.highlights, { label: newHl.trim() }] }));
                    setNewHl("");
                  }
                }} />
              <Button type="button" variant="outline" onClick={() => {
                if (!newHl.trim()) return;
                setForm(fm => ({ ...fm, highlights: [...fm.highlights, { label: newHl.trim() }] }));
                setNewHl("");
              }}>Add</Button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} />
            Published (visible on website)
          </label>

          <Button className="w-full" onClick={save}>{editingId ? "Save changes" : "Add venue"}</Button>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Partner venues ({partners.length})</CardTitle></CardHeader>
          <CardContent>
            <VenueTable rows={partners} onEdit={startEdit} onDelete={remove} onToggle={togglePublished} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Feeder clubs ({feeders.length})</CardTitle></CardHeader>
          <CardContent>
            <VenueTable rows={feeders} onEdit={startEdit} onDelete={remove} onToggle={togglePublished} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const VenueTable = ({ rows, onEdit, onDelete, onToggle }: {
  rows: VenueRow[];
  onEdit: (v: VenueRow) => void;
  onDelete: (id: string) => void;
  onToggle: (v: VenueRow) => void;
}) => (
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Order</TableHead>
        <TableHead>Status</TableHead>
        <TableHead className="text-right">Actions</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {rows.map(v => (
        <TableRow key={v.id}>
          <TableCell className="font-medium">
            <div className="flex items-center gap-2">
              {v.logo_url && <img src={v.logo_url} className="w-8 h-8 rounded-full object-contain border" style={{ background: v.logo_bg_color || "#fff" }} />}
              <div>
                <div>{v.name}</div>
                {v.tagline && <div className="text-xs text-muted-foreground">{v.tagline}</div>}
              </div>
            </div>
          </TableCell>
          <TableCell>{v.display_order}</TableCell>
          <TableCell>
            <button onClick={() => onToggle(v)}>
              <Badge variant={v.published ? "default" : "secondary"}>{v.published ? "Live" : "Hidden"}</Badge>
            </button>
          </TableCell>
          <TableCell className="text-right space-x-1">
            <Button size="sm" variant="outline" onClick={() => onEdit(v)}><Pencil className="w-4 h-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => onDelete(v.id)}><Trash2 className="w-4 h-4" /></Button>
          </TableCell>
        </TableRow>
      ))}
      {rows.length === 0 && (
        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">None yet.</TableCell></TableRow>
      )}
    </TableBody>
  </Table>
);

export default VenuesPanel;
