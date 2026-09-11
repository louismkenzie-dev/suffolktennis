// The live register for one session (or a session-less event). Polls every
// 5s while the tab is visible so scans at the gate appear as they happen.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QrCode, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatTimeRange } from "@/lib/timeFormat";
import { EmptyState, InlineNote, ListGroup, PageHeader, SkeletonRows, StatusBadge } from "@/components/app";
import { CoachShell } from "./CoachShell";
import { coachSession, type Attendance, type EndSessionResponse, type Player, type RegisterResponse } from "./api";
import { PlayerRow, type AttendanceAction } from "./PlayerRow";
import { ProfileSheet } from "./ProfileSheet";
import { ReportSheet } from "./ReportSheet";
import { ScanSheet } from "./ScanSheet";
import { EndSessionDialog } from "./EndSessionDialog";
import { clock, relativeDay } from "./time";

const POLL_MS = 5000;

export function RegisterPage({ sessionId, eventId: eventIdProp }: {
  /** Session route. The event id is looked up (or comes via router state). */
  sessionId?: string;
  /** Session-less event route, or a hint from the sessions list. */
  eventId?: string;
}) {
  const [eventId, setEventId] = useState<string | null>(eventIdProp ?? null);
  const [data, setData] = useState<RegisterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  // Fallback for session-less events, whose register payload has no ended stamp.
  const [localEndedAt, setLocalEndedAt] = useState<string | null>(null);
  const inflight = useRef(0);
  // Polls can resolve out of order on a slow connection; only the newest
  // response, issued after the last mark, may replace what is on screen.
  const seq = useRef(0);
  const lastMutation = useRef(0);

  // A session deep link only carries the session id; the contract wants the
  // event id too, so resolve it once from event_sessions.
  useEffect(() => {
    if (eventIdProp) { setEventId(eventIdProp); return; }
    if (!sessionId) return;
    let cancelled = false;
    supabase.from("event_sessions").select("event_id").eq("id", sessionId).maybeSingle()
      .then(({ data: row, error: err }) => {
        if (cancelled) return;
        if (err || !row) setError("Session not found.");
        else setEventId(row.event_id);
      });
    return () => { cancelled = true; };
  }, [sessionId, eventIdProp]);

  const load = useCallback(async (silent = false) => {
    if (!eventId) return;
    const issued = ++seq.current;
    const startedAt = Date.now();
    try {
      const res = await coachSession<RegisterResponse>({ action: "register", event_id: eventId, ...(sessionId && { session_id: sessionId }) });
      // Don't let a poll that raced a tap — or an older poll — overwrite a newer mark.
      if (silent && (inflight.current > 0 || issued !== seq.current || startedAt < lastMutation.current)) return;
      setData(res);
      setError(null);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Could not load the register.");
    }
  }, [eventId, sessionId]);

  useEffect(() => { setData(null); void load(); }, [load]);

  useEffect(() => {
    if (!eventId) return;
    const tick = () => { if (document.visibilityState === "visible") void load(true); };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [eventId, load]);

  const players = useMemo(() => data?.players ?? [], [data]);
  const session = data?.session ?? null;
  const isProgramme = data?.event.programme_type === "programme";
  const selected = useMemo(() => players.find((p) => p.booking_id === selectedId) ?? null, [players, selectedId]);

  // If the selected child leaves the register (refund, cancellation) both
  // sheets close through their open prop; make sure the report sheet does
  // not stay armed for the next tap.
  useEffect(() => { if (!selected) setReportOpen(false); }, [selected]);

  const counts = useMemo(() => ({
    arrived: players.filter((p) => p.attendance?.status === "arrived").length,
    absent: players.filter((p) => p.attendance?.status === "absent").length,
    unmarked: players.filter((p) => !p.attendance).length,
    complete: players.filter((p) => p.report?.complete).length,
  }), [players]);

  const endedAt = session?.ended_at ?? data?.event.register_closed_at ?? localEndedAt;

  const patchPlayer = (bookingId: string, patch: Partial<Player>) =>
    setData((d) => d ? { ...d, players: d.players.map((p) => p.booking_id === bookingId ? { ...p, ...patch } : p) } : d);

  const setAttendance = async (player: Player, status: AttendanceAction) => {
    if (busy.has(player.booking_id)) return;
    setBusy((b) => new Set(b).add(player.booking_id));
    inflight.current += 1;
    const before = player.attendance;
    // Optimistic: the mark shows instantly, the server's timestamp replaces it.
    patchPlayer(player.booking_id, {
      attendance: status === "clear" ? null : { status, marked_at: new Date().toISOString(), source: "manual" },
    });
    try {
      const res = await coachSession<{ ok: true; attendance: Attendance | null }>({
        action: "attendance",
        booking_id: player.booking_id,
        ...(sessionId && { session_id: sessionId }),
        status,
      });
      patchPlayer(player.booking_id, { attendance: res.attendance ?? null });
      lastMutation.current = Date.now();
    } catch (e) {
      patchPlayer(player.booking_id, { attendance: before });
      toast.error(e instanceof Error ? e.message : "Could not update attendance");
    } finally {
      inflight.current -= 1;
      setBusy((b) => { const n = new Set(b); n.delete(player.booking_id); return n; });
    }
  };

  const endSession = async () => {
    if (!eventId) return;
    setEnding(true);
    try {
      const res = await coachSession<EndSessionResponse>({
        action: "end_session",
        event_id: eventId,
        ...(sessionId && { session_id: sessionId }),
        mark_absent: players.filter((p) => !p.attendance).map((p) => p.booking_id),
      });
      const bits = [
        `${res.absent_marked} marked absent`,
        ...(isProgramme ? [`${res.reports_sent} report${res.reports_sent === 1 ? "" : "s"} sent`] : []),
        `${res.absence_emails} absence email${res.absence_emails === 1 ? "" : "s"}`,
      ];
      toast.success(`Session ended · ${bits.join(" · ")}`);
      for (const err of res.errors ?? []) toast.error(err);
      setLocalEndedAt(new Date().toISOString());
      setEndOpen(false);
      lastMutation.current = Date.now();
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not end the session");
    } finally {
      setEnding(false);
    }
  };

  const title = data?.event.title ?? "Register";
  const when = session
    ? `${relativeDay(session.session_date)}${session.start_time ? ` · ${formatTimeRange(session.start_time, session.end_time)}` : ""}${session.venue ? ` · ${session.venue}` : ""}`
    : data?.event.location ?? "";
  const backTo = session || sessionId
    ? (eventId ? `/coach/programme/${eventId}` : "/coach")
    : data?.event.location ? `/coach/venue/${encodeURIComponent(data.event.location)}` : "/coach";

  return (
    <CoachShell
      title={title}
      back={{ label: session || sessionId ? "Sessions" : "Programmes", to: backTo }}
      topActions={data && !endedAt ? (
        <Button size="sm" variant="outline" onClick={() => setEndOpen(true)} className="md:hidden">End session</Button>
      ) : undefined}
    >
      <PageHeader
        eyebrow={when || undefined}
        title={title}
        hideTitleOnPhone
        className="mb-4"
        actions={data ? (
          endedAt
            ? <StatusBadge tone="success">Ended {clock(endedAt)}</StatusBadge>
            : <Button variant="outline" onClick={() => setEndOpen(true)} className="hidden md:inline-flex">End session</Button>
        ) : undefined}
      >
        {data && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="success">{counts.arrived} here</StatusBadge>
            {counts.absent > 0 && <StatusBadge tone="danger">{counts.absent} absent</StatusBadge>}
            <StatusBadge tone="neutral">{counts.unmarked} not marked</StatusBadge>
            {isProgramme && <StatusBadge tone={counts.complete === players.length && players.length > 0 ? "success" : "brand"} dot={false}>{counts.complete}/{players.length} reports</StatusBadge>}
          </div>
        )}
      </PageHeader>

      {error && <InlineNote tone="danger" className="mb-3">{error}</InlineNote>}

      {!data && !error ? (
        <SkeletonRows rows={6} />
      ) : data && players.length === 0 ? (
        <EmptyState icon={Users} title="No paid players on this session yet" description="Players appear here once their place is paid for." />
      ) : data ? (
        <div className="pb-20">
          {endedAt && (
            <InlineNote tone="neutral" className="mb-3">Session ended — marks and reports can still be changed. Reports edited now reach the parent as “Updated”.</InlineNote>
          )}
          <ListGroup>
            {players.map((p) => (
              <PlayerRow
                key={p.booking_id}
                player={p}
                session={session}
                isProgramme={isProgramme}
                busy={busy.has(p.booking_id)}
                onAttendance={(s) => setAttendance(p, s)}
                onOpen={() => { setReportOpen(false); setSelectedId(p.booking_id); }}
              />
            ))}
          </ListGroup>
        </div>
      ) : null}

      {/* Floating scanner: bottom-right, clear of the phone bottom bar. */}
      {data && (
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          aria-label="Scan tickets"
          className="press fixed right-4 z-30 inline-flex h-14 items-center gap-2 rounded-full bg-primary px-5 font-semibold text-primary-foreground shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-8 md:right-8"
        >
          <QrCode className="h-5 w-5" /> Scan
        </button>
      )}

      <ScanSheet
        open={scanOpen}
        onOpenChange={setScanOpen}
        sessionId={sessionId}
        label={`${title}${when ? ` · ${when}` : ""}`}
        onScanned={() => void load(true)}
      />

      <ProfileSheet
        player={selected}
        session={session}
        isProgramme={isProgramme}
        open={!!selected && !reportOpen}
        onOpenChange={(o) => { if (!o) setSelectedId(null); }}
        busy={!!selected && busy.has(selected.booking_id)}
        onAttendance={(s) => { if (selected) void setAttendance(selected, s); }}
        onOpenReport={() => setReportOpen(true)}
      />

      <ReportSheet
        player={selected}
        sessionId={sessionId}
        open={!!selected && reportOpen}
        onOpenChange={(o) => { if (!o) setReportOpen(false); }}
        onSaved={() => { lastMutation.current = Date.now(); void load(true); }}
      />

      <EndSessionDialog
        open={endOpen}
        onOpenChange={setEndOpen}
        players={players}
        isProgramme={isProgramme}
        busy={ending}
        onConfirm={endSession}
      />
    </CoachShell>
  );
}
