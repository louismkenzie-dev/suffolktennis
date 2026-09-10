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
//   programme  -> one up-front payment of events.price_pence (£250) covering
//                 every session. No subscriptions.
//   complimentary invitation -> no charge: a child already paying for a
//                 programme is included on any other programme, and admins can
//                 grant a free place by hand.
// Free and complimentary bookings settle here immediately (ticket + email);
// paid ones settle when the webhook sees payment_intent.succeeded.
import { z } from "npm:zod@3.23.8";
import {
  type StripeEnv,
  bookingApplicationFee,
  connectRequestOptions,
  createStripeClient,
} from "../_shared/stripe.ts";
import { BOOKINGS_COMING_SOON_MESSAGE, getActiveStripeEnv, getBookingsStatus } from "../_shared/paymentsMode.ts";
import { serviceClient, CORS, json } from "../_shared/adminAuth.ts";
import { settleBooking } from "../_shared/fulfilment.ts";

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

  // --- Pre-launch wall: no checkout can be created while bookings are marked
  // coming soon. Enforced here, not just in the UI, so a shared link or a
  // direct API call can't reach the sandbox payment form. ---
  if (await getBookingsStatus(admin) !== "open") {
    return json({ error: BOOKINGS_COMING_SOON_MESSAGE, coming_soon: true }, 503);
  }

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
    .select("id, title, location, visibility, sign_up_enabled, capacity, programme_type, price_pence, is_free, meeting_cadence, cancelled_at")
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
  const amountPence = noCharge ? 0 : (event.price_pence ?? 0);

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
