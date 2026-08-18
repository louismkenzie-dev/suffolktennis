
-- Make buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('child-photos', 'report-pdfs');

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anyone can read report PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view child photos" ON storage.objects;
DROP POLICY IF EXISTS "Parents can delete own child photos" ON storage.objects;
DROP POLICY IF EXISTS "Parents can upload child photos" ON storage.objects;
DROP POLICY IF EXISTS "Parents can upload report PDFs" ON storage.objects;

-- child-photos: owner = first folder segment
CREATE POLICY "Owners view own child photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'child-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners upload own child photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'child-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners update own child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'child-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners delete own child photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'child-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- report-pdfs
CREATE POLICY "Owners view own report pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'report-pdfs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners upload own report pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'report-pdfs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners update own report pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'report-pdfs' AND (storage.foldername(name))[1] = (auth.uid())::text);

CREATE POLICY "Owners delete own report pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'report-pdfs' AND (storage.foldername(name))[1] = (auth.uid())::text);

-- Revoke execute on SECURITY DEFINER trigger functions (only triggers/service role need them)
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
