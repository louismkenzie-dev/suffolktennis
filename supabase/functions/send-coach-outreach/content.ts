/**
 * Connecting Suffolk's 10U Pathway — the introduction email to clubs, coaches
 * and schools across the county, from Ollie as 10U County Lead.
 *
 * Same shape as send-county-9u10u/content.ts: one exported builder so the
 * markup can be rendered locally for review (see README.md) and sent from an
 * edge function without the two drifting apart. The words are Ollie's; they
 * were tightened for email rather than rewritten.
 */
import {
  DISPLAY, FONT, brandedEmail, emailButton, emailHeading, emailKicker,
  emailNote, emailParagraph, type EmailSection,
} from "../_shared/emailLayout.ts";

const NAVY = "#0E1D39";
const CYAN = "#00ACE6";
const PINK = "#E0298E";
const INK = "#334155";

const CONTACT_EMAIL = "enquiries@suffolktennis.online";

/** The two Talent ID days (as on the posters) and the nomination cut-off. Change here only. */
type TalentDay = { venue: string; address: string; when: string; sessions: Array<{ who: string; time: string }> };
const TALENT_ID_DAYS: TalentDay[] = [
  {
    venue: "Culford School", address: "Bury Road, Culford, Bury St Edmunds, IP28 6TX", when: "Sunday 25 October 2026",
    sessions: [{ who: "Born 2020 or 2021", time: "1.30&ndash;3.00pm" }, { who: "Born 2019", time: "3.30&ndash;5.00pm" }],
  },
  {
    venue: "Ipswich Sports Club", address: "Henley Road, Ipswich, IP1 4NJ", when: "Monday 26 October 2026",
    sessions: [{ who: "Born 2020 or 2021", time: "2.00&ndash;3.30pm" }, { who: "Born 2019", time: "4.00&ndash;5.30pm" }],
  },
];
const NOMINATION_DEADLINE = "Friday 16 October";

// Same rule the shell uses: brand images must be absolute and public.
const siteUrl = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
const asset = (file: string) => `${siteUrl()}/email/${file}`;

