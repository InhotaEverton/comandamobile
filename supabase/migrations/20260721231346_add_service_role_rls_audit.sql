-- Snapshot de segurança acessível exclusivamente ao service_role.
CREATE OR REPLACE FUNCTION public.service_role_rls_audit()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'tables', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'table', c.relname,
        'rls_enabled', c.relrowsecurity,
        'rls_forced', c.relforcerowsecurity,
        'has_empresa_id', EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'empresa_id' AND NOT a.attisdropped
        ),
        'policies', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', p.policyname,
            'command', p.cmd,
            'roles', p.roles,
            'using', p.qual,
            'check', p.with_check
          ) ORDER BY p.policyname)
          FROM pg_policies p
          WHERE p.schemaname = 'public' AND p.tablename = c.relname
        ), '[]'::jsonb)
      ) ORDER BY c.relname), '[]'::jsonb)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
    ),
    'security_definer_functions', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'name', p.proname,
        'arguments', pg_get_function_identity_arguments(p.oid),
        'owner', pg_get_userbyid(p.proowner),
        'acl', p.proacl
      ) ORDER BY p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.prosecdef
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.service_role_rls_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_role_rls_audit() TO service_role;