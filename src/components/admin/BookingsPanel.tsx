import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Plus, Send, QrCode, Lock, Globe, RefreshCw, AlertTriangle, CalendarPlus, CalendarDays, Repeat, Trash2, Pencil, Upload, Undo2, Ban, CalendarClock, MoreHorizontal, ChevronLeft, Users, X, Ticket } from "lucide-react";
import {
  PageHeader, Section, ListGroup, ListRow, StatusBadge, bookingStatus, EmptyState, SkeletonRows,
  SearchField, Chip, ChipRow, InlineNote, SegmentedControl, VenueSelect, useIsPhone, Avatar,
} from "@/components/app";
type Cadence = "weekly" | "fortnightly" | "monthly";
import { formatTime } from "@/lib/timeFormat";

const db = supabase as any;

type EventRow = {
  id: string; title: string; description: string | null; event_date: string | null;
  location: string | null; capacity: number | null; visibility: string;
  programme_type: string; price_pence: number | null; is_free: boolean;
  meeting_cadence: string | null; sign_up_enabled: boolean; cancelled_at?: string | null;
  timetable_category?: string | null; sign_up_deadline?: string | null;
};
type Invitation = {
  id: string; child_name: string | null; parent_email: string; parent_name: string | null;
  status: string; sent_at: string | null; reminded_at: string | null;
};
type Booking = {
  id: string; child_name: string; parent_name: string; parent_email: string;
  status: string; amount_pence: number; session_slot: string | null; paid_at: string | null;
  membership_id: string | null;
};
/** An account holding the coach role — what the Coaches checklist offers. */
type Coach = { user_id: string; name: string };
type Player = {
  key: string;                 // unique across both sources
  roster_id?: string;          // player_roster row
  child_id?: string;           // registered children row
  name: string;
  age_group: string;
  gender: string | null;
  contact_email: string | null;
  parent_name: string | null;
  wtn: number | null;
  dob?: string | null;         // children rows only
  /** Has a paid programme place already — other programmes are free for them. */
  paid_programme: boolean;
};

const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];
const gbp = (p: number | null) => (p == null ? "—" : `£${(p / 100).toFixed(p % 100 === 0 ? 0 : 2)}`);
const ageGroupOf = (dob: string | null): string => {
  if (!dob) return "?";
  const ageAtYearEnd = new Date().getFullYear() - new Date(dob).getFullYear();
  const g = AGE_GROUPS.find((n) => ageAtYearEnd <= n);
  return g ? `${g}U` : "18+";
};

type DraftSession = { date: string; start: string; end: string };

/** Dates from a start date at a cadence: +7 days, +14 days, or the same day
 *  of the following month (clamped to the month's length). */
const buildDates = (startIso: string, cadence: Cadence, count: number): string[] => {
  const n = Math.max(1, Math.min(52, count || 1));
  const start = new Date(startIso + "T12:00:00");
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start);
    if (cadence === "monthly") {
      const dayOfMonth = start.getDate();
      d.setDate(1);
      d.setMonth(start.getMonth() + i);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(dayOfMonth, last));
    } else {
      d.setDate(start.getDate() + i * (cadence === "fortnightly" ? 14 : 7));
    }
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
};

const emptyForm = {
  id: null as string | null,
  title: "", description: "", event_date: "", location: "", capacity: "",
  visibility: "private", programme_type: "event", price: "", is_free: false,
  meeting_cadence: "weekly", sign_up_enabled: false, timetable_category: "squad_training",
  // A bare London date; stored as the end of that day so "accept by 30 Sep"
  // still holds at 11pm on the 30th.
  reply_by: "",
};

const londonYmd = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

