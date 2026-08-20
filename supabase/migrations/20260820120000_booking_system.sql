-- Booking system: invitations, bookings, payments, memberships, QR tickets.
--
-- Requirements (Ollie, Aug 2026):
--  - Public vs private events. Private events are invite-only: admins select
--    players and send invitations; only invited parents can view/book them.
--  - Invitation links go straight to the booking page — no account required.
--  - One-off bookable events (county training, camps, workshops) and the
--    8U/9U monthly programme: a Stripe subscription charging monthly, with
--    the parent committed to the full programme. Admin sets each month's
--    session date as the programme runs.
--  - Every paid booking issues a QR ticket scanned by staff at the venue.
--    Unpaid or payment-failed bookings have no valid ticket. Failed payments
--    are flagged for admins to chase (no automatic cancellation).
--
-- Payments architecture mirrors The Dance Exclusive: Stripe Connect direct
-- charges on the client's connected account using the platform's API keys,
-- with a platform application fee. The sandbox/live switch is server-side in
-- app_settings ('payments_mode'), never chosen by the client.

-- ============================================================
-- App settings (server-authoritative payments mode switch)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins can read settings" ON public.app_settings
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins can update settings" ON public.app_settings
    FOR UPDATE USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.app_settings (key, value)
VALUES ('payments_mode', 'sandbox')
ON CONFLICT (key) DO NOTHING;

-- Stripe customer ids live on profiles, per the reference implementation.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- ============================================================
-- Events: visibility, pricing, programme structure
-- ============================================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private')),
  ADD COLUMN IF NOT EXISTS programme_type text NOT NULL DEFAULT 'one_off'
    CHECK (programme_type IN ('one_off', 'monthly_programme')),
  ADD COLUMN IF NOT EXISTS price_pence integer,
  ADD COLUMN IF NOT EXISTS monthly_amount_pence integer,
  ADD COLUMN IF NOT EXISTS programme_months integer;

-- ============================================================
-- Event sessions (the 8U/9U programme's monthly dates; camp days)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  start_time time,
  end_time time,
  venue text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_sessions_event_idx ON public.event_sessions (event_id, session_date);

GRANT SELECT ON public.event_sessions TO anon, authenticated;
GRANT ALL ON public.event_sessions TO service_role;

ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Sessions follow event visibility" ON public.event_sessions
    FOR SELECT TO anon, authenticated
    USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_sessions.event_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage sessions" ON public.event_sessions
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- Booking invitations (tokenized links, admin-issued)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.booking_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  child_name text,
  parent_user_id uuid,
  parent_email text NOT NULL,
  parent_name text,
  status text NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'opened', 'booked', 'revoked', 'expired')),
  invited_by uuid,
  sent_at timestamptz,
  reminded_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, child_id, parent_email)
);

CREATE INDEX IF NOT EXISTS booking_invitations_event_idx ON public.booking_invitations (event_id);
CREATE INDEX IF NOT EXISTS booking_invitations_parent_idx ON public.booking_invitations (parent_user_id);
CREATE INDEX IF NOT EXISTS booking_invitations_email_idx ON public.booking_invitations (lower(parent_email));

GRANT SELECT ON public.booking_invitations TO authenticated;
GRANT ALL ON public.booking_invitations TO service_role;

ALTER TABLE public.booking_invitations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Parents view own invitations" ON public.booking_invitations
    FOR SELECT USING (auth.uid() = parent_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage invitations" ON public.booking_invitations
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER booking_invitations_updated_at
  BEFORE UPDATE ON public.booking_invitations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Replace the unconditional event read policies (must come after
-- booking_invitations exists, since the new policy references it):
-- private events are visible only to admins and to signed-in parents
-- holding an invitation. Anonymous invitees see private events through
-- the get-invitation edge function, which runs service-role and is
-- keyed by the invitation token.
DROP POLICY IF EXISTS "Public can view events" ON public.events;
DROP POLICY IF EXISTS "Anyone authenticated can read events" ON public.events;
CREATE POLICY "Public events are visible to all" ON public.events
  FOR SELECT TO anon, authenticated
  USING (
    visibility = 'public'
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.booking_invitations bi
      WHERE bi.event_id = events.id AND bi.parent_user_id = auth.uid()
    )
  );

-- ============================================================
-- Bookings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  invitation_id uuid REFERENCES public.booking_invitations(id) ON DELETE SET NULL,
  parent_user_id uuid,
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  child_name text NOT NULL,
  child_dob date,
  session_slot text,
  medical_notes text,
  photo_consent boolean NOT NULL DEFAULT false,
  amount_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'payment_failed', 'cancelled', 'refunded')),
  stripe_env text NOT NULL DEFAULT 'sandbox' CHECK (stripe_env IN ('sandbox', 'live')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  membership_id uuid,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_event_idx ON public.bookings (event_id);
CREATE INDEX IF NOT EXISTS bookings_parent_idx ON public.bookings (parent_user_id);
CREATE INDEX IF NOT EXISTS bookings_email_idx ON public.bookings (lower(parent_email));
CREATE UNIQUE INDEX IF NOT EXISTS bookings_checkout_session_unique
  ON public.bookings (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Parents view own bookings" ON public.bookings
    FOR SELECT USING (auth.uid() = parent_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage bookings" ON public.bookings
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Memberships (8U/9U monthly programme: Stripe subscription,
-- committed to the full programme; failures flagged for admin chase)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  parent_user_id uuid,
  parent_email text NOT NULL,
  child_name text NOT NULL,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text,
  stripe_env text NOT NULL DEFAULT 'sandbox' CHECK (stripe_env IN ('sandbox', 'live')),
  monthly_amount_pence integer NOT NULL,
  months_total integer NOT NULL,
  months_paid integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'incomplete'
    CHECK (status IN ('incomplete', 'active', 'past_due', 'completed', 'cancelled')),
  last_payment_failed_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS memberships_subscription_unique
  ON public.memberships (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS memberships_event_idx ON public.memberships (event_id);
CREATE INDEX IF NOT EXISTS memberships_parent_idx ON public.memberships (parent_user_id);

GRANT SELECT ON public.memberships TO authenticated;
GRANT ALL ON public.memberships TO service_role;

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Parents view own memberships" ON public.memberships
    FOR SELECT USING (auth.uid() = parent_user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage memberships" ON public.memberships
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER memberships_updated_at
  BEFORE UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_membership_fk
  FOREIGN KEY (membership_id) REFERENCES public.memberships(id) ON DELETE SET NULL;

-- ============================================================
-- Tickets (QR entry passes) and scans (arrival register)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  qr_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'void')),
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_event_idx ON public.tickets (event_id);

GRANT SELECT ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Parents view own tickets" ON public.tickets
    FOR SELECT USING (EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = tickets.booking_id AND b.parent_user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage tickets" ON public.tickets
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.ticket_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL,
  result text NOT NULL CHECK (result IN ('admitted', 'rejected_unpaid', 'rejected_void', 'duplicate')),
  scanned_by uuid,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_scans_ticket_idx ON public.ticket_scans (ticket_id, session_id);

GRANT SELECT ON public.ticket_scans TO authenticated;
GRANT ALL ON public.ticket_scans TO service_role;

ALTER TABLE public.ticket_scans ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage scans" ON public.ticket_scans
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
