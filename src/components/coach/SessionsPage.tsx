import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimeRange } from "@/lib/timeFormat";
import { EmptyState, ListGroup, ListRow, PageHeader, Section, SkeletonRows, StatusBadge, InlineNote } from "@/components/app";
import { CoachShell } from "./CoachShell";
import { coachSession, type SessionsResponse, type SessionSummary } from "./api";
import { clock, londonToday } from "./time";

/** Date block for a session row: weekday over the day number. */
export function DateBlock({ date, active = false }: { date: string; active?: boolean }) {
  const d = new Date(date + "T12:00:00");
  return (
    <div className={`flex h-11 w-11 flex-col items-center justify-center rounded-xl ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
      <span className="text-[10px] font-semibold uppercase leading-none">{d.toLocaleDateString("en-GB", { weekday: "short" })}</span>
      <span className="mt-0.5 text-base font-semibold leading-none tabular">{d.getDate()}</span>
    </div>
  );
}

/** Sessions of a programme or event; today's is highlighted. */
export function SessionsPage({ eventId }: { eventId: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = londonToday();

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    coachSession<SessionsResponse>({ action: "sessions", event_id: eventId })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [eventId]);

  // Upcoming first (today at the top), then past sessions most recent first —
  // a coach wants today's register, and occasionally the one from last week.
  const { upcoming, past } = useMemo(() => {
    const all = data?.sessions ?? [];
    return {
      upcoming: all.filter((s) => s.session_date >= today),
      past: all.filter((s) => s.session_date < today).reverse(),
    };
  }, [data, today]);

  const isProgramme = data?.event.programme_type === "programme";
  const backTo = data?.event.location ? `/coach/venue/${encodeURIComponent(data.event.location)}` : "/coach";

  const row = (s: SessionSummary) => {
    const isToday = s.session_date === today;
    const counts = `${s.total} player${s.total === 1 ? "" : "s"} · ${s.arrived} here${s.absent ? ` · ${s.absent} absent` : ""}`;
    return (
      <ListRow
        key={s.id}
        onClick={() => navigate(`/coach/register/${s.id}`, { state: { eventId } })}
        leading={<DateBlock date={s.session_date} active={isToday} />}
        title={
          <span className="flex items-center gap-2">
            <span>{s.start_time ? formatTimeRange(s.start_time, s.end_time) : new Date(s.session_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" })}</span>
            {isToday && <StatusBadge tone="brand" dot={false}>Today</StatusBadge>}
          </span>
        }
        subtitle={counts}
        detail={s.venue && s.venue !== data?.event.location ? s.venue : undefined}
        meta={isProgramme ? <span title="Complete reports">{s.reports_complete}/{s.total}<span className="ml-1 text-[11px]">reports</span></span> : undefined}
        trailing={s.cancelled_at
          ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge>
          : s.ended_at
            ? <StatusBadge tone="success">Ended {clock(s.ended_at)}</StatusBadge>
            : undefined}
        className={s.cancelled_at ? "opacity-60" : undefined}
        chevron
      />
    );
  };

  return (
    <CoachShell title={data?.event.title ?? "Sessions"} back={{ label: "Programmes", to: backTo }}>
      <PageHeader
        eyebrow={data ? (isProgramme ? "Programme" : "Event") : undefined}
        title={data?.event.title ?? "Sessions"}
        hideTitleOnPhone
        description={data?.event.location ?? undefined}
        className="mb-4"
      />
      {error && <InlineNote tone="danger" className="mb-3">{error}</InlineNote>}
      {!data && !error ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : data && data.sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No session times on this event"
          description="One-off events keep a single register for the day."
          action={<Button onClick={() => navigate(`/coach/register/event/${eventId}`)}>Open register</Button>}
        />
      ) : data ? (
        <div className="space-y-6">
          {upcoming.length > 0 ? (
            <Section title="Upcoming" count={upcoming.length}>
              <ListGroup>{upcoming.map(row)}</ListGroup>
            </Section>
          ) : (
            <EmptyState icon={CalendarDays} title="No upcoming sessions" compact />
          )}
          {past.length > 0 && (
            <Section title="Past" count={past.length}>
              <ListGroup>{past.map(row)}</ListGroup>
            </Section>
          )}
        </div>
      ) : null}
    </CoachShell>
  );
}
