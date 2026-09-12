// Records the showcase footage: the stage page (stage/) framed around the
// real app (vite preview on 4173, Supabase mocked) is driven scene by scene
// to the clock in timing.json and captured at 1920×1080 (wide) or 1080×1920
// (tall).
//
//   node record.mjs [--layout wide|tall|both] [--timing timing.json]
//                   [--method screencast|playwright] [--format jpeg|png]
//                   [--hero offline|live] [--timescale 2.5] [--uncap]
//
// Smoothness (v2). Three things together remove the judder of v1:
//
//  1. Continuous repaint. Chromium's screencast only emits a frame when
//     something is drawn, so stage.pump() mutates a 1 px element on every
//     requestAnimationFrame; a repaint on the parent composites the whole
//     viewport, both app iframes included.
//  2. Slow motion. At 1920x1080 this machine can capture + JPEG-encode about
//     20-28 frames a second with two live app iframes on the stage - well
//     short of a smooth cadence. So the live pass is driven at 1/TIMESCALE
//     speed (stage.setTimeScale slows every CSS animation, the recorder's own
//     clock, the tap beat, the typing and every scroll) and each frame's
//     timestamp is divided by the same factor. TIMESCALE x the capture rate
//     is the effective frame rate; 2.5 x ~22 fps lands around 55.
//  3. Exact timestamps. Frames are NOT assumed to be evenly spaced: the mux
//     writes an ffmpeg concat list carrying every frame's real duration (from
//     Page.screencastFrame metadata.timestamp) and lets ffmpeg resample that
//     to a constant FPS. v1 mapped the nearest frame onto each tick instead,
//     which is what turned an uneven capture into visible judder.
//
// JPEG quality 92: PNG encoding of a 1080p frame inside Chromium costs ~150 ms
// here and starves the capture (6 fps), and the cut is yuv420p anyway.
// --uncap adds --disable-frame-rate-limit / --disable-gpu-vsync /
// --enable-gpu-rasterization / --enable-zero-copy. Measured on this box they
// LOSE about 20% of the capture rate (there is no GPU, so uncapping only makes
// the renderer compete with the JPEG encoder for four cores), so they are off
// by default; see out/<layout>.scenes.json "smoothness" for what a run got.
//
// Scene 1 (the hero b-roll) is not taken from the live screencast at all:
// full-frame video motion is exactly what the screencast cannot keep up with.
// It is rendered offline instead - the stage is posed at every 1/25 s
// (stage.seekHero) and screenshotted - so the opening is a true 25 fps.
//
// The 16:9 stage carries two devices: a desktop browser window (1440x900 in
// its own iframe) as the primary, with the phone overlapping it at the bottom
// right. stage.js gives the scene's active device full opacity and a slightly
// larger scale; the other sits back. The 9:16 stage stays phone-only.
//
// Outputs per layout: out/<layout>.webm, out/<layout>.scenes.json (actual
// scene start/end seconds), out/frames/<layout>-NN.png (a still at each
// scene midpoint) and, for the screencast method, the raw frames under
// out/frames-<layout>/ and out/hero-frames-<layout>/.
//
// "both" runs each layout in a fresh child process so the in-memory fixture
// state (today's report is written during the coach scenes) starts clean.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, statSync, createReadStream, renameSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installMock } from "./mock.mjs";
import { PROGRAMME_TITLE, VENUE, TODAY, londonEpoch } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const STAGE_DIR = path.join(HERE, "stage");
const APP = "http://127.0.0.1:4173";
const STAGE_PORT = 4174;
// Bumped to the first free port from STAGE_PORT upwards by stageServer(), so a
// stale recorder still holding 4174 cannot fail a fresh run.
let STAGE = `http://127.0.0.1:${STAGE_PORT}`;
const FPS = 50;                 // constant output cadence of out/<layout>.webm
const HERO_FPS = 25;            // scene 1 is 25 fps b-roll; rendering it faster adds nothing
const TIMESCALE = 2.5;          // default slow-motion factor for the live pass
const SIZES = { wide: { width: 1920, height: 1080 }, tall: { width: 1080, height: 1920 } };
const JPEG_QUALITY = 92;
// Which device leads each scene in the 16:9 cut (stage.js holds the matching
// visual state). Scene 1 is the hero and scene 9 the end card: no devices.
const LEADS = { 2: "desk", 3: "phone", 4: "phone", 5: "phone", 6: "desk", 7: "desk", 8: "desk" };
const BASE_ARGS = ["--no-sandbox", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--disable-default-apps", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"];
const UNCAP_ARGS = ["--disable-frame-rate-limit", "--disable-gpu-vsync", "--enable-gpu-rasterization", "--enable-zero-copy"];

// Playwright is the repo's own devDependency; nothing is installed here.
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(ROOT, "node_modules", "playwright"));

// The phone's clock. The recording's wall clock is shifted so the coach ends
// the 12-2pm session at about 13:58 ("Ended 1.58pm" on the register), and the
// status bar shows the same fixed times in both cuts.
const CLOCK = { coachStart: "13:57", coach: "13:58", parent: "14:12" };

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const o = { layout: "both", timing: path.join(HERE, "timing.json"), method: "screencast", format: "jpeg", hero: "offline", timescale: TIMESCALE, uncap: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layout") o.layout = argv[++i];
    else if (a === "--timing") o.timing = path.resolve(argv[++i]);
    else if (a === "--method") o.method = argv[++i];
    else if (a === "--format") o.format = argv[++i];
    else if (a === "--hero") o.hero = argv[++i];
    else if (a === "--timescale") o.timescale = Number(argv[++i]);
    else if (a === "--uncap") o.uncap = true;
    else if (a.startsWith("--timescale=")) o.timescale = Number(a.slice(12));
    else if (a.startsWith("--layout=")) o.layout = a.slice(9);
    else if (a.startsWith("--timing=")) o.timing = path.resolve(a.slice(9));
    else if (a.startsWith("--method=")) o.method = a.slice(9);
    else if (a.startsWith("--format=")) o.format = a.slice(9);
    else if (a.startsWith("--hero=")) o.hero = a.slice(7);
    else throw new Error(`unknown argument ${a}`);
  }
  if (!["jpeg", "png"].includes(o.format)) throw new Error("--format must be jpeg or png");
  if (!["wide", "tall", "both"].includes(o.layout)) throw new Error(`--layout must be wide, tall or both (got ${o.layout})`);
  if (!["screencast", "playwright"].includes(o.method)) throw new Error(`--method must be screencast or playwright`);
  if (!["offline", "live"].includes(o.hero)) throw new Error(`--hero must be offline or live`);
  if (!(o.timescale >= 1 && o.timescale <= 6)) throw new Error(`--timescale must be between 1 and 6 (got ${o.timescale})`);
  return o;
}

