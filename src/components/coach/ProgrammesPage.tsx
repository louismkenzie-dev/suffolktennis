import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Ticket } from "lucide-react";
import { formatTimeRange } from "@/lib/timeFormat";
import { EmptyState, ListGroup, ListRow, PageHeader, Section, SkeletonRows, StatusBadge, InlineNote } from "@/components/app";
import { CoachShell } from "./CoachShell";
import { coachSession, type ProgrammeItem } from "./api";
import { relativeDay } from "./time";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Programmes at one venue, then one-off events under their own heading. */
export function ProgrammesPage({ venue }: { venue: string }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<ProgrammeItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError(null);
    coachSession<{ items: ProgrammeItem[] }>({ action: "programmes", venue })
      .then((d) => { if (!cancelled) setItems(d.items ?? []); })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setItems([]); } });
    return () => { cancelled = true; };
  }, [venue]);

  const programmes = (items ?? []).filter((i) => i.programme_type === "programme");
  const events = (items ?? []).filter((i) => i.programme_type !== "programme");

  // A session-less event has nothing to choose between, so it opens its
  // register straight away; everything else goes via the sessions list.
  const open = (item: ProgrammeItem) => {
    if (!item.next_session && item.session_count === 0) navigate(`/coach/register/event/${item.id}`);
    else navigate(`/coach/programme/${item.id}`);
  };

  const nextLine = (item: ProgrammeItem) => {
    const s = item.next_session;
    if (!s) return item.session_count === 0 ? "One-off · no session times" : "No upcoming sessions";
    const time = s.start_time ? ` · ${formatTimeRange(s.start_time, s.end_time)}` : "";
    return `Next ${relativeDay(s.session_date)}${time}`;
  };

  const row = (item: ProgrammeItem) => (
    <ListRow
      key={item.id}
      onClick={() => open(item)}
      wrapTitle
      title={item.title}
      subtitle={[item.meeting_cadence, nextLine(item)].filter(Boolean).join(" · ")}
      detail={item.session_count > 0 ? `${plural(item.session_count, "session")}${item.upcoming_count ? ` · ${item.upcoming_count} to come` : ""}` : undefined}
      trailing={item.cancelled_at
        ? <StatusBadge tone="danger" dot={false}>Cancelled</StatusBadge>
        : item.next_session && relativeDay(item.next_session.session_date) === "Today"
          ? <StatusBadge tone="brand" dot={false}>Today</StatusBadge>
          : undefined}
      chevron
    />
  );

  return (
    <CoachShell title={venue} back={{ label: "Venues", to: "/coach" }}>
      <PageHeader eyebrow="Venue" title={venue} hideTitleOnPhone className="mb-4" />
      {error && <InlineNote tone="danger" className="mb-3">{error}</InlineNote>}
      {items === null ? (
        <SkeletonRows rows={3} avatar={false} />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing at this venue" description="Programmes you are assigned to at this venue will appear here." />
      ) : (
        <div className="space-y-6">
          {programmes.length > 0 && (
            <Section title="Programmes" count={programmes.length}>
              <ListGroup>{programmes.map(row)}</ListGroup>
            </Section>
          )}
          {events.length > 0 && (
            <Section title="Events" count={events.length} description="One-off events have a register but no session reports.">
              <ListGroup>{events.map(row)}</ListGroup>
            </Section>
          )}
          {programmes.length === 0 && events.length === 0 && (
            <EmptyState icon={Ticket} title="Nothing at this venue" compact />
          )}
        </div>
      )}
    </CoachShell>
  );
}
