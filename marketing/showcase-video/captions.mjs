#!/usr/bin/env node
// captions.mjs — builds one ASS subtitle file per layout from script.json,
// timed from audio/alignment.json when it exists (spoken spans per line) and
// from timing.json otherwise. Also used as a library by assemble.mjs.
//
//   node captions.mjs [--layout wide|tall|both] [--alignment <path>|none]
//                     [--make-sample]        # writes audio/alignment.sample.json
//
// Style (BRIEF.md "Assembly"): Hanken Grotesk (fetched once from Google Fonts
// into out/fonts/, Liberation Sans / Arial fallback), white on a 60% navy
// rounded pill, two lines max, along the bottom of the wide cut (centred on
// the text column so it never touches the desktop browser window or the phone
// on the right) and below the phone (around y = 1795 of 1920) in the tall cut.
// Every pill is bounds-checked against its layout's `safe` box in LAYOUTS and
// the build fails rather than shipping a caption over the device artwork.
//
// A caption that cannot fit in two lines at the layout's size is split into
// sequential chunks at sentence / clause boundaries; each chunk is timed from
// the alignment's per-character timestamps by locating its first and last
// word in the spoken text (the caption may differ from the spoken text, e.g.
// "&" vs "and", "suffolktennis.online" vs "suffolk tennis dot online").

import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const AUDIO = path.join(HERE, "audio");
export const FONTS_DIR = path.join(OUT, "fonts");

const ASS_NAVY = "&H391D0E&"; // #0E1D39; ASS colours are BBGGRR
const PILL_ALPHA = "&H66&"; // 0x66 = 40% transparent => 60% navy

