// Per-session QR tickets: minting a code for one child at one session, and
// turning a scanned code back into a booking AND a session
// (docs/SESSION-TICKETS-SPEC.md).
//
// The point of the whole thing is that the coach never picks a session. A
// session ticket carries the session in the token; a legacy season ticket
// (public.tickets, one per booking, already in parents' inboxes) does not, so
// for those the session is worked out from the clock instead.
//
// The London helpers are here because every decision this file makes —
// which session is running, how long until the next one — is a wall-clock
// decision, and Deno runs in UTC.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface SessionTicketRow {
  id: string;
  booking_id: string;
  event_id: string;
  session_id: string | null;
  child_id: string | null;
  qr_token: string;
  status: string;
  reminder_12h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
}

export interface SessionRow {
  id: string;
  event_id: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  cancelled_at: string | null;
}

export const SESSION_TICKET_COLUMNS =
  "id, booking_id, event_id, session_id, child_id, qr_token, status, reminder_12h_sent_at, reminder_1h_sent_at";
export const SESSION_COLUMNS =
  "id, event_id, session_date, start_time, end_time, venue, cancelled_at";

// A session with no start_time still has to sit somewhere on the clock for
// the scan window; midday is what session-reports-dispatch assumes too.
const DEFAULT_START = "12:00";
// Assumed length of a session with no end_time.
const DEFAULT_DURATION_MS = 120 * 60 * 1000;
// How far either side of a session a scan still counts as that session: the
// queue starts before the hour and stragglers arrive after it has finished.
const SCAN_WINDOW_MS = 120 * 60 * 1000;

/** Minutes east of UTC that London keeps at the given instant (0 or 60). */
export function londonOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-]\d+)?/.exec(name);
  return m?.[1] ? Number(m[1]) * 60 : 0;
}

/** A London wall-clock date + time ("HH:MM[:SS]") as an instant. */
export function londonInstant(date: string, time: string): Date {
  const naive = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  return new Date(naive.getTime() - londonOffsetMinutes(naive) * 60 * 1000);
}

