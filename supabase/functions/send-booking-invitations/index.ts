// Admin-only: create booking invitations for selected players and email each
// parent their personal booking link. Also handles resending reminders.
//
// Complimentary places: a child who has already paid for a programme is
// included on any other programme at no extra charge, so their invitation is
// flagged complimentary automatically. Admins can also grant one by hand
// (`complimentary: true` on the invitee) — for a free place on any event.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireAdmin, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { SITE_URL, invitationEmail, seasonOf, type EventRow, type Shape } from "../_shared/invitationEmail.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";
import { venueLine, venueRuns, venueRunsSentence } from "../_shared/venueRuns.ts";

const Invitee = z.object({
  child_id: z.string().uuid().optional(),
  roster_id: z.string().uuid().optional(),
  child_name: z.string().trim().min(1).max(120),
  parent_email: z.string().trim().email().max(255),
  parent_name: z.string().trim().max(120).optional().or(z.literal("")),
  // Admin override: grant this place free regardless of eligibility.
  complimentary: z.boolean().optional(),
});

const Body = z.object({
  event_id: z.string().uuid(),
  invitees: z.array(Invitee).min(1).max(500).optional(),
  // Resend reminders to these existing invitations instead of creating new ones.
  remind_invitation_ids: z.array(z.string().uuid()).min(1).max(500).optional(),
});

