
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS poster_url text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS end_date timestamptz,
  ADD COLUMN IF NOT EXISTS cost text,
  ADD COLUMN IF NOT EXISTS sign_up_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sign_up_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS session_slots jsonb NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='events' AND policyname='Public can view events') THEN
    CREATE POLICY "Public can view events" ON public.events FOR SELECT TO anon, authenticated USING (true);
  END IF;
END $$;
GRANT SELECT ON public.events TO anon;

CREATE TABLE IF NOT EXISTS public.event_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  parent_name text NOT NULL,
  parent_email text NOT NULL,
  parent_phone text,
  parent_club text,
  player_coach text,
  child_name text NOT NULL,
  child_dob date,
  child_gender text,
  session_slot text,
  medical_notes text,
  photo_consent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.event_signups TO anon, authenticated;
GRANT ALL ON public.event_signups TO service_role;
ALTER TABLE public.event_signups ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_signups' AND policyname='Anyone can insert signup') THEN
    CREATE POLICY "Anyone can insert signup" ON public.event_signups FOR INSERT TO anon, authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_signups' AND policyname='Admins can view signups') THEN
    CREATE POLICY "Admins can view signups" ON public.event_signups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='event_signups' AND policyname='Admins can delete signups') THEN
    CREATE POLICY "Admins can delete signups" ON public.event_signups FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
