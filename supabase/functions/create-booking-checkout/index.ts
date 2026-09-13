// Creates a pending booking and, where money is due, the Stripe PaymentIntent
// for the EMBEDDED checkout (Payment Element on our own booking page).
//
// Authorization is by invitation token for private events; public events with
// sign-up enabled can be booked without one. The client never chooses the
// Stripe environment — that comes from app_settings via getActiveStripeEnv;
// the response's `environment` tells the client which publishable-key pair to
// load Stripe.js with.
//
// Pricing model (Ollie, 10 Sep 2026):
//   event      -> one payment of events.price_pence, or free (events.is_free)
//   programme  -> either one up-front payment of events.price_pence, or, when
//                 the programme offers it, a committed run of
//                 events.programme_months monthly charges of
//                 events.monthly_amount_pence. The monthly total is higher on
//                 purpose: paying in full carries a discount.
//   complimentary invitation -> no charge: a child already paying for a
//                 programme is included on any other programme, and admins can
//                 grant a free place by hand.
// Free and complimentary bookings settle here immediately (ticket + email);
// one-off card payments settle when the webhook sees
// payment_intent.succeeded; monthly plans settle on the first
// invoice.payment_succeeded.
//
// A monthly plan is a COMMITMENT, and Stripe is set up to honour exactly that:
// the subscription is created with the card saved as the default payment
// method, so every month is charged automatically without the parent doing
// anything, and with `cancel_at` pinned just inside the final billing period
// so it can never bill a thirteenth month even if a webhook is missed. The
// parent must tick the commitment box before we get here; that acceptance is
// stamped on the booking.
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
import { settleBooking } from "../_shared/fulfilment.ts";
import { commitmentSentence, gbp, programmePricing } from "../_shared/programmePricing.ts";

const Body = z.object({
  invitation_token: z.string().regex(/^[a-f0-9]{16,}$/).optional(),
  event_id: z.string().uuid().optional(),
  child_id: z.string().uuid(),
  parent_name: z.string().trim().min(1).max(120),
  parent_phone: z.string().trim().max(40).optional().or(z.literal("")),
  session_slot: z.string().trim().max(200).optional().or(z.literal("")),
  medical_notes: z.string().trim().max(1000).optional().or(z.literal("")),
  photo_consent: z.boolean().optional(),
  /** "full" = one payment; "monthly" = the committed monthly plan. */
  payment_plan: z.enum(["full", "monthly"]).optional(),
  /** The parent ticked the box spelling out the monthly commitment. */
  commitment_accepted: z.boolean().optional(),
});

/**
 * Stripe rolls a billing date forward by keeping the day of the month and
 * clamping it to the length of the target month (31 Jan + 1 month = 28 Feb).
 * `setUTCMonth` overflows instead, so do the clamp ourselves — the cancel
 * date has to line up with Stripe's own schedule to the hour.
 */
