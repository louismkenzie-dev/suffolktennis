// Admin-only: invite someone to coach with Suffolk Tennis and email them their
// personal join link. Also handles resending reminders.
//
// The sibling of send-booking-invitations, kept deliberately close to it so
// the two invitation flows feel like one system. One row per email: inviting
// the same address again reuses the row and its token rather than minting a
// second link, and a revoked row is brought back with a fresh token so the
// old email's link stays dead.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { FONT, brandedEmail, emailButton, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";

const Invitee = z.object({
  name: z.string().trim().max(120).optional().or(z.literal("")),
  email: z.string().trim().email().max(255),
});

const Body = z.object({
  invitees: z.array(Invitee).min(1).max(100).optional(),
  // Resend reminders to these existing invitations instead of creating new ones.
  remind_invitation_ids: z.array(z.string().uuid()).min(1).max(100).optional(),
});

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Same shape as the table default, so a re-issued token is indistinguishable from a fresh row's. */
function freshToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** A bulleted list in the body voice; emailLayout has no list helper. */
function emailList(items: string[]): string {
  const li = items.map((i) => `<li style="margin: 0 0 6px;">${i}</li>`).join("");
  return `<ul style="margin: 0 0 16px; padding-left: 22px; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: #334155;">${li}</ul>`;
}

function invitationEmail(opts: {
  name: string; inviterName: string; joinUrl: string; reminder: boolean; unsubscribeUrl?: string;
}) {
  const first = esc((opts.name || "there").trim().split(/\s+/)[0] || "there");
  const inviter = esc(opts.inviterName);

  const opening = opts.reminder
    ? emailParagraph(`A quick reminder that <strong>${inviter}</strong> has invited you to coach with Suffolk Tennis — your invitation is still waiting.`)
    : emailParagraph(`<strong>${inviter}</strong> has invited you to coach with Suffolk Tennis.`);

  const body =
    emailParagraph(`Hi ${first},`) +
    opening +
    emailParagraph("A coach account gives you the Coach Hub for every programme you are assigned to:") +
    emailList([
      "Registers for each session, with the players booked on",
      "QR check-in — scan a player’s ticket and they’re marked in",
      "Session reports against the nine LTA areas for every player on your programmes",
    ]) +
    emailParagraph("Accept the invitation below to set up your coach account. Once you’re in, Suffolk Tennis will assign you to your programmes and they will appear in your Coach Hub.") +
    emailButton(opts.joinUrl, "Accept invitation") +
    emailNote("This link is personal to you — please don’t forward it. Sign up with this email address so the invitation matches your account. If you already have a Suffolk Tennis parent account with this address, simply sign in with it and coaching is added to it.");

  return brandedEmail({
    unsubscribeUrl: opts.unsubscribeUrl,
    title: opts.reminder ? "Your coach invitation is waiting" : "You're invited to coach",
    preheader: "Suffolk Tennis coach invitation",
    body,
  });
}

