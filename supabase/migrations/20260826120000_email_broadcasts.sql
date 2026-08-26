-- Admin email broadcasts: customisable audience groups, a block-based
-- composer whose layout is fixed and pre-branded, and a per-send log.

CREATE TABLE IF NOT EXISTS public.email_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_groups_name_idx ON public.email_groups (lower(name));

CREATE TABLE IF NOT EXISTS public.email_group_members (
  group_id uuid NOT NULL REFERENCES public.email_groups(id) ON DELETE CASCADE,
  email    text NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, email)
);
CREATE INDEX IF NOT EXISTS email_group_members_email_idx ON public.email_group_members (email);

-- `blocks` is the admin's content; the branded shell around it is generated
-- server-side so the layout can't be broken from the UI.
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  subject      text NOT NULL DEFAULT '',
  preheader    text NOT NULL DEFAULT '',
  hero_url     text,
  blocks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience     jsonb NOT NULL DEFAULT '{"type":"all"}'::jsonb,
  status       text NOT NULL DEFAULT 'draft',
  sent_at      timestamptz,
  sent_count   integer NOT NULL DEFAULT 0,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_campaigns_status_chk CHECK (status IN ('draft','sending','sent'))
);

CREATE TABLE IF NOT EXISTS public.email_campaign_sends (
  campaign_id uuid NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  email       text NOT NULL,
  resend_id   text,
  sent_at     timestamptz,
  error       text,
  PRIMARY KEY (campaign_id, email)
);

ALTER TABLE public.email_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaign_sends  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.email_groups, public.email_group_members,
              public.email_campaigns, public.email_campaign_sends
  FROM anon, authenticated;

DO $$ BEGIN
  CREATE POLICY "Admins read groups" ON public.email_groups
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins read group members" ON public.email_group_members
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins read campaigns" ON public.email_campaigns
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins read campaign sends" ON public.email_campaign_sends
    FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public bucket for admin-chosen email pictures: email clients fetch these
-- with no credentials, so they must be publicly readable.
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-media', 'email-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN
  CREATE POLICY "Public read email media" ON storage.objects
    FOR SELECT USING (bucket_id = 'email-media');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins upload email media" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'email-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins delete email media" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'email-media' AND public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
