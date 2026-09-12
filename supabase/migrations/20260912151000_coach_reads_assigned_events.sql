-- A coach can read the events (and, through "Sessions follow event
-- visibility", the sessions) they are assigned to. Programmes are private,
-- so until now a coach opening a register deep link (/coach/register/:id)
-- could not resolve the session's event and saw "Session not found".
drop policy if exists "Public events are visible to all" on public.events;
create policy "Public events are visible to all" on public.events
  for select to anon, authenticated using (
    visibility = 'public'
    or public.has_role(auth.uid(), 'admin')
    or public.coach_on_event(auth.uid(), id)
    or exists (select 1 from public.booking_invitations bi where bi.event_id = events.id and bi.parent_user_id = auth.uid())
  );
