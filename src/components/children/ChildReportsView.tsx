/**
 * Performance & Reports for one child, inside the Parent Hub: a coach's
 * session reports and the LTA camp reports a parent uploads, charted as one
 * history because they rate the same nine areas (see progress.ts). The
 * building blocks (radar, trend grid, per-area rows, loader) are exported so
 * the standalone /report/:id page shows exactly the same thing.
 *
 * Only reports the coach finished (complete = true, all nine areas rated)
 * count. Legacy four-star rows have empty `ratings` and never appear here.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, ChevronLeft, ChevronDown, ChevronUp, ExternalLink, Upload } from "lucide-react";
import {
  Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { formatTimeRange } from "@/lib/timeFormat";
import { LTA_AREAS, LTA_LEVELS, isComplete, levelLabel, trendSentence, type Ratings } from "@/lib/lta";
import { EmptyState, InlineNote, ListGroup, ListRow, PageHeader, Section, SkeletonBlock, StatusBadge, Surface } from "@/components/app";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadProgress, type ProgressData, type ProgressEntry, type ProgressKind } from "./progress";
import GoalsTournamentSection from "./GoalsTournamentSection";
import PlanDetail from "./PlanDetail";
import PlanUploadSheet from "./PlanUploadSheet";

// session_reports / session_attendance are not in the generated types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** A session_reports row as it comes from the database. */
type ReportRow = Omit<SessionReport, "session" | "event" | "date" | "ratings" | "area_notes"> & {
  ratings: Ratings | null; area_notes: Record<string, string> | null;
};

/* ---------------------------------------------------------------- */
/* Types and loading                                                  */
/* ---------------------------------------------------------------- */

export type ReportSession = {
  id: string; event_id: string; session_date: string; start_time: string | null; end_time: string | null;
  venue: string | null; cancelled_at?: string | null;
};
export type ReportEvent = { id: string; title: string; location: string | null; event_date: string | null };

export type SessionReport = {
  id: string; booking_id: string; event_id: string; session_id: string | null; child_id: string | null;
  child_name: string; coach_id: string; coach_name: string | null;
  ratings: Ratings; area_notes: Record<string, string>; comment: string | null;
  complete: boolean; sent_at: string | null; created_at: string; updated_at: string;
  /** Joined for display; null when the session or event has gone. */
  session: ReportSession | null;
  event: ReportEvent | null;
  /** YYYY-MM-DD used for ordering and headings: the session date, else the day it was written. */
  date: string;
};

export type AttendanceRow = {
  id: string; booking_id: string; event_id: string; session_id: string | null; child_id: string | null;
  status: "arrived" | "absent"; source: string; marked_at: string;
};

/** One line of the attendance list: a past session and what was recorded. */
export type AttendanceEntry = {
  key: string; date: string; start_time: string | null; end_time: string | null;
  eventTitle: string; attendance: AttendanceRow | null;
};

export type ChildReportsData = { reports: SessionReport[]; attendance: AttendanceEntry[] };

/**
 * The least the charts and area rows need. A SessionReport and a
 * ProgressEntry both satisfy it, so /report/:id and the merged view share
 * one set of pieces.
 */
export type RatedEntry = { ratings: Ratings; area_notes?: Record<string, string>; date: string };

const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Only a finished report the coach has sent (End session, or the two-hour
 * dispatcher) is a report to a parent — a coach may still be editing before
 * then. Legacy four-star rows have empty ratings and never qualify.
 */
export const isParentVisible = (r: { complete?: boolean; sent_at?: string | null; ratings?: Ratings | null }) =>
  !!r.complete && !!r.sent_at && isComplete(r.ratings);

/** Edited after it was sent — the parent sees "Updated" instead of a second email. */
export const isUpdated = (r: { sent_at: string | null; updated_at: string }) =>
  !!r.sent_at && new Date(r.updated_at).getTime() - new Date(r.sent_at).getTime() > 60_000;

const uniq = (xs: Array<string | null | undefined>) => Array.from(new Set(xs.filter(Boolean) as string[]));