async function programmeShape(admin: ReturnType<typeof serviceClient>, ev: EventRow): Promise<Shape> {
  const [{ data: sessions }, { data: assigned }] = await Promise.all([
    admin.from("event_sessions").select("session_date, start_time, end_time, venue")
      .eq("event_id", ev.id).is("cancelled_at", null).order("session_date"),
    admin.from("event_coaches").select("user_id").eq("event_id", ev.id),
  ]);
  const rows = (sessions ?? []) as Array<{ session_date: string; start_time: string | null; end_time: string | null; venue: string | null }>;
  // A programme that moves venue part-way through is described from its sessions.
  const runs = venueRuns(rows, ev.location);

  // The typical length: the most common start→end gap, so one odd session
  // does not turn "2-hour sessions" into "1.9-hour sessions".
  const tally = new Map<number, number>();
  for (const r of rows) {
    if (!r.start_time || !r.end_time) continue;
    const [sh, sm] = r.start_time.split(":").map(Number);
    const [eh, em] = r.end_time.split(":").map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins > 0) tally.set(mins, (tally.get(mins) ?? 0) + 1);
  }
  const modeMins = [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;

  const firstDate = rows[0]?.session_date ?? (ev.event_date ? ev.event_date.slice(0, 10) : null);

  let coaches: string[] = [];
  const ids = (assigned ?? []).map((a: { user_id: string }) => a.user_id);
  if (ids.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("user_id, first_name, last_name").in("user_id", ids);
    coaches = (profiles ?? [])
      .map((p: { first_name: string | null; last_name: string | null }) => [p.first_name, p.last_name].map((x) => (x ?? "").trim()).filter(Boolean).join(" "))
      .filter(Boolean)
      .sort();
  }

  return {
    sessionCount: rows.length,
    hoursEach: modeMins ? Math.round((modeMins / 60) * 10) / 10 : null,
    firstDate,
    season: ev.programme_type === "programme" && firstDate ? seasonOf(firstDate) : null,
    coaches,
    venueLine: venueLine(runs, ev.location),
    venueSentence: venueRunsSentence(runs),
  };
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
    .select("id, title, location, event_date, programme_type, price_pence, is_free, meeting_cadence, description, sign_up_deadline")
    .eq("id", body.event_id)
    .maybeSingle();
  if (!eventRow) return json({ error: "Event not found" }, 404);
  const ev = eventRow as EventRow;
  const shape = await programmeShape(admin, ev);

  const dateLabel = ev.event_date
    ? new Date(ev.event_date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : null;

  const apiKey = Deno.env.get("RESEND_API_KEY");
  const results: Array<{ email: string; invitation_id?: string; sent: boolean; complimentary?: boolean; error?: string }> = [];

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

  /**
   * Roster players are matched to a registered child through
   * player_roster.linked_child_id; eligibility is decided on the child.
   */
  async function resolveChildId(inv: z.infer<typeof Invitee>): Promise<string | null> {
    if (inv.child_id) return inv.child_id;
    if (!inv.roster_id) return null;
    const { data } = await admin
      .from("player_roster").select("linked_child_id").eq("id", inv.roster_id).maybeSingle();
    return data?.linked_child_id ?? null;
  }

  async function eligibleForComplimentary(childId: string | null): Promise<boolean> {
    if (!childId || ev.programme_type !== "programme") return false;
    const { data } = await admin.rpc("child_has_paid_programme", { p_child_id: childId });
    return data === true;
  }

  if (body.invitees) {
    for (const inv of body.invitees) {
      const email = inv.parent_email.toLowerCase();

      const childId = await resolveChildId(inv);
      const autoEligible = await eligibleForComplimentary(childId);
      const complimentary = inv.complimentary === true || autoEligible;
      const complimentaryReason = inv.complimentary === true
        ? "granted by admin"
        : autoEligible ? "already on a paid programme" : null;

      // Re-inviting must reuse the existing invitation (same token). The
      // (event, child, email) unique key can't cover roster players (NULL
      // child_id rows are always distinct), so match explicitly by
      // precedence: roster_id, then child_id, then email + player name.
      let existingQuery = admin
        .from("booking_invitations")
        .select("id, token, status, complimentary")
        .eq("event_id", ev.id);
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
            event_id: ev.id,
            child_id: childId,
            roster_id: inv.roster_id ?? null,
            child_name: inv.child_name,
            parent_email: email,
            parent_name: inv.parent_name || null,
            parent_user_id: usersByEmail.get(email) ?? null,
            invited_by: adminUserId,
            complimentary,
            complimentary_reason: complimentaryReason,
          })
          .select("id, token, status, complimentary")
          .single());
      } else if (complimentary && !existing?.complimentary) {
        // Re-sent after the child qualified (or the admin granted it): upgrade
        // the standing invitation so the booking page stops asking for money.
        await admin.from("booking_invitations")
          .update({ complimentary: true, complimentary_reason: complimentaryReason })
          .eq("id", created.id);
        created = { ...created, complimentary: true };
      }

      if (error || !created) {
        results.push({ email, sent: false, error: error?.message ?? "insert failed" });
        continue;
      }
      if (created.status === "revoked" || created.status === "booked") {
        results.push({ email, invitation_id: created.id, sent: false, error: `already ${created.status}` });
        continue;
      }

      const isComplimentary = !!created.complimentary;
      let sent = false;
      let sendError: string | undefined;
      if (apiKey) {
        try {
          const unsubToken = await unsubscribeTokenFor(admin, email, "invitation");
          await sendEmail({
            to: email,
            subject: `Invitation: ${ev.title} — ${inv.child_name}`,
            unsubscribe_token: unsubToken ?? undefined,
            html: invitationEmail({
              unsubscribeUrl: unsubscribeUrlFor(unsubToken),
              parentName: inv.parent_name || "",
              childName: inv.child_name,
              event: ev,
              shape,
              dateLabel,
              complimentary: isComplimentary,
              bookUrl: `${SITE_URL}/book/${created.token}`,
              reminder: false,
            }),
            idempotency_key: `invite-${created.id}${isComplimentary ? "-comp" : ""}`,
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
      results.push({ email, invitation_id: created.id, sent, complimentary: isComplimentary, error: sendError });
    }
  }

  if (body.remind_invitation_ids) {
    const { data: invitations } = await admin
      .from("booking_invitations")
      .select("id, token, child_name, parent_email, parent_name, status, complimentary")
      .eq("event_id", ev.id)
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
          subject: `Reminder: ${ev.title} — ${inv.child_name}`,
          unsubscribe_token: unsubToken ?? undefined,
          html: invitationEmail({
            unsubscribeUrl: unsubscribeUrlFor(unsubToken),
            parentName: inv.parent_name || "",
            childName: inv.child_name || "your child",
            event: ev,
            shape,
            dateLabel,
            complimentary: !!inv.complimentary,
            bookUrl: `${SITE_URL}/book/${inv.token}`,
            reminder: true,
          }),
        }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
        await admin.from("booking_invitations")
          .update({ reminded_at: new Date().toISOString() })
          .eq("id", inv.id);
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: true, complimentary: !!inv.complimentary });
      } catch (e) {
        results.push({ email: inv.parent_email, invitation_id: inv.id, sent: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return json({ sent: sentCount, total: results.length, results });
});
