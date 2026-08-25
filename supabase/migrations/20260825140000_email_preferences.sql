-- One-click unsubscribe for bulk/campaign email.
--
-- Each address gets an unguessable token that goes in its own copy of the
-- email, so a link can only ever unsubscribe the person it was sent to.
-- Transactional mail (verification codes, booking confirmations, tickets)
-- deliberately carries no unsubscribe link — those are service messages.
CREATE TABLE IF NOT EXISTS public.email_preferences (
  email           text PRIMARY KEY,
  unsub_token     uuid NOT NULL DEFAULT gen_random_uuid(),
  unsubscribed_at timestamptz,
  resubscribed_at timestamptz,
  source          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS email_preferences_token_idx
  ON public.email_preferences (unsub_token);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_preferences FROM anon, authenticated;
GRANT ALL ON public.email_preferences TO service_role;

DO $$ BEGIN
  CREATE POLICY "Admins can read email preferences" ON public.email_preferences
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Seed a token for every address already on the roster.
INSERT INTO public.email_preferences (email, source)
SELECT DISTINCT lower(trim(contact_email)), 'player_roster'
FROM public.player_roster
WHERE contact_email IS NOT NULL AND trim(contact_email) <> ''
  AND contact_email LIKE '%@%.%'
ON CONFLICT (email) DO NOTHING;
