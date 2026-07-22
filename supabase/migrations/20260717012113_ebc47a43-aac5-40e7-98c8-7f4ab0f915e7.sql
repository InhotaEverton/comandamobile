
CREATE POLICY "produtos_bucket_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'produtos');
CREATE POLICY "produtos_bucket_auth_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'produtos');
CREATE POLICY "produtos_bucket_auth_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'produtos');
CREATE POLICY "produtos_bucket_auth_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'produtos');
CREATE POLICY "produtos_bucket_anon_read" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'produtos');
