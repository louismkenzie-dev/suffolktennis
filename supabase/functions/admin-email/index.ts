// Admin email broadcasts: audience groups, recipient management and sending.
//
// Every action is admin-only (requireAdmin). The suppression list is applied
// here, at send time, rather than trusted to whoever built the audience — an
// unsubscribed address cannot be emailed by any route through this function.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { renderCampaign, type Block } from "../_shared/emailBlocks.ts";
import { unsubscribeBaseUrl } from "../_shared/emailPrefs.ts";

const RESEND_BATCH = "https://api.resend.com/emails/batch";
const FROM = Deno.env.get("RESEND_FROM") ?? "Suffolk Tennis <noreply@suffolktennis.online>";
const REPLY_TO = "enquiries@suffolktennis.online";
/** Resend caps a batch at 100; also keeps each request a sane size. */
const BATCH_SIZE = 100;

const Body = z.object({
  action: z.string(),
  group_id: z.string().uuid().optional(),
  campaign_id: z.string().uuid().optional(),
  name: z.string().trim().max(120).optional(),
  description: z.string().trim().max(500).optional(),
  emails: z.array(z.string().trim().email()).max(2000).optional(),
  email: z.string().trim().email().optional(),
  search: z.string().trim().max(200).optional(),
  subject: z.string().trim().max(200).optional(),
  preheader: z.string().trim().max(300).optional(),
  hero_url: z.string().trim().max(500).nullable().optional(),
  blocks: z.array(z.record(z.unknown())).max(100).optional(),
  audience: z.object({
    type: z.enum(["all", "group"]),
    group_id: z.string().uuid().optional(),
  }).optional(),
  test_to: z.string().trim().email().optional(),
  /** set_subscription: true = resubscribe, false = unsubscribe. */
  subscribed: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const adminUserId = await requireAdmin(req, admin);
  if (!adminUserId) return json({ error: "Admin access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const norm = (e: string) => e.trim().toLowerCase();

  /** Make sure every address has a preferences row (and so a token). */
  async function ensurePrefs(emails: string[], source: string) {
    if (!emails.length) return;
    const rows = emails.map((email) => ({ email, source }));
    for (let i = 0; i < rows.length; i += 500) {
      await admin.from("email_preferences")
        .upsert(rows.slice(i, i + 500), { onConflict: "email", ignoreDuplicates: true });
    }
  }

  switch (body.action) {
    // ---------------- Groups ----------------
    case "groups": {
      const { data: groups } = await admin
        .from("email_groups").select("id, name, description, created_at").order("name");
      const { data: counts } = await admin.from("email_group_members").select("group_id");
      const tally = new Map<string, number>();
      for (const row of counts ?? []) tally.set(row.group_id, (tally.get(row.group_id) ?? 0) + 1);
      return json({
        groups: (groups ?? []).map((g) => ({ ...g, member_count: tally.get(g.id) ?? 0 })),
      });
    }

    case "group_create": {
      if (!body.name) return json({ error: "Group name required" }, 400);
      const { data, error } = await admin.from("email_groups")
        .insert({ name: body.name, description: body.description || null, created_by: adminUserId })
        .select("id, name, description").single();
      if (error) return json({ error: error.message.includes("duplicate") ? "A group with that name already exists" : error.message }, 400);
      return json({ group: data });
    }

    case "group_update": {
      if (!body.group_id) return json({ error: "group_id required" }, 400);
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) patch.name = body.name;
      if (body.description !== undefined) patch.description = body.description || null;
      const { error } = await admin.from("email_groups").update(patch).eq("id", body.group_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    case "group_delete": {
      if (!body.group_id) return json({ error: "group_id required" }, 400);
      await admin.from("email_groups").delete().eq("id", body.group_id);
      return json({ ok: true });
    }

    case "group_members": {
      if (!body.group_id) return json({ error: "group_id required" }, 400);
      const { data: members } = await admin
        .from("email_group_members").select("email, added_at")
        .eq("group_id", body.group_id).order("email");
      const emails: string[] = (members ?? []).map((m) => String(m.email));
      const { data: prefs } = emails.length
        ? await admin.from("email_preferences").select("email, unsubscribed_at").in("email", emails)
        : { data: [] as Array<{ email: string; unsubscribed_at: string | null }> };
      const unsub = new Map((prefs ?? []).map((p) => [p.email, !!p.unsubscribed_at]));
      return json({
        members: (members ?? []).map((m) => ({ ...m, unsubscribed: unsub.get(m.email) ?? false })),
      });
    }

    case "group_add": {
      if (!body.group_id || !body.emails?.length) return json({ error: "group_id and emails required" }, 400);
      const emails: string[] = [...new Set((body.emails as string[]).map(norm))];
      await ensurePrefs(emails, "group");
      const { error } = await admin.from("email_group_members")
        .upsert(emails.map((email) => ({ group_id: body.group_id!, email })), { onConflict: "group_id,email", ignoreDuplicates: true });
      if (error) return json({ error: error.message }, 400);
      return json({ added: emails.length });
    }

    case "group_remove": {
      if (!body.group_id || !body.emails?.length) return json({ error: "group_id and emails required" }, 400);
      await admin.from("email_group_members").delete()
        .eq("group_id", body.group_id).in("email", body.emails.map(norm));
      return json({ ok: true });
    }

    // ---------------- Recipients ----------------
    case "recipients": {
      // The roster is the source of names; email_preferences is the source of
      // subscription state. Left join so addresses added by hand still show.
      const search = (body.search ?? "").toLowerCase();
      const { data: prefs } = await admin
        .from("email_preferences")
        .select("email, unsubscribed_at, source, created_at")
        .order("email");
      const { data: roster } = await admin
        .from("player_roster")
        .select("contact_email, first_name, last_name, age_group");
      const names = new Map<string, string[]>();
      for (const r of roster ?? []) {
        const e = (r.contact_email ?? "").trim().toLowerCase();
        if (!e) continue;
        const label = `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() +
          (r.age_group ? ` (${r.age_group})` : "");
        if (!names.has(e)) names.set(e, []);
        if (label.trim()) names.get(e)!.push(label);
      }
      let list = (prefs ?? []).map((p) => ({
        email: p.email,
        players: names.get(p.email) ?? [],
        unsubscribed: !!p.unsubscribed_at,
        unsubscribed_at: p.unsubscribed_at,
        source: p.source,
      }));
      if (search) {
        list = list.filter((r) =>
          r.email.includes(search) || r.players.some((p) => p.toLowerCase().includes(search)));
      }
      return json({
        total: (prefs ?? []).length,
        unsubscribed: (prefs ?? []).filter((p) => p.unsubscribed_at).length,
        recipients: list.slice(0, 500),
        truncated: list.length > 500,
      });
    }

    case "set_subscription": {
      if (!body.email) return json({ error: "email required" }, 400);
      const email = norm(body.email);
      const subscribed = body.subscribed === true;
      const now = new Date().toISOString();
      await admin.from("email_preferences")
        .upsert({ email, source: "admin" }, { onConflict: "email", ignoreDuplicates: true });
      await admin.from("email_preferences").update(
        subscribed
          ? { unsubscribed_at: null, resubscribed_at: now }
          : { unsubscribed_at: now, resubscribed_at: null },
      ).eq("email", email);
      // Keep the roster in step so it stays the single source of truth.
      await admin.from("player_roster").update({ marketing_opt_in: subscribed }).eq("contact_email", email);
      return json({ ok: true, email, unsubscribed: !subscribed });
    }

    // ---------------- Campaigns ----------------
    case "campaigns": {
      const { data } = await admin.from("email_campaigns")
        .select("id, name, subject, status, sent_at, sent_count, updated_at")
        .order("updated_at", { ascending: false }).limit(50);
      return json({ campaigns: data ?? [] });
    }

    case "campaign_get": {
      if (!body.campaign_id) return json({ error: "campaign_id required" }, 400);
      const { data } = await admin.from("email_campaigns").select("*").eq("id", body.campaign_id).maybeSingle();
      if (!data) return json({ error: "Campaign not found" }, 404);
      return json({ campaign: data });
    }

    case "campaign_save": {
      const patch = {
        name: body.name ?? "Untitled campaign",
        subject: body.subject ?? "",
        preheader: body.preheader ?? "",
        hero_url: body.hero_url ?? null,
        blocks: (body.blocks ?? []) as unknown as Block[],
        audience: body.audience ?? { type: "all" },
        updated_at: new Date().toISOString(),
      };
      if (body.campaign_id) {
        const { error } = await admin.from("email_campaigns").update(patch).eq("id", body.campaign_id);
        if (error) return json({ error: error.message }, 400);
        return json({ campaign_id: body.campaign_id });
      }
      const { data, error } = await admin.from("email_campaigns")
        .insert({ ...patch, created_by: adminUserId }).select("id").single();
      if (error) return json({ error: error.message }, 400);
      return json({ campaign_id: data.id });
    }

    case "campaign_delete": {
      if (!body.campaign_id) return json({ error: "campaign_id required" }, 400);
      await admin.from("email_campaigns").delete().eq("id", body.campaign_id);
      return json({ ok: true });
    }

    case "preview": {
      const html = renderCampaign({
        subject: body.subject ?? "",
        preheader: body.preheader ?? "",
        heroUrl: body.hero_url ?? null,
        blocks: (body.blocks ?? []) as unknown as Block[],
        unsubscribeUrl: `${unsubscribeBaseUrl()}?token=preview`,
      });
      return json({ html });
    }

    // ---------------- Sending ----------------
    case "audience_count": {
      const emails = await resolveAudience(admin, body.audience ?? { type: "all" });
      return json({ count: emails.length });
    }

    case "send_test": {
      if (!body.test_to) return json({ error: "test_to required" }, 400);
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);
      const to = norm(body.test_to);
      await ensurePrefs([to], "test");
      const { data: pref } = await admin.from("email_preferences")
        .select("unsub_token").eq("email", to).maybeSingle();
      const html = renderCampaign({
        subject: body.subject ?? "",
        preheader: body.preheader ?? "",
        heroUrl: body.hero_url ?? null,
        blocks: (body.blocks ?? []) as unknown as Block[],
        unsubscribeUrl: `${unsubscribeBaseUrl()}?token=${pref?.unsub_token ?? ""}`,
      });
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM, to: [to], reply_to: REPLY_TO,
          subject: `[TEST] ${body.subject ?? "Suffolk Tennis"}`, html,
        }),
      });
      if (!res.ok) return json({ error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` }, 502);
      return json({ ok: true, sent_to: to });
    }

    case "send": {
      if (!body.campaign_id) return json({ error: "campaign_id required" }, 400);
      const apiKey = Deno.env.get("RESEND_API_KEY");
      if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

      const { data: campaign } = await admin.from("email_campaigns")
        .select("*").eq("id", body.campaign_id).maybeSingle();
      if (!campaign) return json({ error: "Campaign not found" }, 404);
      if (campaign.status === "sent") return json({ error: "This campaign has already been sent" }, 409);
      if (!campaign.subject?.trim()) return json({ error: "Give the email a subject line before sending" }, 400);

      const emails = await resolveAudience(admin, campaign.audience ?? { type: "all" });
      if (!emails.length) return json({ error: "Nobody in this audience is still subscribed" }, 400);

      // Anyone already sent this campaign is skipped, so a retry after a
      // partial failure never double-sends.
      const { data: already } = await admin.from("email_campaign_sends")
        .select("email").eq("campaign_id", campaign.id).not("sent_at", "is", null);
      const done = new Set((already ?? []).map((r) => r.email));
      const todo = emails.filter((e) => !done.has(e.email));

      await admin.from("email_campaigns")
        .update({ status: "sending" }).eq("id", campaign.id);

      let sent = 0;
      const errors: string[] = [];

      for (let i = 0; i < todo.length; i += BATCH_SIZE) {
        const slice = todo.slice(i, i + BATCH_SIZE);
        const payload = slice.map((r) => ({
          from: FROM,
          to: [r.email],
          reply_to: REPLY_TO,
          subject: campaign.subject,
          html: renderCampaign({
            subject: campaign.subject,
            preheader: campaign.preheader ?? "",
            heroUrl: campaign.hero_url,
            blocks: campaign.blocks as Block[],
            unsubscribeUrl: `${unsubscribeBaseUrl()}?token=${r.token}`,
          }),
          headers: {
            "List-Unsubscribe": `<${unsubscribeBaseUrl()}?token=${r.token}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }));

        const res = await fetch(RESEND_BATCH, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const detail = (await res.text()).slice(0, 200);
          errors.push(`batch ${i / BATCH_SIZE + 1}: ${res.status} ${detail}`);
          // A rejected batch stops the run: the remaining recipients keep
          // sent_at null, so pressing Send again resumes where it stopped.
          break;
        }

        const out = await res.json().catch(() => ({ data: [] }));
        const ids: Array<{ id: string }> = out?.data ?? [];
        const rows = slice.map((r, idx) => ({
          campaign_id: campaign.id,
          email: r.email,
          resend_id: ids[idx]?.id ?? null,
          sent_at: new Date().toISOString(),
        }));
        await admin.from("email_campaign_sends").upsert(rows, { onConflict: "campaign_id,email" });
        sent += slice.length;
      }

      const remaining = todo.length - sent;
      await admin.from("email_campaigns").update({
        status: remaining > 0 ? "draft" : "sent",
        sent_at: remaining > 0 ? campaign.sent_at : new Date().toISOString(),
        sent_count: (campaign.sent_count ?? 0) + sent,
      }).eq("id", campaign.id);

      return json({ sent, remaining, skipped_already_sent: done.size, errors });
    }

    default:
      return json({ error: `Unknown action: ${body.action}` }, 400);
  }
});

/**
 * Everyone the campaign should reach, with their unsubscribe token.
 * Unsubscribed addresses are removed here — the one place it has to happen.
 */
async function resolveAudience(
  admin: ReturnType<typeof serviceClient>,
  audience: { type?: string; group_id?: string },
): Promise<Array<{ email: string; token: string }>> {
  const { data: subscribed } = await admin
    .from("email_preferences")
    .select("email, unsub_token")
    .is("unsubscribed_at", null);
  const all = new Map((subscribed ?? []).map((p) => [p.email, p.unsub_token as string]));

  if (audience?.type === "group" && audience.group_id) {
    const { data: members } = await admin
      .from("email_group_members").select("email").eq("group_id", audience.group_id);
    return (members ?? [])
      .filter((m) => all.has(m.email))
      .map((m) => ({ email: m.email, token: all.get(m.email)! }));
  }
  return [...all.entries()].map(([email, token]) => ({ email: String(email), token: String(token) }));
}
