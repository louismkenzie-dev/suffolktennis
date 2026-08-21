// Stripe webhook for the booking system. Signature-verified; env chosen by
// the ?env= query param on the endpoint Stripe is configured to call (one
// webhook endpoint per Stripe environment, mirroring the reference setup).
//
// Fulfilment rules:
//  - checkout.session.completed (mode payment, paid)  -> booking paid, issue
//    QR ticket, send confirmation email with the ticket link.
//  - checkout.session.completed (mode subscription)   -> create membership,
//    booking paid once the first invoice settles (invoice handler below).
//  - invoice.payment_succeeded  -> months_paid++, membership active; when the
//    committed months are all paid, cancel the subscription at period end and
//    mark the membership completed. First invoice also settles the booking.
//  - invoice.payment_failed     -> membership past_due + flagged for admins
//    to chase (Ollie's call: no automatic cancellation, but the QR ticket
//    stops admitting until it's resolved).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  type StripeEnv,
  connectRequestOptions,
  createStripeClient,
  verifyWebhook,
} from "../_shared/stripe.ts";
import { sendEmail } from "../_shared/resend.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "info@suffolktennis.online";
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://suffolktennis.online";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("stripe event:", event.type, "env:", env);

    switch (event.type) {
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaid(event.data.object, env);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object);
        break;
      default:
        console.log("unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

// One-off payments made through the embedded Payment Element. Subscription
// first-invoice PaymentIntents also fire this event but carry no bookingId
// metadata (Stripe creates them) — those settle via invoice.payment_succeeded.
async function handlePaymentIntentSucceeded(paymentIntent: any) {
  const bookingId = paymentIntent.metadata?.bookingId;
  if (!bookingId) return;
  await settleBooking(bookingId, { stripe_payment_intent_id: paymentIntent.id });
}

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    console.warn("checkout session without bookingId metadata:", session.id);
    return;
  }

  if (session.mode === "subscription") {
    // Membership record; the money lands via invoice.payment_succeeded.
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, event_id, parent_user_id, parent_email, child_name, amount_pence")
      .eq("id", bookingId)
      .maybeSingle();
    if (!booking) return;

    const { data: eventRow } = await supabase
      .from("events")
      .select("programme_months")
      .eq("id", booking.event_id)
      .maybeSingle();

    await supabase.from("memberships").upsert({
      booking_id: booking.id,
      event_id: booking.event_id,
      parent_user_id: booking.parent_user_id,
      parent_email: booking.parent_email,
      child_name: booking.child_name,
      stripe_subscription_id: session.subscription,
      stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      stripe_env: env,
      monthly_amount_pence: booking.amount_pence,
      months_total: eventRow?.programme_months ?? 1,
      status: "incomplete",
    }, { onConflict: "stripe_subscription_id" });

    const { data: membership } = await supabase
      .from("memberships")
      .select("id")
      .eq("stripe_subscription_id", session.subscription)
      .maybeSingle();
    if (membership) {
      await supabase.from("bookings").update({ membership_id: membership.id }).eq("id", booking.id);
    }
    return;
  }

  // One-off payment
  if (session.payment_status !== "paid") {
    console.log("checkout completed but not paid, skipping:", session.id);
    return;
  }
  await settleBooking(bookingId, {
    stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
  });
}

async function handleInvoicePaid(invoice: any, env: StripeEnv) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return;

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, booking_id, months_paid, months_total, status")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!membership) {
    console.warn("invoice for unknown subscription:", subId);
    return;
  }

  const monthsPaid = membership.months_paid + 1;
  const completed = monthsPaid >= membership.months_total;

  await supabase
    .from("memberships")
    .update({
      months_paid: monthsPaid,
      status: completed ? "completed" : "active",
      last_payment_failed_at: null,
      current_period_end: invoice.lines?.data?.[0]?.period?.end
        ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
        : null,
    })
    .eq("id", membership.id);

  // First successful invoice settles the original booking and issues the ticket.
  if (membership.booking_id && membership.months_paid === 0) {
    await settleBooking(membership.booking_id, {});
  }

  // Commitment fulfilled: stop the subscription at the period end so nobody
  // is charged beyond the programme.
  if (completed) {
    try {
      const stripe = createStripeClient(env);
      await stripe.subscriptions.update(subId, { cancel_at_period_end: true }, connectRequestOptions(env));
    } catch (e) {
      console.error("failed to schedule subscription cancellation:", e);
    }
  }
}

