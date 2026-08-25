// Shared branded shell for every transactional email (auth codes, booking
// invitations, ticket confirmations, admin alerts) and campaign sends.
//
// Email HTML rules that shape this file: tables not flexbox, inline styles
// not classes, absolute image URLs, and web fonts that silently fall back —
// so the type stack degrades to Arial/Helvetica rather than breaking layout.
// Clients that do load web fonts (Apple Mail, iOS, Samsung, Outlook for Mac)
// get the site's own pairing: Archivo for display, Hanken Grotesk for body.

const NAVY = "#0E1D39";
const NAVY_SOFT = "#16294B";
const PINK = "#E0298E";
const CYAN = "#00ACE6";
const INK = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";

/** Body copy — matches --font-body on the site. */
export const FONT = "'Hanken Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";
/** Display type — matches --font-display (Archivo, semi-expanded, uppercase). */
export const DISPLAY = "'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Body copy colour on navy sections. */
const ON_DARK = "rgba(255,255,255,0.82)";
const ON_DARK_MUTED = "rgba(255,255,255,0.60)";

// Mirrors the site's own import (src/index.css) so email type matches the
// web: Archivo's variable width axis is what makes the semi-expanded
// (font-stretch: 112%) display cut available.
const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&family=Hanken+Grotesk:wght@400;500;600;700&display=swap";

const siteUrl = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
/** Brand images must be absolute and publicly reachable for email clients. */
const asset = (file: string) => `${siteUrl()}/email/${file}`;

const CONTACT_EMAIL = "enquiries@suffolktennis.online";

/**
 * Display heading in the site's voice: Archivo, semi-expanded, uppercase.
 * `onDark` flips it to white for navy sections.
 */
export function emailHeading(
  text: string,
  opts: { size?: number; onDark?: boolean; margin?: string } = {},
): string {
  const { size = 23, onDark = false, margin = "0 0 14px" } = opts;
  return `<div style="margin: ${margin}; font-family: ${DISPLAY}; font-size: ${size}px; line-height: 1.08; font-weight: 700; font-stretch: 112%; text-transform: uppercase; letter-spacing: 0.005em; color: ${onDark ? "#FFFFFF" : NAVY};">${text}</div>`;
}

/** Small pink kicker that opens a section. */
export function emailKicker(text: string, opts: { margin?: string } = {}): string {
  const { margin = "0 0 12px" } = opts;
  return `<div style="margin: ${margin}; font-family: ${DISPLAY}; font-size: 12px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.16em; text-transform: uppercase; color: ${PINK};">${text}</div>`;
}

/** Primary call-to-action button (bulletproof enough for Outlook). */
export function emailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0;">
    <tr><td align="center" bgcolor="${CYAN}" style="border-radius: 10px;">
      <a href="${url}" style="display: inline-block; padding: 15px 32px; font-family: ${DISPLAY}; font-size: 14px; font-weight: 700; font-stretch: 112%; text-transform: uppercase; letter-spacing: 0.06em; color: ${NAVY}; text-decoration: none; border-radius: 10px;">${label}</a>
    </td></tr>
  </table>`;
}

/** Large verification code panel. */
export function emailCode(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
    <tr><td align="center" bgcolor="${NAVY}" style="border-radius: 12px; padding: 24px;">
      <div style="font-family: ${DISPLAY}; font-size: 36px; font-weight: 700; font-stretch: 112%; letter-spacing: 0.26em; color: #FFFFFF;">${code}</div>
    </td></tr>
  </table>`;
}

/** Key/value detail panel — used for booking and ticket summaries. */
export function emailDetails(rows: Array<[string, string]>, opts: { onDark?: boolean } = {}): string {
  const { onDark = false } = opts;
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr>
      <td style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; color: ${onDark ? ON_DARK_MUTED : MUTED};">${k}</td>
      <td align="right" style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${onDark ? "#FFFFFF" : INK};">${v}</td>
    </tr>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${onDark ? "rgba(255,255,255,0.16)" : BORDER}; border-radius: 12px; padding: 16px 18px; margin: 8px 0 20px;">${body}</table>`;
}

/** Convenience paragraph in the shell's body voice. */
export function emailParagraph(html: string, opts: { onDark?: boolean } = {}): string {
  const color = opts.onDark ? ON_DARK : "#334155";
  return `<p style="margin: 0 0 16px; font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: ${color};">${html}</p>`;
}

export function emailNote(html: string, opts: { onDark?: boolean } = {}): string {
  const color = opts.onDark ? ON_DARK_MUTED : MUTED;
  return `<p style="margin: 18px 0 0; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${color};">${html}</p>`;
}

/** Full-width photo inside a content section. */
export function emailPhoto(file: string, alt: string, opts: { radius?: number } = {}): string {
  const { radius = 12 } = opts;
  return `<img src="${asset(file)}" width="536" alt="${alt}" style="display: block; width: 100%; height: auto; border: 0; border-radius: ${radius}px; margin: 4px 0 18px;">`;
}

