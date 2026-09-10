-- Events are now one of two things (Ollie, 10 Sep 2026):
--   event      — a single session or camp, priced or free
--   programme  — a season squad, £250 paid up front, meeting weekly or monthly
-- Monthly billing is gone: every programme is one payment. Once a child has
-- paid for a programme, any other programme they're invited to is included at
-- no extra charge (a "complimentary" invitation); admins can also grant that
-- by hand.

-- 1. Rename the type values. Widen the check first so existing rows stay valid
--    while they're rewritten, then tighten it to the two new values.
alter table public.events drop constraint if exists events_programme_type_check;
alter table public.events add constraint events_programme_type_check
  check (programme_type in ('event', 'programme', 'one_off', 'monthly_programme'));

update public.events set programme_type = 'event'     where programme_type = 'one_off';
update public.events set programme_type = 'programme' where programme_type = 'monthly_programme';

alter table public.events drop constraint events_programme_type_check;
alter table public.events add constraint events_programme_type_check
  check (programme_type in ('event', 'programme'));

-- 2. How often a programme meets (display only — billing is a single payment),
--    and an explicit free flag for events so "no price" is a decision rather
--    than an omission.
alter table public.events
  add column if not exists meeting_cadence text
    check (meeting_cadence in ('weekly', 'monthly')),
  add column if not exists is_free boolean not null default false;

-- Existing programmes were monthly subscriptions: carry the cadence across and
-- give them the standard up-front price where none is set. Programmes have no
-- capacity ("on programme take off capacity").
update public.events
set meeting_cadence = coalesce(meeting_cadence, 'monthly'),
    price_pence     = coalesce(price_pence, 25000),
    capacity        = null
where programme_type = 'programme';

-- Events with no price were already treated as free by the booking page.
update public.events
set is_free = true
where programme_type = 'event' and price_pence is null;

-- 3. Complimentary places: flagged on the invitation when it is sent, carried
--    onto the booking when it is confirmed.
alter table public.booking_invitations
  add column if not exists complimentary boolean not null default false,
  add column if not exists complimentary_reason text;

alter table public.bookings
  add column if not exists complimentary boolean not null default false;

-- 4. Eligibility: a child with a paid (not complimentary) programme place.
--    Used by the invitation sender to decide automatically, and by the admin
--    invite picker to show who qualifies.
create or replace function public.child_has_paid_programme(p_child_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.bookings b
    join public.events e on e.id = b.event_id
    where b.child_id = p_child_id
      and b.status = 'paid'
      and not b.complimentary
      and e.programme_type = 'programme'
  );
$$;

revoke all on function public.child_has_paid_programme(uuid) from public;
grant execute on function public.child_has_paid_programme(uuid) to authenticated, service_role;
