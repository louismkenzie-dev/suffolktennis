// Register watcher, run every 10 minutes by pg_cron (handover §4.1 / §7.10).
//
// A session with paid players that started 15–75 minutes ago and has nobody
// scanned in yet gets one nudge to the admin mailbox: the coach has forgotten
// the register, or the players haven't turned up, and either way Ollie wants
// to know while it can still be fixed.
//
// One alert per session, ever: the claim row in register_alerts is inserted
// BEFORE the email, and only a successful insert sends. If Resend fails the
// claim is deleted so the next run retries; if it succeeds sent_at is stamped.
// Guard-token protected — it is called by the database, not by users.
import { serviceClient, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";

const GUARD = "ra_4d9f1c7b3e8a2f6c0d5b9e1a7c3f8d2b";
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "enquiries@suffolktennis.online";

// Alert window after the scheduled start, in minutes.
const MIN_AFTER_START = 15;
const MAX_AFTER_START = 75;

/** London wall-clock date and minutes-past-midnight, whatever the server TZ. */
function londonNow(): { date: string; minutes: number; label: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const h = Number(get("hour")), m = Number(get("minute"));
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: h * 60 + m,
    label: `${h12}.${String(m).padStart(2, "0")}${suffix}`,
  };
}

const toMinutes = (t: string) => {
  const [hh, mm] = t.split(":");
  return Number(hh) * 60 + Number(mm ?? 0);
};
const formatTime = (t: string) => {
  const [hh, mm] = t.split(":");
  const h = Number(hh), m = Number(mm ?? 0);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: { guard?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const admin = serviceClient();
  const now = londonNow();

  const { data: sessions } = await admin
    .from("event_sessions")
    .select("id, event_id, session_date, start_time, venue")
    .eq("session_date", now.date)
    .is("cancelled_at", null)
    .not("start_time", "is", null);

  const due = (sessions ?? []).filter((s) => {
    const delta = now.minutes - toMinutes(s.start_time as string);
    return delta >= MIN_AFTER_START && delta <= MAX_AFTER_START;
  });
  if (due.length === 0) return json({ checked: 0, alerted: 0 });

  const apiKey = Deno.env.get("RESEND_API_KEY");
  let alerted = 0;
  const notes: string[] = [];

  for (const s of due) {
    const { count: booked } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", s.event_id)
      .eq("status", "paid");
    if (!booked) continue;

    // Anyone scanned or ticked in for this session, or for this event in
    // the last two hours (manual ticks without a session id count too).
    const { data: tickets } = await admin
      .from("tickets").select("id").eq("event_id", s.event_id);
    const ticketIds = (tickets ?? []).map((t) => t.id);
    let scanned = 0;
    if (ticketIds.length > 0) {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { count } = await admin
        .from("ticket_scans")
        .select("id", { count: "exact", head: true })
        .in("ticket_id", ticketIds)
        .eq("result", "admitted")
        .or(`session_id.eq.${s.id},scanned_at.gte.${twoHoursAgo}`);
      scanned = count ?? 0;
    }
    if (scanned > 0) continue;

    // Claim first. A unique-violation means another run already has it.
    const { error: claimErr } = await admin
      .from("register_alerts")
      .insert({ session_id: s.id, kind: "no_scans" });
    if (claimErr) continue;

    if (!apiKey) {
      notes.push(`claimed ${s.id} but RESEND_API_KEY is not set`);
      continue;
    }

    const { data: ev } = await admin
      .from("events").select("title, location").eq("id", s.event_id).maybeSingle();
    const where = s.venue ?? ev?.location ?? "";
    try {
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `Register not taken — ${ev?.title ?? "session"} ${formatTime(s.start_time as string)}`,
        idempotency_key: `register-alert-${s.id}`,
        html: brandedEmail({
          title: "Nobody scanned in yet",
          preheader: `${ev?.title ?? "Session"} started at ${formatTime(s.start_time as string)} — ${booked} booked, 0 checked in`,
          body:
            emailParagraph(`The <strong>${ev?.title ?? "session"}</strong> session started at <strong>${formatTime(s.start_time as string)}</strong> and as of ${now.label} nobody has been checked in.`) +
            emailDetails([
              ["Session", `${formatTime(s.start_time as string)}${where ? ` · ${where}` : ""}`],
              ["Booked", `${booked} player${booked === 1 ? "" : "s"}`],
              ["Checked in", "0"],
            ]) +
            emailParagraph("Usually this means the coach hasn't taken the register — worth a quick message. If the session isn't running, cancel it from the admin so parents are told.") +
            emailButton(`${SITE_URL}/admin/scan`, "Open the scanner") +
            emailNote("You get one of these per session. Players scanned in after this email won't trigger another."),
        }),
      }, { apiKey });
      await admin.from("register_alerts")
        .update({ sent_at: new Date().toISOString() })
        .eq("session_id", s.id).eq("kind", "no_scans");
      alerted += 1;
    } catch (e) {
      // Release the claim so the next run tries again.
      await admin.from("register_alerts").delete().eq("session_id", s.id).eq("kind", "no_scans");
      notes.push(`send failed for ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return json({ checked: due.length, alerted, notes });
});
