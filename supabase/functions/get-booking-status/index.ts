// Public endpoint for the post-checkout return page and the ticket page.
// Authorized by unguessable identifiers: the Stripe checkout session id
// (returned only to the payer) or the ticket's qr_token (sent only to the
// payer's email). Falls back to confirming with Stripe directly when the
// webhook hasn't landed yet, so the return page never shows a false
// "pending" to someone who has just paid.
import { z } from "npm:zod@3.23.8";
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";
import { createStripeClient, connectRequestOptions, type StripeEnv } from "../_shared/stripe.ts";

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

  let bookingId: string | null = body.booking_id ?? null;
  if (body.qr_token) {
    const { data: ticket } = await admin
      .from("tickets").select("booking_id").eq("qr_token", body.qr_token).maybeSingle();
    if (!ticket) return json({ error: "Ticket not found" }, 404);
    bookingId = ticket.booking_id;
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
    .select("title, location, event_date, programme_type")
    .eq("id", booking.event_id).maybeSingle();

  const { data: ticketRow } = await admin
    .from("tickets")
    .select("qr_token, status, issued_at")
    .eq("booking_id", booking.id).maybeSingle();

  const { data: sessions } = await admin
    .from("event_sessions")
    .select("session_date, start_time, end_time, venue")
    .eq("event_id", booking.event_id)
    .gte("session_date", new Date().toISOString().slice(0, 10))
    .order("session_date")
    .limit(6);

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
    upcoming_sessions: sessions ?? [],
    ticket: ticketRow && booking.status === "paid"
      ? { qr_token: ticketRow.qr_token, status: ticketRow.status }
      : null,
  });
});
