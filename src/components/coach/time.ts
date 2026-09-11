// Register times are always shown on the Europe/London wall clock — the
// session's `session_date` + `start_time` are London local, so a coach on
// holiday abroad still sees "late" judged against the court's clock.
import { formatTime } from "@/lib/timeFormat";

const LONDON = "Europe/London";

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** An instant → its London date ("YYYY-MM-DD") and time ("HH:MM"). */
export function londonParts(input: string | Date): { date: string; time: string } {
  const d = typeof input === "string" ? new Date(input) : input;
  const get = (type: Intl.DateTimeFormatPartTypes) => partsFormatter.formatToParts(d).find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export const londonToday = () => londonParts(new Date()).date;

/** "2026-09-11T14:28:00Z" → "3.28pm" (London). */
export const clock = (iso: string | null | undefined): string => (iso ? formatTime(londonParts(iso).time) : "");

/** True when the mark landed after the session's start on that date. */
export function isLate(markedAt: string, sessionDate: string | null | undefined, startTime: string | null | undefined): boolean {
  if (!sessionDate || !startTime) return false;
  const m = londonParts(markedAt);
  if (m.date !== sessionDate) return m.date > sessionDate;
  return m.time > startTime.slice(0, 5);
}

/** "2026-09-20" → "Sat 20 Sep". */
export const fmtDay = (dateStr: string | null | undefined): string =>
  dateStr ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }) : "";

/** "2026-09-20" → "Saturday 20 September". */
export const fmtLongDay = (dateStr: string | null | undefined): string =>
  dateStr ? new Date(dateStr + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : "";

/** "Today", "Tomorrow", "Yesterday" or the short day. */
export function relativeDay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const today = londonToday();
  if (dateStr === today) return "Today";
  const t = new Date(today + "T12:00:00");
  const d = new Date(dateStr + "T12:00:00");
  const diff = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return fmtDay(dateStr);
}
