// Smoke test for the booking film's fixtures: walks every page the three
// clips show (invitation email, booking page, confirmation, admin ledger,
// tickets, scanner, register, timetable, Parent Hub bookings) against the
// mocked Supabase and screenshots each one into out-booking/smoke/.
//
//   node smoke-booking.mjs            (from marketing/showcase-video)
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { installMock } from "./mock.mjs";
import { INVITATION_TOKEN, TODAY_SESSION_ID, TOKEN, installBookingFixtures, londonEpoch, TODAY } from "./fixtures.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const { chromium } = createRequire(import.meta.url)(path.join(ROOT, "node_modules", "playwright"));
const APP = "http://127.0.0.1:4173";
const OUT = path.join(HERE, "out-booking", "smoke");
// Same resolution as record.mjs: PW_CHROME, else Playwright's registered
// build, else any chromium-* build in the same browsers folder.
const { resolveChrome } = await import("./record.mjs");
const CHROME = resolveChrome();

async function up() { try { return (await fetch(`${APP}/`)).ok; } catch { return false; } }
async function ensurePreview() {
  if (await up()) return;
  spawn("npx", ["vite", "preview", "--port", "4173", "--host", "127.0.0.1"], { cwd: ROOT, detached: true, stdio: "ignore" }).unref();
  for (let i = 0; i < 60; i++) { await new Promise((r) => setTimeout(r, 500)); if (await up()) return; }
  throw new Error("vite preview did not come up");
}

/** A tiny server for stage/invite-sample.html, the way record.mjs serves it. */
function stageServer(port = 4184) {
  const server = http.createServer((req, res) => {
    const file = path.join(HERE, "stage", path.basename(new URL(req.url, "http://x").pathname));
    if (!existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(require("node:fs").readFileSync(file));
  });
  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve(server)));
}
const require = createRequire(import.meta.url);