/* ------------------------------------------------------------------ */
/* Tools                                                                */
/* ------------------------------------------------------------------ */

export function ffmpegPath() {
  try {
    const p = require("ffmpeg-static"); // devDependency of this folder (npm install here)
    if (p && existsSync(p)) return p;
  } catch { /* not installed here */ }
  if (process.env.FFMPEG_PATH && existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  return "ffmpeg";
}

/** Chromium: PW_CHROME, else Playwright's registered build, else any build in the same browsers folder. */
export function resolveChrome() {
  if (process.env.PW_CHROME) {
    if (existsSync(process.env.PW_CHROME)) return process.env.PW_CHROME;
    throw new Error(`PW_CHROME=${process.env.PW_CHROME} does not exist`);
  }
  const registered = chromium.executablePath();
  if (registered && existsSync(registered)) return registered;
  // e.g. /opt/pw-browsers/chromium-1234/chrome-linux64/chrome registered, but only chromium-1194 installed.
  const browsers = registered ? path.dirname(path.dirname(path.dirname(registered))) : null;
  if (browsers && existsSync(browsers)) {
    const builds = readdirSync(browsers).filter((d) => /^chromium-\d+$/.test(d)).sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const b of builds) {
      for (const sub of ["chrome-linux", "chrome-linux64"]) {
        const exe = path.join(browsers, b, sub, "chrome");
        if (existsSync(exe)) return exe;
      }
    }
  }
  throw new Error(`no Chromium found (tried PW_CHROME, ${registered}); run "npx playwright install chromium" at the repo root or set PW_CHROME`);
}

function ffmpeg(args, label) {
  const r = spawnSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${label}) with status ${r.status}`);
}

async function up(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}

async function ensurePreview() {
  if (await up(`${APP}/`)) return;
  console.log("[record] starting vite preview on 4173");
  const child = spawn("npx", ["vite", "preview", "--port", "4173", "--host", "127.0.0.1"], { cwd: ROOT, detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await up(`${APP}/`)) return;
  }
  throw new Error("vite preview did not come up on 127.0.0.1:4173");
}

// Playwright's Chromium cannot decode H.264, so the hero clip is transcoded
// to VP9. A keyframe every 10 frames keeps the offline render's per-frame
// seeks cheap (a seek decodes forward from the previous keyframe).
const HERO_ENCODE = "vp9 crf28 g10";
function ensureHero() {
  const out = path.join(OUT, "hero.webm");
  const marker = `${out}.encode`;
  if (existsSync(out) && statSync(out).size > 0 && existsSync(marker) && readFileSync(marker, "utf8") === HERO_ENCODE) return out;
  const src = path.join(ROOT, "public", "hero-video.mov");
  console.log("[record] transcoding hero-video.mov → out/hero.webm (VP9)");
  mkdirSync(OUT, { recursive: true });
  ffmpeg(["-i", src, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", "-g", "10", "-row-mt", "1", "-cpu-used", "3", "-pix_fmt", "yuv420p", out], "hero transcode");
  writeFileSync(marker, HERO_ENCODE);
  return out;
}

/* ------------------------------------------------------------------ */
/* Stage server (stage/ + media) on 127.0.0.1:4174                      */
/* ------------------------------------------------------------------ */

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".webm": "video/webm", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

export async function stageServer() {
  const media = {
    "/media/hero.webm": path.join(OUT, "hero.webm"),
    "/media/logo.png": path.join(ROOT, "public", "email", "logo.png"),
    "/media/mascot.png": path.join(ROOT, "public", "email", "mascot.png"),
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, STAGE);
    let file = media[url.pathname];
    if (!file) {
      const rel = url.pathname === "/" ? "/stage.html" : url.pathname;
      file = path.join(STAGE_DIR, path.normalize(rel).replace(/^(\.\.[/\\])+/, ""));
      if (!file.startsWith(STAGE_DIR)) { res.writeHead(403); return res.end(); }
    }
    if (!existsSync(file)) { res.writeHead(404); return res.end("not found"); }
    const size = statSync(file).size;
    const type = TYPES[path.extname(file)] ?? "application/octet-stream";
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
      res.writeHead(206, { "content-type": type, "content-length": end - start + 1, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "cache-control": "no-cache" });
      return createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes", "cache-control": "no-cache" });
    createReadStream(file).pipe(res);
  });
  const tryPort = (port) => new Promise((resolve, reject) => {
    const onError = (e) => { server.removeListener("listening", onListen); reject(e); };
    const onListen = () => { server.removeListener("error", onError); resolve(); };
    server.once("error", onError);
    server.once("listening", onListen);
    server.listen(port, "127.0.0.1");
  });
  for (let port = STAGE_PORT; port < STAGE_PORT + 20; port++) {
    try {
      await tryPort(port);
      STAGE = `http://127.0.0.1:${port}`;
      if (port !== STAGE_PORT) console.log(`[record] port ${STAGE_PORT} busy, stage served on ${STAGE}`);
      return server;
    } catch (e) {
      if (e.code !== "EADDRINUSE") throw e;
    }
  }
  throw new Error(`no free port for the stage server between ${STAGE_PORT} and ${STAGE_PORT + 19}`);
}

/* ------------------------------------------------------------------ */
/* Screencast capture                                                   */
/* ------------------------------------------------------------------ */

