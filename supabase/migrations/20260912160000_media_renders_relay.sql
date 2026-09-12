-- Media relay for the showcase video (12 Sep 2026).
--
-- The build environment cannot reach api.elevenlabs.io, so the media-relay
-- edge function calls it on our behalf (key in ELEVENLABS_API_KEY secret)
-- and parks each response here, where the build reads it back over SQL.
-- The relay is guarded by app_settings.media_relay_guard, a random token
-- generated here and never committed. Delete the row to switch the relay off.
create table if not exists public.media_renders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  status int,
  content_type text,
  payload jsonb,
  data_base64 text,
  error text,
  created_at timestamptz not null default now()
);
grant all on public.media_renders to service_role;
alter table public.media_renders enable row level security;
do $$ begin
  create policy "Admins read media renders" on public.media_renders
    for select using (public.has_role(auth.uid(), 'admin'));
exception when duplicate_object then null; end $$;

insert into public.app_settings (key, value)
values ('media_relay_guard', encode(gen_random_bytes(24), 'hex'))
on conflict (key) do nothing;
