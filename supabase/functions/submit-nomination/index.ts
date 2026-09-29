// A coach, club or school nominates a child for the Suffolk Rising Stars
// Talent ID days, from suffolktennis.online/nominate.
//
// What one nomination does:
//   1. Saves the nomination (who, why, preferred day).
//   2. Puts the child on the county player database (player_roster) if they
//      are not already there — matched the same way the spreadsheet upload
//      matches: same name is the same child, unless the nomination carries a
//      different parent email, in which case nothing is created and the
//      nomination is marked for an admin to look at.
//   3. Emails the nominator a confirmation and enquiries@ a notification.
//      Sent directly (like the other campaign mail) rather than through the
//      transactional queue, which nothing currently drains.
//
// Public (verify_jwt = false): anyone with the link can nominate. The body is
// validated, a honeypot field catches bots, and the same person nominating
// the same child twice in a day is answered politely without a second row.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";
import { sendEmail } from "../_shared/resend.ts";
import { recordDelivery } from "../_shared/emailDeliveries.ts";
import {
  brandedEmail, emailButton, emailDetails, emailHeading, emailKicker, emailNote, emailParagraph,
} from "../_shared/emailLayout.ts";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
// enquiries@ is the only mailbox on the domain.
const ADMIN_NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") ?? "enquiries@suffolktennis.online";
const ROSTER_TAG = "Rising Stars nomination 2026";
const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];

