import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, QrCode, ClipboardList, AlertCircle, Star, MapPin, CalendarDays, Check, Shield, Users } from "lucide-react";
import { formatTimeRange } from "@/lib/timeFormat";
import { AppShell, type NavItem, PageHeader, Section, ListGroup, ListRow, StatusBadge, EmptyState, SkeletonRows, InlineNote } from "@/components/app";

const db = supabase as any;

type SessionRow = { id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null };
type EventRow = { id: string; title: string; event_date: string | null; location: string | null; programme_type: string; sessions: SessionRow[] };
type Player = {
  booking_id: string; child_id: string | null; photo_url: string | null;
  child_name: string; parent_name: string | null;
  session_slot: string | null; medical_notes: string | null; arrived: boolean;
  my_report: { stats: Record<string, number>; comment: string | null } | null;
};

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");

const PlayerAvatar = ({ player, size = "w-10 h-10" }: { player: Player; size?: string }) => (
  <div className={`${size} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10`}>
    {player.photo_url
      ? <img src={player.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
      : <span className="text-[13px] font-semibold text-primary">{initials(player.child_name)}</span>}
  </div>
);
/** A past session report on this child — any event, any coach. */
type HistoryRow = {
  id: string; event_title: string; when: string | null; coach_name: string | null;
  stats: Record<string, number>; comment: string | null; created_at: string;
};

/** One selectable slot on the coach's schedule: an event session, or a
 *  session-less one-off event as a whole. */
type Slot = { key: string; venue: string; date: string | null; event: EventRow; session: SessionRow | null };

const RATINGS: Array<{ key: string; label: string }> = [
  { key: "technique", label: "Technique" },
  { key: "attitude", label: "Attitude & effort" },
  { key: "movement", label: "Movement" },
  { key: "matchplay", label: "Match play" },
];

// The LTA talent-characteristics framework — identical names/descriptors to
// the PDF-imported reports so coach-authored ones render the same for parents.
const TALENT_CHARACTERISTICS: Array<{ name: string; descriptor: string }> = [
  { name: "Confident to Attack", descriptor: "Proactive, composed, loose" },
  { name: "Comfortable in Rally", descriptor: "Consistency, repeatable, contact point, tempo" },
  { name: "Chases Every Ball", descriptor: "Defending qualities, determined, adaptable" },
  { name: "Creative in Play", descriptor: "Skillfulness, chopper grip, feel, variety, adaptable" },
  { name: "Athletic Qualities", descriptor: "Agility, balance, coordination, speed" },
  { name: "Reads the Ball", descriptor: "Anticipation, perception, tennis specific movement" },
  { name: "Loves the Game", descriptor: "Inner drive, maximises training opportunity" },
  { name: "Loves to Compete", descriptor: "Competitive, commitment, relish challenge" },
  { name: "Serving", descriptor: "Grip, balance, rhythm, timing, throwing action" },
];

// 1-4 scale used across the report views (1 is best).
const TC_LEVELS = [
  { value: 1, label: "Excelling", classes: "bg-green-100 text-green-800 border-green-300" },
  { value: 2, label: "Consistent", classes: "bg-sky-100 text-sky-800 border-sky-300" },
  { value: 3, label: "Progressing", classes: "bg-amber-100 text-amber-800 border-amber-300" },
  { value: 4, label: "Next Step Focus", classes: "bg-red-100 text-red-800 border-red-300" },
];

const TBC_WEEK = "9999-12-31";

/** Monday of the week containing the date (ISO yyyy-mm-dd in, same out). */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

const fmtDay = (dateStr: string) =>
  new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

const CoachHub = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const { canScan, loading: roleLoading } = useIsAdmin();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [venue, setVenue] = useState<string>("");
  const [week, setWeek] = useState<string>("");
  const [slotKey, setSlotKey] = useState<string>("");

  const [players, setPlayers] = useState<Player[]>([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [marking, setMarking] = useState<Set<string>>(new Set());

  const [openPlayer, setOpenPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // Every previous session report on the open player, newest first.
  const [history, setHistory] = useState<HistoryRow[] | null>(null);

  // Formal progress report (player_reports — what parents see under My Children).
  const [tcRatings, setTcRatings] = useState<Record<string, number>>({});
  const [assessment, setAssessment] = useState("");
  const [progressReportId, setProgressReportId] = useState<string | null>(null);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [progressSaved, setProgressSaved] = useState(false);

  // Every bookable slot, flattened: one per session, or one per session-less event.
  const slots = useMemo<Slot[]>(() =>
    events.flatMap((e) =>
      e.sessions.length > 0
        ? e.sessions.map((s) => ({
            key: `${e.id}:${s.id}`,
            venue: s.venue || e.location || "Venue TBC",
            date: s.session_date,
            event: e,
            session: s,
          }))
        : [{
            key: `${e.id}:`,
            venue: e.location || "Venue TBC",
            date: e.event_date ? e.event_date.slice(0, 10) : null,
            event: e,
            session: null,
          }]
    ), [events]);

  const venues = useMemo(() => [...new Set(slots.map((s) => s.venue))].sort(), [slots]);

  const weeks = useMemo(() => {
    const set = new Set(
      slots.filter((s) => s.venue === venue).map((s) => (s.date ? weekStart(s.date) : TBC_WEEK)),
    );
    return [...set].sort();
  }, [slots, venue]);

  const activeSlots = useMemo(() =>
    slots
      .filter((s) => s.venue === venue && (s.date ? weekStart(s.date) : TBC_WEEK) === week)
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.session?.start_time ?? "").localeCompare(b.session?.start_time ?? "")),
    [slots, venue, week]);

  const selected = useMemo(() => activeSlots.find((s) => s.key === slotKey) ?? null, [activeSlots, slotKey]);
  const thisWeek = weekStart(new Date().toISOString().slice(0, 10));
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!canScan) return;
    supabase.functions.invoke("coach-session", { body: { action: "events" } })
      .then(({ data }) => setEvents(data?.events ?? []))
      .finally(() => setLoading(false));
  }, [canScan]);

  // Default venue/week to wherever the nearest upcoming session is.
  useEffect(() => {
    if (slots.length === 0 || venue) return;
    const upcoming = [...slots].filter((s) => s.date && s.date >= today).sort((a, b) => a.date!.localeCompare(b.date!));
    const pick = upcoming[0] ?? slots[0];
    setVenue(pick.venue);
    setWeek(pick.date ? weekStart(pick.date) : TBC_WEEK);
  }, [slots, venue, today]);

  useEffect(() => {
    if (!venue || weeks.length === 0) return;
    if (!weeks.includes(week)) setWeek(weeks.includes(thisWeek) ? thisWeek : weeks[0]);
  }, [venue, weeks, week, thisWeek]);

  useEffect(() => { setSlotKey(""); setPlayers([]); }, [venue, week]);

  // Open the obvious session straight away: today's, or the only one.
  useEffect(() => {
    if (slotKey || activeSlots.length === 0) return;
    const pick = activeSlots.find((s) => s.date === today) ?? (activeSlots.length === 1 ? activeSlots[0] : null);
    if (pick) setSlotKey(pick.key);
  }, [activeSlots, slotKey, today]);

  const loadRoster = (silent = false) => {
    if (!selected) return;
    if (!silent) setRosterLoading(true);
    supabase.functions.invoke("coach-session", {
      body: { action: "roster", event_id: selected.event.id, session_id: selected.session?.id },
    })
      .then(({ data }) => setPlayers(data?.players ?? []))
      .finally(() => { if (!silent) setRosterLoading(false); });
  };
  useEffect(() => { loadRoster(); }, [slotKey]);

  // Live register: refresh quietly so QR scans at the gate appear as they happen.
  const pollRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selected) return;
    pollRef.current = window.setInterval(() => loadRoster(true), 15000);
    return () => { if (pollRef.current) window.clearInterval(pollRef.current); };
  }, [slotKey]);

  const togglePresent = async (p: Player) => {
    if (marking.has(p.booking_id) || !selected) return;
    setMarking((m) => new Set(m).add(p.booking_id));
    const next = !p.arrived;
    setPlayers((ps) => ps.map((x) => x.booking_id === p.booking_id ? { ...x, arrived: next } : x));
    const { data, error } = await supabase.functions.invoke("coach-session", {
      body: { action: "mark", booking_id: p.booking_id, session_id: selected.session?.id, present: next },
    });
    if (error || data?.error) {
      // revert on failure
      setPlayers((ps) => ps.map((x) => x.booking_id === p.booking_id ? { ...x, arrived: !next } : x));
    }
    setMarking((m) => { const n = new Set(m); n.delete(p.booking_id); return n; });
  };

  const openReport = (p: Player) => {
    setOpenPlayer(p);
    setStats(p.my_report?.stats ?? {});
    setComment(p.my_report?.comment ?? "");
    setSaveError(null);
    setProgressError(null);
    setProgressSaved(false);
    setTcRatings({});
    setAssessment("");
    setProgressReportId(null);
    setHistory(null);
    loadHistory(p);
    // Load this coach's existing progress report for the child on this event.
    if (p.child_id && user && selected) {
      db.from("player_reports")
        .select("id, talent_characteristics, coach_comments")
        .eq("child_id", p.child_id)
        .eq("event_id", selected.event.id)
        .eq("coach_id", user.id)
        .maybeSingle()
        .then(({ data }: { data: any }) => {
          if (!data) return;
          setProgressReportId(data.id);
          setAssessment(data.coach_comments ?? "");
          const ratings: Record<string, number> = {};
          for (const tc of data.talent_characteristics ?? []) {
            if (tc?.name && tc?.rating) ratings[tc.name] = tc.rating;
          }
          setTcRatings(ratings);
        });
    }
  };

  /**
   * Report history across every event and coach, so a coach picking up a
   * player for the first time can see what colleagues have already said.
   * Matched on the child's account where there is one; by booking otherwise.
   */
  const loadHistory = async (p: Player) => {
    let q = db.from("session_reports")
      .select("id, event_id, session_id, coach_name, stats, comment, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    q = p.child_id ? q.eq("child_id", p.child_id) : q.eq("booking_id", p.booking_id);
    const { data: rows } = await q;
    const reports: any[] = rows ?? [];
    const eventIds = [...new Set(reports.map((r) => r.event_id).filter(Boolean))];
    const sessionIds = [...new Set(reports.map((r) => r.session_id).filter(Boolean))];
    const [{ data: evs }, { data: sess }] = await Promise.all([
      eventIds.length ? db.from("events").select("id, title").in("id", eventIds) : Promise.resolve({ data: [] }),
      sessionIds.length ? db.from("event_sessions").select("id, session_date").in("id", sessionIds) : Promise.resolve({ data: [] }),
    ]);
    const titleOf = new Map<string, string>((evs ?? []).map((e: any) => [e.id, e.title]));
    const dateOf = new Map<string, string>((sess ?? []).map((x: any) => [x.id, x.session_date]));
    setHistory(reports.map((r) => ({
      id: r.id,
      event_title: titleOf.get(r.event_id) ?? "Session",
      when: r.session_id ? dateOf.get(r.session_id) ?? null : null,
      coach_name: r.coach_name,
      stats: r.stats ?? {},
      comment: r.comment,
      created_at: r.created_at,
    })));
  };

  const saveProgressReport = async () => {
    if (!openPlayer?.child_id || !user || !selected) return;
    setProgressSaving(true);
    setProgressError(null);
    setProgressSaved(false);
    const coachName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null;
    const talent = TALENT_CHARACTERISTICS
      .filter((tc) => (tcRatings[tc.name] ?? 0) > 0)
      .map((tc) => ({ name: tc.name, rating: tcRatings[tc.name], descriptor: tc.descriptor }));
    const payload = {
      talent_characteristics: talent,
      coach_comments: assessment.trim() || null,
      individual_coach: coachName,
      report_date: new Date().toISOString().slice(0, 10),
    };
    try {
      const { error } = progressReportId
        ? await db.from("player_reports").update(payload).eq("id", progressReportId)
        : await db.from("player_reports").insert({
            ...payload,
            child_id: openPlayer.child_id,
            event_id: selected.event.id,
            coach_id: user.id,
            report_title: `${selected.event.title} — Progress Report`,
            programme: selected.venue,
            county: "Suffolk",
          }).select("id").single().then((r: any) => {
            if (r.data?.id) setProgressReportId(r.data.id);
            return r;
          });
      if (error) throw error;
      setProgressSaved(true);
    } catch (e: any) {
      setProgressError(e?.message ?? "Could not save the progress report.");
    } finally {
      setProgressSaving(false);
    }
  };

  const saveReport = async () => {
    if (!openPlayer || !user || !selected) return;
    setSaving(true);
    setSaveError(null);
    const sid = selected.session?.id ?? null;
    const coachName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null;
    const payload = { stats, comment: comment.trim() || null, coach_name: coachName };
    try {
      let q = db.from("session_reports").select("id").eq("booking_id", openPlayer.booking_id).eq("coach_id", user.id);
      q = sid ? q.eq("session_id", sid) : q.is("session_id", null);
      const { data: existing } = await q.maybeSingle();
      let error: any = null;
      if (existing) {
        ({ error } = await db.from("session_reports").update(payload).eq("id", existing.id));
      } else {
        const { data: inserted, error: insErr } = await db.from("session_reports").insert({
          ...payload,
          booking_id: openPlayer.booking_id,
          event_id: selected.event.id,
          session_id: sid,
          child_id: openPlayer.child_id,
          child_name: openPlayer.child_name,
          coach_id: user.id,
        }).select("id").single();
        error = insErr;
        // First write only: let the parent know the report is ready. Edits
        // stay quiet. Best-effort — the report is saved either way.
        if (!insErr && inserted?.id) {
          supabase.functions.invoke("coach-session", { body: { action: "notify_report", report_id: inserted.id } })
            .catch(() => { /* the report itself is what matters */ });
        }
      }
      if (error) throw error;
      setOpenPlayer(null);
      loadRoster(true);
    } catch (e: any) {
      setSaveError(e?.message ?? "Could not save the report — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const nav: NavItem[] = [
    { id: "register", label: "Register", icon: ClipboardList },
    { id: "scan", label: "Scanner", icon: QrCode, to: "/admin/scan" },
  ];
  const coachName = (user?.user_metadata?.full_name as string | undefined) ?? null;

  if (authLoading || roleLoading || (canScan && loading)) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="h-14 border-b border-border" />
        <div className="mx-auto max-w-md space-y-3 px-4 py-5"><SkeletonRows rows={4} avatar={false} /></div>
      </div>
    );
  }
  if (!canScan) {
    return (
      <div className="app-shell min-h-screen bg-background">
        <div className="mx-auto max-w-md px-6 py-24">
          <EmptyState icon={Shield} title="Staff access required" description="Only Suffolk Tennis coaches and admins can open the register." action={<Button asChild variant="outline"><Link to="/">Back to site</Link></Button>} />
        </div>
      </div>
    );
  }

  const presentCount = players.filter((p) => p.arrived).length;
  const fmtSlot = (s: Slot) => `${s.date ? fmtDay(s.date) : "Date TBC"}${s.session?.start_time ? ` · ${formatTimeRange(s.session.start_time, s.session.end_time)}` : ""}`;

  return (
    <AppShell
      role="coach"
      title="Register"
      nav={nav}
      primary={["register", "scan"]}
      active="register"
      onNavigate={() => { /* single tab */ }}
      userName={coachName}
      userEmail={user?.email}
      onSignOut={async () => { await signOut(); window.location.assign("/"); }}
      maxWidth="max-w-2xl"
    >
      <PageHeader title="Register" hideTitleOnPhone description="Pick the venue and week, tick players in as they arrive, tap a name to write a report." className="mb-4" />

      {slots.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No sessions yet" description="Sessions appear here once players have paid places on them." />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2">
            <Select value={venue} onValueChange={setVenue}>
              <SelectTrigger aria-label="Venue">
                <span className="flex items-center gap-2 truncate"><MapPin size={15} className="shrink-0 text-primary" /><SelectValue placeholder="Venue" /></span>
              </SelectTrigger>
              <SelectContent>
                {venues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={week} onValueChange={setWeek}>
              <SelectTrigger aria-label="Week">
                <span className="flex items-center gap-2 truncate"><CalendarDays size={15} className="shrink-0 text-primary" /><SelectValue placeholder="Week" /></span>
              </SelectTrigger>
              <SelectContent>
                {weeks.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w === TBC_WEEK ? "Date TBC" : w === thisWeek ? "This week" : `w/c ${fmtDay(w)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sessions at this venue this week */}
          <Section title="Sessions" count={activeSlots.length}>
            {activeSlots.length === 0 ? (
              <EmptyState icon={CalendarDays} title={`No sessions at ${venue} this week`} compact />
            ) : (
              <ListGroup>
                {activeSlots.map((s) => (
                  <ListRow
                    key={s.key}
                    onClick={() => setSlotKey(s.key)}
                    selected={slotKey === s.key}
                    leading={
                      <div className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl ${slotKey === s.key ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                        {s.date ? (
                          <>
                            <span className="text-[10px] font-semibold uppercase leading-none">{new Date(s.date + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}</span>
                            <span className="mt-0.5 text-base font-semibold leading-none tabular">{new Date(s.date + "T12:00:00").getDate()}</span>
                          </>
                        ) : <span className="text-[10px] font-semibold">TBC</span>}
                      </div>
                    }
                    title={s.event.title}
                    subtitle={fmtSlot(s)}
                    trailing={s.date === today ? <StatusBadge tone="brand" dot={false}>Today</StatusBadge> : undefined}
                    chevron={slotKey !== s.key}
                  />
                ))}
              </ListGroup>
            )}
          </Section>

          {/* Live register */}
          {selected && (
            rosterLoading ? (
              <SkeletonRows rows={5} />
            ) : players.length === 0 ? (
              <EmptyState icon={Users} title="No paid players on this session yet" compact />
            ) : (
              <Section
                title={<span className="line-clamp-2">{selected.event.title}</span>}
                description={`${fmtSlot(selected)} · updates live`}
                action={
                  <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium tabular">
                    <span className={presentCount === players.length ? "text-emerald-700" : "text-foreground"}>{presentCount}</span>
                    <span className="text-muted-foreground">/{players.length} here</span>
                  </span>
                }
              >
                <ListGroup>
                  {players.map((p) => (
                    <div key={p.booking_id} className="flex items-center gap-3 bg-card px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => togglePresent(p)}
                        disabled={marking.has(p.booking_id)}
                        aria-pressed={p.arrived}
                        aria-label={p.arrived ? `Mark ${p.child_name} absent` : `Mark ${p.child_name} present`}
                        className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          p.arrived
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border bg-card text-transparent hover:border-primary"
                        }`}
                      >
                        <Check size={20} strokeWidth={3} />
                      </button>
                      <button type="button" onClick={() => openReport(p)} className="press flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left">
                        <PlayerAvatar player={p} />
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[15px] font-medium leading-snug text-foreground">{p.child_name}</div>
                          <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                            {p.session_slot && <span>{p.session_slot}</span>}
                            {p.medical_notes && <span className="inline-flex items-center gap-1 text-amber-700"><AlertCircle size={12} /> Medical</span>}
                            {!p.session_slot && !p.medical_notes && <span>{p.arrived ? "Checked in" : "Not yet here"}</span>}
                          </div>
                        </div>
                      </button>
                      <button type="button" onClick={() => openReport(p)} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${p.my_report ? "bg-primary/10 text-primary" : "text-muted-foreground/50"}`} aria-label={p.my_report ? `Edit report for ${p.child_name}` : `Write report for ${p.child_name}`} title={p.my_report ? "Reported" : "Write a report"}>
                        <ClipboardList className="h-5 w-5" strokeWidth={p.my_report ? 2.2 : 1.8} />
                      </button>
                    </div>
                  ))}
                </ListGroup>
              </Section>
            )
          )}
        </div>
      )}

      <Dialog open={!!openPlayer} onOpenChange={(o) => { if (!o) setOpenPlayer(null); }}>
        <DialogContent className="md:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 font-display">
              {openPlayer && <PlayerAvatar player={openPlayer} size="w-12 h-12" />}
              <span className="min-w-0">
                <span className="block truncate">{openPlayer?.child_name}</span>
                {openPlayer?.parent_name && <span className="block text-xs font-normal text-muted-foreground">Parent: {openPlayer.parent_name}</span>}
              </span>
            </DialogTitle>
          </DialogHeader>
          {openPlayer?.medical_notes && (
            <InlineNote tone="warning" icon={AlertCircle}>{openPlayer.medical_notes}</InlineNote>
          )}
          <Tabs defaultValue="session">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="session">Session</TabsTrigger>
              <TabsTrigger value="history">
                Previous{history && history.length > 0 ? ` (${history.length})` : ""}
              </TabsTrigger>
              <TabsTrigger value="progress" disabled={!openPlayer?.child_id}>Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="history" className="space-y-3 pt-3">
              {history === null ? (
                <SkeletonRows rows={2} avatar={false} />
              ) : history.length === 0 ? (
                <EmptyState icon={ClipboardList} title="No previous reports" description={`Nothing written for ${openPlayer?.child_name} yet.`} compact />
              ) : (
                history.map((h) => (
                  <div key={h.id} className="space-y-1.5 rounded-xl border border-border bg-card p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="text-sm font-semibold leading-tight">{h.event_title}</div>
                      <div className="whitespace-nowrap text-[11px] text-muted-foreground">
                        {new Date(h.when ?? h.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })}
                      </div>
                    </div>
                    {h.coach_name && <div className="text-[11px] text-muted-foreground">{h.coach_name}</div>}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {RATINGS.filter((r) => (h.stats[r.key] ?? 0) > 0).map((r) => (
                        <span key={r.key} className="text-[11px] text-muted-foreground">
                          {r.label} <span className="text-primary">{"★".repeat(h.stats[r.key])}</span>
                        </span>
                      ))}
                    </div>
                    {h.comment && <p className="whitespace-pre-line text-sm">{h.comment}</p>}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="session" className="space-y-5 pt-3">
              {RATINGS.map((r) => (
                <div key={r.key}>
                  <div className="mb-1.5 text-sm font-semibold">{r.label}</div>
                  <div className="flex gap-1" role="radiogroup" aria-label={r.label}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={(stats[r.key] ?? 0) === n}
                        onClick={() => setStats((st) => ({ ...st, [r.key]: st[r.key] === n ? 0 : n }))}
                        className="press flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-label={`${r.label}: ${n} of 5`}
                      >
                        <Star className={`h-7 w-7 transition-colors ${(stats[r.key] ?? 0) >= n ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-1.5 text-sm font-semibold">Coach comment</div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What went well, what to work on…"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Parents can see this feedback on the booking in their Parent Hub.</p>
              </div>
              {saveError && <p className="text-sm text-destructive" role="alert">{saveError}</p>}
              <Button onClick={saveReport} disabled={saving} size="lg" className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save session feedback"}
              </Button>
            </TabsContent>

            <TabsContent value="progress" className="space-y-5 pt-3">
              <p className="text-xs text-muted-foreground">
                The full LTA talent-characteristics assessment — this is the progress
                report parents see under My Children.
              </p>
              {TALENT_CHARACTERISTICS.map((tc) => (
                <div key={tc.name}>
                  <div className="text-sm font-semibold leading-tight">{tc.name}</div>
                  <div className="mb-1.5 text-[11px] text-muted-foreground">{tc.descriptor}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TC_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        aria-pressed={tcRatings[tc.name] === level.value}
                        onClick={() => setTcRatings((r) => ({
                          ...r,
                          [tc.name]: r[tc.name] === level.value ? 0 : level.value,
                        }))}
                        className={`press min-h-9 rounded-full border px-3 text-[12px] font-semibold transition-colors duration-150 ${
                          tcRatings[tc.name] === level.value
                            ? level.classes + " ring-1 ring-current"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/40"
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="mb-1.5 text-sm font-semibold">Coach's assessment</div>
                <Textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={5}
                  placeholder="Overall development, standout qualities, next steps…"
                />
              </div>
              {progressError && <p className="text-sm text-destructive" role="alert">{progressError}</p>}
              {progressSaved && <p className="text-sm text-emerald-700">Progress report saved — visible to the parent now.</p>}
              <Button onClick={saveProgressReport} disabled={progressSaving} size="lg" className="w-full">
                {progressSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : progressReportId ? "Update progress report" : "Save progress report"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default CoachHub;
