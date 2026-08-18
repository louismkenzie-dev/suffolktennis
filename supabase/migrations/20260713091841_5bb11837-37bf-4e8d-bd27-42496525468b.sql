
-- =========================================
-- VENUES
-- =========================================
CREATE TABLE public.venues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  venue_type TEXT NOT NULL DEFAULT 'partner' CHECK (venue_type IN ('partner','feeder')),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  tagline TEXT,
  location TEXT,
  intro TEXT,
  detail TEXT,
  image_url TEXT,
  logo_url TEXT,
  logo_bg_color TEXT,
  website_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  google_maps_url TEXT,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.venues TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published venues"
  ON public.venues FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert venues"
  ON public.venues FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update venues"
  ON public.venues FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete venues"
  ON public.venues FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- COACHES
-- =========================================
CREATE TABLE public.coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT,
  experience TEXT,
  qualification TEXT,
  specialty TEXT,
  photo_url TEXT,
  quote TEXT,
  bio TEXT,
  philosophy TEXT,
  achievements JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.coaches TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coaches TO authenticated;
GRANT ALL ON public.coaches TO service_role;

ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published coaches"
  ON public.coaches FOR SELECT
  USING (published = true OR public.has_role(auth.uid(), 'admin') OR linked_user_id = auth.uid());

CREATE POLICY "Admins can insert coaches"
  ON public.coaches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or linked coach can update"
  ON public.coaches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR linked_user_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR linked_user_id = auth.uid());

CREATE POLICY "Admins can delete coaches"
  ON public.coaches FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER coaches_updated_at
  BEFORE UPDATE ON public.coaches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
