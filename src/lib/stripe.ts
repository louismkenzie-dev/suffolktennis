import { loadStripe, Stripe } from "@stripe/stripe-js";

export type PaymentsEnvironment = "sandbox" | "live";

/**
 * Stripe.js configuration for the embedded booking checkout (Payment Element).
 *
 * Which environment is active is decided SERVER-SIDE (app_settings.payments_mode,
 * read by create-booking-checkout, which returns `environment` alongside the
 * client secret) — the client only picks the matching key PAIR here, so client
 * and server can never disagree. Publishable keys and connected-account ids are
 * public by design: they ship in every browser bundle.
 *
 * Stripe.js must be initialised WITH the connected account (Stripe Connect
 * direct charges) or confirming the PaymentIntent fails.
 */

// Sandbox pair — Nullshift platform test publishable key + test connected account.
const SANDBOX_PUBLISHABLE_KEY =
  "pk_test_51TgWSaE0aLvInrlqDFLIKrIu5yfVvKINObl3FYzft8FrIWuotaDqMe05whnwLBt33krOYin0PlcK230U0vuhDbqa00gd2rgcIs";
const SANDBOX_CONNECTED_ACCOUNT = "acct_1TnJ2NE0aLUyRazc";

// Live pair — filled in when Suffolk Tennis's live connected account (Karen's)
// is set up. Until then live mode fails closed rather than falling back to test.
const LIVE_PUBLISHABLE_KEY = "";
const LIVE_CONNECTED_ACCOUNT = "";

const stripeByEnv = new Map<PaymentsEnvironment, Promise<Stripe | null>>();

export function getStripeFor(env: PaymentsEnvironment): Promise<Stripe | null> {
  let promise = stripeByEnv.get(env);
  if (!promise) {
    const [key, account] = env === "live"
      ? [LIVE_PUBLISHABLE_KEY, LIVE_CONNECTED_ACCOUNT]
      : [SANDBOX_PUBLISHABLE_KEY, SANDBOX_CONNECTED_ACCOUNT];
    if (env === "live" && !key.startsWith("pk_live_")) {
      return Promise.reject(
        new Error("Live payments are not configured in this build — please try again shortly."),
      );
    }
    promise = loadStripe(key, account ? { stripeAccount: account } : undefined)
      .catch((e) => {
        stripeByEnv.delete(env); // don't cache failures — allow retry
        throw e;
      });
    stripeByEnv.set(env, promise);
  }
  return promise;
}
