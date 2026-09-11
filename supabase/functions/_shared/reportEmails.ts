// Registers and session reports: the parent-facing emails and the attendance
// write that `coach-session`, `scan-ticket` and `session-reports-dispatch`
// all share, so the three code paths cannot drift apart.
//
// Sending is claim-before-send. The stamp column (session_reports.sent_at /
// session_attendance.absence_notified_at) is written FIRST, and only where it
// is still null, so two callers racing for the same row — End session and
// the 10-minute dispatcher, say — can't both send. If Resend fails the stamp
// is cleared so the next attempt retries. This is the same pattern as
// `notify_report` / `notified_at`, kept identical on purpose.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "./resend.ts";
import { brandedEmail, emailButton, emailNote, emailParagraph } from "./emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "./emailPrefs.ts";

const SITE_URL = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

// Resend's default limit is 2 requests/second; a register of 12 sends two
// emails each at End session, so space the sends out rather than fan out.
const SEND_GAP_MS = 600;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SendStatus = "sent" | "already_sent" | "skipped" | "failed";
export interface SendResult {
  ok: boolean;
  status: SendStatus;
  error?: string;
}

/** Names come from booking forms — keep a stray "<" from breaking the HTML. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export const firstName = (full: string | null | undefined, fallback: string): string => {
  const first = (full ?? "").trim().split(/\s+/)[0];
  return first || fallback;
};

/** "Saturday 12 September 2026" in London time. Accepts a date-only string or a timestamp. */
export function longDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // A bare date would otherwise be parsed as UTC midnight and could roll back
  // a day when formatted in BST; anchor it at midday instead.
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric",
  }).format(d);
}

/** The date a session (or a session-less event) happened, for email copy. */
async function occasionDate(
  admin: SupabaseClient,
  eventId: string,
  sessionId: string | null,
): Promise<{ title: string; date: string | null }> {
  const { data: ev } = await admin
    .from("events").select("title, event_date").eq("id", eventId).maybeSingle();
  let date: string | null = ev?.event_date ?? null;
  if (sessionId) {
    const { data: s } = await admin
      .from("event_sessions").select("session_date").eq("id", sessionId).maybeSingle();
    if (s?.session_date) date = s.session_date;
  }
  return { title: ev?.title ?? "Suffolk Tennis", date: longDate(date) };
}

/**
 * Write a child's attendance for a session (or for a session-less event when
 * session_id is null). One row per booking per session, so an existing row is
 * updated in place — a scan after a manual "absent" flips it to arrived.
 *
 * Not a PostgREST upsert: the uniqueness comes from two PARTIAL indexes
 * (session_id not null / session_id null) and ON CONFLICT can't infer a
 * partial index without its predicate, which PostgREST never sends. So:
 * find, update or insert, and if a concurrent insert wins the race (23505)
 * update the row it created.
 */
export async function upsertAttendance(
  admin: SupabaseClient,
  row: {
    booking_id: string;
    event_id: string;
    session_id: string | null;
    child_id: string | null;
    status: "arrived" | "absent";
    source: "scan" | "manual" | "auto";
    marked_by: string | null;
  },
  opts: { onlyIfMissing?: boolean } = {},
): Promise<{ attendance: Record<string, unknown> | null; created: boolean; error?: string }> {
  const findExisting = () => {
    let q = admin.from("session_attendance").select("id").eq("booking_id", row.booking_id);
    q = row.session_id ? q.eq("session_id", row.session_id) : q.is("session_id", null);
    return q.maybeSingle();
  };
  const patch = {
    status: row.status,
    source: row.source,
    marked_at: new Date().toISOString(),
    marked_by: row.marked_by,
  };
  const update = async (id: string) => {
    const { data, error } = await admin
      .from("session_attendance").update(patch).eq("id", id).select("*").single();
    return { attendance: data as Record<string, unknown> | null, created: false, error: error?.message };
  };

  const { data: existing } = await findExisting();
  if (existing) {
    if (opts.onlyIfMissing) {
      return { attendance: null, created: false };
    }
    return update(existing.id);
  }

  const { data: inserted, error } = await admin
    .from("session_attendance")
    .insert({ ...row, ...patch })
    .select("*")
    .single();
  if (!error) return { attendance: inserted as Record<string, unknown>, created: true };
  if (error.code === "23505") {
    const { data: raced } = await findExisting();
    if (raced) {
      return opts.onlyIfMissing ? { attendance: null, created: false } : update(raced.id);
    }
  }
  return { attendance: null, created: false, error: error.message };
}

