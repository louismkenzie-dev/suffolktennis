// The invitation email parents receive when an admin invites a child to a
// programme or event — Ollie's letter, with the facts filled in from the
// programme itself so the email can never disagree with the programme page.
//
// It lives here rather than inside send-booking-invitations so the same
// template can be rendered for a sample or preview without standing up the
// whole invite flow. send-booking-invitations is its only sender.
import { FONT, brandedEmail, emailButton, emailDetails, emailHeading, emailNote, emailParagraph } from "./emailLayout.ts";

export const SITE_URL = Deno.env.get("SITE_URL") ?? "https://suffolktennis.online";
const gbp = (pence: number) => `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;

export type EventRow = {
  id: string; title: string; location: string | null; event_date: string | null;
  programme_type: string; price_pence: number | null; is_free: boolean; meeting_cadence: string | null;
  description: string | null; sign_up_deadline: string | null;
};

/**
 * What the programme actually is, read from its sessions rather than typed
 * into the email: "10 × 2-hour sessions", the first date, and the season.
 * The letter Ollie drafted quotes these by hand; deriving them means the
 * email can never disagree with the programme page.
 */
export type Shape = {
  sessionCount: number;
  hoursEach: number | null;
  firstDate: string | null;   // YYYY-MM-DD
  season: string | null;      // "2026/27"
  coaches: string[];
  /** "Culford Sports & Tennis Centre, then Ipswich Sports Club" — from the sessions (venueRuns.ts). */
  venueLine: string | null;
  /** The move spelled out, when the programme changes venue part-way through. */
  venueSentence: string | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const longDate = (value: string) =>
  new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value)
    .toLocaleDateString("en-GB", { timeZone: "Europe/London", weekday: "long", day: "numeric", month: "long", year: "numeric" })
    // Some ICU builds put a comma after the weekday; the site's dates never do.
    .replace(/^(\w+),/, "$1");

/** Tennis seasons run September to August, so a 2026 September start is 2026/27. */
export function seasonOf(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(5, 7));
  const start = m >= 8 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

function hoursLabel(h: number | null): string {
  if (!h) return "";
  const whole = Number.isInteger(h) ? String(h) : h.toFixed(1).replace(/\.0$/, "");
  return `${whole}-hour`;
}

function costLabel(ev: EventRow, complimentary: boolean): string {
  if (complimentary) return "No extra charge — included with your existing programme place";
  if (ev.is_free) return "Free";
  if (!ev.price_pence) return "";
  if (ev.programme_type === "programme") {
    return `${gbp(ev.price_pence)} for the complete programme`;
  }
  return gbp(ev.price_pence);
}

/** A bulleted list in the body voice; emailLayout has no list helper. */
function emailList(items: string[]): string {
  const li = items.map((i) => `<li style="margin: 0 0 6px;">${i}</li>`).join("");
  return `<ul style="margin: 0 0 16px; padding-left: 22px; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: #334155;">${li}</ul>`;
}

export function invitationEmail(opts: {
  parentName: string; childName: string; event: EventRow; shape: Shape;
  dateLabel: string | null; complimentary: boolean;
  bookUrl: string; reminder: boolean; unsubscribeUrl?: string;
}) {
  const { event: ev, shape } = opts;
  const first = esc((opts.parentName || "there").trim().split(/\s+/)[0]);
  const fullName = esc(opts.childName.trim());
  const child = esc(opts.childName.trim().split(/\s+/)[0] || opts.childName);
  const title = esc(ev.title);
  const isProgramme = ev.programme_type === "programme";
  const noCharge = opts.complimentary || ev.is_free;
  const deadline = ev.sign_up_deadline ? longDate(ev.sign_up_deadline) : null;
  const seasonLabel = shape.season ? ` for the ${shape.season} season` : "";

  // The opening is Ollie's letter, with the facts filled in from the
  // programme rather than typed.
  const opening = opts.reminder
    ? emailParagraph(`A quick reminder that <strong>${fullName}</strong> has a place waiting on <strong>${title}</strong>${seasonLabel}.`)
    : emailParagraph(`We are delighted to invite <strong>${fullName}</strong> to join <strong>${title}</strong>${seasonLabel}.`) +
      (isProgramme
        ? emailParagraph("This invitation recognises their commitment, enthusiasm and potential. Being selected to represent Suffolk is a wonderful achievement, and we hope they will be excited to take part.")
        : "");

  const environment = isProgramme && !opts.reminder
    ? emailHeading("The County Training environment", { size: 17, margin: "24px 0 10px" }) +
      emailParagraph("County Training is designed to complement each player’s existing programme, providing a challenging, positive and performance-focused environment alongside other selected Suffolk players. It is also an excellent opportunity to meet, train with and learn from others who share their enthusiasm for tennis.") +
      emailParagraph("The programme includes:") +
      emailList([
        "Smaller, performance-appropriate training groups and player-to-coach ratios",
        "A personal written performance report after every session, scored against the nine LTA development areas",
        "Experienced county and performance coaches",
        "High-quality indoor court provision",
        "Stronger communication between county coaches, players, parents and home coaches and clubs",
        "Greater continuity between age groups within the Suffolk County pathway",
      ]) +
      (shape.coaches.length > 0
        ? emailParagraph(`${shape.coaches.length === 1 ? "The lead coach" : "The lead coaches"} for this programme: <strong>${shape.coaches.map(esc).join("</strong> and <strong>")}</strong>.`)
        : "") +
      emailParagraph("Players generally train with their age group and peers, helping them build confidence, friendships and strong team relationships. Where appropriate, they may also train or hit with an older age group in recognition of their effort, commitment, development and results. These additional opportunities are supported by the County Programme at no extra cost.")
    : "";

  const sessionsLabel = shape.sessionCount > 0
    ? `${shape.sessionCount} × ${hoursLabel(shape.hoursEach) || "County Training"} sessions across the season`
    : "";

  const details =
    emailHeading(isProgramme ? "The programme" : "The details", { size: 17, margin: "24px 0 10px" }) +
    emailDetails([
      ["Player", fullName],
      [isProgramme ? "Programme" : "Event", title],
      ["Sessions", sessionsLabel],
      [isProgramme ? "First session" : "Date", shape.firstDate ? longDate(shape.firstDate) : (opts.dateLabel ?? "")],
      ["Venue", shape.venueLine ? esc(shape.venueLine) : ev.location ? esc(ev.location) : ""],
      [isProgramme ? "Programme price" : "Cost", costLabel(ev, opts.complimentary)],
    ]) +
    (shape.venueSentence ? emailParagraph(esc(shape.venueSentence)) : "") +
    (isProgramme && !noCharge
      ? emailParagraph("One payment covers the complete programme — all the on-court delivery, and the off-court support that goes with it.") +
        emailParagraph(`That includes a personal performance report after every session, communication between the county coaches, you and ${child}\u2019s home coach and club, and the additional age-group opportunities above. It supports the delivery and continued development of a high-quality, sustainable County Performance Programme.`)
      : "") +
    (opts.complimentary
      ? emailParagraph(`Because ${child} is already on one of our programmes, this place is <strong>included at no extra charge</strong> — you just need to confirm it.`)
      : "");

  const accept =
    emailHeading("Accepting the invitation", { size: 17, margin: "24px 0 10px" }) +
    emailParagraph(
      deadline
        ? `Please confirm whether ${child} will accept this place by <strong>${deadline}</strong>.`
        : `Places are ${noCharge ? "" : "limited and "}offered by invitation, so please confirm ${child}’s place as soon as you can.`,
    ) +
    emailParagraph(
      noCharge
        ? `To accept, use the button below. You’ll sign in — or create your free Suffolk Tennis account with this email address — confirm ${child}’s details, and the place is yours.`
        : `To accept, use the button below. You’ll sign in — or create your free Suffolk Tennis account with this email address — confirm ${child}’s details, and pay securely by card. The place is confirmed the moment the payment goes through; there is no separate form to fill in.`,
    ) +
    (isProgramme
      ? emailParagraph(`By accepting the place, you agree to be added to ${child}\u2019s age-group WhatsApp group, which we use for day-to-day communication, and to the Suffolk Junior Tennis Hub, where key Suffolk Tennis announcements are posted.`)
      : "") +
    emailButton(opts.bookUrl, noCharge ? "Confirm the place" : "Accept &amp; pay") +
    (noCharge
      ? ""
      : emailParagraph(`If you need an alternative payment arrangement, please contact us through the form on <a href="${SITE_URL}" style="color: #0B7A9E;">suffolktennis.online</a>${deadline ? " before the deadline" : ""} — we will be happy to discuss it.`));

  const updates =
    emailHeading("Programme information and updates", { size: 17, margin: "24px 0 10px" }) +
    emailParagraph(`<a href="${SITE_URL}" style="color: #0B7A9E;">suffolktennis.online</a> is the home of the County Programme: programme information, news and announcements through the season. Once ${child} is booked on, your Parent Hub holds their session tickets, timetable and every performance report.`) +
    emailParagraph(`After every session, ${child}\u2019s coach writes them a personal performance report — addressed to ${child} by name, scored against the nine LTA development areas, with the coach\u2019s own notes on what went well and what they are working on next. Every one is kept in your Parent Hub, so you can follow the whole season in one place.`) +
    emailParagraph(`If you have any questions about the programme, training groups, payment or accepting the place, contact us through <a href="${SITE_URL}" style="color: #0B7A9E;">suffolktennis.online</a>.`);

  const signoff =
    emailParagraph(`We are really looking forward to the season ahead and hope ${child} will join us.`) +
    emailParagraph(`<strong>One County. One Programme. One Pathway.</strong><br>Suffolk County Tennis`);

  const body =
    emailParagraph(`Dear ${first},`) +
    opening +
    environment +
    details +
    accept +
    updates +
    signoff +
    emailNote(`This link is personal to ${child} — please don’t forward it. It stays valid after you create your account, as long as you sign up with this email address.`);

  return brandedEmail({
    unsubscribeUrl: opts.unsubscribeUrl,
    title: opts.reminder ? "Your invitation is waiting" : `${fullName} is invited`,
    preheader: `${ev.title}${shape.season ? ` — ${shape.season} season` : opts.dateLabel ? ` — ${opts.dateLabel}` : ""}`,
    body,
  });
}
