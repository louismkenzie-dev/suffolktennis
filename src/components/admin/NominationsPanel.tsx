// Admin "Nominations" page: every child a coach, club or school has put
// forward through /nominate, with why, who by, and what happened on the
// player database. Ollie works the list from New to Invited (invitations go
// out from the Bookings tab, where nominated players already sit on the
// roster) or Declined, and keeps a note against each. A nomination can be
// corrected (wrong day, wrong age session, a misspelt name, the parent's
// email); when the nomination itself created the player on the database, the
// player record is corrected with it so the invitation goes to the right place.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, ChevronRight, Loader2, Pencil, RefreshCw, Star, UserPlus } from "lucide-react";
import { PageHeader, SegmentedControl, SearchField, ListGroup, EmptyState, SkeletonRows } from "@/components/app";
import { ageGroupOf } from "@/lib/ageGroup";
import { slotFor, slotMismatch } from "@/lib/sessionSlots";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** "2020-01-14" → "Jan 2020" on the list, "14 January 2020" in the detail. */
const fmtDob = (iso: string, style: "short" | "long") =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", style === "short"
    ? { month: "short", year: "numeric", timeZone: "UTC" }
    : { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Status = "new" | "invited" | "declined";
type Nomination = {
  id: string;
  player_first_name: string; player_last_name: string;
  birth_year: number | null; date_of_birth: string | null; gender: string | null; club: string | null;
  event_id: string | null; session_slot: string | null;
  parent_name: string | null; parent_email: string | null; parent_phone: string | null;
  nominator_name: string; nominator_role: string | null; nominator_email: string; nominator_phone: string | null;
  reason: string | null;
  roster_id: string | null; roster_match: "created" | "existing" | "review" | null;
  status: Status; admin_notes: string | null;
  created_at: string;
};
type EventRow = { id: string; event_date: string; location: string | null; title: string; session_slots: string[] | null; cancelled_at: string | null };

/** The editable part of a nomination, as strings for the form. */
type Draft = {
  player_first_name: string; player_last_name: string; date_of_birth: string; birth_year: string; gender: string;
  club: string; event_id: string; session_slot: string;
  parent_name: string; parent_email: string; parent_phone: string;
  nominator_name: string; nominator_role: string; nominator_email: string; nominator_phone: string;
};
const draftOf = (n: Nomination): Draft => ({
  player_first_name: n.player_first_name, player_last_name: n.player_last_name,
  date_of_birth: n.date_of_birth ?? "", birth_year: n.birth_year ? String(n.birth_year) : "", gender: n.gender ?? "",
  club: n.club ?? "", event_id: n.event_id ?? "", session_slot: n.session_slot ?? "",
  parent_name: n.parent_name ?? "", parent_email: n.parent_email ?? "", parent_phone: n.parent_phone ?? "",
  nominator_name: n.nominator_name, nominator_role: n.nominator_role ?? "", nominator_email: n.nominator_email, nominator_phone: n.nominator_phone ?? "",
});
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NONE = "__none__";
const birthYearOf = (d: { date_of_birth: string | null; birth_year: number | null }) =>
  d.date_of_birth ? Number(d.date_of_birth.slice(0, 4)) : d.birth_year;

const STATUS_LABEL: Record<Status, string> = { new: "New", invited: "Invited", declined: "Declined" };
const player = (n: Nomination) => `${n.player_first_name} ${n.player_last_name}`;
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

function RosterBadge({ n }: { n: Nomination }) {
  if (n.roster_match === "created") return <Badge variant="secondary" className="bg-emerald-50 text-emerald-800">Added to database</Badge>;
  if (n.roster_match === "existing") return <Badge variant="secondary">Already on database</Badge>;
  if (n.roster_match === "review") return <Badge variant="secondary" className="bg-amber-50 text-amber-800">Check — same name, different parent</Badge>;
  return null;
}

export default function NominationsPanel({ query = "" }: { query?: string }) {
  const [rows, setRows] = useState<Nomination[]>([]);
  const [events, setEvents] = useState<Map<string, EventRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status | "all">("new");
  const [open, setOpen] = useState<Nomination | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: evs }] = await Promise.all([
      db.from("talent_nominations").select("*").order("created_at", { ascending: false }),
      db.from("events").select("id, event_date, location, title, session_slots, cancelled_at").eq("event_type", "rising-stars").order("event_date"),
    ]);
    if (error) toast.error(error.message);
    setRows(data ?? []);
    setEvents(new Map((evs ?? []).map((e: EventRow) => [e.id, e])));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    new: rows.filter((r) => r.status === "new").length,
    invited: rows.filter((r) => r.status === "invited").length,
    declined: rows.filter((r) => r.status === "declined").length,
  }), [rows]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (!q) return true;
      return `${player(r)} ${r.club ?? ""} ${r.nominator_name} ${r.nominator_email} ${r.nominator_role ?? ""} ${r.parent_name ?? ""} ${r.parent_email ?? ""}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  const setStatus = async (n: Nomination, status: Status) => {
    const { error } = await db.from("talent_nominations").update({ status }).eq("id", n.id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === n.id ? { ...r, status } : r)));
    if (open?.id === n.id) setOpen({ ...n, status });
  };

  const saveNotes = async () => {
    if (!open) return;
    setSaving(true);
    const { error } = await db.from("talent_nominations").update({ admin_notes: notes.trim() || null }).eq("id", open.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => (r.id === open.id ? { ...r, admin_notes: notes.trim() || null } : r)));
    toast.success("Note saved");
  };

  /** A "review" nomination the admin has judged to be a different child. */
  const addToDatabase = async (n: Nomination) => {
    const { data, error } = await db.from("player_roster").insert({
      first_name: n.player_first_name, last_name: n.player_last_name,
      gender: n.gender === "male" ? "Male" : n.gender === "female" ? "Female" : null,
      age_group: n.date_of_birth ? ageGroupOf(n.date_of_birth) : n.birth_year ? ageGroupOf(`${n.birth_year}-07-01`) : null,
      contact_name: n.parent_name, contact_email: n.parent_email, mobile: n.parent_phone,
      tags: ["Rising Stars nomination 2026"], source: "nomination",
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    const { error: e2 } = await db.from("talent_nominations").update({ roster_id: data.id, roster_match: "created" }).eq("id", n.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success(`${player(n)} added to the player database`);
    load();
    setOpen(null);
  };

  /** Save a corrected nomination, and the player it created, if it created one. */
  const saveEdit = async () => {
    if (!open || !draft) return;
    const d = draft;
    const t = (s: string) => s.trim();
    if (!t(d.player_first_name) || !t(d.player_last_name)) { toast.error("The player needs a first and last name"); return; }
    if (!t(d.nominator_name) || !EMAIL.test(t(d.nominator_email))) { toast.error("The nominator needs a name and a valid email"); return; }
    if (t(d.parent_email) && !EMAIL.test(t(d.parent_email))) { toast.error("That parent email doesn't look right"); return; }
    const dob = t(d.date_of_birth) || null;
    const year = dob ? Number(dob.slice(0, 4)) : d.birth_year ? Number(d.birth_year) : null;
    if (year && (year < 2010 || year > 2024)) { toast.error("Please check the date of birth"); return; }
    const patch = {
      player_first_name: t(d.player_first_name), player_last_name: t(d.player_last_name),
      date_of_birth: dob, birth_year: year, gender: d.gender || null, club: t(d.club) || null,
      event_id: d.event_id || null, session_slot: d.session_slot || null,
      parent_name: t(d.parent_name) || null, parent_email: t(d.parent_email).toLowerCase() || null, parent_phone: t(d.parent_phone) || null,
      nominator_name: t(d.nominator_name), nominator_role: t(d.nominator_role) || null,
      nominator_email: t(d.nominator_email).toLowerCase(), nominator_phone: t(d.nominator_phone) || null,
    };
    setSaving(true);
    const { error } = await db.from("talent_nominations").update(patch).eq("id", open.id);
    if (error) { setSaving(false); toast.error(error.message); return; }
    // The player this nomination put on the database is corrected with it.
    // A player who was already there is left alone: their record came from
    // elsewhere (the LTA export, a booking) and may be more accurate.
    let rosterNote = "";
    if (open.roster_match === "created" && open.roster_id) {
      const { error: e2 } = await db.from("player_roster").update({
        first_name: patch.player_first_name, last_name: patch.player_last_name,
        gender: patch.gender === "male" ? "Male" : patch.gender === "female" ? "Female" : null,
        age_group: dob ? ageGroupOf(dob) : year ? ageGroupOf(`${year}-07-01`) : null,
        contact_name: patch.parent_name, contact_email: patch.parent_email, mobile: patch.parent_phone,
      }).eq("id", open.roster_id);
      rosterNote = e2 ? ` (the player database wasn't updated: ${e2.message})` : " and on the player database";
    }
    setSaving(false);
    const updated = { ...open, ...patch } as Nomination;
    setRows((rs) => rs.map((r) => (r.id === open.id ? updated : r)));
    setOpen(updated);
    setDraft(null);
    toast.success(`Saved${rosterNote}`);
  };

  const eventLine = (n: Nomination) => {
    const ev = n.event_id ? events.get(n.event_id) : undefined;
    if (!ev && !n.session_slot) return "Either day";
    return `${ev ? `${fmtDay(ev.event_date)} · ${ev.location ?? ev.title}` : ""}${n.session_slot ? `${ev ? " · " : ""}${n.session_slot}` : ""}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Nominations"
        hideTitleOnPhone
        description={loading ? "Loading…" : `${rows.length} nomination${rows.length === 1 ? "" : "s"} from coaches, clubs and schools · ${counts.new} new`}
        className="mb-0"
        actions={<Button variant="outline" size="icon" aria-label="Refresh" onClick={load} disabled={loading}><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></Button>}
      />
      <SegmentedControl
        ariaLabel="Nomination status"
        size="sm"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        options={[
          { value: "new", label: "New", count: counts.new },
          { value: "invited", label: "Invited", count: counts.invited },
          { value: "declined", label: "Declined", count: counts.declined },
          { value: "all", label: "All", count: rows.length },
        ]}
        className="md:max-w-xl"
      />
      <div className="md:hidden"><SearchField value={query} onChange={() => { /* the section search drives this page */ }} placeholder="Search nominations" className="hidden" /></div>

      {loading && rows.length === 0 ? <SkeletonRows rows={6} avatar={false} /> : shown.length === 0 ? (
        <EmptyState
          icon={Star}
          title={rows.length === 0 ? "No nominations yet" : "Nothing here"}
          description={rows.length === 0 ? "When a coach, club or school nominates a player at suffolktennis.online/nominate, they appear here and go on the player database." : "Try another tab or search."}
          compact
        />
      ) : (
        <ListGroup>
          {shown.map((n) => (
            <button key={n.id} type="button" className="press flex w-full items-center gap-3 bg-card px-4 py-3 text-left" onClick={() => { setNotes(n.admin_notes ?? ""); setDraft(null); setOpen(n); }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-medium">{player(n)}</span>
                  {n.birth_year && <span className="rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">born {n.date_of_birth ? fmtDob(n.date_of_birth, "short") : n.birth_year}</span>}
                  <RosterBadge n={n} />
                  {slotMismatch(n.session_slot, birthYearOf(n)) && <Badge variant="secondary" className="bg-amber-50 text-amber-800">Wrong age session?</Badge>}
                  {n.status !== "new" && <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[n.status]}</Badge>}
                </div>
                <div className="truncate text-[13px] text-muted-foreground">
                  {n.club ? `${n.club} · ` : ""}nominated by {n.nominator_name}{n.nominator_role ? ` (${n.nominator_role})` : ""} · {fmtWhen(n.created_at)}
                </div>
                <div className="truncate text-[12px] text-muted-foreground/80">{eventLine(n)}{n.parent_email ? ` · parent: ${n.parent_email}` : " · no parent details"}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
            </button>
          ))}
        </ListGroup>
      )}

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpen(null); setDraft(null); } }}>
        <DialogContent className="max-h-dialog overflow-auto md:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{player(open)}</DialogTitle>
                <DialogDescription>
                  Nominated {fmtWhen(open.created_at)} by {open.nominator_name}{open.nominator_role ? `, ${open.nominator_role}` : ""}.
                </DialogDescription>
              </DialogHeader>

              {draft ? (
                <EditForm draft={draft} setDraft={setDraft} events={[...events.values()]} createdPlayer={open.roster_match === "created"} />
              ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <RosterBadge n={open} />
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => setDraft(draftOf(open))}><Pencil className="h-4 w-4" /> Edit details</Button>
                </div>
                {slotMismatch(open.session_slot, birthYearOf(open)) && (
                  <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Born {birthYearOf(open)}, but nominated for “{open.session_slot}”. Use Edit details to move them to the right session.</span>
                  </div>
                )}
                {open.roster_match === "review" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                    Someone with this name is already on the database with a different parent email, so nothing was added automatically. If this is a different child, add them:
                    <div className="mt-2"><Button size="sm" variant="outline" onClick={() => addToDatabase(open)}><UserPlus className="h-4 w-4" /> Add {open.player_first_name} to the database</Button></div>
                  </div>
                )}
                <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5">
                  <dt className="text-muted-foreground">{open.date_of_birth ? "Date of birth" : "Year of birth"}</dt><dd>{open.date_of_birth ? fmtDob(open.date_of_birth, "long") : open.birth_year ?? "—"}{open.gender ? ` · ${open.gender === "male" ? "Boy" : "Girl"}` : ""}</dd>
                  <dt className="text-muted-foreground">Club / school</dt><dd>{open.club ?? "—"}</dd>
                  <dt className="text-muted-foreground">Preferred day</dt><dd>{eventLine(open)}</dd>
                  <dt className="text-muted-foreground">Nominator</dt>
                  <dd>
                    {open.nominator_name}{open.nominator_role ? ` · ${open.nominator_role}` : ""}<br />
                    <a className="text-primary underline" href={`mailto:${open.nominator_email}`}>{open.nominator_email}</a>{open.nominator_phone ? ` · ${open.nominator_phone}` : ""}
                  </dd>
                  <dt className="text-muted-foreground">Parent</dt>
                  <dd>
                    {open.parent_name || open.parent_email || open.parent_phone
                      ? <>{open.parent_name ?? ""}{open.parent_name && (open.parent_email || open.parent_phone) ? <br /> : null}{open.parent_email && <a className="text-primary underline" href={`mailto:${open.parent_email}`}>{open.parent_email}</a>}{open.parent_phone ? ` · ${open.parent_phone}` : ""}</>
                      : <span className="text-muted-foreground">Not given — ask the nominator</span>}
                  </dd>
                </dl>
                {open.reason && (
                  <div className="rounded-xl bg-muted/60 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Why</div>
                    <p className="mt-1 whitespace-pre-wrap">{open.reason}</p>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Status</Label>
                    <Select value={open.status} onValueChange={(v) => setStatus(open, v as Status)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="invited">Invited</SelectItem>
                        <SelectItem value="declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-xs text-muted-foreground">Invitations themselves go out from Bookings — the player is on the database picker.</p>
                  </div>
                  <div>
                    <Label>Note</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Spoke to mum, coming Sunday" />
                  </div>
                </div>
              </div>
              )}

              <DialogFooter>
                {draft ? (
                  <>
                    <Button variant="ghost" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
                    <Button onClick={saveEdit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
                    <Button onClick={saveNotes} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save note</Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** The edit view of a nomination: the same questions the public form asks. */
function EditForm({ draft, setDraft, events, createdPlayer }: {
  draft: Draft; setDraft: (d: Draft) => void; events: EventRow[]; createdPlayer: boolean;
}) {
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const ev = events.find((e) => e.id === draft.event_id);
  const slots = (ev?.session_slots ?? []).filter(Boolean);
  const year = draft.date_of_birth ? Number(draft.date_of_birth.slice(0, 4)) : draft.birth_year ? Number(draft.birth_year) : null;
  const mismatch = slotMismatch(draft.session_slot, year);
  const field = (label: string, key: keyof Draft, props: React.ComponentProps<typeof Input> = {}) => (
    <div>
      <Label htmlFor={`nom-${key}`}>{label}</Label>
      <Input id={`nom-${key}`} value={draft[key]} onChange={(e) => set({ [key]: e.target.value } as Partial<Draft>)} {...props} />
    </div>
  );
  const pickDay = (id: string) => {
    const next = events.find((e) => e.id === id);
    const nextSlots = (next?.session_slots ?? []).filter(Boolean);
    // Keep the same session if the new day has one with that label, else the one that fits the child.
    const keep = nextSlots.includes(draft.session_slot) ? draft.session_slot : slotFor(nextSlots, year) ?? "";
    set({ event_id: id, session_slot: keep });
  };
  return (
    <div className="space-y-4 text-sm">
      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">The player</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("First name", "player_first_name")}
          {field("Last name", "player_last_name")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nom-dob">Date of birth</Label>
            <Input id="nom-dob" type="date" value={draft.date_of_birth} min="2010-01-01" max="2024-12-31"
              onChange={(e) => set({ date_of_birth: e.target.value, birth_year: e.target.value ? e.target.value.slice(0, 4) : draft.birth_year })} />
            {!draft.date_of_birth && draft.birth_year && <p className="mt-1 text-xs text-muted-foreground">Only the year ({draft.birth_year}) was given.</p>}
          </div>
          <div>
            <Label>Boy or girl</Label>
            <Select value={draft.gender || NONE} onValueChange={(v) => set({ gender: v === NONE ? "" : v })}>
              <SelectTrigger aria-label="Boy or girl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not given</SelectItem>
                <SelectItem value="male">Boy</SelectItem>
                <SelectItem value="female">Girl</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {field("Club, school or programme", "club")}
      </div>

      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Day and session</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Day</Label>
            <Select value={draft.event_id || NONE} onValueChange={(v) => (v === NONE ? set({ event_id: "", session_slot: "" }) : pickDay(v))}>
              <SelectTrigger aria-label="Day"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Either day / not sure</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{fmtDay(e.event_date)} · {e.location ?? e.title}{e.cancelled_at ? " (cancelled)" : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Session</Label>
            <Select value={draft.session_slot || NONE} onValueChange={(v) => set({ session_slot: v === NONE ? "" : v })} disabled={!ev}>
              <SelectTrigger aria-label="Session"><SelectValue placeholder={ev ? "Choose" : "Choose a day first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not sure</SelectItem>
                {slots.map((sl) => <SelectItem key={sl} value={sl}>{sl}</SelectItem>)}
                {draft.session_slot && !slots.includes(draft.session_slot) && <SelectItem value={draft.session_slot}>{draft.session_slot}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>
        {mismatch && (
          <p className="flex gap-1.5 text-xs text-amber-800"><AlertTriangle className="h-3.5 w-3.5 shrink-0" /> This session isn't for children born in {year}.</p>
        )}
      </div>

      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Parent or guardian</div>
        {field("Name", "parent_name")}
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Email", "parent_email", { type: "email", inputMode: "email" })}
          {field("Phone", "parent_phone", { type: "tel", inputMode: "tel" })}
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nominated by</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Name", "nominator_name")}
          {field("Role and club or school", "nominator_role")}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("Email", "nominator_email", { type: "email", inputMode: "email" })}
          {field("Phone", "nominator_phone", { type: "tel", inputMode: "tel" })}
        </div>
      </div>

      <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        {createdPlayer
          ? "This nomination added the player to the database, so the name, date of birth and parent details are corrected there too."
          : "Only the nomination changes. The player's record on the database is left as it is."}
      </p>
    </div>
  );
}
