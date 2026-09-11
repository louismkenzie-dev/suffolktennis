// Session reminders, run every 10 minutes by pg_cron
// (docs/SESSION-TICKETS-SPEC.md, "session-reminders").
//
// Two emails per child per session — 12 hours out and 1 hour out — each with
// a button to that session's QR code. This is also where session_tickets rows
// are minted: lazily, half a day before the session, so a 30-week programme
// does not sit on thousands of codes nobody has asked for.
//
// Sending is claim-before-send: the reminder column is stamped first and only
// where it is still null, so two overlapping runs can't both email, and the
// stamp is cleared if Resend throws. Same rule as _shared/reportEmails.ts.
//
// Guard-token protected — it is called by the database, not by users.
import { serviceClient, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";
import { esc, firstName, longDate } from "../_shared/reportEmails.ts";
import {
  ensureSessionTicket,
  londonClockLabel,
  londonDateOf,
  minutesUntil,
  sessionStart,
  timeRangeLabel,
  type SessionTicketRow,
} from "../_shared/sessionTickets.ts";

// Overridable by a secret so the token can be rotated without a deploy; the
// literal is the value the cron job posts today.
const GUARD = Deno.env.get("CRON_GUARD_TOKEN") ?? "st_7c4e9a1f6b2d8e3a5c0f9b4d7e1a6c2f";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

// 12h45m: the run happens every 10 minutes, so the window has to be wider
// than 12 hours for every session to be caught exactly once.
const HORIZON_MINUTES = 765;
const ONE_HOUR_WINDOW = { min: 0, max: 75 };
// Starts above the 1-hour window, not at 60: `starts_in` only ever falls, so
// a ticket that has had its 1-hour email can never re-enter this one and send
// "your session is tomorrow" ten minutes after "starts at 10.12am".
const TWELVE_HOUR_WINDOW = { min: ONE_HOUR_WINDOW.max + 1, max: HORIZON_MINUTES };
// Resend allows 2 requests a second; space sends like reportEmails.ts does.
const SEND_GAP_MS = 600;
const MAX_SENDS_PER_RUN = 80;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Due = {
  event_id: string;
  session_id: string | null;
  starts_in: number;
  /** London date of the start, for "today" vs "tomorrow" in the subject. */
  date: string;
  time_label: string;
  range: string | null;
  venue: string | null;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { guard?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const admin = serviceClient();
  const now = new Date();
  const errors: string[] = [];

  // 1. Sessions starting inside the horizon. The date filter is London dates
  // (session_date is a bare date), the minute test is the real clock.
  const horizon = new Date(now.getTime() + HORIZON_MINUTES * 60 * 1000);
  const { data: sessionRows, error: sessionsErr } = await admin
    .from("event_sessions")
    .select("id, event_id, session_date, start_time, end_time, venue")
    .gte("session_date", londonDateOf(now))
    .lte("session_date", londonDateOf(horizon))
    .is("cancelled_at", null)
    // A session with no start time has no "starts in an hour" to remind
    // against, and guessing one would put a wrong time in the subject line.
    .not("start_time", "is", null);
  if (sessionsErr) errors.push(`sessions lookup: ${sessionsErr.message}`);

  const due: Due[] = [];
  for (const s of sessionRows ?? []) {
    const startsIn = minutesUntil(sessionStart(s), now);
    if (startsIn < ONE_HOUR_WINDOW.min || startsIn > HORIZON_MINUTES) continue;
    due.push({
      event_id: s.event_id,
      session_id: s.id,
      starts_in: startsIn,
      date: s.session_date,
      time_label: londonClockLabel(sessionStart(s)),
      range: timeRangeLabel(s.start_time, s.end_time),
      venue: s.venue,
    });
  }

  // 2. One-off events with no session rows: the event itself is the occasion,
  // and its booking gets the single session-less ticket.
  const { data: eventRows, error: eventsErr } = await admin
    .from("events")
    .select("id, title, location, event_date")
    .is("cancelled_at", null)
    .gte("event_date", now.toISOString())
    .lte("event_date", horizon.toISOString());
  if (eventsErr) errors.push(`events lookup: ${eventsErr.message}`);

  const candidateEventIds = (eventRows ?? []).map((e) => e.id);
  if (candidateEventIds.length > 0) {
    const { data: owned } = await admin
      .from("event_sessions").select("event_id").in("event_id", candidateEventIds);
    const hasSessions = new Set((owned ?? []).map((r) => r.event_id));
    for (const e of eventRows ?? []) {
      if (hasSessions.has(e.id)) continue;
      const start = new Date(e.event_date);
      due.push({
        event_id: e.id,
        session_id: null,
        starts_in: minutesUntil(start, now),
        date: londonDateOf(start),
        time_label: londonClockLabel(start),
        range: londonClockLabel(start),
        venue: e.location ?? null,
      });
    }
  }

  if (due.length === 0) {
    return json({ sessions_due: 0, tickets_created: 0, reminders_12h: 0, reminders_1h: 0, truncated: false, errors });
  }

  // Event titles for the copy — the session query only knows event ids.
  const eventIds = [...new Set(due.map((d) => d.event_id))];
  const { data: events } = await admin
    .from("events").select("id, title, location, cancelled_at").in("id", eventIds);
  const eventById = new Map((events ?? []).map((e) => [e.id as string, e]));

  let tickets_created = 0;
  let reminders_12h = 0;
  let reminders_1h = 0;
  let truncated = false;

  for (const d of due) {
    if (reminders_12h + reminders_1h >= MAX_SENDS_PER_RUN) { truncated = true; break; }
    const event = eventById.get(d.event_id);
    // A cancelled event's parents have already had the cancellation email.
    if (!event || event.cancelled_at) continue;

    const { data: bookings, error: bookingsErr } = await admin
      .from("bookings")
      .select("id, child_id, child_name, parent_name, parent_email")
      .eq("event_id", d.event_id)
      .eq("status", "paid");
    if (bookingsErr) {
      errors.push(`bookings for event ${d.event_id}: ${bookingsErr.message}`);
      continue;
    }

    for (const b of bookings ?? []) {
      const { ticket, created, error } = await ensureSessionTicket(admin, {
        booking: b, event_id: d.event_id, session_id: d.session_id,
      });
      if (error || !ticket) {
        errors.push(`ticket for booking ${b.id}: ${error ?? "not created"}`);
        continue;
      }
      if (created) tickets_created += 1;
      if (ticket.status === "void") continue;
      if (!b.parent_email) continue;

      // The windows do not overlap, so a booking paid an hour before its
      // session gets the 1-hour note only — never both.
      const kind: "1h" | "12h" | null =
        d.starts_in >= ONE_HOUR_WINDOW.min && d.starts_in <= ONE_HOUR_WINDOW.max && !ticket.reminder_1h_sent_at
          ? "1h"
          : d.starts_in >= TWELVE_HOUR_WINDOW.min && d.starts_in <= TWELVE_HOUR_WINDOW.max && !ticket.reminder_12h_sent_at
          ? "12h"
          : null;
      if (!kind) continue;

      if (reminders_12h + reminders_1h >= MAX_SENDS_PER_RUN) { truncated = true; break; }

      const res = await sendReminder(admin, {
        kind,
        ticket,
        booking: b,
        occasion: d,
        event_title: event.title ?? "Suffolk Tennis",
        now,
      });
      if (res.sent) {
        if (kind === "1h") reminders_1h += 1; else reminders_12h += 1;
        await pause(SEND_GAP_MS);
      } else if (res.error) {
        errors.push(`${kind} reminder for ticket ${ticket.id}: ${res.error}`);
      }
    }
  }

  return json({ sessions_due: due.length, tickets_created, reminders_12h, reminders_1h, truncated, errors });
});

/** Claim the reminder column, send, and release the claim if Resend throws. */
async function sendReminder(
  admin: ReturnType<typeof serviceClient>,
  args: {
    kind: "12h" | "1h";
    ticket: SessionTicketRow;
    booking: { child_name: string | null; parent_name: string | null; parent_email: string };
    occasion: Due;
    event_title: string;
    now: Date;
  },
): Promise<{ sent: boolean; error?: string }> {
  const { kind, ticket, booking, occasion, event_title } = args;
  const column = kind === "12h" ? "reminder_12h_sent_at" : "reminder_1h_sent_at";

  // Check the key before claiming so a misconfigured project leaves tickets
  // unstamped and therefore still due once the secret is set.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return { sent: false, error: "RESEND_API_KEY not configured" };

  // Claiming the 1-hour column also burns the 12-hour one: a ticket minted
  // this late has missed that email, and it must not arrive afterwards.
  const stamp = new Date().toISOString();
  const claim = kind === "1h"
    ? { reminder_1h_sent_at: stamp, reminder_12h_sent_at: ticket.reminder_12h_sent_at ?? stamp }
    : { reminder_12h_sent_at: stamp };
  const { data: claimed } = await admin
    .from("session_tickets")
    .update(claim)
    .eq("id", ticket.id)
    .is(column, null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { sent: false };

  const child = firstName(booking.child_name, "your child");
  const parent = firstName(booking.parent_name, "there");
  const today = occasion.date === londonDateOf(args.now);
  const subject = kind === "1h"
    ? `${child}'s session starts at ${occasion.time_label}`
    : `${child}'s tennis session ${today ? "today" : "tomorrow"}`;

  const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "reminder");
  const when = longDate(occasion.date);

  try {
    await sendEmail({
      to: booking.parent_email,
      subject,
      unsubscribe_token: unsubToken ?? undefined,
      idempotency_key: `reminder-${kind}-${ticket.id}`,
      html: brandedEmail({
        unsubscribeUrl: unsubscribeUrlFor(unsubToken),
        title: kind === "1h" ? `${esc(child)} is on court soon` : `${esc(child)}'s next session`,
        preheader: `${esc(event_title)}${when ? ` · ${esc(when)}` : ""}${occasion.range ? ` · ${esc(occasion.range)}` : ""}`,
        body:
          emailParagraph(`Hi ${esc(parent)},`) +
          emailParagraph(
            kind === "1h"
              ? `<strong>${esc(child)}</strong>'s session at <strong>${esc(event_title)}</strong> starts at <strong>${esc(occasion.time_label)}</strong>.`
              : `A quick reminder that <strong>${esc(child)}</strong> has <strong>${esc(event_title)}</strong> ${today ? "later today" : "tomorrow"}.`,
          ) +
          emailDetails([
            ["Session", esc(event_title)],
            ["Date", when ? esc(when) : ""],
            ["Time", occasion.range ? esc(occasion.range) : ""],
            ["Venue", occasion.venue ? esc(occasion.venue) : ""],
          ]) +
          emailButton(`${SITE_URL}/ticket/${ticket.qr_token}`, "Show entry QR code") +
          emailNote("This code is for this session only — the coach scans it as you arrive, and it marks " + esc(child) + " in on the register."),
      }),
    }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
  } catch (e) {
    await admin.from("session_tickets").update({ [column]: null }).eq("id", ticket.id);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
  return { sent: true };
}
