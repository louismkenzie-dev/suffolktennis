// Deno copy of src/lib/venueRuns.ts for the emails: a programme that changes
// venue part-way through the season is described from its sessions, never
// from the single `location` on the event. Keep the two in step.

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
  first: string;
  last: string;
  start_time: string | null;
  end_time: string | null;
};

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

export function venueLine(runs: VenueRun[], fallbackVenue: string | null = null): string | null {
  const named = runs.filter((r) => r.venue);
  if (named.length === 0) return fallbackVenue;
  const distinct = named.map((r) => r.venue as string).filter((v, i, a) => a.indexOf(v) === i);
  if (distinct.length === 1) return distinct[0];
  return named.map((r) => r.venue).join(", then ");
}

/** "13:30:00" -> "1.30pm" (src/lib/timeFormat.ts). */
export function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = Number(hh);
  const m = Number(mm ?? 0);
  if (!Number.isFinite(h)) return t;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
}

export function formatTimeRange(start: string | null | undefined, end?: string | null): string {
  if (!start) return "";
  if (!end) return formatTime(start);
  const a = formatTime(start);
  const b = formatTime(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -2)}–${b}` : `${a}–${b}`;
}

const day = (ymd: string) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "long" });
const weekday = (ymd: string) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long" });

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
