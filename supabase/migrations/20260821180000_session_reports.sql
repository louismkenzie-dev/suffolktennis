-- Per-session coach feedback: quick ratings + a note for a child on a session,
-- written by coaches (or admins) from the Coach hub. Distinct from the formal
-- LTA player_reports. Parents see reports for their own bookings.
-- (Applied to the remote DB 21 Aug 2026 via MCP; kept here as the source of truth.)
CREATE TABLE IF NOT EXISTS public.session_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.event_sessions(id) ON DELETE SET NULL,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  child_name text NOT NULL,
  coach_id uuid NOT NULL,
  coach_name text,
  -- Flexible 1-5 ratings, e.g. {"technique":4,"attitude":5,"movement":3,"matchplay":4}
  stats jsonb NOT NULL DEFAULT '{}',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS session_reports_unique_with_session
  ON public.session_reports (booking_id, session_id, coach_id) WHERE session_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS session_reports_unique_no_session
  ON public.session_reports (booking_id, coach_id) WHERE session_id IS NULL;
CREATE INDEX IF NOT EXISTS session_reports_booking_idx ON public.session_reports (booking_id);
CREATE INDEX IF NOT EXISTS session_reports_event_idx ON public.session_reports (event_id, session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_reports TO authenticated;
GRANT ALL ON public.session_reports TO service_role;

ALTER TABLE public.session_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Staff read session reports" ON public.session_reports
    FOR SELECT USING (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'coach')
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id = session_reports.booking_id AND b.parent_user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Coaches write own reports" ON public.session_reports
    FOR INSERT WITH CHECK (
      coach_id = auth.uid()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coaches update own reports" ON public.session_reports
    FOR UPDATE USING (
      coach_id = auth.uid()
      AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coach'))
    ) WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins manage session reports" ON public.session_reports
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER session_reports_updated_at
  BEFORE UPDATE ON public.session_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
