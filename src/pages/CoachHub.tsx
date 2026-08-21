import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, QrCode, ClipboardList, AlertCircle, CheckCircle2, Star } from "lucide-react";
import RoleViewSwitcher from "@/components/RoleViewSwitcher";
import logo from "@/assets/suffolk-tennis-logo-v7.png";

const db = supabase as any;

type SessionRow = { id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null };
type EventRow = { id: string; title: string; event_date: string | null; location: string | null; programme_type: string; sessions: SessionRow[] };
type Player = {
  booking_id: string; child_id: string | null; child_name: string; parent_name: string | null;
  session_slot: string | null; medical_notes: string | null; arrived: boolean;
  my_report: { stats: Record<string, number>; comment: string | null } | null;
};

const RATINGS: Array<{ key: string; label: string }> = [
  { key: "technique", label: "Technique" },
  { key: "attitude", label: "Attitude & effort" },
  { key: "movement", label: "Movement" },
  { key: "matchplay", label: "Match play" },
];

const sessionLabel = (s: SessionRow) =>
  new Date(s.session_date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) +
  (s.start_time ? ` · ${s.start_time.slice(0, 5)}` : "") + (s.venue ? ` · ${s.venue}` : "");

const CoachHub = () => {
  const { user, loading: authLoading } = useAuth();
  const { canScan, loading: roleLoading } = useIsAdmin();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [sessionId, setSessionId] = useState<string>("none");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);

  const [openPlayer, setOpenPlayer] = useState<Player | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const selectedEvent = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId]);

  useEffect(() => {
    if (!canScan) return;
    supabase.functions.invoke("coach-session", { body: { action: "events" } })
      .then(({ data }) => {
        const evs: EventRow[] = data?.events ?? [];
        setEvents(evs);
        if (evs.length > 0) setEventId(evs[0].id);
      })
      .finally(() => setLoading(false));
  }, [canScan]);

  const loadRoster = () => {
    if (!eventId) return;
    setRosterLoading(true);
    supabase.functions.invoke("coach-session", {
      body: { action: "roster", event_id: eventId, session_id: sessionId === "none" ? undefined : sessionId },
    })
      .then(({ data }) => setPlayers(data?.players ?? []))
      .finally(() => setRosterLoading(false));
  };
  useEffect(loadRoster, [eventId, sessionId]);

  const openReport = (p: Player) => {
    setOpenPlayer(p);
    setStats(p.my_report?.stats ?? {});
    setComment(p.my_report?.comment ?? "");
    setSaveError(null);
  };

  const saveReport = async () => {
    if (!openPlayer || !user || !selectedEvent) return;
    setSaving(true);
    setSaveError(null);
    const sid = sessionId === "none" ? null : sessionId;
    const coachName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null;
    const payload = {
      stats, comment: comment.trim() || null, coach_name: coachName,
    };
    try {
      let q = db.from("session_reports").select("id").eq("booking_id", openPlayer.booking_id).eq("coach_id", user.id);
      q = sid ? q.eq("session_id", sid) : q.is("session_id", null);
      const { data: existing } = await q.maybeSingle();
      const { error } = existing
        ? await db.from("session_reports").update(payload).eq("id", existing.id)
        : await db.from("session_reports").insert({
            ...payload,
            booking_id: openPlayer.booking_id,
            event_id: selectedEvent.id,
            session_id: sid,
            child_id: openPlayer.child_id,
            child_name: openPlayer.child_name,
            coach_id: user.id,
          });
      if (error) throw error;
      setOpenPlayer(null);
      loadRoster();
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
          <h1 className="font-display font-black text-xl">Session Reports</h1>
          <p className="text-primary-foreground/60 text-xs mt-1">Pick your session, then tap a player to rate and comment.</p>
          <div className="mt-3 flex justify-center">
            <RoleViewSwitcher />
          </div>
        </div>

        {events.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-primary-foreground/70">
            No events with paid players yet.
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              <Select value={eventId} onValueChange={(v) => { setEventId(v); setSessionId("none"); }}>
                <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground"><SelectValue placeholder="Choose event" /></SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedEvent && selectedEvent.sessions.length > 0 && (
                <Select value={sessionId} onValueChange={setSessionId}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-primary-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Whole event (no specific session)</SelectItem>
                    {selectedEvent.sessions.map((s) => <SelectItem key={s.id} value={s.id}>{sessionLabel(s)}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {rosterLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-lta-cyan" /></div>
            ) : players.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center text-sm text-primary-foreground/70">
                No paid players on this event yet.
              </div>
            ) : (
              <div className="space-y-2">
                {players.map((p) => (
                  <button
                    key={p.booking_id}
                    onClick={() => openReport(p)}
                    className="w-full bg-white/5 border border-white/10 hover:border-lta-cyan/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{p.child_name}</div>
                      <div className="text-xs text-primary-foreground/60 flex flex-wrap gap-2 mt-0.5">
                        {p.session_slot && <span>{p.session_slot}</span>}
                        {p.arrived && <span className="text-green-400 inline-flex items-center gap-1"><CheckCircle2 size={11} /> Arrived</span>}
                        {p.medical_notes && <span className="text-lta-yellow inline-flex items-center gap-1"><AlertCircle size={11} /> Medical note</span>}
                      </div>
                    </div>
                    {p.my_report
                      ? <Badge className="bg-lta-cyan/15 text-lta-cyan border-lta-cyan/40 shrink-0" variant="outline"><ClipboardList className="w-3 h-3 mr-1" /> Reported</Badge>
                      : <ClipboardList className="w-4 h-4 text-primary-foreground/40 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={!!openPlayer} onOpenChange={(o) => { if (!o) setOpenPlayer(null); }}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{openPlayer?.child_name}</DialogTitle>
          </DialogHeader>
          {openPlayer?.medical_notes && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900 text-sm p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {openPlayer.medical_notes}
            </div>
          )}
          <div className="space-y-4">
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
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save report"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CoachHub;
