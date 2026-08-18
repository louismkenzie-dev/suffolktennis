
-- 1. Table
CREATE TABLE public.player_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subtitle text,
  description text,
  badge text,
  accent text NOT NULL DEFAULT 'yellow',
  achievements text[] NOT NULL DEFAULT '{}'::text[],
  main_image_url text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb,
  display_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Grants (public can read; admins manage via RLS)
GRANT SELECT ON public.player_watch TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_watch TO authenticated;
GRANT ALL ON public.player_watch TO service_role;

-- 3. RLS
ALTER TABLE public.player_watch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published players"
ON public.player_watch FOR SELECT
USING (published = true);

CREATE POLICY "Admins can read all players"
ON public.player_watch FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert players"
ON public.player_watch FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update players"
ON public.player_watch FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete players"
ON public.player_watch FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. updated_at trigger
CREATE TRIGGER player_watch_set_updated_at
BEFORE UPDATE ON public.player_watch
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-watch-media', 'player-watch-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Player watch media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-watch-media');

CREATE POLICY "Admins upload player watch media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'player-watch-media' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update player watch media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'player-watch-media' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete player watch media"
ON storage.objects FOR DELETE
USING (bucket_id = 'player-watch-media' AND public.has_role(auth.uid(), 'admin'::app_role));