async function fetchSessionsAndEvents(eventIds: string[]) {
  if (eventIds.length === 0) return { sessions: [] as ReportSession[], events: [] as ReportEvent[] };
  const [{ data: sessions }, { data: events }] = await Promise.all([
    db.from("event_sessions").select("id, event_id, session_date, start_time, end_time, venue, cancelled_at").in("event_id", eventIds),
    db.from("events").select("id, title, location, event_date").in("id", eventIds),
  ]);
  return { sessions: (sessions ?? []) as ReportSession[], events: (events ?? []) as ReportEvent[] };
}

function attachAndSort(rows: ReportRow[], sessions: ReportSession[], events: ReportEvent[]): SessionReport[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const eventById = new Map(events.map((e) => [e.id, e]));
  return rows
    .filter(isParentVisible)
    .map((r) => {
      const session = r.session_id ? sessionById.get(r.session_id) ?? null : null;
      return {
        ...r,
        ratings: r.ratings ?? {},
        area_notes: r.area_notes ?? {},
        session,
        event: eventById.get(r.event_id) ?? null,
        date: session?.session_date ?? r.created_at.slice(0, 10),
      } as SessionReport;
    })
    // Oldest first so "previous" is simply the one before.
    .sort((a, b) => (a.date === b.date ? a.created_at.localeCompare(b.created_at) : a.date.localeCompare(b.date)));
}

/**
 * Everything the parent UI needs for one child: complete reports (oldest
 * first) with their session and event, and an attendance entry for every
 * past session on the child's bookings. Reads go through RLS, so a parent
 * only ever sees their own bookings' rows.
 */
export async function loadChildReports(childId: string): Promise<ChildReportsData> {
  const [{ data: reportRows }, { data: attendanceRows }, { data: bookingRows }] = await Promise.all([
    db.from("session_reports").select("*").eq("child_id", childId).eq("complete", true).not("sent_at", "is", null),
    db.from("session_attendance").select("*").eq("child_id", childId),
    db.from("bookings").select("id, event_id, status").eq("child_id", childId),
  ]);
  const reportsRaw = (reportRows ?? []) as ReportRow[];
  const attendance = (attendanceRows ?? []) as AttendanceRow[];
  const bookings = (bookingRows ?? []) as Array<{ id: string; event_id: string; status: string }>;

  // Only live bookings contribute "Not recorded" rows; a pending or cancelled
  // booking's sessions are not sessions the child was expected at.
  const bookedEvents = new Set(bookings.filter((b) => b.status === "paid" || b.status === "booked").map((b) => b.event_id));
  const eventIds = uniq([...reportsRaw.map((r) => r.event_id), ...attendance.map((a) => a.event_id), ...bookedEvents]);
  const { sessions, events } = await fetchSessionsAndEvents(eventIds);
  const reports = attachAndSort(reportsRaw, sessions, events);

  // Attendance: one entry per past, uncancelled session on a booking, plus
  // any attendance row for a session-less event. Newest first.
  const today = todayIso();
  const eventById = new Map(events.map((e) => [e.id, e]));
  const bySession = new Map(attendance.filter((a) => a.session_id).map((a) => [a.session_id as string, a]));
  const entries: AttendanceEntry[] = sessions
    .filter((s) => s.session_date <= today && !s.cancelled_at && (bookedEvents.has(s.event_id) || bySession.has(s.id)))
    .map((s) => ({
      key: s.id, date: s.session_date, start_time: s.start_time, end_time: s.end_time,
      eventTitle: eventById.get(s.event_id)?.title ?? "Session", attendance: bySession.get(s.id) ?? null,
    }));
  for (const a of attendance.filter((x) => !x.session_id)) {
    const ev = eventById.get(a.event_id);
    entries.push({
      key: a.id, date: ev?.event_date?.slice(0, 10) ?? a.marked_at.slice(0, 10), start_time: null, end_time: null,
      eventTitle: ev?.title ?? "Event", attendance: a,
    });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date));
  return { reports, attendance: entries };
}

/** A single report by id (RLS decides whether the caller may see it), with its child's history for trends. */
export async function loadReportWithHistory(reportId: string): Promise<{ report: SessionReport; history: SessionReport[] } | null> {
  const { data } = await db.from("session_reports").select("*").eq("id", reportId).maybeSingle();
  const row = data as ReportRow | null;
  if (!row || !isParentVisible(row)) return null;
  if (row.child_id) {
    const { reports } = await loadChildReports(row.child_id);
    const report = reports.find((r) => r.id === reportId);
    if (report) return { report, history: reports };
  }
  // The child record has gone (or the report is orphaned): show it on its own.
  const { sessions, events } = await fetchSessionsAndEvents([row.event_id]);
  const [report] = attachAndSort([row], sessions, events);
  return report ? { report, history: [report] } : null;
}

