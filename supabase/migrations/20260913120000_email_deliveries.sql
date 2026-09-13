-- What actually happened to every email we sent.
--
-- Resend tells us whether the recipient's mail server accepted a message, but
-- until now we threw the message id away at send time, so nothing could be
-- looked up afterwards. One row per sent message, stamped with the Resend id
-- and linked back to the invitation it belongs to, gives the admin screens a
-- Delivered / Bounced badge per parent and makes a bad address obvious.
--
-- The row is created by the sending function and then moved forward by
-- email-delivery-sync, which polls Resend every ten minutes.

create table if not exists public.email_deliveries (
  id uuid primary key default gen_random_uuid(),
  -- Resend's own id for the message; the join key when we poll it back.
  resend_id text not null unique,
  recipient text not null,
  subject text,
  -- 'booking_invitation' | 'booking_reminder' | 'coach_invitation' | ...
  purpose text,
  invitation_id uuid references public.booking_invitations(id) on delete cascade,
  coach_invitation_id uuid references public.coach_invitations(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  -- Resend's last_event, normalised: sent, delivered, delivery_delayed,
  -- bounced, complained, opened, clicked.
  status text not null default 'sent',
  status_at timestamptz not null default now(),
  detail text,
  sent_at timestamptz not null default now(),
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_deliveries_invitation_idx on public.email_deliveries (invitation_id) where invitation_id is not null;
create index if not exists email_deliveries_coach_invitation_idx on public.email_deliveries (coach_invitation_id) where coach_invitation_id is not null;
create index if not exists email_deliveries_recipient_idx on public.email_deliveries (lower(recipient));
-- The sync's work list: anything not yet settled, newest first.
create index if not exists email_deliveries_pending_idx on public.email_deliveries (sent_at desc) where status in ('sent', 'scheduled', 'delivery_delayed');

alter table public.email_deliveries enable row level security;

-- Admins read; only the service role writes (the sending and sync functions).
drop policy if exists "Admins read email deliveries" on public.email_deliveries;
create policy "Admins read email deliveries" on public.email_deliveries
  for select using (public.has_role(auth.uid(), 'admin'::app_role));

-- Later news must not be overwritten by an earlier event arriving late: a
-- delivered message that later bounces stays bounced, and a stale 'sent'
-- never pushes a settled row backwards.
create or replace function public.email_delivery_rank(_status text)
returns int language sql immutable as $$
  select case _status
    when 'scheduled' then 1
    when 'sent' then 2
    when 'delivery_delayed' then 3
    when 'delivered' then 4
    when 'opened' then 5
    when 'clicked' then 6
    when 'complained' then 7
    when 'bounced' then 8
    when 'failed' then 9
    else 0
  end;
$$;

comment on table public.email_deliveries is
  'One row per email sent through Resend, carrying its delivery outcome.';