// Google Fonts serves plain TTFs to a non-browser user agent. curl honours
// HTTPS_PROXY, which is how the build environment reaches the internet.
const FONT_CANDIDATES = [
  {
    family: "Hanken Grotesk",
    file: "HankenGrotesk-SemiBold.ttf",
    url: "https://fonts.gstatic.com/s/hankengrotesk/v12/ieVq2YZDLWuGJpnzaiwFXS9tYvBRzyFLlZg_f_NcbWFa4Q.ttf",
  },
];
const SYSTEM_FALLBACKS = [
  { family: "Liberation Sans", file: "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" },
  { family: "Arial", file: "/usr/share/fonts/truetype/msttcorefonts/Arial_Bold.ttf" },
  { family: "DejaVu Sans", file: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" },
];

// Geometry per layout, in output pixels. `fontPx` is the CSS-style em size;
// the ASS Fontsize is derived from it (libass sizes fonts so that
// ascender - descender == Fontsize, not the em).
//
// Every caption pill is centred in, and must fit inside, that layout's `safe`
// box. Nothing outside this file needs to change when the stage moves: retune
// `safe` (and stage.css alongside it) and every pill follows.
//
// Wide (v2 stage): the right of the frame carries a desktop browser window
// with the phone over its lower-right corner. From stage.css: the desk is
// 1440x944 centred in a zone at (688,106,1094,718), scaled 0.700 or 0.760
// when it leads, so at its largest it reaches x 688-1782, y 106-824; the
// phone zone is (1530,297,320,700), so the phone reaches y 997 but never left
// of x ~1523. On the app scenes (2-8) the pill therefore sits in the band
// below the desk and left of the phone (`safe`, x 90-1280, y 836-1016) -
// bottom-aligned with a 64 px margin, 55 px clear of the desk above it and
// 258 px clear of the phone beside it. On the full-frame scenes - the hero
// (1), the end card (9) and while
// a chapter card is up at the start of 3 and 6 - there is nothing on the
// right, and an off-centre pill under centred artwork reads as a mistake, so
// those captions are centred on the frame (`full`, x = 960). A caption that
// starts on a chapter card slides to the text-zone position as the card lifts.
//
// Tall: the phone bezel runs from y ~442 to ~1682 (stage.css phone-zone:
// top 41u, bottom 22u), so the pill is centred on y = 1795 in the band below
// it; a two-line pill spans 1727-1863, clear of the phone and 57 px above the
// frame edge. On the end card the mascot stands in that band (bottom-right,
// y ~1470-1900), so the scene 9 caption sits higher (`end`, centred on 1360,
// below the web address at ~1160). The hero title in scene 1 is kept above
// the caption band by `.hero-text` in stage/stage.css.
export const LAYOUTS = {
  wide: {
    w: 1920, h: 1080, fontPx: 40, padX: 34, padY: 16, radius: 24,
    safe: { left: 90, right: 1280, top: 836, bottom: 1080 - 64 },
    full: { left: 72, right: 1848, top: 812, bottom: 1080 - 64 },
  },
  tall: {
    w: 1080, h: 1920, fontPx: 40, padX: 30, padY: 16, radius: 24,
    safe: { left: 60, right: 1020, top: 1706, bottom: 1884, centreY: 1795 },
    end: { left: 60, right: 1020, top: 1270, bottom: 1450, centreY: 1360 },
  },
};

// Scenes that open on a chapter card, and how long the card is up: it holds
// CHAPTER_MS (stage/stage.js) then lifts over the 0.3 s .layer fade. Captions
// that start under the card are centred and slide across as it lifts.
const CHAPTER_CARD = { scenes: [3, 6], holdS: 1.5, fadeS: 0.3 };
const FULL_FRAME_LINES = new Set([1, 9]);

// Which zone a caption event uses: "safe" beside the phone, "full" centred on
// the frame (wide), "end" above the mascot (tall).
function zoneFor(layout, lineId) {
  if (layout === "wide" && FULL_FRAME_LINES.has(lineId)) return "full";
  if (layout === "tall" && lineId === 9) return "end";
  return "safe";
}

// Pill box for one caption, given its measured text width and line count.
export function pillBox(geo, textW, nLines, lineH, zoneName = "safe") {
  const zone = geo[zoneName] ?? geo.safe;
  const pillW = Math.ceil(textW + 2 * geo.padX);
  const pillH = Math.ceil(nLines * lineH + 2 * geo.padY);
  const cx = (zone.left + zone.right) / 2;
  const cy = zone.centreY != null ? zone.centreY : zone.bottom - pillH / 2;
  return { pillW, pillH, cx, cy, x0: cx - pillW / 2, x1: cx + pillW / 2, y0: cy - pillH / 2, y1: cy + pillH / 2, zone: zoneName };
}

// Product names and the web address never break across lines or chunks.
const UNBREAKABLE = ["Performance & Reports", "Suffolk Tennis", "Parent Hub", "County Training", "suffolktennis.online"];
const NBSP = " ";
const glue = (s) => UNBREAKABLE.reduce((t, tok) => t.split(tok).join(tok.split(" ").join(NBSP)), s);
const unglue = (s) => s.split(NBSP).join(" ");
const capitalise = (s) => s.replace(/^(["'(]*)([a-z])/, (_, q, c) => q + c.toUpperCase());

/* ------------------------------------------------------------------ */
/* Minimal TrueType metrics reader: unitsPerEm, hhea, hmtx, cmap, name  */
/* ------------------------------------------------------------------ */
export function parseTtf(buf) {
  const u16 = (o) => buf.readUInt16BE(o);
  const i16 = (o) => buf.readInt16BE(o);
  const u32 = (o) => buf.readUInt32BE(o);
  const tables = {};
  const numTables = u16(4);
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString("latin1", o, o + 4)] = { off: u32(o + 8), len: u32(o + 12) };
  }
  for (const t of ["head", "hhea", "hmtx", "cmap"]) if (!tables[t]) throw new Error(`font lacks ${t} table`);
  const upm = u16(tables.head.off + 18);
  const hh = tables.hhea.off;
  const ascender = i16(hh + 4), descender = i16(hh + 6), lineGap = i16(hh + 8), numHMetrics = u16(hh + 34);
  const advances = new Uint16Array(numHMetrics);
  for (let i = 0; i < numHMetrics; i++) advances[i] = u16(tables.hmtx.off + i * 4);

  // Unicode cmap (format 4 or 12)
  const cmap = new Map();
  const cm = tables.cmap.off;
  const nSub = u16(cm + 2);
  let best = null;
  for (let i = 0; i < nSub; i++) {
    const pid = u16(cm + 4 + i * 8), eid = u16(cm + 6 + i * 8), off = u32(cm + 8 + i * 8);
    const sub = cm + off;
    const fmt = u16(sub);
    const score = (fmt === 12 ? 2 : fmt === 4 ? 1 : 0) + ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0 ? 10 : 0);
    if (score > 0 && (!best || score > best.score)) best = { sub, fmt, score };
  }
  if (!best) throw new Error("font has no unicode cmap");
  if (best.fmt === 4) {
    const s = best.sub;
    const segX2 = u16(s + 6), segs = segX2 / 2;
    const endA = s + 14, startA = endA + 2 + segX2, deltaA = startA + segX2, rangeA = deltaA + segX2;
    for (let k = 0; k < segs; k++) {
      const end = u16(endA + k * 2), start = u16(startA + k * 2), delta = u16(deltaA + k * 2), ro = u16(rangeA + k * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          g = u16(rangeA + k * 2 + ro + (c - start) * 2);
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g) cmap.set(c, g);
      }
    }
  } else {
    const s = best.sub;
    const nGroups = u32(s + 12);
    for (let k = 0; k < nGroups; k++) {
      const g = s + 16 + k * 12;
      const start = u32(g), end = u32(g + 4), gid = u32(g + 8);
      for (let c = start; c <= end && c < 0x10000; c++) cmap.set(c, gid + (c - start));
    }
  }

  // Family name (name ID 1): prefer Windows/Unicode (UTF-16BE), else Mac.
  let family = null;
  if (tables.name) {
    const n = tables.name.off;
    const count = u16(n + 2), strOff = u16(n + 4);
    let mac = null;
    for (let i = 0; i < count; i++) {
      const r = n + 6 + i * 12;
      const pid = u16(r), eid = u16(r + 2), nameId = u16(r + 6), len = u16(r + 8), off = u16(r + 10);
      if (nameId !== 1) continue;
      const start = n + strOff + off;
      if (pid === 3 && eid === 1) {
        let s = "";
        for (let k = 0; k + 1 < len; k += 2) s += String.fromCharCode(u16(start + k));
        family = s;
        break;
      }
      if (pid === 1 && mac == null) mac = buf.toString("latin1", start, start + len);
    }
    if (family == null) family = mac;
  }

  const xGlyph = cmap.get(0x78) ?? 0;
  const advanceOf = (ch) => {
    const g = cmap.get(ch.codePointAt(0));
    const gid = g == null ? xGlyph : g; // unknown glyph => width of 'x'
    return advances[Math.min(gid, numHMetrics - 1)];
  };
  return { upm, ascender, descender, lineGap, family, advanceOf };
}

