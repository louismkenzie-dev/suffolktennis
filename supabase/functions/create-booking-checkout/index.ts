// Creates a pending booking and the Stripe objects for the EMBEDDED checkout
// (Payment Element on our own booking page — no redirect to Stripe).
//
// Authorization is by invitation token for private events; public events with
// sign-up enabled can be booked without one. The client never chooses the
// Stripe environment — that comes from app_settings via getActiveStripeEnv;
// the response's `environment` tells the client which publishable-key pair to
// load Stripe.js with.
//
// One-off events    -> PaymentIntent, price from events.price_pence.
// Monthly programme -> incomplete subscription, price from
//                      events.monthly_amount_pence; the client confirms the
//                      first invoice's PaymentIntent, and the parent commits
//                      to events.programme_months payments — enforced in the
//                      webhook, which cancels the subscription once the final
//                      committed month is paid.
import { z } from "npm:zod@3.23.8";
import {
  type StripeEnv,
  bookingApplicationFee,
  connectRequestOptions,
  createStripeClient,
  getConnectedAccountId,
  getPlatformFeePercent,
} from "../_shared/stripe.ts";
import { getActiveStripeEnv } from "../_shared/paymentsMode.ts";
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";

const Body = z.object({
  invitation_token: z.string().regex(/^[a-f0-9]{16,}$/).optional(),
  event_id: z.string().uuid().optional(),
  child_id: z.string().uuid(),
  parent_name: z.string().trim().min(1).max(120),
  parent_phone: z.string().trim().max(40).optional().or(z.literal("")),
  session_slot: z.string().trim().max(200).optional().or(z.literal("")),
  medical_notes: z.string().trim().max(1000).optional().or(z.literal("")),
  photo_consent: z.boolean().optional(),
});

