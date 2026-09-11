// Staff-only (admin or coach): validate a QR ticket at the venue and record
// arrival.
//
// The code itself now says which session it is for (session_tickets), so the
// scanner asks the coach nothing — see docs/SESSION-TICKETS-SPEC.md. A
// legacy season ticket already in a parent's inbox still scans: its session
// is worked out from the clock, and only if that fails does the caller's open
// register act as a hint. `session_id` in the body is that hint and nothing
// more.
//
// Validity is decided AT SCAN TIME:
//  - booking must be paid (a later refund/cancellation invalidates the ticket)
//  - for programme bookings, the membership must not be past_due — a failed
//    monthly payment stops admission until it is resolved (Ollie chases).
//  - the ticket must not be void, and not already scanned for the session it
//    resolved to.
//  - a coach may only scan tickets for programmes they are assigned to
//    (event_coaches); admins may scan anything.
// Every outcome is a 200 with the body below — supabase-js swallows non-2xx
// bodies, so the scanner UIs would otherwise show a bogus "check your
// connection" for a ticket that simply isn't recognised.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireRole, CORS, json } from "../_shared/adminAuth.ts";
import { upsertAttendance } from "../_shared/reportEmails.ts";
import { normaliseToken, resolveScanTarget } from "../_shared/sessionTickets.ts";

const Body = z.object({
  qr_token: z.string().trim().min(8).max(128),
  session_id: z.string().uuid().optional(),
});

// Scans for a session-less event are one per day, not one ever: a summer
// camp booking covers several days on the same ticket.
const ONE_OFF_DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * LTA year group from the age on 1 January of the current year — the same
 * rule the register shows (coach-session), so a coach sees the same chip in
 * both places.
 */
