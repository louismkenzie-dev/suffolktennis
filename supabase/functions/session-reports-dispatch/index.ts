// Session report dispatcher, run every 10 minutes by pg_cron
// (docs/REGISTERS-SPEC.md, "session-reports-dispatch").
//
// End session sends a coach's reports straight away, but a coach who forgets
// the button — or finishes a report on the train home, or a week later —
// still has parents waiting. So: everything still due (a complete report
// with sent_at null, an absence not yet notified) whose session ended at
// least two hours ago is sent from here. Sending is claim-before-send in
// _shared/reportEmails.ts, so this and End session can never both email the
// same row.
//
// The work list is driven by what is pending, not by the calendar, so a
// report written for last month's session still goes out on the next run.
//
// Guard-token protected — it is called by the database, not by users.
import { serviceClient, json } from "../_shared/adminAuth.ts";
import { sendDueForSession } from "../_shared/reportEmails.ts";

const GUARD = "sr_9b2e7c1d4f8a3e6b0c5d7f2a9e1b4c8d";

// How long after a session ends before anything unsent goes automatically.
const GRACE_MS = 120 * 60 * 1000;
// A session with no end_time is assumed to run this long from its start;
// with no start_time either, it is assumed to start at midday.
const DEFAULT_DURATION_MS = 120 * 60 * 1000;
const DEFAULT_START = "12:00";
// Emails are spaced 600 ms apart, so cap a run well inside the function's
// wall-clock limit; the next run picks up whatever is left.
const MAX_SENDS_PER_RUN = 80;

/** Minutes east of UTC that London keeps at the given instant (0 or 60). */
function londonOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "shortOffset" })
    .formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = /GMT([+-]\d+)?/.exec(name);
  return m?.[1] ? Number(m[1]) * 60 : 0;
}

/** A London wall-clock date + time ("HH:MM[:SS]") as an instant. */
function londonInstant(date: string, time: string): Date {
  const naive = new Date(`${date}T${time.slice(0, 5)}:00Z`);
  return new Date(naive.getTime() - londonOffsetMinutes(naive) * 60 * 1000);
}

/** When a session's register can be considered closed. */
function sessionEnd(s: { session_date: string; start_time: string | null; end_time: string | null }): Date {
  if (s.end_time) return londonInstant(s.session_date, s.end_time);
  return new Date(londonInstant(s.session_date, s.start_time ?? DEFAULT_START).getTime() + DEFAULT_DURATION_MS);
}

type Target = { event_id: string; session_id: string | null };
const keyOf = (t: Target) => `${t.event_id}:${t.session_id ?? ""}`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { guard?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const admin = serviceClient();
  const errors: string[] = [];

  // 1. Everything that still needs sending, grouped by session.
  const [{ data: pendingReports, error: reportsErr }, { data: pendingAbsences, error: absencesErr }] = await Promise.all([
    admin.from("session_reports").select("event_id, session_id").eq("complete", true).is("sent_at", null),
    admin.from("session_attendance").select("event_id, session_id").eq("status", "absent").is("absence_notified_at", null),
  ]);
  if (reportsErr) errors.push(`reports lookup: ${reportsErr.message}`);
  if (absencesErr) errors.push(`absences lookup: ${absencesErr.message}`);

  const targets = new Map<string, Target>();
  for (const r of [...(pendingReports ?? []), ...(pendingAbsences ?? [])]) {
    const t = { event_id: r.event_id as string, session_id: (r.session_id as string | null) ?? null };
    targets.set(keyOf(t), t);
  }
  if (targets.size === 0) {
    return json({ checked: 0, sessions_due: 0, events_due: 0, reports_sent: 0, absence_emails: 0, errors });
  }

  // 2. Which of those sessions / events ended at least GRACE ago.
  const cutoff = Date.now() - GRACE_MS;
  const sessionIds = [...targets.values()].map((t) => t.session_id).filter(Boolean) as string[];
  const eventOnlyIds = [...targets.values()].filter((t) => !t.session_id).map((t) => t.event_id);

  const dueSessions: Target[] = [];
  if (sessionIds.length > 0) {
    const { data: sessions, error } = await admin
      .from("event_sessions")
      .select("id, event_id, session_date, start_time, end_time, cancelled_at")
      .in("id", sessionIds);
    if (error) errors.push(`sessions lookup: ${error.message}`);
    for (const s of sessions ?? []) {
      if (s.cancelled_at) continue;
      if (sessionEnd(s).getTime() <= cutoff) dueSessions.push({ event_id: s.event_id, session_id: s.id });
    }
  }

  // Session-less events: event_date + the default duration counts as the end.
  const dueEvents: Target[] = [];
  if (eventOnlyIds.length > 0) {
    const { data: events, error } = await admin
      .from("events")
      .select("id, event_date, cancelled_at, register_closed_at")
      .in("id", eventOnlyIds);
    if (error) errors.push(`events lookup: ${error.message}`);
    for (const e of events ?? []) {
      if (e.cancelled_at) continue;
      const closed = e.register_closed_at ? new Date(e.register_closed_at).getTime() : null;
      const ended = e.event_date ? new Date(e.event_date).getTime() + DEFAULT_DURATION_MS : null;
      const end = closed ?? ended;
      if (end !== null && end <= cutoff) dueEvents.push({ event_id: e.id, session_id: null });
    }
  }

  // 3. Send, bounded per run.
  let reports_sent = 0;
  let absence_emails = 0;
  let truncated = false;
  for (const t of [...dueSessions, ...dueEvents]) {
    if (reports_sent + absence_emails >= MAX_SENDS_PER_RUN) { truncated = true; break; }
    const res = await sendDueForSession(admin, t);
    reports_sent += res.reports_sent;
    absence_emails += res.absence_emails;
    const label = t.session_id ? `session ${t.session_id}` : `event ${t.event_id}`;
    errors.push(...res.errors.map((e) => `${label}: ${e}`));
  }

  return json({
    checked: targets.size,
    sessions_due: dueSessions.length,
    events_due: dueEvents.length,
    reports_sent,
    absence_emails,
    truncated,
    errors,
  });
});
