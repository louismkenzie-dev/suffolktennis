
CREATE POLICY "Admins view all child photos" ON storage.objects FOR SELECT USING (bucket_id = 'child-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload child photos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'child-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update child photos" ON storage.objects FOR UPDATE USING (bucket_id = 'child-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete child photos" ON storage.objects FOR DELETE USING (bucket_id = 'child-photos' AND public.has_role(auth.uid(), 'admin'));
