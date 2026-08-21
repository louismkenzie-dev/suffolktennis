-- Coaches author formal progress reports (the same player_reports the
-- Parent Hub renders) directly from the Coach hub, per child. event_id and
-- coach_id record provenance and anchor the one-report-per-coach-per-event
-- upsert; PDF-imported reports keep both null.
-- (Applied to the remote DB 21 Aug 2026 via MCP; kept here as source of truth.)
ALTER TABLE public.player_reports
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coach_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS player_reports_coach_event_unique
  ON public.player_reports (child_id, event_id, coach_id)
  WHERE event_id IS NOT NULL AND coach_id IS NOT NULL;

DO $$ BEGIN
  CREATE POLICY "Coaches view reports" ON public.player_reports
    FOR SELECT USING (public.has_role(auth.uid(), 'coach'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coaches insert own reports" ON public.player_reports
    FOR INSERT WITH CHECK (
      public.has_role(auth.uid(), 'coach') AND coach_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Coaches update own reports" ON public.player_reports
    FOR UPDATE USING (
      public.has_role(auth.uid(), 'coach') AND coach_id = auth.uid()
    ) WITH CHECK (coach_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