function ageGroup(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const birth = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const year = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric" }).format(new Date()),
  );
  const bornNewYearsDay = birth.getUTCMonth() === 0 && birth.getUTCDate() === 1;
  const age = year - birth.getUTCFullYear() - (bornNewYearsDay ? 0 : 1);
  if (age <= 7) return "8U";
  if (age === 8) return "9U";
  if (age === 9) return "10U";
  if (age === 10) return "11U";
  if (age === 11) return "12U";
  if (age <= 13) return "14U";
  if (age <= 15) return "16U";
  if (age <= 17) return "18U";
  return "Senior";
}

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

  const token = normaliseToken(body.qr_token);
  const noPlayer = {
    child_name: null, parent_name: null, session_slot: null, has_medical_notes: false,
    event_title: null, age_group: null, medical_notes: null,
  };
  const bare = (result: string, message: string) =>
    json({
      ok: false, result, message, player: noPlayer,
      session: null, event: null, booking_id: null, resolved_from: null,
    });

  const target = await resolveScanTarget(admin, { token, hintSessionId: body.session_id ?? null });
  if (target.outcome === "unknown") return bare("unknown", "Ticket not recognised");

  // Scope: coaches only see (and mark) the programmes they are assigned to.
  const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", adminUserId);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
  if (!isAdmin) {
    const { data: assignment } = await admin
      .from("event_coaches").select("event_id")
      .eq("event_id", target.event_id!).eq("user_id", adminUserId)
      .maybeSingle();
    if (!assignment) {
      return bare("forbidden", "This ticket is for a programme you are not assigned to");
    }
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, child_id, child_name, child_dob, parent_name, session_slot, medical_notes, membership_id")
    .eq("id", target.booking_id!)
    .maybeSingle();
  const { data: eventRow } = await admin
    .from("events").select("id, title").eq("id", target.event_id!).maybeSingle();
  type ChildRow = {
    date_of_birth: string | null;
    medical_needs: string | null;
    medical_conditions: string[] | null;
    medical_details: string | null;
  };
  let child: ChildRow | null = null;
  if (booking?.child_id) {
    const { data } = await admin
      .from("children")
      .select("date_of_birth, medical_needs, medical_conditions, medical_details")
      .eq("id", booking.child_id).maybeSingle();
    child = (data as ChildRow | null) ?? null;
  }

  // Medical detail comes from the booking form first, then the child's
  // profile — the same order the register uses.
  const medicalNotes = (() => {
    const fromBooking = (booking?.medical_notes ?? "").trim();
    if (fromBooking) return fromBooking;
    const parts = [
      (child?.medical_conditions ?? []).join(", "),
      child?.medical_details ?? "",
      child?.medical_needs ?? "",
    ].map((s: string) => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts.join(" — ") : null;
  })();

  const player = {
    child_name: booking?.child_name ?? null,
    parent_name: booking?.parent_name ?? null,
    session_slot: booking?.session_slot ?? null,
    has_medical_notes: !!medicalNotes,
    event_title: eventRow?.title ?? null,
    age_group: ageGroup(child?.date_of_birth ?? booking?.child_dob),
    medical_notes: medicalNotes,
  };
  const session = target.session
    ? {
      id: target.session.id,
      session_date: target.session.session_date,
      start_time: target.session.start_time,
      end_time: target.session.end_time,
      venue: target.session.venue,
    }
    : null;
  const event = eventRow ? { id: eventRow.id, title: eventRow.title } : null;

  const respond = (result: string, message: string) =>
    json({
      ok: result === "admitted",
      result,
      message,
      player,
      session,
      event,
      booking_id: target.booking_id,
      resolved_from: target.resolved_from,
    });

  // ticket_scans hangs off the season ticket and its `result` is
  // CHECK-constrained, so only the four original outcomes are ever logged.
  async function record(result: "admitted" | "duplicate" | "rejected_void" | "rejected_unpaid") {
    if (!target.legacy_ticket_id) return;
    await admin.from("ticket_scans").insert({
      ticket_id: target.legacy_ticket_id,
      session_id: target.session?.id ?? null,
      result,
      scanned_by: adminUserId,
    });
  }

  if (target.status === "void") {
    await record("rejected_void");
    return respond("rejected_void", "Ticket has been cancelled");
  }
  if (!booking || booking.status !== "paid") {
    await record("rejected_unpaid");
    return respond("rejected_unpaid", "Booking is not paid");
  }

  // Only once the ticket and the booking are known good: a cancelled or
  // refunded child must be turned away, not told to be marked in by hand.
  if (target.outcome === "no_session") {
    return respond("no_session", "Season ticket — no session of this programme is running now");
  }
  if (target.outcome === "wrong_session") {
    return respond("wrong_session", "This code is for a different session");
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
      return respond(
        "rejected_unpaid",
        membership.status === "past_due"
          ? "Monthly payment failed — please ask the parent to update their card"
          : "Membership is not active",
      );
    }
  }

  // Duplicate scan for the session the code resolved to (or the same day for
  // one-offs). A booking with no season ticket row has no scan history to
  // read, so its arrival row stands in.
  let alreadyIn = false;
  if (target.legacy_ticket_id) {
    let dupQuery = admin
      .from("ticket_scans")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", target.legacy_ticket_id)
      .eq("result", "admitted");
    dupQuery = target.session
      ? dupQuery.eq("session_id", target.session.id)
      : dupQuery.gte("scanned_at", new Date(Date.now() - ONE_OFF_DUPLICATE_WINDOW_MS).toISOString());
    const { count } = await dupQuery;
    alreadyIn = (count ?? 0) > 0;
  } else {
    let attQuery = admin
      .from("session_attendance")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", booking.id)
      .eq("status", "arrived")
      .eq("source", "scan");
    attQuery = target.session ? attQuery.eq("session_id", target.session.id) : attQuery.is("session_id", null);
    const { count } = await attQuery;
    alreadyIn = (count ?? 0) > 0;
  }

  if (alreadyIn) {
    await record("duplicate");
    return respond("duplicate", "Already scanned in");
  }

  await record("admitted");

  // The register's attendance row: arrived, timestamped now, source scan.
  // Only the admitted path writes it — a duplicate scan above returns before
  // this so it can't overwrite the original arrival time. Failure here must
  // not undo the admission (the scan is already logged), so it's reported
  // rather than thrown.
  const { error: attendanceError } = await upsertAttendance(admin, {
    booking_id: booking.id,
    event_id: target.event_id!,
    session_id: target.session?.id ?? null,
    child_id: booking.child_id ?? null,
    status: "arrived",
    source: "scan",
    marked_by: adminUserId,
  });
  if (attendanceError) console.error("scan-ticket: attendance write failed", attendanceError);

  return respond("admitted", "Admitted — welcome!");
});
