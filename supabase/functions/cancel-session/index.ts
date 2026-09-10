// Admin-only: cancel or move a session, or cancel a whole one-off event, and
// tell every parent with a paid place.
//
// Weather is the usual reason (handover §8.1). Nothing financial happens
// here: a cancelled programme session doesn't change the programme fee, and
// a cancelled event is refunded per booking with the existing Refund button,
// so what gets charged never changes without an explicit admin action.
//
// A cancelled session keeps its row — reports and scans stay attached — and
// a moved session keeps its original date so the email can say "was X, now
// Y". Emails are deduplicated per parent (siblings get one email listing
// both children) and idempotent per change, so a retried call can't send
// the same notice twice.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

const Body = z.object({
  action: z.enum(["cancel_session", "reschedule_session", "cancel_event"]),
  session_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  new_start: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().or(z.literal("")),
  new_end: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().or(z.literal("")),
  new_venue: z.string().trim().max(200).optional().or(z.literal("")),
});

const longDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** "13:30:00" -> "1.30pm" — display only; the database keeps 24-hour. */
function formatTime(t: string | null | undefined): string {
  if (!t) return "";
  const [hh, mm] = t.split(":");
  const h = Number(hh), m = Number(mm ?? 0);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${suffix}` : `${h12}.${String(m).padStart(2, "0")}${suffix}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const adminUserId = await requireAdmin(req, admin);
  if (!adminUserId) return json({ error: "Admin access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // ---- Resolve what is changing ----
  let session: { id: string; event_id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null; cancelled_at: string | null; moved_from_date: string | null } | null = null;
  let eventId = body.event_id ?? null;

  if (body.action !== "cancel_event") {
    if (!body.session_id) return json({ error: "session_id required" }, 400);
    const { data } = await admin
      .from("event_sessions")
      .select("id, event_id, session_date, start_time, end_time, venue, cancelled_at, moved_from_date")
      .eq("id", body.session_id)
      .maybeSingle();
    if (!data) return json({ error: "Session not found" }, 404);
    if (data.cancelled_at) return json({ error: "This session is already cancelled" }, 409);
    session = data;
    eventId = data.event_id;
  }
  if (!eventId) return json({ error: "event_id required" }, 400);

  const { data: event } = await admin
    .from("events")
    .select("id, title, location, programme_type, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);
  if (body.action === "cancel_event" && event.cancelled_at) {
    return json({ error: "This event is already cancelled" }, 409);
  }
  if (body.action === "reschedule_session" && !body.new_date) {
    return json({ error: "new_date required to move a session" }, 400);
  }

  const isProgramme = event.programme_type === "programme";
  const stamp = new Date().toISOString();
  const reason = body.reason?.trim() || null;

  // ---- Apply the change ----
  let subject = "";
  let title = "";
  let lead = "";
  const details: Array<[string, string]> = [];

  if (body.action === "cancel_session" && session) {
    const { error } = await admin.from("event_sessions")
      .update({ cancelled_at: stamp, cancel_reason: reason })
      .eq("id", session.id);
    if (error) return json({ error: error.message }, 500);
    const when = `${longDate(session.session_date)}${session.start_time ? `, ${formatTime(session.start_time)}` : ""}`;
    subject = `Session cancelled — ${event.title}, ${longDate(session.session_date)}`;
    title = "Session cancelled";
    lead = `The <strong>${event.title}</strong> session on <strong>${when}</strong> has been cancelled.`;
    details.push(["Session", when], ["Venue", session.venue ?? event.location ?? ""]);
  } else if (body.action === "reschedule_session" && session) {
    const patch: Record<string, unknown> = {
      session_date: body.new_date,
      moved_from_date: session.moved_from_date ?? session.session_date,
      moved_from_start: session.start_time,
      moved_at: stamp,
    };
    if (body.new_start) patch.start_time = body.new_start;
    if (body.new_end) patch.end_time = body.new_end;
    if (body.new_venue) patch.venue = body.new_venue;
    const { error } = await admin.from("event_sessions").update(patch).eq("id", session.id);
    if (error) return json({ error: error.message }, 500);
    const was = `${longDate(session.session_date)}${session.start_time ? `, ${formatTime(session.start_time)}` : ""}`;
    const now = `${longDate(body.new_date!)}${body.new_start ? `, ${formatTime(body.new_start)}` : session.start_time ? `, ${formatTime(session.start_time)}` : ""}`;
    subject = `Session moved — ${event.title}, now ${longDate(body.new_date!)}`;
    title = "Session moved";
    lead = `The <strong>${event.title}</strong> session on <strong>${was}</strong> has moved to <strong>${now}</strong>.`;
    details.push(["Was", was], ["Now", now], ["Venue", body.new_venue || session.venue || event.location || ""]);
  } else {
    const { error } = await admin.from("events")
      .update({ cancelled_at: stamp, cancel_reason: reason })
      .eq("id", event.id);
    if (error) return json({ error: error.message }, 500);
    subject = `Cancelled — ${event.title}`;
    title = "Event cancelled";
    lead = `<strong>${event.title}</strong> has been cancelled.`;
    details.push(["Event", event.title], ["Venue", event.location ?? ""]);
  }
  if (reason) details.push(["Reason", reason]);

  // ---- Tell every parent with a paid place, once each ----
  const { data: bookings } = await admin
    .from("bookings")
    .select("parent_email, parent_name, child_name")
    .eq("event_id", event.id)
    .eq("status", "paid");

  const byParent = new Map<string, { name: string | null; children: string[] }>();
  for (const b of bookings ?? []) {
    const key = (b.parent_email ?? "").toLowerCase();
    if (!key) continue;
    const entry = byParent.get(key) ?? { name: b.parent_name, children: [] };
    entry.children.push(b.child_name);
    byParent.set(key, entry);
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const results: Array<{ email: string; sent: boolean; error?: string }> = [];
  if (!apiKey) {
    return json({ ok: true, changed: true, notified: 0, total: byParent.size, error: "RESEND_API_KEY not configured — change saved, nobody emailed" });
  }

  const closing = body.action === "cancel_event"
    ? (isProgramme
        ? "We'll be in touch about what this means for the programme."
        : "If you paid for this event, Suffolk Tennis will arrange your refund — you don't need to do anything.")
    : (isProgramme
        ? "Your place on the rest of the programme is unaffected."
        : "We'll be in touch about a replacement date.");

  for (const [email, entry] of byParent) {
    const first = (entry.name ?? "there").split(" ")[0];
    const who = entry.children.join(" and ");
    try {
      const unsubToken = await unsubscribeTokenFor(admin, email, "session-change");
      await sendEmail({
        to: email,
        subject,
        unsubscribe_token: unsubToken ?? undefined,
        // One notice per change per parent, even if the call is retried.
        idempotency_key: `${body.action}-${session?.id ?? event.id}-${stamp}-${email}`,
        html: brandedEmail({
          unsubscribeUrl: unsubscribeUrlFor(unsubToken),
          title,
          preheader: `${event.title} — ${title.toLowerCase()}`,
          body:
            emailParagraph(`Hi ${first},`) +
            emailParagraph(lead + ` This affects <strong>${who}</strong>.`) +
            emailDetails(details) +
            emailParagraph(closing) +
            emailButton(`${SITE_URL}/parent-hub?tab=bookings`, "View in your Parent Hub") +
            emailNote("Sorry for any inconvenience. Questions: reply to this email or write to enquiries@suffolktennis.online."),
        }),
      }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
      results.push({ email, sent: true });
    } catch (e) {
      results.push({ email, sent: false, error: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return json({
    ok: true,
    changed: true,
    notified: results.filter((r) => r.sent).length,
    total: results.length,
    results,
  });
});