async function handleInvoiceFailed(invoice: any) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : null;
  if (!subId) return;

  const { data: membership } = await supabase
    .from("memberships")
    .select("id, parent_email, child_name, event_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!membership) return;

  await supabase
    .from("memberships")
    .update({ status: "past_due", last_payment_failed_at: new Date().toISOString() })
    .eq("id", membership.id);

  // Flag for the admins to chase — deliberately no automatic cancellation.
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (apiKey) {
    const { data: eventRow } = await supabase
      .from("events").select("title").eq("id", membership.event_id).maybeSingle();
    try {
      await sendEmail({
        to: ADMIN_NOTIFY_EMAIL,
        subject: `Payment failed — ${membership.child_name} (${eventRow?.title ?? "programme"})`,
        html: `<p>A monthly programme payment has failed.</p>
<p><strong>Player:</strong> ${membership.child_name}<br>
<strong>Parent:</strong> ${membership.parent_email}<br>
<strong>Programme:</strong> ${eventRow?.title ?? membership.event_id}</p>
<p>The membership is now marked <strong>past due</strong> — their entry QR code will not admit them until the payment is resolved. Stripe retries the card automatically for about a week; this needs chasing only if it keeps failing.</p>
<p><a href="${SITE_URL}/admin">Open the admin dashboard</a></p>`,
      }, { apiKey });
    } catch (e) {
      console.error("admin failure notification failed:", e);
    }
  }
}

async function settleBooking(bookingId: string, extra: Record<string, unknown>) {
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, event_id, invitation_id, parent_name, parent_email, child_name, session_slot")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) {
    console.warn("settle for unknown booking:", bookingId);
    return;
  }
  if (booking.status === "paid") return; // idempotent — webhooks can repeat

  await supabase
    .from("bookings")
    .update({ status: "paid", paid_at: new Date().toISOString(), ...extra })
    .eq("id", booking.id);

  if (booking.invitation_id) {
    await supabase
      .from("booking_invitations")
      .update({ status: "booked" })
      .eq("id", booking.invitation_id);
  }

  // Issue the QR ticket (unique per booking; validity re-checked at scan time).
  const { data: ticket } = await supabase
    .from("tickets")
    .upsert(
      { booking_id: booking.id, event_id: booking.event_id },
      { onConflict: "booking_id" },
    )
    .select("qr_token")
    .single();

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (apiKey && ticket) {
    const { data: eventRow } = await supabase
      .from("events").select("title, location, event_date").eq("id", booking.event_id).maybeSingle();
    const ticketUrl = `${SITE_URL}/ticket/${ticket.qr_token}`;
    const firstName = booking.parent_name.split(" ")[0];
    try {
      await sendEmail({
        to: booking.parent_email,
        subject: `Booking confirmed — ${eventRow?.title ?? "Suffolk Tennis"}`,
        html: `<p>Hi ${firstName},</p>
<p><strong>${booking.child_name}</strong> is booked on <strong>${eventRow?.title ?? "the session"}</strong>${booking.session_slot ? ` (${booking.session_slot})` : ""}${eventRow?.location ? ` at ${eventRow.location}` : ""}.</p>
<p><a href="${ticketUrl}" style="display:inline-block;padding:12px 24px;background:#0f1c2e;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold">View your entry ticket</a></p>
<p>Please have the QR code on that page ready to be scanned when you arrive.</p>
<p>Suffolk Tennis</p>`,
      }, { apiKey });
    } catch (e) {
      console.error("confirmation email failed:", e);
    }
  }
}
