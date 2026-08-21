import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, QrCode, ClipboardList, AlertCircle, Star, MapPin, CalendarDays, Check } from "lucide-react";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";
import logo from "@/assets/suffolk-tennis-logo-v7.png";

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

const PlayerAvatar = ({ player, size = "w-11 h-11" }: { player: Player; size?: string }) => (
  <div className={`${size} rounded-full overflow-hidden bg-lta-cyan/15 border border-white/15 flex items-center justify-center shrink-0`}>
    {player.photo_url
      ? <img src={player.photo_url} alt={player.child_name} className="w-full h-full object-cover" loading="lazy" />
      : <span className="text-lta-cyan font-bold text-sm">{initials(player.child_name)}</span>}
  </div>
);
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
  const { user, loading: authLoading } = useAuth();
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
      const { error } = existing
        ? await db.from("session_reports").update(payload).eq("id", existing.id)
        : await db.from("session_reports").insert({
            ...payload,
            booking_id: openPlayer.booking_id,
            event_id: selected.event.id,
            session_id: sid,
            child_id: openPlayer.child_id,
            child_name: openPlayer.child_name,
            coach_id: user.id,
          });
      if (error) throw error;
      setOpenPlayer(null);
      loadRoster(true);
    } catch (e: any) {
      setSaveError(e?.message ?? "Could not save the report — please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || roleLoading || (canScan && loading)) {
    return <div className="min-h-screen bg-suffolk-navy flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-lta-cyan" /></div>;
  }
  if (!canScan) {
    return (
      <div className="min-h-screen bg-suffolk-navy text-primary-foreground flex flex-col items-center justify-center gap-4">
        <p>Staff access required.</p>
        <Button asChild variant="outline"><Link to="/">Back to site</Link></Button>
      </div>
    );
  }

  const presentCount = players.filter((p) => p.arrived).length;

  return (
    <div className="min-h-screen bg-suffolk-navy text-primary-foreground">
      <div className="container mx-auto px-4 py-4 max-w-md pb-16">
        <div className="flex items-center justify-between mb-1">
          <Button asChild variant="ghost" size="sm" className="text-primary-foreground/70">
            <Link to="/"><ArrowLeft className="w-4 h-4 mr-1" /> Home</Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="text-lta-cyan">
            <Link to="/admin/scan"><QrCode className="w-4 h-4 mr-1" /> Scanner</Link>
          </Button>
        </div>
        <div className="text-center mb-5">
          <img src={logo} alt="Suffolk Tennis" className="h-10 mx-auto mb-2" />
          <h1 className="font-display font-black text-xl">Coach Hub</h1>
          <p className="text-primary-foreground/60 text-xs mt-1">Venue, then week — tick players in and tap a name to report.</p>
          <div className="mt-3 flex justify-center">
            <RoleViewSwitcher onDark />
          </div>
        </div>

        {slots.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-primary-foreground/70">
            No sessions with paid players yet.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Select value={venue} onValueChange={setVenue}>
                <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground">
                  <span className="flex items-center gap-1.5 truncate"><MapPin size={13} className="text-lta-cyan shrink-0" /><SelectValue placeholder="Venue" /></span>
                </SelectTrigger>
                <SelectContent>
                  {venues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={week} onValueChange={setWeek}>
                <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground">
                  <span className="flex items-center gap-1.5 truncate"><CalendarDays size={13} className="text-lta-cyan shrink-0" /><SelectValue placeholder="Week" /></span>
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

            {/* Active sessions at this venue in this week */}
            <div className="space-y-2 mb-4">
              {activeSlots.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-xl p-5 text-center text-sm text-primary-foreground/60">
                  No sessions at {venue} this week.
                </div>
              ) : activeSlots.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSlotKey(s.key)}
                  className={`w-full rounded-xl px-4 py-3 text-left border transition-colors ${
                    slotKey === s.key
                      ? "border-lta-cyan bg-lta-cyan/10"
                      : "border-white/10 bg-white/5 hover:border-lta-cyan/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{s.event.title}</div>
                      <div className="text-xs text-primary-foreground/60 mt-0.5">
                        {s.date ? fmtDay(s.date) : "Date TBC"}
                        {s.session?.start_time ? ` · ${s.session.start_time.slice(0, 5)}${s.session.end_time ? `–${s.session.end_time.slice(0, 5)}` : ""}` : ""}
                      </div>
                    </div>
                    {s.date === today && <Badge className="bg-lta-yellow/20 text-lta-yellow border-lta-yellow/40 shrink-0" variant="outline">Today</Badge>}
                  </div>
                </button>
              ))}
            </div>

            {/* Live register */}
            {selected && (
              rosterLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-lta-cyan" /></div>
              ) : players.length === 0 ? (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-primary-foreground/70">
                  No paid players on this event yet.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-display font-bold text-sm uppercase tracking-wide">Register</h2>
                    <span className="text-xs text-primary-foreground/60">{presentCount}/{players.length} present · updates live</span>
                  </div>
                  <div className="space-y-2">
                    {players.map((p) => (
                      <div
                        key={p.booking_id}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 flex items-center gap-3"
                      >
                        <button
                          onClick={() => togglePresent(p)}
                          disabled={marking.has(p.booking_id)}
                          aria-label={p.arrived ? `Mark ${p.child_name} absent` : `Mark ${p.child_name} present`}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                            p.arrived
                              ? "bg-green-500 border-green-500 text-suffolk-navy"
                              : "border-white/30 text-transparent hover:border-lta-cyan"
                          }`}
                        >
                          <Check size={18} strokeWidth={3} />
                        </button>
                        <button onClick={() => openReport(p)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                          <PlayerAvatar player={p} />
                          <div className="min-w-0">
                          <div className="font-semibold truncate">{p.child_name}</div>
                          <div className="text-xs text-primary-foreground/60 flex flex-wrap gap-2">
                            {p.session_slot && <span>{p.session_slot}</span>}
                            {p.medical_notes && <span className="text-lta-yellow inline-flex items-center gap-1"><AlertCircle size={11} /> Medical</span>}
                          </div>
                          </div>
                        </button>
                        <button onClick={() => openReport(p)} className="shrink-0" aria-label={`Report for ${p.child_name}`}>
                          {p.my_report
                            ? <Badge className="bg-lta-cyan/15 text-lta-cyan border-lta-cyan/40" variant="outline"><ClipboardList className="w-3 h-3 mr-1" /> Reported</Badge>
                            : <ClipboardList className="w-4 h-4 text-primary-foreground/40" />}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      <Dialog open={!!openPlayer} onOpenChange={(o) => { if (!o) setOpenPlayer(null); }}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-3">
              {openPlayer && <PlayerAvatar player={openPlayer} size="w-12 h-12" />}
              {openPlayer?.child_name}
            </DialogTitle>
          </DialogHeader>
          {openPlayer?.medical_notes && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900 text-sm p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {openPlayer.medical_notes}
            </div>
          )}
          <Tabs defaultValue="session">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="session">Session feedback</TabsTrigger>
              <TabsTrigger value="progress" disabled={!openPlayer?.child_id}>Progress report</TabsTrigger>
            </TabsList>

            <TabsContent value="session" className="space-y-4 pt-2">
              {RATINGS.map((r) => (
                <div key={r.key}>
                  <div className="text-sm font-semibold mb-1.5">{r.label}</div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStats((s) => ({ ...s, [r.key]: s[r.key] === n ? 0 : n }))}
                        className="p-1"
                        aria-label={`${r.label}: ${n} of 5`}
                      >
                        <Star
                          className={`w-7 h-7 ${(stats[r.key] ?? 0) >= n ? "text-lta-cyan fill-lta-cyan" : "text-muted-foreground/40"}`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="text-sm font-semibold mb-1.5">Coach comment</div>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  placeholder="What went well, what to work on…"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Parents can see this feedback on the booking in their Parent Hub.</p>
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              <Button onClick={saveReport} disabled={saving} className="w-full bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save session feedback"}
              </Button>
            </TabsContent>

            <TabsContent value="progress" className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                The full LTA talent-characteristics assessment — this is the progress
                report parents see under My Children.
              </p>
              {TALENT_CHARACTERISTICS.map((tc) => (
                <div key={tc.name}>
                  <div className="text-sm font-semibold leading-tight">{tc.name}</div>
                  <div className="text-[11px] text-muted-foreground mb-1.5">{tc.descriptor}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {TC_LEVELS.map((level) => (
                      <button
                        key={level.value}
                        type="button"
                        onClick={() => setTcRatings((r) => ({
                          ...r,
                          [tc.name]: r[tc.name] === level.value ? 0 : level.value,
                        }))}
                        className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                          tcRatings[tc.name] === level.value
                            ? level.classes + " ring-1 ring-current"
                            : "border-border text-muted-foreground hover:border-foreground/40"
                        }`}
                      >
                        {level.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div>
                <div className="text-sm font-semibold mb-1.5">Coach's assessment</div>
                <Textarea
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  rows={5}
                  placeholder="Overall development, standout qualities, next steps…"
                />
              </div>
              {progressError && <p className="text-sm text-red-600">{progressError}</p>}
              {progressSaved && <p className="text-sm text-green-600">Progress report saved — visible to the parent now.</p>}
              <Button onClick={saveProgressReport} disabled={progressSaving} className="w-full bg-lta-cyan text-suffolk-navy hover:bg-lta-cyan/90 font-bold">
                {progressSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : progressReportId ? "Update progress report" : "Save progress report"}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachHub;
