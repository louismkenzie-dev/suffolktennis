-- Talent ID nominations: a coach, club or school puts a child forward for
-- the Suffolk Rising Stars days through suffolktennis.online/nominate.
--
-- Ollie's ask (29 Sep 2026): "could they go to a link, then it creates
-- database?" So a nomination both keeps its own record — who nominated, why,
-- which day they'd prefer — and, when the child is not already on the county
-- database, adds them to player_roster (source 'nomination') so Ollie can
-- invite the family from the usual picker. The link between the two is
-- roster_id, and roster_match says how it was made.
--
-- Nothing here is written by the browser: the public form calls the
-- submit-nomination function, which validates and writes with the service
-- role. Admins read and update; there is no anon access at all.
create table if not exists public.talent_nominations (
  id uuid primary key default gen_random_uuid(),

  -- The player
  player_first_name text not null,
  player_last_name text not null,
  birth_year integer,
  gender text,
  club text,                       -- club, school or programme they play at

  -- Preferred Talent ID day and session, if the nominator chose one
  event_id uuid references public.events(id) on delete set null,
  session_slot text,

  -- The family, only if the nominator has their details and permission
  parent_name text,
  parent_email text,
  parent_phone text,

  -- Who nominated them
  nominator_name text not null,
  nominator_role text,             -- e.g. "Coach, Ipswich Sports Club"
  nominator_email text not null,
  nominator_phone text,
  reason text,

  -- What happened on the player database
  roster_id uuid references public.player_roster(id) on delete set null,
  roster_match text,               -- 'created' | 'existing' | 'review'

  -- Ollie's follow-up
  status text not null default 'new',   -- 'new' | 'invited' | 'declined'
  admin_notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.talent_nominations.roster_match is
  'created: a new player_roster row was made for this child. existing: they were already on the database (roster_id points at them). review: same name as someone on the database but a different parent email — nothing was created; an admin decides.';

create index if not exists talent_nominations_created_idx on public.talent_nominations (created_at desc);
create index if not exists talent_nominations_status_idx on public.talent_nominations (status);

grant select, update, delete on public.talent_nominations to authenticated;
grant all on public.talent_nominations to service_role;

alter table public.talent_nominations enable row level security;

do $$ begin
  create policy "Admins manage nominations" on public.talent_nominations
    for all to authenticated
    using (public.has_role(auth.uid(), 'admin'))
    with check (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

create trigger talent_nominations_updated_at
  before update on public.talent_nominations
  for each row execute function public.update_updated_at_column();
