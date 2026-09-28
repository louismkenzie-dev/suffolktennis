// Reading a spreadsheet of players into the county database — the pure part.
//
// An admin gets sent lists in every shape: the LTA RCP report, a club's own
// sheet, a coach's Talent ID nominations, a school's sign-up form. So this
// does not insist on a layout. It finds the header row, recognises columns
// by any of their usual names, reads a name from "First name" + "Last name"
// or from one "Name" column, and works out the age group from an age group,
// an age or a date of birth — whichever the sheet has.
//
// It then compares every row with what is already on the database and sorts
// them into: new players, players already there (matched on LTA number or
// name), name matches with a different parent email (for the admin to look
// at), and rows it could not use. Nothing here writes: the admin sees the
// lists and confirms, and only additions are ever made — never an update or
// a delete. That is deliberate: the sheet is a submission, not the truth.
import { ageGroupOf as ageGroupFromDob } from "@/lib/ageGroup";

export type ImportRow = {
  first_name: string;
  last_name: string;
  lta_number: string | null;
  gender: string | null;
  age_group: string | null;
  contact_email: string | null;
  contact_name: string | null;
  mobile: string | null;
  marketing_opt_in: boolean | null;
  singles_wtn: number | null;
  doubles_wtn: number | null;
  rcp_match_count: number | null;
  rcp_type: string | null;
  tags: string[];
};

/** The columns of the database the matching needs. */
export type ExistingPlayer = {
  id: string;
  lta_number: string | null;
  first_name: string;
  last_name: string;
  age_group: string | null;
  contact_email: string | null;
};

export type Classified =
  | { kind: "new"; line: number; row: ImportRow }
  | { kind: "existing"; line: number; row: ImportRow; match: ExistingPlayer; how: string }
  | { kind: "review"; line: number; row: ImportRow; match: ExistingPlayer; how: string }
  | { kind: "duplicate"; line: number; row: ImportRow; ofLine: number }
  | { kind: "skipped"; line: number; reason: string; raw: string[] };

export type ImportField =
  | "first" | "last" | "full" | "lta" | "gender" | "age" | "ageYears" | "dob"
  | "email" | "contact" | "mobile" | "optin" | "swtn" | "dwtn" | "matches" | "rcptype" | "tags";

export type ColumnMap = Partial<Record<ImportField, number>>;

export type ParsedSheet = {
  /** Which spreadsheet column feeds which field. */
  columns: ColumnMap;
  /** Header cells that fed nothing — shown so the admin knows they were ignored. */
  ignoredColumns: string[];
  headerLine: number;
  /** Non-blank rows below the header. */
  rowsRead: number;
  rows: Classified[];
  counts: { new: number; existing: number; review: number; duplicate: number; skipped: number };
};

/** The labels the column fields show up under in the preview. */
export const FIELD_LABELS: Record<ImportField, string> = {
  first: "First name", last: "Last name", full: "Name", lta: "LTA number", gender: "Gender",
  age: "Age group", ageYears: "Age", dob: "Date of birth", email: "Parent email", contact: "Parent name",
  mobile: "Mobile", optin: "Marketing opt-in", swtn: "Singles WTN", dwtn: "Doubles WTN",
  matches: "RCP match count", rcptype: "RCP type", tags: "Tags",
};

