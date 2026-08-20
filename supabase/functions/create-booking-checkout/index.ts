// Creates a pending booking and a Stripe Checkout session (hosted page).
//
// Authorization is by invitation token for private events; public events with
// sign-up enabled can be booked without one. The client never chooses the
// Stripe environment — that comes from app_settings via getActiveStripeEnv.
//
// One-off events   -> mode "payment", price from events.price_pence.
// Monthly programme -> mode "subscription" (monthly), price from
//                     events.monthly_amount_pence; the parent commits to
//                     events.programme_months payments — enforced in the
//                     webhook, which cancels the subscription once the final
//                     committed month is paid.
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
  parent_name: z.string().trim().min(1).max(120),
  parent_email: z.string().trim().email().max(255),
  parent_phone: z.string().trim().max(40).optional().or(z.literal("")),
  child_name: z.string().trim().min(1).max(120),
  child_dob: z.string().trim().max(20).optional().or(z.literal("")),
  session_slot: z.string().trim().max(200).optional().or(z.literal("")),
  medical_notes: z.string().trim().max(1000).optional().or(z.literal("")),
  photo_consent: z.boolean().optional(),
});

function isValidReturnOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
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

  // --- Return URL ---
  const origin = req.headers.get("origin");
  const siteUrl = isValidReturnOrigin(origin) ? origin : (Deno.env.get("SITE_URL") ?? "https://suffolktennis.vercel.app");

  // Link the booking to a known parent account when the email matches one,
  // so the booking and ticket show up in their Parent Hub too.
  let parentUserId: string | null = null;
  try {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    parentUserId = users?.users?.find((u) => u.email?.toLowerCase() === body.parent_email.toLowerCase())?.id ?? null;
  } catch {
    parentUserId = null;
  }

  const env: StripeEnv = await getActiveStripeEnv(admin);

  // --- Pending booking row (fulfilled by the webhook) ---
  const { data: booking, error: bookingErr } = await admin
    .from("bookings")
    .insert({
      event_id: event.id,
      invitation_id: invitation?.id ?? null,
      parent_user_id: parentUserId,
      parent_name: body.parent_name,
      parent_email: body.parent_email.toLowerCase(),
      parent_phone: body.parent_phone || null,
      child_id: invitation?.child_id ?? null,
      child_name: body.child_name,
      child_dob: body.child_dob || null,
      session_slot: body.session_slot || null,
      medical_notes: body.medical_notes || null,
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

  // --- Stripe Checkout session ---
  try {
    const stripe = createStripeClient(env);
    const productName = isProgramme
      ? `${event.title} — monthly programme`
      : event.title;
    const description = [
      `Player: ${body.child_name}`,
      body.session_slot || null,
      event.location || null,
      isProgramme ? `${event.programme_months} monthly payments` : null,
    ].filter(Boolean).join(" · ");

    const common = {
      success_url: `${siteUrl}/booking/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/booking/return?cancelled=1`,
      customer_email: body.parent_email,
      metadata: {
        bookingId: booking.id,
        eventId: event.id,
        checkoutType: isProgramme ? "programme_membership" : "event_booking",
      },
    } as const;

    let session;
    if (isProgramme) {
      const feePercent = getConnectedAccountId(env) ? getPlatformFeePercent() : null;
      session = await stripe.checkout.sessions.create(
        {
          ...common,
          mode: "subscription",
          line_items: [{
            price_data: {
              currency: "gbp",
              product_data: { name: productName, description },
              unit_amount: amountPence,
              recurring: { interval: "month" },
            },
            quantity: 1,
          }],
          subscription_data: {
            metadata: {
              bookingId: booking.id,
              eventId: event.id,
              monthsTotal: String(event.programme_months),
            },
            ...(feePercent != null && { application_fee_percent: feePercent }),
          },
        },
        connectRequestOptions(env),
      );
    } else {
      const applicationFee = bookingApplicationFee(env, amountPence);
      session = await stripe.checkout.sessions.create(
        {
          ...common,
          mode: "payment",
          line_items: [{
            price_data: {
              currency: "gbp",
              product_data: { name: productName, description },
              unit_amount: amountPence,
            },
            quantity: 1,
          }],
          ...(applicationFee != null && {
            payment_intent_data: { application_fee_amount: applicationFee },
          }),
        },
        connectRequestOptions(env),
      );
    }

    await admin
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", booking.id);

    return json({ url: session.url, booking_id: booking.id });
  } catch (error) {
    console.error("checkout create failed", error);
    await admin.from("bookings").update({ status: "cancelled" }).eq("id", booking.id);
    return json({ error: "Payment setup failed — please try again shortly." }, 500);
  }
});
