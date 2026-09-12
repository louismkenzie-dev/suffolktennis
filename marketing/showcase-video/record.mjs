// Records the showcase footage: the stage page (stage/) framed around the
// real app (vite preview on 4173, Supabase mocked) is driven scene by scene
// to the clock in timing.json and captured at 1920×1080 (wide) or 1080×1920
// (tall).
//
//   node record.mjs [--layout wide|tall|both] [--timing timing.json]
//                   [--method screencast|playwright] [--format jpeg|png]
//
// The screencast is captured as JPEG quality 100 by default: PNG encoding of
// a 1080p frame inside Chromium costs ~150 ms here and starves the capture
// (6 fps); JPEG q100 keeps it at 25+ fps and the cut is yuv420p anyway.
//
// Outputs per layout: out/<layout>.webm, out/<layout>.scenes.json (actual
// scene start/end seconds), out/frames/<layout>-NN.png (a still at each
// scene midpoint) and, for the screencast method, the raw frames under
// out/frames-<layout>/.
//
// "both" runs each layout in a fresh child process so the in-memory fixture
// state (today's report is written during the coach scenes) starts clean.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, linkSync, copyFileSync, statSync, createReadStream, renameSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import http from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/home/user/suffolktennis/node_modules/playwright/index.mjs";
import { installMock } from "./mock.mjs";
import { PROGRAMME_TITLE, VENUE } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
const STAGE_DIR = path.join(HERE, "stage");
const APP = "http://127.0.0.1:4173";
const STAGE_PORT = 4174;
// Bumped to the first free port from STAGE_PORT upwards by stageServer(), so a
// stale recorder still holding 4174 cannot fail a fresh run.
let STAGE = `http://127.0.0.1:${STAGE_PORT}`;
const CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FPS = 25;
const SIZES = { wide: { width: 1920, height: 1080 }, tall: { width: 1080, height: 1920 } };

/* ------------------------------------------------------------------ */
/* CLI                                                                  */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const o = { layout: "both", timing: path.join(HERE, "timing.json"), method: "screencast", format: "jpeg" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--layout") o.layout = argv[++i];
    else if (a === "--timing") o.timing = path.resolve(argv[++i]);
    else if (a === "--method") o.method = argv[++i];
    else if (a.startsWith("--layout=")) o.layout = a.slice(9);
    else if (a.startsWith("--timing=")) o.timing = path.resolve(a.slice(9));
    else if (a.startsWith("--method=")) o.method = a.slice(9);
    else if (a === "--format") o.format = argv[++i];
    else if (a.startsWith("--format=")) o.format = a.slice(9);
  }
  if (!["jpeg", "png"].includes(o.format)) throw new Error("--format must be jpeg or png");
  if (!["wide", "tall", "both"].includes(o.layout)) throw new Error(`--layout must be wide, tall or both (got ${o.layout})`);
  if (!["screencast", "playwright"].includes(o.method)) throw new Error(`--method must be screencast or playwright`);
  return o;
}

/* ------------------------------------------------------------------ */
/* Tools                                                                */
/* ------------------------------------------------------------------ */