class Screencast {
  // `ts` is the slow-motion factor the live pass is driven at: every frame's
  // timestamp is divided by it, so this.frames carries VIDEO seconds.
  constructor(page, dir, format = "jpeg", ts = 1) { this.page = page; this.dir = dir; this.format = format; this.ts = ts; this.ext = format === "png" ? "png" : "jpg"; this.frames = []; this.pending = []; this.t0 = 0; this.n = 0; }
  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (f) => this.onFrame(f));
    const { width, height } = this.page.viewportSize();
    await this.cdp.send("Page.startScreencast", { format: this.format, ...(this.format === "jpeg" ? { quality: JPEG_QUALITY } : {}), everyNthFrame: 1, maxWidth: width, maxHeight: height });
    this.t0 = Date.now() / 1000;
  }
  onFrame(f) {
    const sid = f.sessionId;
    this.cdp.send("Page.screencastFrameAck", { sessionId: sid }).catch(() => {});
    const now = Date.now() / 1000;
    // metadata.timestamp is epoch seconds in Chromium; fall back to receive time if it is not.
    const ts = typeof f.metadata?.timestamp === "number" && Math.abs(f.metadata.timestamp - now) < 5 ? f.metadata.timestamp : now;
    const i = ++this.n;
    const file = path.join(this.dir, `f-${String(i).padStart(6, "0")}.${this.ext}`);
    this.frames.push({ i, t: (ts - this.t0) / this.ts, file });
    this.pending.push(writeFile(file, Buffer.from(f.data, "base64")));
  }
  async stop() {
    try { await this.cdp.send("Page.stopScreencast"); } catch { /* closed */ }
    await Promise.all(this.pending);
    await this.cdp.detach().catch(() => {});
    // Chromium's frame timestamps are not always delivered in order; the
    // lookup below assumes a sorted list (stable sort keeps arrival order for ties).
    this.frames.sort((a, b) => a.t - b.t);
    return this.frames;
  }
  /** Frame on screen at time t (seconds from t0). */
  at(t) { return frameAt(this.frames, t); }
}

function frameAt(frames, t) {
  let lo = 0, hi = frames.length - 1, best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (frames[mid].t <= t) { best = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return frames[best];
}

/**
 * Mux the captured frames into a constant-rate webm WITHOUT assuming they are
 * evenly spaced: an ffmpeg concat list carries each frame's own duration (the
 * gap to the next frame's timestamp), and ffmpeg resamples that variable-rate
 * timeline to a constant FPS. Frames are in video seconds already.
 */
function muxScreencast(frames, ext, totalS, outFile, layout) {
  const listFile = path.join(OUT, `concat-${layout}.txt`);
  // The last frame at or before 0 opens the film; earlier ones are pre-roll.
  let i0 = 0;
  for (let i = 0; i < frames.length; i++) if (frames[i].t <= 0) i0 = i;
  const keep = frames.slice(i0).filter((f) => f.t < totalS - 1e-6);
  if (!keep.length) throw new Error(`${layout}: no frames inside 0..${totalS}s`);
  const lines = ["ffconcat version 1.0"];
  for (let i = 0; i < keep.length; i++) {
    const start = Math.max(0, keep[i].t);
    const end = i + 1 < keep.length ? Math.max(start, keep[i + 1].t) : totalS;
    lines.push(`file '${keep[i].file}'`, `duration ${Math.max(0.0005, end - start).toFixed(6)}`);
  }
  // The concat demuxer only honours the final duration if the file is repeated.
  lines.push(`file '${keep[keep.length - 1].file}'`);
  writeFileSync(listFile, `${lines.join("\n")}\n`);
  console.log(`[record] ${layout}: ${keep.length} source frames over ${totalS}s → ${Math.round(totalS * FPS)} frames at ${FPS} fps (cfr), encoding VP9`);
  ffmpeg([
    "-f", "concat", "-safe", "0", "-i", listFile,
    "-r", String(FPS), "-fps_mode", "cfr", "-t", String(totalS),
    "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "16", "-row-mt", "1", "-cpu-used", "5", "-threads", "4", "-pix_fmt", "yuv420p",
    outFile,
  ], "screencast mux");
  return keep.length;
}

/** Inter-frame gaps (ms) inside the given video-time spans. */
function gapStats(frames, spans) {
  const gaps = [];
  let n = 0;
  for (const [a, b] of spans) {
    const t = frames.filter((f) => f.t >= a && f.t < b).map((f) => f.t);
    n += t.length;
    for (let i = 1; i < t.length; i++) gaps.push((t[i] - t[i - 1]) * 1000);
  }
  gaps.sort((x, y) => x - y);
  const q = (p) => (gaps.length ? +gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))].toFixed(1) : null);
  const span = spans.reduce((m, [a, b]) => m + (b - a), 0);
  return { frames: n, fps: span ? +(n / span).toFixed(1) : null, median_gap_ms: q(0.5), p95_gap_ms: q(0.95), max_gap_ms: q(0.999) };
}

/**
 * How many of the FPS output ticks fall on the same source frame as the tick
 * before them - i.e. frames the constant-rate resample had to repeat because
 * the capture had a gap there. This is the honest starvation number;
 * mpdecimate below also counts frames that are identical because nothing on
 * screen was moving, which is most of a talking-head advert.
 */
function repeatedTicks(frames, totalS) {
  const ticks = Math.round(totalS * FPS);
  let repeats = 0, prev = -1;
  for (let k = 0; k < ticks; k++) {
    const i = frameAt(frames, k / FPS).i;
    if (i === prev) repeats++;
    prev = i;
  }
  return { out_frames: ticks, repeated_frames: repeats, repeated_pct: +((repeats / ticks) * 100).toFixed(1) };
}

/** Frames the encoder had to repeat, counted with ffmpeg's mpdecimate. */
function duplicateFrames(file, expected) {
  const r = spawnSync(ffmpegPath(), ["-hide_banner", "-nostdin", "-i", file, "-an", "-vf", "mpdecimate", "-loglevel", "error", "-stats", "-f", "null", "-"], { encoding: "utf8" });
  const m = [...(r.stderr ?? "").matchAll(/frame=\s*(\d+)/g)];
  if (!m.length) return null;
  const kept = Number(m[m.length - 1][1]);
  return { out_frames: expected, unique_frames: kept, duplicate_frames: Math.max(0, expected - kept) };
}

/* ------------------------------------------------------------------ */
/* Offline hero render (scene 1 at a true 25 fps)                       */
/* ------------------------------------------------------------------ */