const BookingsPanel = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [stats, setStats] = useState<Record<string, { invited: number; booked: number; paid: number }>>({});
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refundTarget, setRefundTarget] = useState<Booking | null>(null);
  const [refunding, setRefunding] = useState(false);
  const [sessions, setSessions] = useState<Array<{ id: string; session_date: string; start_time: string | null; end_time?: string | null; venue: string | null; cancelled_at?: string | null; moved_from_date?: string | null }>>([]);
  // Cancel / move a session, or cancel a whole event — parents are emailed.
  const [sessionChange, setSessionChange] = useState<{ mode: "cancel_session" | "reschedule_session" | "cancel_event"; session?: { id: string; session_date: string; start_time: string | null; venue: string | null } } | null>(null);
  const [changeReason, setChangeReason] = useState("");
  const [changeDate, setChangeDate] = useState("");
  const [changeTime, setChangeTime] = useState("");
  const [changeVenue, setChangeVenue] = useState("");
  const [changing, setChanging] = useState(false);
  const [pastDue, setPastDue] = useState<Array<{ id: string; child_name: string; parent_email: string; event_id: string }>>([]);
  const [loading, setLoading] = useState(true);
  // Coach accounts (loaded once) and, per event, the user ids assigned to it.
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [eventCoaches, setEventCoaches] = useState<Record<string, string[]>>({});

  // Invite dialog state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerFilter, setPlayerFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [savingPlayer, setSavingPlayer] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    first_name: "", last_name: "", gender: "", age_group: "",
    contact_name: "", contact_email: "", mobile: "", lta_number: "",
  });
  const [checked, setChecked] = useState<Set<string>>(new Set());
  // Admin override: grant these selected players a free place on this event.
  const [freePlace, setFreePlace] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", gender: "", age_group: "", contact_name: "", contact_email: "", mobile: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Event form dialog
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [savingEvent, setSavingEvent] = useState(false);
  // Coaches ticked in the form; synced to event_coaches on save.
  const [formCoaches, setFormCoaches] = useState<Set<string>>(new Set());
  // New programme: sessions are generated inside the form and saved with it.
  const [pStart, setPStart] = useState("");
  const [pTime, setPTime] = useState("");
  const [pEnd, setPEnd] = useState("");
  const [pCount, setPCount] = useState("12");
  const [draft, setDraft] = useState<DraftSession[]>([]);

  // Add sessions: one date, or a run generated from a start date and cadence.
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [genMode, setGenMode] = useState<"single" | "repeat">("repeat");
  const [genCadence, setGenCadence] = useState<Cadence>("weekly");
  const [genStart, setGenStart] = useState("");
  const [genTime, setGenTime] = useState("");
  const [genEndTime, setGenEndTime] = useState("");
  const [genVenue, setGenVenue] = useState("");
  const [genCount, setGenCount] = useState("12");
  const [genPreview, setGenPreview] = useState<string[]>([]);
  const [addingSessions, setAddingSessions] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const { data: evs } = await db.from("events").select("*").order("event_date", { ascending: false });
    setEvents(evs ?? []);
    const { data: invs } = await db.from("booking_invitations").select("event_id, status");
    const { data: bks } = await db.from("bookings").select("event_id, status");
    const s: Record<string, { invited: number; booked: number; paid: number }> = {};
    for (const i of invs ?? []) {
      s[i.event_id] ??= { invited: 0, booked: 0, paid: 0 };
      s[i.event_id].invited += 1;
      if (i.status === "booked") s[i.event_id].booked += 1;
    }
    for (const b of bks ?? []) {
      s[b.event_id] ??= { invited: 0, booked: 0, paid: 0 };
      if (b.status === "paid") s[b.event_id].paid += 1;
    }
    setStats(s);
    const { data: pd } = await db.from("memberships").select("id, child_name, parent_email, event_id").eq("status", "past_due");
    setPastDue(pd ?? []);
    const { data: ec } = await db.from("event_coaches").select("event_id, user_id");
    const byEvent: Record<string, string[]> = {};
    for (const row of ec ?? []) (byEvent[row.event_id] ??= []).push(row.user_id);
    setEventCoaches(byEvent);
    setLoading(false);
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Coach accounts: every user_roles row with the coach role, named from
  // profiles (joined client-side — user_roles has no FK to profiles). Admins
  // who also hold the coach role appear too, which is what Ollie wants.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "coach");
      const ids: string[] = Array.from(new Set<string>(((roles ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)));
      if (ids.length === 0) { if (!cancelled) setCoaches([]); return; }
      const { data: profiles } = await db.from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
      const names = new Map<string, string>(((profiles ?? []) as Array<{ user_id: string; first_name: string | null; last_name: string | null }>)
        .map((p) => [p.user_id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()]));
      const list: Coach[] = ids
        .map((id) => ({ user_id: id, name: names.get(id) || id.slice(0, 8) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      if (!cancelled) setCoaches(list);
    })();
    return () => { cancelled = true; };
  }, []);

  /** Make event_coaches match the ticked set: remove the unticked, add the missing. */
  const syncEventCoaches = async (eventId: string, ticked: Set<string>): Promise<string | null> => {
    const { data: current, error: readErr } = await db.from("event_coaches").select("user_id").eq("event_id", eventId);
    if (readErr) return readErr.message;
    const existing = new Set<string>(((current ?? []) as Array<{ user_id: string }>).map((r) => r.user_id));
    const remove = [...existing].filter((id) => !ticked.has(id));
    const add = [...ticked].filter((id) => !existing.has(id)).map((user_id) => ({ event_id: eventId, user_id }));
    if (remove.length > 0) {
      const { error } = await db.from("event_coaches").delete().eq("event_id", eventId).in("user_id", remove);
      if (error) return error.message;
    }
    if (add.length > 0) {
      const { error } = await db.from("event_coaches").upsert(add, { onConflict: "event_id,user_id" });
      if (error) return error.message;
    }
    return null;
  };

  const openEvent = async (ev: EventRow) => {
    setSelected(ev);
    const [{ data: invs }, { data: bks }, { data: sess }] = await Promise.all([
      db.from("booking_invitations").select("id, child_name, parent_email, parent_name, status, sent_at, reminded_at").eq("event_id", ev.id).order("created_at"),
      db.from("bookings").select("id, child_name, parent_name, parent_email, status, amount_pence, session_slot, paid_at, membership_id").eq("event_id", ev.id).order("created_at", { ascending: false }),
      db.from("event_sessions").select("id, session_date, start_time, end_time, venue, cancelled_at, moved_from_date").eq("event_id", ev.id).order("session_date"),
    ]);
    setInvitations(invs ?? []);
    setBookings(bks ?? []);
    setSessions(sess ?? []);
  };

  const loadPlayers = async () => {
    const [{ data: roster }, { data: kids }, { data: emails }, { data: profiles }, { data: paidProg }] = await Promise.all([
      db.from("player_roster").select("id, first_name, last_name, gender, age_group, contact_email, contact_name, singles_wtn, linked_child_id").order("last_name"),
      db.from("children").select("id, name, date_of_birth, gender, parent_user_id").order("name"),
      db.rpc("get_parent_emails"),
      db.from("profiles").select("user_id, first_name, last_name"),
      // Children already paying for a programme: any other programme is free.
      db.from("bookings").select("child_id, events!inner(programme_type)")
        .eq("status", "paid").eq("complimentary", false).eq("events.programme_type", "programme"),
    ]);
    const paidProgramme = new Set<string>((paidProg ?? []).map((b: any) => b.child_id).filter(Boolean));
    const emailMap = new Map<string, string>((emails ?? []).map((e: any) => [e.user_id, e.email]));
    const nameMap = new Map<string, string>((profiles ?? []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]));

    const rosterPlayers: Player[] = (roster ?? []).map((r: any) => ({
      key: `r:${r.id}`,
      roster_id: r.id,
      child_id: r.linked_child_id ?? undefined,
      name: `${r.first_name} ${r.last_name}`.trim(),
      age_group: r.age_group ?? "?",
      gender: r.gender,
      contact_email: r.contact_email,
      parent_name: r.contact_name,
      wtn: r.singles_wtn != null ? Number(r.singles_wtn) : null,
      paid_programme: !!r.linked_child_id && paidProgramme.has(r.linked_child_id),
    }));

    // Registered families not already represented in the roster (matched by
    // linked_child_id or by same player name + parent email).
    const seen = new Set(rosterPlayers.map((p) => `${p.name.toLowerCase()}|${(p.contact_email ?? "").toLowerCase()}`));
    const linkedChildIds = new Set(rosterPlayers.map((p) => p.child_id).filter(Boolean));
    const childPlayers: Player[] = (kids ?? [])
      .filter((k: any) => !linkedChildIds.has(k.id))
      .map((k: any) => ({
        key: `c:${k.id}`,
        child_id: k.id,
        name: k.name,
        age_group: ageGroupOf(k.date_of_birth),
        gender: k.gender,
        contact_email: emailMap.get(k.parent_user_id) ?? null,
        parent_name: nameMap.get(k.parent_user_id) ?? null,
        wtn: null,
        dob: k.date_of_birth ?? null,
        paid_programme: paidProgramme.has(k.id),
      }))
      .filter((p: Player) => !seen.has(`${p.name.toLowerCase()}|${(p.contact_email ?? "").toLowerCase()}`));

    setPlayers([...rosterPlayers, ...childPlayers].sort((a, b) => a.name.localeCompare(b.name)));
  };

  const filteredPlayers = useMemo(() => {
    return players.filter((p) => {
      if (playerFilter !== "all" && p.age_group !== playerFilter) return false;
      if (genderFilter !== "all" && (p.gender ?? "").toLowerCase() !== genderFilter) return false;
      if (playerSearch && !p.name.toLowerCase().includes(playerSearch.toLowerCase())) return false;
      return true;
    });
  }, [players, playerFilter, genderFilter, playerSearch]);

  const sendInvites = async () => {
    if (!selected) return;
    const invitees = players
      .filter((p) => checked.has(p.key) && p.contact_email)
      .map((p) => ({
        roster_id: p.roster_id,
        child_id: p.child_id,
        child_name: p.name,
        parent_email: p.contact_email!,
        complimentary: freePlace.has(p.key) || undefined,
        parent_name: p.parent_name ?? "",
      }));
    if (invitees.length === 0) {
      toast.error("No selected players with a parent email");
      return;
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-booking-invitations", {
      body: { event_id: selected.id, invitees },
    });
    setSending(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Sending failed");
      return;
    }
    toast.success(`${data.sent}/${data.total} invitation emails sent`);
    if (data.sent < data.total) {
      const firstErr = (data.results ?? []).find((r: any) => r.error)?.error;
      if (firstErr) toast.warning(String(firstErr));
    }
    setInviteOpen(false);
    setChecked(new Set());
    openEvent(selected);
    loadEvents();
  };

  const remind = async (invitationIds: string[]) => {
    if (!selected || invitationIds.length === 0) return;
    const { data, error } = await supabase.functions.invoke("send-booking-invitations", {
      body: { event_id: selected.id, remind_invitation_ids: invitationIds },
    });
    if (error || data?.error) toast.error(data?.error ?? "Reminder failed");
    else toast.success(`${data.sent} reminder(s) sent`);
    openEvent(selected);
  };

  const saveEvent = async () => {
    if (!form.title.trim()) { toast.error("Title required"); return; }
    const isProgrammeForm = form.programme_type === "programme";
    if (isProgrammeForm && !form.price) { toast.error("Programmes need a price"); return; }
    const newProgramme = isProgrammeForm && !form.id;
    if (newProgramme && draft.length === 0) { toast.error("Generate the sessions first"); return; }
    if (newProgramme && draft.some((d) => !d.date)) { toast.error("Every session needs a date"); return; }
    // A new programme starts when its first session does.
    const firstSession = newProgramme ? [...draft].sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const eventDate = firstSession
      ? new Date(`${firstSession.date}T${firstSession.start || "09:00"}:00`).toISOString()
      : form.event_date ? new Date(form.event_date).toISOString() : new Date().toISOString();
    setSavingEvent(true);
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_date: eventDate,
      location: form.location.trim() || null,
      // Programmes have no capacity; free events have no price.
      capacity: isProgrammeForm || !form.capacity ? null : Number(form.capacity),
      visibility: form.visibility,
      programme_type: form.programme_type,
      price_pence: !isProgrammeForm && form.is_free ? null : form.price ? Math.round(Number(form.price) * 100) : null,
      is_free: !isProgrammeForm && form.is_free,
      meeting_cadence: isProgrammeForm ? form.meeting_cadence : null,
      sign_up_enabled: form.sign_up_enabled,
      // Squad training is what a programme is unless told otherwise, so the
      // default is stored as null and the RPC falls back to it.
      timetable_category: form.timetable_category === "squad_training" ? null : form.timetable_category,
      sign_up_deadline: form.reply_by ? new Date(`${form.reply_by}T23:59:59`).toISOString() : null,
    };
    const { data: saved, error } = form.id
      ? await db.from("events").update(payload).eq("id", form.id).select("id").single()
      : await db.from("events").insert(payload).select("id").single();
    if (error) { setSavingEvent(false); toast.error(error.message); return; }
    if (newProgramme && saved?.id) {
      const rows = draft.map((d) => ({
        event_id: saved.id,
        session_date: d.date,
        start_time: d.start || null,
        end_time: d.end || null,
        venue: form.location.trim() || null,
      }));
      const { error: sErr } = await db.from("event_sessions").insert(rows);
      if (sErr) toast.warning(`Programme created, but the sessions could not be saved: ${sErr.message}`);
    }
    const eventId: string | null = form.id ?? saved?.id ?? null;
    if (eventId) {
      const cErr = await syncEventCoaches(eventId, formCoaches);
      if (cErr) toast.warning(`Saved, but the coaches could not be updated: ${cErr}`);
    }
    setSavingEvent(false);
    toast.success(form.id ? (isProgrammeForm ? "Programme updated" : "Event updated") : newProgramme ? `Programme created with ${draft.length} session${draft.length === 1 ? "" : "s"}` : "Event created");
    setFormOpen(false);
    setForm({ ...emptyForm });
    setDraft([]);
    setFormCoaches(new Set());
    loadEvents();
  };

  const openAddSessions = () => {
    if (!selected) return;
    setGenMode("repeat");
    setGenCadence(((selected.meeting_cadence as Cadence | null) ?? "weekly"));
    setGenStart("");
    setGenTime(sessions.find((x) => x.start_time)?.start_time?.slice(0, 5) ?? "");
    setGenEndTime(sessions.find((x) => x.end_time)?.end_time?.slice(0, 5) ?? "");
    setGenVenue(sessions.find((x) => x.venue)?.venue ?? selected.location ?? "");
    setGenCount(selected.meeting_cadence === "weekly" || !selected.meeting_cadence ? "12" : "6");
    setGenPreview([]);
    setSessionsOpen(true);
  };

  const generateDates = () => {
    if (!genStart) { toast.error("Choose the start date first"); return; }
    setGenPreview(buildDates(genStart, genCadence, Number(genCount)));
  };

  const addSessions = async () => {
    if (!selected) return;
    const dates = genMode === "single" ? (genStart ? [genStart] : []) : genPreview;
    if (dates.length === 0) { toast.error(genMode === "single" ? "Choose a date" : "Generate the dates first"); return; }
    setAddingSessions(true);
    const rows = dates.map((session_date) => ({
      event_id: selected.id,
      session_date,
      start_time: genTime || null,
      end_time: genEndTime || null,
      venue: genVenue.trim() || null,
    }));
    const { error } = await db.from("event_sessions").insert(rows);
    setAddingSessions(false);
    if (error) { toast.error(error.message); return; }
    toast.success(dates.length === 1 ? "Session added" : `${dates.length} sessions added`);
    setSessionsOpen(false);
    openEvent(selected);
  };

  // Re-import the LTA RCP report, exported as CSV. Handles the report's
  // preamble (real header is the row containing "First Name") and quoted
  // fields; upserts on LTA Number so reloading a newer export just updates.
  const importRosterCsv = async (file: File) => {
    setImporting(true);
    try {
      const text = await file.text();
      const parseLine = (line: string): string[] => {
        const out: string[] = [];
        let cur = "", inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQ = false;
            else cur += ch;
          } else if (ch === '"') inQ = true;
          else if (ch === ",") { out.push(cur); cur = ""; }
          else cur += ch;
        }
        out.push(cur);
        return out.map((s) => s.trim());
      };
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      const headerIdx = lines.findIndex((l) => l.includes("First Name") && l.includes("Last Name"));
      if (headerIdx === -1) throw new Error('No header row found — export the RCP report as CSV with its normal columns.');
      const header = parseLine(lines[headerIdx]);
      const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
      const ix = {
        lta: col("LTA Number"), first: col("First Name"), last: col("Last Name"),
        gender: col("Gender"), mobile: col("Mobile"), email: col("Email"),
        optin: col("LTA Marketing Opt-In"), age: col("Age Group"),
        swtn: col("Singles WTN"), dwtn: col("Doubles WTN"),
        matches: col("RCP Match Count"), type: col("RCP Type"),
      };
      if (ix.first === -1 || ix.last === -1) throw new Error("CSV is missing First Name / Last Name columns");

      const num = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
      const seen = new Set<string>();
      const rows = lines.slice(headerIdx + 1).map(parseLine)
        .filter((r) => r[ix.first] && r[ix.last])
        .filter((r) => { const l = ix.lta >= 0 ? r[ix.lta] : ""; if (l && seen.has(l)) return false; if (l) seen.add(l); return true; })
        .map((r) => ({
          lta_number: ix.lta >= 0 ? r[ix.lta] || null : null,
          first_name: r[ix.first], last_name: r[ix.last],
          gender: ix.gender >= 0 ? r[ix.gender] || null : null,
          age_group: ix.age >= 0 ? r[ix.age] || null : null,
          contact_email: ix.email >= 0 && r[ix.email] ? r[ix.email].toLowerCase() : null,
          mobile: ix.mobile >= 0 ? r[ix.mobile] || null : null,
          marketing_opt_in: ix.optin >= 0 ? { Yes: true, No: false }[r[ix.optin]] ?? null : null,
          singles_wtn: ix.swtn >= 0 ? num(r[ix.swtn]) : null,
          doubles_wtn: ix.dwtn >= 0 ? num(r[ix.dwtn]) : null,
          rcp_match_count: ix.matches >= 0 ? (num(r[ix.matches]) != null ? Math.round(num(r[ix.matches])!) : null) : null,
          rcp_type: ix.type >= 0 ? r[ix.type] || null : null,
        }));
      if (rows.length === 0) throw new Error("No player rows found in the file");

      let done = 0;
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await db.from("player_roster")
          .upsert(rows.slice(i, i + 100), { onConflict: "lta_number" });
        if (error) throw new Error(error.message);
        done += Math.min(100, rows.length - i);
      }
      toast.success(`Imported ${done} players (existing LTA numbers updated)`);
      loadPlayers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  /**
   * Add a player the LTA export does not cover — a new joiner, or someone who
   * competes outside the county programme. Same table as the CSV import, so
   * they show up in the invite picker and the email group picker straight away.
   */
  const addPlayer = async () => {
    const first = newPlayer.first_name.trim();
    const last = newPlayer.last_name.trim();
    if (!first || !last) { toast.error("First and last name are required"); return; }
    setSavingPlayer(true);
    try {
      const { error } = await db.from("player_roster").insert({
        // Hand-added players have no LTA number; leaving it null keeps them
        // out of the CSV import's lta_number upsert.
        lta_number: newPlayer.lta_number.trim() || null,
        first_name: first,
        last_name: last,
        gender: newPlayer.gender || null,
        age_group: newPlayer.age_group || null,
        contact_name: newPlayer.contact_name.trim() || null,
        contact_email: newPlayer.contact_email.trim().toLowerCase() || null,
        mobile: newPlayer.mobile.trim() || null,
      });
      if (error) throw new Error(error.message);
      toast.success(`${first} ${last} added`);
      setAddPlayerOpen(false);
      setNewPlayer({ first_name: "", last_name: "", gender: "", age_group: "", contact_name: "", contact_email: "", mobile: "", lta_number: "" });
      loadPlayers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add the player");
    } finally { setSavingPlayer(false); }
  };

  /** New programme (fee preset to £250) or new event (no preset price). */
  const startNew = (type: "programme" | "event") => {
    setForm({ ...emptyForm, programme_type: type, price: type === "programme" ? "250" : "", meeting_cadence: "weekly" });
    setPStart(""); setPTime(""); setPEnd(""); setPCount("12"); setDraft([]);
    setFormCoaches(new Set());
    setFormOpen(true);
  };

  const editEvent = (ev: EventRow) => {
    setForm({
      id: ev.id,
      title: ev.title,
      description: ev.description ?? "",
      event_date: ev.event_date ? ev.event_date.slice(0, 16) : "",
      location: ev.location ?? "",
      capacity: ev.capacity?.toString() ?? "",
      visibility: ev.visibility,
      programme_type: ev.programme_type,
      price: ev.price_pence != null ? (ev.price_pence / 100).toString() : "",
      is_free: !!ev.is_free,
      meeting_cadence: ev.meeting_cadence ?? "weekly",
      sign_up_enabled: ev.sign_up_enabled,
      timetable_category: ev.timetable_category ?? "squad_training",
      reply_by: ev.sign_up_deadline ? londonYmd(ev.sign_up_deadline) : "",
    });
    // loadEvents holds every assignment and re-runs after each save, so the
    // cached map is the live one; no async refresh that could overwrite ticks.
    setFormCoaches(new Set(eventCoaches[ev.id] ?? []));
    setFormOpen(true);
  };

  const refund = async () => {
    if (!refundTarget) return;
    setRefunding(true);
    const { data, error } = await supabase.functions.invoke("refund-booking", {
      body: {
        booking_id: refundTarget.id,
        // Programme bookings: stop the monthly subscription as well, otherwise
        // the parent keeps being charged after their refund.
        ...(refundTarget.membership_id ? { cancel_membership: true } : {}),
      },
    });
    setRefunding(false);
    if (error || data?.error) {
      toast.error(data?.error ?? "Refund failed");
      return;
    }
    toast.success(
      `${gbp(data.amount_refunded_pence)} refunded to ${refundTarget.parent_email}` +
      (refundTarget.membership_id ? " and the monthly plan cancelled" : ""),
    );
    (data.warnings ?? []).forEach((w: string) => toast.warning(w));
    setRefundTarget(null);
    if (selected) openEvent(selected);
    loadEvents();
  };

  const openEditPlayer = (p: Player) => {
    const [first, ...rest] = p.name.trim().split(/\s+/);
    setEditForm({
      first_name: first ?? "",
      last_name: rest.join(" "),
      gender: (p.gender ?? "").toLowerCase(),
      age_group: p.age_group === "?" || p.age_group === "18+" ? "" : p.age_group,
      contact_name: p.parent_name ?? "",
      contact_email: p.contact_email ?? "",
      mobile: "",
    });
    setEditPlayer(p);
  };

  /**
   * Roster players are updated in place. A registered child with no roster
   * row is added to the roster and linked to their account, so from here on
   * they behave like any LTA-imported player (invites, groups, reports).
   */
  const saveEditPlayer = async () => {
    if (!editPlayer) return;
    const first = editForm.first_name.trim();
    const last = editForm.last_name.trim();
    if (!first || !last) { toast.error("First and last name are required"); return; }
    setSavingEdit(true);
    const row = {
      first_name: first,
      last_name: last,
      gender: editForm.gender || null,
      age_group: editForm.age_group || null,
      contact_name: editForm.contact_name.trim() || null,
      contact_email: editForm.contact_email.trim().toLowerCase() || null,
      ...(editForm.mobile.trim() ? { mobile: editForm.mobile.trim() } : {}),
    };
    const { error } = editPlayer.roster_id
      ? await db.from("player_roster").update(row).eq("id", editPlayer.roster_id)
      : await db.from("player_roster").insert({ ...row, linked_child_id: editPlayer.child_id ?? null, source: "admin" });
    setSavingEdit(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editPlayer.roster_id ? `${first} ${last} updated` : `${first} ${last} added to the database`);
    setEditPlayer(null);
    loadPlayers();
  };

  const submitSessionChange = async () => {
    if (!sessionChange || !selected) return;
    setChanging(true);
    const { data, error } = await supabase.functions.invoke("cancel-session", {
      body: {
        action: sessionChange.mode,
        session_id: sessionChange.session?.id,
        event_id: selected.id,
        reason: changeReason.trim(),
        ...(sessionChange.mode === "reschedule_session" && {
          new_date: changeDate,
          new_start: changeTime || undefined,
          new_venue: changeVenue.trim() || undefined,
        }),
      },
    });
    setChanging(false);
    if (error || data?.error) { toast.error(data?.error ?? "Could not make the change"); return; }
    toast.success(`Done — ${data.notified}/${data.total} parent${data.total === 1 ? "" : "s"} emailed`);
    setSessionChange(null);
    if (sessionChange.mode === "cancel_event") setSelected({ ...selected, cancelled_at: new Date().toISOString() });
    openEvent(selected);
    loadEvents();
  };

  const phone = useIsPhone();
  const [actionsOpen, setActionsOpen] = useState(false);
  const isProgramme = selected?.programme_type === "programme";
  const s0 = selected ? (stats[selected.id] ?? { invited: 0, booked: 0, paid: 0 }) : null;
  const unbooked = invitations.filter((i) => i.status === "invited" || i.status === "opened");
  const priceLine = (ev: EventRow) =>
    ev.programme_type === "programme"
      ? `${gbp(ev.price_pence)} · ${ev.meeting_cadence ?? "regular"} programme`
      : ev.is_free ? "Free event" : `${gbp(ev.price_pence)} · event`;
  const placesLine = (ev: EventRow) => {
    const st = stats[ev.id] ?? { invited: 0, booked: 0, paid: 0 };
    return `${st.invited} invited · ${ev.capacity ? `${st.paid}/${ev.capacity} places` : `${st.paid} booked`}`;
  };
  const fmtDate = (d: string) => new Date(d.length === 10 ? d + "T12:00:00" : d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const coachName = (id: string) => coaches.find((c) => c.user_id === id)?.name ?? id.slice(0, 8);
  const coachesOf = (ev: EventRow): string[] => eventCoaches[ev.id] ?? [];
  const coachCountLine = (ev: EventRow) => {
    const n = coachesOf(ev).length;
    return n === 0 ? null : `${n} coach${n === 1 ? "" : "es"}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Bookings" hideTitleOnPhone description="Events and programmes parents can book." className="mb-0" />
        <SkeletonRows rows={4} avatar={false} />
      </div>
    );
  }

  const showList = !phone || !selected;
  const showDetail = !!selected;

  return (
    <div className="space-y-6">
      {showList && (
        <>
          <PageHeader
            title="Bookings"
            hideTitleOnPhone
            description="Events and programmes parents can book, who has been invited and who has paid."
            className="mb-0"
            actions={
              <>
                <div className="hidden gap-2 md:flex">
                  <Button asChild variant="outline" size="sm"><Link to="/admin/scan"><QrCode className="w-4 h-4" /> Scanner</Link></Button>
                  <Button variant="outline" size="sm" disabled={importing} onClick={() => document.getElementById("roster-csv-input")?.click()}>
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Import CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setAddPlayerOpen(true)}><Plus className="w-4 h-4" /> Add player</Button>
                </div>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="More actions" onClick={() => setActionsOpen(true)}><MoreHorizontal className="w-4 h-4" /></Button>
                <input id="roster-csv-input" type="file" accept=".csv,text/csv" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importRosterCsv(f); e.target.value = ""; }} />
              </>
            }
          />

          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => startNew("programme")} className="press rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Repeat className="h-5 w-5" strokeWidth={1.8} /></div>
              <p className="text-[15px] font-semibold leading-tight">New programme</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">A season squad, one payment for every session.</p>
            </button>
            <button type="button" onClick={() => startNew("event")} className="press rounded-2xl border border-border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="h-5 w-5" strokeWidth={1.8} /></div>
              <p className="text-[15px] font-semibold leading-tight">New event</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">A session, camp or open day, priced or free.</p>
            </button>
          </div>

          {pastDue.length > 0 && (
            <InlineNote tone="danger" icon={AlertTriangle}>
              <p className="font-medium">Failed payments to chase ({pastDue.length})</p>
              <ul className="mt-1 space-y-0.5 text-[13px]">
                {pastDue.map((m) => <li key={m.id}><strong>{m.child_name}</strong> — {m.parent_email} · entry blocked until paid</li>)}
              </ul>
            </InlineNote>
          )}

          {events.length === 0 ? (
            <EmptyState icon={Ticket} title="No events yet" description="Create a programme or an event above, then invite players to it." />
          ) : (
            <>
              <ListGroup className="md:hidden">
                {events.map((ev) => (
                  <ListRow
                    key={ev.id}
                    onClick={() => openEvent(ev)}
                    selected={selected?.id === ev.id}
                    title={<span className={ev.cancelled_at ? "line-through text-muted-foreground" : undefined}>{ev.title}</span>}
                    subtitle={priceLine(ev)}
                    detail={placesLine(ev)}
                    trailing={ev.cancelled_at
                      ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge>
                      : ev.visibility === "private" ? <Lock className="w-4 h-4 text-muted-foreground/70" aria-label="Private" /> : <Globe className="w-4 h-4 text-muted-foreground/70" aria-label="Public" />}
                    chevron
                  />
                ))}
              </ListGroup>
              <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
                {events.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => openEvent(ev)}
                    className={`press rounded-2xl border bg-card p-4 text-left shadow-card transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected?.id === ev.id ? "border-primary ring-1 ring-primary" : "border-border"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[15px] font-semibold leading-snug ${ev.cancelled_at ? "line-through text-muted-foreground" : ""}`}>{ev.title}</p>
                      {ev.cancelled_at
                        ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge>
                        : ev.visibility === "private" ? <StatusBadge tone="neutral" dot={false}><Lock className="w-3 h-3" />Private</StatusBadge> : <StatusBadge tone="info" dot={false}><Globe className="w-3 h-3" />Public</StatusBadge>}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{priceLine(ev)}</p>
                    <p className="text-sm text-muted-foreground">{placesLine(ev)}{coachCountLine(ev) ? ` · ${coachCountLine(ev)}` : ""}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showDetail && selected && (
        <div className="space-y-6">
          {phone && (
            <button type="button" onClick={() => setSelected(null)} className="hit-area -ml-1 inline-flex h-9 items-center gap-0.5 text-[15px] font-medium text-primary">
              <ChevronLeft className="w-5 h-5" /> All events
            </button>
          )}
          <div className={phone ? "" : "rounded-2xl border border-border bg-card p-5 shadow-card md:p-6"}>
            <div className="flex flex-col gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl font-semibold leading-tight md:text-2xl">{selected.title}</h2>
                  {selected.cancelled_at
                    ? <StatusBadge tone="danger">Cancelled</StatusBadge>
                    : selected.visibility === "private" ? <StatusBadge tone="neutral" dot={false}><Lock className="w-3 h-3" />Invitation only</StatusBadge> : <StatusBadge tone="info" dot={false}><Globe className="w-3 h-3" />Public</StatusBadge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {priceLine(selected)}
                  {selected.location ? ` · ${selected.location}` : ""}
                  {selected.event_date && !isProgramme ? ` · ${fmtDate(selected.event_date)}` : ""}
                </p>
                {/* Assigned coaches — tapping opens the form, where they are ticked. */}
                <button
                  type="button"
                  onClick={() => editEvent(selected)}
                  aria-label="Edit coaches"
                  className="hit-area mt-2 -ml-1 inline-flex min-h-9 max-w-full items-center gap-2 rounded-lg px-1 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {coachesOf(selected).length === 0 ? (
                    <span>No coaches assigned</span>
                  ) : (
                    <>
                      <span className="flex -space-x-1.5">
                        {coachesOf(selected).map((id) => (
                          <Avatar key={id} name={coachName(id)} size="xs" className="ring-2 ring-card" />
                        ))}
                      </span>
                      <span className="truncate text-foreground">{coachesOf(selected).map((id) => coachName(id).split(/\s+/)[0]).join(", ")}</span>
                    </>
                  )}
                  <Pencil className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
                </button>
                {s0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2 md:max-w-sm">
                    {[{ n: s0.invited, l: "Invited" }, { n: s0.booked, l: "Booked" }, { n: s0.paid, l: selected.capacity ? `Paid / ${selected.capacity}` : "Paid" }].map((x) => (
                      <div key={x.l} className="rounded-xl bg-muted/70 px-3 py-2">
                        <p className="text-lg font-semibold leading-none tabular">{x.n}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{x.l}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => { loadPlayers(); setInviteOpen(true); }} disabled={!!selected.cancelled_at}><Send className="w-4 h-4" /> Invite players</Button>
                <Button variant="outline" size="sm" onClick={() => editEvent(selected)}><Pencil className="w-4 h-4" /> Edit</Button>
                {!selected.cancelled_at && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => { setChangeReason(""); setSessionChange({ mode: "cancel_event" }); }}>
                    <Ban className="w-4 h-4" /> Cancel event
                  </Button>
                )}
              </div>
            </div>

            <div className={phone ? "mt-6 space-y-6" : "mt-6 space-y-6"}>
              <Section
                title="Session dates"
                count={sessions.filter((x) => !x.cancelled_at).length}
                description={isProgramme ? "Every date is included in the programme fee. Parents are emailed when a session is moved or cancelled." : "Optional — add dates if this event runs over more than one day."}
                action={<Button size="sm" variant={sessions.length === 0 ? "default" : "outline"} onClick={openAddSessions} disabled={!!selected.cancelled_at}><CalendarPlus className="w-4 h-4" /> Add sessions</Button>}
              >
                {sessions.length === 0 ? (
                  <EmptyState icon={CalendarPlus} title="No dates yet" description="Add a single date, or generate a run of weekly, fortnightly or monthly sessions from a start date." compact />
                ) : (
                  <ListGroup>
                    {sessions.map((x) => (
                      <ListRow
                        key={x.id}
                        size="sm"
                        title={<span className={x.cancelled_at ? "line-through text-muted-foreground" : undefined}>{fmtDate(x.session_date)}{x.start_time ? ` · ${formatTime(x.start_time)}` : ""}</span>}
                        subtitle={[x.venue, x.cancelled_at ? "Cancelled" : x.moved_from_date ? `Moved from ${fmtDate(x.moved_from_date)}` : null].filter(Boolean).join(" · ") || undefined}
                        trailing={
                          <span className="flex items-center">
                            {!x.cancelled_at && (
                              <>
                                <Button size="icon-sm" variant="ghost" aria-label="Move this session" title="Move (parents are emailed)" onClick={() => {
                                  setChangeReason(""); setChangeDate(x.session_date); setChangeTime(x.start_time?.slice(0, 5) ?? ""); setChangeVenue(x.venue ?? "");
                                  setSessionChange({ mode: "reschedule_session", session: x });
                                }}><CalendarClock className="w-4 h-4" /></Button>
                                <Button size="icon-sm" variant="ghost" aria-label="Cancel this session" title="Cancel (parents are emailed)" onClick={() => { setChangeReason(""); setSessionChange({ mode: "cancel_session", session: x }); }}><Ban className="w-4 h-4 text-amber-600" /></Button>
                              </>
                            )}
                            <Button size="icon-sm" variant="ghost" aria-label="Delete without telling anyone" title="Delete without telling anyone" onClick={async () => { await db.from("event_sessions").delete().eq("id", x.id); openEvent(selected); }}><Trash2 className="w-4 h-4 text-muted-foreground" /></Button>
                          </span>
                        }
                      />
                    ))}
                  </ListGroup>
                )}
              </Section>

              <Section
                title="Invitations"
                count={invitations.length}
                action={unbooked.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => remind(unbooked.map((i) => i.id))}>
                    <RefreshCw className="w-4 h-4" /> Remind {unbooked.length}
                  </Button>
                )}
              >
                {invitations.length === 0 ? (
                  <EmptyState icon={Send} title="Nobody invited yet" description="Invite players and their parents get an email with a personal booking link." compact />
                ) : (
                  <>
                    <ListGroup className="md:hidden">
                      {invitations.map((i) => {
                        const st = bookingStatus(i.status);
                        return (
                          <ListRow
                            key={i.id}
                            size="sm"
                            title={i.child_name ?? i.parent_email}
                            subtitle={i.parent_name || i.parent_email}
                            detail={`${i.sent_at ? `Sent ${new Date(i.sent_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "Not sent"}${i.reminded_at ? " · reminded" : ""}`}
                            trailing={
                              <span className="flex items-center gap-2">
                                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                                {(i.status === "invited" || i.status === "opened") && (
                                  <Button variant="ghost" size="icon-sm" aria-label="Resend invitation" onClick={() => remind([i.id])}><RefreshCw className="w-4 h-4" /></Button>
                                )}
                              </span>
                            }
                          />
                        );
                      })}
                    </ListGroup>
                    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Player</TableHead><TableHead>Parent</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead><TableHead />
                        </TableRow></TableHeader>
                        <TableBody>
                          {invitations.map((i) => {
                            const st = bookingStatus(i.status);
                            return (
                              <TableRow key={i.id}>
                                <TableCell className="font-medium">{i.child_name}</TableCell>
                                <TableCell className="text-muted-foreground">{i.parent_name || i.parent_email}</TableCell>
                                <TableCell><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                  {i.sent_at ? new Date(i.sent_at).toLocaleDateString("en-GB") : "not sent"}
                                  {i.reminded_at ? " · reminded" : ""}
                                </TableCell>
                                <TableCell className="text-right">
                                  {(i.status === "invited" || i.status === "opened") && (
                                    <Button variant="ghost" size="sm" onClick={() => remind([i.id])}>Resend</Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </Section>

              <Section title="Bookings" count={bookings.length}>
                {bookings.length === 0 ? (
                  <EmptyState icon={Ticket} title="No bookings yet" description="Bookings appear here as parents confirm their places." compact />
                ) : (
                  <>
                    <ListGroup className="md:hidden">
                      {bookings.map((b) => {
                        const st = bookingStatus(b.status);
                        return (
                          <ListRow
                            key={b.id}
                            size="sm"
                            title={b.child_name}
                            subtitle={b.parent_email}
                            detail={`${gbp(b.amount_pence)}${b.membership_id ? "/mo" : ""}${b.session_slot ? ` · ${b.session_slot}` : ""}${b.paid_at ? ` · paid ${new Date(b.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`}
                            trailing={
                              <span className="flex items-center gap-2">
                                <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
                                {b.status === "paid" && <Button variant="ghost" size="icon-sm" aria-label="Refund" onClick={() => setRefundTarget(b)}><Undo2 className="w-4 h-4" /></Button>}
                              </span>
                            }
                          />
                        );
                      })}
                    </ListGroup>
                    <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Player</TableHead><TableHead>Parent</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead>Paid</TableHead><TableHead className="text-right">Actions</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {bookings.map((b) => {
                            const st = bookingStatus(b.status);
                            return (
                              <TableRow key={b.id}>
                                <TableCell className="font-medium">{b.child_name}{b.session_slot ? <span className="text-muted-foreground text-xs"> · {b.session_slot}</span> : null}</TableCell>
                                <TableCell className="text-muted-foreground">{b.parent_email}</TableCell>
                                <TableCell className="tabular">{gbp(b.amount_pence)}{b.membership_id ? "/mo" : ""}</TableCell>
                                <TableCell><StatusBadge tone={st.tone}>{st.label}</StatusBadge></TableCell>
                                <TableCell className="text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString("en-GB") : "—"}</TableCell>
                                <TableCell className="text-right">
                                  {b.status === "paid" && (
                                    <Button variant="ghost" size="sm" onClick={() => setRefundTarget(b)}><Undo2 className="w-4 h-4" /> Refund</Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </Section>
            </div>
          </div>
        </div>
      )}

      {/* Secondary actions (phone) */}
      <Dialog open={actionsOpen} onOpenChange={setActionsOpen}>
        <DialogContent className="gap-3 md:max-w-sm">
          <DialogHeader><DialogTitle>Actions</DialogTitle></DialogHeader>
          <ListGroup>
            <ListRow size="sm" href="/admin/scan" leading={<QrCode className="w-5 h-5 text-muted-foreground" />} title="Ticket scanner" chevron />
            <ListRow size="sm" onClick={() => { setActionsOpen(false); document.getElementById("roster-csv-input")?.click(); }} leading={<Upload className="w-5 h-5 text-muted-foreground" />} title="Import players (CSV)" subtitle="LTA RCP report export" />
            <ListRow size="sm" onClick={() => { setActionsOpen(false); setAddPlayerOpen(true); }} leading={<Plus className="w-5 h-5 text-muted-foreground" />} title="Add a player by hand" />
          </ListGroup>
        </DialogContent>
      </Dialog>

      {/* Add a single player by hand */}
      <Dialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add a player</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>First name *</Label>
              <Input value={newPlayer.first_name} onChange={(e) => setNewPlayer({ ...newPlayer, first_name: e.target.value })} /></div>
            <div><Label>Last name *</Label>
              <Input value={newPlayer.last_name} onChange={(e) => setNewPlayer({ ...newPlayer, last_name: e.target.value })} /></div>
            <div>
              <Label>Age group</Label>
              <Select value={newPlayer.age_group} onValueChange={(v) => setNewPlayer({ ...newPlayer, age_group: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map((a) => <SelectItem key={a} value={`${a}U`}>{a}U</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={newPlayer.gender} onValueChange={(v) => setNewPlayer({ ...newPlayer, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parent name</Label>
              <Input value={newPlayer.contact_name} autoComplete="name" onChange={(e) => setNewPlayer({ ...newPlayer, contact_name: e.target.value })} /></div>
            <div><Label>Parent email</Label>
              <Input type="email" inputMode="email" autoComplete="email" value={newPlayer.contact_email}
                onChange={(e) => setNewPlayer({ ...newPlayer, contact_email: e.target.value })} /></div>
            <div><Label>Mobile</Label>
              <Input type="tel" inputMode="tel" value={newPlayer.mobile} onChange={(e) => setNewPlayer({ ...newPlayer, mobile: e.target.value })} /></div>
            <div><Label>LTA number</Label>
              <Input inputMode="numeric" value={newPlayer.lta_number} onChange={(e) => setNewPlayer({ ...newPlayer, lta_number: e.target.value })}
                placeholder="Leave blank if they have none" /></div>
          </div>
          <p className="text-xs text-muted-foreground">
            Added to the same roster the LTA import fills, so they appear in the invite picker and the
            email group picker right away. A parent email is what makes them mailable.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddPlayerOpen(false)}>Cancel</Button>
            <Button onClick={addPlayer} disabled={savingPlayer}>
              {savingPlayer && <Loader2 className="w-4 h-4 animate-spin" />}Add player
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite players — near full-screen: this is where Ollie works through
          the whole county database, so it gets the room. */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="h-dialog max-h-[96dvh] gap-3 p-0 md:max-w-6xl md:w-[96vw]" hideClose>
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 space-y-3 border-b border-border px-4 pb-3 pt-6 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="truncate">Invite players</DialogTitle>
                  <p className="truncate text-sm text-muted-foreground">{selected?.title}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>Close</Button>
              </div>
              <div className="flex gap-2">
                <SearchField value={playerSearch} onChange={setPlayerSearch} placeholder="Search players" className="flex-1" />
                <div className="hidden gap-2 md:flex">
                  <Select value={playerFilter} onValueChange={setPlayerFilter}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All ages</SelectItem>
                      {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                      <SelectItem value="Open">Open</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={genderFilter} onValueChange={setGenderFilter}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="male">Boys</SelectItem>
                      <SelectItem value="female">Girls</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => setAddPlayerOpen(true)}><Plus className="w-4 h-4" /> Add new player</Button>
                </div>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Add new player" onClick={() => setAddPlayerOpen(true)}><Plus className="w-4 h-4" /></Button>
              </div>
              <ChipRow className="md:hidden">
                <Chip active={playerFilter === "all"} onClick={() => setPlayerFilter("all")}>All ages</Chip>
                {AGE_GROUPS.map((g) => <Chip key={g} active={playerFilter === `${g}U`} onClick={() => setPlayerFilter(`${g}U`)}>{g}U</Chip>)}
                <Chip active={genderFilter === "male"} onClick={() => setGenderFilter(genderFilter === "male" ? "all" : "male")}>Boys</Chip>
                <Chip active={genderFilter === "female"} onClick={() => setGenderFilter(genderFilter === "female" ? "all" : "female")}>Girls</Chip>
              </ChipRow>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular">
                  {filteredPlayers.length} players · {checked.size} selected
                  {freePlace.size > 0 ? ` · ${freePlace.size} free place${freePlace.size === 1 ? "" : "s"}` : ""}
                </span>
                <button type="button" className="inline-flex min-h-8 items-center font-medium text-primary" onClick={() => {
                  const all = new Set(checked);
                  const allChecked = filteredPlayers.every((p) => all.has(p.key));
                  filteredPlayers.forEach((p) => allChecked ? all.delete(p.key) : all.add(p.key));
                  setChecked(all);
                }}>{filteredPlayers.length > 0 && filteredPlayers.every((p) => checked.has(p.key)) ? "Unselect all shown" : "Select all shown"}</button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {filteredPlayers.length === 0 ? (
                <div className="p-6"><EmptyState icon={Users} title="No players match" compact /></div>
              ) : (
                <>
                  {/* Phone rows */}
                  <div className="divide-y divide-border md:hidden">
                    {filteredPlayers.map((p) => {
                      const included = selected?.programme_type === "programme" && p.paid_programme;
                      const isChecked = checked.has(p.key);
                      return (
                        <div key={p.key} className={`flex items-center gap-3 px-4 py-2.5 ${isChecked ? "bg-primary/[0.06]" : ""}`}>
                          <Checkbox aria-label={`Select ${p.name}`} checked={isChecked} onCheckedChange={(v) => {
                            const next = new Set(checked);
                            v === true ? next.add(p.key) : next.delete(p.key);
                            setChecked(next);
                          }} />
                          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openEditPlayer(p)}>
                            <div className="flex items-center gap-2">
                              <span className="truncate text-[15px] font-medium">{p.name}</span>
                              <span className="shrink-0 rounded-md bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{p.age_group}</span>
                              {included && <StatusBadge tone="success" dot={false}>included</StatusBadge>}
                            </div>
                            <div className="truncate text-[13px] text-muted-foreground">{p.contact_email ?? <span className="text-red-600">no parent email</span>}{p.parent_name ? ` · ${p.parent_name}` : ""}</div>
                          </button>
                          {!included && (
                            <label className="flex shrink-0 flex-col items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Checkbox aria-label={`Give ${p.name} a free place`} checked={freePlace.has(p.key)} onCheckedChange={(v) => {
                                const next = new Set(freePlace);
                                v === true ? next.add(p.key) : next.delete(p.key);
                                setFreePlace(next);
                              }} />
                              free
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* Desktop table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-card">
                        <TableRow>
                          <TableHead className="w-8"></TableHead>
                          <TableHead>Player</TableHead>
                          <TableHead>Age</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead>WTN</TableHead>
                          <TableHead>Parent</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Free place</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPlayers.map((p) => {
                          const included = selected?.programme_type === "programme" && p.paid_programme;
                          return (
                            <TableRow key={p.key} className={checked.has(p.key) ? "bg-primary/[0.06]" : undefined}>
                              <TableCell>
                                <Checkbox aria-label={`Select ${p.name}`} checked={checked.has(p.key)} onCheckedChange={(v) => {
                                  const next = new Set(checked);
                                  v === true ? next.add(p.key) : next.delete(p.key);
                                  setChecked(next);
                                }} />
                              </TableCell>
                              <TableCell>
                                <button className="font-medium text-left hover:underline" onClick={() => openEditPlayer(p)} title="Edit player details">
                                  {p.name}
                                </button>
                                {p.child_id && <Badge variant="outline" className="ml-2 text-[10px]">account</Badge>}
                                {included && <StatusBadge tone="success" dot={false} className="ml-2">no extra charge</StatusBadge>}
                              </TableCell>
                              <TableCell><Badge variant="outline" className="text-[10px]">{p.age_group}</Badge></TableCell>
                              <TableCell className="text-muted-foreground capitalize">{p.gender ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground">{p.wtn ?? "—"}</TableCell>
                              <TableCell className="text-muted-foreground text-xs">
                                <div className="truncate max-w-[16rem]">{p.contact_email ?? <span className="text-red-600">no parent email</span>}</div>
                                {p.parent_name && <div className="truncate max-w-[16rem]">{p.parent_name}</div>}
                              </TableCell>
                              <TableCell className="text-right">
                                {included ? (
                                  <span className="text-[11px] text-muted-foreground">automatic</span>
                                ) : (
                                  <Checkbox
                                    aria-label={`Give ${p.name} a free place`}
                                    checked={freePlace.has(p.key)}
                                    onCheckedChange={(v) => {
                                      const next = new Set(freePlace);
                                      v === true ? next.add(p.key) : next.delete(p.key);
                                      setFreePlace(next);
                                    }}
                                  />
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 border-t border-border bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 md:px-6">
              <p className="mb-2 hidden text-xs text-muted-foreground md:block">
                {selected?.programme_type === "programme"
                  ? "Children already paying for a programme are included free automatically. Tick “free place” to waive the fee for anyone else."
                  : "Tick “free place” to invite someone at no charge."}
              </p>
              <Button onClick={sendInvites} disabled={sending || checked.size === 0} className="w-full md:w-auto" size="lg">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send {checked.size} invitation{checked.size === 1 ? "" : "s"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit a player's details straight from the picker */}
      <Dialog open={!!editPlayer} onOpenChange={(o) => !o && setEditPlayer(null)}>
        <DialogContent className="md:max-w-md">
          <DialogHeader><DialogTitle>{editPlayer?.roster_id ? "Edit player" : "Add to the county database"}</DialogTitle></DialogHeader>
          {editPlayer && !editPlayer.roster_id && (
            <p className="text-sm text-muted-foreground">
              {editPlayer.name} is registered by a parent but isn't on the county database yet. Saving adds them, linked to the parent's account.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} /></div>
            <div>
              <Label>Age group</Label>
              <Select value={editForm.age_group} onValueChange={(v) => setEditForm({ ...editForm, age_group: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  {AGE_GROUPS.map((g) => <SelectItem key={g} value={`${g}U`}>{g}U</SelectItem>)}
                  <SelectItem value="Open">Open</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={editForm.gender} onValueChange={(v) => setEditForm({ ...editForm, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Boy</SelectItem>
                  <SelectItem value="female">Girl</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Parent name</Label><Input autoComplete="name" value={editForm.contact_name} onChange={(e) => setEditForm({ ...editForm, contact_name: e.target.value })} /></div>
            <div className="col-span-2"><Label>Parent email</Label><Input type="email" inputMode="email" value={editForm.contact_email} onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Mobile</Label><Input type="tel" inputMode="tel" value={editForm.mobile} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditPlayer(null)}>Cancel</Button>
            <Button onClick={saveEditPlayer} disabled={savingEdit}>
              {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
              {editPlayer?.roster_id ? "Save changes" : "Add to database"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event create/edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="md:max-w-lg">
          <DialogHeader><DialogTitle>{form.id ? (form.programme_type === "programme" ? "Edit programme" : "Edit event") : form.programme_type === "programme" ? "New programme" : "New event"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              {form.programme_type !== "programme" && (
                <div><Label>Date &amp; time</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></div>
              )}
              <div className={form.programme_type === "programme" ? "sm:col-span-2" : ""}>
                <Label>Venue</Label>
                <VenueSelect value={form.location} onChange={(v) => setForm({ ...form, location: v })} placeholder={form.programme_type === "programme" ? "Where every session is held" : "Choose a venue"} />
              </div>
              <div className="sm:col-span-2">
                <Label>Coaches</Label>
                {coaches.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">No coach accounts yet — give someone the coach role and they will appear here.</p>
                ) : (
                  <div className="mt-1.5 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {coaches.map((c) => {
                      const ticked = formCoaches.has(c.user_id);
                      return (
                        <label key={c.user_id} className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm ${ticked ? "bg-primary/[0.06]" : ""}`}>
                          <Checkbox
                            aria-label={`Assign ${c.name}`}
                            checked={ticked}
                            onCheckedChange={(v) => {
                              const next = new Set(formCoaches);
                              if (v === true) next.add(c.user_id); else next.delete(c.user_id);
                              setFormCoaches(next);
                            }}
                          />
                          <span className="min-w-0 truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
              <div>
                <Label>Visibility</Label>
                <Select value={form.visibility} onValueChange={(v) => setForm({ ...form, visibility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">Private (invitation only)</SelectItem>
                    <SelectItem value="public">Public</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type</Label>
                <Select
                  value={form.programme_type}
                  onValueChange={(v) => setForm({ ...form, programme_type: v, price: v === "programme" && !form.price ? "250" : form.price })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="event">Event — a session or camp</SelectItem>
                    <SelectItem value="programme">Programme — a season squad</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Counts on the Suffolk Tennis timetable as</Label>
                <Select value={form.timetable_category} onValueChange={(v) => setForm({ ...form, timetable_category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="squad_training">Squad Training</SelectItem>
                    <SelectItem value="individual_lesson">Individual Lesson</SelectItem>
                    <SelectItem value="free_play">Free Play / Practice Match</SelectItem>
                    <SelectItem value="tennis_sc">Tennis Specific (S&amp;C)</SelectItem>
                    <SelectItem value="other_sport">Other Sport</SelectItem>
                    <SelectItem value="official_match">Official Match</SelectItem>
                    <SelectItem value="tournament">Tournament</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Every session here counts as this on the parent's Suffolk Tennis timetable, and against their LTA target.</p>
              </div>
              <div className="sm:col-span-2">
                <Label>Reply-by date</Label>
                <Input type="date" value={form.reply_by} onChange={(e) => setForm({ ...form, reply_by: e.target.value })} />
                <p className="mt-1 text-xs text-muted-foreground">Goes in the invitation email as the date to accept the place by. Leave blank and the email asks parents to confirm as soon as they can.</p>
              </div>
              {form.programme_type === "programme" ? (
                <>
                  <div>
                    <Label>Sessions</Label>
                    <Select value={form.meeting_cadence} onValueChange={(v) => setForm({ ...form, meeting_cadence: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="fortnightly">Fortnightly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Programme fee (£, paid up front)</Label>
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                  </div>
                  <p className="text-xs text-muted-foreground sm:col-span-2">
                    One payment covers every session. A child already paying for a programme is invited to any other programme at no extra charge.
                  </p>
                </>
              ) : (
                <>
                  <div>
                    <Label>Price (£)</Label>
                    <Input type="number" inputMode="decimal" min="0" step="0.01" value={form.price} disabled={form.is_free} onChange={(e) => setForm({ ...form, price: e.target.value })} />
                    <label className="mt-2 flex min-h-8 items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={form.is_free} onCheckedChange={(v) => setForm({ ...form, is_free: v === true })} />
                      This session is free
                    </label>
                  </div>
                  <div><Label>Capacity</Label><Input type="number" inputMode="numeric" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /></div>
                </>
              )}
            </div>
            {form.visibility === "public" && (
              <label className="flex min-h-8 items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={form.sign_up_enabled} onCheckedChange={(v) => setForm({ ...form, sign_up_enabled: v === true })} />
                Open sign-ups on the public events page
              </label>
            )}

            {form.programme_type === "programme" && form.id && (
              <p className="rounded-xl bg-muted/70 px-3.5 py-3 text-xs text-muted-foreground">Session dates are managed from the programme page with the Add sessions button.</p>
            )}

            {form.programme_type === "programme" && !form.id && (
              <div className="space-y-4 border-t border-border pt-4">
                <div>
                  <p className="text-[15px] font-semibold">Sessions</p>
                  <p className="text-xs text-muted-foreground">Start date and time, then generate the run — every date and time can be changed before you create the programme.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Start date</Label><Input type="date" value={pStart} onChange={(e) => setPStart(e.target.value)} /></div>
                  <div><Label>Number of sessions</Label><Input type="number" inputMode="numeric" min="1" max="52" value={pCount} onChange={(e) => setPCount(e.target.value)} /></div>
                  <div><Label>Start time</Label><Input type="time" value={pTime} onChange={(e) => setPTime(e.target.value)} /></div>
                  <div><Label>End time</Label><Input type="time" value={pEnd} onChange={(e) => setPEnd(e.target.value)} /></div>
                </div>
                <Button
                  type="button"
                  variant={draft.length === 0 ? "default" : "outline"}
                  className="w-full"
                  disabled={!pStart}
                  onClick={() => setDraft(buildDates(pStart, form.meeting_cadence as Cadence, Number(pCount)).map((date) => ({ date, start: pTime, end: pEnd })))}
                >
                  <Repeat className="w-4 h-4" /> {draft.length === 0 ? "Generate sessions" : "Regenerate sessions"}
                </Button>
                {draft.length > 0 && (
                  <div>
                    <div className="mb-2 flex items-center justify-between px-0.5">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{draft.length} session{draft.length === 1 ? "" : "s"} · {form.meeting_cadence}</p>
                      <button type="button" className="inline-flex min-h-8 items-center text-xs font-medium text-primary" onClick={() => setDraft((d) => [...d, { date: "", start: pTime, end: pEnd }])}>+ Add another</button>
                    </div>
                    <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                      {draft.map((d, i) => (
                        <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-3 py-2">
                          <div className="min-w-0">
                            <Input type="date" aria-label={`Session ${i + 1} date`} value={d.date} onChange={(e) => setDraft((all) => all.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} className="h-10" />
                            {d.date && <p className="mt-1 px-1 text-[11px] text-muted-foreground">{new Date(d.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}</p>}
                          </div>
                          <Input type="time" aria-label={`Session ${i + 1} start time`} value={d.start} onChange={(e) => setDraft((all) => all.map((x, j) => j === i ? { ...x, start: e.target.value } : x))} className="h-10 w-[7.25rem] self-start" />
                          <Button type="button" size="icon-sm" variant="ghost" className="self-start" aria-label={`Remove session ${i + 1}`} onClick={() => setDraft((all) => all.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button onClick={saveEvent} disabled={savingEvent}>
              {savingEvent ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {form.id ? "Save changes" : form.programme_type === "programme" ? "Create programme" : "Create event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add sessions: one date, or generate a run from a start date. */}
      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>Add sessions</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <SegmentedControl
              value={genMode}
              onChange={(m) => { setGenMode(m); setGenPreview([]); }}
              options={[{ value: "repeat", label: "Repeating" }, { value: "single", label: "One date" }]}
            />
            {genMode === "repeat" && (
              <div>
                <Label>How often</Label>
                <SegmentedControl
                  value={genCadence}
                  onChange={(c) => { setGenCadence(c); setGenPreview([]); }}
                  options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly" }]}
                  size="sm"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className={genMode === "repeat" ? "" : "col-span-2"}>
                <Label>{genMode === "repeat" ? "Start date" : "Date"}</Label>
                <Input type="date" value={genStart} onChange={(e) => { setGenStart(e.target.value); setGenPreview([]); }} />
              </div>
              {genMode === "repeat" && (
                <div>
                  <Label>Number of sessions</Label>
                  <Input type="number" inputMode="numeric" min="1" max="52" value={genCount} onChange={(e) => { setGenCount(e.target.value); setGenPreview([]); }} />
                </div>
              )}
              <div><Label>Start time</Label><Input type="time" value={genTime} onChange={(e) => setGenTime(e.target.value)} /></div>
              <div><Label>End time</Label><Input type="time" value={genEndTime} onChange={(e) => setGenEndTime(e.target.value)} /></div>
              <div className="col-span-2"><Label>Venue</Label><VenueSelect value={genVenue} onChange={setGenVenue} /></div>
            </div>

            {genMode === "repeat" && (
              <>
                <Button type="button" variant="outline" className="w-full" onClick={generateDates} disabled={!genStart}>
                  <Repeat className="w-4 h-4" /> Generate individual sessions
                </Button>
                {genPreview.length > 0 && (
                  <div>
                    <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{genPreview.length} session{genPreview.length === 1 ? "" : "s"} · remove any you don't want</p>
                    <ListGroup className="max-h-56 overflow-y-auto">
                      {genPreview.map((d) => (
                        <ListRow
                          key={d}
                          size="sm"
                          title={new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
                          subtitle={[genTime ? formatTime(genTime) : null, genVenue.trim() || null].filter(Boolean).join(" · ") || undefined}
                          trailing={<Button size="icon-sm" variant="ghost" aria-label={`Remove ${d}`} onClick={() => setGenPreview((p) => p.filter((x) => x !== d))}><X className="w-4 h-4" /></Button>}
                        />
                      ))}
                    </ListGroup>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionsOpen(false)}>Cancel</Button>
            <Button onClick={addSessions} disabled={addingSessions || (genMode === "repeat" ? genPreview.length === 0 : !genStart)}>
              {addingSessions && <Loader2 className="w-4 h-4 animate-spin" />}
              {genMode === "repeat" ? `Add ${genPreview.length || ""} session${genPreview.length === 1 ? "" : "s"}` : "Add session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel or move a session / cancel an event. Every parent with a paid
          place is emailed; money never moves from here — refunds stay on the
          per-booking button. */}
      <Dialog open={!!sessionChange} onOpenChange={(o) => !o && setSessionChange(null)}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {sessionChange?.mode === "cancel_event"
                ? `Cancel ${selected?.title}?`
                : sessionChange?.mode === "reschedule_session" ? "Move this session" : "Cancel this session?"}
            </DialogTitle>
          </DialogHeader>
          {sessionChange?.session && (
            <p className="text-sm text-muted-foreground">
              {new Date(sessionChange.session.session_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
              {sessionChange.session.start_time ? `, ${formatTime(sessionChange.session.start_time)}` : ""}
              {sessionChange.session.venue ? ` · ${sessionChange.session.venue}` : ""}
            </p>
          )}
          {sessionChange?.mode === "reschedule_session" && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>New date</Label><Input type="date" value={changeDate} onChange={(e) => setChangeDate(e.target.value)} /></div>
              <div><Label>Start time</Label><Input type="time" value={changeTime} onChange={(e) => setChangeTime(e.target.value)} /></div>
              <div className="col-span-2"><Label>Venue</Label><VenueSelect value={changeVenue} onChange={setChangeVenue} /></div>
            </div>
          )}
          <div>
            <Label>Reason (goes in the email)</Label>
            <Textarea rows={2} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="e.g. courts waterlogged" />
          </div>
          <p className="text-xs text-muted-foreground">
            Every parent with a paid place on {selected?.title} is emailed once.
            {sessionChange?.mode === "cancel_event" && selected?.price_pence && !selected?.is_free
              ? " Nothing is refunded automatically — use the Refund button on each booking."
              : ""}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSessionChange(null)}>Back</Button>
            <Button
              onClick={submitSessionChange}
              disabled={changing || (sessionChange?.mode === "reschedule_session" && !changeDate)}
              variant={sessionChange?.mode === "reschedule_session" ? "default" : "destructive"}
            >
              {changing && <Loader2 className="w-4 h-4 animate-spin" />}
              {sessionChange?.mode === "reschedule_session" ? "Move & email parents"
                : sessionChange?.mode === "cancel_event" ? "Cancel event & email parents" : "Cancel session & email parents"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refunds are irreversible in Stripe, so they are confirmed explicitly. */}
      <AlertDialog open={!!refundTarget} onOpenChange={(o) => !o && setRefundTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refund this booking?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {gbp(refundTarget?.amount_pence ?? null)} goes back to{" "}
                  <strong>{refundTarget?.parent_email}</strong> for{" "}
                  <strong>{refundTarget?.child_name}</strong>. Their entry ticket is
                  cancelled and our 2.5% fee is returned to Suffolk Tennis.
                </p>
                {refundTarget?.membership_id && (
                  <p>
                    This is a monthly programme — the subscription is cancelled too, so no
                    further payments are taken.
                  </p>
                )}
                <p className="text-muted-foreground">
                  Stripe cannot undo a refund. The parent normally sees the money in 5–10 days.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={refunding}>Keep the booking</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); refund(); }} disabled={refunding}>
              {refunding ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Refund {gbp(refundTarget?.amount_pence ?? null)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default BookingsPanel;