/**
 * A band of content that spans the full card width. `tone` picks the
 * background: white, navy, or the softer navy used by the footer strip.
 */
export type EmailSection = { tone?: "light" | "navy" | "navy-soft"; html: string; padding?: string };

function renderSection(s: EmailSection): string {
  const tone = s.tone ?? "light";
  const bg = tone === "navy" ? NAVY : tone === "navy-soft" ? NAVY_SOFT : "#FFFFFF";
  const padding = s.padding ?? (tone === "light" ? "32px 32px 30px" : "30px 32px 32px");
  return `<tr><td bgcolor="${bg}" class="pad" style="padding: ${padding}; font-family: ${FONT}; color: ${tone === "light" ? INK : "#FFFFFF"};">${s.html}</td></tr>`;
}

/**
 * Wraps content in the Suffolk Tennis Partnership shell.
 * `preheader` is the grey preview line email clients show next to the subject.
 * `hero` renders a full-bleed image between the header and the content.
 * Pass either `body` (one white content block, with `title` as its heading)
 * or `sections` for a campaign layout that alternates light and navy bands.
 */
export function brandedEmail(opts: {
  title: string;
  preheader?: string;
  body?: string;
  sections?: EmailSection[];
  hero?: { file: string; alt: string };
}): string {
  const { title, preheader = "", body, sections, hero } = opts;

  const heroRow = hero
    ? `<tr><td style="padding: 0; font-size: 0; line-height: 0;">
          <img src="${asset(hero.file)}" width="600" alt="${hero.alt}" style="display: block; width: 100%; height: auto; border: 0;">
        </td></tr>`
    : "";

  const content = sections
    ? sections.map(renderSection).join("")
    : renderSection({ tone: "light", html: emailHeading(title) + (body ?? "") });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${FONT_HREF}" rel="stylesheet">
<style>
  @import url('${FONT_HREF}');
  body { -webkit-text-size-adjust: 100%; }
  a { color: ${CYAN}; }
  @media only screen and (max-width: 620px) {
    .pad { padding: 26px 22px !important; }
    .half { display: block !important; width: 100% !important; }
  }
</style>
</head>
<body style="margin: 0; padding: 0; background-color: #EEF2F7;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${preheader}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #EEF2F7; padding: 24px 12px;">
    <tr><td align="center">

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 600px; width: 100%; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 10px rgba(15,23,42,0.06);">

        <!-- Header -->
        <tr><td bgcolor="${NAVY}" align="center" style="padding: 30px 24px 26px;">
          <img src="${asset("logo.png")}" width="240" alt="LTA Suffolk Tennis Partnership" style="display: block; width: 240px; max-width: 70%; height: auto; border: 0;">
        </td></tr>
        <tr><td style="height: 4px; background: ${PINK}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
        ${heroRow}
        ${content}

        <!-- Footer: brand lockup -->
        <tr><td bgcolor="${NAVY}" class="pad" style="padding: 26px 28px 22px; border-top: 4px solid ${PINK};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="96" valign="middle" style="padding-right: 16px;">
                <img src="${asset("mascot.png")}" width="88" alt="" style="display: block; width: 88px; height: auto; border: 0;">
              </td>
              <td valign="middle" style="border-left: 1px solid rgba(255,255,255,0.18); padding-left: 18px;">
                <div style="font-family: ${DISPLAY}; font-size: 15px; font-weight: 700; font-stretch: 112%; line-height: 1.5; letter-spacing: 0.04em;">
                  <span style="color: ${PINK};">ONE COUNTY.</span><br>
                  <span style="color: #FFFFFF;">ONE PROGRAMME.</span><br>
                  <span style="color: ${PINK};">ONE PATHWAY.</span>
                </div>
                <div style="height: 1px; background: rgba(255,255,255,0.18); margin: 14px 0 12px; font-size: 0; line-height: 0;">&nbsp;</div>
                <div style="font-family: ${FONT}; font-size: 13px; line-height: 1.9;">
                  <a href="${siteUrl()}" style="color: #FFFFFF; text-decoration: none;">suffolktennis.online</a><br>
                  <a href="mailto:${CONTACT_EMAIL}" style="color: #FFFFFF; text-decoration: none;">${CONTACT_EMAIL}</a>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <tr><td bgcolor="${NAVY_SOFT}" class="pad" style="padding: 16px 28px 20px; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${ON_DARK_MUTED};">
          Supporting Suffolk players from their first steps in competition through to county, regional and national tennis.
        </td></tr>

      </table>

      <div style="font-family: ${FONT}; font-size: 11px; color: ${MUTED}; padding: 14px 8px 0; max-width: 600px;">
        You're receiving this because you have a Suffolk Tennis Partnership account or are a regularly competing Suffolk junior.
      </div>

    </td></tr>
  </table>
</body>
</html>`;
}
