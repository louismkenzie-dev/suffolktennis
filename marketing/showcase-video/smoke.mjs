// Smoke test for the showcase pipeline: drives the coach flow and the parent
// flow through the real bundle against the mocked Supabase, screenshots every
// step into out/smoke/, and prints PASS/FAIL per step. Exit 1 on any failure,
// page error or visible error toast.
//
//   node smoke.mjs            (from marketing/showcase-video)
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { installMock } from "./mock.mjs";
import { alfieReports, CHILD, PROGRAMME_TITLE, VENUE } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
// Playwright comes from the repo's own node_modules (a devDependency at the root).
const { chromium } = createRequire(import.meta.url)(path.join(ROOT, "node_modules", "playwright"));
const BASE = "http://127.0.0.1:4173";
const OUT = path.join(HERE, "out", "smoke");
// Chromium: PW_CHROME overrides, else Playwright's own installed browser.
const CHROME = process.env.PW_CHROME && existsSync(process.env.PW_CHROME) ? process.env.PW_CHROME : chromium.executablePath();

/* ------------------------------------------------------------------ */
/* vite preview                                                         */
/* ------------------------------------------------------------------ */

async function up() {
  try { const r = await fetch(`${BASE}/`); return r.ok; } catch { return false; }
}

export async function ensurePreview() {
  if (await up()) return;
  const child = spawn("npx", ["vite", "preview", "--port", "4173", "--host", "127.0.0.1"], { cwd: ROOT, detached: true, stdio: "ignore" });
  child.unref();
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await up()) return;
  }
  throw new Error("vite preview did not come up on 127.0.0.1:4173");
}

/* ------------------------------------------------------------------ */
/* Harness                                                              */
/* ------------------------------------------------------------------ */

const steps = [];
const screenshots = [];
let shotNo = 0;

function makePage(ctx, label) {
  const errors = [];
  const consoleErrors = [];
  const page = ctx.newPage();
  return page.then((pg) => {
    pg.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    pg.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !/net::ERR|status of 204|WebSocket|realtime|favicon|Failed to load resource/.test(t)) consoleErrors.push(`${label}: ${t.slice(0, 200)}`);
    });
    return { page: pg, errors, consoleErrors };
  });
}

const errorToasts = (page) => page.locator("[data-sonner-toast][data-type='error'], [role='status'][aria-live] >> text=/went wrong|could not|failed/i").count();

async function shot(page, name) {
  const file = path.join(OUT, `${String(++shotNo).padStart(2, "0")}-${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push(file);
  return file;
}

async function step(name, page, fn) {
  const t0 = Date.now();
  try {
    const note = (await fn()) ?? "";
    const toasts = await errorToasts(page);
    if (toasts > 0) throw new Error(`${toasts} error toast(s) visible`);
    steps.push({ name, pass: true, note: [note, `${Date.now() - t0}ms`].filter(Boolean).join(" · ") });
    console.log(`PASS  ${name}${note ? ` — ${note}` : ""}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split("\n")[0] : String(e);
    steps.push({ name, pass: false, note: msg });
    console.log(`FAIL  ${name} — ${msg}`);
    try { await shot(page, `${name}-FAIL`); } catch { /* ignore */ }
  }
}

const expectText = async (page, text, timeout = 8000) => {
  await page.getByText(text, { exact: false }).first().waitFor({ state: "visible", timeout });
};

/** Scroll a section heading to just under the 56px top bar. */
async function scrollHeadingToTop(page, name) {
  const h = page.getByRole("heading", { name }).first();
  await h.waitFor({ timeout: 8000 });
  await h.evaluate((el) => { el.scrollIntoView({ block: "start" }); window.scrollBy(0, -72); });
  await page.waitForTimeout(250);
}

async function fontsLoaded(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const fams = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/"/g, "")));
    return { archivo: fams.has("Archivo"), hanken: fams.has("Hanken Grotesk"), families: [...fams] };
  });
}

/* ------------------------------------------------------------------ */
/* Coach flow                                                           */
/* ------------------------------------------------------------------ */

