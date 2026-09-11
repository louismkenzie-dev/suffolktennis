# Coach registers and session performance reports — build spec

Agreed with Ollie via Louis, 11 Sep 2026. This is the contract every part is
built to. Front end (Parent, Coach, Admin), the `coach-session` edge function,
`scan-ticket`, and the cron dispatcher all follow it exactly.

## Decisions (do not re-litigate)

- Coach navigation: **Venues → Programme → Session → Register**. Venues page
  shows only venues with a session in the last 14 days or next 42 days, with an
  "All venues" toggle. Under a venue: programmes first, then one-off events.
- Coaches see **only programmes/events they are assigned to** via
  `event_coaches`; admins see everything. Admin assigns coaches on the
  programme/event form from **accounts holding the coach role**.
- Attendance states: **Arrived / Absent / Not marked**, each Arrived/Absent
  timestamped. A QR scan marks Arrived (source `scan`) automatically. Show the
  arrival time on the row, **amber if after the session start time**.
- Register refreshes every **5 seconds** while open (polling, not realtime).
- QR scanner: a floating **Scan** button on the register opens the camera in a
  sheet with the session pre-selected; the register stays underneath and
  updates as each child is scanned.
- Session report rates the **nine LTA characteristics** on the **LTA 1–4
  scale** (1 Excelling, 2 Consistent, 3 Progressing, 4 Next Step Focus), one
  overall comment, optional note per area. **Complete = all nine rated.**
  The Session Report button is **red when incomplete, green when complete**.
  The separate "Progress report" tab is removed.
- Reports are only for **programmes**. One-off events get registers only.
- Sending: **End session** button sends every complete, unsent report at once
  and, after a confirmation listing unmarked children, marks them absent and
  emails their parents a short absence note. Anything still unsent also goes
  automatically **2 hours after the session end time** (cron).
- Editing after send: allowed, no second email; parent sees "Updated".
- Emails: report email is a short note + "View report" button (no ratings in
  the email). Coach's name is shown. Absent parents get a short absence email.
- Parent: standalone report page at `/report/:id` (sign-in required) **and** a
  Reports view per child in the Parent Hub. Graph: **radar of the nine areas,
  latest vs previous ghosted, plus a small trend line per area**. Trend copy is
  plain and neutral ("Serving up from Progressing to Consistent").
- Legacy four-star reports (rows with empty `ratings`) are **hidden** from the
  new parent UI.
- Parents only see a report once it has been **sent** (`sent_at` set) — a
  complete-but-unsent report is still the coach's draft.
- Register row shows: name, **age group**, **medical flag**, arrival time,
  **report status dot** (red/green). Profile sheet shows: photo, medical notes,
  parent phone (tap to call), Arrived/Absent buttons, Session Report button,
  and the child's **previous session ratings**.

## Data model (already applied to the database)

- `event_coaches(event_id, user_id)` — assignment. RLS: staff read, admin manage.
- `session_attendance(id, booking_id, event_id, session_id|null, child_id,
  status 'arrived'|'absent', source 'scan'|'manual'|'auto', marked_at,
  marked_by, absence_notified_at)` — unique per (booking_id, session_id) and
  per booking when session_id is null. RLS: staff + own parent read; service
  role writes.
- `session_reports` + `ratings jsonb` ({"<area name>": 1..4}), `area_notes
  jsonb` ({"<area name>": "note"}), `complete boolean`, `sent_at timestamptz`.
  Existing columns stay (`stats` is legacy, `comment` is the overall comment,
  `coach_id`, `coach_name`, `child_id`, `child_name`, `booking_id`,
  `event_id`, `session_id`, `notified_at`, `created_at`, `updated_at`).
  Unique per (booking_id, session_id, coach_id).
- `event_sessions.ended_at, ended_by`; `events.register_closed_at` (for
  session-less events).
- `ticket_scans` remains the audit log of scans.

