import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { Chip, EmptyState, ListGroup, ListRow, PageHeader, Section, SkeletonRows, InlineNote } from "@/components/app";
import { CoachShell } from "./CoachShell";
import { coachSession, type Venue } from "./api";
import { relativeDay } from "./time";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Venues → the first step of Venues → Programme → Session → Register. */
export function VenuesPage() {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setVenues(null);
    setError(null);
    coachSession<{ venues: Venue[] }>({ action: "venues", ...(all && { all: true }) })
      .then((d) => { if (!cancelled) setVenues(d.venues ?? []); })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setVenues([]); } });
    return () => { cancelled = true; };
  }, [all]);

  const summary = (v: Venue) => {
    const parts: string[] = [];
    if (v.programmes) parts.push(plural(v.programmes, "programme"));
    if (v.events) parts.push(plural(v.events, "event"));
    if (v.next_date) parts.push(`next ${relativeDay(v.next_date)}`);
    return parts.join(" · ") || "No sessions in range";
  };

  return (
    <CoachShell title="Register">
      <PageHeader
        title="Register"
        hideTitleOnPhone
        description="Pick a venue, then the programme and session you are coaching."
        actions={<Chip active={all} onClick={() => setAll((a) => !a)}>All venues</Chip>}
        className="mb-4"
      />
      {error && <InlineNote tone="danger" className="mb-3">{error}</InlineNote>}
      {venues === null ? (
        <SkeletonRows rows={4} avatar={false} />
      ) : venues.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={all ? "No programmes assigned yet" : "Nothing coming up"}
          description={all
            ? "Ask an admin to add you to a programme."
            : "No sessions in the last two weeks or the next six. Try \"All venues\" — or if you are new, ask an admin to add you to a programme."}
        />
      ) : (
        <Section title="Venues" count={venues.length}>
          <ListGroup>
            {venues.map((v) => (
              <ListRow
                key={v.name}
                onClick={() => navigate(`/coach/venue/${encodeURIComponent(v.name)}`)}
                leading={<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPin size={18} /></div>}
                title={v.name}
                subtitle={summary(v)}
                meta={v.upcoming > 0 ? <span>{v.upcoming} upcoming</span> : undefined}
                chevron
              />
            ))}
          </ListGroup>
        </Section>
      )}
    </CoachShell>
  );
}
