// Public endpoint for the post-checkout return page and the ticket page.
// Authorized by unguessable identifiers: the Stripe checkout session id
// (returned only to the payer) or the ticket's qr_token (sent only to the
// payer's email). Falls back to confirming with Stripe directly when the
// webhook hasn't landed yet, so the return page never shows a false
// "pending" to someone who has just paid.
//
// A qr_token is matched against session_tickets first and the old
// one-per-booking tickets second, so the per-session codes the reminders send
// and every season ticket already in a parent's inbox both open a ticket page
// (docs/SESSION-TICKETS-SPEC.md).
import { z } from "npm:zod@3.23.8";
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";
import { createStripeClient, connectRequestOptions, type StripeEnv } from "../_shared/stripe.ts";
import { SESSION_COLUMNS, type SessionRow } from "../_shared/sessionTickets.ts";

const Body = z.object({
  session_id: z.string().trim().min(8).max(255).optional(),
  booking_id: z.string().uuid().optional(),
  qr_token: z.string().trim().min(8).max(128).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.session_id && !body.booking_id && !body.qr_token) {
    return json({ error: "session_id, booking_id or qr_token required" }, 400);
  }

  const admin = serviceClient();

  // A booking id travels in query strings and emails; the QR token and the
  // Stripe session id do not. Only the latter two prove the caller is the
  // payer, and only they unlock the entry credential below.
  const provedOwnership = !!body.qr_token || !!body.session_id;

  let bookingId: string | null = body.booking_id ?? null;
  // Set when the token is a per-session code: the page then shows that one
  // session rather than the programme's next few.
  let sessionTicket: { qr_token: string; status: string; session_id: string | null } | null = null;
  if (body.qr_token) {
    const { data: perSession } = await admin
      .from("session_tickets")
      .select("booking_id, qr_token, status, session_id")
      .eq("qr_token", body.qr_token).maybeSingle();
    if (perSession) {
      sessionTicket = { qr_token: perSession.qr_token, status: perSession.status, session_id: perSession.session_id };
      bookingId = perSession.booking_id;
    } else {
      const { data: ticket } = await admin
        .from("tickets").select("booking_id").eq("qr_token", body.qr_token).maybeSingle();
      if (!ticket) return json({ error: "Ticket not found" }, 404);
      bookingId = ticket.booking_id;
    }
  }

  const bookingColumns =
    "id, status, event_id, child_name, parent_name, session_slot, amount_pence, stripe_env, stripe_checkout_session_id, stripe_payment_intent_id, membership_id, paid_at";
  let booking = null as null | Record<string, any>;
  if (bookingId) {
    ({ data: booking } = await admin
      .from("bookings").select(bookingColumns).eq("id", bookingId).maybeSingle());
  } else {
    ({ data: booking } = await admin
      .from("bookings").select(bookingColumns)
      .eq("stripe_checkout_session_id", body.session_id!).maybeSingle());
  }
  if (!booking) return json({ error: "Booking not found" }, 404);

  // Webhook race: confirm with Stripe directly when still pending. Embedded
  // checkout stores a PaymentIntent id; the old hosted flow stored a
  // checkout session id.
  if (booking.status === "pending" && (booking.stripe_payment_intent_id || booking.stripe_checkout_session_id)) {
    try {
      const env = booking.stripe_env as StripeEnv;
      const stripe = createStripeClient(env);
      let confirmedPaid = false;
      if (booking.stripe_payment_intent_id) {
        const pi = await stripe.paymentIntents.retrieve(
          booking.stripe_payment_intent_id, {}, connectRequestOptions(env),
        );
        confirmedPaid = pi.status === "succeeded";
      } else {
        const session = await stripe.checkout.sessions.retrieve(
          booking.stripe_checkout_session_id, {}, connectRequestOptions(env),
        );
        confirmedPaid = session.payment_status === "paid" || session.status === "complete";
      }
      if (confirmedPaid) {
        // Report paid; the webhook will (or has) settled the row and issued
        // the ticket. Give it a moment and re-read.
        await new Promise((r) => setTimeout(r, 1500));
        const { data: refreshed } = await admin
          .from("bookings").select("status, paid_at").eq("id", booking.id).maybeSingle();
        if (refreshed) Object.assign(booking, refreshed);
        if (booking.status === "pending") booking.status = "processing";
      }
    } catch (e) {
      console.error("stripe session lookup failed:", e);
    }
  }

  const { data: eventRow } = await admin
    .from("events")
    .select("title, location, event_date, programme_type, cancelled_at")
    .eq("id", booking.event_id).maybeSingle();

  const { data: ticketRow } = await admin
    .from("tickets")
    .select("qr_token, status, issued_at")
    .eq("booking_id", booking.id).maybeSingle();

  let session: SessionRow | null = null;
  if (sessionTicket?.session_id) {
    const { data } = await admin
      .from("event_sessions").select(SESSION_COLUMNS).eq("id", sessionTicket.session_id).maybeSingle();
    session = (data as SessionRow | null) ?? null;
  }

  // A session ticket is about one session, so the programme's diary is not
  // part of that page.
  let sessions: Array<Record<string, unknown>> = [];
  if (!sessionTicket) {
    const { data } = await admin
      .from("event_sessions")
      .select("session_date, start_time, end_time, venue, moved_from_date")
      .eq("event_id", booking.event_id)
      .is("cancelled_at", null)
      .gte("session_date", new Date().toISOString().slice(0, 10))
      .order("session_date")
      .limit(6);
    sessions = data ?? [];
  }

  const scoped = sessionTicket
    ? { qr_token: sessionTicket.qr_token, status: sessionTicket.status, scope: "session" as const }
    : ticketRow
    ? { qr_token: ticketRow.qr_token, status: ticketRow.status, scope: "season" as const }
    : null;

  return json({
    booking: {
      status: booking.status,
      child_name: booking.child_name,
      parent_name: booking.parent_name,
      session_slot: booking.session_slot,
      amount_pence: booking.amount_pence,
      paid_at: booking.paid_at,
    },
    event: eventRow,
    session: session
      ? {
        id: session.id,
        session_date: session.session_date,
        start_time: session.start_time,
        end_time: session.end_time,
        venue: session.venue,
      }
      : null,
    upcoming_sessions: sessions ?? [],
    // Withheld on the booking_id path: that id is not a secret, and the
    // token it would hand over is what scan-ticket accepts as admission.
    ticket: booking.status === "paid" && provedOwnership ? scoped : null,
  });
});
