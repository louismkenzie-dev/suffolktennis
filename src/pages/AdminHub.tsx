import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Shield, Users, FileText, Target, CalendarDays, Newspaper, UserCog,
  LogOut, ArrowLeft, Trash2, Plus, Send, Sparkles, Upload, X, Loader2, ImageIcon, Video, Star, Pencil, Award, Crop, MapPin, GraduationCap, Ticket,
} from "lucide-react";
import VenuesPanel from "@/components/admin/VenuesPanel";
import CoachesPanel from "@/components/admin/CoachesPanel";
import BookingsPanel from "@/components/admin/BookingsPanel";
import { useSignedUrl } from "@/hooks/useSignedUrl";



type Profile = {
  user_id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  primary_phone?: string | null;
  secondary_phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  address_city?: string | null;
  address_postcode?: string | null;
  plays_tennis?: boolean | null;
  playing_ability?: string | null;
  parent_notes?: string | null;
};

type Child = {
  id: string;
  parent_user_id: string;
  name: string;
  photo_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  btm_number: string | null;
  county_rank: number | null;
  national_rank: number | null;
  favorite_player: string | null;
  favorite_shot: string | null;
  handedness: string | null;
  has_medical_needs: boolean;
  has_send_needs: boolean;
};

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  age_group: string | null;
  capacity: number | null;
  event_type?: string | null;
  poster_url?: string | null;
  featured?: boolean | null;
  cost?: string | null;
  sign_up_enabled?: boolean | null;
  session_slots?: string[] | null;
};

type NewsMedia = { url: string; type: "image" | "video"; name?: string; focal_x?: number; focal_y?: number };

type NewsRow = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  media: NewsMedia[] | null;
  article_date: string | null;
  published: boolean;
  created_at: string;
};


type AdminRow = { user_id: string; first_name?: string; last_name?: string; email?: string };

const AdminHub = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Admin access required</h1>
        <p className="text-muted-foreground text-center max-w-md">
          Your account does not have administrator privileges. Contact a Suffolk Tennis admin if you believe this is a mistake.
        </p>
        <Button asChild variant="outline"><Link to="/parent-hub"><ArrowLeft className="w-4 h-4 mr-2" />Back to Parent Hub</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            <div>
              <h1 className="font-bold text-lg leading-tight">Admin Hub</h1>
              <p className="text-xs text-muted-foreground">Suffolk Tennis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoleViewSwitcher className="max-sm:hidden" />
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" />Sign out
            </Button>
          </div>
        </div>
      </header>
      <div className="sm:hidden container mx-auto px-4 pt-3">
        <RoleViewSwitcher />
      </div>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="families" className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-10 w-full mb-6 h-auto">
            <TabsTrigger value="bookings" className="gap-2"><Ticket className="w-4 h-4" />Bookings</TabsTrigger>
            <TabsTrigger value="families" className="gap-2"><Users className="w-4 h-4" />Families</TabsTrigger>
            <TabsTrigger value="reports" className="gap-2"><FileText className="w-4 h-4" />Reports</TabsTrigger>
            <TabsTrigger value="goals" className="gap-2"><Target className="w-4 h-4" />Goals</TabsTrigger>
            <TabsTrigger value="events" className="gap-2"><CalendarDays className="w-4 h-4" />Events</TabsTrigger>
            <TabsTrigger value="news" className="gap-2"><Newspaper className="w-4 h-4" />News</TabsTrigger>
            <TabsTrigger value="players" className="gap-2"><Star className="w-4 h-4" />Players</TabsTrigger>
            <TabsTrigger value="venues" className="gap-2"><MapPin className="w-4 h-4" />Venues</TabsTrigger>
            <TabsTrigger value="coaches" className="gap-2"><GraduationCap className="w-4 h-4" />Coaches</TabsTrigger>
            <TabsTrigger value="admins" className="gap-2"><UserCog className="w-4 h-4" />Admins</TabsTrigger>
          </TabsList>

          <TabsContent value="bookings"><BookingsPanel /></TabsContent>
          <TabsContent value="families"><FamiliesPanel /></TabsContent>
          <TabsContent value="reports"><ReportsPanel /></TabsContent>
          <TabsContent value="goals"><GoalsPanel /></TabsContent>
          <TabsContent value="events"><EventsPanel currentUserId={user!.id} /></TabsContent>
          <TabsContent value="news"><NewsPanel /></TabsContent>
          <TabsContent value="players"><PlayerWatchPanel /></TabsContent>
          <TabsContent value="venues"><VenuesPanel /></TabsContent>
          <TabsContent value="coaches"><CoachesPanel /></TabsContent>
          <TabsContent value="admins"><AdminsPanel /></TabsContent>

        </Tabs>
      </main>
    </div>
  );
};