const opt = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const Body = z.object({
  player_first_name: z.string().trim().min(1).max(80),
  player_last_name: z.string().trim().min(1).max(80),
  birth_year: z.coerce.number().int().min(2010).max(2024).optional().nullable(),
  gender: z.enum(["male", "female", ""]).optional(),
  club: opt(160),
  event_id: z.string().uuid().optional().or(z.literal("")),
  session_slot: opt(120),
  parent_name: opt(120),
  parent_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  parent_phone: opt(40),
  nominator_name: z.string().trim().min(1).max(120),
  nominator_role: opt(160),
  nominator_email: z.string().trim().email().max(255),
  nominator_phone: opt(40),
  reason: opt(1500),
  /** Honeypot: real people never see this field, so it must stay empty. */
  website: opt(200),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] || name;

/** County age groups run on age at the end of the calendar year. */
function ageGroupForBirthYear(year: number | null | undefined): string | null {
  if (!year) return null;
  const ageAtYearEnd = new Date().getFullYear() - year;
  const g = AGE_GROUPS.find((n) => ageAtYearEnd <= n);
  return g ? `${g}U` : "Open";
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

type RosterRow = { id: string; first_name: string; last_name: string; age_group: string | null; contact_email: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let p: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Please check the form", details: parsed.error.flatten().fieldErrors }, 400);
    p = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // A bot filled the hidden field: say thank you and do nothing.
  if (p.website) return json({ ok: true });

  const first = p.player_first_name, last = p.player_last_name;
  const nominatorEmail = p.nominator_email.toLowerCase();
  const parentEmail = p.parent_email ? p.parent_email.toLowerCase() : null;

  // Same person, same child, same day: one nomination is enough.
  const { data: dupe } = await admin.from("talent_nominations").select("id")
    .ilike("nominator_email", nominatorEmail).ilike("player_first_name", first).ilike("player_last_name", last)
    .gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    .limit(1).maybeSingle();
  if (dupe) return json({ ok: true, id: dupe.id, duplicate: true });

  // The preferred day, if they chose one.
  let event: { id: string; title: string; event_date: string; location: string | null } | null = null;
  if (p.event_id) {
    const { data } = await admin.from("events").select("id, title, event_date, location").eq("id", p.event_id).maybeSingle();
    event = data ?? null;
  }

  // ---- The player database ----
  const { data: named } = await admin.from("player_roster")
    .select("id, first_name, last_name, age_group, contact_email")
    .ilike("first_name", first).ilike("last_name", last) as { data: RosterRow[] | null };
  const candidates = named ?? [];
  const ageGroup = ageGroupForBirthYear(p.birth_year);

  let rosterId: string | null = null;
  let rosterMatch: "created" | "existing" | "review";
  let rosterNote: string;
  if (candidates.length === 0) {
    const { data: created, error } = await admin.from("player_roster").insert({
      first_name: first, last_name: last,
      gender: p.gender === "male" ? "Male" : p.gender === "female" ? "Female" : null,
      age_group: ageGroup,
      contact_name: p.parent_name || null,
      contact_email: parentEmail,
      mobile: p.parent_phone || null,
      tags: [ROSTER_TAG],
      source: "nomination",
    }).select("id").single();
    if (error) {
      console.error("roster insert failed", error.message);
      return json({ error: "Couldn't save the nomination. Please try again or email enquiries@suffolktennis.online." }, 500);
    }
    rosterId = created.id;
    rosterMatch = "created";
    rosterNote = "Added to the player database";
  } else {
    const sameEmail = parentEmail ? candidates.find((c) => (c.contact_email ?? "").toLowerCase() === parentEmail) : undefined;
    const sameAge = ageGroup ? candidates.find((c) => c.age_group === ageGroup) : undefined;
    const match = sameEmail ?? sameAge ?? candidates[0];
    const theirEmail = (match.contact_email ?? "").toLowerCase();
    rosterId = match.id;
    if (parentEmail && theirEmail && theirEmail !== parentEmail && !sameEmail) {
      rosterMatch = "review";
      rosterNote = `Same name as a player already on the database, but with a different parent email (${match.contact_email}). Nothing was added — please check whether this is the same child.`;
    } else {
      rosterMatch = "existing";
      rosterNote = "Already on the player database";
    }
  }

  const { data: nom, error: insErr } = await admin.from("talent_nominations").insert({
    player_first_name: first, player_last_name: last,
    birth_year: p.birth_year ?? null,
    gender: p.gender || null,
    club: p.club || null,
    event_id: event?.id ?? null,
    session_slot: p.session_slot || null,
    parent_name: p.parent_name || null,
    parent_email: parentEmail,
    parent_phone: p.parent_phone || null,
    nominator_name: p.nominator_name,
    nominator_role: p.nominator_role || null,
    nominator_email: nominatorEmail,
    nominator_phone: p.nominator_phone || null,
    reason: p.reason || null,
    roster_id: rosterId,
    roster_match: rosterMatch,
  }).select("id").single();
  if (insErr) {
    console.error("nomination insert failed", insErr.message);
    return json({ error: "Couldn't save the nomination. Please try again or email enquiries@suffolktennis.online." }, 500);
  }

  // ---- Emails ----
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const player = `${first} ${last}`;
  const when = event ? `${fmtDate(event.event_date)} · ${event.location ?? ""}${p.session_slot ? ` · ${p.session_slot}` : ""}` : (p.session_slot || "Either day");
  const details: Array<[string, string]> = [
    ["Player", esc(player)],
    ["Year of birth", p.birth_year ? String(p.birth_year) : ""],
    ["Club, school or programme", esc(p.club)],
    ["Preferred day", esc(when)],
    ["Nominated by", esc(p.nominator_role ? `${p.nominator_name} — ${p.nominator_role}` : p.nominator_name)],
  ];

  if (apiKey) {
    const opts = { apiKey };
    // To the nominator.
    try {
      const subject = `Thanks for nominating ${first} — Suffolk Rising Stars`;
      const html = brandedEmail({
        title: "Nomination received",
        preheader: `${player}'s nomination for the Suffolk Rising Stars Talent ID days is in.`,
        sections: [{
          tone: "light",
          html:
            emailKicker("Suffolk Rising Stars &middot; Talent ID") +
            emailHeading("Nomination received", { size: 28 }) +
            emailParagraph(`Hi ${esc(firstNameOf(p.nominator_name))},`) +
            emailParagraph(`Thank you for putting <strong>${esc(player)}</strong> forward for the Suffolk Rising Stars Talent ID days. Here is what we have:`) +
            emailDetails(details) +
            emailParagraph("<strong>What happens next.</strong> Ollie Sutton and the county team review every nomination after the closing date, then contact the family directly with an invitation and sign-up details for their session." +
              (parentEmail ? " We'll use the parent details you gave us." : " If we need help reaching the family we may come back to you.")) +
            emailParagraph("Every nomination matters — we'd rather see a child than miss one. If there's someone else who catches your eye, nominate them too.") +
            emailButton(`${SITE_URL}/nominate`, "Nominate another player") +
            emailNote(`Questions? Reply to this email or write to <a href="mailto:${ADMIN_NOTIFY_EMAIL}" style="color: #64748B;">${ADMIN_NOTIFY_EMAIL}</a>.`),
        }],
        audienceNote: "You're receiving this because you nominated a player at suffolktennis.online/nominate.",
      });
      const { id } = await sendEmail({ to: nominatorEmail, subject, html, idempotency_key: `nom-confirm-${nom.id}`, purpose: "nomination_confirmation" }, opts);
      await recordDelivery(admin, { resendId: id, recipient: nominatorEmail, subject, purpose: "nomination_confirmation" });
    } catch (e) {
      console.error("nominator email failed", e instanceof Error ? e.message : String(e));
    }

    // To the county team.
    try {
      const subject = `Talent ID nomination: ${player} (by ${p.nominator_name})`;
      const html = brandedEmail({
        title: "New Talent ID nomination",
        preheader: `${player} nominated by ${p.nominator_name}${p.club ? ` — ${p.club}` : ""}. ${rosterNote}.`,
        sections: [{
          tone: "light",
          html:
            emailKicker("Suffolk Rising Stars &middot; Talent ID") +
            emailHeading("New nomination", { size: 28 }) +
            emailParagraph(`<strong>${esc(player)}</strong> has been nominated by ${esc(p.nominator_name)}${p.club ? ` (${esc(p.club)})` : ""}.`) +
            emailDetails([
              ...details,
              ["Gender", p.gender === "male" ? "Boy" : p.gender === "female" ? "Girl" : ""],
              ["Nominator email", esc(nominatorEmail)],
              ["Nominator phone", esc(p.nominator_phone)],
              ["Parent", esc(p.parent_name)],
              ["Parent email", esc(parentEmail)],
              ["Parent phone", esc(p.parent_phone)],
              ["Player database", esc(rosterNote)],
            ]) +
            (p.reason ? emailParagraph(`<strong>Why:</strong> ${esc(p.reason).replace(/\r?\n/g, "<br>")}`) : "") +
            emailButton(`${SITE_URL}/admin?tab=people&view=nominations`, "Open nominations"),
        }],
        audienceNote: "Sent to enquiries@ for every nomination made on the website.",
      });
      const { id } = await sendEmail({ to: ADMIN_NOTIFY_EMAIL, subject, html, idempotency_key: `nom-admin-${nom.id}`, purpose: "nomination_admin" }, opts);
      await recordDelivery(admin, { resendId: id, recipient: ADMIN_NOTIFY_EMAIL, subject, purpose: "nomination_admin" });
    } catch (e) {
      console.error("admin email failed", e instanceof Error ? e.message : String(e));
    }
  }

  return json({ ok: true, id: nom.id, roster_match: rosterMatch });
});
