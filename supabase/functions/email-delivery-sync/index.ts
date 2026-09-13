// Fills in what happened to the emails we sent. Run every 10 minutes by
// pg_cron; guard-token protected because the database calls it, not users.
//
// Resend knows whether each message was accepted by the recipient's mail
// server, bounced, or was marked as spam, but it only tells us if we ask.
// Each send parks a row in email_deliveries with Resend's message id and a
// status of 'sent'; this sweeps those rows forward.
//
// Two passes, cheapest first:
//   1. One call to the list endpoint covers the last 100 messages on the
//      account, which is everything recent in the normal case.
//   2. Anything still unsettled after 15 minutes — older than that window, or
//      sent while another project was busy — is fetched by id, capped per run.
//
// A hard bounce also goes into suppressed_emails so we stop mailing an
// address that cannot receive.
import { serviceClient, json } from "../_shared/adminAuth.ts";

const GUARD = "ed_2f7a9c4e1b6d8035af2c7e9b1d4a6f83";
const RESEND = "https://api.resend.com";

/** Unsettled states — worth asking Resend about again. */
const PENDING = ["sent", "scheduled", "delivery_delayed"];
/** Don't chase a message the instant it is sent; providers take a moment. */
const SETTLE_MINUTES = 15;
/** Cap the by-id pass so one run cannot hammer the API. */
const MAX_BY_ID = 25;

// Mirrors public.email_delivery_rank: later news wins, and a settled row is
// never dragged backwards by a stale event.
const RANK: Record<string, number> = {
  scheduled: 1, sent: 2, delivery_delayed: 3, delivered: 4,
  opened: 5, clicked: 6, complained: 7, bounced: 8, failed: 9,
};
const rank = (s: string) => RANK[s] ?? 0;

type Row = { id: string; resend_id: string; recipient: string; status: string; sent_at: string };

async function resendGet(apiKey: string, path: string, query?: Record<string, string>) {
  const url = new URL(`${RESEND}${path}`);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return await res.json();
}

/** The bounce reason, when Resend gives us one. */
function detailOf(email: Record<string, unknown>): string | null {
  const bounce = email?.bounce as Record<string, unknown> | undefined;
  if (!bounce) return null;
  const parts = [bounce.type, bounce.subType, bounce.message].filter(Boolean).map(String);
  return parts.length ? parts.join(" · ").slice(0, 500) : null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  if (body?.guard !== GUARD) return json({ error: "Forbidden" }, 403);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);
  const admin = serviceClient();

  const { data: pendingRows } = await admin
    .from("email_deliveries")
    .select("id, resend_id, recipient, status, sent_at")
    .in("status", PENDING)
    .order("sent_at", { ascending: false })
    .limit(500);
  const pending = (pendingRows ?? []) as Row[];
  if (pending.length === 0) return json({ pending: 0, updated: 0 });

  // Pass 1 — one list call, matched against our pending rows by message id.
  const latest = new Map<string, { status: string; detail: string | null }>();
  try {
    const page = await resendGet(apiKey, "/emails", { limit: "100" });
    for (const e of page?.data ?? []) {
      if (e?.id && e?.last_event) latest.set(String(e.id), { status: String(e.last_event), detail: detailOf(e) });
    }
  } catch (e) {
    console.error("list sweep failed", e instanceof Error ? e.message : String(e));
  }

  // Pass 2 — by id, for whatever the list did not cover and has had time to settle.
  const cutoff = Date.now() - SETTLE_MINUTES * 60_000;
  const stragglers = pending
    .filter((r) => !latest.has(r.resend_id) && new Date(r.sent_at).getTime() < cutoff)
    .sort((a, b) => a.sent_at.localeCompare(b.sent_at))
    .slice(0, MAX_BY_ID);
  for (const row of stragglers) {
    try {
      const e = await resendGet(apiKey, `/emails/${row.resend_id}`);
      if (e?.last_event) latest.set(row.resend_id, { status: String(e.last_event), detail: detailOf(e) });
    } catch (e) {
      console.error(`fetch ${row.resend_id} failed`, e instanceof Error ? e.message : String(e));
    }
  }

  const now = new Date().toISOString();
  let updated = 0;
  const suppress: Array<{ email: string; reason: string; metadata: Record<string, unknown> }> = [];

  for (const row of pending) {
    const found = latest.get(row.resend_id);
    if (!found) continue;
    if (rank(found.status) <= rank(row.status)) {
      await admin.from("email_deliveries").update({ checked_at: now }).eq("id", row.id);
      continue;
    }
    await admin.from("email_deliveries")
      .update({ status: found.status, status_at: now, checked_at: now, detail: found.detail })
      .eq("id", row.id);
    updated++;
    if (found.status === "bounced" || found.status === "complained") {
      suppress.push({
        email: row.recipient,
        reason: found.status === "bounced" ? "bounce" : "complaint",
        metadata: { resend_id: row.resend_id, detail: found.detail, source: "email-delivery-sync" },
      });
    }
  }

  // Stop mailing an address that cannot receive, or has told us to stop.
  for (const s of suppress) {
    const { data: already } = await admin
      .from("suppressed_emails").select("id").ilike("email", s.email).maybeSingle();
    if (already) continue;
    await admin.from("suppressed_emails").insert(s);
  }

  return json({ pending: pending.length, checked: latest.size, updated, suppressed: suppress.length });
});
