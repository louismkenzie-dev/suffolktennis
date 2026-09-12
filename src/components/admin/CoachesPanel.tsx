import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Loader2, MoreHorizontal, Plus, Trash2, Upload, UserPlus, X } from "lucide-react";
import CoachDirectory from "./CoachDirectory";
import CoachInviteSheet from "./CoachInviteSheet";
import { FormListLayout, PageHeader, Section, ListGroup, ListRow, Avatar, StatusBadge, EmptyState, SkeletonRows } from "@/components/app";

// coach_invitations and event_coaches are not in the generated types, and
// the app_role enum there predates "coach".
const db = supabase as any;

/** A user holding the coach role, with what Ollie has assigned them to. */
type CoachAccount = {
  user_id: string;
  name: string;
  email: string | null;
  programmes: string[];
};

/** A coach_invitations row still waiting to be accepted. */
type CoachInvitation = {
  id: string;
  email: string;
  name: string | null;
  token: string;
  sent_at: string | null;
  reminded_at: string | null;
};

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** "Reminded 4 Sep" once a reminder has gone; the original send until then. */
const invitationStamp = (i: CoachInvitation) =>
  i.reminded_at ? `Reminded ${shortDate(i.reminded_at)}` : i.sent_at ? `Invited ${shortDate(i.sent_at)}` : "Not sent yet";

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