async function coachFlow(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "en-GB", timezoneId: "Europe/London" });
  await installMock(ctx, { user: "coach" });
  const { page, errors, consoleErrors } = await makePage(ctx, "coach");
  let fonts = { archivo: false, hanken: false };

  await step("coach: venues", page, async () => {
    await page.goto(`${BASE}/coach`);
    await expectText(page, VENUE, 15000);
    fonts = await fontsLoaded(page);
    await shot(page, "coach-venues");
    return `fonts archivo=${fonts.archivo} hanken=${fonts.hanken}`;
  });

  await step("coach: programmes at Culford", page, async () => {
    await page.getByText(VENUE, { exact: false }).first().click();
    await expectText(page, PROGRAMME_TITLE);
    await expectText(page, "Today");
    await shot(page, "coach-programmes");
  });

  await step("coach: sessions list", page, async () => {
    await page.getByText(PROGRAMME_TITLE, { exact: false }).first().click();
    await page.getByText("Upcoming", { exact: false }).first().waitFor({ timeout: 8000 });
    await expectText(page, "Today");
    await shot(page, "coach-sessions");
  });

  await step("coach: today's register", page, async () => {
    // ListRow renders as role=button; today's row carries the "Today" badge.
    await page.getByRole("button", { name: /Today/ }).first().click();
    await expectText(page, "Alfie Barker");
    for (const n of ["Maya Chen", "Theo Nkemelu", "Isla Fraser", "3 here", "1 not marked", "2/4 reports"]) await expectText(page, n);
    await shot(page, "coach-register");
    return "4 players · 3 here · 2/4 reports";
  });

  await step("coach: Alfie's profile sheet", page, async () => {
    await page.getByRole("button", { name: "Open Alfie Barker" }).click();
    await expectText(page, "Session report · 0/9 rated");
    await expectText(page, "Previous session");
    await expectText(page, "Hannah Barker");
    await shot(page, "coach-profile");
  });

  await step("coach: report sheet opens", page, async () => {
    await page.getByRole("button", { name: /Session report · 0\/9 rated/ }).click();
    await expectText(page, "Session report · Alfie Barker");
    await expectText(page, "Last time:");
    const groups = await page.getByRole("radiogroup").count();
    if (groups !== 9) throw new Error(`expected 9 radiogroups, saw ${groups}`);
    await shot(page, "coach-report-sheet");
    return "9 areas · previous ratings shown";
  });

  await step("coach: rate all nine areas", page, async () => {
    // A natural mix: mostly Consistent, two Excelling, one Progressing.
    const plan = {
      "Confident to Attack": "Consistent", "Comfortable in Rally": "Consistent", "Chases Every Ball": "Excelling",
      "Creative in Play": "Progressing", "Athletic Qualities": "Consistent", "Reads the Ball": "Consistent",
      "Loves the Game": "Consistent", "Loves to Compete": "Excelling", "Serving": "Consistent",
    };
    let i = 0;
    for (const [area, level] of Object.entries(plan)) {
      const radio = page.getByRole("radiogroup", { name: area }).getByRole("radio", { name: level, exact: true });
      await radio.click();
      if (await radio.getAttribute("aria-checked") !== "true") throw new Error(`${area} did not take ${level}`);
      if (++i === 4) await shot(page, "coach-rating-midway");
    }
    await expectText(page, "Complete");
    await shot(page, "coach-rated");
    return "9/9 · Complete";
  });

  await step("coach: comment", page, async () => {
    const ta = page.getByPlaceholder("What went well, what to work on…");
    await ta.scrollIntoViewIfNeeded();
    await ta.fill("Big step forward on the forehand today. Keep chasing the wide balls.");
    await shot(page, "coach-comment");
  });

  await step("coach: save report", page, async () => {
    await page.getByRole("button", { name: "Save report" }).click();
    await expectText(page, "Report complete — it goes to the parent when you end the session");
    // The report sheet closes onto the profile sheet, which now says Complete.
    await expectText(page, "Session report · Complete");
    await shot(page, "coach-profile-complete");
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden", timeout: 8000 });
    await expectText(page, "3/4 reports", 10000);
    await shot(page, "coach-saved");
    const saved = alfieReports().find((r) => r.session_id && r.complete && !r.sent_at);
    if (!saved || Object.keys(saved.ratings).length !== 9) throw new Error("mock did not store nine ratings");
    return "toast + 3/4 reports · mock stored 9 ratings";
  });

  await step("coach: end session dialog", page, async () => {
    await page.getByRole("button", { name: "End session" }).first().click();
    await expectText(page, "End session?");
    await expectText(page, "3 complete reports will be sent to parents.");
    await expectText(page, "Isla Fraser");
    await shot(page, "coach-end-dialog");
    return "3 reports to send · Isla to be marked absent";
  });

  await step("coach: confirm end session", page, async () => {
    await page.getByRole("dialog").getByRole("button", { name: "End session" }).click();
    await expectText(page, "Session ended · 1 marked absent · 3 reports sent");
    await expectText(page, "Ended", 8000);
    await page.getByText("Session ended — marks and reports can still be changed").waitFor({ timeout: 8000 });
    await shot(page, "coach-ended");
    const sent = alfieReports().filter((r) => r.sent_at).length;
    if (sent !== 6) throw new Error(`expected 6 sent reports for Alfie, saw ${sent}`);
    return "1 marked absent · 3 reports sent";
  });

  await ctx.close();
  return { errors, consoleErrors, fonts };
}

/* ------------------------------------------------------------------ */
/* Parent flow                                                          */
/* ------------------------------------------------------------------ */

