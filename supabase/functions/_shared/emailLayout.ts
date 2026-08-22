// Shared branded shell for every transactional email (auth codes, booking
// invitations, ticket confirmations, admin alerts).
//
// Email HTML rules that shape this file: tables not flexbox, inline styles
// not classes, absolute image URLs, and web fonts that silently fall back —
// so the type stack degrades to Arial/Helvetica rather than breaking layout.

const NAVY = "#0E1D39";
const NAVY_SOFT = "#16294B";
const PINK = "#E0298E";
const CYAN = "#00ACE6";
const INK = "#1F2937";
const MUTED = "#64748B";
const BORDER = "#E2E8F0";
const FONT = "'Hanken Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";

const siteUrl = () => (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");
/** Brand images must be absolute and publicly reachable for email clients. */
const asset = (file: string) => `${siteUrl()}/email/${file}`;

const CONTACT_EMAIL = "enquiries@suffolktennis.online";

/** Primary call-to-action button (bulletproof enough for Outlook). */
export function emailButton(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 8px 0;">
    <tr><td align="center" bgcolor="${CYAN}" style="border-radius: 10px;">
      <a href="${url}" style="display: inline-block; padding: 14px 30px; font-family: ${FONT}; font-size: 15px; font-weight: 700; color: ${NAVY}; text-decoration: none; border-radius: 10px;">${label}</a>
    </td></tr>
  </table>`;
}

/** Large monospaced verification code panel. */
export function emailCode(code: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
    <tr><td align="center" bgcolor="#F1F5F9" style="border-radius: 12px; padding: 22px;">
      <div style="font-family: ${FONT}; font-size: 34px; font-weight: 700; letter-spacing: 0.28em; color: ${NAVY};">${code}</div>
    </td></tr>
  </table>`;
}

/** Key/value detail panel — used for booking and ticket summaries. */
export function emailDetails(rows: Array<[string, string]>): string {
  const body = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr>
      <td style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; color: ${MUTED};">${k}</td>
      <td align="right" style="padding: 6px 0; font-family: ${FONT}; font-size: 14px; font-weight: 600; color: ${INK};">${v}</td>
    </tr>`)
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${BORDER}; border-radius: 12px; padding: 16px 18px; margin: 8px 0 20px;">${body}</table>`;
}

/**
 * Wraps content in the Suffolk Tennis Partnership shell.
 * `preheader` is the grey preview line email clients show next to the subject.
 */
export function brandedEmail(opts: { title: string; preheader?: string; body: string }): string {
  const { title, preheader = "", body } = opts;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${title}</title>
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

        <!-- Content -->
        <tr><td bgcolor="#FFFFFF" style="padding: 32px 32px 34px; font-family: ${FONT}; color: ${INK};">
          <h1 style="margin: 0 0 12px; font-size: 22px; line-height: 1.25; font-weight: 700; color: ${NAVY};">${title}</h1>
          ${body}
        </td></tr>

        <!-- Footer: brand lockup -->
        <tr><td bgcolor="${NAVY}" style="padding: 26px 28px 22px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="96" valign="middle" style="padding-right: 16px;">
                <img src="${asset("mascot.png")}" width="88" alt="" style="display: block; width: 88px; height: auto; border: 0;">
              </td>
              <td valign="middle" style="border-left: 1px solid rgba(255,255,255,0.18); padding-left: 18px;">
                <div style="font-family: ${FONT}; font-size: 15px; font-weight: 700; line-height: 1.45; letter-spacing: 0.02em;">
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

        <tr><td bgcolor="${NAVY_SOFT}" style="padding: 16px 28px 20px; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: rgba(255,255,255,0.62);">
          Supporting Suffolk players from their first steps in competition through to county, regional and national tennis.
        </td></tr>

      </table>

      <div style="font-family: ${FONT}; font-size: 11px; color: ${MUTED}; padding: 14px 8px 0; max-width: 600px;">
        You're receiving this because you have a Suffolk Tennis Partnership account or were invited to one of our sessions.
      </div>

    </td></tr>
  </table>
</body>
</html>`;
}

/** Convenience paragraph in the shell's body voice. */
export function emailParagraph(html: string): string {
  return `<p style="margin: 0 0 16px; font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: #334155;">${html}</p>`;
}

export function emailNote(html: string): string {
  return `<p style="margin: 18px 0 0; font-family: ${FONT}; font-size: 12px; line-height: 1.6; color: ${MUTED};">${html}</p>`;
}