/* ---------------------------------------------------------------- */
/* Formatting                                                         */
/* ---------------------------------------------------------------- */

const atNoon = (ymd: string) => new Date(ymd.length === 10 ? `${ymd}T12:00:00` : ymd);
export const shortDate = (ymd: string) => atNoon(ymd).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const longDate = (ymd: string) => atNoon(ymd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** "1.28pm" in London time from a timestamptz. */
export const clockLondon = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" })
    .replace(":", ".").replace(/\s+/g, "").toLowerCase();

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** LTA 1..4 (1 best) → radial value where Excelling sits at the outer edge. */
const outward = (rating: number | undefined) => (rating && rating >= 1 && rating <= 4 ? 5 - rating : null);

const PRIMARY = "hsl(var(--primary))";
const GREY = "hsl(var(--muted-foreground))";

/** Split an area name into short lines so the radar labels never clip at 360px. */
function wrapLabel(name: string, max = 12): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of name.split(" ")) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) { lines.push(current); current = word; } else current = next;
  }
  if (current) lines.push(current);
  return lines;
}

/* ---------------------------------------------------------------- */
/* Pieces                                                             */
/* ---------------------------------------------------------------- */

export function LevelPill({ value, className }: { value: number | undefined; className?: string }) {
  const level = LTA_LEVELS.find((l) => l.value === value);
  return <StatusBadge tone={level?.tone ?? "neutral"} dot={false} className={className}>{level?.label ?? "Not rated"}</StatusBadge>;
}

/** "Session report" / "Performance plan" — the one visual cue that tells the two kinds apart. */
export function KindBadge({ kind, className }: { kind: ProgressKind; className?: string }) {
  return kind === "plan"
    ? <StatusBadge tone="brand" dot={false} className={className}>Performance plan</StatusBadge>
    : <StatusBadge tone="neutral" dot={false} className={className}>Session report</StatusBadge>;
}

/** Date · time · coach line under an entry, with the "Updated" badge when a session report was edited after sending. */
export function EntryMeta({ entry, className }: { entry: ProgressEntry; className?: string }) {
  const session = entry.session;
  const time = session?.session?.start_time ? formatTimeRange(session.session.start_time, session.session.end_time) : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground", className)}>
      <span>{[longDate(entry.date), time].filter(Boolean).join(" · ")}</span>
      {entry.coach_name && <span>· Coach {entry.coach_name}</span>}
      {session && isUpdated(session) && <StatusBadge tone="info" dot={false}>Updated</StatusBadge>}
    </div>
  );
}

type AngleTickProps = { payload?: { value?: unknown }; x?: number; y?: number; cx?: number; cy?: number; textAnchor?: "start" | "middle" | "end" };
const AngleTick = ({ payload, x = 0, y = 0, cx = 0, cy = 0, textAnchor }: AngleTickProps) => {
  const lines = wrapLabel(String(payload?.value ?? ""));
  const lineHeight = 11;
  // Stack the lines away from the chart: upwards above it, downwards below,
  // vertically centred at the sides.
  const above = y < cy - 6;
  const below = y > cy + 6;
  const startY = above ? y - (lines.length - 1) * lineHeight : below ? y + 8 : y + 4 - ((lines.length - 1) * lineHeight) / 2;
  return (
    <text x={x} y={startY} textAnchor={textAnchor} fontSize={10} fontWeight={500} fill={GREY}>
      {lines.map((line, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : lineHeight}>{line}</tspan>)}
    </text>
  );
};

type TipProps = { active?: boolean; label?: string; payload?: Array<{ dataKey?: string; value?: number; payload?: { date: string; v: number } }> };
const RadarTip = ({ active, payload, label }: TipProps) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-muted-foreground">
          {p.dataKey === "latest" ? "Latest" : "Previous"}: <span className="font-medium text-foreground">{levelLabel(p.value ? 5 - p.value : undefined)}</span>
        </p>
      ))}
    </div>
  );
};

