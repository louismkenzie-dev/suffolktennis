// Staff-only (coach or admin) API for the Coach hub: venues → programmes →
// sessions → register, attendance marks, the nine-area LTA session report,
// and End session (docs/REGISTERS-SPEC.md).
//
// Every action is scoped. An admin can touch any event; a coach only the
// events they are assigned to in event_coaches, and gets 403 otherwise. The
// older actions (events / roster / mark / notify_report) are kept for the
// previous hub and follow the same scope.
//
// Writes go through the service role here rather than RLS because the
// attendance and report tables use PARTIAL unique indexes (session_id null vs
// not) that a PostgREST upsert can't target — see upsertAttendance in
// _shared/reportEmails.ts.
import { z } from "npm:zod@3.23.8";
import { serviceClient, requireRole, CORS, json } from "../_shared/adminAuth.ts";
import { sendEmail } from "../_shared/resend.ts";
import { brandedEmail, emailButton, emailDetails, emailNote, emailParagraph } from "../_shared/emailLayout.ts";
import { unsubscribeBaseUrl, unsubscribeTokenFor, unsubscribeUrlFor } from "../_shared/emailPrefs.ts";
import { sendDueForSession, upsertAttendance } from "../_shared/reportEmails.ts";

const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://suffolktennis.online").replace(/\/$/, "");

// The nine LTA characteristics. These strings are the JSON keys in
// session_reports.ratings / area_notes and must match src/lib/lta.ts.
const LTA_AREAS = [
  "Confident to Attack",
  "Comfortable in Rally",
  "Chases Every Ball",
  "Creative in Play",
  "Athletic Qualities",
  "Reads the Ball",
  "Loves the Game",
  "Loves to Compete",
  "Serving",
] as const;
const AREA_SET = new Set<string>(LTA_AREAS);

// Venues page window: sessions in the last 14 days or the next 42.
const VENUE_LOOKBACK_DAYS = 14;
const VENUE_LOOKAHEAD_DAYS = 42;

const Level = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

const Body = z.object({
  action: z.enum([
    "events", "roster", "mark", "notify_report",
    "venues", "programmes", "sessions", "register", "attendance", "save_report", "end_session",
  ]),
  report_id: z.string().uuid().optional(),
  event_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  booking_id: z.string().uuid().optional(),
  present: z.boolean().optional(),
  all: z.boolean().optional(),
  venue: z.string().trim().max(200).optional(),
  status: z.enum(["arrived", "absent", "clear"]).optional(),
  ratings: z.record(z.string(), Level).optional(),
  area_notes: z.record(z.string(), z.string().max(2000)).optional(),
  comment: z.string().max(5000).optional(),
  mark_absent: z.array(z.string().uuid()).max(500).optional(),
});

