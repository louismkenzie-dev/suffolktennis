-- Let an admin prune the managed coach group by hand.
--
-- The first version of this trigger re-added a coach to the group on any
-- update to their row, which would silently undo a deliberate removal — Ollie
-- wants to mail a subset of the 89 without losing the directory itself. Now
-- membership is only ever *added* when a coach first appears or is
-- reactivated; a plain edit (phone number, DBS date, an LTA re-import) leaves
-- group membership exactly as the admin left it.
--
-- The directory stays the master list either way: emptying or deleting a
-- group never touches county_coaches.
create or replace function public.sync_county_coach_email_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
  joining boolean;
begin
  select id into gid from public.email_groups where managed_key = 'county_coaches';

  -- A coach "joins" on insert, on reactivation, or when their address changes.
  joining := tg_op = 'INSERT'
    or (tg_op = 'UPDATE' and new.active
        and (not old.active or lower(old.email) is distinct from lower(new.email)));

  if tg_op <> 'DELETE' and new.active then
    -- Always keep a preferences row so the coach has an unsubscribe token.
    -- do nothing on conflict: never resurrect someone who has unsubscribed.
    insert into public.email_preferences (email, source)
    values (lower(new.email), 'coach_directory')
    on conflict (email) do nothing;

    if gid is not null and joining then
      insert into public.email_group_members (group_id, email)
      values (gid, lower(new.email))
      on conflict do nothing;
    end if;
  end if;

  if gid is not null then
    if tg_op = 'UPDATE' and (not new.active or lower(old.email) is distinct from lower(new.email)) then
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
