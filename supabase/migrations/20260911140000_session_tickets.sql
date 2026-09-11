-- One QR code per child per session.
--
-- Until now a booking had a single season ticket (public.tickets): the same
-- QR for every session of a programme, so the coach had to tell the scanner
-- which session they were on. A session ticket carries the session in the
-- code itself, so a scan resolves child AND session with nothing to choose.
--
-- Rows are created lazily by the reminder dispatcher (12 hours before a
-- session) rather than up front, so a 30-week programme does not mint
-- thousands of codes nobody has asked for yet.

create table if not exists public.session_tickets (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  -- Null for a one-off event with no session rows: one ticket for the day.
  session_id uuid references public.event_sessions(id) on delete cascade,
  child_id uuid references public.children(id) on delete set null,
  qr_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  status text not null default 'active' check (status in ('active', 'void')),
  reminder_12h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- One ticket per booking per session; and one per booking for session-less
-- events. Partial indexes because null never equals null in a unique index.
create unique index if not exists session_tickets_booking_session_key
  on public.session_tickets (booking_id, session_id) where session_id is not null;
create unique index if not exists session_tickets_booking_only_key
  on public.session_tickets (booking_id) where session_id is null;
create index if not exists session_tickets_session_idx on public.session_tickets (session_id);
create index if not exists session_tickets_event_idx on public.session_tickets (event_id);

alter table public.session_tickets enable row level security;

-- Staff read every ticket (the scanner resolves any code).
drop policy if exists "Staff can view session tickets" on public.session_tickets;
create policy "Staff can view session tickets" on public.session_tickets
  for select using (
    exists (select 1 from public.user_roles r
            where r.user_id = auth.uid() and r.role in ('admin', 'coach'))
  );

-- A parent reads the tickets on their own bookings.
drop policy if exists "Parents can view their own session tickets" on public.session_tickets;
create policy "Parents can view their own session tickets" on public.session_tickets
  for select using (
    exists (select 1 from public.bookings b
            where b.id = session_tickets.booking_id and b.parent_user_id = auth.uid())
  );

-- Admins can void a ticket by hand if one is ever compromised.
drop policy if exists "Admins can manage session tickets" on public.session_tickets;
create policy "Admins can manage session tickets" on public.session_tickets
  for all using (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  ) with check (
    exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin')
  );

comment on table public.session_tickets is
  'Per-session entry QR codes. The token identifies the booking AND the session, so scan-ticket needs no session picker. Created by session-reminders 12h before a session.';