## The nine areas (exact strings — used as JSON keys everywhere)

```
Confident to Attack     — Proactive, composed, loose
Comfortable in Rally    — Consistency, repeatable, contact point, tempo
Chases Every Ball       — Defending qualities, determined, adaptable
Creative in Play        — Skillfulness, chopper grip, feel, variety, adaptable
Athletic Qualities      — Agility, balance, coordination, speed
Reads the Ball          — Anticipation, perception, tennis specific movement
Loves the Game          — Inner drive, maximises training opportunity
Loves to Compete        — Competitive, commitment, relish challenge
Serving                 — Grip, balance, rhythm, timing, throwing action
```
Levels: `1 Excelling`, `2 Consistent`, `3 Progressing`, `4 Next Step Focus`.
Shared front-end constants live in `src/lib/lta.ts` (created by the front-end
agent that owns it — see ownership): `LTA_AREAS: Array<{name, descriptor}>`,
`LTA_LEVELS: Array<{value, label, tone}>`, `levelLabel(n)`, `isComplete(ratings)`.

## Edge function contract — `coach-session` (POST, JWT, coach or admin)

All responses are JSON. Errors: `{ error: string }` with 4xx/5xx. Every action
is scoped: a coach may only touch events they are assigned to (403 otherwise);
admins may touch anything. Existing actions `events`, `roster`, `mark`,
`notify_report` are kept unchanged for backwards compatibility.

```
{ action: "venues", all?: boolean }
→ { venues: Array<{ name: string; upcoming: number; next_date: string|null; programmes: number; events: number }> }
   Venues = distinct session venue (event_sessions.venue, falling back to
   events.location) across the caller's events. Without `all`, only venues
   with a session dated within [today-14d, today+42d]. Sorted by next_date.

{ action: "programmes", venue: string }
→ { items: Array<{ id; title; programme_type: "programme"|"event"; meeting_cadence; location;
                   next_session: { id; session_date; start_time; end_time } | null;
                   session_count: number; upcoming_count: number; cancelled_at }> }
   Programmes first (by next session), then events. Session-less events are
   included with next_session null and session_count 0.

{ action: "sessions", event_id }
→ { event: { id; title; programme_type; location; register_closed_at }, 
    sessions: Array<{ id; session_date; start_time; end_time; venue; cancelled_at; ended_at;
                      total: number; arrived: number; absent: number; reports_complete: number }> }
   Ordered by date ascending. `total` = paid bookings on the event.

{ action: "register", event_id, session_id? }
→ { event: { id; title; programme_type; location; register_closed_at },
    session: { id; session_date; start_time; end_time; venue; ended_at } | null,
    players: Array<{
      booking_id; child_id; child_name; age_group: string|null; photo_url: string|null;
      medical_notes: string|null; parent_name; parent_phone: string|null; parent_email;
      attendance: { status: "arrived"|"absent"; marked_at: string; source } | null;
      report: { id; complete: boolean; sent_at: string|null; ratings; area_notes; comment; updated_at } | null;   // THIS coach's report for this session
      previous: { ratings; session_date: string|null; created_at } | null;   // latest complete report for the child before this session, any coach
      pending_reports: number;   // complete, unsent reports on this booking by ANY coach — what End session will send
    }> }
   Sorted by child_name. `age_group` from children.date_of_birth (LTA year
   groups: age on 1 Jan → 8U..18U). parent_phone from the booking's
   parent_phone, else the parent's profile primary_phone/phone.

{ action: "attendance", booking_id, session_id?, status: "arrived"|"absent"|"clear" }
→ { ok: true, attendance: {...}|null }
   Upserts session_attendance (source manual, marked_by caller). "clear" deletes the row.

{ action: "save_report", booking_id, session_id?, ratings: Record<string, 1|2|3|4>, area_notes?: Record<string,string>, comment?: string }
→ { ok: true, report: { id; complete; sent_at; updated_at } }
   Upsert this coach's report (coach_name from profile first+last name, else
   email). complete = all nine areas present with a value 1..4. Rejects for
   events that are not programmes (400).

{ action: "end_session", event_id, session_id?, mark_absent: string[] /* booking_ids */ }
→ { ok: true, absent_marked: number, reports_sent: number, absence_emails: number, errors: string[] }
   1. session_attendance upsert 'absent' (source auto) for each booking_id in
      mark_absent that has no row yet. 2. stamps event_sessions.ended_at /
      events.register_closed_at. 3. sends every complete session report for
      this session with sent_at null (any coach) and stamps sent_at.
   4. sends an absence email for every 'absent' row with absence_notified_at
      null and stamps it. Email sending is claim-before-send (update … where
      sent_at is null … returning) so retries never double-send.
```

