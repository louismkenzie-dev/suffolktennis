// The fictional world for the showcase video: one programme at Culford, coach
// Sam Reid, four 12U players, and Hannah Barker (Alfie's mum) as the parent.
// Every date is relative to today (Europe/London) so "today's session" is
// always today. Everything here is invented; nobody in it is real.
//
// Exports: tables `T` (mutable, in-memory), `USERS`, `authSession(which)`,
// `functionResponse(name, body, user)` and `rpcResponse(fn, args, user)`.
// mock.mjs routes the Supabase host onto these.

export const REF = "twtmkvorzpvwnznqzcrw";
export const STORAGE_KEY = `sb-${REF}-auth-token`;

/* ------------------------------------------------------------------ */
/* Dates: everything on the Europe/London wall clock                    */
/* ------------------------------------------------------------------ */

const LONDON = "Europe/London";
const partsFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const londonParts = (d) => {
  const get = (t) => partsFmt.formatToParts(d).find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
};

/** Today's date in London, "YYYY-MM-DD". */
export const londonToday = () => londonParts(new Date()).date;

/** "YYYY-MM-DD" + n days. */
export function addDays(ymd, n) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** The instant whose London wall clock reads `ymd` `hh:mm`, as ISO. */
export function londonIso(ymd, hhmm) {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const naive = Date.UTC(y, m - 1, d, h, mi);
  for (const offsetMin of [60, 0, 120]) {
    const cand = new Date(naive - offsetMin * 60000);
    const p = londonParts(cand);
    if (p.date === ymd && p.time === hhmm.padStart(5, "0")) return cand.toISOString();
  }
  return new Date(naive).toISOString();
}

export const TODAY = londonToday();
const pad2 = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/* Ids                                                                  */
/* ------------------------------------------------------------------ */

export const COACH_ID = "c0ac0000-0000-4000-8000-000000000001";
export const PARENT_ID = "9a4e0000-0000-4000-8000-000000000001";
const PARENT_CHEN = "9a4e0000-0000-4000-8000-000000000002";
const PARENT_NKEMELU = "9a4e0000-0000-4000-8000-000000000003";
const PARENT_FRASER = "9a4e0000-0000-4000-8000-000000000004";

export const EVENT_ID = "e0e00000-0000-4000-8000-000000000001";
export const EVENT_10U_ID = "e0e00000-0000-4000-8000-000000000002";
export const SESSION_COUNT = 11;
/** Today's session is the sixth of eleven (index 5). */
export const TODAY_INDEX = 5;
export const sessionId = (i) => `5e550000-0000-4000-8000-0000000000${pad2(i + 1)}`;
export const TODAY_SESSION_ID = sessionId(TODAY_INDEX);
const session10uId = (i) => `5e550000-0000-4000-8000-0000000001${pad2(i + 1)}`;

export const CHILD = {
  alfie: "c41d0000-0000-4000-8000-000000000001",
  maya: "c41d0000-0000-4000-8000-000000000002",
  theo: "c41d0000-0000-4000-8000-000000000003",
  isla: "c41d0000-0000-4000-8000-000000000004",
};
export const BOOKING = {
  alfie: "b00c0000-0000-4000-8000-000000000001",
  maya: "b00c0000-0000-4000-8000-000000000002",
  theo: "b00c0000-0000-4000-8000-000000000003",
  isla: "b00c0000-0000-4000-8000-000000000004",
};
const reportId = (sessionIdx, playerIdx) => `4e900000-0000-4000-8000-0000000${pad2(sessionIdx)}${pad2(playerIdx)}`;
const attendanceId = (sessionIdx, playerIdx) => `a77e0000-0000-4000-8000-0000000${pad2(sessionIdx)}${pad2(playerIdx)}`;

/* ------------------------------------------------------------------ */
/* People                                                               */
/* ------------------------------------------------------------------ */

export const USERS = {
  coach: { id: COACH_ID, email: "sam.reid@example.com", first_name: "Sam", last_name: "Reid" },
  parent: { id: PARENT_ID, email: "hannah.barker@example.com", first_name: "Hannah", last_name: "Barker" },
};

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

