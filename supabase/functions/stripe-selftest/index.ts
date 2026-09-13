// Throwaway self-test for the monthly-plan Stripe wiring.
//
// It builds a subscription with exactly the parameters create-booking-checkout
// uses, reads back what Stripe actually stored, and deletes it again. Nothing
// is ever charged: `payment_behavior: "default_incomplete"` leaves the first
// invoice awaiting confirmation, and no payment method is attached.
//
// SANDBOX ONLY, and guard-token protected. Delete this function once the
// monthly plan has been exercised with a real test card.
import { serviceClient, json } from "../_shared/adminAuth.ts";
import { connectRequestOptions, createStripeClient, getConnectedAccountId, getPlatformFeePercent } from "../_shared/stripe.ts";

const GUARD = "st_selftest_6a1c9e4f2b7d3805";

/** Same clamp as create-booking-checkout — the whole point is to check it. */
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

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  if (body?.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const secrets = {
    STRIPE_SANDBOX_API_KEY: !!Deno.env.get("STRIPE_SANDBOX_API_KEY"),
    STRIPE_LIVE_API_KEY: !!Deno.env.get("STRIPE_LIVE_API_KEY"),
    STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID: !!Deno.env.get("STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID"),
    STRIPE_LIVE_CONNECTED_ACCOUNT_ID: !!Deno.env.get("STRIPE_LIVE_CONNECTED_ACCOUNT_ID"),
    PAYMENTS_SANDBOX_WEBHOOK_SECRET: !!Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET"),
    PAYMENTS_LIVE_WEBHOOK_SECRET: !!Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET"),
  };

  // The month arithmetic is pure, so it can be checked whatever Stripe is set up.
  const months = 12;
  const clampCases = [
    { from: "2026-01-31T10:00:00Z", expect: "2027-01-31T10:00:00.000Z" },
    { from: "2026-03-31T10:00:00Z", expect: "2027-03-31T10:00:00.000Z" },
    // A genuine leap date: 2026 has no 29 February, so that string would be
    // parsed as 1 March and prove nothing.
    { from: "2028-02-29T10:00:00Z", expect: "2029-02-28T10:00:00.000Z" },
    { from: "2026-09-13T10:00:00Z", expect: "2027-09-13T10:00:00.000Z" },
  ].map((c) => {
    const got = addMonthsClamped(new Date(c.from), months).toISOString();
    return { ...c, got, ok: got === c.expect };
  });
  // One month at a time from a 31st anchor: Stripe clamps to the short month
  // and returns to the 31st afterwards, and so must we.
  const monthlyWalk = Array.from({ length: 13 }, (_, i) =>
    addMonthsClamped(new Date("2026-01-31T10:00:00Z"), i).toISOString().slice(0, 10));

  // Which events each environment's webhook endpoint is actually subscribed
  // to. A monthly plan settles on invoice.payment_succeeded, so an endpoint
  // that does not listen for it would take the money and never issue a ticket.
  const webhooks: Record<string, unknown> = {};
  for (const env of ["sandbox", "live"] as const) {
    const keyName = env === "sandbox" ? "STRIPE_SANDBOX_API_KEY" : "STRIPE_LIVE_API_KEY";
    if (!Deno.env.get(keyName)) { webhooks[env] = `${keyName} not set`; continue; }
    try {
      // Webhook endpoints live on the PLATFORM account, not the connected one.
      const list = await createStripeClient(env).webhookEndpoints.list({ limit: 10 });
      webhooks[env] = list.data.map((w: any) => ({
        id: w.id, url: w.url, status: w.status, connect: w.application === null ? w.metadata?.connect ?? null : null,
        api_version: w.api_version, enabled_events: w.enabled_events,
      }));
    } catch (e) {
      webhooks[env] = e instanceof Error ? e.message : String(e);
    }
  }

  if (body?.stripe !== true) return json({ secrets, clampCases, monthlyWalk, webhooks });
  if (!secrets.STRIPE_SANDBOX_API_KEY) {
    return json({ secrets, clampCases, monthlyWalk, webhooks, stripe: "STRIPE_SANDBOX_API_KEY not set" });
  }

  // --- Build the real thing in sandbox, inspect it, delete it. ---
  const env = "sandbox" as const;
  const stripe = createStripeClient(env);
  const connectOpts = connectRequestOptions(env);
  const feePercent = getConnectedAccountId(env) ? getPlatformFeePercent() : null;
  const startedAt = new Date();
  const cancelAt = Math.floor((addMonthsClamped(startedAt, months).getTime() - 60 * 60 * 1000) / 1000);

  let customerId: string | null = null;
  let subscriptionId: string | null = null;
  let productId: string | null = null;
  try {
    const customer = await stripe.customers.create(
      { email: "selftest@example.invalid", name: "Self test" }, connectOpts,
    );
    customerId = customer.id;

    const product = await stripe.products.create({ name: "Self test — monthly plan" }, connectOpts);
    productId = product.id;

    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{
        price_data: {
          currency: "gbp",
          unit_amount: 2500,
          recurring: { interval: "month" },
          product: product.id,
        },
      }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      cancel_at: cancelAt,
      ...(feePercent != null && feePercent > 0 && { application_fee_percent: feePercent }),
      metadata: { checkoutType: "selftest" },
      expand: ["latest_invoice.payment_intent"],
    }, connectOpts) as any;
    subscriptionId = sub.id;

    const invoice = sub.latest_invoice;
    const periodEnd = sub.current_period_end as number;
    // 12 monthly periods from the start: the invoice count between the first
    // billing date and cancel_at.
    const billedMonths = Math.round((cancelAt - (sub.start_date as number)) / (30.4375 * 86400));

    return json({
      secrets,
      clampCases,
      monthlyWalk,
      webhooks,
      stripe: {
        connected_account: getConnectedAccountId(env),
        status: sub.status,
        collection_method: sub.collection_method,
        interval: sub.items?.data?.[0]?.price?.recurring?.interval,
        unit_amount: sub.items?.data?.[0]?.price?.unit_amount,
        application_fee_percent: sub.application_fee_percent,
        save_default_payment_method: sub.payment_settings?.save_default_payment_method,
        start_date: new Date((sub.start_date as number) * 1000).toISOString(),
        first_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at: new Date((sub.cancel_at as number) * 1000).toISOString(),
        cancel_at_matches_requested: sub.cancel_at === cancelAt,
        approx_billed_months: billedMonths,
        first_invoice_amount_due: invoice?.amount_due,
        first_invoice_has_client_secret: !!invoice?.payment_intent?.client_secret,
      },
    });
  } catch (e) {
    return json({ secrets, clampCases, monthlyWalk, webhooks, stripe_error: e instanceof Error ? e.message : String(e) }, 200);
  } finally {
    // Never leave test objects behind, even on a failure.
    try { if (subscriptionId) await stripe.subscriptions.cancel(subscriptionId, connectOpts); } catch { /* already gone */ }
    try { if (customerId) await stripe.customers.del(customerId, connectOpts); } catch { /* already gone */ }
    try { if (productId) await stripe.products.update(productId, { active: false }, connectOpts); } catch { /* already gone */ }
  }
});
