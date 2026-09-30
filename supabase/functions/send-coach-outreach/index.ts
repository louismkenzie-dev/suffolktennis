// Sends the "Connecting Suffolk's 10U Pathway" email (content.ts) to clubs,
// coaches and schools.
//
//   { action: "test", to: "one@address" }        one copy, subject prefixed [TEST]
//   { action: "send", to: ["a@…", "b@…"] }        the real send, admin only
//
// Both need an admin session, or `guard`: matched against
// app_settings.coach_outreach_guard (random, generated in the DB, never
// committed, admin-readable only), so a proof or the approved send can be
// run from the database without a browser login. Delete that row as soon as
// it is not needed.
//
// A real send skips anyone this email has already been sent to (recorded in
// email_deliveries), so a batch can be retried without doubling up.
//
// Recipients here are not platform accounts, so each send goes through the
// same suppression and unsubscribe handling as a campaign: anyone who has
// opted out is skipped, and every copy carries their own unsubscribe link.
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { recordDelivery } from "../_shared/emailDeliveries.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";
import { build } from "./content.ts";

const FROM = Deno.env.get("RESEND_FROM") ?? "Suffolk Tennis <noreply@suffolktennis.online>";
const MAX_PER_CALL = 200;

type Body = { action?: string; to?: string | string[]; guard?: string };

const norm = (e: unknown) => String(e ?? "").trim().toLowerCase();
const looksLikeEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

async function sendOne(admin: ReturnType<typeof serviceClient>, apiKey: string, to: string, test: boolean) {
  const { data: pref } = await admin.from("email_preferences")
    .select("unsubscribed_at").eq("email", to).maybeSingle();
  if (!test && pref?.unsubscribed_at) return { to, sent: false, skipped: "unsubscribed" };

  const token = await unsubscribeTokenFor(admin, to, "coach_outreach");
  const { subject, html } = build(unsubscribeUrlFor(token));
  const { id } = await sendEmail({
    to, from: FROM,
    subject: test ? `[TEST] ${subject}` : subject,
    html,
    unsubscribe_token: token ?? undefined,
    idempotency_key: test ? undefined : `coach-outreach-${to}`,
    purpose: "coach_outreach",
  }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
  await recordDelivery(admin, { resendId: id, recipient: to, subject, purpose: "coach_outreach" });
  return { to, sent: true, resend_id: id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = serviceClient();
  const adminUserId = await requireAdmin(req, admin);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

  const guardOk = async () => {
    if (!body.guard) return false;
    const { data: setting } = await admin.from("app_settings")
      .select("value").eq("key", "coach_outreach_guard").maybeSingle();
    return !!setting?.value && body.guard === setting.value;
  };

  if (body.action === "test") {
    if (!adminUserId && !(await guardOk())) return json({ error: "Forbidden" }, 403);
    const to = norm(Array.isArray(body.to) ? body.to[0] : body.to);
    if (!looksLikeEmail(to)) return json({ error: "to must be an email address" }, 400);
    try {
      return json(await sendOne(admin, apiKey, to, true));
    } catch (e) {
      return json({ error: String((e as Error).message ?? e) }, 502);
    }
  }

  if (body.action === "send") {
    if (!adminUserId && !(await guardOk())) return json({ error: "Forbidden" }, 403);
    const list = [...new Set((Array.isArray(body.to) ? body.to : [body.to]).map(norm).filter(looksLikeEmail))];
    if (!list.length) return json({ error: "to must be a list of email addresses" }, 400);
    if (list.length > MAX_PER_CALL) return json({ error: `at most ${MAX_PER_CALL} addresses per call` }, 400);
    const { data: done } = await admin.from("email_deliveries")
      .select("recipient").eq("purpose", "coach_outreach").in("recipient", list);
    const already = new Set((done ?? []).map((d: { recipient: string }) => d.recipient.toLowerCase()));
    const results = [];
    for (const to of list) {
      if (already.has(to)) { results.push({ to, sent: false, skipped: "already_sent" }); continue; }
      try {
        results.push(await sendOne(admin, apiKey, to, false));
      } catch (e) {
        results.push({ to, sent: false, error: String((e as Error).message ?? e) });
      }
      // Well under Resend's per-second limit.
      await new Promise((r) => setTimeout(r, 250));
    }
    return json({ sent: results.filter((r) => r.sent).length, results });
  }

  return json({ error: `Unknown action: ${body.action}` }, 400);
});