/** Whether the account that accepted an invitation still holds the coach role. */
async function holdsCoachRole(admin: ReturnType<typeof serviceClient>, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const { data } = await admin.from("user_roles").select("id").eq("user_id", userId).eq("role", "coach").limit(1).maybeSingle();
  return !!data;
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

  // The email names who did the inviting. Falls back to the organisation when
  // the admin has no profile name, so the copy never reads "undefined has
  // invited you".
  let inviterName = "Suffolk Tennis";
  const { data: inviter } = await admin
    .from("profiles").select("first_name, last_name").eq("user_id", adminUserId).maybeSingle();
  if (inviter) {
    const full = [inviter.first_name, inviter.last_name].map((x: string | null) => (x ?? "").trim()).filter(Boolean).join(" ");
    if (full) inviterName = full;
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const results: Array<{ email: string; invitation_id?: string; sent: boolean; error?: string }> = [];

  if (body.invitees) {
    for (const inv of body.invitees) {
      const email = inv.email.toLowerCase();
      const name = inv.name?.trim() || null;

      // Every row is written lowercased, so an exact match IS the
      // lower(email) match the unique index enforces.
      const { data: existing } = await admin
        .from("coach_invitations")
        .select("id, token, status, name, accepted_user_id")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      let row = existing ?? null;
      let error: { message: string } | null = null;
      // Set when a revoked row comes back to life: the old link must not be
      // resurrected by Resend's 24-hour dedupe, so the send gets its own key.
      let reissued = false;

      if (!row) {
        const inserted = await admin
          .from("coach_invitations")
          .insert({ email, name, invited_by: adminUserId })
          .select("id, token, status, name, accepted_user_id")
          .single();
        if (inserted.error?.code === "23505") {
          // Two admins invited the same address at once; the other insert
          // won the lower(email) index, so send from that row.
          ({ data: row } = await admin
            .from("coach_invitations").select("id, token, status, name, accepted_user_id").eq("email", email).maybeSingle());
        } else {
          row = inserted.data;
          error = inserted.error;
        }
      } else if (row.status === "accepted" && await holdsCoachRole(admin, row.accepted_user_id)) {
        results.push({ email, invitation_id: row.id, sent: false, error: "already a coach" });
        continue;
      } else if (row.status === "revoked" || row.status === "accepted") {
        // Re-invited after a revoke, or after "Remove coach access" took the
        // role away: same row, fresh token, clean stamps, so the old link can
        // never be used to accept. The role, not the row, says who is a coach.
        const token = freshToken();
        ({ data: row, error } = await admin
          .from("coach_invitations")
          .update({
            status: "invited", token, name: name ?? row.name, invited_by: adminUserId,
            sent_at: null, reminded_at: null, opened_at: null, accepted_at: null, accepted_user_id: null,
          })
          .eq("id", row.id)
          .select("id, token, status, name, accepted_user_id")
          .single());
        reissued = true;
      } else if (name && name !== row.name) {
        // Standing invitation, but the admin has typed a (better) name: keep
        // it, so the email and the People list agree.
        await admin.from("coach_invitations").update({ name }).eq("id", row.id);
        row = { ...row, name };
      }

      if (error || !row) {
        results.push({ email, sent: false, error: error?.message ?? "insert failed" });
        continue;
      }

      let sent = false;
      let sendError: string | undefined;
      if (apiKey) {
        try {
          const unsubToken = await unsubscribeTokenFor(admin, email, "coach-invitation");
          await sendEmail({
            to: email,
            subject: "You're invited to coach with Suffolk Tennis",
            unsubscribe_token: unsubToken ?? undefined,
            html: invitationEmail({
              unsubscribeUrl: unsubscribeUrlFor(unsubToken),
              name: row.name ?? "",
              inviterName,
              joinUrl: `${SITE_URL}/coach/join/${row.token}`,
              reminder: false,
            }),
            idempotency_key: `coach-invite-${row.id}${reissued ? `-${row.token.slice(0, 8)}` : ""}`,
          }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
          sent = true;
        } catch (e) {
          sendError = e instanceof Error ? e.message : String(e);
        }
      } else {
        sendError = "RESEND_API_KEY not configured — invitation created but email not sent";
      }

      if (sent) {
        await admin.from("coach_invitations")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", row.id);
      }
      results.push({ email, invitation_id: row.id, sent, error: sendError });
    }
  }

  if (body.remind_invitation_ids) {
    const { data: invitations } = await admin
      .from("coach_invitations")
      .select("id, token, email, name, status, sent_at, accepted_user_id")
      .in("id", body.remind_invitation_ids);

    for (const inv of invitations ?? []) {
      if (inv.status === "accepted") {
        const still = await holdsCoachRole(admin, inv.accepted_user_id);
        results.push({ email: inv.email, invitation_id: inv.id, sent: false, error: still ? "already a coach" : "no longer a coach — invite them again" });
        continue;
      }
      if (inv.status !== "invited") {
        results.push({ email: inv.email, invitation_id: inv.id, sent: false, error: `already ${inv.status}` });
        continue;
      }
      if (!apiKey) {
        results.push({ email: inv.email, invitation_id: inv.id, sent: false, error: "RESEND_API_KEY not configured" });
        continue;
      }
      // An invitation whose first email never left (Resend down, key unset)
      // shows "Not sent yet" in the list; "Resend" there must send the
      // invitation itself, not a reminder for a message nobody received.
      const firstSend = !inv.sent_at;
      try {
        const unsubToken = await unsubscribeTokenFor(admin, inv.email, "coach-invitation");
        await sendEmail({
          to: inv.email,
          subject: firstSend ? "You're invited to coach with Suffolk Tennis" : "Reminder: you're invited to coach with Suffolk Tennis",
          unsubscribe_token: unsubToken ?? undefined,
          html: invitationEmail({
            unsubscribeUrl: unsubscribeUrlFor(unsubToken),
            name: inv.name ?? "",
            inviterName,
            joinUrl: `${SITE_URL}/coach/join/${inv.token}`,
            reminder: !firstSend,
          }),
          // Timestamped so a reminder is never deduped against the original
          // send (or an earlier reminder) within Resend's 24-hour window.
          idempotency_key: `coach-invite-${inv.id}-r${Date.now()}`,
        }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
        await admin.from("coach_invitations")
          .update(firstSend ? { sent_at: new Date().toISOString() } : { reminded_at: new Date().toISOString() })
          .eq("id", inv.id);
        results.push({ email: inv.email, invitation_id: inv.id, sent: true });
      } catch (e) {
        results.push({ email: inv.email, invitation_id: inv.id, sent: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return json({ sent: sentCount, total: results.length, results });
});
