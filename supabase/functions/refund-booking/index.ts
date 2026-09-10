// Admin-only: refund a paid booking and void its entry ticket.
//
// Refunds are issued on the CONNECTED account (direct charges), with
// `refund_application_fee: true` so the Nullshift platform fee returns to
// Suffolk Tennis rather than being absorbed by them. Stripe refunds the fee
// in full for a full refund and pro-rata for a partial one, so the agreed
// 2.5% is never charged on money the parent didn't ultimately pay.
//
// The environment comes from the BOOKING, not from the current payments_mode:
// a booking taken in sandbox must be refunded with sandbox keys even after
// go-live, or the call would hit live Stripe with a test payment intent id.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { createStripeClient, connectRequestOptions, type StripeEnv } from "../_shared/stripe.ts";

const Body = z.object({
  booking_id: z.string().uuid(),
  // Omit for a full refund. A partial amount refunds the fee pro-rata.
  amount_pence: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
  // Programme bookings: also cancel the Stripe subscription so no further
  // monthly payments are taken.
  cancel_membership: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const adminUserId = await requireAdmin(req, admin);
  if (!adminUserId) return json({ error: "Admin access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, amount_pence, stripe_env, stripe_payment_intent_id, membership_id, child_name")
    .eq("id", body.booking_id)
    .maybeSingle();

  if (!booking) return json({ error: "Booking not found" }, 404);
  if (booking.status === "refunded") return json({ error: "This booking has already been refunded" }, 409);
  if (booking.status !== "paid") return json({ error: `Only paid bookings can be refunded (this one is ${booking.status})` }, 409);
  if (!booking.stripe_payment_intent_id) {
    return json({ error: "No Stripe payment is recorded against this booking" }, 409);
  }
  if (body.amount_pence != null && body.amount_pence > booking.amount_pence) {
    return json({ error: "Refund amount is more than the booking was paid" }, 400);
  }

  const env = booking.stripe_env as StripeEnv;
  const stripe = createStripeClient(env);
  const connectOpts = connectRequestOptions(env);

  let refundId: string;
  try {
    const refund = await stripe.refunds.create(
      {
        payment_intent: booking.stripe_payment_intent_id,
        ...(body.amount_pence != null && { amount: body.amount_pence }),
        // Return our platform fee to Suffolk Tennis along with the refund.
        refund_application_fee: true,
        metadata: {
          bookingId: booking.id,
          refundedBy: adminUserId,
          ...(body.reason && { reason: body.reason }),
        },
      },
      connectOpts,
    );
    refundId = refund.id;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("refund failed for booking", booking.id, message);
    return json({ error: `Stripe refused the refund: ${message}` }, 502);
  }

  // Stripe succeeded — from here on, failures must not hide that the money
  // has gone back, so each step is reported rather than thrown.
  const warnings: string[] = [];
  const fullRefund = body.amount_pence == null || body.amount_pence === booking.amount_pence;

  if (fullRefund) {
    const { error: bookingErr } = await admin
      .from("bookings")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (bookingErr) warnings.push(`Refunded in Stripe, but the booking status did not update: ${bookingErr.message}`);

    const { error: ticketErr } = await admin
      .from("tickets")
      .update({ status: "void" })
      .eq("booking_id", booking.id);
    if (ticketErr) warnings.push(`Refunded in Stripe, but the entry ticket was not voided: ${ticketErr.message}`);
  }

  if (body.cancel_membership && booking.membership_id) {
    const { data: membership } = await admin
      .from("memberships")
      .select("id, stripe_subscription_id")
      .eq("id", booking.membership_id)
      .maybeSingle();
    if (membership?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(membership.stripe_subscription_id, connectOpts);
        await admin.from("memberships")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("id", membership.id);
      } catch (e) {
        warnings.push(`Refund succeeded, but the monthly subscription could not be cancelled: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return json({
    ok: true,
    refund_id: refundId,
    environment: env,
    amount_refunded_pence: body.amount_pence ?? booking.amount_pence,
    full_refund: fullRefund,
    application_fee_refunded: true,
    warnings,
  });
});
