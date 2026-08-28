-- Make a roster player mailable the moment they are added.
--
-- The admin-email `recipients` action builds its list from email_preferences
-- and only borrows names from player_roster, so a player added by hand (or by
-- a fresh CSV import) whose parent address had never been mailed did not
-- appear in the group picker at all. Seeding a preferences row on insert or
-- when a contact address is filled in closes that gap for every route into the
-- roster.
--
-- on conflict do nothing is deliberate: it must never resurrect somebody who
-- has already unsubscribed.
create or replace function public.seed_roster_email_preference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_email is not null and btrim(new.contact_email) <> '' then
    insert into public.email_preferences (email, source)
    values (lower(btrim(new.contact_email)), 'player_roster')
    on conflict (email) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists player_roster_email_prefs on public.player_roster;
create trigger player_roster_email_prefs
  after insert or update of contact_email on public.player_roster
  for each row execute function public.seed_roster_email_preference();
