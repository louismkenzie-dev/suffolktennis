// One-off sender for the 9U & 10U Programme Update (2026/27).
//
// The layout is richer than the admin composer's block editor can express —
// full-bleed photo bands, a two-column timetable, date pills — so it lives in
// content.ts and is sent from here. Guard-token protected; delete once the
// mailing has gone out.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";
import { build } from "./content.ts";

const GUARD = "a71c3e05f9b24d6e8c1f0b47d2a9e63f";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: { guard?: string; to?: string[]; preview?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (body.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return json({ error: "RESEND_API_KEY not set" }, 500);

  // preview returns the rendered HTML without sending, so the markup can be
  // checked against what will actually leave the building.
  if (body.preview) {
    const { subject, html } = build("https://suffolktennis.online/unsubscribe?token=preview");
    return json({ subject, bytes: html.length, html });
  }

  const recipients = (body.to ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean);
  if (recipients.length === 0) return json({ error: "to required" }, 400);
  if (recipients.length > 50) return json({ error: "max 50 per call" }, 400);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Array<Record<string, unknown>> = [];
  for (const to of recipients) {
    try {
      // Each recipient gets their own unsubscribe token, as every other send does.
      const token = await unsubscribeTokenFor(admin, to, "county_9u10u");
      const { subject, html } = build(unsubscribeUrlFor(token));
      const res = await sendEmail(
        { to, subject, html, unsubscribe_token: token ?? undefined, idempotency_key: `county-9u10u-${to}` },
        { apiKey: resendKey, unsubscribeBaseUrl: unsubscribeBaseUrl() },
      );
      results.push({ to, ok: true, id: res.id });
    } catch (e) {
      results.push({ to, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  return json({ sent: results.filter((r) => r.ok).length, total: results.length, results });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