// Every name a column has been seen under, lower-cased. Exact matches win;
// a looser contains-match below picks up the rest ("Player's First Name").
const ALIASES: Record<ImportField, string[]> = {
  first: ["first name", "firstname", "first", "forename", "forenames", "given name", "given names", "player first name", "child first name", "first name of player", "first name of child"],
  last: ["last name", "lastname", "last", "surname", "family name", "player last name", "player surname", "child last name", "child surname", "last name of player"],
  full: ["name", "player", "player name", "players name", "player's name", "full name", "child", "child name", "childs name", "child's name", "name of player", "name of child", "pupil", "pupil name", "student", "student name"],
  lta: ["lta number", "lta no", "lta no.", "lta", "lta id", "lta membership number", "lta member number", "lta membership no", "british tennis number", "british tennis membership", "btm", "btm number", "membership number", "membership no", "lta rating number"],
  gender: ["gender", "sex", "boy girl", "boy or girl", "m f", "boy/girl", "m/f"],
  age: ["age group", "age grp", "age category", "category", "age band", "group", "event", "ball colour", "ball color", "stage"],
  ageYears: ["age", "age (years)", "age in years", "current age", "player age", "child age"],
  dob: ["date of birth", "dob", "d.o.b", "d.o.b.", "birth date", "birthdate", "born", "birthday", "date of birth (dd/mm/yyyy)"],
  email: ["email", "e-mail", "email address", "e-mail address", "contact email", "parent email", "parents email", "parent's email", "parent email address", "guardian email", "parent/guardian email", "parent / guardian email", "parent or guardian email", "emailaddress"],
  contact: ["contact name", "contact", "parent name", "parent", "parents name", "parent's name", "guardian", "guardian name", "parent/guardian", "parent / guardian", "parent or guardian", "parent/guardian name", "parent / guardian name", "parent or guardian name", "carer", "carer name", "name of parent", "name of parent/guardian"],
  mobile: ["mobile", "mobile number", "mobile no", "mobile phone", "phone", "phone number", "telephone", "telephone number", "tel", "tel no", "contact number", "contact no", "parent mobile", "parent phone", "parent telephone", "parent contact number", "guardian phone", "cell", "cell phone"],
  optin: ["lta marketing opt-in", "lta marketing opt in", "marketing opt-in", "marketing opt in", "opt in", "opt-in"],
  swtn: ["singles wtn", "wtn singles", "wtn", "singles rating", "wtn (singles)"],
  dwtn: ["doubles wtn", "wtn doubles", "doubles rating", "wtn (doubles)"],
  matches: ["rcp match count", "match count", "matches", "matches played"],
  rcptype: ["rcp type"],
  tags: ["tags", "tag", "squad", "squads", "programme", "program", "county squad", "labels"],
};

// Substring hints for headers that carry the idea but not the exact words.
// Order matters: a header naming both ("Parent email") must land on email.
const HINTS: Array<[ImportField, RegExp]> = [
  ["email", /e-?mail/],
  ["dob", /birth|d\.?o\.?b\b/],
  ["lta", /\blta\b|british tennis/],
  ["mobile", /mobile|phone|telephone|\btel\b/],
  ["first", /first ?name|forename|given/],
  ["last", /last ?name|surname|family ?name/],
  ["contact", /parent|guardian|carer/],
  ["gender", /gender|\bsex\b/],
  ["age", /age ?group|age ?cat|ball colou?r/],
  ["full", /\bname\b|player|child|pupil/],
  ["tags", /\bsquad|\btags?\b/],
];

export const AGE_GROUPS = [8, 9, 10, 11, 12, 14, 16, 18];

const normHeader = (h: unknown) =>
  String(h ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[_/-]+/g, " ").replace(/\s+/g, " ").replace(/[*:]+$/, "").trim();

/** Which field a header cell feeds, or null when it feeds nothing. */
export function fieldForHeader(header: string): ImportField | null {
  const h = normHeader(header);
  if (!h) return null;
  for (const [field, names] of Object.entries(ALIASES) as Array<[ImportField, string[]]>) {
    if (names.includes(h)) return field;
  }
  for (const [field, re] of HINTS) if (re.test(h)) return field;
  return null;
}

/** Map every header cell to a field; the first column claiming a field keeps it. */
export function mapColumns(header: string[]): { columns: ColumnMap; ignored: string[] } {
  const columns: ColumnMap = {};
  const ignored: string[] = [];
  header.forEach((cell, i) => {
    const field = fieldForHeader(cell);
    if (field && columns[field] === undefined) columns[field] = i;
    else if (String(cell ?? "").trim()) ignored.push(String(cell).trim());
  });
  return { columns, ignored };
}

const hasName = (c: ColumnMap) => (c.first !== undefined && c.last !== undefined) || c.full !== undefined;

/**
 * The header is the first row (of the first 40) that names the players: it
 * has a name column and at least one other recognised column, which skips
 * the preamble the LTA report puts above its table.
 */
export function findHeader(rows: string[][]): number {
  const limit = Math.min(rows.length, 40);
  for (let i = 0; i < limit; i++) {
    const { columns } = mapColumns(rows[i]);
    if (hasName(columns) && Object.keys(columns).length >= 2) return i;
  }
  for (let i = 0; i < limit; i++) {
    if (hasName(mapColumns(rows[i]).columns)) return i;
  }
  return -1;
}

// ---------- reading the file ----------

