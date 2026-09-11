-- Suffolk sessions fill the LTA timetable automatically (Louis, 11 Sep 2026).
--
-- Parent Hub → Timetable reads only `sporting_schedule`, the table parents
-- type into by hand, so a child booked onto a programme shows 0.0h against
-- every LTA target even though the club knows exactly when they are on court.
--
-- The fix derives rather than duplicates: nothing is copied into
-- `sporting_schedule`, the rows are read at load time and merged in memory.
-- A cancelled session or a refunded booking simply stops appearing, a moved
-- session moves, and there is no second copy for a parent to delete.
--
-- It has to be a SECURITY DEFINER function rather than a client-side join:
-- `event_sessions` is readable only when the parent can read the parent
-- `events` row, and that policy wants `visibility = 'public'` OR a
-- `booking_invitations` row. Admin-created bookings (complimentary places,
-- every QA booking) have no invitation, so a direct join returns nothing and
-- the timetable would silently stay at zero. The booking is the real proof of
-- entitlement, so the function keys off that.

-- 1. Admin override. Null means "use the default", which is squad training:
--    a programme is squad training unless Ollie says otherwise, and this
--    column is how he says otherwise (a 1-to-1 block, a match day, fitness).
alter table public.events add column if not exists timetable_category text;

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_timetable_category_check'
  ) then
    alter table public.events add constraint events_timetable_category_check
      check (timetable_category is null or timetable_category in
        ('individual_lesson', 'squad_training', 'free_play',
         'tennis_sc', 'other_sport', 'official_match', 'tournament'));
  end if;
end $$;

comment on column public.events.timetable_category is
  'Which LTA timetable category this event''s sessions count as. Null = squad_training.';

-- 2. The read. Dropped first because `create or replace` cannot change a
--    function's return type, and this signature may yet gain columns.
drop function if exists public.timetable_sessions(date, date, uuid);

create or replace function public.timetable_sessions(
  p_from date,
  p_to date,
  p_child_id uuid default null
)
returns table (
  source_id text,
  child_id uuid,
  booking_id uuid,
  event_id uuid,
  session_id uuid,
  title text,
  category text,
  event_date date,
  start_time time,
  end_time time,
  duration_minutes integer,
  location text,
  attendance_status text,
  is_tournament boolean
)
language sql
stable
security definer
set search_path = public
as $$
  -- Branch 1: programmes and camps that have dated session rows.
  select
    -- Keyed on the booking too, not just the session: two children of the
    -- same parent on one programme are two bookings against the same session
    -- rows, and a shared id would collide as a React key and merge them.
    'auto:' || s.id::text || ':' || b.id::text,
    b.child_id,
    b.id,
    e.id,
    s.id,
    e.title,
    coalesce(e.timetable_category, 'squad_training'),
    s.session_date,
    s.start_time,
    s.end_time,
    -- A session with no times, or times that do not make sense, is an hour:
    -- the club's default slot, and better than dropping the row entirely.
    case
      when s.start_time is not null and s.end_time is not null and s.end_time > s.start_time
        then (extract(epoch from (s.end_time - s.start_time)) / 60)::integer
      else 60
    end,
    coalesce(s.venue, e.location),
    sa.status,
    coalesce(e.timetable_category, 'squad_training') = 'tournament'
  from public.bookings b
  join public.events e on e.id = b.event_id
  join public.event_sessions s on s.event_id = e.id
  -- A session-less event's attendance row carries session_id null, so the
  -- join has to be null-safe rather than plain equality.
  left join public.session_attendance sa
    on sa.booking_id = b.id and sa.session_id is not distinct from s.id
  where b.status = 'paid'
    and b.child_id is not null
    and b.parent_user_id = auth.uid()
    and (p_child_id is null or b.child_id = p_child_id)
    and e.cancelled_at is null
    and s.cancelled_at is null
    and s.session_date between p_from and p_to

  union all

  -- Branch 2: one-off events that were never broken into sessions. The event
  -- row itself is the session.
  select
    'auto:event:' || e.id::text || ':' || b.id::text,
    b.child_id,
    b.id,
    e.id,
    null::uuid,
    e.title,
    coalesce(e.timetable_category, 'squad_training'),
    (e.event_date at time zone 'Europe/London')::date,
    (e.event_date at time zone 'Europe/London')::time,
    case
      when e.end_date is not null
       and (e.end_date at time zone 'Europe/London')::date
         = (e.event_date at time zone 'Europe/London')::date
        then (e.end_date at time zone 'Europe/London')::time
      else null::time
    end,
    -- Only trust end_date when it lands on the same London date, and cap it
    -- at eight hours. Otherwise a three-day camp reports 4320 minutes into a
    -- single week and every LTA target turns green on one booking.
    case
      when e.end_date is not null
       and e.end_date > e.event_date
       and (e.end_date at time zone 'Europe/London')::date
         = (e.event_date at time zone 'Europe/London')::date
        then least(480, (extract(epoch from (e.end_date - e.event_date)) / 60)::integer)
      else 60
    end,
    e.location,
    sa.status,
    coalesce(e.timetable_category, 'squad_training') = 'tournament'
  from public.bookings b
  join public.events e on e.id = b.event_id
  left join public.session_attendance sa
    on sa.booking_id = b.id and sa.session_id is null
  where b.status = 'paid'
    and b.child_id is not null
    and b.parent_user_id = auth.uid()
    and (p_child_id is null or b.child_id = p_child_id)
    and e.cancelled_at is null
    and not exists (
      select 1 from public.event_sessions es where es.event_id = e.id
    )
    and (e.event_date at time zone 'Europe/London')::date between p_from and p_to;
$$;

-- Parent-only on purpose: auth.uid() is null for anon, so anon gets nothing
-- even before the grants. The revoke is belt and braces on a definer function.
revoke all on function public.timetable_sessions(date, date, uuid) from public;
-- Supabase's default privileges grant EXECUTE to anon on every new function in
-- public, and that grant survives the revoke from PUBLIC, so name it directly.
revoke all on function public.timetable_sessions(date, date, uuid) from anon;
grant execute on function public.timetable_sessions(date, date, uuid) to authenticated;

comment on function public.timetable_sessions(date, date, uuid) is
  'Sessions the caller''s children are entitled to attend, for merging into the LTA timetable. Entitlement is the paid booking, not event visibility.';