export function loadFontMetrics(file) {
  return parseTtf(readFileSync(file));
}

/* ------------------------------------------------------------------ */
/* Font acquisition                                                     */
/* ------------------------------------------------------------------ */
export function ensureFont({ quiet = false } = {}) {
  mkdirSync(FONTS_DIR, { recursive: true });
  for (const c of FONT_CANDIDATES) {
    const file = path.join(FONTS_DIR, c.file);
    if (!existsSync(file)) {
      const tmp = `${file}.${process.pid}.tmp`;
      try {
        const code = execFileSync("curl", ["-sS", "-L", "--max-time", "40", "-A", "curl", "-o", tmp, "-w", "%{http_code}", c.url], { encoding: "utf8" }).trim();
        if (code !== "200") throw new Error(`HTTP ${code}`);
        const magic = readFileSync(tmp).readUInt32BE(0);
        if (magic !== 0x00010000 && magic !== 0x74727565) throw new Error("not a TrueType file"); // 0x74727565 = 'true'
        renameSync(tmp, file);
        if (!quiet) console.log(`[captions] fetched ${c.family} -> ${path.relative(HERE, file)}`);
      } catch (e) {
        if (!quiet) console.warn(`[captions] could not fetch ${c.family} (${e instanceof Error ? e.message : e}); trying fallbacks`);
        try { if (existsSync(tmp)) unlinkSync(tmp); } catch { /* ignore */ }
      }
    }
    if (existsSync(file)) {
      try {
        const metrics = loadFontMetrics(file);
        return { family: metrics.family || c.family, file, metrics, fontsDir: FONTS_DIR, fallback: false };
      } catch (e) {
        if (!quiet) console.warn(`[captions] ${file} unreadable (${e instanceof Error ? e.message : e})`);
      }
    }
  }
  for (const f of SYSTEM_FALLBACKS) {
    if (!existsSync(f.file)) continue;
    const metrics = loadFontMetrics(f.file);
    if (!quiet) console.warn(`[captions] using fallback font ${metrics.family || f.family} (${f.file})`);
    return { family: metrics.family || f.family, file: f.file, metrics, fontsDir: path.dirname(f.file), fallback: true };
  }
  throw new Error("no usable caption font found (Hanken Grotesk download failed and no Liberation/Arial/DejaVu on this machine)");
}

