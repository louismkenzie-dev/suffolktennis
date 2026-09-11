-- Coach registers and per-session performance reports (Ollie, 11 Sep 2026).
--
-- 1. event_coaches: which coach accounts run a programme/event. Coaches only
--    see what they are assigned to; admins see everything.
-- 2. session_attendance: one row per child per session with a timestamped
--    status. A QR scan writes 'arrived' (source scan); the register writes
--    'arrived' or 'absent' by hand; End session writes 'absent' for anyone
--    unmarked (source auto). ticket_scans stays as the security audit log.
-- 3. session_reports gains the nine LTA characteristics (1 = Excelling …
--    4 = Next Step Focus), optional notes per area, a completeness flag and a
--    sent stamp for the parent email. The old four-star `stats` stays for
--    legacy rows, which the new UI hides.
-- 4. Sessions (and session-less events) record when the coach ended them.

create table if not exists public.event_coaches (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
grant select, insert, delete on public.event_coaches to authenticated;
grant all on public.event_coaches to service_role;
alter table public.event_coaches enable row level security;
do $$ begin
  create policy "Staff read event coaches" on public.event_coaches
    for select using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'coach'));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Admins manage event coaches" on public.event_coaches
    for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

create table if not exists public.session_attendance (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  session_id uuid references public.event_sessions(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  status text not null check (status in ('arrived', 'absent')),
  source text not null default 'manual' check (source in ('scan', 'manual', 'auto')),
  marked_at timestamptz not null default now(),
  marked_by uuid,
  absence_notified_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists session_attendance_booking_session
  on public.session_attendance (booking_id, session_id) where session_id is not null;
create unique index if not exists session_attendance_booking_event
  on public.session_attendance (booking_id) where session_id is null;
create index if not exists session_attendance_session_idx on public.session_attendance (session_id);
create index if not exists session_attendance_event_idx on public.session_attendance (event_id);
grant select on public.session_attendance to authenticated;
grant all on public.session_attendance to service_role;
alter table public.session_attendance enable row level security;
do $$ begin
  create policy "Staff and parents read attendance" on public.session_attendance
    for select using (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'coach')
      or exists (select 1 from public.bookings b where b.id = session_attendance.booking_id and b.parent_user_id = auth.uid())
    );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "Admins manage attendance" on public.session_attendance
    for all using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

alter table public.session_reports
  add column if not exists ratings jsonb not null default '{}'::jsonb,
  add column if not exists area_notes jsonb not null default '{}'::jsonb,
  add column if not exists complete boolean not null default false,
  add column if not exists sent_at timestamptz;
create index if not exists session_reports_child_complete_idx
  on public.session_reports (child_id, created_at) where complete;

alter table public.event_sessions
  add column if not exists ended_at timestamptz,
  add column if not exists ended_by uuid;
alter table public.events
  add column if not exists register_closed_at timestamptz;
