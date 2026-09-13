-- A monthly programme plan is a twelve-month commitment, so the parent's
-- acceptance of it is recorded on the booking rather than only implied by the
-- existence of a Stripe subscription. `payment_plan` says which of the two
-- ways to pay they chose; `commitment_accepted_at` is when they ticked the
-- box that spells the commitment out.

alter table public.bookings
  add column if not exists payment_plan text not null default 'full',
  add column if not exists commitment_accepted_at timestamptz;

alter table public.bookings drop constraint if exists bookings_payment_plan_check;
alter table public.bookings
  add constraint bookings_payment_plan_check check (payment_plan in ('full', 'monthly'));

-- A monthly booking without a recorded acceptance should not exist.
alter table public.bookings drop constraint if exists bookings_monthly_needs_consent;
alter table public.bookings
  add constraint bookings_monthly_needs_consent
  check (payment_plan <> 'monthly' or commitment_accepted_at is not null);

comment on column public.bookings.payment_plan is
  'full = one up-front payment; monthly = a committed run of monthly charges.';
comment on column public.bookings.commitment_accepted_at is
  'When the parent accepted the monthly commitment wording. Never null for a monthly plan.';

-- Stripe can redeliver a webhook, and invoice.payment_succeeded arriving twice
-- for the same invoice would count a month that was never paid — which would
-- end a twelve-month commitment after eleven real payments. Remember which
-- invoices have been counted so the tally can only ever move on real money.
alter table public.memberships
  add column if not exists paid_invoice_ids text[] not null default '{}';

comment on column public.memberships.paid_invoice_ids is
  'Stripe invoice ids already counted in months_paid; makes the webhook idempotent.';
