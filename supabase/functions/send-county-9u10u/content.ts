/**
 * Suffolk County Tennis — 9U & 10U Programme Update (2026/27).
 *
 * Kept as one exported builder so the same markup can be rendered locally for
 * review and sent from the edge function without the two drifting apart.
 */
import {
  DISPLAY, FONT, brandedEmail, emailButton, emailHeading, emailKicker,
  emailNote, emailParagraph, emailPhoto, type EmailSection,
} from "../_shared/emailLayout.ts";

const CYAN = "#00ACE6";
const PINK = "#E0298E";

// Same rule the shell uses: brand images must be absolute and public.
const siteUrl = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
const asset = (file: string) => `${siteUrl()}/email/${file}`;

/** Edge-to-edge photo used as a break between sections. */
const fullBleed = (file: string, alt: string) =>
  `<img src="${asset(file)}" width="600" alt="${alt}" style="display: block; width: 100%; height: auto; border: 0;">`;

/** A venue's timetable: each row is a time and the groups training then. */
function timetable(rows: Array<{ time: string; groups: string }>, onDark = false): string {
  const border = onDark ? "rgba(255,255,255,0.16)" : "#E2E8F0";
  const body = rows.map((r, i) => `<tr>
      <td width="42%" valign="top" style="padding: 14px 0; ${i ? `border-top: 1px solid ${border};` : ""} font-family: ${DISPLAY}; font-size: 17px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.01em; color: ${CYAN}; white-space: nowrap;">${r.time}</td>
      <td valign="top" style="padding: 14px 0; ${i ? `border-top: 1px solid ${border};` : ""} font-family: ${FONT}; font-size: 15px; line-height: 1.5; font-weight: 600; color: ${onDark ? "#FFFFFF" : "#1F2937"};">${r.groups}</td>
    </tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0 22px;">${body}</table>`;
}

/** Training dates as a two-column list of pill rows. */
function dateList(dates: string[], onDark = false): string {
  const bg = onDark ? "rgba(255,255,255,0.08)" : "#F1F5F9";
  const fg = onDark ? "#FFFFFF" : "#0E1D39";
  const cell = (d?: string) => d
    ? `<td width="50%" valign="top" style="padding: 0 5px 10px;">
         <div style="background: ${bg}; border-left: 3px solid ${PINK}; border-radius: 8px; padding: 11px 14px; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${fg};">${d}</div>
       </td>`
    : `<td width="50%" style="padding: 0 5px 10px;">&nbsp;</td>`;
  let rows = "";
  for (let i = 0; i < dates.length; i += 2) {
    rows += `<tr>${cell(dates[i])}${cell(dates[i + 1])}</tr>`;
  }
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 2px -5px 18px; width: calc(100% + 10px);">${rows}</table>`;
}

/** Small labelled venue tag that opens each block. */
function venueTag(text: string): string {
  return `<div style="display: inline-block; background: rgba(0,172,230,0.12); border: 1px solid rgba(0,172,230,0.35); border-radius: 999px; padding: 6px 14px; margin: 0 0 14px; font-family: ${DISPLAY}; font-size: 11px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.14em; text-transform: uppercase; color: #0E1D39;">${text}</div>`;
}

export function build(unsubscribeUrl?: string): { subject: string; html: string } {
  const sections: EmailSection[] = [
    // Opening
    {
      tone: "light",
      html:
        emailKicker("Suffolk County Tennis") +
        emailHeading("9U &amp; 10U Programme Update", { size: 30 }) +
        emailParagraph("<strong>Dear Parents,</strong>") +
        emailParagraph("Thank you for your patience while we finalised the structure of our 9U and 10U County Programme for 2026/27.") +
        emailParagraph("We are pleased to confirm our training dates and venue arrangements for the season ahead as we continue to develop a more connected county pathway for Suffolk's younger players."),
    },

    // Brand line
    {
      tone: "navy",
      padding: "34px 32px",
      // Stacked rather than run together: on a phone the single line broke
      // mid-phrase and left "One" orphaned above "Pathway."
      html: `<div style="text-align: center; font-family: ${DISPLAY}; font-size: 22px; font-weight: 700; font-stretch: 112%; line-height: 1.5; letter-spacing: 0.06em; text-transform: uppercase;">
        <span style="color: ${PINK};">One County.</span><br>
        <span style="color: #FFFFFF;">One Programme.</span><br>
        <span style="color: ${PINK};">One Pathway.</span>
      </div>`,
    },

    // Culford
    {
      tone: "light",
      html:
        venueTag("September – December") +
        emailHeading("Culford", { size: 26 }) +
        emailParagraph("For the remainder of 2026, our county training sessions will take place at Culford, with the following groups training across the afternoon.") +
        emailPhoto("county-culford.jpg", "Junior training on the indoor courts at Culford") +
        timetable([
          { time: "1.30 – 3.30pm", groups: "10U Boys B &amp; 10U Girls" },
          { time: "3.30 – 5.30pm", groups: "9U Boys, 9U Girls &amp; 10U Boys A" },
        ]) +
        `<div style="font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK}; margin: 0 0 12px;">Training dates</div>` +
        dateList([
          "Sunday 20 September 2026",
          "Sunday 4 October 2026",
          "Sunday 22 November 2026",
          "Sunday 20 December 2026",
        ]),
    },

    // Photo break
    { tone: "light", padding: "0", html: fullBleed("county-squad.jpg", "Suffolk juniors together at a county training day") },

    // Why we bring the groups together
    {
      tone: "navy",
      html:
        emailKicker("Why it matters") +
        emailHeading("Bringing our young players together", { size: 24, onDark: true }) +
        emailParagraph("One of our priorities, particularly before Christmas, is to create more opportunities for our younger county players to come together.", { onDark: true }) +
        emailParagraph("There are significant benefits to this. Players get to train with and against other leading juniors from across Suffolk, build friendships, learn from each other and become familiar with those immediately ahead of them on the pathway.", { onDark: true }) +
        emailParagraph("It also gives our county coaches greater opportunity to work across the groups, get to know the players and maintain stronger links with their individual coaches and clubs.", { onDark: true }),
    },

    // Half-term camp
    {
      tone: "light",
      html:
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid rgba(224,41,142,0.35); background: rgba(224,41,142,0.05); border-radius: 12px;">
          <tr><td style="padding: 20px 22px;">
            <div style="font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK}; margin: 0 0 8px;">Coming soon</div>
            <div style="font-family: ${DISPLAY}; font-size: 19px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; color: #0E1D39; margin: 0 0 10px;">October half-term camp</div>
            <p style="margin: 0 0 10px; font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: #334155;">To help bridge the gap between our October and November County Training Days, we are also looking at running an additional training camp during the October half-term.</p>
            <p style="margin: 0; font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: #334155;">Further details will follow once arrangements are confirmed, and we will continue to explore similar opportunities during future school holidays.</p>
          </td></tr>
        </table>`,
    },

    // Ipswich Sports Club
    {
      tone: "light",
      padding: "10px 32px 30px",
      html:
        venueTag("January onwards") +
        emailHeading("Ipswich Sports Club", { size: 26 }) +
        emailParagraph("From January 2027, our county training sessions will move to Ipswich Sports Club, with the following timetable.") +
        timetable([
          { time: "1.00 – 3.00pm", groups: "10U Boys B &amp; 10U Girls" },
          { time: "3.00 – 5.00pm", groups: "9U Boys, 9U Girls &amp; 10U Boys A" },
        ]) +
        `<div style="font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK}; margin: 0 0 12px;">Proposed training dates</div>` +
        dateList([
          "Sunday 31 January 2027",
          "Sunday 21 February 2027",
          "Sunday 28 March 2027",
          "Sunday 11 April 2027",
          "Sunday 16 May 2027",
          "Sunday 20 June 2027",
          "Sunday 11 July 2027",
        ]) +
        emailNote("The spring and summer dates remain provisional until the full 2027 LTA competition calendar is available, and will be reviewed if required."),
    },

    // Photo break
    { tone: "light", padding: "0", html: fullBleed("county-juniors.jpg", "Young Suffolk players with their awards") },

    // Close
    {
      tone: "navy",
      html:
        emailHeading("The season ahead", { size: 24, onDark: true }) +
        emailParagraph("Thank you again for your support and patience while we have brought the different elements of the programme together.", { onDark: true }) +
        emailParagraph("We are excited about the opportunities ahead and look forward to seeing Suffolk's young players continue to develop, build relationships and feel part of a stronger and more connected county programme.", { onDark: true }) +
        emailButton("https://suffolktennis.online", "Visit suffolktennis.online") +
        emailNote("Please continue to visit suffolktennis.online for programme information and updates.", { onDark: true }) +
        `<p style="margin: 20px 0 0; font-family: ${DISPLAY}; font-size: 15px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; letter-spacing: 0.04em; color: #FFFFFF;">Suffolk Tennis Partnership</p>`,
    },
  ];

  return {
    subject: "Suffolk County Tennis — 9U & 10U Programme Update",
    html: brandedEmail({
      title: "9U & 10U Programme Update",
      preheader: "Training dates and venues confirmed for 2026/27 — Culford until Christmas, Ipswich Sports Club from January.",
      hero: { file: "county-hero.jpg", alt: "Suffolk Tennis juniors courtside" },
      sections,
      unsubscribeUrl,
    }),
  };
}
