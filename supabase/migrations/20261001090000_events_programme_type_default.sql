-- 20260910120000 renamed programme_type values to 'event' / 'programme' and
-- tightened the check, but left the column default at the old 'one_off'.
-- Any insert that didn't set programme_type itself — the Website → Events
-- page does not — was rejected with "violates check constraint
-- events_programme_type_check". A plain website event is an 'event'.
alter table public.events alter column programme_type set default 'event';
