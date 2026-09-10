// Staff-only (coach or admin) data for the Coach hub: which events have paid
// players, and the player roster for a session — including arrival status
// from the ticket scans and the caller's own existing reports. Report writes
// go straight to session_reports under RLS; this function only reads.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireRole, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

const Body = z.object({
  action: z.enum(["events", "roster", "mark", "notify_report"]),
  report_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  present: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const staffId = await requireRole(req, admin, ["admin", "coach"]);
  if (!staffId) return json({ error: "Staff access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (body.action === "events") {
    // Events that actually have paid players, newest first, with sessions.
    const { data: paidEvents } = await admin
      .from("bookings")
      .select("event_id")
      .eq("status", "paid");
    const eventIds = [...new Set((paidEvents ?? []).map((b) => b.event_id))];
    if (eventIds.length === 0) return json({ events: [] });

    const [{ data: events }, { data: sessions }] = await Promise.all([
      admin.from("events")
        .select("id, title, event_date, location, programme_type")
        .in("id", eventIds)
        .is("cancelled_at", null)
        .order("event_date", { ascending: false, nullsFirst: false }),
      admin.from("event_sessions")
        .select("id, event_id, session_date, start_time, end_time, venue")
        .in("event_id", eventIds)
        .is("cancelled_at", null)
        .order("session_date"),
    ]);

    const sessionsByEvent = new Map<string, unknown[]>();
    for (const s of sessions ?? []) {
      const list = sessionsByEvent.get(s.event_id) ?? [];
      list.push(s);
      sessionsByEvent.set(s.event_id, list);
    }
    return json({
      events: (events ?? []).map((e) => ({ ...e, sessions: sessionsByEvent.get(e.id) ?? [] })),
    });
  }

  // Live register: mark a player present (same record a QR scan writes, so
  // scans and manual ticks share one attendance list) or clear the mark.
  if (body.action === "mark") {
    if (!body.booking_id || body.present === undefined) {
      return json({ error: "booking_id and present required" }, 400);
    }
    const { data: ticket } = await admin
      .from("tickets").select("id").eq("booking_id", body.booking_id).maybeSingle();
    if (!ticket) return json({ error: "No ticket for this booking" }, 404);

    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    let existing = admin
      .from("ticket_scans").select("id").eq("ticket_id", ticket.id).eq("result", "admitted");
    existing = body.session_id
      ? existing.eq("session_id", body.session_id)
      : existing.gte("scanned_at", windowStart);
    const { data: rows } = await existing;

    if (body.present) {
      if ((rows ?? []).length === 0) {
        await admin.from("ticket_scans").insert({
          ticket_id: ticket.id,
          session_id: body.session_id ?? null,
          result: "admitted",
          scanned_by: staffId,
        });
      }
    } else if ((rows ?? []).length > 0) {
      await admin.from("ticket_scans").delete().in("id", rows!.map((r) => r.id));
    }
    return json({ ok: true, present: body.present });
  }

  // A coach has just written a session report: tell the parent it's ready.
  // The hub calls this once, after the first save; edits don't re-notify,
  // and the idempotency key stops a retry sending twice.
  if (body.action === "notify_report") {
    if (!body.report_id) return json({ error: "report_id required" }, 400);
    const { data: report } = await admin
      .from("session_reports")
      .select("id, booking_id, event_id, child_name, coach_name, comment, stats")
      .eq("id", body.report_id)
      .maybeSingle();
    if (!report) return json({ error: "Report not found" }, 404);

    // Claim the notification before sending: the update only matches an
    // unstamped row, so two calls for the same report can't both send.
    const { data: claimed } = await admin
      .from("session_reports")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", report.id)
      .is("notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return json({ ok: true, already_notified: true });

    const { data: booking } = await admin
      .from("bookings")
      .select("parent_email, parent_name")
      .eq("id", report.booking_id)
      .maybeSingle();
    if (!booking?.parent_email) return json({ error: "No parent email on the booking" }, 404);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ ok: false, error: "RESEND_API_KEY not configured" });

    const { data: ev } = await admin
      .from("events").select("title").eq("id", report.event_id).maybeSingle();

    const labels: Record<string, string> = {
      technique: "Technique", attitude: "Attitude & effort", movement: "Movement", matchplay: "Match play",
    };
    const stats = (report.stats ?? {}) as Record<string, number>;
    const rated = Object.entries(labels)
      .filter(([k]) => (stats[k] ?? 0) > 0)
      .map(([k, label]) => [label, "★".repeat(stats[k]) + "☆".repeat(5 - stats[k])] as [string, string]);

    const first = (booking.parent_name ?? "there").split(" ")[0];
    const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "report");
    try {
      await sendEmail({
        to: booking.parent_email,
        subject: `${report.child_name}'s coach report — ${ev?.title ?? "Suffolk Tennis"}`,
        unsubscribe_token: unsubToken ?? undefined,
        idempotency_key: `report-notify-${report.id}`,
        html: brandedEmail({
          unsubscribeUrl: unsubscribeUrlFor(unsubToken),
          title: `${report.child_name}'s session report`,
          preheader: `${report.coach_name ?? "Their coach"} has written up today's session`,
          body:
            emailParagraph(`Hi ${first},`) +
            emailParagraph(`${report.coach_name ?? "The coach"} has written a report on <strong>${report.child_name}</strong>'s session at <strong>${ev?.title ?? "Suffolk Tennis"}</strong>.`) +
            (rated.length > 0 ? emailDetails(rated) : "") +
            (report.comment ? emailParagraph(`<em>“${report.comment}”</em>`) : "") +
            emailButton(`${SITE_URL}/parent-hub?tab=bookings`, "See the full report") +
            emailNote("Every session report is kept in your Parent Hub, so you can look back over the season."),
        }),
      }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
    } catch (e) {
      // Release the claim so a retry can send.
      await admin.from("session_reports").update({ notified_at: null }).eq("id", report.id);
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return json({ ok: true });
  }

  // roster
  if (!body.event_id) return json({ error: "event_id required" }, 400);

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, child_id, child_name, session_slot, medical_notes, parent_name")
    .eq("event_id", body.event_id)
    .eq("status", "paid")
    .order("child_name");

  // Child profile photos for the register — signed here (service role) so
  // coaches see them without widening the storage policies.
  const photoByChild = new Map<string, string>();
  const childIds = [...new Set((bookings ?? []).map((b) => b.child_id).filter(Boolean))] as string[];
  if (childIds.length > 0) {
    const { data: children } = await admin
      .from("children").select("id, photo_url").in("id", childIds);
    const withPhotos = (children ?? []).filter((c) => c.photo_url);
    await Promise.all(withPhotos.map(async (c) => {
      const { data: signed } = await admin.storage
        .from("child-photos")
        .createSignedUrl(c.photo_url as string, 3600);
      if (signed?.signedUrl) photoByChild.set(c.id, signed.signedUrl);
    }));
  }

  const bookingIds = (bookings ?? []).map((b) => b.id);
  let arrived = new Set<string>();
  if (bookingIds.length > 0) {
    const { data: tickets } = await admin
      .from("tickets").select("id, booking_id").in("booking_id", bookingIds);
    const ticketToBooking = new Map((tickets ?? []).map((t) => [t.id, t.booking_id]));
    if (ticketToBooking.size > 0) {
      let scanQuery = admin
        .from("ticket_scans")
        .select("ticket_id")
        .eq("result", "admitted")
        .in("ticket_id", [...ticketToBooking.keys()]);
      scanQuery = body.session_id
        ? scanQuery.eq("session_id", body.session_id)
        : scanQuery.gte("scanned_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
      const { data: scans } = await scanQuery;
      arrived = new Set((scans ?? []).map((s) => ticketToBooking.get(s.ticket_id)!));
    }
  }

  // The caller's own reports for these bookings (this session, or session-less).
  let myReports: Record<string, unknown> = {};
  if (bookingIds.length > 0) {
    let reportQuery = admin
      .from("session_reports")
      .select("booking_id, stats, comment")
      .eq("coach_id", staffId)
      .in("booking_id", bookingIds);
    reportQuery = body.session_id
      ? reportQuery.eq("session_id", body.session_id)
      : reportQuery.is("session_id", null);
    const { data: reports } = await reportQuery;
    myReports = Object.fromEntries((reports ?? []).map((r) => [r.booking_id, { stats: r.stats, comment: r.comment }]));
  }

  return json({
    players: (bookings ?? []).map((b) => ({
      booking_id: b.id,
      child_id: b.child_id,
      photo_url: b.child_id ? photoByChild.get(b.child_id) ?? null : null,
      child_name: b.child_name,
      parent_name: b.parent_name,
      session_slot: b.session_slot,
      medical_notes: b.medical_notes,
      arrived: arrived.has(b.id),
      my_report: myReports[b.id] ?? null,
    })),
  });
});