/* ---------- Families ---------- */
const FamiliesPanel = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: pData }, { data: cData }, { data: eData }] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name, phone, primary_phone, secondary_phone, address_line1, address_line2, address_city, address_postcode, plays_tennis, playing_ability, parent_notes"),
      supabase.from("children").select("*").order("name"),
      supabase.rpc("get_parent_emails"),
    ]);
    setProfiles(pData ?? []);
    setChildren((cData ?? []) as Child[]);
    const em = new Map<string, string>();
    (eData ?? []).forEach((r: { user_id: string; email: string }) => em.set(r.user_id, r.email));
    setEmails(em);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach(p => m.set(p.user_id, p));
    return m;
  }, [profiles]);

  const childrenByParent = useMemo(() => {
    const m = new Map<string, Child[]>();
    children.forEach(c => {
      const list = m.get(c.parent_user_id) ?? [];
      list.push(c);
      m.set(c.parent_user_id, list);
    });
    return m;
  }, [children]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>All families ({children.length} children · {profiles.length} parents)</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground">Loading…</p> : (
          <Tabs defaultValue="children" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="children" className="gap-2"><Users className="w-4 h-4" />Children ({children.length})</TabsTrigger>
              <TabsTrigger value="parents" className="gap-2"><UserCog className="w-4 h-4" />Parents ({profiles.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="children">
              <ChildrenTab
                children={children}
                profileMap={profileMap}
                onChanged={load}
              />
            </TabsContent>

            <TabsContent value="parents">
              <ParentsTab
                profiles={profiles}
                emails={emails}
                childrenByParent={childrenByParent}
                onChanged={load}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

/* ---------- Children tab ---------- */
const ChildrenTab = ({
  children, profileMap, onChanged,
}: {
  children: Child[];
  profileMap: Map<string, Profile>;
  onChanged: () => void;
}) => {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Child | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const sorted = [...children].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter(c => {
      const p = profileMap.get(c.parent_user_id);
      const parentName = p ? `${p.first_name} ${p.last_name}`.toLowerCase() : "";
      return c.name.toLowerCase().includes(q) || parentName.includes(q) || (c.btm_number ?? "").toLowerCase().includes(q);
    });
  }, [children, query, profileMap]);

  const deleteChild = async (id: string) => {
    if (!confirm("Permanently delete this child profile? This cannot be undone.")) return;
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Child deleted"); onChanged(); }
  };

  return (
    <>
      <Input
        placeholder="Search by child, parent or BTM number…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Child</TableHead>
              <TableHead>Parent</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Gender</TableHead>
              <TableHead>BTM</TableHead>
              <TableHead>County / National</TableHead>
              <TableHead>Handedness</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(c => {
              const p = profileMap.get(c.parent_user_id);
              const age = c.date_of_birth ? Math.floor((Date.now() - new Date(c.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
              return (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setEditing(c)}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-3">
                      <ChildAvatar photoUrl={c.photo_url} name={c.name} size={36} />
                      <span className="underline-offset-2 hover:underline">{c.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{p ? `${p.first_name} ${p.last_name}` : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {age !== null ? (
                      <span title={`DOB: ${c.date_of_birth}`} className="cursor-help underline decoration-dotted underline-offset-2">
                        {age}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>{c.gender ?? "—"}</TableCell>
                  <TableCell>{c.btm_number ?? "—"}</TableCell>
                  <TableCell>{c.county_rank ?? "—"} / {c.national_rank ?? "—"}</TableCell>
                  <TableCell>{c.handedness ?? "—"}</TableCell>
                  <TableCell className="space-x-1">
                    {c.has_medical_needs && <Badge variant="destructive">Medical</Badge>}
                    {c.has_send_needs && <Badge variant="secondary">SEND</Badge>}
                  </TableCell>
                  <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="outline" onClick={() => setEditing(c)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteChild(c.id)}><Trash2 className="w-4 h-4" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No children found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ChildEditDialog
        child={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); onChanged(); }}
      />
    </>
  );
};

const ChildEditDialog = ({ child, onClose, onSaved }: { child: Child | null; onClose: () => void; onSaved: () => void }) => {
  const [form, setForm] = useState<Child | null>(child);
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setForm(child); setPhotoFile(null); setPhotoPreview(null); }, [child]);

  if (!form) return null;
  const update = <K extends keyof Child>(k: K, v: Child[K]) => setForm({ ...form, [k]: v });

  const onPickPhoto = (f: File | null) => {
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    setSaving(true);
    try {
      let photo_url = form.photo_url;
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const path = `${form.parent_user_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("child-photos").upload(path, photoFile, { upsert: false });
        if (upErr) throw upErr;
        photo_url = path;
      }
      const { error } = await supabase.from("children").update({
        name: form.name,
        date_of_birth: form.date_of_birth,
        gender: form.gender,
        btm_number: form.btm_number,
        county_rank: form.county_rank,
        national_rank: form.national_rank,
        favorite_player: form.favorite_player,
        favorite_shot: form.favorite_shot,
        handedness: form.handedness,
        has_medical_needs: form.has_medical_needs,
        has_send_needs: form.has_send_needs,
        photo_url,
      }).eq("id", form.id);
      if (error) throw error;
      toast.success("Child updated");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!child} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {form.name}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-2 mb-2">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-24 h-24 rounded-full object-cover border" />
          ) : (
            <ChildAvatar photoUrl={form.photo_url} name={form.name} size={96} />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            {photoFile ? "Change photo" : (form.photo_url ? "Replace photo" : "Upload photo")}
          </Button>
          {photoFile && <p className="text-xs text-muted-foreground">Will save on “Save changes”</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={e => update("name", e.target.value)} /></div>
          <div><Label>Date of birth {form.date_of_birth && <span className="text-muted-foreground font-normal">(age {Math.floor((Date.now() - new Date(form.date_of_birth).getTime()) / 31557600000)})</span>}</Label><Input type="date" value={form.date_of_birth ?? ""} onChange={e => update("date_of_birth", e.target.value || null)} /></div>
          <div>
            <Label>Gender</Label>
            <Select value={form.gender ?? ""} onValueChange={(v) => update("gender", v || null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boy">Boy</SelectItem>
                <SelectItem value="girl">Girl</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>BTM number</Label><Input value={form.btm_number ?? ""} onChange={e => update("btm_number", e.target.value || null)} /></div>
          <div>
            <Label>Handedness</Label>
            <Select value={form.handedness ?? ""} onValueChange={(v) => update("handedness", v || null)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>County rank</Label><Input type="number" value={form.county_rank ?? ""} onChange={e => update("county_rank", e.target.value === "" ? null : parseInt(e.target.value))} /></div>
          <div><Label>National rank</Label><Input type="number" value={form.national_rank ?? ""} onChange={e => update("national_rank", e.target.value === "" ? null : parseInt(e.target.value))} /></div>
          <div><Label>Favourite player</Label><Input value={form.favorite_player ?? ""} onChange={e => update("favorite_player", e.target.value || null)} /></div>
          <div><Label>Favourite shot</Label><Input value={form.favorite_shot ?? ""} onChange={e => update("favorite_shot", e.target.value || null)} /></div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.has_medical_needs} onCheckedChange={(v) => update("has_medical_needs", !!v)} />Medical needs</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.has_send_needs} onCheckedChange={(v) => update("has_send_needs", !!v)} />SEND needs</label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/* ---------- Parents tab ---------- */
const ParentsTab = ({
  profiles, emails, childrenByParent, onChanged,
}: {
  profiles: Profile[];
  emails: Map<string, string>;
  childrenByParent: Map<string, Child[]>;
  onChanged: () => void | Promise<void>;
}) => {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const sorted = [...profiles].sort((a, b) => (a.first_name || "").localeCompare(b.first_name || "") || (a.last_name || "").localeCompare(b.last_name || ""));
    if (!q) return sorted;
    return sorted.filter(p => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      const email = (emails.get(p.user_id) ?? "").toLowerCase();
      const phone = `${p.primary_phone ?? ""} ${p.phone ?? ""} ${p.secondary_phone ?? ""}`;
      const kids = (childrenByParent.get(p.user_id) ?? []).map(k => k.name.toLowerCase()).join(" ");
      return name.includes(q) || email.includes(q) || phone.includes(q) || kids.includes(q);
    });
  }, [profiles, query, emails, childrenByParent]);

  return (
    <>
      <Input
        placeholder="Search by parent, email, phone or child name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4 max-w-md"
      />
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parent</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Children</TableHead>
              <TableHead>City</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => {
              const kids = childrenByParent.get(p.user_id) ?? [];
              const email = emails.get(p.user_id);
              const phone = p.primary_phone || p.phone;
              return (
                <TableRow key={p.user_id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(p)}>
                  <TableCell className="font-medium">{p.first_name} {p.last_name}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {email ? <a href={`mailto:${email}`} className="text-primary hover:underline">{email}</a> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {phone ? <a href={`tel:${phone}`} className="text-primary hover:underline">{phone}</a> : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-flex items-center gap-1 relative group"
                      title={kids.map(k => k.name).join(", ") || "No children"}
                    >
                      <Badge variant="secondary">{kids.length}</Badge>
                      {kids.length > 0 && (
                        <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[220px]">
                          {kids.map(k => k.name).join(", ")}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>{p.address_city ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelected(p)}>View</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No parents found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? `${selected.first_name} ${selected.last_name}` : ""}</DialogTitle>
          </DialogHeader>
          {selected && (() => {
            const email = emails.get(selected.user_id);
            const kids = childrenByParent.get(selected.user_id) ?? [];
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Email</p>
                    {email ? <a href={`mailto:${email}`} className="text-primary hover:underline font-medium">{email}</a> : <p className="font-medium">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Primary phone</p>
                    {selected.primary_phone || selected.phone
                      ? <a href={`tel:${selected.primary_phone ?? selected.phone}`} className="text-primary hover:underline font-medium">{selected.primary_phone ?? selected.phone}</a>
                      : <p className="font-medium">—</p>}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Secondary phone</p>
                    {selected.secondary_phone
                      ? <a href={`tel:${selected.secondary_phone}`} className="text-primary hover:underline font-medium">{selected.secondary_phone}</a>
                      : <p className="font-medium">—</p>}
                  </div>
                  <Info label="Address line 1" value={selected.address_line1} />
                  <Info label="Address line 2" value={selected.address_line2} />
                  <Info label="City" value={selected.address_city} />
                  <Info label="Postcode" value={selected.address_postcode} />
                  <Info label="Plays tennis" value={selected.plays_tennis ? "Yes" : "No"} />
                  <Info label="Playing ability" value={selected.playing_ability} />
                  <div className="col-span-2">
                    <Info label="Notes" value={selected.parent_notes} />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Children ({kids.length})</p>
                  {kids.length === 0 ? <p className="text-sm text-muted-foreground">No children registered.</p> : (
                    <div className="space-y-2">
                      {kids.map(k => (
                        <div key={k.id} className="flex items-center gap-3 border rounded-md p-2">
                          <ChildAvatar photoUrl={k.photo_url} name={k.name} size={40} />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{k.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {k.date_of_birth ?? "DOB —"} · {k.gender ?? "—"} · BTM {k.btm_number ?? "—"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          {selected && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditing(selected); setSelected(null); }}>
                <Pencil className="w-4 h-4 mr-2" />Edit details
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <ParentEditDialog
        parent={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await onChanged(); }}
      />
    </>
  );
};

const ParentEditDialog = ({ parent, onClose, onSaved }: {
  parent: Profile | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) => {
  const [form, setForm] = useState<Profile | null>(parent);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setForm(parent); }, [parent]);

  if (!form) return null;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setForm({ ...form, [k]: v });

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      primary_phone: form.primary_phone,
      secondary_phone: form.secondary_phone,
      address_line1: form.address_line1,
      address_line2: form.address_line2,
      address_city: form.address_city,
      address_postcode: form.address_postcode,
      plays_tennis: form.plays_tennis,
      playing_ability: form.playing_ability,
      parent_notes: form.parent_notes,
    }).eq("user_id", form.user_id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Parent updated");
    await onSaved();
  };

  return (
    <Dialog open={!!parent} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {form.first_name} {form.last_name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} /></div>
          <div><Label>Last name</Label><Input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} /></div>
          <div><Label>Primary phone</Label><Input value={form.primary_phone ?? ""} onChange={(e) => set("primary_phone", e.target.value)} /></div>
          <div><Label>Secondary phone</Label><Input value={form.secondary_phone ?? ""} onChange={(e) => set("secondary_phone", e.target.value)} /></div>
          <div className="col-span-2"><Label>Address line 1</Label><Input value={form.address_line1 ?? ""} onChange={(e) => set("address_line1", e.target.value)} /></div>
          <div className="col-span-2"><Label>Address line 2</Label><Input value={form.address_line2 ?? ""} onChange={(e) => set("address_line2", e.target.value)} /></div>
          <div><Label>City</Label><Input value={form.address_city ?? ""} onChange={(e) => set("address_city", e.target.value)} /></div>
          <div><Label>Postcode</Label><Input value={form.address_postcode ?? ""} onChange={(e) => set("address_postcode", e.target.value)} /></div>
          <div className="flex items-center gap-2 pt-6">
            <Checkbox id="plays" checked={!!form.plays_tennis} onCheckedChange={(v) => set("plays_tennis", !!v)} />
            <Label htmlFor="plays">Parent plays tennis</Label>
          </div>
          <div>
            <Label>Playing ability</Label>
            <Input value={form.playing_ability ?? ""} onChange={(e) => set("playing_ability", e.target.value)} placeholder="e.g. Intermediate" />
          </div>
          <div className="col-span-2"><Label>Notes</Label><Textarea rows={3} value={form.parent_notes ?? ""} onChange={(e) => set("parent_notes", e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Info = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div>
    <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
    <p className="font-medium">{value || "—"}</p>
  </div>
);


const ChildAvatar = ({ photoUrl, name, size = 36 }: { photoUrl: string | null; name: string; size?: number }) => {
  const signed = useSignedUrl("child-photos", photoUrl);
  const initials = name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
  const style = { width: size, height: size };
  if (signed) {
    return (
      <img
        src={signed}
        alt={name}
        style={style}
        className="rounded-full object-cover border border-border shrink-0"
      />
    );
  }
  return (
    <div
      style={style}
      className="rounded-full bg-muted flex items-center justify-center font-semibold text-muted-foreground shrink-0"
    >
      {initials}
    </div>
  );
};

/* ---------- Reports ---------- */
const ReportsPanel = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [childId, setChildId] = useState<string>("");
  const [reports, setReports] = useState<any[]>([]);
  const [form, setForm] = useState({
    report_title: "",
    report_date: new Date().toISOString().slice(0, 10),
    coach_comments: "",
    programme: "",
    individual_coach: "",
    national_coach: "",
  });

  useEffect(() => {
    supabase.from("children").select("id, name, parent_user_id, date_of_birth, gender, btm_number, county_rank, national_rank, favorite_player, favorite_shot, handedness, has_medical_needs, has_send_needs").order("name")
      .then(({ data }) => setChildren((data ?? []) as Child[]));
  }, []);

  useEffect(() => {
    if (!childId) { setReports([]); return; }
    supabase.from("player_reports").select("*").eq("child_id", childId).order("report_date", { ascending: false })
      .then(({ data }) => setReports(data ?? []));
  }, [childId]);

  const save = async () => {
    if (!childId || !form.report_title) { toast.error("Pick a child and add a title"); return; }
    const { error } = await supabase.from("player_reports").insert({ child_id: childId, ...form });
    if (error) toast.error(error.message);
    else {
      toast.success("Report saved");
      setForm({ report_title: "", report_date: new Date().toISOString().slice(0, 10), coach_comments: "", programme: "", individual_coach: "", national_coach: "" });
      const { data } = await supabase.from("player_reports").select("*").eq("child_id", childId).order("report_date", { ascending: false });
      setReports(data ?? []);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this report?")) return;
    const { error } = await supabase.from("player_reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setReports(reports.filter(r => r.id !== id)); toast.success("Report deleted"); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Write a coach report</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Child</Label>
            <Select value={childId} onValueChange={setChildId}>
              <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>
                {children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Title</Label><Input value={form.report_title} onChange={e => setForm({ ...form, report_title: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.report_date} onChange={e => setForm({ ...form, report_date: e.target.value })} /></div>
          </div>
          <div><Label>Programme</Label><Input value={form.programme} onChange={e => setForm({ ...form, programme: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Individual coach</Label><Input value={form.individual_coach} onChange={e => setForm({ ...form, individual_coach: e.target.value })} /></div>
            <div><Label>National coach</Label><Input value={form.national_coach} onChange={e => setForm({ ...form, national_coach: e.target.value })} /></div>
          </div>
          <div><Label>Coach comments</Label><Textarea rows={6} value={form.coach_comments} onChange={e => setForm({ ...form, coach_comments: e.target.value })} /></div>
          <Button onClick={save} className="w-full"><Plus className="w-4 h-4 mr-2" />Save report</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing reports</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {!childId && <p className="text-muted-foreground text-sm">Select a child to view their reports.</p>}
          {reports.map(r => (
            <div key={r.id} className="border rounded-lg p-3 flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{r.report_title}</p>
                <p className="text-xs text-muted-foreground">{r.report_date} · {r.programme || "—"}</p>
                {r.coach_comments && <p className="text-sm mt-1 line-clamp-3">{r.coach_comments}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {childId && reports.length === 0 && <p className="text-muted-foreground text-sm">No reports yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

/* ---------- Goals ---------- */
const GoalsPanel = () => {
  const [children, setChildren] = useState<Child[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [form, setForm] = useState({ child_id: "", title: "", description: "", category: "technical", target_date: "" });

  const load = async () => {
    const [{ data: c }, { data: g }] = await Promise.all([
      supabase.from("children").select("id, name, parent_user_id").order("name"),
      supabase.from("tennis_goals").select("*").order("created_at", { ascending: false }),
    ]);
    setChildren((c ?? []) as Child[]);
    setGoals(g ?? []);
  };
  useEffect(() => { load(); }, []);

  const childMap = useMemo(() => new Map(children.map(c => [c.id, c])), [children]);

  const add = async () => {
    const child = childMap.get(form.child_id);
    if (!child || !form.title) { toast.error("Pick a child and add a title"); return; }
    const { error } = await supabase.from("tennis_goals").insert({
      child_id: child.id,
      parent_user_id: child.parent_user_id,
      title: form.title,
      description: form.description || null,
      category: form.category,
      target_date: form.target_date || null,
      set_by: "coach",
    });
    if (error) toast.error(error.message);
    else { toast.success("Goal added"); setForm({ child_id: "", title: "", description: "", category: "technical", target_date: "" }); load(); }
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("tennis_goals").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader><CardTitle>Set a goal for a child</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Child</Label>
            <Select value={form.child_id} onValueChange={(v) => setForm({ ...form, child_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>{children.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical">Technical</SelectItem>
                  <SelectItem value="tactical">Tactical</SelectItem>
                  <SelectItem value="physical">Physical</SelectItem>
                  <SelectItem value="mental">Mental</SelectItem>
                  <SelectItem value="competition">Competition</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Target date</Label><Input type="date" value={form.target_date} onChange={e => setForm({ ...form, target_date: e.target.value })} /></div>
          </div>
          <Button onClick={add} className="w-full"><Plus className="w-4 h-4 mr-2" />Add goal</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All goals ({goals.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
          {goals.map(g => (
            <div key={g.id} className="border rounded p-2 flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm">{g.title}</p>
                <p className="text-xs text-muted-foreground">{childMap.get(g.child_id)?.name ?? "Unknown"} · {g.category} {g.target_date && `· due ${g.target_date}`}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => remove(g.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          {goals.length === 0 && <p className="text-muted-foreground text-sm">No goals yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

/* ---------- Events + Invitations ---------- */
const emptyEventForm = {
  title: "", description: "", event_date: "", location: "", age_group: "", capacity: "",
  event_type: "general", poster_url: "", featured: false, cost: "",
  sign_up_enabled: false, session_slots: "",
};
type EventForm = typeof emptyEventForm;

const EventsPanel = ({ currentUserId }: { currentUserId: string }) => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [signups, setSignups] = useState<any[]>([]);
  const [children, setChildren] = useState<Child[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [form, setForm] = useState<EventForm>(emptyEventForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState<EventRow | null>(null);
  const [viewSignupsFor, setViewSignupsFor] = useState<EventRow | null>(null);
  const [selectedChildren, setSelectedChildren] = useState<Set<string>>(new Set());
  const [uploadingPoster, setUploadingPoster] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [{ data: e }, { data: c }, { data: i }, { data: s }] = await Promise.all([
      supabase.from("events").select("*").order("event_date", { ascending: false }),
      supabase.from("children").select("id, name, parent_user_id, date_of_birth, gender, btm_number, county_rank, national_rank, favorite_player, favorite_shot, handedness, has_medical_needs, has_send_needs").order("name"),
      supabase.from("event_invitations").select("*"),
      supabase.from("event_signups").select("*").order("created_at", { ascending: false }),
    ]);
    setEvents((e ?? []) as any as EventRow[]);
    setChildren((c ?? []) as Child[]);
    setInvitations(i ?? []);
    setSignups(s ?? []);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => { setForm(emptyEventForm); setEditingId(null); };

  const startEdit = (ev: EventRow) => {
    setEditingId(ev.id);
    const dt = new Date(ev.event_date);
    dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      event_date: dt.toISOString().slice(0, 16),
      location: ev.location ?? "",
      age_group: ev.age_group ?? "",
      capacity: ev.capacity != null ? String(ev.capacity) : "",
      event_type: ev.event_type ?? "general",
      poster_url: ev.poster_url ?? "",
      featured: !!ev.featured,
      cost: ev.cost ?? "",
      sign_up_enabled: !!ev.sign_up_enabled,
      session_slots: Array.isArray(ev.session_slots) ? ev.session_slots.join("\n") : "",
    });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const save = async () => {
    if (!form.title || !form.event_date) { toast.error("Title and date are required"); return; }
    const slots = form.session_slots.split("\n").map(s => s.trim()).filter(Boolean);
    const payload = {
      title: form.title,
      description: form.description || null,
      event_date: new Date(form.event_date).toISOString(),
      location: form.location || null,
      age_group: form.age_group || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      event_type: form.event_type || "general",
      poster_url: form.poster_url || null,
      featured: form.featured,
      cost: form.cost || null,
      sign_up_enabled: form.sign_up_enabled,
      session_slots: slots.length ? slots : null,
    };
    const { error } = editingId
      ? await supabase.from("events").update(payload).eq("id", editingId)
      : await supabase.from("events").insert(payload);
    if (error) toast.error(error.message);
    else { toast.success(editingId ? "Event updated" : "Event created"); resetForm(); load(); }
  };

  const uploadPoster = async (file: File) => {
    setUploadingPoster(true);
    const path = `event-posters/${crypto.randomUUID()}-${file.name.replace(/[^a-z0-9.\-_]/gi, "_")}`;
    const { error } = await supabase.storage.from("news-media").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploadingPoster(false); return; }
    const { data } = supabase.storage.from("news-media").getPublicUrl(path);
    setForm(f => ({ ...f, poster_url: data.publicUrl }));
    setUploadingPoster(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete event? This will also remove all sign-ups.")) return;
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };



  const openInvite = (ev: EventRow) => {
    const existing = new Set(invitations.filter(i => i.event_id === ev.id).map(i => i.child_id));
    setSelectedChildren(existing);
    setInviteOpen(ev);
  };

  const sendInvites = async () => {
    if (!inviteOpen) return;
    const eventId = inviteOpen.id;
    const existing = new Set(invitations.filter(i => i.event_id === eventId).map(i => i.child_id));
    const toAdd = Array.from(selectedChildren).filter(id => !existing.has(id));
    const toRemove = Array.from(existing).filter(id => !selectedChildren.has(id));

    if (toAdd.length) {
      const rows = toAdd.map(child_id => {
        const child = children.find(c => c.id === child_id)!;
        return { event_id: eventId, child_id, parent_user_id: child.parent_user_id, invited_by: currentUserId };
      });
      const { error } = await supabase.from("event_invitations").insert(rows);
      if (error) { toast.error(error.message); return; }
    }
    if (toRemove.length) {
      const { error } = await supabase.from("event_invitations").delete().eq("event_id", eventId).in("child_id", toRemove);
      if (error) { toast.error(error.message); return; }
    }
    toast.success(`Invitations updated (${toAdd.length} added, ${toRemove.length} removed)`);
    setInviteOpen(null);
    load();
  };

  const toggleChild = (id: string) => {
    const next = new Set(selectedChildren);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedChildren(next);
  };

  const signupsForEvent = (id: string) => signups.filter(s => s.event_id === id);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-1" ref={formRef as any}>
        <CardHeader>
          <CardTitle>{editingId ? "Edit event" : "Create event"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Event type</Label>
            <select
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={form.event_type}
              onChange={e => setForm({ ...form, event_type: e.target.value })}
            >
              <option value="general">General</option>
              <option value="rising-stars">Rising Stars</option>
              <option value="mini-masters">Mini Masters</option>
              <option value="county-training">County Training</option>
            </select>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Date &amp; time</Label><Input type="datetime-local" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} /></div>
          <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Age group</Label><Input placeholder="e.g. 10U" value={form.age_group} onChange={e => setForm({ ...form, age_group: e.target.value })} /></div>
            <div><Label>Capacity</Label><Input type="number" value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} /></div>
          </div>
          <div><Label>Cost</Label><Input placeholder="e.g. Free, £15" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
          <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>

          <div>
            <Label>Session slots (one per line)</Label>
            <Textarea
              rows={3}
              placeholder={"e.g.\n10:00 – 11:00 (8U/9U)\n11:15 – 12:15 (10U)"}
              value={form.session_slots}
              onChange={e => setForm({ ...form, session_slots: e.target.value })}
            />
          </div>

          <div>
            <Label>Poster image</Label>
            {form.poster_url && (
              <div className="mt-2 rounded-lg overflow-hidden border">
                <img src={form.poster_url} alt="Poster preview" className="w-full max-h-48 object-cover" />
              </div>
            )}
            <Input
              type="file"
              accept="image/*"
              disabled={uploadingPoster}
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPoster(f); }}
              className="mt-2"
            />
            {form.poster_url && (
              <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setForm({ ...form, poster_url: "" })}>Remove poster</Button>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.featured} onCheckedChange={c => setForm({ ...form, featured: !!c })} />
            Feature on homepage banner
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.sign_up_enabled} onCheckedChange={c => setForm({ ...form, sign_up_enabled: !!c })} />
            Enable public sign-ups (parents can register)
          </label>

          <div className="flex gap-2">
            <Button onClick={save} className="flex-1">
              <Plus className="w-4 h-4 mr-2" />{editingId ? "Save changes" : "Create event"}
            </Button>
            {editingId && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader><CardTitle>All events ({events.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[720px] overflow-y-auto">
          {events.map(ev => {
            const invitedCount = invitations.filter(i => i.event_id === ev.id).length;
            const signupCount = signupsForEvent(ev.id).length;
            return (
              <div key={ev.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-3 flex-1 min-w-0">
                    {ev.poster_url && (
                      <img src={ev.poster_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{ev.title}</p>
                        {ev.event_type && ev.event_type !== "general" && (
                          <Badge variant="outline" className="text-[10px] uppercase">{ev.event_type.replace("-", " ")}</Badge>
                        )}
                        {ev.featured && <Badge className="text-[10px] bg-lta-yellow text-suffolk-navy">Featured</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(ev.event_date).toLocaleString()} {ev.location && `· ${ev.location}`} {ev.age_group && `· ${ev.age_group}`}
                      </p>
                      {ev.description && <p className="text-sm mt-1 line-clamp-2">{ev.description}</p>}
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="secondary">{invitedCount} invited{ev.capacity ? ` / ${ev.capacity}` : ""}</Badge>
                        {ev.sign_up_enabled && (
                          <Badge variant="secondary" className="cursor-pointer" onClick={() => setViewSignupsFor(ev)}>
                            {signupCount} sign-up{signupCount === 1 ? "" : "s"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button size="sm" variant="outline" onClick={() => startEdit(ev)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => openInvite(ev)}><Send className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(ev.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
          {events.length === 0 && <p className="text-muted-foreground text-sm">No events yet.</p>}
        </CardContent>
      </Card>

      <Dialog open={!!inviteOpen} onOpenChange={(o) => !o && setInviteOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Invite children to "{inviteOpen?.title}"</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {children.map(c => (
              <label key={c.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                <Checkbox checked={selectedChildren.has(c.id)} onCheckedChange={() => toggleChild(c.id)} />
                <span className="text-sm">{c.name} <span className="text-muted-foreground text-xs">({c.date_of_birth ?? "no DOB"})</span></span>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={sendInvites}><Send className="w-4 h-4 mr-2" />Save invitations</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewSignupsFor} onOpenChange={(o) => !o && setViewSignupsFor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Sign-ups for "{viewSignupsFor?.title}"</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {viewSignupsFor && signupsForEvent(viewSignupsFor.id).map(s => (
              <div key={s.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between gap-2">
                  <p className="font-semibold">{s.child_name} <span className="text-muted-foreground font-normal">({s.child_gender ?? "—"}{s.child_dob ? `, ${s.child_dob}` : ""})</span></p>
                  <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-muted-foreground text-xs mt-1">
                  Parent: {s.parent_name} · <a href={`mailto:${s.parent_email}`} className="text-primary underline">{s.parent_email}</a>
                  {s.parent_phone && <> · <a href={`tel:${s.parent_phone}`} className="text-primary underline">{s.parent_phone}</a></>}
                </p>
                {s.parent_club && <p className="text-xs">Club: {s.parent_club}</p>}
                {s.player_coach && <p className="text-xs">Coach: {s.player_coach}</p>}
                {s.session_slot && <p className="text-xs">Session: <span className="font-medium">{s.session_slot}</span></p>}
                {s.medical_notes && <p className="text-xs text-amber-600 mt-1">Medical: {s.medical_notes}</p>}
                <p className="text-xs mt-1">Photo consent: {s.photo_consent ? "Yes" : "No"}</p>
              </div>
            ))}
            {viewSignupsFor && signupsForEvent(viewSignupsFor.id).length === 0 && (
              <p className="text-muted-foreground text-sm">No sign-ups yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------- News ---------- */
const todayLocalISO = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

/* ---------- Focal Point Editor ---------- */
const FocalPointEditor = ({ media, onSave }: { media: NewsMedia; onSave: (fx: number, fy: number) => void }) => {
  const [open, setOpen] = useState(false);
  const [fx, setFx] = useState(media.focal_x ?? 50);
  const [fy, setFy] = useState(media.focal_y ?? 20);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) { setFx(media.focal_x ?? 50); setFy(media.focal_y ?? 20); }
  }, [open, media.focal_x, media.focal_y]);

  const updateFromEvent = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    setFx(Math.round(x));
    setFy(Math.round(y));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="p-1 rounded-full bg-black/60 text-white" title="Adjust framing">
          <Crop className="w-3 h-3" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 grid-rows-[auto_1fr_auto]">
        <DialogHeader className="px-6 pt-6"><DialogTitle>Adjust cover framing</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Click or drag to set the focal point. This is the part that stays visible when the image is cropped on the homepage.
          </p>

          <div
            ref={boxRef}
            className="relative w-full select-none cursor-crosshair rounded-md overflow-hidden border bg-muted"
            onMouseDown={(e) => { dragging.current = true; updateFromEvent(e.clientX, e.clientY); }}
            onMouseMove={(e) => { if (dragging.current) updateFromEvent(e.clientX, e.clientY); }}
            onMouseUp={() => { dragging.current = false; }}
            onMouseLeave={() => { dragging.current = false; }}
            onTouchStart={(e) => { const t = e.touches[0]; updateFromEvent(t.clientX, t.clientY); }}
            onTouchMove={(e) => { const t = e.touches[0]; updateFromEvent(t.clientX, t.clientY); }}
          >
            <img src={media.url} alt="" className="w-full h-auto block max-h-[40vh] object-contain mx-auto" />
            <div
              className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full border-4 border-white ring-2 ring-primary pointer-events-none shadow-lg"
              style={{ left: `${fx}%`, top: `${fy}%` }}
            />
          </div>

          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground">Live preview (homepage card)</p>
            <div className="w-full aspect-[16/10] overflow-hidden rounded-md border">
              <img
                src={media.url}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: `${fx}% ${fy}%` }}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-background">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { onSave(fx, fy); setOpen(false); toast.success("Framing saved — don't forget to save the article"); }}>
            Save framing
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
};

const NewsPanel = () => {
  const [items, setItems] = useState<NewsRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    published: true,
    article_date: todayLocalISO(),
  });
  const [media, setMedia] = useState<NewsMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("suffolk_news").select("*")
      .order("article_date", { ascending: false, nullsFirst: false });
    setItems(((data as unknown) as NewsRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({ title: "", content: "", published: true, article_date: todayLocalISO() });
    setMedia([]);
  };

  const startEdit = (n: NewsRow) => {
    setEditingId(n.id);
    setForm({
      title: n.title,
      content: n.content,
      published: n.published,
      article_date: (n.article_date || n.created_at || todayLocalISO()).slice(0, 10),
    });
    setMedia(Array.isArray(n.media) ? n.media : []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploading(true);
    const uploaded: NewsMedia[] = [];
    for (const file of arr) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isVideo && !isImage) { toast.error(`Unsupported file: ${file.name}`); continue; }
      const ext = file.name.split(".").pop() || (isVideo ? "mp4" : "jpg");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("news-media").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data: pub } = supabase.storage.from("news-media").getPublicUrl(path);
      uploaded.push({ url: pub.publicUrl, type: isVideo ? "video" : "image", name: file.name });
    }
    setMedia(m => [...m, ...uploaded]);
    setUploading(false);
    if (uploaded.length) toast.success(`Uploaded ${uploaded.length} file${uploaded.length === 1 ? "" : "s"}`);
  };

  const removeMedia = (idx: number) => setMedia(m => m.filter((_, i) => i !== idx));

  const compose = async () => {
    if (!form.content.trim()) { toast.error("Write a rough draft first"); return; }
    setComposing(true);
    try {
      const { data, error } = await supabase.functions.invoke("compose-news", {
        body: { title: form.title, draft: form.content },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.content) {
        setForm(f => ({ ...f, content: data.content }));
        toast.success("Polished by AI");
      }
    } catch (e) {
      toast.error((e as Error).message || "AI compose failed");
    } finally {
      setComposing(false);
    }
  };

  const save = async () => {
    if (!form.title || !form.content) { toast.error("Title and content required"); return; }
    const firstImage = media.find(m => m.type === "image")?.url ?? null;
    const articleDateISO = form.article_date
      ? new Date(`${form.article_date}T12:00:00`).toISOString()
      : new Date().toISOString();
    const payload = {
      title: form.title,
      content: form.content,
      published: form.published,
      image_url: firstImage,
      media: media as unknown as never,
      article_date: articleDateISO,
    };
    const { error } = editingId
      ? await supabase.from("suffolk_news").update(payload).eq("id", editingId)
      : await supabase.from("suffolk_news").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success(editingId ? "Article updated" : "News saved");
      resetForm();
      load();
    }
  };

  const togglePublished = async (n: NewsRow) => {
    const { error } = await supabase.from("suffolk_news").update({ published: !n.published }).eq("id", n.id);
    if (error) toast.error(error.message); else load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this article?")) return;
    const { error } = await supabase.from("suffolk_news").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            <span>{editingId ? "Edit Suffolk news" : "Write Suffolk news"}</span>
            {editingId && (
              <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <Label>Article date</Label>
            <Input
              type="date"
              value={form.article_date}
              onChange={e => setForm({ ...form, article_date: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">Used for sorting and display. Backdate if needed.</p>
          </div>

          <div>
            <Label>Media (images &amp; videos)</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
              }}
              className={`mt-1 rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
            >
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">Drag &amp; drop images or videos here</p>
              <p className="text-xs text-muted-foreground mb-3">or</p>
              <label className="inline-flex">
                <input
                  type="file" multiple accept="image/*,video/*" className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <span className="px-3 py-1.5 text-sm rounded-md border cursor-pointer hover:bg-muted">
                  Choose files
                </span>
              </label>
              {uploading && (
                <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                </p>
              )}
            </div>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {media.map((m, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border bg-muted aspect-square">
                    {m.type === "image" ? (
                      <img
                        src={m.url}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${m.focal_x ?? 50}% ${m.focal_y ?? 20}%` }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/80 text-white">
                        <Video className="w-6 h-6" />
                      </div>
                    )}
                    {i === 0 && (
                      <span className="absolute top-1 left-1 text-[9px] font-bold bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded">
                        COVER
                      </span>
                    )}
                    <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                      {m.type === "image" && (
                        <FocalPointEditor
                          media={m}
                          onSave={(fx, fy) => setMedia(arr => arr.map((mm, idx) => idx === i ? { ...mm, focal_x: fx, focal_y: fy } : mm))}
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(i)}
                        className="p-1 rounded-full bg-black/60 text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Content</Label>
              <Button type="button" size="sm" variant="outline" onClick={compose} disabled={composing}>
                {composing
                  ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Composing…</>
                  : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> AI compose</>}
              </Button>
            </div>
            <Textarea rows={9} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} />
            <p className="text-xs text-muted-foreground mt-1">Write a rough draft, then let AI polish it.</p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} />
            Publish immediately
          </label>

          <Button onClick={save} className="w-full">
            {editingId ? <><Pencil className="w-4 h-4 mr-2" />Update article</> : <><Plus className="w-4 h-4 mr-2" />Save article</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Articles ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[700px] overflow-y-auto">
          {items.map(n => {
            const cover = n.image_url || (Array.isArray(n.media) ? n.media.find(m => m.type === "image")?.url : null);
            const mediaCount = Array.isArray(n.media) ? n.media.length : 0;
            return (
              <div key={n.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3 flex-1 min-w-0">
                    {cover && (
                      <img src={cover} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(n.article_date || n.created_at).toLocaleDateString("en-GB")}
                        {mediaCount > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <ImageIcon className="w-3 h-3" /> {mediaCount}
                          </span>
                        )}
                      </p>
                      <p className="text-sm mt-1 line-clamp-2">{n.content}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Badge variant={n.published ? "default" : "secondary"}>{n.published ? "Live" : "Draft"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => startEdit(n)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => togglePublished(n)}>
                      {n.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(n.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
          {items.length === 0 && <p className="text-muted-foreground text-sm">No articles yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};


/* ---------- Player Watch ---------- */
type PlayerWatchRow = {
  id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  badge: string | null;
  accent: string;
  achievements: string[];
  main_image_url: string | null;
  gallery: { url: string; name?: string }[] | null;
  display_order: number;
  published: boolean;
};

const accentOptions = [
  { value: "yellow", label: "Yellow" },
  { value: "cyan", label: "Cyan" },
  { value: "pink", label: "Pink" },
];

type PlayerForm = {
  name: string;
  subtitle: string;
  description: string;
  badge: string;
  accent: string;
  achievements: string[];
  main_image_url: string | null;
  gallery: { url: string; name?: string }[];
  display_order: number;
  published: boolean;
};

const emptyPlayerForm = (): PlayerForm => ({
  name: "", subtitle: "", description: "", badge: "", accent: "yellow",
  achievements: [], main_image_url: null, gallery: [],
  display_order: 0, published: true,
});

const PlayerWatchPanel = () => {
  const [items, setItems] = useState<PlayerWatchRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlayerForm>(emptyPlayerForm());
  const [newTag, setNewTag] = useState("");
  const [uploading, setUploading] = useState(false);
  const [savingMain, setSavingMain] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await supabase
      .from("player_watch").select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(((data as unknown) as PlayerWatchRow[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (p: PlayerWatchRow) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      subtitle: p.subtitle ?? "",
      description: p.description ?? "",
      badge: p.badge ?? "",
      accent: p.accent,
      achievements: p.achievements ?? [],
      main_image_url: p.main_image_url,
      gallery: Array.isArray(p.gallery) ? p.gallery : [],
      display_order: p.display_order,
      published: p.published,
    });
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const startNew = () => { setEditingId(null); setForm(emptyPlayerForm()); };

  const uploadOne = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("player-watch-media")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) { toast.error(`Upload failed: ${error.message}`); return null; }
    const { data: pub } = supabase.storage.from("player-watch-media").getPublicUrl(path);
    return pub.publicUrl;
  };

  const onMainPick = async (file?: File) => {
    if (!file) return;
    setSavingMain(true);
    const url = await uploadOne(file);
    setSavingMain(false);
    if (url) setForm(f => ({ ...f, main_image_url: url }));
  };

  const handleGalleryFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!arr.length) return;
    setUploading(true);
    const uploaded: { url: string; name?: string }[] = [];
    for (const f of arr) {
      const url = await uploadOne(f);
      if (url) uploaded.push({ url, name: f.name });
    }
    setForm(f => ({ ...f, gallery: [...f.gallery, ...uploaded] }));
    setUploading(false);
  };

  const removeGalleryItem = (i: number) =>
    setForm(f => ({ ...f, gallery: f.gallery.filter((_, idx) => idx !== i) }));

  const addTag = () => {
    const t = newTag.trim();
    if (!t) return;
    if (form.achievements.includes(t)) { setNewTag(""); return; }
    setForm(f => ({ ...f, achievements: [...f.achievements, t] }));
    setNewTag("");
  };
  const removeTag = (t: string) =>
    setForm(f => ({ ...f, achievements: f.achievements.filter(x => x !== t) }));

  const save = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name.trim(),
      subtitle: form.subtitle.trim() || null,
      description: form.description.trim() || null,
      badge: form.badge.trim() || null,
      accent: form.accent,
      achievements: form.achievements,
      main_image_url: form.main_image_url,
      gallery: form.gallery as unknown as never,
      display_order: form.display_order || 0,
      published: form.published,
    };
    const { error } = editingId
      ? await supabase.from("player_watch").update(payload).eq("id", editingId)
      : await supabase.from("player_watch").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Player updated" : "Player added");
    startNew();
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this player?")) return;
    const { error } = await supabase.from("player_watch").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { if (editingId === id) startNew(); load(); }
  };

  const togglePublished = async (p: PlayerWatchRow) => {
    const { error } = await supabase.from("player_watch")
      .update({ published: !p.published }).eq("id", p.id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card ref={formRef}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{editingId ? "Edit player" : "Add a featured player"}</CardTitle>
            {editingId && (
              <Button size="sm" variant="ghost" onClick={startNew}>
                <Plus className="w-4 h-4 mr-1" /> New
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Display order</Label>
              <Input type="number" value={form.display_order}
                onChange={e => setForm({ ...form, display_order: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div>
            <Label>Subtitle (highlight result)</Label>
            <Input value={form.subtitle} onChange={e => setForm({ ...form, subtitle: e.target.value })}
              placeholder="3rd Place – LTA Lexus 10U National Championships" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea rows={4} value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Badge / Award (optional)</Label>
              <Input value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })}
                placeholder="Braveheart" />
            </div>
            <div>
              <Label>Accent colour</Label>
              <Select value={form.accent} onValueChange={(v) => setForm({ ...form, accent: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accentOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Achievement tags</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={newTag} onChange={e => setNewTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="e.g. National Grade 1 Level Competition"
              />
              <Button type="button" onClick={addTag}>Add</Button>
            </div>
            {form.achievements.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.achievements.map(t => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full pl-3 pr-1 py-1">
                    {t}
                    <button onClick={() => removeTag(t)} className="rounded-full hover:bg-background p-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Main photo</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.main_image_url ? (
                <img src={form.main_image_url} alt="" className="w-20 h-20 rounded-md object-cover border" />
              ) : (
                <div className="w-20 h-20 rounded-md border bg-muted flex items-center justify-center">
                  <ImageIcon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <label className="inline-flex">
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => onMainPick(e.target.files?.[0])} />
                <span className="px-3 py-2 text-sm rounded-md border cursor-pointer hover:bg-muted inline-flex items-center gap-2">
                  {savingMain && <Loader2 className="w-3 h-3 animate-spin" />}
                  {form.main_image_url ? "Replace" : "Upload"}
                </span>
              </label>
              {form.main_image_url && (
                <Button size="sm" variant="ghost" onClick={() => setForm({ ...form, main_image_url: null })}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div>
            <Label>Image gallery</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                if (e.dataTransfer.files?.length) handleGalleryFiles(e.dataTransfer.files);
              }}
              className={`mt-1 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
              }`}
            >
              <Upload className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs">Drag &amp; drop images, or</p>
              <label className="inline-flex mt-2">
                <input type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => e.target.files && handleGalleryFiles(e.target.files)} />
                <span className="px-3 py-1.5 text-xs rounded-md border cursor-pointer hover:bg-muted">Choose files</span>
              </label>
              {uploading && (
                <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                </p>
              )}
            </div>
            {form.gallery.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                {form.gallery.map((g, i) => (
                  <div key={i} className="relative group rounded-md overflow-hidden border aspect-square">
                    <img src={g.url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeGalleryItem(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: !!v })} />
            Show on website
          </label>

          <Button onClick={save} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            {editingId ? "Save changes" : "Add player"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Featured players ({items.length})</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[800px] overflow-y-auto">
          {items.map(p => (
            <div key={p.id} className={`border rounded-lg p-3 ${editingId === p.id ? "ring-2 ring-primary" : ""}`}>
              <div className="flex items-start gap-3">
                {p.main_image_url ? (
                  <img src={p.main_image_url} alt="" className="w-16 h-16 rounded object-cover flex-shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">#{p.display_order} {p.name}</p>
                  {p.subtitle && <p className="text-xs text-muted-foreground line-clamp-1">{p.subtitle}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.badge && (
                      <span className="text-[10px] font-bold uppercase bg-yellow-100 text-yellow-900 px-2 py-0.5 rounded inline-flex items-center gap-1">
                        <Award className="w-3 h-3" /> {p.badge}
                      </span>
                    )}
                    {(p.achievements ?? []).slice(0, 2).map(t => (
                      <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded">{t}</span>
                    ))}
                    {(p.achievements?.length ?? 0) > 2 && (
                      <span className="text-[10px] text-muted-foreground">+{p.achievements.length - 2}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Badge variant={p.published ? "default" : "secondary"}>{p.published ? "Live" : "Hidden"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => togglePublished(p)}>
                    {p.published ? "Hide" : "Show"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground">No players yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
};

/* ---------- Admins ---------- */

const AdminsPanel = () => {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pickUser, setPickUser] = useState<string>("");

  const load = async () => {
    const [{ data: roles }, { data: p }] = await Promise.all([
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
      supabase.from("profiles").select("user_id, first_name, last_name, phone"),
    ]);
    setProfiles(p ?? []);
    const pMap = new Map((p ?? []).map(x => [x.user_id, x]));
    setAdmins((roles ?? []).map(r => {
      const prof = pMap.get(r.user_id);
      return { user_id: r.user_id, first_name: prof?.first_name, last_name: prof?.last_name };
    }));
  };
  useEffect(() => { load(); }, []);

  const addAdmin = async () => {
    if (!pickUser) return;
    const { error } = await supabase.from("user_roles").insert({ user_id: pickUser, role: "admin" });
    if (error) toast.error(error.message);
    else { toast.success("Admin added"); setPickUser(""); load(); }
  };

  const removeAdmin = async (userId: string) => {
    if (!confirm("Remove admin access for this user?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) toast.error(error.message); else load();
  };

  const adminIds = new Set(admins.map(a => a.user_id));
  const nonAdmins = profiles.filter(p => !adminIds.has(p.user_id));

  return (
    <Card>
      <CardHeader><CardTitle>Administrators</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="flex gap-2 items-end max-w-lg">
          <div className="flex-1">
            <Label>Promote a parent to admin</Label>
            <Select value={pickUser} onValueChange={setPickUser}>
              <SelectTrigger><SelectValue placeholder="Select user" /></SelectTrigger>
              <SelectContent>
                {nonAdmins.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addAdmin}><Plus className="w-4 h-4 mr-2" />Add</Button>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Current admins</h3>
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {admins.map(a => (
                <TableRow key={a.user_id}>
                  <TableCell>{a.first_name || ""} {a.last_name || ""}{!a.first_name && <span className="text-muted-foreground text-xs">{a.user_id}</span>}</TableCell>
                  <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => removeAdmin(a.user_id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
                </TableRow>
              ))}
              {admins.length === 0 && <TableRow><TableCell colSpan={2} className="text-muted-foreground text-center">No admins yet.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminHub;