/**
 * The nine areas as a radar: latest in Suffolk blue, previous ghosted in
 * grey. The LTA scale is inverted for display so Excelling is the outer edge.
 */
export function RatingsRadar({ latest, previous, latestDate, previousDate, className }: {
  latest: Ratings; previous?: Ratings | null; latestDate?: string; previousDate?: string; className?: string;
}) {
  const data = LTA_AREAS.map((a) => ({ area: a.name, latest: outward(latest[a.name]), previous: previous ? outward(previous[a.name]) : null }));
  return (
    <div className={className}>
      <div className="h-[300px] w-full min-w-0 sm:h-[340px]" role="img" aria-label="Radar chart of the nine LTA areas">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="60%" margin={{ top: 18, right: 30, bottom: 18, left: 30 }}>
            <PolarGrid gridType="polygon" stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="area" tick={AngleTick} tickLine={false} />
            <PolarRadiusAxis domain={[0, 4]} tick={false} axisLine={false} angle={90} />
            <Tooltip content={<RadarTip />} cursor={false} />
            {previous && (
              <Radar name="Previous" dataKey="previous" stroke={GREY} strokeWidth={1.5} strokeDasharray="4 3" fill="none" fillOpacity={0} isAnimationActive={false} />
            )}
            <Radar name="Latest" dataKey="latest" stroke={PRIMARY} strokeWidth={2} fill={PRIMARY} fillOpacity={0.25} dot={{ r: 2.5, fill: PRIMARY, strokeWidth: 0 }} isAnimationActive={false} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary/80" /> Latest{latestDate ? ` · ${shortDate(latestDate)}` : ""}</span>
        {previous && (
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" /> Previous{previousDate ? ` · ${shortDate(previousDate)}` : ""}</span>
        )}
        <span className="basis-full text-center text-[11px] text-muted-foreground/80">Outer edge = Excelling</span>
      </div>
    </div>
  );
}

const TrendTip = ({ active, payload }: TipProps) => {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-card">
      <span className="text-muted-foreground">{shortDate(p.date)} · </span><span className="font-medium">{levelLabel(5 - p.v)}</span>
    </div>
  );
};

/** One small line per area across every rated entry (oldest → newest), inverted so up = better. */
export function TrendGrid({ reports, className }: { reports: RatedEntry[]; className?: string }) {
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {LTA_AREAS.map((a) => {
        const points = reports
          .map((r) => ({ date: r.date, v: outward(r.ratings[a.name]) }))
          .filter((p): p is { date: string; v: number } => p.v !== null);
        const last = points[points.length - 1];
        return (
          <Surface key={a.name} className="min-w-0 px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-medium text-foreground">{a.name}</p>
              <LevelPill value={last ? 5 - last.v : undefined} />
            </div>
            {points.length >= 2 ? (
              <div className="mt-2 h-14 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={points} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
                    <YAxis domain={[0.5, 4.5]} hide />
                    <XAxis dataKey="date" hide />
                    <Tooltip content={<TrendTip />} cursor={{ stroke: "hsl(var(--border))" }} />
                    <Line type="monotone" dataKey="v" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3, fill: PRIMARY, strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{points.length === 1 ? "One report so far — the line starts with the next." : "Not rated yet."}</p>
            )}
            {points.length >= 2 && (
              <p className="mt-1 flex justify-between text-[11px] text-muted-foreground/80 tabular">
                <span>{shortDate(points[0].date)}</span><span>{shortDate(last.date)}</span>
              </p>
            )}
          </Surface>
        );
      })}
    </div>
  );
}

