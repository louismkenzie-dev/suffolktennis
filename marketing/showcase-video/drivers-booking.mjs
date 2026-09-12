// Scene choreography for the booking film (project "booking"): three clips
// cut from one continuous 101 s recording — "Getting a place" (1-5), "The QR
// ticket" (6-10) and "The diary" (11-15). record.mjs owns the stage, the
// capture and the clock; this file only says what happens on the two devices
// in each scene, to the boundaries in timing-booking.json.
//
// The rules the reports film established and this one keeps:
//  * the phone owns the pointer, the desktop is always clicked directly
//    (the phone stands in front of the desktop's lower-right corner),
//  * anything that loads — a navigation, a user switch — happens while the
//    device is NOT the scene's lead one, or behind a chapter card / the end
//    card, so no lead device is ever showing a skeleton,
//  * both() runs the two device tracks together and a desktop hiccup is
//    recorded but never fails the scene.
//
// Every beat is written as "until(scene, offset)" plus a glide of a known
// number of seconds, so the whole scene can be added up against its slot and
// nothing runs past the cut.
import { installMock } from "./mock.mjs";
import { INVITATION_TOKEN, PROGRAMME_TITLE, TODAY_SESSION_ID, TOKEN, bookAlfie, installBookingFixtures } from "./fixtures.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The phone's status bar. The recording's wall clock is shifted so t = 0 is
// 11:45:20 on the morning of the 12-2pm session, and these are the times the
// app itself then prints (the scan lands at "Arrived 11.46am"), so the status
// bar and the register never disagree.
export const CLOCK = { open: "11:45", pay: "11:45", ledger: "11:45", ticket: "11:46", door: "11:46", diary: "11:46" };
export const CLOCK_START = "11:45";

/** Which device leads each scene (stage.js holds the matching visual state). */
export const LEADS = { 1: "phone", 2: "desk", 3: "desk", 4: "desk", 6: "phone", 7: "phone", 8: "phone", 9: "desk", 11: "desk", 12: "desk", 13: "phone", 14: "desk" };

/** Text-zone copy per scene (the captions carry the narration; these are the headlines). */
const COPY = {
  1: { kicker: "Getting a place", title: "One invitation" },
  2: { kicker: "Getting a place", title: "Every session, one page" },
  3: { kicker: "Getting a place", title: "Accept. Pay. Confirmed." },
  4: { kicker: "Getting a place", title: "It lands in the ledger" },
  6: { kicker: "The QR ticket", title: "One code per session" },
  7: { kicker: "The QR ticket", title: "Green means admitted" },
  8: { kicker: "The QR ticket", title: "Already here. Or not paid." },
  9: { kicker: "The QR ticket", title: "Who is on court" },
  11: { kicker: "The diary", title: "The timetable fills itself" },
  12: { kicker: "The diary", title: "Their week against the target" },
  13: { kicker: "The diary", title: "One tap to the calendar" },
  14: { kicker: "The diary", title: "No more when and where" },
};

/** The two chapter cards, which also cover a user switch and a navigation. */
const CARD_MS = 1300;

/**
 * Everything the recorder loads before the capture starts: the booking world,
 * the parent session, the invitation email on the phone and the Parent Hub on
 * the desktop.
 */
export async function prepare({ ctx, frame, desk, app, stageUrl }) {
  installBookingFixtures();
  await installMock(ctx, { user: "parent" });
  await frame.goto(`${stageUrl}/invite-sample.html`, { waitUntil: "load" });
  await frame.getByText("Alfie Barker is invited").first().waitFor({ timeout: 15000 });
  if (desk) {
    await desk.goto(`${app}/parent-hub?tab=bookings`, { waitUntil: "domcontentloaded" });
    await desk.getByText(PROGRAMME_TITLE, { exact: false }).first().waitFor({ timeout: 20000 });
  }
}

