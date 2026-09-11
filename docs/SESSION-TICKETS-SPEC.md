# Per-session QR tickets, auto-resolving scans and session reminders

Agreed with Louis, 11 Sep 2026. Three changes that go together:

1. **One QR code per child per session.** The code identifies the session, so
   the scanner never asks the coach which session they are on.
2. **Reminder emails 12 hours and 1 hour before** each session, each linking
   the parent to that session's QR code.
3. **Scanning resolves everything from the code**: the child is admitted,
   marked arrived on the right register, and shown to the coach.

## Data model (migration `20260911140000_session_tickets.sql`, already applied)

```
session_tickets(
  id, booking_id, event_id, session_id | null, child_id | null,
  qr_token text unique default encode(gen_random_bytes(24),'hex'),
  status 'active'|'void', reminder_12h_sent_at, reminder_1h_sent_at, created_at)
```
Unique per `(booking_id, session_id)`, and per `booking_id` where
`session_id is null` (a one-off event with no session rows gets one ticket for
the day). RLS: staff read all, a parent reads their own bookings' tickets,
admins manage. Rows are created **lazily** by `session-reminders`, so a long
programme does not mint codes months ahead.

`public.tickets` (the old one-per-booking season ticket) stays exactly as it
is. Every ticket already emailed to a parent keeps working — see the
resolution order below.

## `scan-ticket` — no session picker

Body: `{ qr_token, session_id? }`. `session_id` is now only a **hint**, used
when a legacy season ticket cannot be resolved from the clock. The session is
resolved in this order:

1. **`session_tickets.qr_token`** → booking and session, authoritative.
   `resolved_from: "qr"`.
2. **`tickets.qr_token`** (legacy season ticket) → booking and event, then the
   session is resolved from the clock: the event's uncancelled session whose
   window `[start − 2h, end + 2h]` contains now, nearest start first.
   `resolved_from: "clock"`. If the event has no session rows at all, the
   session is null (session-less event) and that is correct, not an error.
   If the event has sessions but none is running, fall back to `session_id`
   from the body when it belongs to this event (`resolved_from: "hint"`),
   otherwise return `result: "no_session"`.
3. No match in either table → `result: "unknown"`.

Everything else is unchanged: the coach must be assigned to the event
(admins may scan anything), a void ticket, an unpaid booking or a past-due
membership is rejected, a second scan for the same session is a `duplicate`
and never overwrites the original arrival time, and an admitted scan upserts
`session_attendance` `{status: 'arrived', source: 'scan'}` for the resolved
session.

**Every outcome is HTTP 200** with this body (supabase-js hides non-2xx
bodies from the client):

```
{ ok, result, message,
  player: { child_name, parent_name, session_slot, has_medical_notes, event_title,
            age_group: string|null, medical_notes: string|null },
  session: { id, session_date, start_time, end_time, venue } | null,
  event: { id, title } | null,
  booking_id: string | null,
  resolved_from: "qr" | "clock" | "hint" | null }
```
`result` is one of `admitted`, `duplicate`, `rejected_void`,
`rejected_unpaid`, `wrong_session`, `no_session`, `forbidden`, `unknown`.
`wrong_session` is a real code for a session that is not happening now — last
week's reminder email, or a session since cancelled. It is checked after the
void and unpaid gates, so a refunded child is turned away rather than told to
be marked in by hand.
`ticket_scans.result` is CHECK-constrained to
`admitted|rejected_unpaid|rejected_void|duplicate`, so the new results must
**not** be written to it.

## `session-reminders` — new cron function

Guard token `st_7c4e9a1f6b2d8e3a5c0f9b4d7e1a6c2f` in the JSON body,
`verify_jwt` false, run by pg_cron every 10 minutes (mirrors
`register-alerts` and `session-reports-dispatch`).

Each run:
1. Find uncancelled sessions starting within the next **12h 45m** (London
   wall clock), and one-off events with no session rows whose `event_date` is
   within the same window.
2. For every **paid** booking on those events, ensure a `session_tickets` row
   exists (find-then-insert with a 23505 retry — the unique index is partial,
   so PostgREST cannot upsert onto it).
