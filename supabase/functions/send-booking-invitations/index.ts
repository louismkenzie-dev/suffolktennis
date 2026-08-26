// Admin-only: create booking invitations for selected players and email each
// parent their personal booking link. Also handles resending reminders.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";

const Invitee = z.object({
  child_id: z.string().uuid().optional(),
  roster_id: z.string().uuid().optional(),
  child_name: z.string().trim().min(1).max(120),
  parent_email: z.string().trim().email().max(255),
  parent_name: z.string().trim().max(120).optional().or(z.literal("")),
});

const Body = z.object({
  event_id: z.string().uuid(),
  invitees: z.array(Invitee).min(1).max(500).optional(),
  // Resend reminders to these existing invitations instead of creating new ones.
  remind_invitation_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
});

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://suffolktennis.online";

function invitationEmail(opts: {
  parentName: string; childName: string; eventTitle: string;
  dateLabel: string | null; location: string | null; priceLabel: string | null;
  bookUrl: string; reminder: boolean; unsubscribeUrl?: string;
}) {
  const first = (opts.parentName || "there").split(" ")[0];
  const lead = `${opts.reminder ? "A quick reminder that " : ""}<strong>${opts.childName}</strong> has been invited to <strong>${opts.eventTitle}</strong>.`;
  return brandedEmail({
    unsubscribeUrl: opts.unsubscribeUrl,
    title: opts.reminder ? "Your invitation is waiting" : `${opts.childName} is invited`,
    preheader: `${opts.eventTitle}${opts.dateLabel ? ` — ${opts.dateLabel}` : ""}`,
    body:
      emailParagraph(`Hi ${first},`) +
      emailParagraph(lead) +
      emailDetails([
        ["Player", opts.childName],
        ["Event", opts.eventTitle],
        ["Date", opts.dateLabel ?? ""],
        ["Venue", opts.location ?? ""],
        ["Cost", opts.priceLabel ?? ""],
      ]) +
      emailParagraph("Places are limited and offered by invitation, so please book as soon as you can.") +
      emailButton(opts.bookUrl, "View details &amp; book") +
      emailNote(`This link is personal to ${opts.childName} — please don’t forward it. You’ll be asked to sign in (or create your free account) before paying.`),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const adminUserId = await requireAdmin(req, admin);
  if (!adminUserId) return json({ error: "Admin access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }, 400);
    }
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!body.invitees && !body.remind_invitation_ids) {
    return json({ error: "Provide invitees or remind_invitation_ids" }, 400);
  }

  const { data: eventRow } = await admin
    .from("events")
    .select("id, title, location, event_date, programme_type, price_pence, monthly_amount_pence, programme_months")
    .eq("id", body.event_id)
    .maybeSingle();
  if (!eventRow) return json({ error: "Event not found" }, 404);

  const dateLabel = eventRow.event_date
    ? new Date(eventRow.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;
  const priceLabel = eventRow.programme_type === "monthly_programme"
    ? (eventRow.monthly_amount_pence
        ? `£${(eventRow.monthly_amount_pence / 100).toFixed(2)} per month for ${eventRow.programme_months} months`
        : null)
    : (eventRow.price_pence ? `£${(eventRow.price_pence / 100).toFixed(2)}` : null);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const results: Array<{ email: string; invitation_id?: string; sent: boolean; error?: string }> = [];

  // Look up parent accounts once so invitations link to existing users.
  let usersByEmail = new Map<string, string>();
  try {
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    usersByEmail = new Map(
      (users?.users ?? [])
        .filter((u) => u.email)
        .map((u) => [u.email!.toLowerCase(), u.id]),
    );
  } catch { /* linking is best-effort */ }

  if (body.invitees) {
    for (const inv of body.invitees) {
      const email = inv.parent_email.toLowerCase();

      // Re-inviting must reuse the existing invitation (same token). The
      // (event, child, email) unique key can't cover roster players (NULL
      // child_id rows are always distinct), so match explicitly by
      // precedence: roster_id, then child_id, then email + player name.
      let existingQuery = admin
        .from("booking_invitations")
        .select("id, token, status")
        .eq("event_id", eventRow.id);
      if (inv.roster_id) existingQuery = existingQuery.eq("roster_id", inv.roster_id);
      else if (inv.child_id) existingQuery = existingQuery.eq("child_id", inv.child_id);
      else existingQuery = existingQuery.eq("parent_email", email).eq("child_name", inv.child_name);
      const { data: existing } = await existingQuery.limit(1).maybeSingle();

      let created = existing ?? null;
      let error: { message: string } | null = null;
      if (!created) {
        ({ data: created, error } = await admin
          .from("booking_invitations")
          .insert({
            event_id: eventRow.id,
            child_id: inv.child_id ?? null,
            roster_id: inv.roster_id ?? null,
            child_name: inv.child_name,
            parent_email: email,
            parent_name: inv.parent_name || null,
            parent_user_id: usersByEmail.get(email) ?? null,
            invited_by: adminUserId,
          })
          .select("id, token, status")
          .single());
      }

      if (error || !created) {
        results.push({ email, sent: false, error: error?.message ?? "insert failed" });
        continue;
      }
      if (created.status === "revoked" || created.status === "booked") {
        results.push({ email, invitation_id: created.id, sent: false, error: `already ${created.status}` });
        continue;
      }

      let sent = false;
      let sendError: string | undefined;
      if (apiKey) {
        try {
          const unsubToken = await unsubscribeTokenFor(admin, email, "invitation");
          await sendEmail({
            to: email,
            subject: `Invitation: ${eventRow.title} — ${inv.child_name}`,
            unsubscribe_token: unsubToken ?? undefined,
            html: invitationEmail({
              unsubscribeUrl: unsubscribeUrlFor(unsubToken),
              parentName: inv.parent_name || "",
              childName: inv.child_name,
              eventTitle: eventRow.title,
              dateLabel, location: eventRow.location, priceLabel,
              bookUrl: `${SITE_URL}/book/${created.token}`,
              reminder: false,
            }),
            idempotency_key: `invite-${created.id}`,
          }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
          sent = true;
        } catch (e) {
          sendError = e instanceof Error ? e.message : String(e);
        }
      } else {
        sendError = "RESEND_API_KEY not configured — invitation created but email not sent";
      }

      if (sent) {
        await admin.from("booking_invitations")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", created.id);
      }
      results.push({ email, invitation_id: created.id, sent, error: sendError });
    }
  }

  if (body.remind_invitation_ids) {
    const { data: invitations } = await admin
      .from("booking_invitations")
      .select("id, token, child_name, parent_email, parent_name, status")
      .eq("event_id", eventRow.id)
      .in("id", body.remind_invitation_ids);

    for (const inv of invitations ?? []) {
      if (inv.status === "booked" || inv.status === "revoked" || inv.status === "expired") {
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: false, error: `already ${inv.status}` });
        continue;
      }
      if (!apiKey) {
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: false, error: "RESEND_API_KEY not configured" });
        continue;
      }
      try {
        const unsubToken = await unsubscribeTokenFor(admin, inv.parent_email, "invitation");
        await sendEmail({
          to: inv.parent_email,
          subject: `Reminder: ${eventRow.title} — ${inv.child_name}`,
          unsubscribe_token: unsubToken ?? undefined,
          html: invitationEmail({
            unsubscribeUrl: unsubscribeUrlFor(unsubToken),
            parentName: inv.parent_name || "",
            childName: inv.child_name || "your child",
            eventTitle: eventRow.title,
            dateLabel, location: eventRow.location, priceLabel,
            bookUrl: `${SITE_URL}/book/${inv.token}`,
            reminder: true,
          }),
        }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
        await admin.from("booking_invitations")
          .update({ reminded_at: new Date().toISOString() })
          .eq("id", inv.id);
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: true });
      } catch (e) {
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return json({ sent: sentCount, total: results.length, results });
});