/** Per-area rows: name, level pill, the coach's note, and the change since last time. */
export function AreaRows({ report, previous }: { report: RatedEntry; previous: RatedEntry | null }) {
  return (
    <ListGroup>
      {LTA_AREAS.map((a) => {
        const rating = report.ratings[a.name];
        const note = report.area_notes?.[a.name]?.trim();
        const trend = previous ? trendSentence(a.name, previous.ratings[a.name], rating) : null;
        return (
          <div key={a.name} className="bg-card px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-medium leading-snug text-foreground">{a.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.descriptor}</p>
              </div>
              <LevelPill value={rating} className="mt-0.5 shrink-0" />
            </div>
            {note && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">{note}</p>}
            {trend && <p className="mt-1.5 text-xs text-muted-foreground">{trend}</p>}
          </div>
        );
      })}
    </ListGroup>
  );
}

export function CoachComment({ comment }: { comment: string | null }) {
  if (!comment?.trim()) return null;
  return (
    <Surface className="px-4 py-3.5">
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{comment}</p>
    </Surface>
  );
}

/** Attendance line per past session: "Arrived 1.28pm" / "Absent" / "Not recorded". */
export function AttendanceList({ entries }: { entries: AttendanceEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? entries : entries.slice(0, 8);
  if (entries.length === 0) {
    return <EmptyState compact title="No sessions yet" description="Attendance is recorded when the coach takes the register." />;
  }
  return (
    <div className="space-y-2">
      <ListGroup>
        {shown.map((e) => {
          const a = e.attendance;
          const badge = a?.status === "arrived"
            ? <StatusBadge tone="success">Arrived {clockLondon(a.marked_at)}</StatusBadge>
            : a?.status === "absent"
              ? <StatusBadge tone="danger">Absent</StatusBadge>
              : <StatusBadge tone="neutral">Not recorded</StatusBadge>;
          return (
            <ListRow
              key={e.key}
              size="sm"
              title={`${shortDate(e.date)}${e.start_time ? ` · ${formatTimeRange(e.start_time, e.end_time)}` : ""}`}
              subtitle={e.eventTitle}
              trailing={badge}
            />
          );
        })}
      </ListGroup>
      {entries.length > shown.length && (
        <button type="button" onClick={() => setShowAll(true)} className="inline-flex min-h-9 items-center px-0.5 text-sm font-medium text-primary">
          Show all {entries.length} sessions
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* The hub view                                                       */
/* ---------------------------------------------------------------- */


/** "9 areas rated", "7 of 9 areas rated", "PDF only" or "No ratings yet". */
function ratedLabel(e: ProgressEntry): string {
  const n = LTA_AREAS.filter((a) => [1, 2, 3, 4].includes(e.ratings[a.name])).length;
  if (n === LTA_AREAS.length) return "9 areas rated";
  if (n > 0) return `${n} of 9 areas rated`;
  return e.plan?.report_pdf_url ? "PDF only" : "No ratings yet";
}

export default function ChildReportsView({ childId, childName, onBack }: { childId: string; childName: string; onBack: () => void }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ProgressData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  // Bumped after an upload or a parse so the effect refetches; the data is
  // kept on screen meanwhile rather than dropping back to the skeleton.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => { setData(null); setExpandedId(null); }, [childId]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadProgress(childId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e?.message || "Could not load reports"); });
    return () => { cancelled = true; };
  }, [childId, version]);

  const entries = useMemo(() => data?.entries ?? [], [data]);
  // Charts and "previous" comparisons are drawn from rated entries only; a
  // PDF-only plan is listed but has nothing to plot.
  const rated = useMemo(() => entries.filter((e) => e.rated), [entries]);
  const newestFirst = useMemo(() => [...entries].reverse(), [entries]);
  const latest = rated[rated.length - 1] ?? null;
  const previous = rated.length >= 2 ? rated[rated.length - 2] : null;
  const newest = entries[entries.length - 1] ?? null;
  const name = firstName(childName);

  const showInList = (id: string) => {
    setExpandedId(id);
    document.getElementById(`entry-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const uploadButton = (
    <Button variant="outline" onClick={() => setUploadOpen(true)}>
      <Upload /> Upload a performance plan
    </Button>
  );

  return (
    <div>
      <button type="button" onClick={onBack} className="hit-area -ml-2 mb-3 inline-flex h-10 items-center gap-0.5 rounded-lg pl-1 pr-2 text-[15px] font-medium text-primary">
        <ChevronLeft className="h-5 w-5" /> My children
      </button>
      <PageHeader
        eyebrow="Performance & Reports"
        title={childName}
        description={
          !data ? undefined
            : entries.length === 0 ? `${name}'s session reports and performance plans live here.`
              : `${entries.length} ${entries.length === 1 ? "entry" : "entries"} · latest ${shortDate(newest!.date)}`
        }
        actions={uploadButton}
      />

      {error ? (
        <EmptyState icon={BarChart3} title="Could not load reports" description={error} />
      ) : !data ? (
        <div className="space-y-4" aria-busy>
          <SkeletonBlock className="h-72" />
          <SkeletonBlock className="h-40" />
          <SkeletonBlock className="h-40" />
        </div>
      ) : (
        <div className="space-y-8">
          {latest ? (
            <>
              <Section
                title="Latest report"
                description={<EntryMeta entry={latest} className="text-xs" />}
                action={
                  latest.kind === "session" ? (
                    <button type="button" onClick={() => navigate(`/report/${latest.session!.id}`)} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
                      Open <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => showInList(latest.id)} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
                      Details <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  )
                }
              >
                <Surface className="px-2 pb-3 pt-2 sm:px-4">
                  <div className="flex flex-wrap items-center gap-2 px-2 pt-1 sm:px-0">
                    <KindBadge kind={latest.kind} />
                    <p className="min-w-0 truncate text-[13px] font-medium text-foreground">{latest.title}</p>
                  </div>
                  <RatingsRadar latest={latest.ratings} previous={previous?.ratings ?? null} latestDate={latest.date} previousDate={previous?.date} />
                </Surface>
              </Section>

              <Section title="Progress over time" description={rated.length < 2 ? "Trend lines appear once two or more entries are rated." : "Up is better. Latest level shown on each area."}>
                <TrendGrid reports={rated} />
              </Section>
            </>
          ) : entries.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Nothing here yet"
              description={`When a Suffolk Tennis coach writes up one of ${name}'s sessions, or you upload an LTA camp report, it appears here with a chart of the nine areas.`}
              action={uploadButton}
            />
          ) : null}

          <GoalsTournamentSection childId={childId} childName={childName} sideBySide />

          {entries.length > 0 && (
            <Section title="Everything" count={entries.length}>
              <ListGroup>
                {newestFirst.map((e) => {
                  const ri = rated.indexOf(e);
                  const prev = ri > 0 ? rated[ri - 1] : null;
                  const open = expandedId === e.id;
                  const updated = e.session ? isUpdated(e.session) : false;
                  return (
                    <div key={e.id} id={`entry-${e.id}`} className="scroll-mt-4">
                      <ListRow
                        onClick={() => setExpandedId(open ? null : e.id)}
                        title={longDate(e.date)}
                        subtitle={e.title}
                        detail={[e.coach_name ? `Coach ${e.coach_name}` : null, ratedLabel(e)].filter(Boolean).join(" · ")}
                        trailing={
                          <span className="flex items-center gap-2">
                            {updated && <StatusBadge tone="info" dot={false}>Updated</StatusBadge>}
                            <KindBadge kind={e.kind} />
                            {open ? <ChevronUp className="h-4 w-4 text-muted-foreground/60" /> : <ChevronDown className="h-4 w-4 text-muted-foreground/60" />}
                          </span>
                        }
                        ariaLabel={`${open ? "Collapse" : "Expand"} ${e.kind === "plan" ? "performance plan" : "session report"} from ${longDate(e.date)}`}
                      />
                      {open && (
                        <div className="space-y-3 border-t border-border bg-muted/40 px-3 py-3 sm:px-4">
                          {Object.keys(e.ratings).length > 0 && <AreaRows report={e} previous={e.rated ? prev : null} />}
                          <CoachComment comment={e.comment} />
                          {e.kind === "session" && e.session && (
                            <button type="button" onClick={() => navigate(`/report/${e.session!.id}`)} className="inline-flex min-h-9 items-center gap-1 text-sm font-medium text-primary">
                              Open full report <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {e.kind === "plan" && e.plan && <PlanDetail plan={e.plan} rated={e.rated} onChanged={reload} />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </ListGroup>
            </Section>
          )}

          {data.warnings.map((w) => <InlineNote key={w} tone="warning">{w}</InlineNote>)}

          <Section title="Attendance" description="What the coach recorded at each session.">
            <AttendanceList entries={data.attendance} />
          </Section>
        </div>
      )}

      <PlanUploadSheet open={uploadOpen} onOpenChange={setUploadOpen} childId={childId} onDone={reload} />
    </div>
  );
}