/* ------------------------------------------------------------------ */
/* Text measurement + line breaking                                     */
/* ------------------------------------------------------------------ */
const WIDTH_SLACK = 1.02; // kerning is ignored, so measurements already err on the wide side

function makeMeasurer(metrics, fontPx) {
  const scale = fontPx / metrics.upm;
  return (text) => {
    let w = 0;
    for (const ch of text) w += metrics.advanceOf(ch === NBSP ? " " : ch);
    return w * scale * WIDTH_SLACK;
  };
}

// Words are separated by plain spaces only; a no-break space (inside an
// UNBREAKABLE token) is part of the word.
const splitWords = (s) => s.split(" ").filter(Boolean);

// Best two-line break of `text` (or one line if it fits). Returns lines[] or
// null when it cannot be done within maxW.
function breakLines(text, measure, maxW) {
  if (measure(text) <= maxW) return [text];
  const words = splitWords(text);
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" "), b = words.slice(i).join(" ");
    const wa = measure(a), wb = measure(b);
    if (wa > maxW || wb > maxW) continue;
    const score = Math.max(wa, wb) + Math.abs(wa - wb) * 0.15; // balanced; top line may be a touch wider
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best ? best.lines : null;
}

// Group consecutive units (sentences, or the clauses of one sentence) into
// the fewest chunks that each fit in two lines, and among those the most
// balanced grouping (smallest widest chunk), so a caption never ends on a
// three-word orphan ("No chasing.") when the words could sit with the
// sentence before them. Units that fit nowhere come back on their own.
function groupUnits(units, fits, measure) {
  const n = units.length;
  const join = (i, j) => units.slice(i, j).join(" ");
  const memo = new Map();
  const best = (i) => {
    if (i === n) return { count: 0, widest: 0, groups: [] };
    if (memo.has(i)) return memo.get(i);
    let out = null;
    for (let j = i + 1; j <= n; j++) {
      const g = join(i, j);
      if (j > i + 1 && !fits(g)) break;
      const rest = best(j);
      if (!rest) continue;
      const cand = { count: rest.count + 1, widest: Math.max(measure(g), rest.widest), groups: [g, ...rest.groups] };
      if (!out || cand.count < out.count || (cand.count === out.count && cand.widest < out.widest)) out = cand;
    }
    memo.set(i, out);
    return out;
  };
  return best(0).groups;
}

// Split a caption into chunks that each fit within two lines. Every chunk
// starts with a capital letter, product names never split (see glue()).
function chunkCaption(caption, measure, maxW) {
  const fits = (s) => breakLines(s, measure, maxW) != null;
  const sentences = glue(caption.trim()).split(/(?<=[.!?:;]) +/).filter(Boolean);
  const chunks = [];
  for (const group of groupUnits(sentences, fits, measure)) {
    if (fits(group)) { chunks.push(group); continue; }
    // A single sentence that is too long: group its clauses, then hard-wrap by words.
    for (const clause of groupUnits(group.split(/(?<=,) +/), fits, measure)) {
      if (fits(clause)) { chunks.push(clause); continue; }
      let cur = [];
      for (const w of splitWords(clause)) {
        if (fits([...cur, w].join(" "))) cur.push(w);
        else { if (cur.length) chunks.push(cur.join(" ")); cur = [w]; }
      }
      if (cur.length) chunks.push(cur.join(" "));
    }
  }
  return chunks.map(capitalise);
}

/* ------------------------------------------------------------------ */
/* Timing                                                               */
/* ------------------------------------------------------------------ */
const LEAD_S = 0.12; // caption appears a touch before the first word
const HANG_S = 0.9;  // and lingers after the last word
const GAP_S = 0.06;  // gap between consecutive chunks