/** The London calendar date ("YYYY-MM-DD") an instant falls on. */
export function londonDateOf(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const clockLabel = (hours: number, minutes: number): string => {
  const suffix = hours >= 12 ? "pm" : "am";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${h12}${suffix}` : `${h12}.${String(minutes).padStart(2, "0")}${suffix}`;
};

/** "13:30:00" → "1.30pm", the house style for a time in copy. */
export function londonTimeLabel(time: string): string {
  const [hh, mm] = time.split(":");
  return clockLabel(Number(hh), Number(mm ?? 0));
}

/** The same label for an instant, read in London. */
export function londonClockLabel(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return clockLabel(get("hour"), get("minute"));
}

type SessionTimes = { session_date: string; start_time: string | null; end_time: string | null };

/** When a session starts, as an instant. */
export function sessionStart(s: SessionTimes): Date {
  return londonInstant(s.session_date, s.start_time ?? DEFAULT_START);
}

/** When a session ends, as an instant. */
export function sessionEnd(s: SessionTimes): Date {
  const start = sessionStart(s);
  if (!s.end_time) return new Date(start.getTime() + DEFAULT_DURATION_MS);
  // end_time is read against the same session_date, so a session running to
  // midnight or beyond would otherwise "end" the morning it started.
  const end = londonInstant(s.session_date, s.end_time);
  return end.getTime() > start.getTime() ? end : new Date(end.getTime() + 24 * 60 * 60 * 1000);
}

/** True when `now` is close enough to a session for a scan to count as it. */
export function withinScanWindow(s: SessionTimes, now: Date): boolean {
  return now.getTime() >= sessionStart(s).getTime() - SCAN_WINDOW_MS &&
    now.getTime() <= sessionEnd(s).getTime() + SCAN_WINDOW_MS;
}

/** Whole minutes from now until an instant; negative once it has passed. */
export function minutesUntil(instant: Date, now: Date = new Date()): number {
  return Math.round((instant.getTime() - now.getTime()) / 60000);
}

/** "2–4pm", or just the start when a session has no end time. */
export function timeRangeLabel(start_time: string | null, end_time: string | null): string | null {
  if (!start_time) return null;
  const from = londonTimeLabel(start_time);
  if (!end_time) return from;
  const to = londonTimeLabel(end_time);
  // "2–4pm" rather than "2pm–4pm" when both sit in the same half of the day.
  const sameSuffix = from.slice(-2) === to.slice(-2);
  return sameSuffix ? `${from.slice(0, -2)}–${to}` : `${from}–${to}`;
}

/** A scanner may be handed a pasted ticket URL rather than the bare token. */
export function normaliseToken(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.includes("/") ? trimmed.split("/").pop() ?? trimmed : trimmed;
}

/**
 * The ticket for one child at one session, creating it if this is the first
 * time anyone has asked (the reminder dispatcher, 12 hours out).
 *
 * Not a PostgREST upsert: uniqueness comes from two PARTIAL indexes
 * (session_id not null / session_id null) and ON CONFLICT can't infer a
 * partial index without its predicate, which PostgREST never sends — the same
 * reason upsertAttendance in _shared/reportEmails.ts is written this way. An
 * existing row is returned untouched: the token has already been emailed.
 */
export async function ensureSessionTicket(
  admin: SupabaseClient,
  args: {
    booking: { id: string; child_id?: string | null };
    event_id: string;
    session_id: string | null;
  },
): Promise<{ ticket: SessionTicketRow | null; created: boolean; error?: string }> {
  const findExisting = () => {
    let q = admin.from("session_tickets").select(SESSION_TICKET_COLUMNS).eq("booking_id", args.booking.id);
    q = args.session_id ? q.eq("session_id", args.session_id) : q.is("session_id", null);
    return q.maybeSingle();
  };

  const { data: existing } = await findExisting();
  if (existing) return { ticket: existing as SessionTicketRow, created: false };

  const { data: inserted, error } = await admin
    .from("session_tickets")
    .insert({
      booking_id: args.booking.id,
      event_id: args.event_id,
      session_id: args.session_id,
      child_id: args.booking.child_id ?? null,
    })
    .select(SESSION_TICKET_COLUMNS)
    .single();
  if (!error) return { ticket: inserted as SessionTicketRow, created: true };

  if (error.code === "23505") {
    const { data: raced } = await findExisting();
    if (raced) return { ticket: raced as SessionTicketRow, created: false };
  }
  return { ticket: null, created: false, error: error.message };
}

export type ResolvedFrom = "qr" | "clock" | "hint";

export interface ScanTarget {
  /**
   * `resolved` still covers a session-less event, where `session` is null.
   * `wrong_session` is a real code for a session that is not happening now —
   * last week's reminder email, or a cancelled session.
   */
  outcome: "resolved" | "no_session" | "wrong_session" | "unknown";
  booking_id: string | null;
  event_id: string | null;
  session: SessionRow | null;
  resolved_from: ResolvedFrom | null;
  scope: "session" | "season" | null;
  /** Void checks read the status of whichever code was actually scanned. */
  status: string | null;
  /** The booking's season ticket, which ticket_scans rows must point at. */
  legacy_ticket_id: string | null;
}

const NOT_FOUND: ScanTarget = {
  outcome: "unknown", booking_id: null, event_id: null, session: null,
  resolved_from: null, scope: null, status: null, legacy_ticket_id: null,
};

/**
 * Turn a scanned token into a booking and (where there is one) a session.
 *
 * 1. A session ticket answers both questions outright.
 * 2. A season ticket answers only the booking, so the session comes from the
 *    clock: the event's uncancelled session whose window spans now, nearest
 *    start first. An event with no session rows at all is a one-off day and a
 *    null session is the right answer, not a failure.
 * 3. Failing that, the caller's open register is used as a hint — it is only
 *    ever a hint now, never the authority.
 */
export async function resolveScanTarget(
  admin: SupabaseClient,
  args: { token: string; hintSessionId?: string | null; now?: Date },
): Promise<ScanTarget> {
  const token = normaliseToken(args.token);
  const now = args.now ?? new Date();

  const { data: sessionTicket } = await admin
    .from("session_tickets")
    .select(SESSION_TICKET_COLUMNS)
    .eq("qr_token", token)
    .maybeSingle();

  if (sessionTicket) {
    const st = sessionTicket as SessionTicketRow;
    const session = st.session_id ? await loadSession(admin, st.session_id) : null;
    // A code names one session, so it only admits at that session. Without
    // this, last week's reminder email would mark the child arrived on last
    // week's register, overwriting the absence End session recorded.
    const stale = !!session && (!!session.cancelled_at || !withinScanWindow(session, now));
    return {
      outcome: stale ? "wrong_session" : "resolved",
      booking_id: st.booking_id,
      event_id: st.event_id,
      session,
      resolved_from: "qr",
      scope: "session",
      status: st.status,
      legacy_ticket_id: await legacyTicketId(admin, st.booking_id),
    };
  }

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, status, event_id, booking_id")
    .eq("qr_token", token)
    .maybeSingle();
  if (!ticket) return NOT_FOUND;

  const base = {
    booking_id: ticket.booking_id as string,
    event_id: ticket.event_id as string,
    scope: "season" as const,
    status: ticket.status as string,
    legacy_ticket_id: ticket.id as string,
  };

  const { data: sessions } = await admin
    .from("event_sessions")
    .select(SESSION_COLUMNS)
    .eq("event_id", ticket.event_id)
    .order("session_date")
    .order("start_time", { nullsFirst: true });
  const all = (sessions ?? []) as SessionRow[];

  if (all.length === 0) {
    return { ...base, outcome: "resolved", session: null, resolved_from: "clock" };
  }

  // A session actually under way beats one merely inside the grace window,
  // which matters on a Saturday of back-to-back age groups where every
  // session's window covers its neighbours. Ties break on the earlier start
  // so two sessions on one date never resolve arbitrarily.
  const byNearestStart = (a: SessionRow, b: SessionRow) =>
    Math.abs(sessionStart(a).getTime() - now.getTime()) - Math.abs(sessionStart(b).getTime() - now.getTime()) ||
    sessionStart(a).getTime() - sessionStart(b).getTime();
  const live = all.filter((s) => !s.cancelled_at);
  const inProgress = live
    .filter((s) => now >= sessionStart(s) && now <= sessionEnd(s))
    .sort(byNearestStart);
  const nearby = live.filter((s) => withinScanWindow(s, now)).sort(byNearestStart);
  const running = inProgress.length > 0 ? inProgress : nearby;
  if (running.length > 0) {
    return { ...base, outcome: "resolved", session: running[0], resolved_from: "clock" };
  }

  const hinted = args.hintSessionId
    ? all.find((s) => s.id === args.hintSessionId) ?? null
    : null;
  if (hinted) {
    return { ...base, outcome: "resolved", session: hinted, resolved_from: "hint" };
  }

  return { ...base, outcome: "no_session", session: null, resolved_from: null };
}

async function loadSession(admin: SupabaseClient, sessionId: string): Promise<SessionRow | null> {
  const { data } = await admin
    .from("event_sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  return (data as SessionRow | null) ?? null;
}

async function legacyTicketId(admin: SupabaseClient, bookingId: string): Promise<string | null> {
  const { data } = await admin
    .from("tickets").select("id").eq("booking_id", bookingId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}
