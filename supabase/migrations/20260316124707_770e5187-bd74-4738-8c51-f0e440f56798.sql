
INSERT INTO storage.buckets (id, name, public) VALUES ('report-pdfs', 'report-pdfs', true);

CREATE POLICY "Parents can upload report PDFs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can read report PDFs" ON storage.objects FOR SELECT USING (bucket_id = 'report-pdfs');
