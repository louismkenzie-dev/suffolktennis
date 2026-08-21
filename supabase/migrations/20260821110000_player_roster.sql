-- Player roster: the county's player database (LTA RCP report import), used
-- by admins to select and invite players to events and programmes. Distinct
-- from public.children (parent-managed, requires a parent account) — roster
-- players' parents usually have no account; invitations reach them by email.
--
-- Contains children's personal data: admin-only access, nothing for anon.

CREATE TABLE IF NOT EXISTS public.player_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lta_number text UNIQUE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  gender text,
  age_group text,
  contact_email text,
  contact_name text,
  mobile text,
  marketing_opt_in boolean,
  singles_wtn numeric(6,2),
  doubles_wtn numeric(6,2),
  rcp_match_count integer,
  rcp_type text,
  tags text[] NOT NULL DEFAULT '{}',
  linked_child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'rcp_import',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_roster_age_group_idx ON public.player_roster (age_group);
CREATE INDEX IF NOT EXISTS player_roster_email_idx ON public.player_roster (lower(contact_email));
CREATE INDEX IF NOT EXISTS player_roster_name_idx ON public.player_roster (last_name, first_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_roster TO authenticated;
GRANT ALL ON public.player_roster TO service_role;

ALTER TABLE public.player_roster ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Admins manage roster" ON public.player_roster
    FOR ALL USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER player_roster_updated_at
  BEFORE UPDATE ON public.player_roster
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invitations issued to roster players need their own dedupe anchor: the
-- existing (event_id, child_id, parent_email) unique treats NULL child_id
-- rows as distinct, so re-inviting a roster player would duplicate.
ALTER TABLE public.booking_invitations
  ADD COLUMN IF NOT EXISTS roster_id uuid REFERENCES public.player_roster(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS booking_invitations_roster_unique
  ON public.booking_invitations (event_id, roster_id)
  WHERE roster_id IS NOT NULL;