3. Send the **12-hour** email when the session starts in 60–765 minutes and
   `reminder_12h_sent_at` is null; send the **1-hour** email when it starts in
   0–75 minutes and `reminder_1h_sent_at` is null. Claim before sending
   (stamp the column `where … is null … returning`, clear it if Resend
   throws), exactly like `_shared/reportEmails.ts`.
4. Skip a booking with no parent email; never email for a cancelled session
   or a cancelled event.
5. Cap at 80 emails per run and return `truncated: true` when it stops early.

Returns `{ sessions_due, tickets_created, reminders_12h, reminders_1h, truncated, errors }`.

### Email copy
Subject, 12 hours out: `{Child}'s tennis session tomorrow` — or
`… today` when the session is on the same London date as the send.
Subject, 1 hour out: `{Child}'s session starts at {1.30pm}`.

Body: a short note naming the event, the London date, the time range and the
venue, then the button **Show entry QR code** →
`${SITE_URL}/ticket/${qr_token}`, then a note that the code is for this
session only and the coach scans it on arrival. Use `brandedEmail`,
`emailParagraph`, `emailDetails`, `emailButton`, `emailNote` and
`unsubscribeTokenFor(admin, email, "reminder")`. Idempotency keys
`reminder-12h-${session_ticket.id}` and `reminder-1h-${session_ticket.id}`.

The QR image itself is **not** embedded in the email: Gmail strips data-URI
images and blocks remote ones by default, and a reminder whose code fails to
render is worse than a button. The button opens the ticket page, which draws
the QR locally.

## `get-booking-status` — serve a session ticket

`{ qr_token }` now matches `session_tickets` first, then `tickets`. When the
token is a session ticket the response adds:

```
session: { id, session_date, start_time, end_time, venue } | null
ticket: { qr_token, status, scope: "session" | "season" }
```
A season token keeps today's behaviour (`scope: "season"`, `session: null`,
plus `upcoming_sessions`). A session token returns `upcoming_sessions: []` —
the page is about one session.

## Front end

### `src/pages/TicketPage.tsx` (parent)
With a session ticket: the header names the session (long date · time range ·
venue), the QR is captioned "Entry code for this session", and the upcoming
sessions list is hidden. With a season ticket: exactly as today. Keep the
ticket visual (navy header, perforation, player name, Valid badge).

### `src/pages/AdminScan.tsx`
Delete the session `<Select>` and its `sessions` state and query. The result
panel gains a line naming the session the scan was recorded against
("Marked arrived · Sat 12 Sep, 2–4pm · Culford"), and shows the age group and
medical flag when present. A `no_session` result explains that the code is a
season ticket and no session of that programme is running now.

### `src/components/coach/ScanSheet.tsx` + `RegisterPage.tsx`
Stop sending `session_id` as authority — pass the open register's session id
only as the fallback hint. When the scan resolves a **different** session
from the one whose register is open, show an amber banner
("Scanned into Sat 19 Sep — that is not this register") and do not pretend
the row updated. Refresh the register on any scan that resolved to the open
session.

## Shipped 11 Sep 2026

`session_tickets` migration applied; `scan-ticket` v16, `session-reminders` v1
(verify_jwt false) and `get-booking-status` v16 deployed; pg_cron job
`session-reminders` runs every 10 minutes.

## File ownership (agents must not edit outside their list)
- **Functions**: `supabase/functions/scan-ticket/index.ts`,
  `supabase/functions/session-reminders/index.ts` (new),
  `supabase/functions/get-booking-status/index.ts`,
  `supabase/functions/_shared/sessionTickets.ts` (new — ensureSessionTicket,
  resolveScanTarget, London time helpers), `docs/SUPABASE.md` (append).
- **Scanner UI**: `src/pages/AdminScan.tsx`,
  `src/components/coach/ScanSheet.tsx`, `src/components/coach/RegisterPage.tsx`.
- **Ticket UI**: `src/pages/TicketPage.tsx`.

Shared primitives in `src/components/app/*` and
`supabase/functions/_shared/{adminAuth,resend,emailLayout,emailPrefs,reportEmails}.ts`
are **read-only** for every agent.
