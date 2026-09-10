-- Lessons carried over from the dance platform (handover §7.2, §8.1):
--
-- 1. Sessions get rained off or moved. A cancelled session keeps its row (so
--    reports and scans against it stay attached) and gains a reason; a moved
--    session keeps the original date so the parent email can say "was X, now
--    Y". Money never moves automatically — refunds stay an explicit per-booking
--    admin action.
-- 2. One-off events with no sessions can be cancelled as a whole.
-- 3. Anything that sends an email on a schedule or a retry needs a CLAIM, so
--    a second run can't send twice: register alerts get a claim table, and
--    report notifications get a stamp.

alter table public.event_sessions
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text,
  add column if not exists moved_from_date date,
  add column if not exists moved_from_start time,
  add column if not exists moved_at timestamptz;

alter table public.events
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancel_reason text;

-- Set when the parent has been told a report exists; the notifier claims it
-- before sending and clears it if Resend fails, so a retry is safe.
alter table public.session_reports
  add column if not exists notified_at timestamptz;

-- Register alerts: one claim per (session, kind). The alert function inserts
-- the claim first and only emails if the insert succeeded, then stamps
-- sent_at; on a send failure it deletes the claim so the next run retries.
create table if not exists public.register_alerts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions(id) on delete cascade,
  kind text not null,
  claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (session_id, kind)
);

alter table public.register_alerts enable row level security;

create policy "Admins read register alerts"
  on public.register_alerts for select
  using (public.has_role(auth.uid(), 'admin'::app_role));
