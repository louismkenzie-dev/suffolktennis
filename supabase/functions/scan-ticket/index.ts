// Staff-only (admin or coach): validate a QR ticket at the venue and record
// arrival.
// The QR encodes the ticket's qr_token. Validity is decided AT SCAN TIME:
//  - booking must be paid (a later refund/cancellation invalidates the ticket)
//  - for programme bookings, the membership must not be past_due — a failed
//    monthly payment stops admission until it is resolved (Ollie chases).
//  - the ticket must not be void, and not already scanned for this session.
//  - a coach may only scan tickets for programmes they are assigned to
//    (event_coaches); admins may scan anything.
// Every outcome is a 200 with { ok, result, message, player } — supabase-js
// swallows non-2xx bodies, so the scanner UIs would otherwise show a bogus
// "check your connection" for a ticket that simply isn't recognised.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireRole, CORS, json } from "../_shared/adminAuth.ts";
import { upsertAttendance } from "../_shared/reportEmails.ts";

const Body = z.object({
  qr_token: z.string().trim().min(8).max(128),
  session_id: z.string().uuid().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const adminUserId = await requireRole(req, admin, ["admin", "coach"]);
  if (!adminUserId) return json({ error: "Staff access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Accept a full ticket URL pasted/scanned as well as the bare token.
  const token = body.qr_token.includes("/") ? body.qr_token.split("/").pop()! : body.qr_token;

  const noPlayer = { child_name: null, parent_name: null, session_slot: null, has_medical_notes: false, event_title: null };

  const { data: ticket } = await admin
    .from("tickets")
    .select("id, status, event_id, booking_id")
    .eq("qr_token", token)
    .maybeSingle();
  if (!ticket) return json({ ok: false, result: "unknown", message: "Ticket not recognised", player: noPlayer });

  // Scope: coaches only see (and mark) the programmes they are assigned to.
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", adminUserId);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
  if (!isAdmin) {
    const { data: assignment } = await admin
      .from("event_coaches").select("event_id")
      .eq("event_id", ticket.event_id).eq("user_id", adminUserId)
      .maybeSingle();
    if (!assignment) {
      return json({ ok: false, result: "forbidden", message: "This ticket is for a programme you are not assigned to", player: noPlayer });
    }
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, child_id, child_name, parent_name, parent_email, session_slot, medical_notes, membership_id")
    .eq("id", ticket.booking_id)
    .maybeSingle();
  const { data: eventRow } = await admin
    .from("events").select("title").eq("id", ticket.event_id).maybeSingle();

  const player = {
    child_name: booking?.child_name ?? null,
    parent_name: booking?.parent_name ?? null,
    session_slot: booking?.session_slot ?? null,
    has_medical_notes: !!booking?.medical_notes,
    event_title: eventRow?.title ?? null,
  };

  // The session being scanned for must be one of this ticket's event's — a
  // child from programme A scanned on programme B's register is a mistake,
  // not an admission, and must not leave an orphaned attendance row.
  if (body.session_id) {
    const { data: session } = await admin
      .from("event_sessions").select("event_id").eq("id", body.session_id).maybeSingle();
    if (!session || session.event_id !== ticket.event_id) {
      return json({ ok: false, result: "wrong_event", message: "This ticket is for a different programme", player });
    }
  }

  async function record(result: string) {
    await admin.from("ticket_scans").insert({
      ticket_id: ticket!.id,
      session_id: body.session_id ?? null,
      result,
      scanned_by: adminUserId,
    });
  }

  if (ticket.status === "void") {
    await record("rejected_void");
    return json({ ok: false, result: "rejected_void", message: "Ticket has been cancelled", player });
  }
  if (!booking || booking.status !== "paid") {
    await record("rejected_unpaid");
    return json({ ok: false, result: "rejected_unpaid", message: "Booking is not paid", player });
  }

  // Programme bookings: a past-due membership blocks entry.
  if (booking.membership_id) {
    const { data: membership } = await admin
      .from("memberships")
      .select("status, last_payment_failed_at")
      .eq("id", booking.membership_id)
      .maybeSingle();
    if (membership && (membership.status === "past_due" || membership.status === "cancelled" || membership.status === "incomplete")) {
      await record("rejected_unpaid");
      return json({
        ok: false,
        result: "rejected_unpaid",
        message: membership.status === "past_due"
          ? "Monthly payment failed — please ask the parent to update their card"
          : "Membership is not active",
        player,
      });
    }
  }

  // Duplicate scan for the same session (or same day for one-offs).
  let dupQuery = admin
    .from("ticket_scans")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticket.id)
    .eq("result", "admitted");
  dupQuery = body.session_id
    ? dupQuery.eq("session_id", body.session_id)
    : dupQuery.gte("scanned_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
  const { count: priorScans } = await dupQuery;

  if ((priorScans ?? 0) > 0) {
    await record("duplicate");
    return json({ ok: false, result: "duplicate", message: "Already scanned in", player });
  }

  await record("admitted");

  // The register's attendance row: arrived, timestamped now, source scan.
  // Only the admitted path writes it — a duplicate scan above returns before
  // this so it can't overwrite the original arrival time. Failure here must
  // not undo the admission (the scan is already logged), so it's reported
  // rather than thrown.
  const { error: attendanceError } = await upsertAttendance(admin, {
    booking_id: booking.id,
    event_id: ticket.event_id,
    session_id: body.session_id ?? null,
    child_id: booking.child_id ?? null,
    status: "arrived",
    source: "scan",
    marked_by: adminUserId,
  });
  if (attendanceError) console.error("scan-ticket: attendance write failed", attendanceError);

  return json({ ok: true, result: "admitted", message: "Admitted — welcome!", player });
});
