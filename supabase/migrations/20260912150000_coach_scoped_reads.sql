-- Coaches only see the registers they are assigned to; admins see all
-- (Ollie, 12 Sep 2026).
--
-- The coach-session and scan-ticket functions already scope every action to
-- event_coaches. This closes the same gap at the table level: a coach's own
-- JWT could previously read every attendance row, session report, session
-- ticket and coach assignment in the county through the API. Now each of
-- those reads is limited to events the coach is assigned to (plus their own
-- rows). Admin and parent clauses are unchanged.

create or replace function public.coach_on_event(_user_id uuid, _event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select _event_id is not null and exists (
    select 1 from public.event_coaches ec
    where ec.event_id = _event_id and ec.user_id = _user_id
  );
$$;
revoke all on function public.coach_on_event(uuid, uuid) from public;
grant execute on function public.coach_on_event(uuid, uuid) to authenticated;

-- Coaches read only their own assignment rows.
drop policy if exists "Staff read event coaches" on public.event_coaches;
create policy "Staff read event coaches" on public.event_coaches
  for select using (public.has_role(auth.uid(), 'admin') or user_id = auth.uid());

drop policy if exists "Staff and parents read attendance" on public.session_attendance;
create policy "Staff and parents read attendance" on public.session_attendance
  for select using (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'coach') and public.coach_on_event(auth.uid(), event_id))
    or exists (select 1 from public.bookings b where b.id = session_attendance.booking_id and b.parent_user_id = auth.uid())
  );

drop policy if exists "Staff read session reports" on public.session_reports;
create policy "Staff read session reports" on public.session_reports
  for select using (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'coach') and (coach_id = auth.uid() or public.coach_on_event(auth.uid(), event_id)))
    or exists (select 1 from public.bookings b where b.id = session_reports.booking_id and b.parent_user_id = auth.uid())
  );

drop policy if exists "Staff can view session tickets" on public.session_tickets;
create policy "Staff can view session tickets" on public.session_tickets
  for select using (
    public.has_role(auth.uid(), 'admin')
    or (public.has_role(auth.uid(), 'coach') and public.coach_on_event(auth.uid(), event_id))
  );

-- Formal progress reports: a coach sees the ones they wrote and those on
-- programmes they are assigned to. Admins and parents keep their own policies.
drop policy if exists "Coaches view reports" on public.player_reports;
create policy "Coaches view reports" on public.player_reports
  for select using (
    public.has_role(auth.uid(), 'coach')
    and (coach_id = auth.uid() or public.coach_on_event(auth.uid(), event_id))
  );