function addMonthsClamped(from: Date, months: number): Date {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const day = from.getUTCDate();
  const lastOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    y, m, Math.min(day, lastOfTarget),
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(),
  ));
}

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
  // profile (photo included) before they can book. ---
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
  let invitation: { id: string; event_id: string; status: string; child_id: string | null; complimentary: boolean } | null = null;
  let eventId = body.event_id ?? null;

  if (body.invitation_token) {
    const { data } = await admin
      .from("booking_invitations")
      .select("id, event_id, status, child_id, parent_email, parent_user_id, complimentary")
      .eq("token", body.invitation_token)
      .maybeSingle();
    if (!data) return json({ error: "Invitation not found" }, 404);
    if (data.status === "revoked" || data.status === "expired") {
      return json({ error: "This invitation is no longer valid" }, 410);
    }
    // The invitation is personal: only the account it was addressed to can
    // book with it (linked account id, or the invited email address).
    const invitedEmail = (data.parent_email ?? "").toLowerCase();
    const isInvitee = data.parent_user_id === user.id
      || (invitedEmail !== "" && invitedEmail === user.email.toLowerCase());
    if (!isInvitee) {
      return json({
        error: "This invitation was sent to a different email address — please sign in with the account it was emailed to.",
      }, 403);
    }
    invitation = data;
    eventId = data.event_id;
  }
  if (!eventId) return json({ error: "event_id or invitation_token required" }, 400);

  const { data: event } = await admin
    .from("events")
    .select("id, title, location, visibility, sign_up_enabled, capacity, programme_type, price_pence, monthly_amount_pence, programme_months, is_free, meeting_cadence, cancelled_at")
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return json({ error: "Event not found" }, 404);
  if (event.cancelled_at) {
    return json({ error: "This event has been cancelled — Suffolk Tennis will be in touch." }, 410);
  }

  // Private events strictly require an invitation; public ones require
  // sign-ups to be open.
  if (event.visibility === "private" && !invitation) {
    return json({ error: "This event is invitation only" }, 403);
  }
  if (event.visibility === "public" && !invitation && !event.sign_up_enabled) {
    return json({ error: "Sign-ups are closed for this event" }, 400);
  }

  const isProgramme = event.programme_type === "programme";

  // --- Duplicate guard, BEFORE any money moves: one paid place per child per
  // event. The booking page hides the form once booked, but a stale tab or a
  // second invitation must never charge a parent twice. ---
  const { data: alreadyPaid } = await admin
    .from("bookings")
    .select("id")
    .eq("event_id", event.id)
    .eq("child_id", child.id)
    .eq("status", "paid")
    .limit(1)
    .maybeSingle();
  if (alreadyPaid) {
    return json({
      error: `${child.name} already has a place on this ${isProgramme ? "programme" : "event"} — check your Parent Hub.`,
      already_booked: true,
    }, 409);
  }

  // A complimentary invitation is only honoured on the invitation it was
  // granted for; free events are free for everyone.
  const complimentary = !!invitation?.complimentary;
  const noCharge = event.is_free || complimentary;

  // Which of the two ways to pay this is. Monthly is only ever honoured when
  // the programme offers it AND the parent ticked the commitment box — a
  // client that skips either gets the up-front price, never a silent
  // subscription.
  const pricing = programmePricing(event);
  const wantsMonthly = body.payment_plan === "monthly" && !noCharge;
  if (wantsMonthly && !pricing.offersMonthly) {
    return json({ error: "Monthly payments are not available for this programme." }, 400);
  }
  if (wantsMonthly && body.commitment_accepted !== true) {
    return json({
      error: `Please confirm the ${pricing.months}-month commitment before paying monthly.`,
    }, 400);
  }
  const monthly = wantsMonthly && pricing.offersMonthly;

  // What the card is charged now: the whole programme, or the first month.
  const amountPence = noCharge ? 0 : monthly ? pricing.monthlyPence : (event.price_pence ?? 0);

  if (!noCharge && amountPence < 30) {
    return json({ error: "This event does not have online payment configured — please contact Suffolk Tennis." }, 400);
  }

  // --- Capacity (events only — programmes have none): paid bookings plus
  // checkouts started in the last 30 min ---
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
  const parentEmail = user.email.toLowerCase();
  const childName = child.name;
  const childMedical = body.medical_notes || child.medical_details || child.medical_needs || null;

  // --- Pending booking row ---
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      event_id: event.id,
      invitation_id: invitation?.id ?? null,
      parent_user_id: user.id,
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
      complimentary,
      payment_plan: monthly ? "monthly" : "full",
      commitment_accepted_at: monthly ? new Date().toISOString() : null,
      status: "pending",
      stripe_env: env,
    })
    .select("id")
    .single();
  if (bookingErr || !booking) {
    console.error("booking insert failed", bookingErr);
    return json({ error: "Could not start the booking — please try again." }, 500);
  }

  // --- Nothing to pay: settle straight away (ticket + confirmation email). ---
  if (noCharge) {
    await settleBooking(admin, booking.id);
    return json({
      free: true,
      booking_id: booking.id,
      amount_pence: 0,
      environment: env,
      mode: "free",
      complimentary,
    });
  }

  // --- Stripe payment, embedded on our own page (Payment Element): a single
  // PaymentIntent for events and programmes alike, as a direct charge on the
  // connected account with the platform fee. ---
  try {
    const stripe = createStripeClient(env);
    const connectOpts = connectRequestOptions(env);

    // --- Monthly plan: a subscription that charges the card every month for
    // the committed number of months, then stops of its own accord. ---
    if (monthly) {
      // One customer per parent on the connected account, so a second child
      // does not create a duplicate card on file.
      const existing = await stripe.customers.list({ email: parentEmail, limit: 1 }, connectOpts);
      const customer = existing.data[0]
        ?? await stripe.customers.create({ email: parentEmail, name: body.parent_name }, connectOpts);

      const feePercent = getConnectedAccountId(env) ? getPlatformFeePercent() : null;
      const startedAt = new Date();
      // Pinned an hour inside the final billing period: after the last
      // invoice has been raised, before a further one ever could be. Even if
      // every webhook were lost, Stripe cannot bill month 13.
      const cancelAt = Math.floor(
        (addMonthsClamped(startedAt, pricing.months).getTime() - 60 * 60 * 1000) / 1000,
      );

      // Subscription items need a real Product; `product_data` is a Checkout
      // Session convenience that the Subscriptions API rejects. One product
      // per programme, addressed by a deterministic id so the second parent
      // to sign up reuses it rather than cluttering Stripe with duplicates.
      const productId = `suffolk_prog_${event.id.replace(/-/g, "")}`;
      let product;
      try {
        product = await stripe.products.retrieve(productId, connectOpts);
      } catch {
        product = await stripe.products.create(
          { id: productId, name: `${event.title} — monthly plan` },
          connectOpts,
        );
      }

      const subscription = await stripe.subscriptions.create(
        {
          customer: customer.id,
          items: [{
            price_data: {
              currency: "gbp",
              unit_amount: pricing.monthlyPence,
              recurring: { interval: "month" },
              product: product.id,
            },
          }],
          // The first payment is confirmed on our own page with the Payment
          // Element; nothing is charged until the parent confirms it.
          payment_behavior: "default_incomplete",
          payment_settings: {
            payment_method_types: ["card"],
            // Keeps the card as the default for every later month, so the
            // remaining payments are taken automatically.
            save_default_payment_method: "on_subscription",
          },
          cancel_at: cancelAt,
          ...(feePercent != null && feePercent > 0 && { application_fee_percent: feePercent }),
          description: `${event.title} · ${childName} · ${pricing.months} monthly payments of ${gbp(pricing.monthlyPence)}`,
          metadata: {
            bookingId: booking.id,
            eventId: event.id,
            checkoutType: "programme_monthly",
            monthsTotal: String(pricing.months),
            commitmentTotalPence: String(pricing.monthlyTotalPence),
          },
          expand: ["latest_invoice.payment_intent"],
        },
        connectOpts,
      );

      const invoice = subscription.latest_invoice as any;
      const intent = invoice?.payment_intent;
      if (!intent?.client_secret) throw new Error("Subscription has no first-invoice client_secret");

      // The membership is written here rather than from a webhook: the
      // embedded flow has no Checkout Session to hang it off, and
      // invoice.payment_succeeded needs a row to find by subscription id.
      const { data: membership } = await admin
        .from("memberships")
        .upsert({
          booking_id: booking.id,
          event_id: event.id,
          parent_user_id: user.id,
          parent_email: parentEmail,
          child_name: childName,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          stripe_env: env,
          monthly_amount_pence: pricing.monthlyPence,
          months_total: pricing.months,
          status: "incomplete",
        }, { onConflict: "stripe_subscription_id" })
        .select("id")
        .single();
      if (membership) {
        await admin.from("bookings").update({ membership_id: membership.id }).eq("id", booking.id);
      }

      return json({
        client_secret: intent.client_secret,
        payment_intent_id: typeof intent.id === "string" ? intent.id : null,
        booking_id: booking.id,
        amount_pence: pricing.monthlyPence,
        environment: env,
        mode: "subscription",
        is_programme: true,
        months_total: pricing.months,
        commitment_total_pence: pricing.monthlyTotalPence,
        commitment: commitmentSentence(pricing),
      });
    }

    const description = [
      `Player: ${childName}`,
      body.session_slot || null,
      event.location || null,
      isProgramme ? `full programme (${event.meeting_cadence ?? "regular"} sessions)` : null,
    ].filter(Boolean).join(" · ");

    const applicationFee = bookingApplicationFee(env, amountPence);
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountPence,
        currency: "gbp",
        payment_method_types: ["card"],
        description: `${event.title} · ${description}`,
        receipt_email: parentEmail,
        ...(applicationFee != null && { application_fee_amount: applicationFee }),
        metadata: {
          bookingId: booking.id,
          eventId: event.id,
          checkoutType: isProgramme ? "programme" : "event_booking",
        },
      },
      connectOpts,
    );
    if (!paymentIntent.client_secret) throw new Error("PaymentIntent has no client_secret");

    await admin
      .from("bookings")
      .update({ stripe_payment_intent_id: paymentIntent.id })
      .eq("id", booking.id);

    return json({
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      booking_id: booking.id,
      amount_pence: amountPence,
      environment: env,
      mode: "payment",
      is_programme: isProgramme,
    });
  } catch (error) {
    console.error("payment setup failed", error);
    await admin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return json({ error: "Payment setup failed — please try again shortly." }, 500);
  }
});