async function renderHeroOffline(browser, layout, scene, format) {
  const size = SIZES[layout];
  const ext = format === "png" ? "png" : "jpg";
  const dir = path.join(OUT, `hero-frames-${layout}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, locale: "en-GB", timezoneId: "Europe/London" });
  await installMock(ctx, { user: "parent" });
  const page = await ctx.newPage();
  await page.goto(`${STAGE}/?layout=${layout}`, { waitUntil: "load" });
  const ready = await page.evaluate(() => window.stage.ready);
  if (!ready.heroReady) throw new Error("hero clip not ready for the offline render");
  await page.evaluate(() => window.stage.scene(1, { paused: true }));
  const ticks = Math.round(scene.duration_s * HERO_FPS);
  const frames = [];
  const t0 = Date.now();
  for (let k = 0; k < ticks; k++) {
    const t = scene.start_s + k / HERO_FPS;
    await page.evaluate((t) => window.stage.seekHero(t), t - scene.start_s);
    const file = path.join(dir, `h-${String(k).padStart(6, "0")}.${ext}`);
    await page.screenshot({ path: file, type: format === "png" ? "png" : "jpeg", ...(format === "png" ? {} : { quality: JPEG_QUALITY }) });
    frames.push({ i: -1 - k, t, file });
  }
  await ctx.close();
  console.log(`[record] ${layout}: hero rendered offline, ${ticks} frames at ${HERO_FPS} fps in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return frames;
}

/* ------------------------------------------------------------------ */
/* Human-ish interaction helpers                                        */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TAP_GAP = 350;

/**
 * Human-ish driver for one device (the phone iframe or the desktop iframe).
 *
 *   ts     slow-motion factor: every beat below is in VIDEO ms and is
 *          multiplied by ts to get wall time, so the cut looks identical at
 *          any timescale.
 *   quiet  () => true while this device is NOT the scene's active one: it is
 *          then driven without the pointer (a direct element click) so the two
 *          devices never fight over the one mouse.
 *   pad    how far under the app's sticky top bar a heading is parked.
 *
 * Every scroll is a requestAnimationFrame loop inside the frame that moves a
 * few pixels per frame (no page.mouse.wheel chunks, no scrollIntoView), so the
 * motion is smooth at whatever rate the screencast is capturing.
 */
export function makeHuman(page, frame, { ts = 1, quiet = () => false, pad = 72 } = {}) {
  const last = { tap: 0 };
  const nap = (ms) => sleep(ms * ts);

  /** In-frame: ease an element into view, then hold still for two frames. */
  const smoothInto = (n, { block, ms, pad }) => new Promise((resolve) => {
    const scrollerOf = () => {
      let e = n.parentElement;
      while (e) {
        const cs = getComputedStyle(e);
        if (/(auto|scroll|overlay)/.test(cs.overflowY) && e.scrollHeight - e.clientHeight > 2) return e;
        e = e.parentElement;
      }
      return null;
    };
    const sc = scrollerOf();
    const box = sc ? sc.getBoundingClientRect() : { top: 0, height: window.innerHeight };
    const hit = () => {
      const r = n.getBoundingClientRect();
      const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!e && (e === n || n.contains(e) || e.contains(n));
    };
    const r0 = n.getBoundingClientRect();
    let delta;
    if (block === "center") delta = (r0.top + r0.height / 2) - (box.top + box.height / 2);
    else if (block === "start") delta = r0.top - box.top - pad;
    else {
      const over = r0.top - (box.top + pad);
      const under = r0.bottom - (box.top + box.height - pad);
      delta = over < 0 ? over : under > 0 ? under : 0;
    }
    const cur = sc ? sc.scrollTop : (window.scrollY || document.documentElement.scrollTop);
    const max = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
    const to = Math.max(0, Math.min(Math.max(0, max), cur + delta));
    const dy = to - cur;
    const put = (y) => { if (sc) sc.scrollTop = y; else window.scrollTo(0, y); };
    if (Math.abs(dy) < 1.5) return requestAnimationFrame(() => resolve({ moved: false, hit: hit() }));
    const t0 = performance.now();
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      put(cur + dy * ease(p));
      if (p < 1) return requestAnimationFrame(step);
      requestAnimationFrame(() => requestAnimationFrame(() => resolve({ moved: true, dy: Math.round(dy), hit: hit() })));
    };
    requestAnimationFrame(step);
  });

  /** In-frame: ease the window down by dy over ms, a few px per frame. */
  const smoothBy = ({ dy, ms }) => new Promise((resolve) => {
    const cur = window.scrollY || document.documentElement.scrollTop;
    const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const to = Math.max(0, Math.min(max, cur + dy));
    const d = to - cur;
    if (Math.abs(d) < 1) return resolve({ dy: 0 });
    const t0 = performance.now();
    const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      window.scrollTo(0, cur + d * ease(p));
      if (p < 1) requestAnimationFrame(step); else resolve({ dy: Math.round(d) });
    };
    requestAnimationFrame(step);
  });

  /**
   * Tap a locator. `anchor` is an optional wider element (e.g. the whole area
   * block around a rating radio) that is scrolled into view instead of the
   * target, so the shot frames the block rather than clipping its heading.
   */
  async function tap(locator, { block = "nearest", settle = 420, anchor = null, scrollMs = 520 } = {}) {
    const t = Date.now();
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 12000 });
    const { moved } = await (anchor ? anchor.first() : el).evaluate(smoothInto, { block, ms: scrollMs * ts, pad });
    await nap(moved ? Math.max(0, settle - 200) : Math.min(settle, 120));
    const wait = TAP_GAP * ts - (Date.now() - last.tap);
    if (wait > 0) await sleep(wait);
    if (quiet()) {
      // Not the active device: click it without moving the shared pointer.
      await el.evaluate((n) => n.click());
    } else {
      // A raw pointer tap at the settled box centre. Playwright's element click
      // (forced or not) re-scrolls the target inside the cross-origin frame and
      // lands off-target once the sheet has scrolled; boundingBox() is already in
      // page coordinates, device scale included.
      const box = await el.boundingBox();
      if (!box) throw new Error("tap: element has no box");
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 40 * ts });
    }
    last.tap = Date.now();
    if (process.env.RECORD_DEBUG) console.log(`[tap] ${Date.now() - t}ms moved=${moved} quiet=${quiet()}`);
  }
  async function type(locator, text, perChar = 40) {
    await tap(locator, { block: "center" });
    await nap(200);
    if (quiet()) { await locator.first().evaluate((n, v) => { n.value = v; n.dispatchEvent(new Event("input", { bubbles: true })); }, text); return; }
    await page.keyboard.type(text, { delay: perChar * ts });
  }
  /** Scroll the device dy px over dy/pxPerSec seconds of video time. */
  async function wheel(dy, pxPerSec = 320) {
    const ms = Math.max(200, (Math.abs(dy) / pxPerSec) * 1000);
    await frame.evaluate(smoothBy, { dy, ms: ms * ts });
  }
  /** Scroll a section heading to just under the app's sticky top bar. */
  async function headingToTop(name, { ms = 700 } = {}) {
    const h = frame.getByRole("heading", { name }).first();
    await h.waitFor({ timeout: 12000 });
    await h.evaluate(smoothInto, { block: "start", ms: ms * ts, pad });
    await nap(120);
  }
  /** Ease a locator into view without tapping it. */
  async function scrollInto(locator, { block = "center", ms = 700 } = {}) {
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 12000 });
    return el.evaluate(smoothInto, { block, ms: ms * ts, pad });
  }
  const parkMouse = () => (quiet() ? Promise.resolve() : page.mouse.move(4, 4));
  return { tap, type, wheel, headingToTop, scrollInto, parkMouse, nap };
}