/** A supabase-js session for localStorage. The JWT is unsigned; nothing verifies it. */
export function authSession(which = "coach") {
  const u = USERS[which];
  if (!u) throw new Error(`Unknown user "${which}"`);
  const exp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
  const full_name = `${u.first_name} ${u.last_name}`;
  const user = {
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
    email_confirmed_at: "2026-01-10T09:00:00.000Z", created_at: "2026-01-10T09:00:00.000Z", updated_at: "2026-01-10T09:00:00.000Z",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { first_name: u.first_name, last_name: u.last_name, full_name },
    identities: [],
  };
  const access_token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: u.id, email: u.email, role: "authenticated", aud: "authenticated", exp })}.mock`;
  return { access_token, refresh_token: `mock-refresh-${which}`, token_type: "bearer", expires_in: 30 * 24 * 3600, expires_at: exp, user };
}

const PLAYERS = [
  { key: "alfie", name: "Alfie Barker", dob: "2014-08-22", gender: "boy", parent: PARENT_ID, parent_name: "Hannah Barker", parent_email: USERS.parent.email, phone: "07700 900311", btm: "10844291" },
  { key: "maya", name: "Maya Chen", dob: "2014-05-03", gender: "girl", parent: PARENT_CHEN, parent_name: "Wei Chen", parent_email: "wei.chen@example.com", phone: "07700 900412", btm: "10851137" },
  { key: "theo", name: "Theo Nkemelu", dob: "2014-11-19", gender: "boy", parent: PARENT_NKEMELU, parent_name: "Grace Nkemelu", parent_email: "grace.nkemelu@example.com", phone: "07700 900523", btm: "10839904" },
  { key: "isla", name: "Isla Fraser", dob: "2014-02-27", gender: "girl", parent: PARENT_FRASER, parent_name: "Callum Fraser", parent_email: "callum.fraser@example.com", phone: "07700 900634", btm: "10862218" },
];

/* ------------------------------------------------------------------ */
/* The programme                                                        */
/* ------------------------------------------------------------------ */

export const VENUE = "Culford Sports & Tennis Centre";
export const PROGRAMME_TITLE = "Suffolk 12U County Training";
const FIRST_SESSION = addDays(TODAY, -7 * TODAY_INDEX);
export const sessionDate = (i) => addDays(FIRST_SESSION, 7 * i);

// The 10U programme exists only so the coach's venue list has more than one
// row. Nobody is booked on it and the video never opens it.
const VENUE_10U = "Ipswich Sports Club";
const first10u = addDays(TODAY, ((3 - new Date(TODAY + "T12:00:00Z").getUTCDay() + 7) % 7) - 28); // Wednesdays
const session10uDate = (i) => addDays(first10u, 7 * i);

/* ------------------------------------------------------------------ */
/* Ratings: 1 Excelling · 2 Consistent · 3 Progressing · 4 Next Step   */
/* ------------------------------------------------------------------ */

export const AREAS = [
  "Confident to Attack", "Comfortable in Rally", "Chases Every Ball", "Creative in Play", "Athletic Qualities",
  "Reads the Ball", "Loves the Game", "Loves to Compete", "Serving",
];

// Alfie, sessions one to five: a believable climb. Serving 4→2, Confident to
// Attack 3→2, Loves to Compete 1 throughout, the rest drifting 3→2.
const ALFIE_TREND = {
  "Confident to Attack": [3, 3, 2, 2, 2],
  "Comfortable in Rally": [3, 3, 3, 2, 2],
  "Chases Every Ball": [3, 2, 2, 2, 2],
  "Creative in Play": [3, 3, 3, 3, 2],
  "Athletic Qualities": [3, 3, 2, 2, 2],
  "Reads the Ball": [3, 3, 3, 3, 2],
  "Loves the Game": [3, 2, 2, 2, 2],
  "Loves to Compete": [1, 1, 1, 1, 1],
  "Serving": [4, 3, 3, 2, 2],
};
const ALFIE_COMMENTS = [
  "First session with the squad. Alfie settled quickly and rallied well from the baseline. Serve rhythm is the first thing we will work on.",
  "Much more willing to come forward this week. Second serve still needs a higher toss.",
  "Serve toss was steadier and the first serve found the box far more often. Great attitude in the point-play games.",
  "Alfie chased everything down today and stayed calm when behind. Serving is now consistent.",
  "Found some real variety today; the drop shot came off twice. Keep reading the ball early.",
];
const ALFIE_NOTES = [
  { "Serving": "Toss drifting behind the head; we worked on a still toss arm." },
  {},
  { "Serving": "Much steadier toss. Aim for the same rhythm every time." },
  {},
  { "Creative in Play": "Two lovely drop shots in the point play." },
];

// The other three: steady, slightly different shapes so the register and
// the session counts look lived-in.
const OTHER_TRENDS = {
  maya: { "Confident to Attack": [2, 2, 2, 1, 1], "Comfortable in Rally": [2, 2, 2, 2, 2], "Chases Every Ball": [3, 3, 2, 2, 2], "Creative in Play": [2, 2, 2, 2, 2], "Athletic Qualities": [2, 2, 2, 2, 1], "Reads the Ball": [3, 2, 2, 2, 2], "Loves the Game": [1, 1, 1, 1, 1], "Loves to Compete": [2, 2, 2, 1, 1], "Serving": [3, 3, 2, 2, 2] },
  theo: { "Confident to Attack": [2, 2, 2, 2, 2], "Comfortable in Rally": [3, 3, 3, 2, 2], "Chases Every Ball": [2, 2, 1, 1, 1], "Creative in Play": [3, 3, 3, 3, 3], "Athletic Qualities": [1, 1, 1, 1, 1], "Reads the Ball": [2, 2, 2, 2, 2], "Loves the Game": [2, 2, 2, 2, 2], "Loves to Compete": [2, 2, 2, 2, 1], "Serving": [3, 3, 3, 3, 2] },
  isla: { "Confident to Attack": [3, 3, 3, 3, 2], "Comfortable in Rally": [2, 2, 2, 2, 2], "Chases Every Ball": [2, 2, 2, 2, 2], "Creative in Play": [2, 2, 2, 2, 2], "Athletic Qualities": [3, 3, 3, 2, 2], "Reads the Ball": [2, 2, 2, 2, 2], "Loves the Game": [2, 2, 2, 2, 2], "Loves to Compete": [3, 3, 2, 2, 2], "Serving": [3, 3, 3, 3, 3] },
};
const OTHER_COMMENTS = {
  maya: ["Sharp from the first ball. Keep the follow-through long on the backhand.", "Won most of the rally games. Serve toss is getting more consistent.", "Great movement to the wide balls today.", "Attacked short balls with real confidence.", "Excellent session; volleys are coming on nicely."],
  theo: ["Fast around the court and never gives up on a ball.", "Rally tolerance improving week on week.", "Good energy; keep the racket head up on the backhand.", "Competed hard in the tie-breaks. Serve toss still a little low.", "Best serving day so far."],
  isla: ["Composed and consistent from the baseline.", "Starting to step in on short balls; keep going.", "Great attitude in the competition games.", "Athletic work paying off; much quicker to the ball.", "Steady session. Serve is the next big step."],
};
// Who missed which of the five past sessions (attendance and no report).
const ABSENT = { alfie: [], maya: [], theo: [2], isla: [3] };

const ratingsAt = (trend, i) => Object.fromEntries(AREAS.map((a) => [a, trend[a][i]]));

/* ------------------------------------------------------------------ */
/* Tables                                                               */
/* ------------------------------------------------------------------ */

const profileRow = (user_id, first_name, last_name, phone, city, postcode, extra = {}) => ({
  user_id, first_name, last_name, phone: null, primary_phone: phone, secondary_phone: null,
  address_line1: extra.address ?? "12 Orchard Way", address_line2: null, address_city: city, address_postcode: postcode,
  plays_tennis: extra.plays_tennis ?? false, playing_ability: null, parent_notes: null, player_name: null, player_age_group: null,
  newsletter_subscribed: true, sponsorship_interest: false, sponsorship_company: null, sponsorship_details: null,
  created_at: "2026-01-10T09:00:00.000Z", updated_at: "2026-08-30T10:00:00.000Z",
});

const childRow = (p, i) => ({
  id: CHILD[p.key], parent_user_id: p.parent, name: p.name, date_of_birth: p.dob, gender: p.gender, btm_number: p.btm,
  county_rank: p.key === "alfie" ? 14 : null, national_rank: p.key === "alfie" ? 236 : null,
  // No favourite player: a real professional's name has no place in the film.
  favorite_player: null, favorite_shot: p.key === "alfie" ? "Forehand" : null,
  handedness: "right", has_medical_needs: false, has_send_needs: false, medical_conditions: [], medical_details: null,
  send_conditions: [], send_details: null,
  description: p.key === "alfie" ? "Loves a long rally and never stops chasing. Working on the serve this term." : null,
  medical_needs: null, photo_url: null, home_club: null, country: "GB",
  created_at: `2026-02-${pad2(3 + i)}T18:30:00.000Z`, updated_at: "2026-08-30T10:00:00.000Z",
});

const sessionRow = (i) => ({
  id: sessionId(i), event_id: EVENT_ID, session_date: sessionDate(i), start_time: "12:00:00", end_time: "14:00:00",
  venue: VENUE, cancelled_at: null, cancel_reason: null, moved_from_date: null, moved_from_start: null, moved_at: null,
  ended_at: i < TODAY_INDEX ? londonIso(sessionDate(i), "14:04") : null,
  created_at: "2026-08-20T09:00:00.000Z",
});

const bookingRow = (p, i) => ({
  id: BOOKING[p.key], event_id: EVENT_ID, invitation_id: null, parent_user_id: p.parent, parent_name: p.parent_name,
  parent_email: p.parent_email, parent_phone: p.phone, child_id: CHILD[p.key], child_name: p.name, child_dob: p.dob,
  medical_notes: null, status: "paid", amount_pence: 27500, session_slot: null, paid_at: `2026-08-${pad2(24 + i)}T19:12:00.000Z`,
  membership_id: null, complimentary: false, created_at: `2026-08-${pad2(24 + i)}T19:10:00.000Z`,
});

function buildAttendance() {
  const rows = [];
  PLAYERS.forEach((p, pi) => {
    for (let s = 0; s < TODAY_INDEX; s++) {
      const absent = ABSENT[p.key].includes(s);
      rows.push({
        id: attendanceId(s, pi), booking_id: BOOKING[p.key], event_id: EVENT_ID, session_id: sessionId(s), child_id: CHILD[p.key],
        status: absent ? "absent" : "arrived", source: absent ? "auto" : "scan",
        marked_at: londonIso(sessionDate(s), absent ? "14:04" : `11:${48 + pi * 3}`), marked_by: absent ? null : COACH_ID,
        absence_notified_at: absent ? londonIso(sessionDate(s), "14:05") : null,
      });
    }
  });
  // Today: Alfie, Maya and Theo scanned in at the gate; Isla not yet marked.
  ["alfie", "maya", "theo"].forEach((key, i) => {
    const pi = PLAYERS.findIndex((p) => p.key === key);
    rows.push({
      id: attendanceId(TODAY_INDEX, pi), booking_id: BOOKING[key], event_id: EVENT_ID, session_id: TODAY_SESSION_ID, child_id: CHILD[key],
      status: "arrived", source: "scan", marked_at: londonIso(TODAY, `11:${52 + i * 3}`), marked_by: COACH_ID, absence_notified_at: null,
    });
  });
  return rows;
}

function buildReports() {
  const rows = [];
  PLAYERS.forEach((p, pi) => {
    const trend = p.key === "alfie" ? ALFIE_TREND : OTHER_TRENDS[p.key];
    for (let s = 0; s < TODAY_INDEX; s++) {
      if (ABSENT[p.key].includes(s)) continue;
      const written = londonIso(sessionDate(s), `13:${40 + pi * 4}`);
      rows.push({
        id: reportId(s, pi), booking_id: BOOKING[p.key], event_id: EVENT_ID, session_id: sessionId(s), child_id: CHILD[p.key],
        child_name: p.name, coach_id: COACH_ID, coach_name: "Sam Reid", stats: {},
        ratings: ratingsAt(trend, s), area_notes: p.key === "alfie" ? ALFIE_NOTES[s] : {},
        comment: p.key === "alfie" ? ALFIE_COMMENTS[s] : OTHER_COMMENTS[p.key][s],
        complete: true, sent_at: londonIso(sessionDate(s), "14:04"), notified_at: londonIso(sessionDate(s), "14:04"),
        created_at: written, updated_at: written,
      });
    }
  });
  // Today: Sam has already finished Maya's and Theo's; Alfie's starts empty.
  for (const key of ["maya", "theo"]) {
    const pi = PLAYERS.findIndex((p) => p.key === key);
    const p = PLAYERS[pi];
    const trend = OTHER_TRENDS[key];
    const written = londonIso(TODAY, `12:${38 + pi * 4}`);
    rows.push({
      id: reportId(TODAY_INDEX, pi), booking_id: BOOKING[key], event_id: EVENT_ID, session_id: TODAY_SESSION_ID, child_id: CHILD[key],
      child_name: p.name, coach_id: COACH_ID, coach_name: "Sam Reid", stats: {},
      ratings: ratingsAt(trend, 4), area_notes: {}, comment: key === "maya" ? "Another strong week. The slice backhand is becoming a weapon." : "Served with real rhythm today. Keep the toss out in front.",
      complete: true, sent_at: null, notified_at: null, created_at: written, updated_at: written,
    });
  }
  return rows;
}

export const T = {
  user_roles: [{ user_id: COACH_ID, role: "coach" }],
  profiles: [
    profileRow(COACH_ID, "Sam", "Reid", "07700 900201", "Bury St Edmunds", "IP33 1AA", { address: "4 Abbeygate Street", plays_tennis: true }),
    profileRow(PARENT_ID, "Hannah", "Barker", "07700 900311", "Bury St Edmunds", "IP28 6TX", { address: "12 Orchard Way" }),
    profileRow(PARENT_CHEN, "Wei", "Chen", "07700 900412", "Ipswich", "IP4 2QL", { address: "9 Henley Road" }),
    profileRow(PARENT_NKEMELU, "Grace", "Nkemelu", "07700 900523", "Newmarket", "CB8 8JQ", { address: "27 Exning Road" }),
    profileRow(PARENT_FRASER, "Callum", "Fraser", "07700 900634", "Stowmarket", "IP14 1BD", { address: "3 Milton Road" }),
  ],
  children: PLAYERS.map(childRow),
  events: [
    {
      id: EVENT_ID, title: PROGRAMME_TITLE, description: "Weekly county squad training for selected 12U players.",
      event_date: londonIso(FIRST_SESSION, "12:00"), location: VENUE, age_group: "12U", capacity: 8, visibility: "private",
      programme_type: "programme", price_pence: 27500, is_free: false, meeting_cadence: "weekly", sign_up_enabled: false,
      cancelled_at: null, programme_months: null, event_type: "county-training", poster_url: null, featured: false, cost: "£275",
      session_slots: null, register_closed_at: null, created_at: "2026-08-20T09:00:00.000Z",
    },
    {
      id: EVENT_10U_ID, title: "Suffolk 10U County Training", description: "Weekly county squad training for selected 10U players.",
      event_date: londonIso(session10uDate(0), "16:30"), location: VENUE_10U, age_group: "10U", capacity: 8, visibility: "private",
      programme_type: "programme", price_pence: 25000, is_free: false, meeting_cadence: "weekly", sign_up_enabled: false,
      cancelled_at: null, programme_months: null, event_type: "county-training", poster_url: null, featured: false, cost: "£250",
      session_slots: null, register_closed_at: null, created_at: "2026-08-20T09:00:00.000Z",
    },
  ],
  event_sessions: [
    ...Array.from({ length: SESSION_COUNT }, (_, i) => sessionRow(i)),
    ...Array.from({ length: 10 }, (_, i) => ({
      id: session10uId(i), event_id: EVENT_10U_ID, session_date: session10uDate(i), start_time: "16:30:00", end_time: "18:00:00",
      venue: VENUE_10U, cancelled_at: null, cancel_reason: null, moved_from_date: null, moved_from_start: null, moved_at: null,
      ended_at: session10uDate(i) < TODAY ? londonIso(session10uDate(i), "18:03") : null, created_at: "2026-08-20T09:00:00.000Z",
    })),
  ],
  event_coaches: [
    { event_id: EVENT_ID, user_id: COACH_ID, created_at: "2026-08-20T09:05:00.000Z" },
    { event_id: EVENT_10U_ID, user_id: COACH_ID, created_at: "2026-08-20T09:05:00.000Z" },
  ],
  bookings: PLAYERS.map(bookingRow),
  tickets: PLAYERS.map((p, i) => ({ booking_id: BOOKING[p.key], qr_token: `season-${p.key}-00${i + 1}`, status: "active" })),
  session_tickets: PLAYERS.map((p, i) => ({
    id: `57c40000-0000-4000-8000-00000000000${i + 1}`, booking_id: BOOKING[p.key], event_id: EVENT_ID, session_id: TODAY_SESSION_ID,
    child_id: CHILD[p.key], qr_token: `session-${p.key}-today`, status: "active",
    reminder_12h_sent_at: londonIso(addDays(TODAY, -1), "23:55"), reminder_1h_sent_at: londonIso(TODAY, "11:00"), created_at: londonIso(addDays(TODAY, -1), "23:55"),
  })),
  session_attendance: buildAttendance(),
  session_reports: buildReports(),
  player_reports: [],
  tennis_goals: [],
  sporting_schedule: [],
  booking_invitations: [],
  memberships: [],
  venues: [],
  suffolk_news: [],
  app_settings: [],
};

/** Every row on a (child) for the parent flow, or (coach) for the register. Handy for assertions. */
export const alfieReports = () => T.session_reports.filter((r) => r.child_id === CHILD.alfie);

/* ------------------------------------------------------------------ */
/* Edge functions                                                       */
/* ------------------------------------------------------------------ */

const AREA_SET = new Set(AREAS);
const isCompleteRatings = (r) => !!r && AREAS.every((a) => [1, 2, 3, 4].includes(r[a]));
// The mock's clock. The recorder shifts it (setClockOffset) so "now" reads a
// few minutes before the 12-2pm session ends, and the app prints "Ended
// 1.58pm" instead of the wall-clock time of the recording; mock.mjs shifts
// the browser's Date by the same offset.
let clockOffsetMs = 0;
export function setClockOffset(ms) { clockOffsetMs = ms; }
export const getClockOffset = () => clockOffsetMs;
/** Epoch ms of the London wall-clock instant `ymd hh:mm` (helper for the recorder). */
export const londonEpoch = (ymd, hhmm) => Date.parse(londonIso(ymd, hhmm));
const nowIso = () => new Date(Date.now() + clockOffsetMs).toISOString();
/** True once end_session has run (mock.mjs slows the register refetch after it). */
export const state = { sessionEnded: false };
let reportSeq = 0;

function ageGroupOf(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const jan1 = new Date(new Date().getFullYear(), 0, 1);
  const age = jan1.getFullYear() - birth.getFullYear() - (jan1 < new Date(jan1.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
  if (age <= 7) return "8U"; if (age <= 8) return "9U"; if (age <= 9) return "10U"; if (age <= 10) return "11U";
  if (age <= 11) return "12U"; if (age <= 13) return "14U"; if (age <= 15) return "16U"; if (age <= 17) return "18U";
  return null;
}

const sessionsOf = (eventId) => T.event_sessions.filter((s) => s.event_id === eventId).sort((a, b) => a.session_date.localeCompare(b.session_date));
const myEvents = (userId) => T.events.filter((e) => T.event_coaches.some((c) => c.event_id === e.id && c.user_id === userId));

function venuesResponse(userId, all) {
  const lo = addDays(TODAY, -14), hi = addDays(TODAY, 42);
  const byName = new Map();
  for (const e of myEvents(userId)) {
    const name = e.location ?? "Unknown venue";
    const v = byName.get(name) ?? { name, upcoming: 0, next_date: null, programmes: 0, events: 0, _inRange: false };
    const sessions = sessionsOf(e.id).filter((s) => !s.cancelled_at);
    const inRange = sessions.some((s) => s.session_date >= lo && s.session_date <= hi);
    if (!all && !inRange) continue;
    v._inRange = v._inRange || inRange;
    if (e.programme_type === "programme") v.programmes += 1; else v.events += 1;
    for (const s of sessions) {
      if (s.session_date >= TODAY) {
        v.upcoming += 1;
        if (!v.next_date || s.session_date < v.next_date) v.next_date = s.session_date;
      }
    }
    byName.set(name, v);
  }
  return { venues: [...byName.values()].sort((a, b) => (a.next_date ?? "9999").localeCompare(b.next_date ?? "9999")).map(({ _inRange, ...v }) => v) };
}

function programmesResponse(userId, venue) {
  const items = myEvents(userId).filter((e) => e.location === venue).map((e) => {
    const list = sessionsOf(e.id).filter((s) => !s.cancelled_at);
    const next = list.find((s) => s.session_date >= TODAY) ?? null;
    return {
      id: e.id, title: e.title, programme_type: e.programme_type, meeting_cadence: e.meeting_cadence, location: e.location,
      next_session: next ? { id: next.id, session_date: next.session_date, start_time: next.start_time, end_time: next.end_time } : null,
      session_count: list.length, upcoming_count: list.filter((s) => s.session_date >= TODAY).length, cancelled_at: e.cancelled_at,
    };
  });
  return { items };
}

const eventSummary = (e) => ({ id: e.id, title: e.title, programme_type: e.programme_type, location: e.location, register_closed_at: e.register_closed_at ?? null });

function sessionsResponse(eventId) {
  const e = T.events.find((x) => x.id === eventId);
  if (!e) return { error: "Event not found" };
  const total = T.bookings.filter((b) => b.event_id === eventId && b.status === "paid").length;
  return {
    event: eventSummary(e),
    sessions: sessionsOf(eventId).map((s) => ({
      id: s.id, session_date: s.session_date, start_time: s.start_time, end_time: s.end_time, venue: s.venue, cancelled_at: s.cancelled_at, ended_at: s.ended_at,
      total,
      arrived: T.session_attendance.filter((a) => a.session_id === s.id && a.status === "arrived").length,
      absent: T.session_attendance.filter((a) => a.session_id === s.id && a.status === "absent").length,
      reports_complete: new Set(T.session_reports.filter((r) => r.session_id === s.id && r.complete).map((r) => r.booking_id)).size,
    })),
  };
}

function registerResponse(userId, eventId, sessionIdArg) {
  const e = T.events.find((x) => x.id === eventId);
  if (!e) return { error: "Event not found" };
  const session = sessionIdArg ? T.event_sessions.find((s) => s.id === sessionIdArg && s.event_id === eventId) : null;
  if (sessionIdArg && !session) return { error: "Session not found on this event" };
  const dateOfSession = (sid) => T.event_sessions.find((s) => s.id === sid)?.session_date ?? null;
  const players = T.bookings.filter((b) => b.event_id === eventId && b.status === "paid").map((b) => {
    const child = T.children.find((c) => c.id === b.child_id);
    const att = T.session_attendance.find((a) => a.booking_id === b.id && (sessionIdArg ? a.session_id === sessionIdArg : a.session_id == null));
    const rep = T.session_reports.find((r) => r.booking_id === b.id && r.coach_id === userId && (sessionIdArg ? r.session_id === sessionIdArg : r.session_id == null));
    const pending = T.session_reports.filter((r) => r.booking_id === b.id && r.complete && !r.sent_at && (sessionIdArg ? r.session_id === sessionIdArg : r.session_id == null)).length;
    const thisDate = session?.session_date ?? null;
    const previous = T.session_reports
      .filter((r) => r.child_id === b.child_id && r.complete && r.session_id !== sessionIdArg)
      .map((r) => ({ ratings: r.ratings, session_date: dateOfSession(r.session_id), created_at: r.created_at }))
      .filter((r) => !thisDate || (r.session_date && r.session_date < thisDate))
      .sort((a, b) => (a.session_date ?? "").localeCompare(b.session_date ?? "") || a.created_at.localeCompare(b.created_at))
      .pop() ?? null;
    return {
      booking_id: b.id, child_id: b.child_id, child_name: b.child_name, age_group: ageGroupOf(child?.date_of_birth ?? b.child_dob),
      photo_url: null, medical_notes: b.medical_notes ?? (child?.medical_details || null),
      parent_name: b.parent_name, parent_phone: b.parent_phone, parent_email: b.parent_email,
      attendance: att ? { status: att.status, marked_at: att.marked_at, source: att.source } : null,
      report: rep ? { id: rep.id, complete: rep.complete, sent_at: rep.sent_at, ratings: rep.ratings, area_notes: rep.area_notes, comment: rep.comment, updated_at: rep.updated_at } : null,
      previous, pending_reports: pending,
    };
  }).sort((a, b) => a.child_name.localeCompare(b.child_name));
  return {
    event: eventSummary(e),
    session: session ? { id: session.id, session_date: session.session_date, start_time: session.start_time, end_time: session.end_time, venue: session.venue, ended_at: session.ended_at } : null,
    players,
  };
}

function attendanceAction(userId, body) {
  const b = T.bookings.find((x) => x.id === body.booking_id);
  if (!b) return { error: "Booking not found" };
  const sid = body.session_id ?? null;
  T.session_attendance = T.session_attendance.filter((a) => !(a.booking_id === b.id && a.session_id === sid));
  if (body.status === "clear") return { ok: true, attendance: null };
  const row = {
    id: `a77e0000-0000-4000-8000-00000000${pad2(90 + (++reportSeq % 9))}00`, booking_id: b.id, event_id: b.event_id, session_id: sid, child_id: b.child_id,
    status: body.status, source: "manual", marked_at: nowIso(), marked_by: userId, absence_notified_at: null,
  };
  T.session_attendance.push(row);
  return { ok: true, attendance: { status: row.status, marked_at: row.marked_at, source: row.source } };
}

function saveReportAction(userId, body) {
  const b = T.bookings.find((x) => x.id === body.booking_id);
  if (!b) return { error: "Booking not found" };
  for (const k of Object.keys(body.ratings ?? {})) if (!AREA_SET.has(k)) return { error: `Unknown area: ${k}` };
  const sid = body.session_id ?? null;
  const coach = T.profiles.find((p) => p.user_id === userId);
  let row = T.session_reports.find((r) => r.booking_id === b.id && r.coach_id === userId && r.session_id === sid);
  const now = nowIso();
  if (!row) {
    row = {
      id: `4e900000-0000-4000-8000-00000000${pad2(50 + (++reportSeq))}00`, booking_id: b.id, event_id: b.event_id, session_id: sid, child_id: b.child_id,
      child_name: b.child_name, coach_id: userId, coach_name: coach ? `${coach.first_name} ${coach.last_name}` : "Coach", stats: {},
      ratings: {}, area_notes: {}, comment: "", complete: false, sent_at: null, notified_at: null, created_at: now, updated_at: now,
    };
    T.session_reports.push(row);
  }
  row.ratings = { ...(body.ratings ?? {}) };
  row.area_notes = { ...(body.area_notes ?? {}) };
  row.comment = body.comment ?? "";
  row.complete = isCompleteRatings(row.ratings);
  row.updated_at = now;
  return { ok: true, report: { id: row.id, complete: row.complete, sent_at: row.sent_at, updated_at: row.updated_at } };
}

function endSessionAction(userId, body) {
  const e = T.events.find((x) => x.id === body.event_id);
  if (!e) return { error: "Event not found" };
  const sid = body.session_id ?? null;
  const now = nowIso();
  let absent_marked = 0;
  for (const bid of body.mark_absent ?? []) {
    const b = T.bookings.find((x) => x.id === bid);
    if (!b || T.session_attendance.some((a) => a.booking_id === bid && a.session_id === sid)) continue;
    T.session_attendance.push({
      id: `a77e0000-0000-4000-8000-00000000${pad2(70 + absent_marked)}00`, booking_id: bid, event_id: b.event_id, session_id: sid, child_id: b.child_id,
      status: "absent", source: "auto", marked_at: now, marked_by: userId, absence_notified_at: now,
    });
    absent_marked += 1;
  }
  let reports_sent = 0;
  for (const r of T.session_reports) {
    if (r.event_id === e.id && r.session_id === sid && r.complete && !r.sent_at) { r.sent_at = now; r.notified_at = now; reports_sent += 1; }
  }
  if (sid) { const s = T.event_sessions.find((x) => x.id === sid); if (s) s.ended_at = now; }
  else e.register_closed_at = now;
  state.sessionEnded = true;
  return { ok: true, absent_marked, reports_sent, absence_emails: absent_marked, errors: [] };
}

/** What POST /functions/v1/<name> answers, for the signed-in `user` ({ id, email }). */
export function functionResponse(name, body = {}, user = USERS.coach) {
  const a = body?.action;
  // The booking film (project "booking") adds the invitation, checkout,
  // ticket and scanner functions; the reports film never installs them.
  if (BOOKING_WORLD.installed) {
    const b = bookingFunctionResponse(name, body, user);
    if (b) return b;
  }
  switch (name) {
    case "coach-session": {
      if (!T.user_roles.some((r) => r.user_id === user.id && (r.role === "coach" || r.role === "admin"))) return { error: "Coach access required" };
      if (a === "venues") return venuesResponse(user.id, !!body.all);
      if (a === "programmes") return programmesResponse(user.id, body.venue);
      if (a === "sessions") return sessionsResponse(body.event_id);
      if (a === "register") return registerResponse(user.id, body.event_id, body.session_id);
      if (a === "attendance") return attendanceAction(user.id, body);
      if (a === "save_report") return saveReportAction(user.id, body);
      if (a === "end_session") return endSessionAction(user.id, body);
      if (a === "events") return { events: myEvents(user.id).map((e) => ({ id: e.id, title: e.title, event_date: e.event_date, location: e.location, programme_type: e.programme_type, sessions: sessionsOf(e.id).map(({ id, session_date, start_time, end_time, venue }) => ({ id, session_date, start_time, end_time, venue })) })) };
      return { error: "Unknown action" };
    }
    case "lta-news": return { articles: [] };
    case "lta-events": return { events: [] };
    case "lta-rankings": return { success: false, message: "Rankings are not available in the demo." };
    default: return { ok: true };
  }
}

/** What POST /rest/v1/rpc/<fn> answers. */
export function rpcResponse(fn, _args = {}, _user = USERS.coach) {
  if (fn === "timetable_sessions") return BOOKING_WORLD.installed ? timetableSessions(_args, _user) : [];
  if (fn === "get_parent_emails") return T.profiles.map((p) => ({ user_id: p.user_id, email: USERS.coach.id === p.user_id ? USERS.coach.email : USERS.parent.id === p.user_id ? USERS.parent.email : `${p.first_name}.${p.last_name}@example.com`.toLowerCase() }));
  return [];
}

/* ================================================================== */
/* Project "booking": the second film (getting a place / QR ticket /   */
/* the diary). Everything below is inert until installBookingFixtures()*/
/* is called, so the Performance & Reports film sees the world above   */
/* exactly as it was.                                                  */
/* ================================================================== */

export const BOOKING_WORLD = { installed: false };

export const ADMIN_ID = "ad401000-0000-4000-8000-000000000001";
export const PARENT_DUNN = "9a4e0000-0000-4000-8000-000000000005";
export const CHILD_FREYA = "c41d0000-0000-4000-8000-000000000005";
export const BOOKING_FREYA = "b00c0000-0000-4000-8000-000000000005";
export const EVENT_HIT_ID = "e0e00000-0000-4000-8000-000000000003";
export const BOOKING_ALFIE_HIT = "b00c0000-0000-4000-8000-000000000006";
export const INVITATION_ID = "1a4d0000-0000-4000-8000-000000000001";
/** The token in the invitation email's "Accept & pay" button. */
export const INVITATION_TOKEN = "sample";
export const HITTING_TITLE = "Suffolk County Hitting Squad";

/** Entry codes, short enough to read on screen and type into the scanner. */
export const TOKEN = {
  alfieSeason: "ST-ALFIE-SEASON",
  alfieToday: "ST-ALFIE-06",
  freyaToday: "ST-FREYA-06",
};

const hitSessionId = (i) => `5e550000-0000-4000-8000-0000000002${pad2(i + 1)}`;
const HIT_COUNT = 12;
// Wednesdays, starting six weeks before today.
const hitFirst = addDays(TODAY, ((3 - new Date(TODAY + "T12:00:00Z").getUTCDay() + 7) % 7) - 14);
const hitDate = (i) => addDays(hitFirst, 7 * i);

/** Alfie's own diary outside the county programme (scene 11-12). */
const MANUAL_WEEK = [
  { dow: 2, title: "Club squad — Bury St Edmunds TC", category: "squad_training", start: "17:00", end: "18:30" },
  { dow: 4, title: "Strength & conditioning", category: "tennis_sc", start: "16:30", end: "17:30" },
  { dow: 5, title: "Individual lesson with Coach Ellis", category: "individual_lesson", start: "17:00", end: "18:00" },
  { dow: 0, title: "Practice matches", category: "free_play", start: "09:30", end: "11:00" },
];

const minutesBetween = (a, b) => {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
};

function buildSportingSchedule() {
  const rows = [];
  let n = 0;
  // Monday of the week containing today, in London wall-clock terms.
  const todayDow = new Date(TODAY + "T12:00:00Z").getUTCDay();
  const monday = addDays(TODAY, todayDow === 0 ? -6 : 1 - todayDow);
  for (let w = -6; w <= 10; w++) {
    for (const m of MANUAL_WEEK) {
      const offset = m.dow === 0 ? 6 : m.dow - 1;
      const date = addDays(monday, w * 7 + offset);
      rows.push({
        id: `5c4e0000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
        child_id: CHILD.alfie, parent_user_id: PARENT_ID, title: m.title, category: m.category,
        event_date: date, start_time: `${m.start}:00`, end_time: `${m.end}:00`,
        duration_minutes: minutesBetween(m.start, m.end),
        location: m.category === "tennis_sc" ? "Abbeycroft Leisure" : "Bury St Edmunds Tennis Club",
        notes: null, is_tournament: false, recurrence_rule: `weekly:${m.dow}`, recurrence_end_date: null,
        recurrence_group_id: `5c40e000-0000-4000-8000-00000000000${MANUAL_WEEK.indexOf(m) + 1}`,
      });
    }
  }
  // A couple of dated one-offs so the month and the year counters look lived-in.
  const extras = [
    { date: addDays(monday, -12), title: "Suffolk Junior Open", category: "tournament", start: "09:00", end: "16:00", tournament: true, location: "Ipswich Sports Club" },
    { date: addDays(monday, 9), title: "County league match", category: "official_match", start: "10:00", end: "12:00", tournament: false, location: "Framlingham Tennis Club" },
    { date: addDays(monday, -19), title: "County league match", category: "official_match", start: "10:00", end: "12:00", tournament: false, location: "Woodbridge Tennis Club" },
  ];
  for (const e of extras) {
    rows.push({
      id: `5c4e0000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
      child_id: CHILD.alfie, parent_user_id: PARENT_ID, title: e.title, category: e.category,
      event_date: e.date, start_time: `${e.start}:00`, end_time: `${e.end}:00`,
      duration_minutes: minutesBetween(e.start, e.end), location: e.location, notes: null,
      is_tournament: e.tournament, recurrence_rule: null, recurrence_end_date: null, recurrence_group_id: null,
    });
  }
  return rows;
}

/**
 * Switch the fixtures into the booking film's world:
 *  - a fictional county administrator (Nina Hollis) for the ledger,
 *  - Alfie NOT yet booked on the 12U programme, but invited,
 *  - a second Suffolk programme he is already on (so the timetable and the
 *    Parent Hub have more than one thing in them),
 *  - an unpaid place (Freya Dunn) for the rejected scan,
 *  - Alfie's own weekly diary outside the county programme.
 */
export function installBookingFixtures() {
  if (BOOKING_WORLD.installed) return BOOKING_WORLD;
  BOOKING_WORLD.installed = true;

  USERS.admin = { id: ADMIN_ID, email: "nina.hollis@example.com", first_name: "Nina", last_name: "Hollis" };
  T.user_roles.push({ user_id: ADMIN_ID, role: "admin" });
  T.profiles.push(profileRow(ADMIN_ID, "Nina", "Hollis", "07700 900105", "Bury St Edmunds", "IP33 2BB", { address: "1 Northgate Street" }));
  T.profiles.push(profileRow(PARENT_DUNN, "Mark", "Dunn", "07700 900745", "Felixstowe", "IP11 7QS", { address: "18 Sea Road" }));

  // The county season has only just started: the booking film's programme is
  // today's session, last week's and the rest of the autumn, not the
  // half-finished season the reports film needs.
  const dropped = new Set(T.event_sessions.filter((s) => s.event_id === EVENT_ID && s.session_date < addDays(TODAY, -7)).map((s) => s.id));
  T.event_sessions = T.event_sessions.filter((s) => !dropped.has(s.id));
  T.session_attendance = T.session_attendance.filter((a) => !dropped.has(a.session_id));
  T.session_reports = T.session_reports.filter((r) => !dropped.has(r.session_id));

  // Maya and Theo scanned in before the film's clock starts (11:40), so the
  // scan on screen is the last arrival of the morning, not the earliest.
  for (const [key, time] of [["maya", "11:31"], ["theo", "11:36"]]) {
    const row = T.session_attendance.find((a) => a.booking_id === BOOKING[key] && a.session_id === TODAY_SESSION_ID);
    if (row) row.marked_at = londonIso(TODAY, time);
  }

  // Alfie's place does not exist yet: it is created on screen in scene 3.
  T.bookings = T.bookings.filter((b) => b.id !== BOOKING.alfie);
  T.tickets = T.tickets.filter((t) => t.booking_id !== BOOKING.alfie);
  T.session_tickets = T.session_tickets.filter((t) => t.booking_id !== BOOKING.alfie);
  T.session_attendance = T.session_attendance.filter((a) => a.booking_id !== BOOKING.alfie);

  // Ledger columns the reports film never needed.
  for (const b of T.bookings) Object.assign(b, { currency: "gbp", stripe_env: "live", photo_consent: true });

  // The invitation that is still open (the email in scene 1).
  T.booking_invitations.push({
    id: INVITATION_ID, event_id: EVENT_ID, token: INVITATION_TOKEN, status: "opened",
    child_name: "Alfie Barker", parent_name: "Hannah Barker", parent_email: USERS.parent.email,
    parent_user_id: PARENT_ID, complimentary: false, complimentary_reason: null,
    created_at: londonIso(addDays(TODAY, -3), "18:02"), opened_at: londonIso(TODAY, "08:41"), booked_at: null,
  });

  // A second Suffolk programme Alfie is already on: Wednesday hitting squad.
  T.events.push({
    id: EVENT_HIT_ID, title: HITTING_TITLE, description: "Midweek hitting and match play for selected county players.",
    event_date: londonIso(hitDate(0), "17:30"), location: VENUE, age_group: "12U", capacity: 10, visibility: "private",
    programme_type: "programme", price_pence: 18000, is_free: false, meeting_cadence: "weekly", sign_up_enabled: false,
    cancelled_at: null, programme_months: null, event_type: "county-training", poster_url: null, featured: false, cost: "£180",
    session_slots: null, register_closed_at: null, created_at: "2026-08-20T09:00:00.000Z",
  });
  for (let i = 0; i < HIT_COUNT; i++) {
    T.event_sessions.push({
      id: hitSessionId(i), event_id: EVENT_HIT_ID, session_date: hitDate(i), start_time: "17:30:00", end_time: "19:00:00",
      venue: VENUE, cancelled_at: null, cancel_reason: null, moved_from_date: null, moved_from_start: null, moved_at: null,
      ended_at: hitDate(i) < TODAY ? londonIso(hitDate(i), "19:03") : null, created_at: "2026-08-20T09:00:00.000Z",
    });
  }
  T.bookings.push({
    id: BOOKING_ALFIE_HIT, event_id: EVENT_HIT_ID, invitation_id: null, parent_user_id: PARENT_ID, parent_name: "Hannah Barker",
    parent_email: USERS.parent.email, parent_phone: "07700 900311", child_id: CHILD.alfie, child_name: "Alfie Barker",
    child_dob: "2014-08-22", medical_notes: null, status: "paid", amount_pence: 18000, session_slot: null,
    paid_at: londonIso(addDays(TODAY, -44), "20:08"), membership_id: null, complimentary: false,
    created_at: londonIso(addDays(TODAY, -44), "20:05"), currency: "gbp", stripe_env: "live", photo_consent: true,
  });
  T.tickets.push({ booking_id: BOOKING_ALFIE_HIT, qr_token: "ST-ALFIE-HIT", status: "active" });

  // An unpaid place, for the scan that is turned away.
  T.children.push({
    id: CHILD_FREYA, parent_user_id: PARENT_DUNN, name: "Freya Dunn", date_of_birth: "2014-06-14", gender: "girl",
    btm_number: "10877402", county_rank: null, national_rank: null, favorite_player: null, favorite_shot: null,
    handedness: "right", has_medical_needs: false, has_send_needs: false, medical_conditions: [], medical_details: null,
    send_conditions: [], send_details: null, description: null, medical_needs: null, photo_url: null, home_club: null,
    country: "GB", created_at: "2026-03-04T18:30:00.000Z", updated_at: "2026-08-30T10:00:00.000Z",
  });
  T.bookings.push({
    id: BOOKING_FREYA, event_id: EVENT_ID, invitation_id: null, parent_user_id: PARENT_DUNN, parent_name: "Mark Dunn",
    parent_email: "mark.dunn@example.com", parent_phone: "07700 900745", child_id: CHILD_FREYA, child_name: "Freya Dunn",
    child_dob: "2014-06-14", medical_notes: null, status: "pending", amount_pence: 27500, session_slot: null,
    paid_at: null, membership_id: null, complimentary: false, created_at: londonIso(addDays(TODAY, -2), "21:14"),
    currency: "gbp", stripe_env: "live", photo_consent: true,
  });
  T.session_tickets.push({
    id: "57c40000-0000-4000-8000-000000000009", booking_id: BOOKING_FREYA, event_id: EVENT_ID, session_id: TODAY_SESSION_ID,
    child_id: CHILD_FREYA, qr_token: TOKEN.freyaToday, status: "active",
    reminder_12h_sent_at: null, reminder_1h_sent_at: null, created_at: londonIso(addDays(TODAY, -2), "21:14"),
  });

  T.sporting_schedule.push(...buildSportingSchedule());
  return BOOKING_WORLD;
}

/** Alfie's place on the 12U programme, created the moment the parent accepts. */
export function bookAlfie(user = USERS.parent) {
  const existing = T.bookings.find((b) => b.id === BOOKING.alfie);
  if (existing) return existing;
  const now = nowIso();
  const booking = {
    id: BOOKING.alfie, event_id: EVENT_ID, invitation_id: INVITATION_ID, parent_user_id: PARENT_ID,
    parent_name: "Hannah Barker", parent_email: USERS.parent.email, parent_phone: "07700 900311",
    child_id: CHILD.alfie, child_name: "Alfie Barker", child_dob: "2014-08-22", medical_notes: null,
    status: "paid", amount_pence: 27500, session_slot: null, paid_at: now, membership_id: null,
    complimentary: false, created_at: now, currency: "gbp", stripe_env: "live", photo_consent: true,
  };
  T.bookings.push(booking);
  T.tickets.push({ booking_id: BOOKING.alfie, qr_token: TOKEN.alfieSeason, status: "active" });
  // One entry code per remaining session; today's is the one that gets scanned.
  let n = 0;
  for (let i = 0; i < SESSION_COUNT; i++) {
    if (sessionDate(i) < TODAY) continue;
    T.session_tickets.push({
      id: `57c40000-0000-4000-8000-0000000001${pad2(++n)}`, booking_id: BOOKING.alfie, event_id: EVENT_ID,
      session_id: sessionId(i), child_id: CHILD.alfie,
      qr_token: i === TODAY_INDEX ? TOKEN.alfieToday : `ST-ALFIE-${pad2(i + 1)}`, status: "active",
      reminder_12h_sent_at: null, reminder_1h_sent_at: null, created_at: now,
    });
  }
  const inv = T.booking_invitations.find((x) => x.id === INVITATION_ID);
  if (inv) { inv.status = "booked"; inv.booked_at = now; }
  void user;
  return booking;
}

/* ----- edge functions used only by the booking film ----- */

const eventForBooking = (e) => ({
  id: e.id, title: e.title, description: e.description, event_date: e.event_date, location: e.location,
  poster_url: e.poster_url, session_slots: e.session_slots, programme_type: e.programme_type,
  price_pence: e.price_pence, is_free: e.is_free, meeting_cadence: e.meeting_cadence, capacity: e.capacity,
  cancelled_at: e.cancelled_at,
});

function getInvitationResponse(token) {
  const inv = T.booking_invitations.find((i) => i.token === token);
  if (!inv) return { error: "This invitation link could not be opened." };
  const event = T.events.find((e) => e.id === inv.event_id);
  const booking = T.bookings.find((b) => b.invitation_id === inv.id && ["pending", "paid"].includes(b.status)) ?? null;
  return {
    invitation: {
      id: inv.id, status: inv.status, child_name: inv.child_name, parent_name: inv.parent_name,
      parent_email: inv.parent_email, complimentary: !!inv.complimentary, complimentary_reason: inv.complimentary_reason ?? null,
    },
    event: eventForBooking(event),
    sessions: sessionsOf(inv.event_id).map((s) => ({
      id: s.id, session_date: s.session_date, start_time: s.start_time, end_time: s.end_time,
      venue: s.venue, notes: null, cancelled_at: s.cancelled_at, moved_from_date: s.moved_from_date,
    })),
    existing_booking: booking ? { id: booking.id, status: booking.status } : null,
  };
}

/** get-booking-status, mirroring the real function (the ticket is withheld on the booking_id path). */
function bookingStatusResponse(body) {
  let booking = null;
  let sessionTicket = null;
  if (body.qr_token) {
    sessionTicket = T.session_tickets.find((t) => t.qr_token === body.qr_token) ?? null;
    const seasonTicket = sessionTicket ? null : T.tickets.find((t) => t.qr_token === body.qr_token);
    const bookingId = sessionTicket?.booking_id ?? seasonTicket?.booking_id;
    if (!bookingId) return { error: "Ticket not found" };
    booking = T.bookings.find((b) => b.id === bookingId) ?? null;
  } else if (body.booking_id) {
    booking = T.bookings.find((b) => b.id === body.booking_id) ?? null;
  }
  if (!booking) return { error: "Booking not found" };
  const provedOwnership = !!body.qr_token || !!body.session_id;
  const e = T.events.find((x) => x.id === booking.event_id) ?? null;
  const ticketRow = T.tickets.find((t) => t.booking_id === booking.id) ?? null;
  const session = sessionTicket?.session_id ? T.event_sessions.find((s) => s.id === sessionTicket.session_id) ?? null : null;
  const upcoming = sessionTicket ? [] : T.event_sessions
    .filter((s) => s.event_id === booking.event_id && !s.cancelled_at && s.session_date >= TODAY)
    .sort((a, b) => a.session_date.localeCompare(b.session_date))
    .slice(0, 6)
    .map((s) => ({ session_date: s.session_date, start_time: s.start_time, end_time: s.end_time, venue: s.venue, moved_from_date: s.moved_from_date }));
  const scoped = sessionTicket
    ? { qr_token: sessionTicket.qr_token, status: sessionTicket.status, scope: "session" }
    : ticketRow ? { qr_token: ticketRow.qr_token, status: ticketRow.status, scope: "season" } : null;
  return {
    booking: {
      status: booking.status, child_name: booking.child_name, parent_name: booking.parent_name,
      session_slot: booking.session_slot, amount_pence: booking.amount_pence, paid_at: booking.paid_at,
    },
    event: e ? { title: e.title, location: e.location, event_date: e.event_date, programme_type: e.programme_type, cancelled_at: e.cancelled_at } : null,
    session: session ? { id: session.id, session_date: session.session_date, start_time: session.start_time, end_time: session.end_time, venue: session.venue } : null,
    upcoming_sessions: upcoming,
    ticket: booking.status === "paid" && provedOwnership ? scoped : null,
  };
}

const NO_PLAYER = { child_name: null, parent_name: null, session_slot: null, has_medical_notes: false, event_title: null, age_group: null, medical_notes: null };

/** scan-ticket: every outcome is a 200, exactly as the real function answers. */
function scanTicketResponse(body, user) {
  const token = String(body?.qr_token ?? "").trim();
  const bare = (result, message) => ({ ok: false, result, message, player: NO_PLAYER, session: null, event: null, booking_id: null, resolved_from: null });
  if (token.length < 6) return bare("unknown", "That code is too short to be a ticket");
  const sessionTicket = T.session_tickets.find((t) => t.qr_token === token) ?? null;
  const seasonTicket = sessionTicket ? null : T.tickets.find((t) => t.qr_token === token) ?? null;
  if (!sessionTicket && !seasonTicket) return bare("unknown", "This code is not a Suffolk Tennis ticket");
  const bookingId = sessionTicket?.booking_id ?? seasonTicket.booking_id;
  const booking = T.bookings.find((b) => b.id === bookingId) ?? null;
  const eventRow = T.events.find((e) => e.id === (sessionTicket?.event_id ?? booking?.event_id)) ?? null;
  const sessionRow = sessionTicket?.session_id
    ? T.event_sessions.find((s) => s.id === sessionTicket.session_id) ?? null
    : T.event_sessions.find((s) => s.event_id === booking?.event_id && s.session_date === TODAY) ?? null;
  const child = booking ? T.children.find((c) => c.id === booking.child_id) : null;
  const player = {
    child_name: booking?.child_name ?? null, parent_name: booking?.parent_name ?? null,
    session_slot: booking?.session_slot ?? null, has_medical_notes: false,
    event_title: eventRow?.title ?? null, age_group: ageGroupOf(child?.date_of_birth ?? booking?.child_dob), medical_notes: null,
  };
  const session = sessionRow ? { id: sessionRow.id, session_date: sessionRow.session_date, start_time: sessionRow.start_time, end_time: sessionRow.end_time, venue: sessionRow.venue } : null;
  const event = eventRow ? { id: eventRow.id, title: eventRow.title } : null;
  const respond = (result, message) => ({ ok: result === "admitted", result, message, player, session, event, booking_id: bookingId, resolved_from: sessionTicket ? "qr" : "clock" });
  const status = sessionTicket?.status ?? seasonTicket?.status;
  if (status === "void") return respond("rejected_void", "Ticket has been cancelled");
  if (!booking || booking.status !== "paid") return respond("rejected_unpaid", "Booking is not paid");
  if (!session) return respond("no_session", "Season ticket — no session of this programme is running now");
  const already = T.session_attendance.some((a) => a.booking_id === booking.id && a.session_id === session.id && a.status === "arrived");
  if (already) return respond("duplicate", "Already scanned in");
  T.session_attendance.push({
    id: `a77e0000-0000-4000-8000-0000000060${pad2(T.session_attendance.length % 90)}`, booking_id: booking.id,
    event_id: booking.event_id, session_id: session.id, child_id: booking.child_id, status: "arrived",
    source: "scan", marked_at: nowIso(), marked_by: user?.id ?? ADMIN_ID, absence_notified_at: null,
  });
  return respond("admitted", "Admitted — welcome!");
}

function bookingFunctionResponse(name, body = {}, user = USERS.parent) {
  switch (name) {
    case "get-invitation": return getInvitationResponse(body?.token);
    case "create-booking-checkout": {
      const booking = bookAlfie(user);
      // No Stripe page is ever shown: the mock settles the place the way the
      // webhook does in production and the app lands on its own confirmed state.
      return { free: true, booking_id: booking.id, amount_pence: booking.amount_pence, is_programme: true };
    }
    case "get-booking-status": return bookingStatusResponse(body ?? {});
    case "scan-ticket": return scanTicketResponse(body ?? {}, user);
    default: return null;
  }
}

/** timetable_sessions(p_from, p_to): the Suffolk sessions behind this parent's paid bookings. */
function timetableSessions(args = {}, user = USERS.parent) {
  const from = args.p_from ?? "0000-01-01";
  const to = args.p_to ?? "9999-12-31";
  const rows = [];
  for (const b of T.bookings) {
    if (b.parent_user_id !== user.id || b.status !== "paid") continue;
    const e = T.events.find((x) => x.id === b.event_id);
    for (const s of T.event_sessions.filter((s) => s.event_id === b.event_id && !s.cancelled_at)) {
      if (s.session_date < from || s.session_date > to) continue;
      const att = T.session_attendance.find((a) => a.booking_id === b.id && a.session_id === s.id) ?? null;
      const mins = s.start_time && s.end_time
        ? (Number(s.end_time.slice(0, 2)) * 60 + Number(s.end_time.slice(3, 5))) - (Number(s.start_time.slice(0, 2)) * 60 + Number(s.start_time.slice(3, 5)))
        : 60;
      rows.push({
        source_id: `auto:${s.id}:${b.id}`, child_id: b.child_id, title: e?.title ?? "Suffolk Tennis session",
        category: "squad_training", event_date: s.session_date, start_time: s.start_time, end_time: s.end_time,
        duration_minutes: mins, location: s.venue ?? e?.location ?? null,
        attendance_status: att?.status ?? null, is_tournament: false,
      });
    }
  }
  return rows;
}