/** CSV/TSV text → rows of cells. Quotes, doubled quotes and quoted newlines all handled. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^/, "");
  const firstLine = src.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const count = (ch: string) => firstLine.split(ch).length - 1;
  const delim = count("\t") > count(",") && count("\t") > count(";") ? "\t" : count(";") > count(",") ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [], cur = "", inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"' && src[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur); cur = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cur); rows.push(row); row = []; cur = "";
    } else cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  // Blank lines stay in (as empty rows) so "row 12" means row 12 of the file.
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Excel's day count → ISO date. */
export function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1000 || serial > 80000) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Any .csv, .tsv, .xlsx or .xls → rows of text. Excel files come through
 * SheetJS, loaded only when one is opened so the admin bundle stays small;
 * date cells arrive as day counts and are turned into ISO dates here.
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const name = file.name.toLowerCase();
  const isExcel = /\.(xlsx|xlsm|xls|ods)$/.test(name) || /spreadsheet|ms-excel/.test(file.type);
  if (!isExcel) return parseDelimited(await file.text());

  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
  const header = findHeader(grid.map((r) => r.map((c) => String(c ?? ""))));
  const dobCol = header >= 0 ? mapColumns(grid[header].map((c) => String(c ?? ""))).columns.dob : undefined;
  return grid
    .map((r, ri) => r.map((c, ci) => {
      if (typeof c === "number" && dobCol !== undefined && ci === dobCol && ri !== header) return excelSerialToIso(c) ?? String(c);
      if (typeof c === "number") return Number.isInteger(c) ? String(c) : String(c);
      return String(c ?? "").trim();
    }));
}

// ---------- normalising cells ----------

export function normaliseGender(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/^(m|male|boy|boys|b)$/.test(s)) return "Male";
  if (/^(f|female|girl|girls|g)$/.test(s)) return "Female";
  return v.trim();
}

/** "10U", "U10", "10 & Under", "Under 10s", "Open", "Red" (ball) → the database's groups. */
export function normaliseAgeGroup(v: string): string | null {
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (/open|adult|senior|18\+|over 18|\bmen\b|\bwomen\b/.test(s)) return "Open";
  const ball = s.match(/\b(red|orange|green)\b/);
  if (ball && !/\d/.test(s)) return { red: "8U", orange: "9U", green: "10U" }[ball[1]] ?? null;
  const m = s.match(/(\d{1,2})/);
  if (!m) return null;
  const n = Number(m[1]);
  if (n >= 19) return "Open";
  const g = AGE_GROUPS.find((a) => a >= n);
  return g ? `${g}U` : "Open";
}

/** "9" (years old today) → the group they will be in this year. */
export function ageGroupFromYears(v: string): string | null {
  const n = Number(String(v).trim());
  if (!Number.isFinite(n) || n <= 0 || n > 120) return null;
  if (n >= 18) return "Open";
  const g = AGE_GROUPS.find((a) => a >= n);
  return g ? `${g}U` : "Open";
}

