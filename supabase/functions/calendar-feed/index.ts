// A live calendar subscription for one booking's sessions.
//
// The ticket page has always offered "add to Google / Outlook", which copies
// a single session into the parent's calendar and then knows nothing more: a
// session that later moves venue or date stays wrong in their diary forever,
// and a programme with eleven dates means eleven separate taps.
//
// A parent asked for a subscription instead (Gillian, 17 Sep 2026). This is
// it: one URL per booking, served as iCalendar, which Google, Outlook and
// Apple poll on their own schedule. Every session is an event; move one and
// it moves in their diary; cancel one and it shows as cancelled.
//
// Authorized exactly as the ticket page is — by the booking's qr_token, which
// is unguessable and only ever reaches the person who paid. Calendar clients
// send no headers of their own, so the token travels in the query string and
// verify_jwt is off.
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

/** RFC 5545 text escaping: backslash, semicolon, comma and newlines. */
const esc = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/**
 * Content lines are limited to 75 octets, continued with CRLF + one space.
 * Folding by characters would split a multi-byte character across the break,
 * so measure in UTF-8 bytes.
 */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // 74 leaves room for the leading space on continuation lines.
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  if (current) out.push(current);
  return out.join("\r\n ");
}

/**
 * Sessions are stored as a local date and a local time; the calendar needs an
 * instant. Ask the runtime what Europe/London was doing at that moment rather
 * than assuming, so a session in February and one in July are both right.
 */
function londonOffsetMinutes(at: Date): number {
  const label = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    timeZoneName: "longOffset",
  }).format(at);
  const m = label.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

function londonToUtc(date: string, time: string | null, fallback: string): Date {
  const hhmm = (time ?? fallback).slice(0, 5);
  const naive = new Date(`${date}T${hhmm}:00Z`);
  return new Date(naive.getTime() - londonOffsetMinutes(naive) * 60_000);
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }
  const token = new URL(req.url).searchParams.get("t")?.trim();
  if (!token || token.length < 8 || token.length > 128) {
    return new Response("Not found", { status: 404 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, booking_id, event_id, status")
    .eq("qr_token", token)
    .maybeSingle();
  if (!ticket) return new Response("Not found", { status: 404 });

  const [{ data: booking }, { data: event }, { data: sessions }] = await Promise.all([
    admin.from("bookings").select("child_name, status, session_slot").eq("id", ticket.booking_id).maybeSingle(),
    admin.from("events").select("title, location, event_date, cancelled_at, programme_type").eq("id", ticket.event_id).maybeSingle(),
    admin.from("event_sessions")
      .select("id, session_date, start_time, end_time, venue, cancelled_at, moved_at, created_at, notes")
      .eq("event_id", ticket.event_id)
      .order("session_date"),
  ]);
  if (!booking || !event) return new Response("Not found", { status: 404 });

  const now = new Date();
  const child = (booking.child_name ?? "").trim();
  const calName = child ? `${event.title} — ${child}` : event.title;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Suffolk Tennis Partnership//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calName)}`,
    "X-WR-TIMEZONE:Europe/London",
    // How often a subscriber should come back. Both spellings are needed:
    // Apple reads the X- one, everyone else the standard property.
    "REFRESH-INTERVAL;VALUE=DURATION:PT12H",
    "X-PUBLISHED-TTL:PT12H",
  ];

  // A programme with no dated sessions still deserves one entry, so a parent
  // who subscribes to a single-date event sees something.
  const rows = (sessions ?? []).length > 0
    ? sessions!
    : event.event_date
      ? [{
        id: ticket.event_id,
        session_date: String(event.event_date).slice(0, 10),
        start_time: String(event.event_date).slice(11, 16) || null,
        end_time: null,
        venue: event.location,
        cancelled_at: null,
        moved_at: null,
        created_at: null,
        notes: null,
      }]
      : [];

  for (const s of rows) {
    const start = londonToUtc(s.session_date, s.start_time, "09:00");
    const end = s.end_time
      ? londonToUtc(s.session_date, s.end_time, "11:00")
      : new Date(start.getTime() + 2 * 60 * 60 * 1000);
    // A moved session must not arrive as a second event, so the id stays put
    // and the sequence number moves instead.
    const changedAt = s.moved_at ?? s.created_at ?? null;
    const sequence = changedAt ? Math.floor(new Date(changedAt).getTime() / 1000) : 0;
    const venue = (s.venue ?? event.location ?? "").trim();
    const cancelled = !!s.cancelled_at || !!event.cancelled_at;

    lines.push(
      "BEGIN:VEVENT",
      `UID:session-${s.id}-${ticket.booking_id}@suffolktennis.online`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SEQUENCE:${sequence}`,
      `SUMMARY:${esc(cancelled ? `CANCELLED — ${calName}` : calName)}`,
      `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
      `TRANSP:${cancelled ? "TRANSPARENT" : "OPAQUE"}`,
    );
    if (venue) lines.push(`LOCATION:${esc(venue)}`);
    const description = [
      child ? `${child} — ${event.title}` : event.title,
      booking.session_slot ? `Group: ${booking.session_slot}` : "",
      s.notes ?? "",
      cancelled ? "This session has been cancelled." : "",
      `Entry ticket: ${SITE_URL}/ticket/${token}`,
    ].filter(Boolean).join("\n");
    lines.push(`DESCRIPTION:${esc(description)}`);
    lines.push(`URL:${SITE_URL}/ticket/${token}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  const body = lines.map(fold).join("\r\n") + "\r\n";

  return new Response(req.method === "HEAD" ? null : body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="suffolk-tennis.ics"`,
      // Calendar clients poll on their own schedule; a short cache keeps a
      // refresh honest without hammering the database.
      "Cache-Control": "public, max-age=900",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