export function ffmpegPath() {
  try {
    const p = createRequire(import.meta.url)("ffmpeg-static");
    if (p && existsSync(p)) return p;
  } catch { /* not installed here */ }
  const fallback = "/tmp/claude-0/-home-user-suffolktennis/c5bd7322-1f33-58c2-8b7e-d417e6049455/scratchpad/ffm/node_modules/ffmpeg-static/ffmpeg";
  if (existsSync(fallback)) return fallback;
  return "ffmpeg";
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

function ensureHero() {
  const out = path.join(OUT, "hero.webm");
  if (existsSync(out) && statSync(out).size > 0) return out;
  const src = path.join(ROOT, "public", "hero-video.mov");
  console.log("[record] transcoding hero-video.mov → out/hero.webm (VP9)");
  mkdirSync(OUT, { recursive: true });
  ffmpeg(["-i", src, "-an", "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "28", "-row-mt", "1", "-cpu-used", "3", "-pix_fmt", "yuv420p", out], "hero transcode");
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
  constructor(page, dir, format = "jpeg") { this.page = page; this.dir = dir; this.format = format; this.ext = format === "png" ? "png" : "jpg"; this.frames = []; this.pending = []; this.t0 = 0; this.n = 0; }
  async start() {
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on("Page.screencastFrame", (f) => this.onFrame(f));
    const { width, height } = this.page.viewportSize();
    await this.cdp.send("Page.startScreencast", { format: this.format, ...(this.format === "jpeg" ? { quality: 100 } : {}), everyNthFrame: 1, maxWidth: width, maxHeight: height });
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
    this.frames.push({ i, t: ts - this.t0, file });
    this.pending.push(writeFile(file, Buffer.from(f.data, "base64")));
  }
  async stop() {
    try { await this.cdp.send("Page.stopScreencast"); } catch { /* closed */ }
    await Promise.all(this.pending);
    await this.cdp.detach().catch(() => {});
    return this.frames;
  }
  /** Frame on screen at time t (seconds from t0). */
  at(t) {
    let best = this.frames[0];
    for (const fr of this.frames) { if (fr.t <= t) best = fr; else break; }
    return best;
  }
}

/** Hard-link one frame per 1/FPS tick into seq/, then encode a CFR webm. */
function muxScreencast(sc, totalS, outFile, layout) {
  const seq = path.join(OUT, `seq-${layout}`);
  rmSync(seq, { recursive: true, force: true });
  mkdirSync(seq, { recursive: true });
  const ticks = Math.round(totalS * FPS);
  for (let k = 0; k < ticks; k++) {
    const fr = sc.at(k / FPS);
    linkSync(fr.file, path.join(seq, `${String(k).padStart(6, "0")}.${sc.ext}`));
  }
  console.log(`[record] ${layout}: ${sc.frames.length} captured frames → ${ticks} ticks at ${FPS} fps, encoding VP9`);
  ffmpeg(["-framerate", String(FPS), "-i", path.join(seq, `%06d.${sc.ext}`), "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "14", "-row-mt", "1", "-cpu-used", "4", "-threads", "4", "-pix_fmt", "yuv420p", "-r", String(FPS), outFile], "screencast mux");
  rmSync(seq, { recursive: true, force: true });
}

/* ------------------------------------------------------------------ */
/* Human-ish interaction helpers                                        */
/* ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TAP_GAP = 350;

export function makeHuman(page, frame, phoneCenter) {
  const last = { tap: 0 };
  /**
   * Scroll the element into view smoothly (inside the app frame, no round
   * trips) and resolve once the scroll has actually run and the element has
   * held still for three frames with nothing covering its centre.
   */
  const scrollAndSettle = (n, block) => new Promise((resolve) => {
    const rect = () => n.getBoundingClientRect();
    const hit = () => { const r = rect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!e && (e === n || n.contains(e)); };
    const y0 = rect().top;
    if (block !== "center" && hit()) return resolve({ moved: false });
    n.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
    const t0 = performance.now();
    let last = null, stillSince = 0;
    const step = () => {
      const now = performance.now();
      const y = rect().top;
      const started = Math.abs(y - y0) > 0.5 || now - t0 > 300;
      if (last === null || Math.abs(y - last) >= 0.5 || !started) stillSince = now;
      last = y;
      if ((now - stillSince >= 120 && started && hit()) || now - t0 > 1200) return resolve({ moved: Math.abs(y - y0) > 0.5, ms: Math.round(now - t0) });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  async function tap(locator, { block = "nearest", settle = 420 } = {}) {
    const t = Date.now();
    const el = locator.first();
    await el.waitFor({ state: "visible", timeout: 10000 });
    const { moved } = await el.evaluate(scrollAndSettle, block);
    await sleep(moved ? Math.max(0, settle - 200) : Math.min(settle, 120));
    const wait = TAP_GAP - (Date.now() - last.tap);
    if (wait > 0) await sleep(wait);
    // A raw pointer tap at the settled box centre. Playwright's element click
    // (forced or not) re-scrolls the target inside the cross-origin frame and
    // lands off-target once the sheet has scrolled; boundingBox() is already in
    // page coordinates, phone scale included.
    const box = await el.boundingBox();
    if (!box) throw new Error("tap: element has no box");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 40 });
    last.tap = Date.now();
    if (process.env.RECORD_DEBUG) console.log(`[tap] ${Date.now() - t}ms moved=${moved}`);
  }
  async function type(locator, text, perChar = 40) {
    await tap(locator, { block: "center" });
    await sleep(200);
    await page.keyboard.type(text, { delay: perChar });
  }
  /** Smooth wheel scroll over the phone: dy px in total, at pxPerSec, paced by the clock. */
  async function wheel(dy, pxPerSec = 320) {
    const c = phoneCenter();
    await page.mouse.move(c.x, c.y);
    const sign = Math.sign(dy);
    const total = Math.abs(dy);
    const t0 = Date.now();
    let sent = 0;
    while (sent < total) {
      const due = Math.min(total, ((Date.now() - t0) / 1000) * pxPerSec);
      const step = Math.floor(due - sent);
      // Send in >= 4 px steps, but flush whatever is left once the clock has
      // reached the end: a 1-3 px remainder must not leave this loop spinning
      // forever (it hung a whole recording in scene 8).
      if (step >= 4 || (due >= total && step > 0)) { await page.mouse.wheel(0, sign * step); sent += step; }
      else if (due >= total) break;
      else await sleep(12);
    }
  }
  /** Scroll a section heading to just under the app's 56 px top bar, smoothly. */
  async function headingToTop(name) {
    const h = frame.getByRole("heading", { name }).first();
    await h.waitFor({ timeout: 10000 });
    await h.evaluate((el) => {
      const y = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
    await sleep(700);
  }
  const parkMouse = () => page.mouse.move(4, 4);
  return { tap, type, wheel, headingToTop, parkMouse };
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

export function drivers({ page, frame, ctx, stage, human, clock }) {
  const F = frame;
  const text = (t, timeout = 10000) => F.getByText(t, { exact: false }).first().waitFor({ state: "visible", timeout });
  const until = (sceneId, offsetS) => clock.untilScene(sceneId, offsetS);

  return {
    // Hero b-roll with the title reveal. The parent hub is already loaded in the phone behind it.
    1: async () => { await stage("scene", 1); },

    // Phone slides in on the Parent Hub with Alfie's card; three tag lines.
    2: async () => {
      await stage("scene", 2);
      await until(2, 5.2);
      const card = F.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true });
      await card.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    },

    // Chapter card "FOR COACHES", then Coach Hub → Culford → programme → today's register.
    3: async () => {
      await stage("scene", 3, { fireAndForget: true });
      await installMock(ctx, { user: "coach" });
      await F.goto(`${APP}/coach`, { waitUntil: "domcontentloaded" });
      await text(VENUE, 15000);
      // Card holds 1.9 s; three taps at ~1 s intervals so the register (the
      // shot the scene is about) is on screen from ~4.5 s of the 9 s scene.
      await until(3, 2.2);
      await page.locator("#chapter.on").waitFor({ state: "detached", timeout: 5000 });
      await human.tap(F.getByText(VENUE, { exact: false }));
      await text(PROGRAMME_TITLE);
      await until(3, 3.2);
      await human.tap(F.getByText(PROGRAMME_TITLE, { exact: false }));
      await text("Upcoming");
      await until(3, 4.1);
      await human.tap(F.getByRole("button", { name: /Today/ }));
      await text("Alfie Barker");
      await text("Isla Fraser");
    },

    // Alfie → report sheet → nine ratings → comment → save.
    4: async () => {
      await stage("scene", 4);
      await until(4, 0.3);
      await human.tap(F.getByRole("button", { name: "Open Alfie Barker" }));
      await text("Session report · 0/9 rated");
      await until(4, 1.3);
      await human.tap(F.getByRole("button", { name: /Session report · 0\/9 rated/ }));
      await text("Last time:");
      await until(4, 2.2);
      for (const [area, level] of RATING_PLAN) {
        const radio = F.getByRole("radiogroup", { name: area }).getByRole("radio", { name: level, exact: true });
        await human.tap(radio, { block: "center", settle: 200 });
        if (await radio.getAttribute("aria-checked") !== "true") {
          console.log(`[record] rating ${area} did not take on the first tap; retrying`);
          await sleep(150);
          await radio.click({ timeout: 4000 }).catch((e) => console.log(`[record] retry failed: ${e.message.split("\n")[0]}`));
        }
      }
      const ta = F.getByPlaceholder("What went well, what to work on…");
      await human.type(ta, COMMENT, 40);
      await sleep(250);
      await human.tap(F.getByRole("button", { name: "Save report" }), { block: "nearest" });
      // Park the pointer: sonner pauses a toast's 4 s timer while it is
      // hovered, and the "Report complete" toast pops up right under the Save
      // button, so a parked mouse lets it clear before the End session sheet.
      await human.parkMouse();
      await text("Session report · Complete");
    },

    // Close the profile sheet, end the session, confirm, "reports sent" state.
    5: async () => {
      await stage("scene", 5);
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

    // Chapter card "FOR PARENTS", then the Parent Hub with Alfie's card and the button.
    6: async () => {
      await stage("scene", 6, { fireAndForget: true });
      await installMock(ctx, { user: "parent" });
      await F.goto(`${APP}/parent-hub`, { waitUntil: "domcontentloaded" });
      const btn = F.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true });
      await btn.waitFor({ timeout: 15000 });
      await page.locator("#chapter.on").waitFor({ state: "detached", timeout: 5000 });
      await until(6, 4.0);
      await btn.evaluate((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    },

    // Performance & Reports: radar, then the full report with the nine rows and the comment.
    7: async () => {
      await stage("scene", 7);
      await until(7, 0.4);
      await human.tap(F.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true }));
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
    },

    // Progress over time: slow scroll through the trend grid.
    8: async () => {
      await stage("scene", 8);
      await until(8, 0.3);
      await human.headingToTop(/^Progress over time/);
      await until(8, 1.6);
      await human.wheel(760, 125);
      await human.parkMouse();
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

async function recordLayout(layout, timing, method, format) {
  const size = SIZES[layout];
  const total = timing.total_s ?? timing.scenes.reduce((m, s) => Math.max(m, s.start_s + s.duration_s), 0);
  mkdirSync(path.join(OUT, "frames"), { recursive: true });
  const videoDir = path.join(OUT, `video-${layout}`);
  rmSync(videoDir, { recursive: true, force: true });

  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--disable-default-apps", "--autoplay-policy=no-user-gesture-required", "--hide-scrollbars"],
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" } : undefined,
    ignoreHTTPSErrors: true,
  });
  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: 1, hasTouch: true, locale: "en-GB", timezoneId: "Europe/London",
    ...(method === "playwright" ? { recordVideo: { dir: videoDir, size } } : {}),
  });
  // No action may wait forever: a stuck locator must fail the scene, not the recording.
  ctx.setDefaultTimeout(12000);
  const issues = [];
  await installMock(ctx, { user: "parent" });
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
  await page.mouse.move(4, 4);
  await sleep(400);

  const phoneBox = await page.locator("#phone").boundingBox();
  const phoneCenter = () => ({ x: phoneBox.x + phoneBox.width / 2, y: phoneBox.y + phoneBox.height / 2 });
  const stage = async (fn, ...args) => {
    const fire = args.length && args[args.length - 1]?.fireAndForget;
    if (fire) args = args.slice(0, -1);
    return page.evaluate(([fn, args, fire]) => { const r = window.stage[fn](...args); return fire ? undefined : r; }, [fn, args, !!fire]);
  };

  // Recording clock: t0 is the moment scene 1 is called.
  let t0 = 0;
  const clock = {
    now: () => (Date.now() - t0) / 1000,
    untilT: async (t) => { const ms = t0 + t * 1000 - Date.now(); if (ms > 0) await sleep(ms); },
    untilScene: (id, off) => { const s = timing.scenes.find((x) => x.id === id); return clock.untilT(s.start_s + off); },
  };
  const human = makeHuman(page, frame, phoneCenter);
  const D = drivers({ page, frame, ctx, stage, human, clock });

  let sc = null;
  if (method === "screencast") { sc = new Screencast(page, path.join(OUT, `frames-${layout}`), format); await sc.start(); t0 = sc.t0 * 1000; }
  else t0 = Date.now();

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
      midTimers.push(new Promise((resolve) => setTimeout(async () => { try { await page.screenshot({ path: file }); stills.push(file); } catch (e) { issues.push(`still ${scene.id}: ${e.message}`); } resolve(); }, Math.max(0, t0 + mid * 1000 - Date.now()))));
    }
    let error = null;
    // Hard deadline per scene: a driver that hangs (a stuck input ack, a
    // locator that never resolves) fails its own scene at end + 3 s instead of
    // stalling the whole recording; the clock keeps running for the rest.
    const deadlineMs = t0 + (end_target + 3) * 1000 - Date.now();
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
  if (sc) {
    const frames = await sc.stop();
    await ctx.close();
    await browser.close();
    muxScreencast(sc, total, outFile, layout);
    for (const scene of timing.scenes) {
      const fr = sc.at(scene.start_s + scene.duration_s / 2);
      const file = path.join(OUT, "frames", `${layout}-${String(scene.id).padStart(2, "0")}.png`);
      if (sc.ext === "png") copyFileSync(fr.file, file); else ffmpeg(["-i", fr.file, file], `still ${scene.id}`);
      stills.push(file);
    }
    // Per-scene capture rate, so a starved screencast is visible in the summary.
    for (const a of actual) {
      const n = frames.filter((f) => f.t >= a.target_start_s && f.t < a.target_end_s).length;
      a.captured_fps = +(n / (a.target_end_s - a.target_start_s)).toFixed(1);
    }
    writeFileSync(path.join(OUT, `${layout}.frames.json`), JSON.stringify({ format: sc.format, t0: sc.t0, frames: frames.map((f) => [f.i, +f.t.toFixed(3)]) }));
    console.log(`[record] ${layout}: ${frames.length} frames captured (${(frames.length / total).toFixed(1)} fps average; per scene ${actual.map((a) => `${a.id}:${a.captured_fps}`).join(" ")})`);
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

  const summary = { layout, method, format: method === "screencast" ? format : "webm(vp8)", size, fps: FPS, total_s: total, lead_s: leadS, timing: path.basename(process.env.RECORD_TIMING ?? "timing.json"), scenes: actual, stills: stills.sort(), issues, recorded_at: new Date().toISOString() };
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
      const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--layout", layout, "--timing", opts.timing, "--method", opts.method, "--format", opts.format], { stdio: "inherit", cwd: HERE });
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
    const summary = await recordLayout(opts.layout, timing, opts.method, opts.format);
    console.log(JSON.stringify({ layout: summary.layout, method: summary.method, issues: summary.issues, scenes: summary.scenes.map((s) => [s.id, s.start_s, s.end_s]) }));
  } finally {
    server.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