export function drivers({ page, frame, desk, ctx, stage, human, deskHuman, clock, ts = 1, issues = [], app }) {
  const F = frame;
  const D = desk;
  const APP = app ?? "http://127.0.0.1:4173";
  const text = (t, timeout = 10000) => F.getByText(t, { exact: false }).first().waitFor({ state: "visible", timeout });
  const dtext = (t, timeout = 10000) => D.getByText(t, { exact: false }).first().waitFor({ state: "visible", timeout });
  const until = (sceneId, offsetS) => clock.untilScene(sceneId, offsetS);
  const nap = (ms) => sleep(ms * ts);
  const status = (who) => ({ status: { bg: "#ffffff", time: CLOCK[who] } });

  const both = async (phoneTrack, deskTrack) => {
    const desktop = D ? deskTrack().catch((e) => { const m = `desktop track: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`; issues.push(m); console.log(`[record] ${m}`); }) : null;
    await phoneTrack;
    if (desktop) await Promise.race([desktop, sleep(600 * ts)]);
  };
  /** A desktop track that is never waited for: it must not delay the cut. */
  const quiet = (fn) => { if (D) fn().catch((e) => { const m = `desktop track: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`; issues.push(m); console.log(`[record] ${m}`); }); };

  const cardOpaque = () => page.waitForFunction(() => getComputedStyle(document.getElementById("chapter")).opacity === "1", null, { timeout: 3000 });
  const cardGone = () => page.locator("#chapter.on").waitFor({ state: "detached", timeout: 5000 });
  const scene = (id, extra = {}) => stage("scene", id, { mode: "app", lead: LEADS[id], lines: [], ...COPY[id], ...status(extra.who ?? "open"), ...extra.opts }, ...(extra.fireAndForget ? [{ fireAndForget: true }] : []));

  /** Scroll `dy` px over exactly `secs` seconds of film time. */
  const glide = (h, dy, secs) => h.wheel(dy, Math.abs(dy) / secs);

  /** The register polls every 5 s; a visibilitychange makes it refetch now. */
  const refreshRegister = (f) => f.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))).catch(() => {});

  return {
    // ---------------- clip "place" (scenes 1-5, 0 -> 37.4 s) ----------------

    // 5.9 s. The invitation email, open on the phone. The desktop moves to the
    // booking page early, while it is the quiet device.
    1: async () => {
      await scene(1, { who: "open", opts: { enter: true } });
      await both((async () => {
        // Slow on the headline, then down into the letter itself.
        await until(1, 1.2);
        await glide(human, 200, 2.4);            // -> 3.6
        await until(1, 3.8);
        await glide(human, 320, 1.5);            // -> 5.3
      })(), () => (async () => {
        await until(1, 1.0);
        await D.goto(`${APP}/book/${INVITATION_TOKEN}`, { waitUntil: "domcontentloaded" });
        await dtext("Invitation for Alfie Barker", 15000);
      })());
    },

    // 7.9 s. The booking page on the desktop: the whole season on one page.
    2: async () => {
      await scene(2, { who: "open" });
      await both((async () => {
        await F.goto(`${APP}/book/${INVITATION_TOKEN}`, { waitUntil: "domcontentloaded" });
        await text("Invitation for Alfie Barker", 15000);
        await until(2, 3.4);
        await glide(human, 380, 2.2);            // -> 5.6
        await until(2, 5.8);
        await glide(human, 360, 1.5);            // -> 7.3
      })(), () => (async () => {
        await until(2, 0.5);
        await deskHuman.scrollInto(D.getByText("Programme sessions · all included", { exact: false }), { block: "start", ms: 900 });
        await until(2, 2.4);
        await deskHuman.tap(D.getByRole("button", { name: /Show all \d+ sessions/ }));
        await until(2, 3.6);
        await glide(deskHuman, 420, 3.0);        // -> 6.6
      })());
    },

    // 10.1 s. Accept and pay; the app's own confirmed state closes the scene.
    3: async () => {
      await scene(3, { who: "pay" });
      await both((async () => {
        await until(3, 1.4);
        await human.headingToTop(/^Book this place/);
        await until(3, 3.4);
        await human.tap(F.getByRole("checkbox").first(), { block: "center" });
        await until(3, 5.2);
        await human.scrollInto(F.getByRole("button", { name: /Continue to payment/ }), { block: "center", ms: 800 });
        await until(3, 7.6);
        await human.tap(F.getByRole("button", { name: /Continue to payment/ }));
        await human.parkMouse();
        await text("Booking confirmed", 10000);
      })(), () => (async () => {
        await until(3, 0.4);
        await deskHuman.headingToTop(/^Book this place/);
        await until(3, 2.4);
        await deskHuman.tap(D.getByRole("checkbox").first(), { block: "center" });
        await until(3, 4.2);
        await deskHuman.scrollInto(D.getByRole("button", { name: /Continue to payment/ }), { block: "center", ms: 800 });
        await until(3, 6.4);
        await deskHuman.tap(D.getByRole("button", { name: /Continue to payment/ }));
        await dtext("Booking confirmed", 10000);
      })());
    },

    // 7.5 s. A chapter card covers the switch to the county administrator and
    // the navigation; then the ledger, with the new row and the money.
    4: async () => {
      await scene(4, {
        who: "ledger", fireAndForget: true,
        opts: { chapter: { kicker: "The county's side", title: "One ledger", sub: "Every place, every payment" }, chapterMs: CARD_MS },
      });
      await cardOpaque();
      await installMock(ctx, { user: "admin" });
      await both((async () => {
        await F.goto(`${APP}/admin?tab=bookings&view=ledger`, { waitUntil: "domcontentloaded" });
        await text("Awaiting payment", 15000);
      })(), () => (async () => {
        await D.goto(`${APP}/admin?tab=bookings&view=ledger`, { waitUntil: "domcontentloaded" });
        await dtext("Awaiting payment", 15000);
      })());
      await cardGone();
      await both((async () => {
        await until(4, 2.6);
        await glide(human, 340, 2.2);            // -> 4.8
        await until(4, 5.2);
        await glide(human, 200, 1.5);            // -> 6.7
      })(), () => (async () => {
        // Stop where the money and the new row are both in frame.
        await until(4, 2.2);
        await glide(deskHuman, 300, 2.2);        // -> 4.4
        await until(4, 4.8);
        await glide(deskHuman, 140, 1.4);        // -> 6.2
      })());
    },

    // 6.0 s end card. Behind it: back to the parent, both tickets loaded.
    5: async () => {
      await stage("scene", 5, { mode: "end" });
      await nap(400);
      bookAlfie();
      await installMock(ctx, { user: "parent" });
      await both((async () => {
        await F.goto(`${APP}/ticket/${TOKEN.alfieToday}`, { waitUntil: "domcontentloaded" });
        await text("Entry code for this session", 15000);
      })(), () => (async () => {
        await D.goto(`${APP}/ticket/${TOKEN.alfieSeason}`, { waitUntil: "domcontentloaded" });
        await dtext("Show this code to be scanned on arrival", 15000);
      })());
    },

    // ---------------- clip "ticket" (scenes 6-10, 37.4 -> 70 s) ----------------

    // 6.1 s. The parent's ticket for today's session, QR and all.
    6: async () => {
      await scene(6, { who: "ticket" });
      await both((async () => {
        await until(6, 1.4);
        await glide(human, 110, 1.4);            // -> 2.8
        await until(6, 3.6);
        await glide(human, 80, 1.2);             // -> 4.8
      })(), () => (async () => {
        await until(6, 1.0);
        await glide(deskHuman, 200, 1.8);        // -> 2.8
        await until(6, 3.2);
        await deskHuman.scrollInto(D.getByText("Upcoming sessions", { exact: false }), { block: "center", ms: 900 });
      })());
    },

    // 7.6 s. A chapter card covers the switch to the coach; then the scan
    // turns green and the register behind it flips to Arrived.
    7: async () => {
      await scene(7, {
        who: "door", fireAndForget: true,
        opts: { chapter: { kicker: "At the door", title: "Scan to admit", sub: "One code, one session" }, chapterMs: CARD_MS },
      });
      await cardOpaque();
      await installMock(ctx, { user: "coach" });
      await both((async () => {
        await F.goto(`${APP}/admin/scan`, { waitUntil: "domcontentloaded" });
        await text("Enter the ticket code", 15000);
      })(), () => (async () => {
        await D.goto(`${APP}/coach/register/${TODAY_SESSION_ID}`, { waitUntil: "domcontentloaded" });
        await dtext("Isla Fraser", 15000);
      })());
      await cardGone();
      // Not awaited: the register flipping is a bonus, never a reason for the
      // scene to run long.
      quiet(async () => {
        // The moment the phone says yes, pull the register: the row flips
        // while the green panel is still on screen.
        await text("Admitted — welcome!", 12000);
        await nap(250);
        await refreshRegister(D);
        await D.getByText(/^Arrived/).first().waitFor({ timeout: 6000 });
        await until(7, 5.4);
        await deskHuman.scrollInto(D.getByText("Alfie Barker", { exact: false }), { block: "center", ms: 700 });
      });
      await until(7, 1.9);
      await human.type(F.getByPlaceholder("e.g. 3f9a…"), TOKEN.alfieToday, 45);
      await until(7, 3.4);
      await human.tap(F.getByRole("button", { name: "Check", exact: true }));
      await human.parkMouse();
      await text("Admitted — welcome!", 8000);
    },

    // 6.5 s. The same code twice, then a place that has not been paid for.
    8: async () => {
      await scene(8, { who: "door" });
      await until(8, 0.3);
      await human.type(F.getByPlaceholder("e.g. 3f9a…"), TOKEN.alfieToday, 45);
      await until(8, 1.7);
      await human.tap(F.getByRole("button", { name: "Check", exact: true }));
      await human.parkMouse();
      await text("Already scanned in", 8000);
      await until(8, 3.4);
      await human.type(F.getByPlaceholder("e.g. 3f9a…"), TOKEN.freyaToday, 45);
      await until(8, 4.8);
      await human.tap(F.getByRole("button", { name: "Check", exact: true }));
      await human.parkMouse();
      await text("Booking is not paid", 8000);
    },

    // 6.4 s. The whole register: three here, one not marked.
    9: async () => {
      await scene(9, { who: "door" });
      await both((async () => {
        await F.goto(`${APP}/coach/register/${TODAY_SESSION_ID}`, { waitUntil: "domcontentloaded" });
        await text("Isla Fraser", 15000);
        await until(9, 3.0);
        await glide(human, 150, 1.8);            // -> 4.8
      })(), () => (async () => {
        await until(9, 0.3);
        await refreshRegister(D);
        await deskHuman.scrollInto(D.getByText("3 here", { exact: false }), { block: "start", ms: 800 });
        await until(9, 3.0);
        await glide(deskHuman, 120, 1.6);        // -> 4.6
      })());
    },

    // 6.0 s end card. Behind it: back to the parent, the timetable and the
    // season ticket.
    10: async () => {
      await stage("scene", 10, { mode: "end" });
      await nap(400);
      await installMock(ctx, { user: "parent" });
      await both((async () => {
        await F.goto(`${APP}/ticket/${TOKEN.alfieSeason}`, { waitUntil: "domcontentloaded" });
        await text("Show this code to be scanned on arrival", 15000);
      })(), () => (async () => {
        await D.goto(`${APP}/parent-hub?tab=timetable`, { waitUntil: "domcontentloaded" });
        await dtext("Suffolk Tennis Sporting Timetable", 20000);
        await D.getByText("Suffolk", { exact: true }).first().waitFor({ timeout: 15000 });
        // Park the week grid in frame before the clip opens on it.
        await D.getByText("Suffolk", { exact: true }).first().evaluate((el) => el.scrollIntoView({ behavior: "instant", block: "center" })).catch(() => {});
      })());
    },

    // ---------------- clip "diary" (scenes 11-15, 70 -> 101 s) ----------------

    // 6.0 s. The week, already full of Suffolk sessions.
    11: async () => {
      await scene(11, { who: "diary" });
      await both((async () => {
        await until(11, 1.4);
        await glide(human, 150, 1.6);            // -> 3.0
      })(), () => (async () => {
        // Land the week grid in the middle of the window, whatever the
        // timetable's own scroll position was when it finished loading.
        await until(11, 0.5);
        await deskHuman.scrollInto(D.getByText("Suffolk", { exact: true }).first(), { block: "center", ms: 1000 });
        await until(11, 2.8);
        await glide(deskHuman, 120, 1.6);        // -> 4.4
      })());
    },

    // 7.3 s. Week to month, and the hours against the LTA target.
    12: async () => {
      await scene(12, { who: "diary" });
      await both((async () => {
        await until(12, 4.4);
        await glide(human, 140, 1.5);            // -> 5.9
      })(), () => (async () => {
        await until(12, 0.3);
        await deskHuman.scrollInto(D.getByRole("button", { name: "Monthly", exact: true }), { block: "center", ms: 800 });
        await until(12, 1.8);
        await deskHuman.tap(D.getByRole("button", { name: "Monthly", exact: true }));
        await dtext("Suffolk Tennis monthly summary", 8000);
        await until(12, 3.0);
        // Top of the desk viewport, so the hours and the target beside them
        // are clear of the phone standing over its lower-right corner.
        await deskHuman.scrollInto(D.getByText("Tennis Total", { exact: false }), { block: "start", ms: 900 });
        await until(12, 4.6);
        await glide(deskHuman, 240, 1.9);        // -> 6.5
      })());
    },

    // 4.4 s. One tap adds a session to the family calendar. The desktop moves
    // to the Parent Hub bookings while it is the quiet device.
    13: async () => {
      await scene(13, { who: "diary" });
      quiet(async () => {
        await until(13, 0.3);
        await D.goto(`${APP}/parent-hub?tab=bookings`, { waitUntil: "domcontentloaded" });
        await dtext("Coming up", 15000);
        await until(13, 2.8);
        await deskHuman.scrollInto(D.getByText("Coming up", { exact: false }), { block: "start", ms: 900 });
      });
      await until(13, 0.4);
      await human.scrollInto(F.getByText("Upcoming sessions", { exact: false }), { block: "start", ms: 800 });
      await until(13, 2.2);
      await human.tap(F.getByRole("link", { name: "Google", exact: true }).first(), { block: "nearest" });
      await human.parkMouse();
    },

    // 7.3 s. The Parent Hub: what is next, for whom, and where.
    14: async () => {
      await scene(14, { who: "diary" });
      await both((async () => {
        await until(14, 2.0);
        await glide(human, 150, 1.6);            // -> 3.6
      })(), () => (async () => {
        await until(14, 1.0);
        await glide(deskHuman, 140, 1.6);        // -> 2.6
        await until(14, 3.6);
        await deskHuman.scrollInto(D.getByText("Your bookings", { exact: false }), { block: "start", ms: 900 });
        await until(14, 5.4);
        await glide(deskHuman, 120, 1.2);        // -> 6.6
      })());
    },

    // 6.0 s end card.
    15: async () => {
      await stage("scene", 15, { mode: "end" });
    },
  };
}
