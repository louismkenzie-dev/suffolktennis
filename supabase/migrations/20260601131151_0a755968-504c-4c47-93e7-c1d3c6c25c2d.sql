
-- 1. Add media + article_date columns
ALTER TABLE public.suffolk_news
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS article_date timestamptz;

UPDATE public.suffolk_news SET article_date = created_at WHERE article_date IS NULL;

-- 2. Storage bucket for news media (public read)
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-media', 'news-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 3. Storage policies
DROP POLICY IF EXISTS "News media public read" ON storage.objects;
CREATE POLICY "News media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'news-media');

DROP POLICY IF EXISTS "Admins upload news media" ON storage.objects;
CREATE POLICY "Admins upload news media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'news-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update news media" ON storage.objects;
CREATE POLICY "Admins update news media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'news-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete news media" ON storage.objects;
CREATE POLICY "Admins delete news media"
ON storage.objects FOR DELETE
USING (bucket_id = 'news-media' AND public.has_role(auth.uid(), 'admin'::app_role));