const norm = (w) => w.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

// Turn an alignment line ({chars, starts, ends}) into spoken words with times.
function spokenWords(line) {
  const words = [];
  let cur = null;
  line.chars.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { words.push(cur); cur = null; } return; }
    if (!cur) cur = { text: "", start: line.starts[i], end: line.ends[i] };
    cur.text += ch;
    cur.end = line.ends[i];
  });
  if (cur) words.push(cur);
  return words.map((w) => ({ ...w, norm: norm(w.text) }));
}

function findWord(words, target, from) {
  const t = norm(target);
  if (!t) return -1;
  for (let i = from; i < words.length; i++) if (words[i].norm === t) return i;
  if (t.length >= 4) {
    for (let i = from; i < words.length; i++) {
      const n = words[i].norm;
      if (n.length >= 4 && (n.startsWith(t) || t.startsWith(n))) return i;
    }
  }
  return -1;
}

// Time chunks of one caption against the alignment of the same script line.
function timeChunksFromAlignment(chunks, line, offset) {
  const words = spokenWords(line);
  const lineStart = line.start_s + offset, lineEnd = line.end_s + offset;
  const spans = [];
  let cursor = 0;
  const totalChars = chunks.reduce((n, c) => n + c.length, 0);
  let charsSoFar = 0;
  for (const chunk of chunks) {
    const cw = chunk.split(/\s+/).filter(Boolean);
    const iFirst = findWord(words, cw[0], cursor);
    const iLast = iFirst >= 0 ? findWord(words, cw[cw.length - 1], iFirst) : -1;
    // Proportional fallback when the caption text has no spoken counterpart.
    const propStart = lineStart + ((lineEnd - lineStart) * charsSoFar) / totalChars;
    const propEnd = lineStart + ((lineEnd - lineStart) * (charsSoFar + chunk.length)) / totalChars;
    const start = iFirst >= 0 ? words[iFirst].start + offset : propStart;
    const end = iLast >= 0 ? words[iLast].end + offset : propEnd;
    spans.push({ text: chunk, speechStart: start, speechEnd: Math.max(end, start + 0.3), matched: iFirst >= 0 && iLast >= 0 });
    if (iLast >= 0) cursor = iLast + 1; else if (iFirst >= 0) cursor = iFirst + 1;
    charsSoFar += chunk.length;
  }
  return spans;
}

// Without alignment: spread chunks proportionally across the scene span.
function timeChunksFromScene(chunks, scene) {
  const start = scene.start_s + 0.3, end = scene.start_s + scene.duration_s - 0.3;
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let acc = 0;
  return chunks.map((text) => {
    const s = start + ((end - start) * acc) / total;
    acc += text.length;
    const e = start + ((end - start) * acc) / total;
    return { text, speechStart: s, speechEnd: e, matched: false };
  });
}

/* ------------------------------------------------------------------ */
/* ASS writer                                                           */
/* ------------------------------------------------------------------ */
export const assTime = (s) => {
  const t = Math.max(0, s);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = Math.floor(t % 60);
  const cs = Math.min(99, Math.round((t - Math.floor(t)) * 100));
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
};
const r1 = (n) => Math.round(n * 10) / 10;
const escapeAss = (s) => s.replace(/[{}\\]/g, "");

function roundedRectPath(w, h, r) {
  // Cubic bezier approximation of quarter circles (kappa = 0.5523).
  const k = 0.5523 * r;
  const p = (n) => r1(n);
  return [
    `m ${p(r)} 0`,
    `l ${p(w - r)} 0`,
    `b ${p(w - r + k)} 0 ${p(w)} ${p(r - k)} ${p(w)} ${p(r)}`,
    `l ${p(w)} ${p(h - r)}`,
    `b ${p(w)} ${p(h - r + k)} ${p(w - r + k)} ${p(h)} ${p(w - r)} ${p(h)}`,
    `l ${p(r)} ${p(h)}`,
    `b ${p(r - k)} ${p(h)} 0 ${p(h - r + k)} 0 ${p(h - r)}`,
    `l 0 ${p(r)}`,
    `b 0 ${p(r - k)} ${p(r - k)} 0 ${p(r)} 0`,
  ].join(" ");
}

