-- Refunding a place without taking the place away.
--
-- Until now a refund meant `bookings.status = 'refunded'` and a voided
-- ticket: the money went back and the child lost their place. That is right
-- when someone withdraws, and wrong when Suffolk Tennis decides to stop
-- charging for a programme people have already paid for (Ollie made the 18U
-- Girls squad free of charge on 19 Sep 2026, after five families had paid).
--
-- Such a booking stays `paid` and becomes complimentary, so the ticket, the
-- register and the calendar feed all keep working. The refund therefore needs
-- somewhere of its own to be recorded — the status can no longer carry it.
alter table public.bookings
  add column if not exists refunded_at timestamptz,
  add column if not exists refunded_amount_pence integer,
  add column if not exists stripe_refund_id text;

comment on column public.bookings.refunded_at is
  'When money was returned. Set for every refund, including one where the child keeps their place (status stays paid and complimentary becomes true).';
comment on column public.bookings.refunded_amount_pence is
  'How much was returned, in pence. May be less than amount_pence for a partial refund.';
comment on column public.bookings.stripe_refund_id is
  'The Stripe refund object, on the connected account the charge was taken on.';

-- Refunds are rare and always looked up by booking, so no index is needed;
-- this partial one only serves the admin ledger''s "refunded" filter.
create index if not exists bookings_refunded_at_idx
  on public.bookings (refunded_at desc)
  where refunded_at is not null;