/* ------------------------------------------------------------------ */
/* Scene drivers                                                        */
/* ------------------------------------------------------------------ */

const RATING_PLAN = [
  ["Confident to Attack", "Consistent"],
  ["Comfortable in Rally", "Consistent"],
  ["Chases Every Ball", "Excelling"],
  ["Creative in Play", "Progressing"],
  ["Athletic Qualities", "Consistent"],
  ["Reads the Ball", "Consistent"],
  ["Loves the Game", "Consistent"],
  ["Loves to Compete", "Excelling"],
  ["Serving", "Consistent"],
];
const COMMENT = "Big step forward on the forehand today. Keep chasing the wide balls.";

export function drivers({ page, frame, desk, ctx, stage, human, deskHuman, clock, ts = 1, issues = [] }) {
  const F = frame;
  const D = desk;
  const text = (t, timeout = 10000) => F.getByText(t, { exact: false }).first().waitFor({ state: "visible", timeout });
  const dtext = (t, timeout = 10000) => D.getByText(t, { exact: false }).first().waitFor({ state: "visible", timeout });
  const until = (sceneId, offsetS) => clock.untilScene(sceneId, offsetS);
  const nap = (ms) => sleep(ms * ts);
  /**
   * Run the phone track and (16:9 only) the desktop track together. The phone
   * track owns the scene: if it fails the scene fails. A desktop hiccup is
   * recorded but never fails the scene, and the desktop track is not even
   * constructed in the tall cut.
   */
  const both = async (phoneTrack, deskTrack) => {
    const desktop = D ? deskTrack().catch((e) => { const m = `desktop track: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`; issues.push(m); console.log(`[record] ${m}`); }) : null;
    await phoneTrack;
    // The desktop gets a short grace period only: a desktop locator still
    // timing out must not push the scene past its slot in timing.json.
    if (desktop) await Promise.race([desktop, sleep(600 * ts)]);
  };
  const CARD = { name: "Alfie Barker's performance & reports", exact: true };
  const status = (who) => ({ status: { bg: "#ffffff", time: CLOCK[who] } });
  // The chapter card must be fully opaque before the app behind it is
  // navigated, or a blank white phone / the app's spinner shows through.
  const cardOpaque = () => page.waitForFunction(() => getComputedStyle(document.getElementById("chapter")).opacity === "1", null, { timeout: 3000 });
  const cardGone = () => page.locator("#chapter.on").waitFor({ state: "detached", timeout: 5000 });

  return {
    // Hero b-roll with the title reveal. The parent hub is already loaded in the phone behind it.
    1: async () => { await stage("scene", 1); },

    // Phone slides in on the Parent Hub with Alfie's card; three tag lines.
    2: async () => {
      await stage("scene", 2, status("parent"));
      await until(2, 5.2);
      await human.scrollInto(F.getByRole("button", CARD), { block: "center", ms: 900 });
    },

    // Chapter card "FOR COACHES" (1.5 s), then Coach Hub → Culford → programme → today's register.
    3: async () => {
      await stage("scene", 3, status("coach"), { fireAndForget: true });
      await cardOpaque();
      await installMock(ctx, { user: "coach" });
      await both(
        (async () => { await F.goto(`${APP}/coach`, { waitUntil: "domcontentloaded" }); await text(VENUE, 15000); })(),
        () => (async () => { await D.goto(`${APP}/coach`, { waitUntil: "domcontentloaded" }); await dtext(VENUE, 15000); })(),
      );
      // Three taps at ~0.8 s intervals once the card has lifted, so the
      // register (the shot the scene is about) is up by ~3.7 s of the 9 s scene.
      await until(3, 2.0);
      await cardGone();
      await both((async () => {
        await human.tap(F.getByText(VENUE, { exact: false }));
        await text(PROGRAMME_TITLE);
        await until(3, 2.8);
        await human.tap(F.getByText(PROGRAMME_TITLE, { exact: false }));
        await text("Upcoming");
        await until(3, 3.5);
        await human.tap(F.getByRole("button", { name: /Today/ }));
        await text("Alfie Barker");
        await text("Isla Fraser");
      })(), () => (async () => {
        // The desktop sits back on the same programme for scenes 3-5.
        await deskHuman.tap(D.getByText(VENUE, { exact: false }));
        await dtext(PROGRAMME_TITLE);
        await until(3, 3.0);
        await deskHuman.tap(D.getByText(PROGRAMME_TITLE, { exact: false }));
        await dtext("Upcoming");
      })());
    },

    // Alfie → report sheet → nine ratings → comment → save.
    4: async () => {
      await stage("scene", 4, status("coach"));
      await until(4, 0.3);
      await human.tap(F.getByRole("button", { name: "Open Alfie Barker" }));
      await text("Session report · 0/9 rated");
      await until(4, 1.3);
      await human.tap(F.getByRole("button", { name: /Session report · 0\/9 rated/ }));
      await text("Last time:");
      await until(4, 2.2);
      for (const [area, level] of RATING_PLAN) {
        const group = F.getByRole("radiogroup", { name: area });
        const radio = group.getByRole("radio", { name: level, exact: true });
        // Frame the whole area block (heading, descriptor, the four levels),
        // not just the tapped pill, so no heading is cut by the sheet's top.
        await human.tap(radio, { block: "center", settle: 200, anchor: group.locator("..") });
        if (await radio.getAttribute("aria-checked") !== "true") {
          console.log(`[record] rating ${area} did not take on the first tap; retrying`);
          await nap(150);
          await radio.click({ timeout: 4000 }).catch((e) => console.log(`[record] retry failed: ${e.message.split("\n")[0]}`));
        }
      }
      const ta = F.getByPlaceholder("What went well, what to work on…");
      await human.type(ta, COMMENT, 40);
      await nap(250);
      await human.tap(F.getByRole("button", { name: "Save report" }), { block: "nearest" });
      // Park the pointer: sonner pauses a toast's 4 s timer while it is
      // hovered, and the "Report complete" toast pops up right under the Save
      // button, so a parked mouse lets it clear before the End session sheet.
      await human.parkMouse();
      await text("Session report · Complete");
    },

    // Close the profile sheet, end the session, confirm, "reports sent" state.
    5: async () => {
      await stage("scene", 5, status("coach"));
      await until(5, 0.6);
      await page.keyboard.press("Escape");
      await F.getByRole("dialog").waitFor({ state: "hidden", timeout: 8000 });
      await text("3/4 reports");
      await until(5, 2.0);
      await human.tap(F.getByRole("button", { name: "End session" }));
      await text("End session?");
      await text("3 complete reports will be sent to parents.");
      await until(5, 4.6);
      await human.tap(F.getByRole("dialog").getByRole("button", { name: "End session" }));
      await text("Session ended", 10000);
      await human.parkMouse();
    },

    // Chapter card "FOR PARENTS" (1.5 s), then the Parent Hub already on
    // Alfie's card (scene 2 opened on the top of the hub; this lands one
    // scroll further down), then the "Performance & Reports" button centred.
    6: async () => {
      await stage("scene", 6, status("parent"), { fireAndForget: true });
      await cardOpaque();
      await installMock(ctx, { user: "parent" });
      const btn = F.getByRole("button", CARD);
      await both(
        (async () => { await F.goto(`${APP}/parent-hub`, { waitUntil: "domcontentloaded" }); await btn.waitFor({ timeout: 15000 }); })(),
        // The desktop leads scene 6: the hub fits its 1440x900 viewport whole.
        () => (async () => { await D.goto(`${APP}/parent-hub`, { waitUntil: "domcontentloaded" }); await D.getByRole("button", CARD).waitFor({ timeout: 15000 }); })(),
      );
      // Under the card: land on the child card, not the hub header.
      await F.getByRole("heading", { name: /^Alfie Barker/ }).first().evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "start" })).catch(() => {});
      await F.evaluate(() => window.scrollBy({ top: -88, behavior: "instant" }));
      await cardGone();
      await until(6, 4.2);
      await human.scrollInto(btn, { block: "center", ms: 900 });
    },

    // Performance & Reports: radar, then the full report with the nine rows and the comment.
    7: async () => {
      await stage("scene", 7, status("parent"));
      await both((async () => {
        await until(7, 0.4);
        await human.tap(F.getByRole("button", CARD));
        await human.parkMouse();
        await text("Latest report");
        await F.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
        await until(7, 3.8);
        await human.tap(F.getByRole("button", { name: /^Open/ }));
        await F.waitForURL(/\/report\//, { timeout: 8000 });
        await human.parkMouse();
        await text("How Alfie did");
        await F.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
        await until(7, 6.0);
        await human.headingToTop(/^The nine areas/);
        await until(7, 8.4);
        await human.headingToTop(/^Sam Reid's comment/);
      })(), () => (async () => {
        // The desktop leads: same journey, a beat ahead of the phone.
        await until(7, 0.3);
        await deskHuman.tap(D.getByRole("button", CARD));
        await deskHuman.parkMouse();
        await dtext("Latest report");
        await D.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
        await until(7, 3.7);
        await deskHuman.tap(D.getByRole("button", { name: /^Open/ }));
        await D.waitForURL(/\/report\//, { timeout: 8000 });
        await deskHuman.parkMouse();
        await dtext("How Alfie did");
        await D.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
        await until(7, 5.9);
        await deskHuman.headingToTop(/^The nine areas/);
        // The desktop report is 2436 px tall against the phone's ~4600, so it
        // drifts rather than jumping heading to heading, and stays above the
        // trend grid so scene 8 can run straight on down into it.
        await until(7, 8.3);
        await deskHuman.wheel(300, 130);
      })());
    },

    // Progress over time: slow scroll through the trend grid (first sentence),
    // then the earlier reports list while the narration talks about every
    // report being shared with the child's own coach.
    8: async (scene) => {
      await stage("scene", 8, status("parent"));
      await both((async () => {
        await until(8, 0.3);
        await human.headingToTop(/^Progress over time/);
        await until(8, 1.6);
        await human.wheel(760, 95);
        await human.parkMouse();
        await until(8, Math.min(10.2, scene.duration_s - 2.5));
        await human.headingToTop(/^Earlier reports/);
      })(), () => (async () => {
        // One unbroken drift from the coach's comment, through the whole trend
        // grid, to the earlier reports at the foot of the page.
        await until(8, 0.3);
        await deskHuman.wheel(700, 78);
      })());
    },

    // End card; fade to navy for the last 1.6 s.
    9: async (scene) => {
      await stage("scene", 9);
      await until(9, scene.duration_s - 1.6);
      await stage("fade", true);
    },
  };
}

/* ------------------------------------------------------------------ */
/* One layout                                                           */
/* ------------------------------------------------------------------ */

async function recordLayout(layout, timing, method, format, hero, timescale = 1, uncap = false) {
  const ts = method === "screencast" ? timescale : 1;
  const size = SIZES[layout];
  const total = timing.total_s ?? timing.scenes.reduce((m, s) => Math.max(m, s.start_s + s.duration_s), 0);
  mkdirSync(path.join(OUT, "frames"), { recursive: true });
  const videoDir = path.join(OUT, `video-${layout}`);
  rmSync(videoDir, { recursive: true, force: true });

  const browser = await chromium.launch({
    executablePath: resolveChrome(),
    args: [...BASE_ARGS, ...(uncap ? UNCAP_ARGS : [])],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" } : undefined,
    ignoreHTTPSErrors: true,
  });

  // Scene 1 rendered frame by frame before the live pass (its own context).
  const scene1 = timing.scenes.find((s) => s.id === 1);
  const heroFrames = hero === "offline" && method === "screencast" && scene1 ? await renderHeroOffline(browser, layout, scene1, format) : [];

  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: 1, hasTouch: true, locale: "en-GB", timezoneId: "Europe/London",
    ...(method === "playwright" ? { recordVideo: { dir: videoDir, size } } : {}),
  });
  // No action may wait forever: a stuck locator must fail the scene, not the recording.
  ctx.setDefaultTimeout(12000);
  const issues = [];
  // Freeze the time of day: the register is ended ~60 s from now, at ~13:58.
  const clockOffsetMs = londonEpoch(TODAY, CLOCK.coachStart) + 20_000 - Date.now();
  await installMock(ctx, { user: "parent", clockOffsetMs });
  const page = await ctx.newPage();
  const pageCreatedAt = Date.now();
  page.on("pageerror", (e) => issues.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/net::ERR|status of 204|WebSocket|realtime|favicon|Failed to load resource/.test(m.text())) issues.push(`console: ${m.text().slice(0, 200)}`); });

  await page.goto(`${STAGE}/?layout=${layout}`, { waitUntil: "load" });
  const ready = await page.evaluate(() => window.stage.ready);
  console.log(`[record] ${layout}: stage ready`, JSON.stringify(ready));
  if (!ready.fonts.archivo || !ready.fonts.hanken) issues.push(`stage fonts not loaded: ${JSON.stringify(ready.fonts)}`);
  if (!ready.heroReady) issues.push("hero clip not ready before recording");

  const frame = page.frame({ name: "app" });
  await frame.goto(`${APP}/parent-hub`, { waitUntil: "domcontentloaded" });
  await frame.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true }).waitFor({ timeout: 20000 });
  const appFonts = await frame.evaluate(async () => {
    await document.fonts.ready;
    const fams = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")));
    return { archivo: fams.has("Archivo"), hanken: fams.has("Hanken Grotesk") };
  });
  if (!appFonts.archivo || !appFonts.hanken) issues.push(`app fonts not loaded: ${JSON.stringify(appFonts)}`);

  // The desktop window: 16:9 only (stage.js removes the whole zone in the tall
  // layout, so the second iframe is never created there).
  const desk = layout === "wide" ? page.frame({ name: "desk" }) : null;
  if (layout === "wide" && !desk) issues.push("desktop iframe missing from the wide stage");
  if (desk) {
    await desk.goto(`${APP}/parent-hub`, { waitUntil: "domcontentloaded" });
    await desk.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true }).waitFor({ timeout: 20000 });
    const dsize = await desk.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.clientHeight, sw: document.documentElement.scrollWidth }));
    if (dsize.w !== 1440 || dsize.h !== 900) issues.push(`desktop viewport is ${dsize.w}x${dsize.h}, expected 1440x900`);
    if (dsize.sw > dsize.w + 1) issues.push(`desktop page scrolls horizontally (${dsize.sw} > ${dsize.w})`);
  }
  await page.mouse.move(4, 4);
  await sleep(400);
  const stage = async (fn, ...args) => {
    const fire = args.length && args[args.length - 1]?.fireAndForget;
    if (fire) args = args.slice(0, -1);
    return page.evaluate(([fn, args, fire]) => { const r = window.stage[fn](...args); return fire ? undefined : r; }, [fn, args, !!fire]);
  };

  // Recording clock: t0 is the moment scene 1 is called.
  let t0 = 0;
  // Video seconds, not wall seconds: the live pass runs at 1/ts speed.
  const clock = {
    now: () => (Date.now() - t0) / 1000 / ts,
    untilT: async (t) => { const ms = t0 + t * 1000 * ts - Date.now(); if (ms > 0) await sleep(ms); },
    untilScene: (id, off) => { const s = timing.scenes.find((x) => x.id === id); return clock.untilT(s.start_s + off); },
  };
  // The pointer belongs to the phone; the desktop is always driven with a
  // direct element click. Not a stylistic choice: the phone sits in front of
  // the desktop's bottom-right corner, so a pointer tap on a control over
  // there (the report's "Open", "Upload a performance plan") would land on the
  // phone instead. Nothing is lost - headless Chromium never draws a cursor.
  const human = makeHuman(page, frame, { ts, quiet: () => false, pad: 72 });
  const deskHuman = desk ? makeHuman(page, desk, { ts, quiet: () => true, pad: 96 }) : null;
  const D = drivers({ page, frame, desk, ctx, stage, human, deskHuman, clock, ts, issues });

  let sc = null;
  if (method === "screencast") {
    // Slow motion + continuous repaint: see the smoothness note at the top.
    const applied = await page.evaluate((t) => window.stage.setTimeScale(t), ts);
    const pumping = await page.evaluate(() => window.stage.pump(true));
    if (!pumping) issues.push("repaint pump did not start");
    console.log(`[record] ${layout}: timescale ${applied}x, repaint pump on, capturing jpeg q${JPEG_QUALITY}${uncap ? " (uncapped flags)" : ""}`);
    sc = new Screencast(page, path.join(OUT, `frames-${layout}`), format, ts);
    await sc.start();
    t0 = sc.t0 * 1000;
  } else t0 = Date.now();

  const actual = [];
  const stills = [];
  const midTimers = [];
  for (const scene of timing.scenes) {
    await clock.untilT(scene.start_s);
    const start = clock.now();
    const end_target = scene.start_s + scene.duration_s;
    if (method === "playwright") {
      const mid = scene.start_s + scene.duration_s / 2;
      const file = path.join(OUT, "frames", `${layout}-${String(scene.id).padStart(2, "0")}.png`);
      midTimers.push(new Promise((resolve) => setTimeout(async () => { try { await page.screenshot({ path: file }); stills.push(file); } catch (e) { issues.push(`still ${scene.id}: ${e.message}`); } resolve(); }, Math.max(0, t0 + mid * 1000 * ts - Date.now()))));
    }
    let error = null;
    // Hard deadline per scene: a driver that hangs (a stuck input ack, a
    // locator that never resolves) fails its own scene at end + 3 s instead of
    // stalling the whole recording; the clock keeps running for the rest.
    const deadlineMs = t0 + (end_target + 3) * 1000 * ts - Date.now();
    let deadlineTimer = null;
    const deadline = new Promise((_, reject) => { deadlineTimer = setTimeout(() => reject(new Error(`scene ${scene.id} driver did not finish by ${(end_target + 3).toFixed(1)}s (deadline)`)), Math.max(0, deadlineMs)); });
    try { await Promise.race([(D[scene.id] ?? (async () => {}))(scene), deadline]); }
    catch (e) { error = e instanceof Error ? e.message.split("\n")[0] : String(e); issues.push(`scene ${scene.id}: ${error}`); console.log(`[record] scene ${scene.id} ERROR ${error}`); }
    finally { clearTimeout(deadlineTimer); }
    const done = clock.now();
    const overrun = done - end_target;
    if (overrun > 0.05) { issues.push(`scene ${scene.id} overran by ${overrun.toFixed(2)}s`); console.log(`[record] scene ${scene.id} overran by ${overrun.toFixed(2)}s`); }
    await clock.untilT(end_target);
    const end = clock.now();
    actual.push({ layout, id: scene.id, start_s: +start.toFixed(3), end_s: +end.toFixed(3), target_start_s: scene.start_s, target_end_s: end_target, interactions_done_s: +done.toFixed(3), overrun_s: +Math.max(0, overrun).toFixed(3), error });
    console.log(`[record] ${layout} scene ${scene.id}: ${start.toFixed(2)}–${end.toFixed(2)}s (interactions done at ${done.toFixed(2)}s)`);
  }
  await clock.untilT(total);
  await Promise.all(midTimers);

  const outFile = path.join(OUT, `${layout}.webm`);
  let leadS = 0;
  let smoothness = null;
  if (sc) {
    const live = await sc.stop();
    await ctx.close();
    await browser.close();
    // The offline hero frames replace the live capture for the whole of scene 1.
    const heroEnd = heroFrames.length ? scene1.start_s + scene1.duration_s : -1;
    const frames = heroFrames.length ? [...heroFrames, ...live.filter((f) => f.t >= heroEnd)] : live;
    const sourceFrames = muxScreencast(frames, sc.ext, total, outFile, layout);
    for (const scene of timing.scenes) {
      const fr = frameAt(frames, scene.start_s + scene.duration_s / 2);
      const file = path.join(OUT, "frames", `${layout}-${String(scene.id).padStart(2, "0")}.png`);
      if (sc.ext === "png") copyFileSync(fr.file, file); else ffmpeg(["-i", fr.file, file], `still ${scene.id}`);
      stills.push(file);
    }
    // Per-scene capture rate, so a starved screencast is visible in the summary.
    for (const a of actual) {
      const n = live.filter((f) => f.t >= a.target_start_s && f.t < a.target_end_s).length;
      a.captured_fps = +(n / (a.target_end_s - a.target_start_s)).toFixed(1);
      const g = gapStats(live, [[a.target_start_s, a.target_end_s]]);
      a.median_gap_ms = g.median_gap_ms;
      a.p95_gap_ms = g.p95_gap_ms;
      if (a.id === 1 && heroFrames.length) a.hero = "offline";
    }
    // Motion-heavy scenes (4 rating taps, 7 report scrolls, 8 trend scroll):
    // this is the number the judder is judged on.
    const motion = [4, 7, 8].map((id) => timing.scenes.find((x) => x.id === id)).filter(Boolean).map((x) => [x.start_s, x.start_s + x.duration_s]);
    smoothness = {
      ...gapStats(live, motion),
      scenes: [4, 7, 8],
      overall: gapStats(live, [[timing.scenes[1]?.start_s ?? 0, total]]),
      fps_out: FPS,
      timescale: ts,
      uncapped_flags: uncap,
      source_frames: sourceFrames,
      ...repeatedTicks(frames, total),
      ...(duplicateFrames(outFile, Math.round(total * FPS)) ?? {}),
      method: `Page.startScreencast jpeg q${JPEG_QUALITY} everyNthFrame 1 with a per-frame requestAnimationFrame repaint pump, driven at ${ts}x slow motion and timestamped from metadata.timestamp; muxed through an ffmpeg concat list carrying each frame's exact duration and resampled to ${FPS} fps cfr. Gaps are inter-frame deltas in video seconds over scenes 4, 7 and 8; duplicate_frames is mpdecimate on the finished webm (scene 1 is rendered offline at ${HERO_FPS} fps, so 1 in 2 of its output frames is a legitimate repeat).`,
    };
    console.log(`[record] ${layout}: smoothness ${JSON.stringify({ median_gap_ms: smoothness.median_gap_ms, p95_gap_ms: smoothness.p95_gap_ms, fps: smoothness.fps, repeated_frames: smoothness.repeated_frames, duplicate_frames: smoothness.duplicate_frames })}`);
    writeFileSync(path.join(OUT, `${layout}.frames.json`), JSON.stringify({ format: sc.format, t0: sc.t0, hero: heroFrames.length ? "offline" : "live", frames: live.map((f) => [f.i, +f.t.toFixed(3)]) }));
    console.log(`[record] ${layout}: ${live.length} live frames captured (${(live.length / total).toFixed(1)} fps average; per scene ${actual.map((a) => `${a.id}:${a.captured_fps}${a.hero ? "(offline)" : ""}`).join(" ")})`);
  } else {
    const video = page.video();
    await ctx.close();
    await browser.close();
    const p = await video.path();
    renameSync(p, outFile);
    rmSync(videoDir, { recursive: true, force: true });
    leadS = +((t0 - pageCreatedAt) / 1000).toFixed(3);
    issues.push(`playwright video starts ${leadS}s before scene 1 (lead not trimmed)`);
  }

  const summary = { layout, method, format: method === "screencast" ? format : "webm(vp8)", size, fps: FPS, total_s: total, lead_s: leadS, hero: heroFrames.length ? "offline" : "live", timescale: ts, devices: desk ? { desktop: "1440x900 iframe", phone: "390x844 iframe", leads: LEADS } : { phone: "390x844 iframe" }, smoothness, clock: CLOCK, timing: path.basename(process.env.RECORD_TIMING ?? "timing.json"), scenes: actual, stills: stills.sort(), issues, recorded_at: new Date().toISOString() };
  writeFileSync(path.join(OUT, `${layout}.scenes.json`), JSON.stringify(summary, null, 2));
  console.log(`[record] ${layout}: wrote ${outFile}`);
  return summary;
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.layout === "both") {
    for (const layout of ["wide", "tall"]) {
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--layout", layout, "--timing", opts.timing, "--method", opts.method, "--format", opts.format, "--hero", opts.hero, "--timescale", String(opts.timescale), ...(opts.uncap ? ["--uncap"] : [])], { stdio: "inherit", cwd: HERE });
      if (r.status !== 0) { console.error(`[record] ${layout} failed with status ${r.status}`); process.exit(r.status ?? 1); }
    }
    return;
  }
  const timing = JSON.parse(readFileSync(opts.timing, "utf8"));
  process.env.RECORD_TIMING = opts.timing;
  mkdirSync(OUT, { recursive: true });
  ensureHero();
  await ensurePreview();
  const server = await stageServer();
  try {
    const summary = await recordLayout(opts.layout, timing, opts.method, opts.format, opts.hero, opts.timescale, opts.uncap);
    console.log(JSON.stringify({ layout: summary.layout, method: summary.method, hero: summary.hero, smoothness: summary.smoothness && { median_gap_ms: summary.smoothness.median_gap_ms, p95_gap_ms: summary.smoothness.p95_gap_ms, fps: summary.smoothness.fps, fps_out: summary.smoothness.fps_out, duplicate_frames: summary.smoothness.duplicate_frames }, issues: summary.issues, scenes: summary.scenes.map((s) => [s.id, s.start_s, s.end_s]) }));
  } finally {
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