async function parentFlow(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "en-GB", timezoneId: "Europe/London" });
  await installMock(ctx, { user: "parent" });
  const { page, errors, consoleErrors } = await makePage(ctx, "parent");
  let fonts = { archivo: false, hanken: false };

  await step("parent: hub with Alfie's card", page, async () => {
    await page.goto(`${BASE}/parent-hub`);
    await expectText(page, "Alfie Barker", 15000);
    await expectText(page, "Hannah");
    await page.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true }).waitFor({ timeout: 8000 });
    fonts = await fontsLoaded(page);
    const banner = await page.getByText("Finish setting up").count();
    if (banner) throw new Error("profile-completion banner visible");
    await shot(page, "parent-hub");
    return `fonts archivo=${fonts.archivo} hanken=${fonts.hanken}`;
  });

  await step("parent: Performance & Reports", page, async () => {
    await page.getByRole("button", { name: "Alfie Barker's performance & reports", exact: true }).click();
    // Park the pointer: left where it clicked, it hovers the radar and pins a tooltip.
    await page.mouse.move(2, 2);
    await expectText(page, "Performance & Reports");
    await expectText(page, "Latest report", 10000);
    await expectText(page, "6 entries");
    await expectText(page, "Sam Reid");
    await page.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
    await shot(page, "parent-reports-radar");
    return "6 entries · radar drawn";
  });

  await step("parent: trends grid", page, async () => {
    await scrollHeadingToTop(page, /^Progress over time/);
    for (const label of ["Excelling", "Consistent"]) await expectText(page, label);
    const lines = await page.locator(".recharts-line").count();
    if (lines < 9) throw new Error(`expected 9 trend lines, saw ${lines}`);
    await shot(page, "parent-trends");
    return "9 trend lines · Excelling/Consistent pills";
  });

  await step("parent: latest entry expands to nine rows", page, async () => {
    await scrollHeadingToTop(page, /^Everything/);
    await page.getByRole("button", { name: /Expand session report from/ }).first().click();
    await page.mouse.move(2, 2);
    await expectText(page, "Proactive, composed, loose");
    await expectText(page, "Big step forward on the forehand today");
    await shot(page, "parent-entry-rows");
  });

  await step("parent: open the full report", page, async () => {
    await page.getByRole("button", { name: /^Open/ }).first().scrollIntoViewIfNeeded();
    await page.getByRole("button", { name: /^Open/ }).first().click();
    await page.waitForURL(/\/report\//, { timeout: 8000 });
    await page.mouse.move(2, 2);
    await expectText(page, "Session report", 10000);
    await expectText(page, "How Alfie did");
    await expectText(page, "Coach Sam Reid");
    await page.locator("svg.recharts-surface").first().waitFor({ timeout: 8000 });
    await shot(page, "parent-report-page");
  });

  await step("parent: nine rows + comment", page, async () => {
    await scrollHeadingToTop(page, /^The nine areas/);
    const rows = await page.locator("text=/Proactive, composed, loose|Consistency, repeatable|Defending qualities|Skillfulness, chopper|Agility, balance|Anticipation, perception|Inner drive|Competitive, commitment|Grip, balance, rhythm/").count();
    if (rows < 9) throw new Error(`expected 9 area rows, saw ${rows}`);
    await expectText(page, "Excelling");
    await expectText(page, "Consistent");
    await shot(page, "parent-report-rows");
    await scrollHeadingToTop(page, /^Sam Reid's comment/);
    await expectText(page, "Big step forward on the forehand today. Keep chasing the wide balls.");
    await shot(page, "parent-report-comment");
    return "9 rows · comment";
  });

  await step("parent: report trends", page, async () => {
    await scrollHeadingToTop(page, /^Progress over time/);
    const lines = await page.locator(".recharts-line").count();
    if (lines < 9) throw new Error(`expected 9 trend lines, saw ${lines}`);
    await expectText(page, "Earlier reports");
    await shot(page, "parent-report-trends");
    return `${lines} trend lines`;
  });

  await ctx.close();
  return { errors, consoleErrors, fonts };
}

/* ------------------------------------------------------------------ */
/* Main                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  await ensurePreview();
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--disable-default-apps"],
    // Fonts go out through the agent proxy; the app itself is local and must not.
    proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" } : undefined,
    ignoreHTTPSErrors: true,
  });
  const results = [];
  try {
    results.push(await coachFlow(browser));
    results.push(await parentFlow(browser));
  } finally {
    await browser.close();
  }
  const errors = results.flatMap((r) => r.errors);
  const consoleErrors = results.flatMap((r) => r.consoleErrors);
  const fonts = results.every((r) => r.fonts.archivo && r.fonts.hanken);
  const failed = steps.filter((s) => !s.pass).length;
  console.log("");
  console.log(`steps: ${steps.length - failed}/${steps.length} passed · page errors: ${errors.length} · console errors: ${consoleErrors.length} · fonts: ${fonts ? "Archivo + Hanken Grotesk loaded" : "FALLBACK"}`);
  for (const e of errors) console.log("PAGEERROR", e);
  for (const e of consoleErrors) console.log("CONSOLE", e);
  console.log(JSON.stringify({ steps, screenshots, fonts_loaded: fonts, page_errors: errors, console_errors: consoleErrors, child: CHILD.alfie }, null, 2));
  process.exit(failed || errors.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
