-- Create buckets previously referenced only by policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('produtos', 'produtos', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('logos', 'logos', false, 3145728, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "produtos_bucket_auth_read" ON storage.objects;
DROP POLICY IF EXISTS "produtos_bucket_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "produtos_bucket_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "produtos_bucket_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "produtos_bucket_anon_read" ON storage.objects;

CREATE POLICY "produtos_tenant_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'produtos' AND (storage.foldername(name))[1] = public.minha_empresa_id()::text);

CREATE POLICY "produtos_admin_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'produtos' AND public.is_admin(auth.uid()) AND (storage.foldername(name))[1] = public.minha_empresa_id()::text);

CREATE POLICY "produtos_admin_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'produtos' AND public.is_admin(auth.uid()) AND (storage.foldername(name))[1] = public.minha_empresa_id()::text)
WITH CHECK (bucket_id = 'produtos' AND public.is_admin(auth.uid()) AND (storage.foldername(name))[1] = public.minha_empresa_id()::text);

CREATE POLICY "produtos_admin_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'produtos' AND public.is_admin(auth.uid()) AND (storage.foldername(name))[1] = public.minha_empresa_id()::text);