const fails = [];
let n = 0;
async function shot(page, name) {
  await page.waitForTimeout(400);
  const file = path.join(OUT, `${String(++n).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file });
  console.log(`  shot ${path.relative(HERE, file)}`);
}
async function step(name, fn) {
  try { await fn(); console.log(`PASS  ${name}`); }
  catch (e) { fails.push(`${name}: ${e instanceof Error ? e.message.split("\n")[0] : e}`); console.log(`FAIL  ${name} — ${e}`); }
}

installBookingFixtures();
await ensurePreview();
const stage = await stageServer();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run", "--disable-default-apps", "--hide-scrollbars"],
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: "127.0.0.1,localhost" } : undefined,
  ignoreHTTPSErrors: true,
});

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-GB", timezoneId: "Europe/London" });
await installMock(desktop, { user: "parent", clockOffsetMs: londonEpoch(TODAY, "11:40") - Date.now() });
const dpage = await desktop.newPage();
dpage.on("pageerror", (e) => fails.push(`pageerror: ${e.message.slice(0, 160)}`));

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "en-GB", timezoneId: "Europe/London" });
await installMock(phone, { user: "parent", clockOffsetMs: londonEpoch(TODAY, "11:40") - Date.now() });
const ppage = await phone.newPage();
ppage.on("pageerror", (e) => fails.push(`pageerror(phone): ${e.message.slice(0, 160)}`));

await step("invitation email", async () => {
  await ppage.goto("http://127.0.0.1:4184/invite-sample.html", { waitUntil: "load" });
  await ppage.getByText("Alfie Barker is invited").first().waitFor({ timeout: 10000 });
  const broken = await ppage.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
  if (broken.length) throw new Error(`broken images: ${broken.join(", ")}`);
  await shot(ppage, "invite-email");
});

await step("booking page (desktop)", async () => {
  await dpage.goto(`${APP}/book/${INVITATION_TOKEN}`, { waitUntil: "domcontentloaded" });
  await dpage.getByText("Invitation for Alfie Barker").first().waitFor({ timeout: 15000 });
  await dpage.getByText("Programme sessions · all included").first().waitFor({ timeout: 5000 });
  await shot(dpage, "booking-page");
  await dpage.getByRole("button", { name: /Show all \d+ sessions/ }).click();
  await dpage.getByRole("heading", { name: /Book this place/ }).scrollIntoViewIfNeeded();
  await shot(dpage, "booking-form");
});

await step("accept & pay -> confirmed", async () => {
  await dpage.getByRole("checkbox").first().click();
  await dpage.getByRole("button", { name: /Continue to payment/ }).click();
  await dpage.getByText("Booking confirmed").first().waitFor({ timeout: 10000 });
  await shot(dpage, "confirmed");
});

await step("admin ledger", async () => {
  await installMock(desktop, { user: "admin" });
  await dpage.goto(`${APP}/admin?tab=bookings&view=ledger`, { waitUntil: "domcontentloaded" });
  await dpage.getByText("Awaiting payment").first().waitFor({ timeout: 15000 });
  await shot(dpage, "ledger-top");
  await dpage.getByRole("heading", { name: /All bookings/ }).scrollIntoViewIfNeeded();
  await shot(dpage, "ledger-rows");
});

await step("session ticket (phone)", async () => {
  await ppage.goto(`${APP}/ticket/${TOKEN.alfieToday}`, { waitUntil: "domcontentloaded" });
  await ppage.getByText("Entry code for this session").first().waitFor({ timeout: 15000 });
  await shot(ppage, "ticket-session");
});

await step("season ticket + add to calendar", async () => {
  await ppage.goto(`${APP}/ticket/${TOKEN.alfieSeason}`, { waitUntil: "domcontentloaded" });
  await ppage.getByText("Show this code to be scanned on arrival").first().waitFor({ timeout: 15000 });
  await ppage.getByText("Upcoming sessions").first().scrollIntoViewIfNeeded();
  await shot(ppage, "ticket-season");
});

await step("scanner: admitted, duplicate, unpaid", async () => {
  await installMock(phone, { user: "coach" });
  await ppage.goto(`${APP}/admin/scan`, { waitUntil: "domcontentloaded" });
  await ppage.getByPlaceholder("e.g. 3f9a…").waitFor({ timeout: 15000 });
  for (const [token, expect, name] of [
    [TOKEN.alfieToday, "Admitted — welcome!", "scan-admitted"],
    [TOKEN.alfieToday, "Already scanned in", "scan-duplicate"],
    [TOKEN.freyaToday, "Booking is not paid", "scan-unpaid"],
  ]) {
    await ppage.getByPlaceholder("e.g. 3f9a…").fill(token);
    await ppage.getByRole("button", { name: "Check", exact: true }).click();
    await ppage.getByText(expect).first().waitFor({ timeout: 8000 });
    await shot(ppage, name);
  }
});

await step("register (desktop)", async () => {
  await installMock(desktop, { user: "coach" });
  await dpage.goto(`${APP}/coach/register/${TODAY_SESSION_ID}`, { waitUntil: "domcontentloaded" });
  await dpage.getByText("Isla Fraser").first().waitFor({ timeout: 15000 });
  await dpage.getByText("3 here").first().waitFor({ timeout: 8000 });
  await shot(dpage, "register");
});

await step("sporting timetable", async () => {
  await installMock(desktop, { user: "parent" });
  await dpage.goto(`${APP}/parent-hub?tab=timetable`, { waitUntil: "domcontentloaded" });
  await dpage.getByText("Suffolk Tennis Sporting Timetable").first().waitFor({ timeout: 20000 });
  await dpage.getByText("Total Tennis Hours").first().waitFor({ timeout: 10000 });
  await shot(dpage, "timetable-week");
  await dpage.getByRole("button", { name: "Monthly", exact: true }).click();
  await dpage.getByText("Suffolk Tennis monthly summary").first().waitFor({ timeout: 8000 });
  await shot(dpage, "timetable-month");
});

await step("parent hub bookings", async () => {
  await dpage.goto(`${APP}/parent-hub?tab=bookings`, { waitUntil: "domcontentloaded" });
  await dpage.getByText("Coming up").first().waitFor({ timeout: 15000 });
  await shot(dpage, "parent-bookings");
});

await browser.close();
stage.close();
console.log(fails.length ? `\n${fails.length} FAILURE(S):\n${fails.map((f) => `  - ${f}`).join("\n")}` : "\nall booking smoke steps passed");
process.exit(fails.length ? 1 : 0);
