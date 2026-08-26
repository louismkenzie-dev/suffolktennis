// Renders an admin-composed campaign into the branded shell.
//
// The admin controls CONTENT — words, pictures, order. They do not control
// layout, colour or type: every block is rendered by these functions, so a
// campaign written in the admin panel comes out looking like the county
// announcement rather than like a word processor. Anything unrecognised is
// dropped rather than passed through, which also means block text can never
// inject markup into the email.
import {
  brandedEmail, emailButton, emailHeading, emailKicker,
  emailNote, emailParagraph, type EmailSection,
} from "./emailLayout.ts";

export type Block =
  | { type: "heading"; text: string }
  | { type: "kicker"; text: string }
  | { type: "text"; text: string }
  | { type: "image"; url: string; alt?: string }
  | { type: "button"; label: string; url: string }
  | { type: "band"; heading?: string; text?: string }   // navy statement band
  | { type: "list"; items: string[] }
  | { type: "note"; text: string };

/** Escape everything: block text is data typed into a form, never markup. */
function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Line breaks typed in a textarea should survive into the email. */
function escMultiline(s: unknown): string {
  return esc(s).replace(/\r?\n/g, "<br>");
}

/** Only our own storage/site images may be referenced. */
function safeImageUrl(url: unknown): string | null {
  const u = String(url ?? "");
  if (!/^https:\/\//i.test(u)) return null;
  const allowed = [
    "suffolktennis.online/",
    ".supabase.co/storage/v1/object/public/email-media/",
    ".supabase.co/storage/v1/object/public/news-media/",
  ];
  return allowed.some((frag) => u.includes(frag)) ? u : null;
}

function safeLinkUrl(url: unknown): string | null {
  const u = String(url ?? "").trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

const FONT = "'Hanken Grotesk', 'Segoe UI', Helvetica, Arial, sans-serif";
const CYAN = "#00ACE6";
const ON_DARK = "rgba(255,255,255,0.82)";

function listHtml(items: string[], onDark: boolean): string {
  const rows = items.filter((i) => String(i).trim()).map((item) => `<tr>
    <td width="18" valign="top" style="width: 18px; padding: 5px 10px 5px 0; font-family: ${FONT}; font-size: 13px; color: ${CYAN}; line-height: 1.6;">&#9679;</td>
    <td style="padding: 5px 0; font-family: ${FONT}; font-size: 15px; line-height: 1.6; color: ${onDark ? ON_DARK : "#334155"};">${esc(item)}</td>
  </tr>`).join("");
  return rows
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 0 0 16px;">${rows}</table>`
    : "";
}

/**
 * Blocks become alternating bands: consecutive light blocks are grouped into
 * one white section, a `band` block becomes its own navy section, and an
 * `image` becomes a full-bleed row. That is what produces the county-email
 * rhythm automatically, without the admin having to think about it.
 */
export function blocksToSections(blocks: Block[]): EmailSection[] {
  const sections: EmailSection[] = [];
  let buffer = "";

  const flush = () => {
    if (buffer.trim()) sections.push({ tone: "light", html: buffer });
    buffer = "";
  };

  for (const raw of blocks ?? []) {
    const b = raw as Block;
    switch (b?.type) {
      case "heading":
        buffer += emailHeading(esc(b.text), { size: 24 });
        break;
      case "kicker":
        buffer += emailKicker(esc(b.text), { margin: "24px 0 10px" });
        break;
      case "text":
        buffer += emailParagraph(escMultiline(b.text));
        break;
      case "note":
        buffer += emailNote(escMultiline(b.text));
        break;
      case "list":
        buffer += listHtml(Array.isArray(b.items) ? b.items : [], false);
        break;
      case "button": {
        const url = safeLinkUrl(b.url);
        if (url) buffer += emailButton(url, esc(b.label || "Find out more"));
        break;
      }
      case "image": {
        const url = safeImageUrl(b.url);
        if (!url) break;
        flush();
        sections.push({
          tone: "light",
          padding: "0",
          html: `<img src="${url}" width="600" alt="${esc(b.alt ?? "")}" style="display: block; width: 100%; height: auto; border: 0;">`,
        });
        break;
      }
      case "band": {
        flush();
        const heading = b.heading ? emailHeading(esc(b.heading), { size: 24, onDark: true, margin: "0 0 10px" }) : "";
        const text = b.text
          ? `<div style="font-family: ${FONT}; font-size: 15px; line-height: 1.65; color: ${ON_DARK};">${escMultiline(b.text)}</div>`
          : "";
        sections.push({
          tone: "navy",
          padding: "32px 32px 34px",
          html: `<div align="center" style="text-align: center;">${heading}${text}</div>`,
        });
        break;
      }
      default:
        break; // unknown block types are dropped, never passed through
    }
  }
  flush();
  return sections;
}

/** Full campaign HTML: admin content inside the standard brand shell. */
export function renderCampaign(opts: {
  subject: string;
  preheader?: string;
  heroUrl?: string | null;
  blocks: Block[];
  unsubscribeUrl?: string;
}): string {
  const hero = safeImageUrl(opts.heroUrl);
  const sections = blocksToSections(opts.blocks);
  if (sections.length === 0) {
    sections.push({ tone: "light", html: emailParagraph("This email has no content yet.") });
  }
  return brandedEmail({
    title: opts.subject || "Suffolk Tennis",
    preheader: opts.preheader ?? "",
    unsubscribeUrl: opts.unsubscribeUrl,
    // brandedEmail's hero takes a filename under /email/; a full URL is
    // handled here as a leading full-bleed section instead.
    sections: hero
      ? [{ tone: "light", padding: "0", html: `<img src="${hero}" width="600" alt="" style="display: block; width: 100%; height: auto; border: 0;">` }, ...sections]
      : sections,
  });
}