/** A pre-filled nomination email so a coach can reply in one tap. */
const nominateHref = () => {
  const subject = "Talent ID nomination";
  const body = [
    "Player's name:", "Year of birth:", "Club, school or programme:",
    "Coach / contact details:", "Why I've nominated them:",
    "Which session they could attend (if known):",
  ].join("\n");
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

/** Sub-heading inside a section, in the display face. */
const subhead = (text: string, onDark = false) =>
  `<div style="margin: 22px 0 10px; font-family: ${DISPLAY}; font-size: 18px; line-height: 1.2; font-weight: 700; font-stretch: 112%; text-transform: uppercase; color: ${onDark ? "#FFFFFF" : NAVY};">${text}</div>`;

/** Bulleted list in the shell's body voice. */
function bullets(items: string[], onDark = false): string {
  const rows = items.map((item) => `<tr>
    <td width="18" valign="top" style="width: 18px; padding: 4px 10px 4px 0; font-family: ${FONT}; font-size: 13px; line-height: 1.6; color: ${CYAN};">&#9679;</td>
    <td style="padding: 4px 0; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: ${onDark ? "rgba(255,255,255,0.82)" : INK};">${item}</td>
  </tr>`).join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 16px;">${rows}</table>`;
}

/** One Talent ID day: date, venue and address, then a time for each age band. */
function dayCards(days: TalentDay[]): string {
  const session = (x: { who: string; time: string }) => `<tr>
        <td style="padding: 3px 0; font-family: ${FONT}; font-size: 13px; color: ${INK};">${x.who}</td>
        <td align="right" style="padding: 3px 0 3px 10px; font-family: ${FONT}; font-size: 13px; font-weight: 700; color: ${NAVY}; white-space: nowrap;">${x.time}</td>
      </tr>`;
  const cell = (d: TalentDay, i: number) => `<td class="half" width="50%" valign="top" style="padding: 0 ${i ? "0 10px 5px" : "5px 10px 0"};">
      <div style="background: #FFFFFF; border: 1px solid rgba(0,172,230,0.35); border-left: 4px solid ${CYAN}; border-radius: 10px; padding: 14px 16px;">
        <div style="font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.12em; text-transform: uppercase; color: ${CYAN};">${d.when}</div>
        <div style="margin-top: 4px; font-family: ${DISPLAY}; font-size: 16px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; color: ${NAVY};">${d.venue}</div>
        <div style="margin-top: 2px; font-family: ${FONT}; font-size: 12px; line-height: 1.5; color: #64748B;">${d.address}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top: 10px; border-top: 1px solid #E2E8F0; padding-top: 6px;">${d.sessions.map(session).join("")}</table>
      </div>
    </td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 6px 0 14px;"><tr>${days.map(cell).join("")}</tr></table>`;
}

export function build(unsubscribeUrl?: string): { subject: string; html: string } {
  const sections: EmailSection[] = [
    // Opening — who is writing and why.
    {
      tone: "light",
      html:
        emailKicker("Suffolk Tennis &middot; 10U Pathway") +
        emailHeading("We want you involved", { size: 30 }) +
        emailParagraph("Hi,") +
        emailParagraph("I wanted to get in touch to introduce the direction we are taking with Suffolk Tennis, and in particular our plans to significantly strengthen the 10U pathway and Talent ID network across the county.") +
        emailParagraph("Alongside <strong>Danny Wyatt</strong>, Lead Coach for our 10U Enhanced Performance Programme at Culford, and <strong>Chris Daynes</strong>, our 11&ndash;18 County Lead, I have recently taken responsibility for the 10U performance provision as Suffolk&rsquo;s <strong>10U County Lead</strong>.") +
        emailParagraph("One of our biggest priorities is simple: to reconnect Suffolk Tennis with the coaches, clubs and schools developing young players every single week."),
    },

    // Statement band — the heart of the message.
    {
      tone: "navy",
      html:
        emailHeading("You are doing the most important part of the job", { size: 24, onDark: true }) +
        emailParagraph("You are putting rackets in children&rsquo;s hands, building their skills, inspiring them to love the game, and often seeing their potential long before they appear on the county radar.", { onDark: true }) +
        emailParagraph("Our job is to connect that work into a clear Suffolk pathway. We want to know who your players are and who the coaches developing them are, and we want to create additional opportunities for those children <strong style=\"color: #FFFFFF;\">without taking them away</strong> from the environments and people responsible for their development.", { onDark: true }),
    },

    // Talent ID — the ask.
    {
      tone: "light",
      html:
        emailKicker("Talent ID") +
        emailHeading("Is there someone we should know about?", { size: 26 }) +
        emailParagraph("Our immediate Talent ID focus is on children born in <strong>2020 and 2021</strong>, and those coming behind them, while continuing to support our 2019 cohort towards 8U County Cup next year. These days are the start of the <strong>County Rising Stars programme</strong> for 8U players: the first step on the Suffolk pathway, there to support each child&rsquo;s tennis journey from the very beginning.") +
        emailParagraph("We would like every coach, club and school receiving this to look at the children you work with and ask that question. They don&rsquo;t need to be an established county player. We&rsquo;re interested in children who catch your eye through their athletic ability, coordination, competitiveness, character, enthusiasm, love of sport, or simply that little something that makes you think there could be potential.") +
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 4px 0 20px;">
          <tr><td style="border-left: 4px solid ${PINK}; padding: 6px 0 6px 18px; font-family: ${DISPLAY}; font-size: 20px; line-height: 1.25; font-weight: 700; font-stretch: 112%; color: ${NAVY};">If you&rsquo;re unsure, nominate them.<br><span style="color: ${PINK};">We&rsquo;d rather see a child than miss one.</span></td></tr>
        </table>` +
        subhead("Our first Talent ID days") +
        dayCards(TALENT_ID_DAYS) +
        emailParagraph("Each session is a fun, positive 90 minutes designed to help young players show their potential through movement, racket skills, learning and competition. We look for potential, not just polished technique. Both days are free of charge.") +
        emailParagraph("If there is a child you believe deserves the opportunity to be seen, please send us:") +
        bullets([
          "Player&rsquo;s name",
          "Year of birth",
          "Club, school or programme",
          "Coach / contact details",
          "A brief note on why you&rsquo;ve nominated them",
          "Which day and session they could attend, if known",
        ]) +
        emailParagraph(`Please send nominations to <a href="mailto:${CONTACT_EMAIL}" style="color: ${CYAN}; font-weight: 600;">${CONTACT_EMAIL}</a> by <strong>${NOMINATION_DEADLINE}</strong>. We will then issue digital invitations and registration details directly to the relevant families.`) +
        emailButton(nominateHref(), "Nominate a player"),
    },

    // Coaches — the second ask.
    {
      tone: "navy",
      html:
        emailKicker("Coaches") +
        emailHeading("We want coaches involved too", { size: 24, onDark: true }) +
        emailParagraph("This isn&rsquo;t only about identifying players. Are you a coach who would like to become more involved with the Suffolk pathway?", { onDark: true }) +
        emailParagraph("We want to build a much wider network of coaches across the county: share ideas, create opportunities, and better connect the great work already happening within clubs, schools and coaching programmes.", { onDark: true }) +
        emailParagraph("We also want to recognise it. Through our new website we will increasingly showcase the clubs, schools and coaches contributing to Suffolk&rsquo;s player pathway, and give parents a clearer picture of the people and programmes developing tennis across our county.", { onDark: true }),
    },

    // The platform and Punchy.
    {
      tone: "light",
      html:
        // The site address goes in the kicker: as a 26px heading it is one
        // unbreakable word wider than a phone column.
        emailKicker("suffolktennis.online") +
        emailHeading("A more connected Suffolk pathway", { size: 26 }) +
        emailParagraph("We&rsquo;ve launched <a href=\"https://suffolktennis.online\" style=\"color: " + CYAN + "; font-weight: 600;\">suffolktennis.online</a> to start bringing all of this together: the beginning of a new digital home for Suffolk Tennis, connecting the pathway, county training, Talent ID, competition, clubs, coaches and information for parents in one place.") +
        emailParagraph("We&rsquo;re also introducing a new digital platform for families. Following nominations, parents receive digital invitations and sign-ups directly through the platform, making county opportunities much simpler to access and giving families a clearer connection to their child&rsquo;s journey.") +
        // Meet Punchy — image beside the copy, stacking on a phone.
        `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 6px 0 14px; background: ${NAVY}; border-radius: 14px;">
          <tr>
            <td class="half" width="180" valign="bottom" align="center" style="padding: 18px 18px 0; font-size: 0; line-height: 0;">
              <img src="${asset("punchy-pink.png")}" width="150" alt="Punchy, the Suffolk Tennis 10U mascot, giving a thumbs up" style="display: block; width: 150px; height: auto; border: 0;">
            </td>
            <td class="half" valign="middle" style="padding: 22px 22px 22px 18px;">
              <div style="font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK}; margin: 0 0 6px;">For our youngest players</div>
              <div style="font-family: ${DISPLAY}; font-size: 22px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; color: #FFFFFF; margin: 0 0 10px;">Meet Punchy</div>
              <p style="margin: 0; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.82);">Punchy is the Suffolk Tennis 10U mascot. He follows the player journey, helping children love the game, grow in confidence, build great habits, make new friends and dream big, from their earliest experiences through to representing Suffolk.</p>
            </td>
          </tr>
        </table>` +
        emailButton("https://suffolktennis.online", "Have a look at what we&rsquo;re building"),
    },

    // Close — and the door left open for those with no nomination.
    {
      tone: "navy",
      html:
        emailHeading("Our job now is to connect it", { size: 24, onDark: true }) +
        emailParagraph("Even if you don&rsquo;t have a player to nominate this time, we still want to hear from you. If you&rsquo;re a coach, club or school that wants a stronger connection with Suffolk Tennis, wants to understand the pathway, or would like to explore becoming more involved, please get in touch.", { onDark: true }) +
        emailParagraph("There is already a huge amount of good work happening across Suffolk.", { onDark: true }) +
        `<div style="margin: 4px 0 22px; font-family: ${DISPLAY}; font-size: 17px; font-weight: 700; font-stretch: 112%; line-height: 1.6; letter-spacing: 0.03em; text-transform: uppercase;">
          <span style="color: ${PINK};">To connect the coaches.</span><br>
          <span style="color: #FFFFFF;">To connect the clubs and schools.</span><br>
          <span style="color: ${PINK};">To find the players.</span><br>
          <span style="color: #FFFFFF;">And to make sure talented young children across Suffolk can see and access the opportunities ahead of them.</span>
        </div>` +
        emailParagraph("We&rsquo;d love you to be part of it.", { onDark: true }) +
        emailButton(`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Suffolk 10U pathway")}`, "Get in touch") +
        `<p style="margin: 26px 0 0; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: rgba(255,255,255,0.82);">Best wishes,</p>
        <p style="margin: 10px 0 0; font-family: ${DISPLAY}; font-size: 17px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; letter-spacing: 0.03em; color: #FFFFFF;">Ollie Sutton</p>
        <p style="margin: 2px 0 0; font-family: ${FONT}; font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.70);">10U County Lead, Suffolk Tennis<br><a href="mailto:${CONTACT_EMAIL}" style="color: ${CYAN}; text-decoration: none;">${CONTACT_EMAIL}</a></p>` +
        emailNote("Danny Wyatt &middot; 10U Enhanced Performance Programme Lead, Culford RPDC<br>Chris Daynes &middot; 11&ndash;18 County Lead", { onDark: true }),
    },
  ];

  return {
    subject: "Connecting Suffolk’s 10U Pathway – We Want You Involved",
    html: brandedEmail({
      title: "Connecting Suffolk’s 10U Pathway",
      preheader: "A new 10U County Lead, a new digital home for Suffolk Tennis, and County Rising Stars Talent ID days in October. Is there a child we should know about?",
      hero: { file: "punchy-pathway-v2.jpg", alt: "Suffolk Tennis: your 10U tennis pathway. Punchy in red, orange and green for 8U, 9U and 10U" },
      sections,
      unsubscribeUrl,
      audienceNote: "You're receiving this because you coach, run a club or teach tennis in Suffolk, and we would like to work more closely with you.",
    }),
  };
}
