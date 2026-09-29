// Admin "Nominations" page: every child a coach, club or school has put
// forward through /nominate, with why, who by, and what happened on the
// player database. Ollie works the list from New to Invited (invitations go
// out from the Bookings tab, where nominated players already sit on the
// roster) or Declined, and keeps a note against each.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronRight, Loader2, RefreshCw, Star, UserPlus } from "lucide-react";
import { PageHeader, SegmentedControl, SearchField, ListGroup, EmptyState, SkeletonRows } from "@/components/app";
import { ageGroupOf } from "@/lib/ageGroup";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type Status = "new" | "invited" | "declined";
type Nomination = {
  id: string;
  player_first_name: string; player_last_name: string;
  birth_year: number | null; gender: string | null; club: string | null;
  event_id: string | null; session_slot: string | null;
  parent_name: string | null; parent_email: string | null; parent_phone: string | null;
  nominator_name: string; nominator_role: string | null; nominator_email: string; nominator_phone: string | null;
  reason: string | null;
  roster_id: string | null; roster_match: "created" | "existing" | "review" | null;
  status: Status; admin_notes: string | null;
  created_at: string;
};
type EventRow = { id: string; event_date: string; location: string | null; title: string };

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

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: evs }] = await Promise.all([
      db.from("talent_nominations").select("*").order("created_at", { ascending: false }),
      db.from("events").select("id, event_date, location, title").eq("event_type", "rising-stars"),
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
      age_group: n.birth_year ? ageGroupOf(`${n.birth_year}-07-01`) : null,
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
            <button key={n.id} type="button" className="press flex w-full items-center gap-3 bg-card px-4 py-3 text-left" onClick={() => { setNotes(n.admin_notes ?? ""); setOpen(n); }}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[15px] font-medium">{player(n)}</span>
                  {n.birth_year && <span className="rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">born {n.birth_year}</span>}
                  <RosterBadge n={n} />
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

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-h-dialog overflow-auto md:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{player(open)}</DialogTitle>
                <DialogDescription>
                  Nominated {fmtWhen(open.created_at)} by {open.nominator_name}{open.nominator_role ? `, ${open.nominator_role}` : ""}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2"><RosterBadge n={open} /></div>
                {open.roster_match === "review" && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] text-amber-900">
                    Someone with this name is already on the database with a different parent email, so nothing was added automatically. If this is a different child, add them:
                    <div className="mt-2"><Button size="sm" variant="outline" onClick={() => addToDatabase(open)}><UserPlus className="h-4 w-4" /> Add {open.player_first_name} to the database</Button></div>
                  </div>
                )}
                <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5">
                  <dt className="text-muted-foreground">Year of birth</dt><dd>{open.birth_year ?? "—"}{open.gender ? ` · ${open.gender === "male" ? "Boy" : "Girl"}` : ""}</dd>
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

              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button>
                <Button onClick={saveNotes} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save note</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