const CoachesPanel = ({ onEmailCoaches, search }: {
  onEmailCoaches?: (groupId: string) => void;
  /** The People section's search box; filters the website coaches and the directory below. */
  search?: string;
}) => {
  const [items, setItems] = useState<CoachRow[]>([]);
  const [users, setUsers] = useState<{ user_id: string; first_name: string; last_name: string }[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm());
  const [newAch, setNewAch] = useState("");
  const [busyPhoto, setBusyPhoto] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Coach accounts: who can sign in to the Coach Hub, and who has been asked
  // to. Separate from the website team above — a website coach need not have
  // an account, and an account need not be on the website.
  const [accounts, setAccounts] = useState<CoachAccount[]>([]);
  const [invitations, setInvitations] = useState<CoachInvitation[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [removing, setRemoving] = useState<CoachAccount | null>(null);
  const [busyInvitation, setBusyInvitation] = useState<string | null>(null);

  const loadAccounts = async () => {
    // The role table only holds ids: the name lives in profiles and the
    // address is only reachable through the admin RPC (auth.users is not
    // readable from the browser). Assignments come via the events embed so
    // the subtitle can name the programme rather than quote an id.
    const [{ data: roles }, { data: profiles }, { data: emails }, { data: assigned }, { data: pending }] = await Promise.all([
      db.from("user_roles").select("user_id").eq("role", "coach"),
      db.from("profiles").select("user_id, first_name, last_name"),
      db.rpc("get_parent_emails"),
      db.from("event_coaches").select("user_id, events(title)"),
      db.from("coach_invitations").select("id, email, name, token, sent_at, reminded_at").eq("status", "invited").order("created_at"),
    ]);
    const nameOf = new Map<string, string>((profiles ?? []).map((p: any) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
    const emailOf = new Map<string, string>((emails ?? []).map((e: any) => [e.user_id, e.email]));
    const programmesOf = new Map<string, string[]>();
    for (const row of assigned ?? []) {
      const title: string | undefined = row.events?.title;
      if (!title) continue;
      programmesOf.set(row.user_id, [...(programmesOf.get(row.user_id) ?? []), title]);
    }
    setAccounts(((roles ?? []) as Array<{ user_id: string }>)
      .map((r) => ({
        user_id: r.user_id,
        name: nameOf.get(r.user_id) ?? "",
        email: emailOf.get(r.user_id) ?? null,
        programmes: (programmesOf.get(r.user_id) ?? []).sort((a, b) => a.localeCompare(b)),
      }))
      .sort((a, b) => a.name.localeCompare(b.name) || (a.email ?? "").localeCompare(b.email ?? "")));
    setInvitations((pending ?? []) as CoachInvitation[]);
    setAccountsLoading(false);
  };
  useEffect(() => { loadAccounts(); }, []);

  const resendInvitation = async (i: CoachInvitation) => {
    setBusyInvitation(i.id);
    const { data, error } = await supabase.functions.invoke("send-coach-invitations", {
      body: { remind_invitation_ids: [i.id] },
    });
    setBusyInvitation(null);
    // Same reading as the invite sheet: a 200 can still carry a per-address
    // failure in results, so the server's reason is what the admin sees.
    const result = data?.results?.[0];
    if (error || data?.error || !result?.sent) {
      toast.error(`Could not resend to ${i.email}`, { description: result?.error ?? data?.error ?? error?.message ?? "Please try again." });
    } else {
      toast.success(`Reminder sent to ${i.email}`);
    }
    loadAccounts();
  };

  const copyInviteLink = async (i: CoachInvitation) => {
    const link = `${window.location.origin}/coach/join/${i.token}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Invite link for ${i.email} copied`, { description: "Send it to them however you like — it only works signed in as that address." });
    } catch {
      toast.message(`Invite link for ${i.email}`, { description: link, duration: 15000 });
    }
  };

  const revokeInvitation = async (i: CoachInvitation) => {
    setBusyInvitation(i.id);
    // Only a standing invitation can be withdrawn. If the coach accepted while
    // this list was stale, the role is theirs; it goes via Remove coach access.
    const { data, error } = await db.from("coach_invitations").update({ status: "revoked" }).eq("id", i.id).eq("status", "invited").select("id");
    setBusyInvitation(null);
    if (error) { toast.error(error.message); return; }
    if (!data || data.length === 0) { toast.error(`${i.email} has already accepted — use Remove coach access on their row instead`); loadAccounts(); return; }
    toast.success(`Invitation to ${i.email} deleted — the link in their email no longer works`);
    loadAccounts();
  };

  const removeCoachAccess = async (a: CoachAccount) => {
    setRemoving(null);
    // Assignments go first: a coach row without the role would still let
    // the programme form show them as assigned.
    const { error: ecErr } = await db.from("event_coaches").delete().eq("user_id", a.user_id);
    if (ecErr) { toast.error(ecErr.message); return; }
    const { error } = await db.from("user_roles").delete().eq("user_id", a.user_id).eq("role", "coach");
    if (error) { toast.error(error.message); return; }
    // Their accepted invitation is retired too, so the same address can be
    // invited again later and the old link stops claiming they are a coach.
    await db.from("coach_invitations").update({ status: "revoked" }).eq("accepted_user_id", a.user_id).eq("status", "accepted");
    toast.success(`Coach access removed for ${a.name || a.email || "this user"}`);
    loadAccounts();
  };

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
    setFormOpen(true);
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
    startNew(); setFormOpen(false); load();
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

  const q = (search ?? "").trim().toLowerCase();
  const shown = q ? items.filter((c) => `${c.name} ${c.role ?? ""} ${c.qualification ?? ""}`.toLowerCase().includes(q)) : items;
  const shownAccounts = q ? accounts.filter((a) => `${a.name} ${a.email ?? ""}`.toLowerCase().includes(q)) : accounts;
  const shownInvitations = q ? invitations.filter((i) => `${i.name ?? ""} ${i.email}`.toLowerCase().includes(q)) : invitations;
  const accountsEmpty = accounts.length === 0 && invitations.length === 0;

  return (
    <div className="space-y-8">
    <PageHeader
      title="Coaches"
      hideTitleOnPhone
      description="Coach accounts for the Coach Hub, the coaching team shown on the public site, and the county coach directory below."
      className="mb-0"
    />

    <Section
      title="Coach accounts"
      count={accountsLoading ? undefined : accounts.length + invitations.length}
      description="Who can sign in to the Coach Hub. Assign them to programmes from the programme's form."
      action={<Button size="sm" onClick={() => setInviteOpen(true)}><UserPlus className="w-4 h-4" />Invite a coach</Button>}
    >
      {accountsLoading ? <SkeletonRows rows={2} /> : accountsEmpty ? (
        <EmptyState
          icon={UserPlus}
          title="No coach accounts yet"
          description="Invite the first coach and they can sign up with coach access."
          action={<Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}><UserPlus className="w-4 h-4" />Invite a coach</Button>}
          compact
        />
      ) : shownAccounts.length === 0 && shownInvitations.length === 0 ? (
        // The same search drives the lists below, so a one-liner here
        // rather than a panel that would push the matches out of view.
        <p className="px-0.5 text-sm text-muted-foreground">No coach accounts match “{q}”.</p>
      ) : (
        <ListGroup>
          {shownAccounts.map((a) => (
            <ListRow
              key={a.user_id}
              leading={<Avatar name={a.name || a.email || "?"} size="md" />}
              title={a.name || a.email || <span className="font-mono text-xs text-muted-foreground">{a.user_id}</span>}
              subtitle={a.name && a.email ? a.email : undefined}
              detail={a.programmes.length > 0 ? a.programmes.join(" · ") : "Not on a programme yet"}
              trailing={
                <span className="flex items-center gap-1">
                  <StatusBadge tone="success">Coach</StatusBadge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" aria-label={`More actions for ${a.name || a.email || "this coach"}`}><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setRemoving(a)}>
                        <Trash2 className="mr-2 h-4 w-4" />Remove coach access
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              }
            />
          ))}
          {shownInvitations.map((i) => (
            <ListRow
              key={i.id}
              leading={<Avatar name={i.name || i.email} size="md" />}
              title={i.name || i.email}
              subtitle={i.name ? i.email : undefined}
              detail={invitationStamp(i)}
              trailing={
                <span className="flex items-center gap-1">
                  <StatusBadge tone="neutral">Invited</StatusBadge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon-sm" variant="ghost" disabled={busyInvitation === i.id} aria-label={`More actions for ${i.email}`}>
                        {busyInvitation === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => resendInvitation(i)}>Resend</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copyInviteLink(i)}>Copy invite link</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => revokeInvitation(i)}>Delete invitation</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </span>
              }
            />
          ))}
        </ListGroup>
      )}
    </Section>

    <CoachInviteSheet open={inviteOpen} onOpenChange={setInviteOpen} onDone={loadAccounts} />

    <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove coach access?</AlertDialogTitle>
          <AlertDialogDescription>
            {removing?.name || removing?.email || "This user"} will lose the Coach Hub and be taken off {removing && removing.programmes.length > 0 ? `their ${removing.programmes.length === 1 ? "programme" : "programmes"}` : "any programmes"}. Their account, and any children on it, are untouched. You can invite them again later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={(e) => { e.preventDefault(); if (removing) removeCoachAccess(removing); }}>Remove coach access</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <FormListLayout
      formRef={formRef}
      formTitle={editingId ? "Edit coach" : "Add a coach"}
      formActions={editingId ? <Button size="sm" variant="ghost" onClick={startNew}><Plus className="w-4 h-4" />New</Button> : undefined}
      formOpen={formOpen}
      onFormOpenChange={(o) => { setFormOpen(o); if (!o) startNew(); }}
      form={<>
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
        </>}
      list={
        <Section title="Website coaches" count={shown.length} description="The coaching team shown on the public site." action={<Button size="sm" className="md:hidden" onClick={() => { startNew(); setFormOpen(true); }}><Plus className="w-4 h-4" />Add</Button>}>
          {shown.length === 0 && q ? (
            // The search also drives the county directory below, which matches
            // on email, mobile and club — so say so rather than showing a big
            // "nothing here" panel above a list of results.
            <p className="px-0.5 text-sm text-muted-foreground">No website coaches match “{q}”.</p>
          ) : shown.length === 0 ? <EmptyState icon={Plus} title="No coaches yet" compact /> : (
            <ListGroup>
              {shown.map(c => (
                <ListRow
                  key={c.id}
                  onClick={() => startEdit(c)}
                  selected={editingId === c.id}
                  leading={<Avatar name={c.name} src={c.photo_url} size="md" />}
                  title={c.name}
                  subtitle={c.role ?? "Coach"}
                  detail={`Order ${c.display_order}`}
                  trailing={
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="inline-flex min-h-9 items-center" onClick={() => togglePublished(c)} aria-label={c.published ? "Hide from website" : "Show on website"}>
                        <StatusBadge tone={c.published ? "success" : "neutral"}>{c.published ? "Live" : "Hidden"}</StatusBadge>
                      </button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </span>
                  }
                  chevron
                />
              ))}
            </ListGroup>
          )}
        </Section>
      }
    />

    <CoachDirectory onEmailCoaches={onEmailCoaches} search={search} />
    </div>
  );
};

export default CoachesPanel;
