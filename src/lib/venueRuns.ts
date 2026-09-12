// A programme can change venue (and time) part-way through the season:
// Ollie adds the sessions in two runs — say four Sundays at Culford, then
// seven at Ipswich. The programme's own `location` is only ever one venue,
// so everything parents read derives the venue wording from the sessions.
import { formatTimeRange } from "./timeFormat";

export type RunSession = {
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  cancelled_at?: string | null;
};

export type VenueRun = {
  venue: string | null;
  count: number;
  first: string; // YYYY-MM-DD
  last: string;
  start_time: string | null;
  end_time: string | null;
};

/** Consecutive runs of sessions at the same venue, in date order, cancelled ones skipped. */
export function venueRuns(sessions: RunSession[], fallbackVenue: string | null = null): VenueRun[] {
  const live = sessions.filter((s) => !s.cancelled_at).slice().sort((a, b) => a.session_date.localeCompare(b.session_date));
  const runs: VenueRun[] = [];
  for (const s of live) {
    const venue = (s.venue ?? fallbackVenue) || null;
    const last = runs[runs.length - 1];
    if (last && last.venue === venue) {
      last.count += 1;
      last.last = s.session_date;
    } else {
      runs.push({ venue, count: 1, first: s.session_date, last: s.session_date, start_time: s.start_time ?? null, end_time: s.end_time ?? null });
    }
  }
  return runs;
}

/** "Culford Sports & Tennis Centre, then Ipswich Sports Club" — or the single venue, or null. */
export function venueLine(runs: VenueRun[], fallbackVenue: string | null = null): string | null {
  const named = runs.filter((r) => r.venue);
  if (named.length === 0) return fallbackVenue;
  const distinct = named.map((r) => r.venue as string).filter((v, i, a) => a.indexOf(v) === i);
  if (distinct.length === 1) return distinct[0];
  return named.map((r) => r.venue).join(", then ");
}

const day = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const weekday = (ymd: string) => new Date(ymd + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long" });

/**
 * One plain sentence for a programme that moves: "The first 4 sessions are
 * at Culford Sports & Tennis Centre (27 September to 20 December, Sundays
 * 3.30–5.30pm), then the remaining 7 are at Ipswich Sports Club (31 January
 * to 11 July, Sundays 3–5pm)." Returns null when the venue never changes.
 */
export function venueRunsSentence(runs: VenueRun[]): string | null {
  const named = runs.filter((r) => r.venue);
  if (named.length < 2) return null;
  const part = (r: VenueRun, i: number) => {
    const span = r.count === 1 ? day(r.first) : `${day(r.first)} to ${day(r.last)}`;
    const time = r.start_time ? `, ${weekday(r.first)}s ${formatTimeRange(r.start_time, r.end_time)}` : "";
    const which = i === 0 ? `The first ${r.count} session${r.count === 1 ? " is" : "s are"}`
      : i === named.length - 1 ? `then the remaining ${r.count} ${r.count === 1 ? "is" : "are"}`
      : `then the next ${r.count} ${r.count === 1 ? "is" : "are"}`;
    return `${which} at ${r.venue} (${span}${time})`;
  };
  return named.map(part).join(", ") + ".";
}
