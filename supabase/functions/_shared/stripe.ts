import { encode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

export type StripeEnv = 'sandbox' | 'live';

import Stripe from "https://esm.sh/stripe@18.5.0";

function getStripeSecretKey(env: StripeEnv): string {
  const key = env === 'sandbox'
    ? Deno.env.get('STRIPE_SANDBOX_API_KEY')
    : Deno.env.get('STRIPE_LIVE_API_KEY');
  if (!key) throw new Error(`STRIPE_${env.toUpperCase()}_API_KEY is not configured`);
  return key;
}

// Direct Stripe API (api.stripe.com) — no third-party gateway.
// PINNED API VERSION: stripe-node v18 defaults to the 2025 "Basil" API, which
// removed `invoice.payment_intent`, `payment_intent.invoice` and subscription-
// level `current_period_end` — shapes this codebase's subscription flow relies
// on (expand latest_invoice.payment_intent, invoice-PI routing, period dates).
// Pin the last pre-Basil version so every request/response matches the code.
export const STRIPE_API_VERSION = "2025-02-24.acacia";

export function createStripeClient(env: StripeEnv): Stripe {
  return new Stripe(getStripeSecretKey(env), {
    httpClient: Stripe.createFetchHttpClient(),
    apiVersion: STRIPE_API_VERSION as any,
  });
}

import { DEFAULT_PLATFORM_FEE_PERCENT, platformFeePence } from "./platformFee.ts";
export { platformFeePence };

/**
 * Stripe Connect (agreed commercial model): the API keys belong to the
 * Nullshift PLATFORM account, and every charge is created as a DIRECT charge
 * on Suffolk Tennis's CONNECTED account via the Stripe-Account header.
 * Stripe deducts its processing fees on the connected account, the platform
 * collects a 1% application fee, and the remainder settles with
 * Suffolk Tennis (the LTA county partnership).
 *
 * When no connected-account id is configured for the environment, everything
 * falls back to the pre-Connect behaviour (charges directly on the account
 * that owns the API key, no application fee) so sandbox keeps working until
 * Connect is fully configured.
 */
export function getConnectedAccountId(env: StripeEnv): string | null {
  const id = env === "sandbox"
    ? Deno.env.get("STRIPE_SANDBOX_CONNECTED_ACCOUNT_ID")
    : Deno.env.get("STRIPE_LIVE_CONNECTED_ACCOUNT_ID");
  return id && id.startsWith("acct_") ? id : null;
}

/** Per-request options routing an API call to the connected account. */
export function connectRequestOptions(env: StripeEnv): { stripeAccount: string } | Record<string, never> {
  const acct = getConnectedAccountId(env);
  return acct ? { stripeAccount: acct } : {};
}

/** Platform fee percent (default 1%), overridable via PLATFORM_FEE_PERCENT. */
export function getPlatformFeePercent(): number {
  const raw = Deno.env.get("PLATFORM_FEE_PERCENT");
  const parsed = raw != null ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_PLATFORM_FEE_PERCENT;
}

/**
 * Application fee for a charge (applies to ALL payments — bookings and merch),
 * or null when Connect is not configured for this environment (fallback mode —
 * no fee possible).
 */
export function bookingApplicationFee(env: StripeEnv, amountInPence: number): number | null {
  if (!getConnectedAccountId(env)) return null;
  const fee = platformFeePence(amountInPence, getPlatformFeePercent());
  return fee > 0 ? fee : null;
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!secret) throw new Error('Webhook secret environment variable is not configured');
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
