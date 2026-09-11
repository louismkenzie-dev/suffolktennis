# Suffolk sessions fill the LTA timetable automatically

Status: in build, 11 Sep 2026.

## The problem

`SportingTimetable` (Parent Hub → Timetable) reads only `sporting_schedule`,
the table parents type into by hand. A child booked onto a Suffolk Tennis
programme therefore shows 0.0h against every LTA target even though the club
knows exactly when they are on court. Louis: "I want the sessions to
automatically add the data to fill in this per child."

## The shape of the fix

Derive, do not duplicate. Suffolk sessions are NOT copied into
`sporting_schedule`. They are read at load time and merged into the same
in-memory entry list, so:

- a cancelled session or a refunded booking simply stops appearing,
- a moved session moves,
- there is no second copy to drift, and nothing for a parent to delete.

Hand-typed entries keep working exactly as they do now.

## Why an RPC and not a client-side join

`event_sessions` is readable only when the parent can read the parent `events`
row, and that policy needs `visibility = 'public'` OR a `booking_invitations`
row. A booking created by an admin without an invitation (complimentary
places, and every QA booking) has no invitation row, so a direct client join
returns nothing and the timetable would silently stay at zero. Verified on
production: user `a862cc79` reads 12 sessions only because they hold the
admin role; a booking with `invites = 0` would not.

So the read goes through one SECURITY DEFINER function keyed off the booking,
which is the actual proof of entitlement.

## Migration `20260911170000_timetable_auto_sessions.sql`

### 1. Admin override column

```sql
alter table public.events add column if not exists timetable_category text;
alter table public.events add constraint events_timetable_category_check
  check (timetable_category is null or timetable_category in
    ('individual_lesson','squad_training','free_play',
     'tennis_sc','other_sport','official_match','tournament'));
```

`null` means "use the default", which is `squad_training`. A programme is
squad training unless Ollie says otherwise; this column is how he says
otherwise (a 1-to-1 block, a match day, a fitness block).

### 2. `public.timetable_sessions(p_from date, p_to date, p_child_id uuid default null)`

`language sql stable security definer set search_path = public`.

Returns one row per session the child is entitled to attend:

| column | notes |
|---|---|
| `source_id` | `'auto:' \|\| session id \|\| ':' \|\| booking id`, or `'auto:event:' \|\| event id \|\| ':' \|\| booking id` when the event has no sessions. The booking is part of the key because the query fans out per booking: two siblings on one programme are two bookings against the same session rows, and a session-only key collided as a React key. Stable across reloads. |
| `child_id`, `booking_id`, `event_id`, `session_id` | `session_id` null for a session-less event |
| `title` | `events.title` |
| `category` | `coalesce(e.timetable_category, 'squad_training')` |
| `event_date` | `date` |
| `start_time`, `end_time` | `time`, either may be null |
| `duration_minutes` | see below |
| `location` | `session.venue`, else `events.location` |
| `attendance_status` | `'arrived'`, `'absent'` or null, from `session_attendance` |
| `is_tournament` | category = `'tournament'` |

Entitlement, inside the function:

```sql
from bookings b
where b.status = 'paid'
  and b.child_id is not null
  and b.parent_user_id = auth.uid()
  and (p_child_id is null or b.child_id = p_child_id)
```

Parent-only on purpose. `auth.uid()` is null for anon, so anon gets nothing.
Still: `revoke all on function ... from public; grant execute ... to authenticated;`

A booking whose `child_id` is null cannot be attributed to a child and is
skipped. Ollie links those in Admin → People → Player database.

Two branches, unioned:

1. **Sessions** — `event_sessions` where `cancelled_at is null` and
   `session_date between p_from and p_to`.
2. **Session-less events** — events with no `event_sessions` rows at all,
   `cancelled_at is null`, `(event_date at time zone 'Europe/London')::date`
   in range.

`duration_minutes`:

- session with `end_time > start_time` → the difference in minutes
- otherwise → 60
- session-less event → the `event_date`→`end_date` difference **only when
  both fall on the same London date**, capped at 480; otherwise 60. Stops a
  three-day camp reporting 4320 minutes into one week.

Cancelled events are excluded in both branches.

## Client: `src/components/timetable/SportingTimetable.tsx`

- Fetch the RPC over the same window `fetchEntries` already uses (-3 months
  to +12 months) and merge the rows into `entries` as entries carrying
  `auto: true` and `attendance_status`.
- `id` is `source_id`, so React keys stay stable and no auto row can collide
  with a `sporting_schedule` uuid.
- `calcBreakdown` counts an auto entry unless `attendance_status = 'absent'`:
  a child marked absent on the register did not do those hours. Manual
  entries are unaffected (their status is always null).
- Auto entries are read-only: no edit pencil, no delete cross, and clicking
  one must not open `ActivityForm`. `handleDelete` and `setEditingEntry` are
  never reachable for them.
- An auto entry is badged so a parent knows it came from the club and does
  not type a duplicate. An absent one is muted and badged "Absent".
- Weekly, Monthly and Yearly views all read `filteredEntries`, so they
  inherit this with no extra work.

## Admin: `src/components/admin/BookingsPanel.tsx`

The event create/edit form gains one select, "Counts in the LTA timetable
as", covering the seven categories, defaulting to Squad Training (stored as
null). Wired into the create and update payloads and into `openEvent`'s form
hydration.

## Out of scope

No dedupe against hand-typed entries. If a parent already types "Suffolk 10U
squad" for the same slot it will double count until they delete theirs; the
badge on the auto row is what tells them to. Detecting an overlap
automatically risks hiding a genuine second activity, which is worse.

## Verification

- tsc + production build clean.
- The RPC returns the right rows under a real parent JWT, and zero rows for
  another parent's child (a cross-tenant check, run as `d7f528ea` against
  `a862cc79`'s children).
- Playwright at 390 and 1280 against mocked Supabase: hours are non-zero,
  an absent session is excluded from the totals, and an auto entry offers no
  delete control.

## Applied after review

Three verifiers read the build. Fixes folded in before shipping:

- `source_id` now carries the booking id (above). Without it, siblings on one
  programme, or a complimentary booking on top of a paid one, collided on the
  React key and double-counted the hours.
- `toDateStr` returns the LOCAL date. It used `toISOString()`, so under BST
  every entry rendered one day-column right and Sunday's sessions fell out of
  the week entirely. Week, month and year membership now compare bare date
  strings, so no timezone can slip in.
- "All Children" sums each child's LTA target instead of scoring the whole
  family against the first child's age group, which read "target met" when
  neither child had met their own.
- The session-count tiles count the same set the hours do, and say how many
  were missed, rather than reading "3 Sessions" beside "0.0 hrs".
- The tournament planner is drawn from the current year and excludes absences,
  matching the year in its own heading.
- The weekly cell, the default view, carries a visible "Suffolk" label rather
  than relying on a `title` tooltip that never fires on a phone.