/**
 * Email the parent that a session report is ready. Sends only complete
 * reports and only once (claim on sent_at). Editing after send does not
 * re-email — the parent page shows "Updated" instead.
 */
export async function sendReportReadyEmail(admin: SupabaseClient, reportId: string): Promise<SendResult> {
  const { data: report } = await admin
    .from("session_reports")
    .select("id, booking_id, event_id, session_id, child_name, coach_name, complete, sent_at")
    .eq("id", reportId)
    .maybeSingle();
  if (!report) return { ok: false, status: "failed", error: `Report ${reportId} not found` };
  if (!report.complete) return { ok: false, status: "skipped", error: "Report is not complete" };
  if (report.sent_at) return { ok: true, status: "already_sent" };

  // Check the key before claiming so a misconfigured project leaves rows
  // unstamped and therefore still due once the secret is set.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, status: "failed", error: "RESEND_API_KEY not configured" };

  const { data: claimed } = await admin
    .from("session_reports")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", report.id)
    .is("sent_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true, status: "already_sent" };

  const release = () => admin.from("session_reports").update({ sent_at: null }).eq("id", report.id);

  const { data: booking } = await admin
    .from("bookings")
    .select("parent_email, parent_name")
    .eq("id", report.booking_id)
    .maybeSingle();
  if (!booking?.parent_email) {
    await release();
    return { ok: false, status: "failed", error: `No parent email on booking for report ${report.id}` };
  }

  const { title, date } = await occasionDate(admin, report.event_id, report.session_id ?? null);
  const child = firstName(report.child_name, "your child");
  const parent = firstName(booking.parent_name, "there");
  const coach = report.coach_name?.trim() || "Their coach";
  const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "report");

  try {
    await sendEmail({
      to: booking.parent_email,
      subject: `${child}'s session performance report is ready!`,
      unsubscribe_token: unsubToken ?? undefined,
      idempotency_key: `report-sent-${report.id}`,
      html: brandedEmail({
        unsubscribeUrl: unsubscribeUrlFor(unsubToken),
        title: `${esc(child)}'s session report`,
        preheader: `${esc(coach)} has written up ${esc(child)}'s session at ${esc(title)}`,
        body:
          emailParagraph(`Hi ${esc(parent)},`) +
          emailParagraph(
            `${esc(coach)} has written up <strong>${esc(child)}</strong>'s session at <strong>${esc(title)}</strong>` +
            (date ? ` on ${esc(date)}` : "") + ".",
          ) +
          emailButton(`${SITE_URL()}/report/${report.id}`, "View report") +
          emailNote("Every session report is kept in your Parent Hub under your child's profile, so you can look back over the season."),
      }),
    }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
  } catch (e) {
    await release();
    return { ok: false, status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, status: "sent" };
}

/**
 * Short, warm note to a parent whose child was marked absent. Once per
 * attendance row (claim on absence_notified_at).
 */
export async function sendAbsenceEmail(admin: SupabaseClient, attendanceId: string): Promise<SendResult> {
  const { data: att } = await admin
    .from("session_attendance")
    .select("id, booking_id, event_id, session_id, status, absence_notified_at")
    .eq("id", attendanceId)
    .maybeSingle();
  if (!att) return { ok: false, status: "failed", error: `Attendance ${attendanceId} not found` };
  if (att.status !== "absent") return { ok: false, status: "skipped", error: "Not marked absent" };
  if (att.absence_notified_at) return { ok: true, status: "already_sent" };

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { ok: false, status: "failed", error: "RESEND_API_KEY not configured" };

  const { data: claimed } = await admin
    .from("session_attendance")
    .update({ absence_notified_at: new Date().toISOString() })
    .eq("id", att.id)
    .is("absence_notified_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true, status: "already_sent" };

  const release = () =>
    admin.from("session_attendance").update({ absence_notified_at: null }).eq("id", att.id);

  const { data: booking } = await admin
    .from("bookings")
    .select("parent_email, parent_name, child_name")
    .eq("id", att.booking_id)
    .maybeSingle();
  if (!booking?.parent_email) {
    await release();
    return { ok: false, status: "failed", error: `No parent email on booking for attendance ${att.id}` };
  }

  const { title, date } = await occasionDate(admin, att.event_id, att.session_id ?? null);
  const child = firstName(booking.child_name, "your child");
  const parent = firstName(booking.parent_name, "there");
  const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "report");

  try {
    await sendEmail({
      to: booking.parent_email,
      subject: `We missed ${child} today`,
      unsubscribe_token: unsubToken ?? undefined,
      // Keyed on the booking and session, not the row: a cleared-then-re-marked
      // absence gets a new row id but must not email the parent twice.
      idempotency_key: `absence-${att.booking_id}-${att.session_id ?? att.event_id}`,
      html: brandedEmail({
        unsubscribeUrl: unsubscribeUrlFor(unsubToken),
        title: `We missed ${esc(child)} today`,
        preheader: `${esc(child)} was marked absent from ${esc(title)}`,
        body:
          emailParagraph(`Hi ${esc(parent)},`) +
          emailParagraph(
            `Just a quick note to say <strong>${esc(child)}</strong> was marked absent from <strong>${esc(title)}</strong>` +
            (date ? ` on ${esc(date)}` : "") + ". We hope everything is okay and look forward to seeing them next time.",
          ) +
          emailParagraph("If that's not right — they were there, or you'd let us know in advance — just reply to this email and we'll put it straight."),
      }),
    }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
  } catch (e) {
    await release();
    return { ok: false, status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
  return { ok: true, status: "sent" };
}

/**
 * Send everything still due for one session (session_id null = the
 * session-less event itself): every complete report with sent_at null, from
 * any coach, and every absent row not yet notified. Used by End session and
 * by the 10-minute dispatcher, so a report the coach finished after the
 * button was pressed still reaches the parent.
 */
export async function sendDueForSession(
  admin: SupabaseClient,
  target: { event_id: string; session_id: string | null },
): Promise<{ reports_sent: number; absence_emails: number; errors: string[] }> {
  const errors: string[] = [];
  let reports_sent = 0;
  let absence_emails = 0;

  let reportQuery = admin
    .from("session_reports")
    .select("id")
    .eq("event_id", target.event_id)
    .eq("complete", true)
    .is("sent_at", null);
  reportQuery = target.session_id
    ? reportQuery.eq("session_id", target.session_id)
    : reportQuery.is("session_id", null);
  const { data: reports, error: reportsErr } = await reportQuery;
  if (reportsErr) errors.push(`reports lookup: ${reportsErr.message}`);

  for (const r of reports ?? []) {
    const res = await sendReportReadyEmail(admin, r.id);
    if (res.status === "sent") reports_sent += 1;
    else if (res.status === "failed") errors.push(`report ${r.id}: ${res.error}`);
    await pause(SEND_GAP_MS);
  }

  let absentQuery = admin
    .from("session_attendance")
    .select("id")
    .eq("event_id", target.event_id)
    .eq("status", "absent")
    .is("absence_notified_at", null);
  absentQuery = target.session_id
    ? absentQuery.eq("session_id", target.session_id)
    : absentQuery.is("session_id", null);
  const { data: absences, error: absencesErr } = await absentQuery;
  if (absencesErr) errors.push(`absences lookup: ${absencesErr.message}`);

  for (const a of absences ?? []) {
    const res = await sendAbsenceEmail(admin, a.id);
    if (res.status === "sent") absence_emails += 1;
    else if (res.status === "failed") errors.push(`absence ${a.id}: ${res.error}`);
    await pause(SEND_GAP_MS);
  }

  return { reports_sent, absence_emails, errors };
}
