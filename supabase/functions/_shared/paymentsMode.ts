// Server-side resolution of the active Stripe environment. The client no
// longer chooses sandbox vs live — a tampered request could otherwise force
// sandbox after go-live and "pay" for real bookings with a test card. The
// single switch lives in app_settings ('payments_mode'), writable only by
// admins and the service role. Flip to live:
//   update app_settings set value = 'live', updated_at = now()
//   where key = 'payments_mode';
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { StripeEnv } from "./stripe.ts";

export async function getActiveStripeEnv(admin?: SupabaseClient): Promise<StripeEnv> {
  const client = admin ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", "payments_mode")
    .maybeSingle();
  // Fail safe into sandbox: test mode rejects real cards, so the worst
  // outcome of a missing/unreadable switch is a declined payment — never a
  // charge in the wrong environment.
  if (error) {
    console.error("payments_mode lookup failed, defaulting to sandbox:", error.message);
    return "sandbox";
  }
  return data?.value === "live" ? "live" : "sandbox";
}

/**
 * Pre-launch wall. While the booking system is still on sandbox Stripe keys,
 * every checkout is blocked so an invitation link can be shared publicly
 * without anyone reaching a test-mode payment form. Open bookings with:
 *   update app_settings set value = 'open', updated_at = now()
 *   where key = 'bookings_status';
 *
 * Fails CLOSED: a missing row or an unreadable setting keeps the wall up,
 * because the cost of wrongly blocking a booking is a delay, while wrongly
 * allowing one is a parent "paying" with a test card.
 */
export type BookingsStatus = "coming_soon" | "open";

export async function getBookingsStatus(admin?: SupabaseClient): Promise<BookingsStatus> {
  const client = admin ?? createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await client
    .from("app_settings")
    .select("value")
    .eq("key", "bookings_status")
    .maybeSingle();
  if (error) {
    console.error("bookings_status lookup failed, keeping the wall up:", error.message);
    return "coming_soon";
  }
  return data?.value === "open" ? "open" : "coming_soon";
}

export const BOOKINGS_COMING_SOON_MESSAGE =
  "Online booking opens shortly — we're putting the finishing touches to the new Suffolk Tennis booking system. " +
  "Keep this link: you'll be able to book your place here as soon as it goes live, and we'll email you when it does.";
