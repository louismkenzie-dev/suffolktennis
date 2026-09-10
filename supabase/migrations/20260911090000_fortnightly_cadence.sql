-- Programmes can meet weekly, fortnightly or monthly (Ollie, 11 Sep 2026).
-- The cadence is display-only: it labels the programme and seeds the
-- session generator in the admin; the up-front fee is unchanged.
alter table public.events drop constraint if exists events_meeting_cadence_check;
alter table public.events
  add constraint events_meeting_cadence_check
  check (meeting_cadence in ('weekly', 'fortnightly', 'monthly'));