## Edge function — `scan-ticket`

On `admitted`, also upsert `session_attendance` `{status: 'arrived', source: 'scan', marked_by}`
for the booking and `session_id` (or session_id null for session-less events).
A `duplicate` result must NOT change an existing attendance row. Same scope
as `coach-session` (coaches only for assigned events) and `session_id` must
belong to the ticket's event; every outcome is a 200 `{ok, result, message,
player}` — results `unknown`, `forbidden`, `wrong_event`, `rejected_void`,
`rejected_unpaid`, `duplicate`, `admitted`.

## Edge function — `session-reports-dispatch` (cron every 10 min, guard token)

Guard token: `sr_9b2e7c1d4f8a3e6b0c5d7f2a9e1b4c8d` in the JSON body. Starts
from the pending rows (complete reports with sent_at null, absent rows with
absence_notified_at null), groups them by session, and sends for every session
whose end passed at least 2 hours ago (end_time, else start_time + 2h; London
wall clock) — whatever the session's date, so late-written reports still go.
Same claim-before-send rule. Session-less events: register_closed_at, else
events.event_date + 2h. At most 80 emails per run.

## Emails (shared builder in `supabase/functions/_shared/reportEmails.ts`)

- Report ready: subject `"{child first name}'s session performance report is ready!"`
  Body: Hi {parent first name}, {coach name} has written up {child}'s session
  at {event title} on {long date}. Button **View report** →
  `${SITE_URL}/report/${report.id}`. Note: reports are kept in the Parent Hub
  under the child's profile. Idempotency key `report-sent-${report.id}`.
- Absence: subject `"We missed {child first name} today"`. Body: a short,
  warm note that {child} was marked absent from {event title} on {date}; if
  that's wrong reply to this email. Idempotency key `absence-${attendance.id}`.
- Use `brandedEmail`, `emailParagraph`, `emailButton`, `emailNote`,
  `unsubscribeTokenFor(admin, email, "report")` exactly like `notify_report`.

## Front end

### Routes (already in `src/App.tsx`)
```
/coach                          Venues
/coach/venue/:venue             Programmes at that venue (venue is encodeURIComponent'd name)
/coach/programme/:eventId       Sessions of a programme/event
/coach/register/:sessionId      Register for a session
/coach/register/event/:eventId  Register for a session-less event
/report/:reportId               Parent-facing session report (standalone)
```
All `/coach/*` render `src/pages/CoachHub.tsx` which switches on the route.

### Coach UI (owner: coach agent) — `src/pages/CoachHub.tsx`, `src/components/coach/**`
- Uses `AppShell` (role "coach") with nav: Register (id "register") and
  Scanner (to "/admin/scan"). On sub-pages pass `back` to AppShell.
- Venues: simple cards (name, "3 programmes · next Sat 20 Sep") using
  `ListGroup/ListRow` or card grid; "All venues" toggle (Chip).
- Programmes: rows with title, cadence, next session; events under a
  "Events" section.
- Sessions: rows with date block, time, "12 players · 8 here · 1 absent",
  reports "5/12"; Today badge; ended state.
- Register: header with event title, date/time, counts pill; floating **Scan**
  button (bottom-right, above the bottom bar) that opens a sheet with
  `html5-qrcode` (see `src/pages/AdminScan.tsx` for the working camera code),
  posts `scan-ticket` with the session_id, shows the result banner inside the
  sheet, and refreshes the register. Rows: 44px status control (green tick =
  arrived, red = absent, grey = unmarked), avatar, name, age chip, medical
  flag, arrival time (amber if after start), report dot (only for programmes;
  red incomplete / green complete). Tapping the row opens the **profile
  sheet**: photo, name, age, medical notes, parent name + tap-to-call, Arrived /
  Absent buttons (segmented), Session Report button (red/green, programmes
  only) → report sheet. Report sheet: nine areas, each a 4-chip level picker
  (LTA colours), optional note per area (collapsed "Add note"), overall
  comment, Save. Show previous ratings under each area ("Last time: Consistent").
- **End session** button in the register header: confirmation dialog lists
  unmarked children ("These will be marked absent and their parents told") and
  shows how many reports will be sent; calls `end_session`. After ending, show
  an "Ended 3.45pm" badge; the register stays editable.
- Poll `register` every 5s while the page is visible (pause when hidden).
- Only programmes show report affordances.

### Parent UI (owner: parent agent)
- `src/pages/ReportPage.tsx` (`FlowShell`, back to `/parent-hub?tab=children`):
  loads the report by id (supabase from `session_reports`, RLS), the event,
  session, then all complete reports for the same `child_id` ordered by
  session date for trends. Shows: eyebrow "Session report", title event, date,
  coach name, "Updated" badge if updated_at > sent_at + 1 min; radar chart
  (recharts `RadarChart`) latest vs previous (ghosted); per-area rows with
  level pill, note, and change vs previous ("up from Progressing"); overall
  comment; small trend line per area (recharts `LineChart`, 1..4 inverted so
  up = better); list of earlier reports linking to `/report/:id`.
- `src/components/children/ChildReportsView.tsx`: same content for the hub,
  taking a child id; the child card in `MyChildrenSection` gains a **Reports**
  button (secondary) next to Performance plan that opens it (drill-down like
  the performance plan, with a back link).
- Attendance in the hub: in `ChildReportsView` show a compact attendance line
  per session ("Arrived 1.28pm" / "Absent") from `session_attendance`.
- Charts: brand-neutral, primary blue for latest, grey for previous; the LTA
  scale is inverted for display (1 = best at the outer edge).

### Admin UI (owner: admin agent) — `src/components/admin/BookingsPanel.tsx`
- Programme/event form gains **Coaches**: a checklist of accounts with the
  coach role (`user_roles` role = 'coach' joined to `profiles` for names;
  admins with the coach role appear too). Saved to `event_coaches` on create
  and edit (delete rows not ticked, insert new). Detail header shows assigned
  coaches as small avatars/names, with an Edit shortcut.

## File ownership (agents must not edit files outside their list)
- Functions agent: `supabase/functions/coach-session/index.ts`,
  `supabase/functions/scan-ticket/index.ts`,
  `supabase/functions/session-reports-dispatch/index.ts` (new),
  `supabase/functions/_shared/reportEmails.ts` (new), `docs/SUPABASE.md` (append a section).
- Coach agent: `src/pages/CoachHub.tsx`, `src/components/coach/**` (new), `src/lib/lta.ts` (new).
- Parent agent: `src/pages/ReportPage.tsx` (new), `src/components/children/ChildReportsView.tsx` (new),
  `src/components/children/MyChildrenSection.tsx`, `src/components/parent/BookingDetailDialog.tsx` (hide legacy, link to report).
  May import `src/lib/lta.ts` (shared with coach agent — if it does not exist yet, create it with the constants above; identical content).
- Admin agent: `src/components/admin/BookingsPanel.tsx` only.
- Shared primitives in `src/components/app/*` are read-only for all agents.
