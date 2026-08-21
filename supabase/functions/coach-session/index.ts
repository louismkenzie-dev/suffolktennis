// Staff-only (coach or admin) data for the Coach hub: which events have paid
// players, and the player roster for a session — including arrival status
// from the ticket scans and the caller's own existing reports. Report writes
// go straight to session_reports under RLS; this function only reads.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireRole, CORS, json } from "../_shared/adminAuth.ts";

const Body = z.object({
  action: z.enum(["events", "roster", "mark"]),
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
        .order("event_date", { ascending: false, nullsFirst: false }),
      admin.from("event_sessions")
        .select("id, event_id, session_date, start_time, end_time, venue")
        .in("event_id", eventIds)
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