/** dd/mm/yyyy (UK), yyyy-mm-dd, or "14 Sep 2017" → ISO, else null. */
export function parseDob(v: string): string | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return iso(y, +m[2], +m[1]);
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString().slice(0, 10);
}
const iso = (y: number, mo: number, d: number) => {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");
const num = (v: string) => { const n = Number(String(v).replace(/,/g, "")); return v.trim() && Number.isFinite(n) ? n : null; };

/** "Josh Abbott" → Josh / Abbott; "Abbott, Josh" → Josh / Abbott. */
export function splitName(full: string): { first: string; last: string } {
  const s = full.trim().replace(/\s+/g, " ");
  if (s.includes(",")) {
    const [last, first] = s.split(",").map((p) => p.trim());
    return { first: first ?? "", last: last ?? "" };
  }
  const parts = s.split(" ");
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

const cell = (r: string[], i: number | undefined) => (i === undefined ? "" : (r[i] ?? "").trim());

/** One spreadsheet row → a database row, or a reason it can't be one. */
export function rowToImport(r: string[], c: ColumnMap): { row: ImportRow } | { reason: string } {
  let first = cell(r, c.first), last = cell(r, c.last);
  if (!first && !last && c.full !== undefined) ({ first, last } = splitName(cell(r, c.full)));
  if (!first && !last) return { reason: "No name" };
  if (!last) last = "—";
  if (!first) { first = last; last = "—"; }

  const dob = c.dob !== undefined ? parseDob(cell(r, c.dob)) : null;
  const age_group =
    (c.age !== undefined ? normaliseAgeGroup(cell(r, c.age)) : null)
    ?? (dob ? ageGroupFromDob(dob) : null)
    ?? (c.ageYears !== undefined ? ageGroupFromYears(cell(r, c.ageYears)) : null);

  const emailRaw = cell(r, c.email).toLowerCase();
  const optin = cell(r, c.optin).toLowerCase();
  const tags = cell(r, c.tags).split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
  const lta = digits(cell(r, c.lta));
  const matches = c.matches !== undefined ? num(cell(r, c.matches)) : null;

  return {
    row: {
      first_name: first, last_name: last,
      lta_number: lta || null,
      gender: c.gender !== undefined ? normaliseGender(cell(r, c.gender)) : null,
      age_group,
      contact_email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null,
      contact_name: cell(r, c.contact) || null,
      mobile: cell(r, c.mobile) || null,
      marketing_opt_in: optin ? /^(yes|y|true|1)$/.test(optin) ? true : /^(no|n|false|0)$/.test(optin) ? false : null : null,
      singles_wtn: c.swtn !== undefined ? num(cell(r, c.swtn)) : null,
      doubles_wtn: c.dwtn !== undefined ? num(cell(r, c.dwtn)) : null,
      rcp_match_count: matches == null ? null : Math.round(matches),
      rcp_type: cell(r, c.rcptype) || null,
      tags,
    },
  };
}

// ---------- matching ----------

const nameKey = (first: string, last: string) =>
  `${first}|${last}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9|]/g, "");

/**
 * Sort the sheet's rows against the database. Matching is deliberately
 * cautious: a name that is already there counts as the same child unless the
 * sheet gives a different parent email, in which case it is put aside for the
 * admin to judge rather than added or assumed.
 */
export function classifyRows(rows: string[][], headerLine: number, columns: ColumnMap, existing: ExistingPlayer[]): Classified[] {
  const byLta = new Map<string, ExistingPlayer>();
  const byName = new Map<string, ExistingPlayer[]>();
  for (const p of existing) {
    const l = digits(p.lta_number);
    if (l) byLta.set(l, p);
    const k = nameKey(p.first_name, p.last_name);
    byName.set(k, [...(byName.get(k) ?? []), p]);
  }

  const seenLta = new Map<string, number>();
  const seenName = new Map<string, number>();
  const out: Classified[] = [];

  rows.slice(headerLine + 1).forEach((raw, i) => {
    const line = headerLine + i + 2; // 1-based, as a spreadsheet shows it
    if (!raw.some((c) => c && c.trim())) return; // a blank line is not a player
    const parsed = rowToImport(raw, columns);
    if ("reason" in parsed) { out.push({ kind: "skipped", line, reason: parsed.reason, raw }); return; }
    const { row } = parsed;
    const k = nameKey(row.first_name, row.last_name);

    // The same child twice in one file.
    const dupOf = (row.lta_number && seenLta.get(row.lta_number)) ?? seenName.get(k);
    if (dupOf) { out.push({ kind: "duplicate", line, row, ofLine: dupOf }); return; }
    if (row.lta_number) seenLta.set(row.lta_number, line);
    seenName.set(k, line);

    const ltaMatch = row.lta_number ? byLta.get(row.lta_number) : undefined;
    if (ltaMatch) { out.push({ kind: "existing", line, row, match: ltaMatch, how: "same LTA number" }); return; }

    const named = byName.get(k) ?? [];
    if (named.length === 0) { out.push({ kind: "new", line, row }); return; }

    const sameEmail = row.contact_email ? named.find((p) => (p.contact_email ?? "").toLowerCase() === row.contact_email) : undefined;
    if (sameEmail) { out.push({ kind: "existing", line, row, match: sameEmail, how: "same name and parent email" }); return; }

    const sameAge = row.age_group ? named.find((p) => p.age_group === row.age_group) : undefined;
    const candidate = sameAge ?? named[0];
    const theirEmail = (candidate.contact_email ?? "").toLowerCase();
    if (row.contact_email && theirEmail && theirEmail !== row.contact_email) {
      out.push({ kind: "review", line, row, match: candidate, how: `same name, but the parent email on the database is ${candidate.contact_email}` });
      return;
    }
    out.push({
      kind: "existing", line, row, match: candidate,
      how: sameAge ? "same name and age group" : named.length > 1 ? `same name (${named.length} on the database)` : "same name",
    });
  });
  return out;
}

/** The whole job: file rows in, sorted preview out. */
export function analyseRows(rows: string[][], existing: ExistingPlayer[]): ParsedSheet {
  const headerLine = findHeader(rows);
  if (headerLine === -1) {
    throw new Error("Couldn't find the header row. The sheet needs a column for the player's name (First name and Last name, or Name).");
  }
  const { columns, ignored } = mapColumns(rows[headerLine]);
  const classified = classifyRows(rows, headerLine, columns, existing);
  const counts = { new: 0, existing: 0, review: 0, duplicate: 0, skipped: 0 };
  for (const c of classified) counts[c.kind]++;
  const rowsRead = rows.slice(headerLine + 1).filter((r) => r.some((c) => c && c.trim())).length;
  return { columns, ignoredColumns: ignored, headerLine, rowsRead, rows: classified, counts };
}
