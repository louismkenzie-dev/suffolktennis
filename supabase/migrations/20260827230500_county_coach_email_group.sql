-- Keeps the coach directory and the broadcast system in step.
--
-- Two things have to be true before an admin can email the coaches:
--   1. every coach has a row in email_preferences, because that is where the
--      unsubscribe token lives and what resolveAudience() reads; and
--   2. there is an email group whose membership tracks the directory, so the
--      list cannot drift as coaches are added or deactivated.
-- Both are maintained by trigger rather than by the import script, so they
-- stay correct when a coach is added by hand in the admin panel later.

-- A group with a managed_key is maintained by the database, not by hand.
alter table public.email_groups
  add column if not exists managed_key text;

create unique index if not exists email_groups_managed_key_idx
  on public.email_groups (managed_key) where managed_key is not null;

-- Adopt the "Suffolk Coaches" group an admin had already created by hand
-- rather than leaving two near-identical groups in the picker. Members added
-- by hand are left alone; the trigger only ever adds and removes directory
-- coaches.
update public.email_groups
   set managed_key = 'county_coaches',
       description = coalesce(description,
         'Every active coach in the county directory. Membership is maintained automatically — add or deactivate a coach in the Coaches tab and this group follows.')
 where managed_key is null
   and lower(name) = 'suffolk coaches';

insert into public.email_groups (name, description, managed_key)
select 'Suffolk coaches',
       'Every active coach in the county directory. Membership is maintained automatically — add or deactivate a coach in the Coaches tab and this group follows.',
       'county_coaches'
where not exists (select 1 from public.email_groups where managed_key = 'county_coaches');

create or replace function public.sync_county_coach_email_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select id into gid from public.email_groups where managed_key = 'county_coaches';

  -- Adding or updating a coach: make sure they can be emailed and unsubscribed.
  if (tg_op = 'INSERT' or tg_op = 'UPDATE') and new.active then
    -- do nothing on conflict: never resurrect someone who has unsubscribed.
    insert into public.email_preferences (email, source)
    values (lower(new.email), 'coach_directory')
    on conflict (email) do nothing;

    if gid is not null then
      insert into public.email_group_members (group_id, email)
      values (gid, lower(new.email))
      on conflict do nothing;
    end if;
  end if;

  -- Deactivated, or their address changed: drop the stale membership row.
  if gid is not null then
    if tg_op = 'UPDATE' and (not new.active or lower(old.email) <> lower(new.email)) then
      delete from public.email_group_members
      where group_id = gid and email = lower(old.email);
    elsif tg_op = 'DELETE' then
      delete from public.email_group_members
      where group_id = gid and email = lower(old.email);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists county_coaches_email_sync on public.county_coaches;
create trigger county_coaches_email_sync
  after insert or update or delete on public.county_coaches
  for each row execute function public.sync_county_coach_email_group();
