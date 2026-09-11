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
