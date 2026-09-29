// Pulling email addresses out of whatever an admin pastes or uploads.
//
// Real lists are messy: cells copied from a spreadsheet carry "mailto:"
// prefixes or a web-encoded space ("%20office@…") left behind by a hyperlink,
// addresses end in a stray full stop, and one bad one used to fail a whole
// batch on the server. Everything here cleans first, then sorts addresses into
// ones we can send to and ones we can't, so the admin sees the leftovers
// instead of an error.

/** Same shape the server checks (zod's email rule), kept deliberately strict. */
const VALID = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i;

export const isValidEmail = (e: string) => VALID.test(e);

/** Undo the damage copying from a document or a link does to an address. */
export function cleanEmail(raw: string): string {
  let s = String(raw ?? "").trim();
  try { if (/%[0-9a-f]{2}/i.test(s)) s = decodeURIComponent(s); } catch { /* leave as is */ }
  return s
    .replace(/^mailto:/i, "")
    .replace(/\?.*$/, "")            // mailto:x@y.com?subject=…
    .replace(/^[\s"'<([]+|[\s"'>)\].,;:]+$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * Every address-like token in a block of text, cleaned and de-duplicated,
 * split into usable and not. Separators don't matter: commas, semicolons, new
 * lines, tabs or whole spreadsheet cells.
 */
export function extractEmails(text: string): { valid: string[]; invalid: string[] } {
  const tokens = String(text ?? "").match(/[^\s,;<>()"']*@[^\s,;<>()"']+/g) ?? [];
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const t of tokens) {
    const e = cleanEmail(t);
    if (!e) continue;
    (isValidEmail(e) ? valid : invalid).add(e);
  }
  for (const v of valid) invalid.delete(v);
  return { valid: [...valid], invalid: [...invalid] };
}