export function loadAlignment(file) {
  if (!file || !existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const lines = Array.isArray(raw) ? raw : raw.lines;
  if (!Array.isArray(lines) || !lines.length) return null;
  for (const l of lines) {
    if (typeof l.id !== "number" || typeof l.start_s !== "number" || typeof l.end_s !== "number" || !Array.isArray(l.chars) || !Array.isArray(l.starts) || !Array.isArray(l.ends)) {
      throw new Error(`${file}: line ${l?.id} is not { id, start_s, end_s, chars, starts, ends }`);
    }
    if (l.chars.length !== l.starts.length || l.chars.length !== l.ends.length) throw new Error(`${file}: line ${l.id} chars/starts/ends length mismatch`);
  }
  return { lines, source: raw.source ?? "alignment" };
}

/**
 * Build the ASS captions for one layout.
 * @returns {{ assPath, fontFamily, fontFile, fontsDir, fontFallback, timingSource, events, assFontSize }}
 */
export function buildCaptions({
  layout,
  scriptPath = path.join(HERE, "script.json"),
  timingPath = path.join(HERE, "timing.json"),
  alignmentPath = path.join(AUDIO, "alignment.json"),
  outDir = OUT,
  voOffset = null,
  quiet = false,
} = {}) {
  const geo = LAYOUTS[layout];
  if (!geo) throw new Error(`unknown layout ${layout}; use wide or tall`);
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  const timing = JSON.parse(readFileSync(timingPath, "utf8"));
  const alignment = alignmentPath === "none" ? null : loadAlignment(alignmentPath);
  const offset = voOffset ?? timing.vo_offset_s ?? 0;
  const font = ensureFont({ quiet });
  const { metrics } = font;

  // libass: Fontsize == ascender - descender in px. Convert our em size.
  const heightPerEm = (metrics.ascender - metrics.descender) / metrics.upm;
  const assFontSize = r1(geo.fontPx * heightPerEm);
  const lineH = assFontSize; // libass line advance (no lineGap)
  const measure = makeMeasurer(metrics, geo.fontPx);
  const maxPillW = geo.safe.right - geo.safe.left;
  const maxTextW = maxPillW - 2 * geo.padX;
  // A two-line pill is the tallest we ever draw; make sure the safe box can
  // hold it, so a long line (v2 line 8) can never grow down into the phone or
  // up into the stage artwork.
  const maxPillH = Math.ceil(2 * assFontSize + 2 * geo.padY);
  if (geo.safe.top != null) {
    const probe = pillBox(geo, maxTextW, 2, assFontSize);
    if (probe.y0 < geo.safe.top - 0.5) {
      throw new Error(`${layout}: a two-line pill (${maxPillH} px) reaches y ${r1(probe.y0)}, above the safe box top ${geo.safe.top}; raise safe.top or drop fontPx in LAYOUTS`);
    }
  }

  const sceneById = new Map(timing.scenes.map((s) => [s.id, s]));
  const alignById = new Map((alignment?.lines ?? []).map((l) => [l.id, l]));

  const lines = [...script.lines].sort((a, b) => a.id - b.id);
  const perLine = lines.map((line) => {
    const chunks = chunkCaption(line.caption ?? line.text, measure, maxTextW);
    const al = alignById.get(line.id);
    const scene = sceneById.get(line.id);
    let spans;
    if (al) spans = timeChunksFromAlignment(chunks, al, offset);
    else if (scene) spans = timeChunksFromScene(chunks, scene);
    else throw new Error(`no timing for script line ${line.id} (neither alignment nor timing.json scene)`);
    return { line, spans };
  });

  const events = [];
  perLine.forEach(({ line, spans }, li) => {
    const nextLineStart = perLine[li + 1] ? perLine[li + 1].spans[0].speechStart : Infinity;
    spans.forEach((span, i) => {
      const next = spans[i + 1];
      const start = Math.max(0, span.speechStart - LEAD_S);
      let end = next ? next.speechStart - LEAD_S - GAP_S : span.speechEnd + HANG_S;
      end = Math.min(end, nextLineStart - LEAD_S - GAP_S);
      end = Math.max(end, start + 0.4);
      const textLines = breakLines(span.text, measure, maxTextW);
      if (!textLines) throw new Error(`caption chunk does not fit in two lines: "${span.text}"`);
      const textW = Math.max(...textLines.map(measure));
      const box = pillBox(geo, textW, textLines.length, lineH, zoneFor(layout, line.id));
      // Hard guarantee: <= 2 lines and inside its zone (and it would fit the
      // safe box too, since widths are measured against the safe box).
      if (textLines.length > 2) throw new Error(`${layout}: caption for line ${line.id} wrapped to ${textLines.length} lines: "${span.text}"`);
      const s = geo[box.zone];
      if (box.x0 < s.left - 0.5 || box.x1 > s.right + 0.5 || (s.top != null && box.y0 < s.top - 0.5) || box.y1 > s.bottom + 0.5) {
        throw new Error(`${layout}: caption pill for line ${line.id}.${i} (${box.pillW}x${box.pillH} at ${r1(box.x0)},${r1(box.y0)}) escapes the ${box.zone} box [${s.left}-${s.right}] x [${s.top ?? 0}-${s.bottom}]: "${span.text}"`);
      }
      // Wide: a caption that starts while a chapter card is up is centred on
      // the card and slides to the text-zone position as the card lifts.
      let move = null;
      const scene = sceneById.get(line.id);
      if (layout === "wide" && scene && CHAPTER_CARD.scenes.includes(line.id) && box.zone === "safe") {
        const cardHoldEnd = scene.start_s + CHAPTER_CARD.holdS;
        if (start < cardHoldEnd) {
          const centred = pillBox(geo, textW, textLines.length, lineH, "full");
          move = { fromCx: centred.cx, fromX0: centred.x0, t1: Math.max(0, cardHoldEnd - start), t2: Math.max(0, cardHoldEnd - start) + CHAPTER_CARD.fadeS };
        }
      }
      events.push({ id: line.id, chunk: i, start, end, lines: textLines.map(unglue), matched: span.matched, ...box, move });
    });
  });

  const styles = [
    `Style: Caption,${font.family},${assFontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1`,
    `Style: Pill,${font.family},20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1`,
  ];
  const dialogue = [];
  for (const ev of events) {
    const t = `${assTime(ev.start)},${assTime(ev.end)}`;
    const x0 = r1(ev.cx - ev.pillW / 2), y0 = r1(ev.cy - ev.pillH / 2);
    const ms = (s) => Math.round(s * 1000);
    const pillPos = ev.move ? `\\move(${r1(ev.move.fromX0)},${y0},${x0},${y0},${ms(ev.move.t1)},${ms(ev.move.t2)})` : `\\pos(${x0},${y0})`;
    const textPos = ev.move ? `\\move(${r1(ev.move.fromCx)},${r1(ev.cy)},${r1(ev.cx)},${r1(ev.cy)},${ms(ev.move.t1)},${ms(ev.move.t2)})` : `\\pos(${r1(ev.cx)},${r1(ev.cy)})`;
    dialogue.push(`Dialogue: 0,${t},Pill,,0,0,0,,{\\an7${pillPos}\\fad(120,150)\\bord0\\shad0\\1c${ASS_NAVY}\\1a${PILL_ALPHA}\\p1}${roundedRectPath(ev.pillW, ev.pillH, Math.min(geo.radius, ev.pillH / 2))}{\\p0}`);
    dialogue.push(`Dialogue: 1,${t},Caption,,0,0,0,,{\\an5${textPos}\\fad(120,150)\\bord0\\shad0}${ev.lines.map(escapeAss).join("\\N")}`);
  }
  const ass = [
    "[Script Info]",
    "; Generated by captions.mjs - do not edit by hand",
    "ScriptType: v4.00+",
    `PlayResX: ${geo.w}`,
    `PlayResY: ${geo.h}`,
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    "YCbCr Matrix: TV.709",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styles,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...dialogue,
    "",
  ].join("\n");

  mkdirSync(outDir, { recursive: true });
  const assPath = path.join(outDir, `${layout}.ass`);
  writeFileSync(assPath, ass);
  const timingSource = alignment ? `alignment (${path.relative(HERE, alignmentPath)})` : `timing.json (${path.relative(HERE, timingPath)})`;
  if (!quiet) {
    const unmatched = events.filter((e) => !e.matched).length;
    console.log(`[captions] ${layout}: ${events.length} caption events from ${timingSource}; font ${font.family}${font.fallback ? " (fallback)" : ""} size ${assFontSize} (em ${geo.fontPx}px)${alignment && unmatched ? `; ${unmatched} chunk(s) timed proportionally` : ""} -> ${path.relative(HERE, assPath)}`);
  }
  return { assPath, fontFamily: font.family, fontFile: font.file, fontsDir: font.fontsDir, fontFallback: font.fallback, timingSource, events, assFontSize, safe: geo.safe, maxPillW };
}

/* ------------------------------------------------------------------ */
/* Synthetic alignment fixture                                          */
/* ------------------------------------------------------------------ */
// Fakes the ElevenLabs with-timestamps shape from script.json + timing.json:
// each line is "spoken" from 0.5 s into its scene at ~15 characters/second,
// characters evenly spaced. Exercises the alignment code path without audio.
export function makeSampleAlignment({
  scriptPath = path.join(HERE, "script.json"),
  timingPath = path.join(HERE, "timing.json"),
  outPath = path.join(AUDIO, "alignment.sample.json"),
  charsPerSecond = 15,
} = {}) {
  const script = JSON.parse(readFileSync(scriptPath, "utf8"));
  const timing = JSON.parse(readFileSync(timingPath, "utf8"));
  const sceneById = new Map(timing.scenes.map((s) => [s.id, s]));
  const lines = script.lines.map((line) => {
    const scene = sceneById.get(line.id);
    if (!scene) throw new Error(`timing.json has no scene ${line.id}`);
    const chars = [...line.text];
    const start = scene.start_s + 0.5;
    const dur = Math.min(chars.length / charsPerSecond, scene.duration_s - 1);
    const per = dur / chars.length;
    const starts = chars.map((_, i) => Math.round((start + i * per) * 1000) / 1000);
    const ends = chars.map((_, i) => Math.round((start + (i + 1) * per) * 1000) / 1000);
    return { id: line.id, start_s: starts[0], end_s: ends[ends.length - 1], chars, starts, ends };
  });
  const doc = { source: "synthetic (captions.mjs --make-sample; evenly spaced characters, not real speech)", voice: script.voice, lines };
  mkdirSync(path.dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc));
  return outPath;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */
function parseArgs(argv) {
  const args = { layout: "both", alignment: undefined, makeSample: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layout") args.layout = argv[++i];
    else if (a === "--alignment") args.alignment = argv[++i];
    else if (a === "--make-sample") args.makeSample = true;
    else if (a === "-h" || a === "--help") { console.log("usage: node captions.mjs [--layout wide|tall|both] [--alignment <path>|none] [--make-sample]"); process.exit(0); }
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (args.makeSample) console.log(`[captions] wrote ${path.relative(HERE, makeSampleAlignment())}`);
  const layouts = args.layout === "both" ? ["wide", "tall"] : [args.layout];
  for (const layout of layouts) {
    const alignmentPath = args.alignment === undefined ? path.join(AUDIO, "alignment.json") : args.alignment === "none" ? "none" : path.resolve(args.alignment);
    const r = buildCaptions({ layout, alignmentPath });
    const s = r.safe;
    console.log(`  safe box x ${s.left}-${s.right} (max pill ${r.maxPillW}), y ${s.top ?? 0}-${s.bottom}${s.centreY != null ? ` centred on ${s.centreY}` : " bottom-aligned"}`);
    for (const e of r.events) console.log(`  ${String(e.id).padStart(2)}.${e.chunk}  ${assTime(e.start)} -> ${assTime(e.end)}  ${e.lines.length}L ${e.pillW}x${e.pillH} @ x ${r1(e.x0)}-${r1(e.x1)} y ${r1(e.y0)}-${r1(e.y1)} [${e.zone}${e.move ? `, from x ${r1(e.move.fromX0)} at +${e.move.t1.toFixed(2)}s` : ""}]${e.matched ? "" : "  (proportional)"}  ${e.lines.join(" / ")}`);
  }
}
