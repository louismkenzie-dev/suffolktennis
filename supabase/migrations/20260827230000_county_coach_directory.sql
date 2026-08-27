-- Suffolk county coach directory.
--
-- Deliberately separate from `coaches`, which is the public "meet the team"
-- table read by anyone on the website. This one holds the LTA affiliation
-- report: real names, personal email addresses, mobile numbers, DBS and
-- accreditation dates. None of it may ever be publicly readable, so every
-- policy here is admin-only, with a single exception for a coach reading
-- their own row once coach logins exist.

create table if not exists public.county_coaches (
  id                 uuid primary key default gen_random_uuid(),
  lta_number         text not null unique,
  coach_code         text,
  first_name         text not null,
  last_name          text not null,
  gender             text,
  email              text not null,
  mobile             text,
  home_phone         text,
  work_phone         text,
  -- "Registration" or "Coach Licence" on the LTA report.
  accreditation_tier text,
  -- LTA coaching qualification level, 0-5.
  qualification_level smallint,
  accreditation_expires date,
  dbs_date           date,
  swit_expires       date,
  never_call         boolean not null default false,
  -- The coach's marketing preference as held by the LTA. This is the LTA's
  -- own consent record, not ours: our sending decisions run off
  -- email_preferences. Kept so an admin can see it before a broadcast.
  lta_marketing_opt_in boolean,
  county             text not null default 'Suffolk',
  notes              text,
  active             boolean not null default true,
  -- Reserved for the coach-login work: when a coach gets an account this
  -- points at it, and the self-read policy below starts applying.
  linked_user_id     uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists county_coaches_email_key
  on public.county_coaches (lower(email));
create index if not exists county_coaches_last_name_idx
  on public.county_coaches (last_name, first_name);

-- One row per club a coach is affiliated with: the LTA report lists a coach
-- once per organisation, and several coach at up to seven clubs.
create table if not exists public.county_coach_affiliations (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.county_coaches(id) on delete cascade,
  organisation  text not null,
  role          text,
  created_at    timestamptz not null default now(),
  unique (coach_id, organisation, role)
);

create index if not exists county_coach_affiliations_coach_idx
  on public.county_coach_affiliations (coach_id);
create index if not exists county_coach_affiliations_org_idx
  on public.county_coach_affiliations (organisation);

alter table public.county_coaches enable row level security;
alter table public.county_coach_affiliations enable row level security;

drop policy if exists "Admins manage county coaches" on public.county_coaches;
create policy "Admins manage county coaches" on public.county_coaches
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Coach reads own directory row" on public.county_coaches;
create policy "Coach reads own directory row" on public.county_coaches
  for select to authenticated
  using (linked_user_id = auth.uid());

drop policy if exists "Admins manage coach affiliations" on public.county_coach_affiliations;
create policy "Admins manage coach affiliations" on public.county_coach_affiliations
  for all to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Coach reads own affiliations" on public.county_coach_affiliations;
create policy "Coach reads own affiliations" on public.county_coach_affiliations
  for select to authenticated
  using (exists (
    select 1 from public.county_coaches c
    where c.id = coach_id and c.linked_user_id = auth.uid()
  ));

drop trigger if exists county_coaches_touch on public.county_coaches;
create trigger county_coaches_touch
  before update on public.county_coaches
  for each row execute function public.update_updated_at_column();
