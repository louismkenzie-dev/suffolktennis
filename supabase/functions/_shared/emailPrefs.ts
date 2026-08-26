// Per-recipient unsubscribe links.
//
// Every address we email gets a row in email_preferences with its own
// unguessable token, created on first send. The link only ever unsubscribes
// the person it was sent to, and no email address appears in the URL.
//
// What unsubscribing means: no more county programme updates. It does NOT
// stop the mail someone has actually asked for — verification codes, booking
// confirmations and entry tickets still send, because those are their own
// account and bookings rather than updates. The confirmation page says so.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

const SITE_URL = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

/** Base the Resend List-Unsubscribe header is built from (see resend.ts). */
export const unsubscribeBaseUrl = () => `${SITE_URL()}/unsubscribe`;

/**
 * Token for this address, creating one if we've never emailed them before.
 * Returns null if the lookup fails — callers then send without a link rather
 * than failing the email, since a missing footer link is far better than a
 * parent not receiving their ticket.
 */
export async function unsubscribeTokenFor(
  admin: SupabaseClient,
  email: string,
  source = "transactional",
): Promise<string | null> {
  const addr = email.trim().toLowerCase();
  if (!addr) return null;
  try {
    await admin.from("email_preferences")
      .insert({ email: addr, source })
      .select("email")
      .maybeSingle();
  } catch { /* already present — expected */ }

  const { data, error } = await admin
    .from("email_preferences")
    .select("unsub_token")
    .eq("email", addr)
    .maybeSingle();
  if (error || !data) {
    console.error("unsubscribe token lookup failed for", addr, error?.message);
    return null;
  }
  return data.unsub_token as string;
}

/** Full link for the email footer, or null when no token could be resolved. */
export function unsubscribeUrlFor(token: string | null): string | undefined {
  return token ? `${unsubscribeBaseUrl()}?token=${token}` : undefined;
}