/** Booking requires a signed-in parent: resolve the caller from their JWT. */
async function requireUser(req: Request): Promise<{ id: string; email: string } | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const { createClient } = await import("npm:@supabase/supabase-js@2");
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error } = await anon.auth.getUser(authHeader.slice("Bearer ".length));
  if (error || !user?.email) return null;
  return { id: user.id, email: user.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    }
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const admin = serviceClient();

  // --- Onboarding gate: parents must have an account and a registered child
  // profile (photo included) before they can pay. ---
  const user = await requireUser(req);
  if (!user) {
    return json({ error: "Please sign in or create your account before booking." }, 401);
  }
  const { data: child } = await admin
    .from("children")
    .select("id, name, date_of_birth, medical_details, medical_needs, parent_user_id")
    .eq("id", body.child_id)
    .maybeSingle();
  if (!child || child.parent_user_id !== user.id) {
    return json({ error: "Please add this child to your account before booking." }, 403);
  }

  // --- Resolve the event, via invitation token or directly (public only) ---
  let invitation: { id: string; event_id: string; status: string; child_id: string | null } | null = null;
  let eventId = body.event_id ?? null;

  if (body.invitation_token) {
    const { data } = await admin
      .from("booking_invitations")
      .select("id, event_id, status, child_id")
      .eq("token", body.invitation_token)
      .maybeSingle();
    if (!data) return json({ error: "Invitation not found" }, 404);
    if (data.status === "revoked" || data.status === "expired") {
      return json({ error: "This invitation is no longer valid" }, 410);
    }
    invitation = data;
    eventId = data.event_id;
  }
  if (!eventId) return json({ error: "event_id or invitation_token required" }, 400);

  const { data: event } = await admin
    .from("events")
    .select("id, title, location, visibility, sign_up_enabled, capacity, programme_type, price_pence, monthly_amount_pence, programme_months")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);

  // Private events strictly require an invitation; public ones require
  // sign-ups to be open.
  if (event.visibility === "private" && !invitation) {
    return json({ error: "This event is invitation only" }, 403);
  }
  if (event.visibility === "public" && !invitation && !event.sign_up_enabled) {
    return json({ error: "Sign-ups are closed for this event" }, 400);
  }

  const isProgramme = event.programme_type === "monthly_programme";
  const amountPence = isProgramme ? event.monthly_amount_pence : event.price_pence;
  if (!amountPence || amountPence < 30) {
    return json({ error: "This event does not have online payment configured — please contact Suffolk Tennis." }, 400);
  }
  if (isProgramme && (!event.programme_months || event.programme_months < 1)) {
    return json({ error: "Programme length is not configured" }, 400);
  }

  // --- Capacity: paid bookings plus checkouts started in the last 30 min ---
  if (event.capacity) {
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { count } = await admin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event.id)
      .or(`status.eq.paid,and(status.eq.pending,created_at.gte.${cutoff})`);
    if ((count ?? 0) >= event.capacity) {
      return json({ error: "Sorry, this event is fully booked." }, 409);
    }
  }

  const env: StripeEnv = await getActiveStripeEnv(admin);
  const parentUserId = user.id;
  const parentEmail = user.email.toLowerCase();
  const childName = child.name;
  const childMedical = body.medical_notes || child.medical_details || child.medical_needs || null;

  // --- Pending booking row (fulfilled by the webhook) ---
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      event_id: event.id,
      invitation_id: invitation?.id ?? null,
      parent_user_id: parentUserId,
      parent_name: body.parent_name,
      parent_email: parentEmail,
      parent_phone: body.parent_phone || null,
      child_id: child.id,
      child_name: childName,
      child_dob: child.date_of_birth ?? null,
      session_slot: body.session_slot || null,
      medical_notes: childMedical,
      photo_consent: !!body.photo_consent,
      amount_pence: amountPence,
      status: "pending",
      stripe_env: env,
    })
    .select("id")
    .single();
  if (bookingErr || !booking) {
    console.error("booking insert failed", bookingErr);
    return json({ error: "Could not start the booking — please try again." }, 500);
  }

  // --- Stripe payment, embedded on our own page (Payment Element) ---
  // One-offs: a PaymentIntent whose client_secret the booking page confirms
  // inline. Programmes: an incomplete subscription whose first invoice's
  // PaymentIntent is confirmed the same way. Both are direct charges on the
  // connected account with the platform fee, mirroring the reference setup.
  try {
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);
    const productName = isProgramme
      ? `${event.title} — monthly programme`
      : event.title;
    const description = [
      `Player: ${childName}`,
      body.session_slot || null,
      event.location || null,
      isProgramme ? `${event.programme_months} monthly payments` : null,
    ].filter(Boolean).join(" · ");

    const metadata = {
      bookingId: booking.id,
      eventId: event.id,
      checkoutType: isProgramme ? "programme_membership" : "event_booking",
    };

    let clientSecret: string;
    let paymentIntentId: string | null = null;

    if (isProgramme) {
      const feePercent = getConnectedAccountId(env) ? getPlatformFeePercent() : null;

      const customer = await stripe.customers.create(
        { email: parentEmail, name: body.parent_name, metadata },
        connectOpts,
      );
      const price = await stripe.prices.create(
        {
          currency: "gbp",
          unit_amount: amountPence,
          recurring: { interval: "month" },
          product_data: { name: productName },
        },
        connectOpts,
      );
      const subscription = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items: [{ price: price.id }],
          payment_behavior: "default_incomplete",
          payment_settings: {
            save_default_payment_method: "on_subscription",
            payment_method_types: ["card"],
          },
          ...(feePercent != null && { application_fee_percent: feePercent }),
          expand: ["latest_invoice.payment_intent"],
          metadata: { ...metadata, monthsTotal: String(event.programme_months) },
        },
        connectOpts,
      );

      const pi = (subscription.latest_invoice as any)?.payment_intent as any;
      if (!pi?.client_secret) throw new Error("subscription has no first-invoice PaymentIntent");
      clientSecret = pi.client_secret;
      paymentIntentId = pi.id ?? null;

      // Membership record up-front (status incomplete) so the invoice
      // webhooks can find it by subscription id; first paid invoice settles
      // the booking and activates it.
      const { data: membership } = await admin
        .from("memberships")
        .upsert({
          booking_id: booking.id,
          event_id: event.id,
          parent_user_id: parentUserId,
          parent_email: parentEmail,
          child_name: childName,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          stripe_env: env,
          monthly_amount_pence: amountPence,
          months_total: event.programme_months,
          status: "incomplete",
        }, { onConflict: "stripe_subscription_id" })
        .select("id")
        .maybeSingle();

      await admin
        .from("bookings")
        .update({
          membership_id: membership?.id ?? null,
          stripe_payment_intent_id: paymentIntentId,
        })
        .eq("id", booking.id);
    } else {
      const applicationFee = bookingApplicationFee(env, amountPence);
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountPence,
          currency: "gbp",
          payment_method_types: ["card"],
          description: `${productName} · ${description}`,
          receipt_email: parentEmail,
          ...(applicationFee != null && { application_fee_amount: applicationFee }),
          metadata,
        },
        connectOpts,
      );
      if (!paymentIntent.client_secret) throw new Error("PaymentIntent has no client_secret");
      clientSecret = paymentIntent.client_secret;
      paymentIntentId = paymentIntent.id;

      await admin
        .from("bookings")
        .update({ stripe_payment_intent_id: paymentIntentId })
        .eq("id", booking.id);
    }

    return json({
      client_secret: clientSecret,
      payment_intent_id: paymentIntentId,
      booking_id: booking.id,
      amount_pence: amountPence,
      environment: env,
      mode: isProgramme ? "subscription" : "payment",
      months_total: isProgramme ? event.programme_months : null,
    });
  } catch (error) {
    console.error("payment setup failed", error);
    await admin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return json({ error: "Payment setup failed — please try again shortly." }, 500);
  }
});