/** Today's date in London, whatever the server's timezone. */
function londonDate(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * LTA year group from the age on 1 January of the current year: 8U for 7 and
 * under, then 9U, 10U, 11U, 12U, 14U (12–13), 16U (14–15), 18U (16–17),
 * otherwise Senior.
 */
function ageGroup(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const birth = new Date(`${dob.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const year = Number(londonDate().slice(0, 4));
  const bornNewYearsDay = birth.getUTCMonth() === 0 && birth.getUTCDate() === 1;
  const age = year - birth.getUTCFullYear() - (bornNewYearsDay ? 0 : 1);
  if (age <= 7) return "8U";
  if (age === 8) return "9U";
  if (age === 9) return "10U";
  if (age === 10) return "11U";
  if (age === 11) return "12U";
  if (age <= 13) return "14U";
  if (age <= 15) return "16U";
  if (age <= 17) return "18U";
  return "Senior";
}

/** A session's venue is its own, else the event's location. */
const venueName = (sessionVenue: string | null | undefined, eventLocation: string | null | undefined) =>
  (sessionVenue ?? "").trim() || (eventLocation ?? "").trim() || "No venue";

/** Signed child photo URLs (service role) so coaches see them without wider storage policies. */
async function signPhotos(
  admin: ReturnType<typeof serviceClient>,
  children: Array<{ id: string; photo_url: string | null }>,
): Promise<Map<string, string>> {
  const photoByChild = new Map<string, string>();
  await Promise.all(children.filter((c) => c.photo_url).map(async (c) => {
    const { data: signed } = await admin.storage
      .from("child-photos")
      .createSignedUrl(c.photo_url as string, 3600);
    if (signed?.signedUrl) photoByChild.set(c.id, signed.signedUrl);
  }));
  return photoByChild;
}

/**
 * Page through a query that may exceed PostgREST's 1000-row cap (a season of
 * weekly programmes gets there). `build` must apply a stable order.
 */
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const PAGE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = serviceClient();
  const staffId = await requireRole(req, admin, ["admin", "coach"]);
  if (!staffId) return json({ error: "Staff access required" }, 403);

  let body: z.infer<typeof Body>;
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Invalid input" }, 400);
    body = parsed.data;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Scope: admins see everything; coaches only their assigned events.
  const { data: roleRows } = await admin
    .from("user_roles").select("role").eq("user_id", staffId);
  const isAdmin = (roleRows ?? []).some((r) => r.role === "admin");
  const assigned = new Set<string>();
  if (!isAdmin) {
    const { data: rows } = await admin
      .from("event_coaches").select("event_id").eq("user_id", staffId);
    for (const r of rows ?? []) assigned.add(r.event_id);
  }
  const canAccess = (eventId: string) => isAdmin || assigned.has(eventId);
  const forbidden = () => json({ error: "You are not assigned to this event" }, 403);

  /** All events the caller may see (cancelled ones included; callers filter). */
  async function callerEvents() {
    if (!isAdmin && assigned.size === 0) return [];
    let q = admin
      .from("events")
      .select("id, title, location, programme_type, meeting_cadence, event_date, cancelled_at, register_closed_at");
    if (!isAdmin) q = q.in("id", [...assigned]);
    const { data } = await q;
    return data ?? [];
  }

  /** A session must belong to the event it is being used with. */
  async function loadSession(sessionId: string, eventId: string) {
    const { data: s } = await admin
      .from("event_sessions")
      .select("id, event_id, session_date, start_time, end_time, venue, cancelled_at, ended_at")
      .eq("id", sessionId)
      .maybeSingle();
    if (!s || s.event_id !== eventId) return null;
    return s;
  }

  // ---------------------------------------------------------------------
  // venues: distinct venues across the caller's events
  // ---------------------------------------------------------------------
  if (body.action === "venues") {
    const events = (await callerEvents()).filter((e) => !e.cancelled_at);
    if (events.length === 0) return json({ venues: [] });
    const eventById = new Map(events.map((e) => [e.id, e]));

    const today = londonDate();
    const from = addDays(today, -VENUE_LOOKBACK_DAYS);
    const to = addDays(today, VENUE_LOOKAHEAD_DAYS);

    // Only the window's sessions unless "All venues" is on; paged either way
    // so a long-running club never silently loses venues past the row cap.
    type SessionLite = { id: string; event_id: string; session_date: string; venue: string | null };
    const sessions = await fetchAll<SessionLite>((a, b) => {
      let q = admin
        .from("event_sessions")
        .select("id, event_id, session_date, venue")
        .in("event_id", [...eventById.keys()])
        .is("cancelled_at", null);
      if (!body.all) q = q.gte("session_date", from).lte("session_date", to);
      return q.order("session_date").order("id").range(a, b);
    });

    // Session-less events still need a venue to be found under: their
    // location and their event_date stand in for a session.
    const withSessions = new Set((sessions ?? []).map((s) => s.event_id));
    const occurrences = (sessions ?? []).map((s) => ({
      event_id: s.event_id,
      date: s.session_date as string,
      venue: venueName(s.venue, eventById.get(s.event_id)?.location),
    }));
    for (const e of events) {
      if (withSessions.has(e.id)) continue;
      occurrences.push({
        event_id: e.id,
        date: londonDate(new Date(e.event_date)),
        venue: venueName(null, e.location),
      });
    }

    type VenueAgg = { name: string; upcoming: number; next_date: string | null; programmes: Set<string>; events: Set<string>; inWindow: boolean };
    const byVenue = new Map<string, VenueAgg>();
    for (const o of occurrences) {
      const agg = byVenue.get(o.venue) ?? {
        name: o.venue, upcoming: 0, next_date: null, programmes: new Set(), events: new Set(), inWindow: false,
      };
      if (o.date >= today) {
        agg.upcoming += 1;
        if (!agg.next_date || o.date < agg.next_date) agg.next_date = o.date;
      }
      if (o.date >= from && o.date <= to) agg.inWindow = true;
      const ev = eventById.get(o.event_id);
      (ev?.programme_type === "programme" ? agg.programmes : agg.events).add(o.event_id);
      byVenue.set(o.venue, agg);
    }

    const venues = [...byVenue.values()]
      .filter((v) => body.all || v.inWindow)
      .sort((a, b) => {
        if (a.next_date && b.next_date && a.next_date !== b.next_date) return a.next_date < b.next_date ? -1 : 1;
        if (!!a.next_date !== !!b.next_date) return a.next_date ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((v) => ({
        name: v.name,
        upcoming: v.upcoming,
        next_date: v.next_date,
        programmes: v.programmes.size,
        events: v.events.size,
      }));
    return json({ venues });
  }

  // ---------------------------------------------------------------------
  // programmes: what runs at a venue — programmes first, then events
  // ---------------------------------------------------------------------
  if (body.action === "programmes") {
    if (!body.venue) return json({ error: "venue required" }, 400);
    const events = await callerEvents();
    if (events.length === 0) return json({ items: [] });
    const eventById = new Map(events.map((e) => [e.id, e]));

    type SessionRow = { id: string; event_id: string; session_date: string; start_time: string | null; end_time: string | null; venue: string | null; cancelled_at: string | null };
    const sessions = await fetchAll<SessionRow>((a, b) => admin
      .from("event_sessions")
      .select("id, event_id, session_date, start_time, end_time, venue, cancelled_at")
      .in("event_id", [...eventById.keys()])
      .is("cancelled_at", null)
      .order("session_date")
      .order("start_time", { nullsFirst: true })
      .order("id")
      .range(a, b));

    const today = londonDate();
    const sessionsByEvent = new Map<string, SessionRow[]>();
    for (const s of sessions ?? []) {
      const list = sessionsByEvent.get(s.event_id) ?? [];
      list.push(s);
      sessionsByEvent.set(s.event_id, list);
    }

    const items = events
      .filter((e) => {
        const list = sessionsByEvent.get(e.id) ?? [];
        if (list.length === 0) return venueName(null, e.location) === body.venue;
        return list.some((s) => venueName(s.venue, e.location) === body.venue);
      })
      .map((e) => {
        const list = sessionsByEvent.get(e.id) ?? [];
        const next = list.find((s) => (s.session_date as string) >= today) ?? null;
        return {
          id: e.id,
          title: e.title,
          programme_type: e.programme_type as "programme" | "event",
          meeting_cadence: e.meeting_cadence,
          location: e.location,
          next_session: next
            ? { id: next.id, session_date: next.session_date, start_time: next.start_time, end_time: next.end_time }
            : null,
          session_count: list.length,
          upcoming_count: list.filter((s) => (s.session_date as string) >= today).length,
          cancelled_at: e.cancelled_at,
          // Sort keys only — stripped below.
          _date: next?.session_date ?? (list.length === 0 ? londonDate(new Date(e.event_date)) : null),
        };
      })
      .sort((a, b) => {
        if (a.programme_type !== b.programme_type) return a.programme_type === "programme" ? -1 : 1;
        if (!!a.cancelled_at !== !!b.cancelled_at) return a.cancelled_at ? 1 : -1;
        if (a._date && b._date && a._date !== b._date) return a._date < b._date ? -1 : 1;
        if (!!a._date !== !!b._date) return a._date ? -1 : 1;
        return a.title.localeCompare(b.title);
      })
      .map(({ _date: _omit, ...item }) => item);
    return json({ items });
  }

  // ---------------------------------------------------------------------
  // sessions: one programme/event with per-session register counts
  // ---------------------------------------------------------------------
  if (body.action === "sessions") {
    if (!body.event_id) return json({ error: "event_id required" }, 400);
    if (!canAccess(body.event_id)) return forbidden();
    const { data: event } = await admin
      .from("events")
      .select("id, title, programme_type, location, register_closed_at")
      .eq("id", body.event_id)
      .maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);

    const [{ data: sessions }, { count: total }, { data: attendance }, { data: reports }] = await Promise.all([
      admin.from("event_sessions")
        .select("id, session_date, start_time, end_time, venue, cancelled_at, ended_at")
        .eq("event_id", event.id)
        .order("session_date")
        .order("start_time", { nullsFirst: true }),
      admin.from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "paid"),
      admin.from("session_attendance")
        .select("session_id, status")
        .eq("event_id", event.id),
      admin.from("session_reports")
        .select("session_id, booking_id")
        .eq("event_id", event.id)
        .eq("complete", true),
    ]);

    const counts = new Map<string, { arrived: number; absent: number; complete: Set<string> }>();
    const bucket = (id: string | null) => {
      const key = id ?? "";
      const c = counts.get(key) ?? { arrived: 0, absent: 0, complete: new Set<string>() };
      counts.set(key, c);
      return c;
    };
    for (const a of attendance ?? []) {
      if (a.status === "arrived") bucket(a.session_id).arrived += 1;
      else if (a.status === "absent") bucket(a.session_id).absent += 1;
    }
    for (const r of reports ?? []) bucket(r.session_id).complete.add(r.booking_id);

    return json({
      event,
      sessions: (sessions ?? []).map((s) => {
        const c = counts.get(s.id);
        return {
          ...s,
          total: total ?? 0,
          arrived: c?.arrived ?? 0,
          absent: c?.absent ?? 0,
          reports_complete: c?.complete.size ?? 0,
        };
      }),
    });
  }

  // ---------------------------------------------------------------------
  // register: the players for a session with attendance, this coach's
  // report and each child's previous ratings
  // ---------------------------------------------------------------------
  if (body.action === "register") {
    if (!body.event_id) return json({ error: "event_id required" }, 400);
    if (!canAccess(body.event_id)) return forbidden();
    const { data: event } = await admin
      .from("events")
      .select("id, title, programme_type, location, event_date, register_closed_at")
      .eq("id", body.event_id)
      .maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);

    let session: Awaited<ReturnType<typeof loadSession>> = null;
    if (body.session_id) {
      session = await loadSession(body.session_id, event.id);
      if (!session) return json({ error: "Session not found on this event" }, 404);
    }

    const { data: bookings } = await admin
      .from("bookings")
      .select("id, child_id, child_name, child_dob, parent_user_id, parent_name, parent_email, parent_phone, medical_notes")
      .eq("event_id", event.id)
      .eq("status", "paid")
      .order("child_name");
    const bookingIds = (bookings ?? []).map((b) => b.id);
    const childIds = [...new Set((bookings ?? []).map((b) => b.child_id).filter(Boolean))] as string[];
    const parentIds = [...new Set((bookings ?? []).map((b) => b.parent_user_id).filter(Boolean))] as string[];

    const [{ data: children }, { data: parents }, { data: attendance }, { data: myReports }, { data: pendingReports }] = await Promise.all([
      childIds.length > 0
        ? admin.from("children")
          .select("id, photo_url, date_of_birth, medical_needs, medical_conditions, medical_details")
          .in("id", childIds)
        : Promise.resolve({ data: [] as Array<{ id: string; photo_url: string | null; date_of_birth: string | null; medical_needs: string | null; medical_conditions: string[] | null; medical_details: string | null }> }),
      parentIds.length > 0
        ? admin.from("profiles").select("user_id, primary_phone, phone").in("user_id", parentIds)
        : Promise.resolve({ data: [] as Array<{ user_id: string; primary_phone: string | null; phone: string | null }> }),
      bookingIds.length > 0
        ? (() => {
          let q = admin.from("session_attendance")
            .select("booking_id, status, marked_at, source")
            .in("booking_id", bookingIds);
          q = body.session_id ? q.eq("session_id", body.session_id) : q.is("session_id", null);
          return q;
        })()
        : Promise.resolve({ data: [] as Array<{ booking_id: string; status: string; marked_at: string; source: string }> }),
      bookingIds.length > 0
        ? (() => {
          let q = admin.from("session_reports")
            .select("id, booking_id, complete, sent_at, ratings, area_notes, comment, updated_at")
            .eq("coach_id", staffId)
            .in("booking_id", bookingIds);
          q = body.session_id ? q.eq("session_id", body.session_id) : q.is("session_id", null);
          return q;
        })()
        : Promise.resolve({ data: [] as Array<{ id: string; booking_id: string; complete: boolean; sent_at: string | null; ratings: unknown; area_notes: unknown; comment: string | null; updated_at: string }> }),
      // Complete, unsent reports by ANY coach — what End session will send.
      bookingIds.length > 0
        ? (() => {
          let q = admin.from("session_reports")
            .select("booking_id")
            .eq("complete", true)
            .is("sent_at", null)
            .in("booking_id", bookingIds);
          q = body.session_id ? q.eq("session_id", body.session_id) : q.is("session_id", null);
          return q;
        })()
        : Promise.resolve({ data: [] as Array<{ booking_id: string }> }),
    ]);

    const childById = new Map((children ?? []).map((c) => [c.id, c]));
    const phoneByParent = new Map((parents ?? []).map((p) => [p.user_id, p.primary_phone || p.phone || null]));
    const attendanceByBooking = new Map((attendance ?? []).map((a) => [a.booking_id, a]));
    const reportByBooking = new Map((myReports ?? []).map((r) => [r.booking_id, r]));
    const pendingByBooking = new Map<string, number>();
    for (const r of pendingReports ?? []) pendingByBooking.set(r.booking_id, (pendingByBooking.get(r.booking_id) ?? 0) + 1);
    const photoByChild = await signPhotos(admin, children ?? []);

    // Previous ratings: the latest complete report on the child before this
    // session, by any coach, ordered by session date then created_at. A
    // report on a session-less event counts on the day it was written.
    const previousByChild = new Map<string, { ratings: unknown; session_date: string | null; created_at: string }>();
    if (childIds.length > 0) {
      // Newest first, bounded: the register polls every 5s, and the latest
      // thirty reports per child comfortably cover a season.
      const { data: history } = await admin
        .from("session_reports")
        .select("id, child_id, event_id, session_id, ratings, created_at")
        .in("child_id", childIds)
        .eq("complete", true)
        .order("created_at", { ascending: false })
        .limit(childIds.length * 30);
      const histSessionIds = [...new Set((history ?? []).map((h) => h.session_id).filter(Boolean))] as string[];
      const dateBySession = new Map<string, string>();
      if (histSessionIds.length > 0) {
        const { data: histSessions } = await admin
          .from("event_sessions").select("id, session_date").in("id", histSessionIds);
        for (const s of histSessions ?? []) dateBySession.set(s.id, s.session_date);
      }
      const thisDate = session?.session_date ?? null;
      const candidates = (history ?? [])
        .filter((h) => {
          // Never this session's own reports.
          if (body.session_id ? h.session_id === body.session_id : (h.event_id === event.id && !h.session_id)) return false;
          if (!thisDate) return true; // session-less: created_at ordering only
          const d = h.session_id ? dateBySession.get(h.session_id) ?? null : londonDate(new Date(h.created_at));
          return !!d && d < thisDate;
        })
        .map((h) => ({
          child_id: h.child_id as string,
          ratings: h.ratings,
          session_date: h.session_id ? dateBySession.get(h.session_id) ?? null : null,
          created_at: h.created_at as string,
          sort_date: h.session_id ? dateBySession.get(h.session_id) ?? "" : londonDate(new Date(h.created_at)),
        }))
        .sort((a, b) => {
          if (thisDate && a.sort_date !== b.sort_date) return a.sort_date < b.sort_date ? 1 : -1;
          return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
        });
      for (const c of candidates) {
        if (!previousByChild.has(c.child_id)) {
          previousByChild.set(c.child_id, { ratings: c.ratings, session_date: c.session_date, created_at: c.created_at });
        }
      }
    }

    const medicalFor = (booking: { medical_notes: string | null }, child?: { medical_needs: string | null; medical_conditions: string[] | null; medical_details: string | null }) => {
      const fromBooking = (booking.medical_notes ?? "").trim();
      if (fromBooking) return fromBooking;
      const parts = [
        (child?.medical_conditions ?? []).join(", "),
        child?.medical_details ?? "",
        child?.medical_needs ?? "",
      ].map((s) => s.trim()).filter(Boolean);
      return parts.length > 0 ? parts.join(" — ") : null;
    };

    const players = (bookings ?? []).map((b) => {
      const child = b.child_id ? childById.get(b.child_id) : undefined;
      const att = attendanceByBooking.get(b.id);
      const rep = reportByBooking.get(b.id);
      return {
        booking_id: b.id,
        child_id: b.child_id,
        child_name: b.child_name,
        age_group: ageGroup(child?.date_of_birth ?? b.child_dob),
        photo_url: b.child_id ? photoByChild.get(b.child_id) ?? null : null,
        medical_notes: medicalFor(b, child),
        parent_name: b.parent_name,
        parent_phone: (b.parent_phone ?? "").trim() || (b.parent_user_id ? phoneByParent.get(b.parent_user_id) ?? null : null),
        parent_email: b.parent_email,
        attendance: att ? { status: att.status, marked_at: att.marked_at, source: att.source } : null,
        report: rep
          ? { id: rep.id, complete: rep.complete, sent_at: rep.sent_at, ratings: rep.ratings, area_notes: rep.area_notes, comment: rep.comment, updated_at: rep.updated_at }
          : null,
        previous: b.child_id ? previousByChild.get(b.child_id) ?? null : null,
        pending_reports: pendingByBooking.get(b.id) ?? 0,
      };
    }).sort((a, b) => a.child_name.localeCompare(b.child_name));

    return json({
      event: { id: event.id, title: event.title, programme_type: event.programme_type, location: event.location, register_closed_at: event.register_closed_at },
      session: session
        ? { id: session.id, session_date: session.session_date, start_time: session.start_time, end_time: session.end_time, venue: session.venue, ended_at: session.ended_at }
        : null,
      players,
    });
  }

  // ---------------------------------------------------------------------
  // attendance: manual arrived / absent / clear for one booking
  // ---------------------------------------------------------------------
  if (body.action === "attendance") {
    if (!body.booking_id || !body.status) return json({ error: "booking_id and status required" }, 400);
    const { data: booking } = await admin
      .from("bookings").select("id, event_id, child_id").eq("id", body.booking_id).maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (!canAccess(booking.event_id)) return forbidden();
    if (body.session_id && !(await loadSession(body.session_id, booking.event_id))) {
      return json({ error: "Session not found on this event" }, 404);
    }

    if (body.status === "clear") {
      let q = admin.from("session_attendance").delete().eq("booking_id", booking.id);
      q = body.session_id ? q.eq("session_id", body.session_id) : q.is("session_id", null);
      const { error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, attendance: null });
    }

    const { attendance, error } = await upsertAttendance(admin, {
      booking_id: booking.id,
      event_id: booking.event_id,
      session_id: body.session_id ?? null,
      child_id: booking.child_id ?? null,
      status: body.status,
      source: "manual",
      marked_by: staffId,
    });
    if (error) return json({ error }, 500);
    return json({ ok: true, attendance });
  }

  // ---------------------------------------------------------------------
  // save_report: this coach's nine-area report for one child and session
  // ---------------------------------------------------------------------
  if (body.action === "save_report") {
    if (!body.booking_id || !body.ratings) return json({ error: "booking_id and ratings required" }, 400);
    for (const key of Object.keys(body.ratings)) {
      if (!AREA_SET.has(key)) return json({ error: `Unknown area: ${key}` }, 400);
    }
    for (const key of Object.keys(body.area_notes ?? {})) {
      if (!AREA_SET.has(key)) return json({ error: `Unknown area: ${key}` }, 400);
    }

    const { data: booking } = await admin
      .from("bookings")
      .select("id, event_id, child_id, child_name, status")
      .eq("id", body.booking_id)
      .maybeSingle();
    if (!booking) return json({ error: "Booking not found" }, 404);
    if (!canAccess(booking.event_id)) return forbidden();
    const { data: event } = await admin
      .from("events").select("id, programme_type").eq("id", booking.event_id).maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);
    if (event.programme_type !== "programme") {
      return json({ error: "Session reports are only written for programmes" }, 400);
    }
    if (body.session_id && !(await loadSession(body.session_id, booking.event_id))) {
      return json({ error: "Session not found on this event" }, 404);
    }

    // Coach's display name for the parent: profile name, else the sign-in email.
    let coachName: string | null = null;
    const { data: profile } = await admin
      .from("profiles").select("first_name, last_name").eq("user_id", staffId).maybeSingle();
    const profileName = [profile?.first_name, profile?.last_name].map((s) => (s ?? "").trim()).filter(Boolean).join(" ");
    if (profileName) coachName = profileName;
    else {
      const { data: userRes } = await admin.auth.admin.getUserById(staffId);
      coachName = userRes?.user?.email ?? null;
    }

    const ratings: Record<string, number> = { ...body.ratings };
    const areaNotes: Record<string, string> = {};
    for (const [k, v] of Object.entries(body.area_notes ?? {})) {
      if (v.trim()) areaNotes[k] = v.trim();
    }
    const complete = LTA_AREAS.every((a) => [1, 2, 3, 4].includes(ratings[a]));
    const comment = body.comment === undefined ? undefined : (body.comment.trim() || null);

    // Find-then-write rather than upsert: the uniqueness is a partial index.
    let existingQ = admin.from("session_reports").select("id")
      .eq("booking_id", booking.id).eq("coach_id", staffId);
    existingQ = body.session_id ? existingQ.eq("session_id", body.session_id) : existingQ.is("session_id", null);
    const { data: existing } = await existingQ.maybeSingle();

    const patch = {
      ratings,
      area_notes: areaNotes,
      complete,
      coach_name: coachName,
      child_name: booking.child_name,
      child_id: booking.child_id ?? null,
      ...(comment === undefined ? {} : { comment }),
    };

    let saved: { id: string; complete: boolean; sent_at: string | null; updated_at: string } | null = null;
    if (existing) {
      const { data, error } = await admin.from("session_reports")
        .update(patch).eq("id", existing.id).select("id, complete, sent_at, updated_at").single();
      if (error) return json({ error: error.message }, 500);
      saved = data;
    } else {
      const { data, error } = await admin.from("session_reports")
        .insert({
          booking_id: booking.id,
          event_id: booking.event_id,
          session_id: body.session_id ?? null,
          coach_id: staffId,
          ...patch,
        })
        .select("id, complete, sent_at, updated_at")
        .single();
      if (error && error.code === "23505") {
        // Two saves raced; the other insert won, so update it.
        const { data: raced } = await existingQ.maybeSingle();
        if (!raced) return json({ error: error.message }, 500);
        const { data: updated, error: updErr } = await admin.from("session_reports")
          .update(patch).eq("id", raced.id).select("id, complete, sent_at, updated_at").single();
        if (updErr) return json({ error: updErr.message }, 500);
        saved = updated;
      } else if (error) {
        return json({ error: error.message }, 500);
      } else {
        saved = data;
      }
    }
    return json({ ok: true, report: saved });
  }

  // ---------------------------------------------------------------------
  // end_session: mark the unmarked absent, stamp the end, send what's due
  // ---------------------------------------------------------------------
  if (body.action === "end_session") {
    if (!body.event_id) return json({ error: "event_id required" }, 400);
    if (!canAccess(body.event_id)) return forbidden();
    const { data: event } = await admin
      .from("events").select("id").eq("id", body.event_id).maybeSingle();
    if (!event) return json({ error: "Event not found" }, 404);
    if (body.session_id && !(await loadSession(body.session_id, event.id))) {
      return json({ error: "Session not found on this event" }, 404);
    }
    const sessionId = body.session_id ?? null;
    const errors: string[] = [];

    // 1. Absences — only bookings on this event, and only where nothing has
    //    been recorded yet, so a late arrival scanned moments ago stays arrived.
    let absent_marked = 0;
    const wanted = [...new Set(body.mark_absent ?? [])];
    if (wanted.length > 0) {
      const { data: bookings } = await admin
        .from("bookings")
        .select("id, child_id")
        .eq("event_id", event.id)
        .eq("status", "paid")
        .in("id", wanted);
      for (const b of bookings ?? []) {
        const { created, error } = await upsertAttendance(admin, {
          booking_id: b.id,
          event_id: event.id,
          session_id: sessionId,
          child_id: b.child_id ?? null,
          status: "absent",
          source: "auto",
          marked_by: staffId,
        }, { onlyIfMissing: true });
        if (error) errors.push(`absent ${b.id}: ${error}`);
        else if (created) absent_marked += 1;
      }
    }

    // 2. Stamp the end.
    const now = new Date().toISOString();
    if (sessionId) {
      const { error } = await admin.from("event_sessions")
        .update({ ended_at: now, ended_by: staffId }).eq("id", sessionId);
      if (error) errors.push(`end stamp: ${error.message}`);
    } else {
      const { error } = await admin.from("events")
        .update({ register_closed_at: now }).eq("id", event.id);
      if (error) errors.push(`end stamp: ${error.message}`);
    }

    // 3 + 4. Reports and absence notes, claim-before-send.
    const sent = await sendDueForSession(admin, { event_id: event.id, session_id: sessionId });
    return json({
      ok: true,
      absent_marked,
      reports_sent: sent.reports_sent,
      absence_emails: sent.absence_emails,
      errors: [...errors, ...sent.errors],
    });
  }

  // =====================================================================
  // Legacy actions kept for the previous hub (same scope rules).
  // =====================================================================

  if (body.action === "events") {
    // Events that actually have paid players, newest first, with sessions.
    const { data: paidEvents } = await admin
      .from("bookings")
      .select("event_id")
      .eq("status", "paid");
    const eventIds = [...new Set((paidEvents ?? []).map((b) => b.event_id))].filter(canAccess);
    if (eventIds.length === 0) return json({ events: [] });

    const [{ data: events }, { data: sessions }] = await Promise.all([
      admin.from("events")
        .select("id, title, event_date, location, programme_type")
        .in("id", eventIds)
        .is("cancelled_at", null)
        .order("event_date", { ascending: false, nullsFirst: false }),
      admin.from("event_sessions")
        .select("id, event_id, session_date, start_time, end_time, venue")
        .in("event_id", eventIds)
        .is("cancelled_at", null)
        .order("session_date"),
    ]);

    const sessionsByEvent = new Map<string, unknown[]>();
    for (const s of sessions ?? []) {
      const list = sessionsByEvent.get(s.event_id) ?? [];
      list.push(s);
      sessionsByEvent.set(s.event_id, list);
    }
    return json({
      events: (events ?? []).map((e) => ({ ...e, sessions: sessionsByEvent.get(e.id) ?? [] })),
    });
  }

  // Live register: mark a player present (same record a QR scan writes, so
  // scans and manual ticks share one attendance list) or clear the mark.
  if (body.action === "mark") {
    if (!body.booking_id || body.present === undefined) {
      return json({ error: "booking_id and present required" }, 400);
    }
    const { data: ticket } = await admin
      .from("tickets").select("id, event_id").eq("booking_id", body.booking_id).maybeSingle();
    if (!ticket) return json({ error: "No ticket for this booking" }, 404);
    if (!canAccess(ticket.event_id)) return forbidden();
    if (body.session_id && !(await loadSession(body.session_id, ticket.event_id))) {
      return json({ error: "Session not found on this event" }, 404);
    }

    const windowStart = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    let existing = admin
      .from("ticket_scans").select("id").eq("ticket_id", ticket.id).eq("result", "admitted");
    existing = body.session_id
      ? existing.eq("session_id", body.session_id)
      : existing.gte("scanned_at", windowStart);
    const { data: rows } = await existing;

    if (body.present) {
      if ((rows ?? []).length === 0) {
        await admin.from("ticket_scans").insert({
          ticket_id: ticket.id,
          session_id: body.session_id ?? null,
          result: "admitted",
          scanned_by: staffId,
        });
      }
    } else if ((rows ?? []).length > 0) {
      await admin.from("ticket_scans").delete().in("id", rows!.map((r) => r.id));
    }
    return json({ ok: true, present: body.present });
  }

  // A coach has just written a session report: tell the parent it's ready.
  // The hub calls this once, after the first save; edits don't re-notify,
  // and the idempotency key stops a retry sending twice.
  if (body.action === "notify_report") {
    if (!body.report_id) return json({ error: "report_id required" }, 400);
    const { data: report } = await admin
      .from("session_reports")
      .select("id, booking_id, event_id, child_name, coach_name, comment, stats")
      .eq("id", body.report_id)
      .maybeSingle();
    if (!report) return json({ error: "Report not found" }, 404);
    if (!canAccess(report.event_id)) return forbidden();

    // Claim the notification before sending: the update only matches an
    // unstamped row, so two calls for the same report can't both send.
    const { data: claimed } = await admin
      .from("session_reports")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", report.id)
      .is("notified_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) return json({ ok: true, already_notified: true });

    const { data: booking } = await admin
      .from("bookings")
      .select("parent_email, parent_name")
      .eq("id", report.booking_id)
      .maybeSingle();
    if (!booking?.parent_email) return json({ error: "No parent email on the booking" }, 404);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ ok: false, error: "RESEND_API_KEY not configured" });

    const { data: ev } = await admin
      .from("events").select("title").eq("id", report.event_id).maybeSingle();

    const labels: Record<string, string> = {
      technique: "Technique", attitude: "Attitude & effort", movement: "Movement", matchplay: "Match play",
    };
    const stats = (report.stats ?? {}) as Record<string, number>;
    const rated = Object.entries(labels)
      .filter(([k]) => (stats[k] ?? 0) > 0)
      .map(([k, label]) => [label, "★".repeat(stats[k]) + "☆".repeat(5 - stats[k])] as [string, string]);

    const first = (booking.parent_name ?? "there").split(" ")[0];
    const unsubToken = await unsubscribeTokenFor(admin, booking.parent_email, "report");
    try {
      await sendEmail({
        to: booking.parent_email,
        subject: `${report.child_name}'s coach report — ${ev?.title ?? "Suffolk Tennis"}`,
        unsubscribe_token: unsubToken ?? undefined,
        idempotency_key: `report-notify-${report.id}`,
        html: brandedEmail({
          unsubscribeUrl: unsubscribeUrlFor(unsubToken),
          title: `${report.child_name}'s session report`,
          preheader: `${report.coach_name ?? "Their coach"} has written up today's session`,
          body:
            emailParagraph(`Hi ${first},`) +
            emailParagraph(`${report.coach_name ?? "The coach"} has written a report on <strong>${report.child_name}</strong>'s session at <strong>${ev?.title ?? "Suffolk Tennis"}</strong>.`) +
            (rated.length > 0 ? emailDetails(rated) : "") +
            (report.comment ? emailParagraph(`<em>“${report.comment}”</em>`) : "") +
            emailButton(`${SITE_URL}/parent-hub?tab=bookings`, "See the full report") +
            emailNote("Every session report is kept in your Parent Hub, so you can look back over the season."),
        }),
      }, { apiKey, unsubscribeBaseUrl: unsubscribeBaseUrl() });
    } catch (e) {
      // Release the claim so a retry can send.
      await admin.from("session_reports").update({ notified_at: null }).eq("id", report.id);
      return json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return json({ ok: true });
  }

  // roster (legacy)
  if (!body.event_id) return json({ error: "event_id required" }, 400);
  if (!canAccess(body.event_id)) return forbidden();

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, child_id, child_name, session_slot, medical_notes, parent_name")
    .eq("event_id", body.event_id)
    .eq("status", "paid")
    .order("child_name");

  // Child profile photos for the register — signed here (service role) so
  // coaches see them without widening the storage policies.
  const childIds = [...new Set((bookings ?? []).map((b) => b.child_id).filter(Boolean))] as string[];
  let photoByChild = new Map<string, string>();
  if (childIds.length > 0) {
    const { data: children } = await admin
      .from("children").select("id, photo_url").in("id", childIds);
    photoByChild = await signPhotos(admin, children ?? []);
  }

  const bookingIds = (bookings ?? []).map((b) => b.id);
  let arrived = new Set<string>();
  if (bookingIds.length > 0) {
    const { data: tickets } = await admin
      .from("tickets").select("id, booking_id").in("booking_id", bookingIds);
    const ticketToBooking = new Map((tickets ?? []).map((t) => [t.id, t.booking_id]));
    if (ticketToBooking.size > 0) {
      let scanQuery = admin
        .from("ticket_scans")
        .select("ticket_id")
        .eq("result", "admitted")
        .in("ticket_id", [...ticketToBooking.keys()]);
      scanQuery = body.session_id
        ? scanQuery.eq("session_id", body.session_id)
        : scanQuery.gte("scanned_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());
      const { data: scans } = await scanQuery;
      arrived = new Set((scans ?? []).map((s) => ticketToBooking.get(s.ticket_id)!));
    }
  }

  // The caller's own reports for these bookings (this session, or session-less).
  let myReports: Record<string, unknown> = {};
  if (bookingIds.length > 0) {
    let reportQuery = admin
      .from("session_reports")
      .select("booking_id, stats, comment")
      .eq("coach_id", staffId)
      .in("booking_id", bookingIds);
    reportQuery = body.session_id
      ? reportQuery.eq("session_id", body.session_id)
      : reportQuery.is("session_id", null);
    const { data: reports } = await reportQuery;
    myReports = Object.fromEntries((reports ?? []).map((r) => [r.booking_id, { stats: r.stats, comment: r.comment }]));
  }

  return json({
    players: (bookings ?? []).map((b) => ({
      booking_id: b.id,
      child_id: b.child_id,
      photo_url: b.child_id ? photoByChild.get(b.child_id) ?? null : null,
      child_name: b.child_name,
      parent_name: b.parent_name,
      session_slot: b.session_slot,
      medical_notes: b.medical_notes,
      arrived: arrived.has(b.id),
      my_report: myReports[b.id] ?? null,
    })),
  });
});
