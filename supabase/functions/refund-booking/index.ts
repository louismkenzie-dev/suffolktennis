// Admin-only: give a parent their money back.
//
// Two shapes, because "refund" means two different things here. By default a
// family has withdrawn: the booking becomes `refunded` and the entry ticket is
// voided, so the place goes back. With `keep_place`, Suffolk Tennis has simply
// stopped charging for a programme people already paid for — the money goes
// back, the booking stays paid and becomes complimentary, and the child keeps
// their ticket, their place on the register and their calendar dates.
//
// A monthly plan is refunded month by month. Its money never touches the
// booking's own payment intent — each month is a subscription invoice — so
// the paid invoices are what get read, and every one of them is given back.
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
import { ADMIN_REASON } from "../_shared/complimentary.ts";
import { gbp } from "../_shared/programmePricing.ts";

const Body = z.object({
  booking_id: z.string().uuid(),
  // Omit for a full refund. A partial amount refunds the fee pro-rata.
  amount_pence: z.number().int().positive().optional(),
  reason: z.string().trim().max(500).optional(),
  // Programme bookings: also cancel the Stripe subscription so no further
  // monthly payments are taken.
  cancel_membership: z.boolean().optional(),
  // Give the money back but leave the child on the programme: the booking
  // stays paid, becomes complimentary, and the entry ticket stays valid.
  // Used when Suffolk Tennis decides to stop charging for a programme people
  // have already paid for, rather than when a family withdraws.
  keep_place: z.boolean().optional(),
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
    .select("id, status, amount_pence, stripe_env, stripe_payment_intent_id, membership_id, child_name, invitation_id")
    .eq("id", body.booking_id)
    .maybeSingle();

  if (!booking) return json({ error: "Booking not found" }, 404);
  if (booking.status === "refunded") return json({ error: "This booking has already been refunded" }, 409);
  if (booking.status !== "paid") return json({ error: `Only paid bookings can be refunded (this one is ${booking.status})` }, 409);

  const env = booking.stripe_env as StripeEnv;
  const stripe = createStripeClient(env);
  const connectOpts = connectRequestOptions(env);

  // --- What there actually is to give back ---------------------------------
  //
  // A booking paid in one go carries its own payment intent. A monthly plan
  // does not: each month is a subscription invoice, and the booking's
  // `amount_pence` is only ONE month. Refunding that figure against a plan
  // three months in would hand back a third of the money and call it a full
  // refund, so the invoices are the source of truth for what was taken.
  type Charge = { paymentIntentId: string; amountPence: number };
  const charges: Charge[] = [];

  if (booking.membership_id) {
    const { data: membership } = await admin
      .from("memberships")
      .select("paid_invoice_ids")
      .eq("id", booking.membership_id)
      .maybeSingle();
    for (const invoiceId of (membership?.paid_invoice_ids ?? []) as string[]) {
      try {
        const invoice = await stripe.invoices.retrieve(invoiceId, connectOpts);
        const pi = typeof invoice.payment_intent === "string"
          ? invoice.payment_intent
          : (invoice.payment_intent as { id?: string } | null)?.id ?? null;
        if (pi && (invoice.amount_paid ?? 0) > 0) {
          charges.push({ paymentIntentId: pi, amountPence: invoice.amount_paid });
        }
      } catch (e) {
        console.error("could not read invoice", invoiceId, e instanceof Error ? e.message : String(e));
        return json({
          error: `Could not read the monthly payment ${invoiceId} from Stripe, so nothing has been refunded. Please try again.`,
        }, 502);
      }
    }
  } else if (booking.stripe_payment_intent_id) {
    charges.push({ paymentIntentId: booking.stripe_payment_intent_id, amountPence: booking.amount_pence });
  }

  if (charges.length === 0) {
    return json({ error: "No Stripe payment is recorded against this booking" }, 409);
  }

  const takenPence = charges.reduce((sum, c) => sum + c.amountPence, 0);
  if (body.amount_pence != null && body.amount_pence > takenPence) {
    return json({ error: `Refund amount is more than the ${gbp(takenPence)} actually paid` }, 400);
  }
  // A part-refund has to name one payment to take it from; spreading a figure
  // across several monthly invoices would be guesswork.
  if (body.amount_pence != null && charges.length > 1) {
    return json({
      error: `This plan has ${charges.length} monthly payments totalling ${gbp(takenPence)}. Refund it in full, or refund the months individually in Stripe.`,
    }, 400);
  }

  const fullRefund = body.amount_pence == null || body.amount_pence === takenPence;
  const keepPlace = body.keep_place === true;

  // --- Money moves here ----------------------------------------------------
  const refundIds: string[] = [];
  let refundedPence = 0;
  for (const charge of charges) {
    try {
      const refund = await stripe.refunds.create(
        {
          payment_intent: charge.paymentIntentId,
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
      refundIds.push(refund.id);
      refundedPence += body.amount_pence ?? charge.amountPence;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("refund failed for booking", booking.id, charge.paymentIntentId, message);
      // Part-way through a multi-month refund, saying "nothing happened" would
      // be false — report exactly how far it got.
      if (refundIds.length > 0) {
        return json({
          error: `${gbp(refundedPence)} of ${gbp(takenPence)} was refunded before Stripe refused the rest: ${message}. The booking has been left as it was — please finish the remaining months in Stripe.`,
          partial: true,
          refund_ids: refundIds,
          amount_refunded_pence: refundedPence,
        }, 502);
      }
      return json({ error: `Stripe refused the refund: ${message}` }, 502);
    }
  }
  const refundId = refundIds[0];

  // Stripe succeeded — from here on, failures must not hide that the money
  // has gone back, so each step is reported rather than thrown.
  const warnings: string[] = [];

  // Every refund is recorded here, because a refund that keeps the place no
  // longer shows up in the booking's status.
  const refundRecord = {
    refunded_at: new Date().toISOString(),
    refunded_amount_pence: refundedPence,
    // A monthly plan refunds one Stripe object per month paid.
    stripe_refund_id: refundIds.join(","),
  };

  if (keepPlace) {
    // The place survives the refund: still paid, now free. The ticket, the
    // register and the calendar feed all key off this booking, so none of
    // them are touched.
    const { error: keepErr } = await admin
      .from("bookings")
      .update({
        ...refundRecord,
        complimentary: true,
        // Nothing is owed on this place any more, so the ledger must not go
        // on quoting a price that was handed back.
        ...(fullRefund && { amount_pence: 0 }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id);
    if (keepErr) warnings.push(`Refunded in Stripe, but the booking was not marked free: ${keepErr.message}`);

    // The invitation drives what the parent sees if they open their link
    // again, so it has to agree that the place costs nothing.
    if (booking.invitation_id) {
      await admin
        .from("booking_invitations")
        .update({ complimentary: true, complimentary_reason: ADMIN_REASON })
        .eq("id", booking.invitation_id);
    }
  } else if (fullRefund) {
    const { error: bookingErr } = await admin
      .from("bookings")
      .update({ status: "refunded", ...refundRecord, updated_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (bookingErr) warnings.push(`Refunded in Stripe, but the booking status did not update: ${bookingErr.message}`);

    const { error: ticketErr } = await admin
      .from("tickets")
      .update({ status: "void" })
      .eq("booking_id", booking.id);
    if (ticketErr) warnings.push(`Refunded in Stripe, but the entry ticket was not voided: ${ticketErr.message}`);
  }

  if (!keepPlace && !fullRefund) {
    await admin.from("bookings").update({ ...refundRecord, updated_at: new Date().toISOString() }).eq("id", booking.id);
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
    refund_ids: refundIds,
    environment: env,
    amount_taken_pence: takenPence,
    amount_refunded_pence: refundedPence,
    full_refund: fullRefund,
    place_kept: keepPlace,
    application_fee_refunded: true,
    warnings,
  });
});
