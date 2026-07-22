-- Remove client-side INSERT on profiles. Profile creation is handled by the
-- SECURITY DEFINER trigger handle_new_user, which sets empresa_id from
-- raw_user_meta_data.invited_by_empresa or creates a new tenant.
DROP POLICY IF EXISTS profiles_insert_self_strict ON public.profiles;

-- Revoke PUBLIC execute on trigger-only SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.guard_last_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_last_admin_profile() FROM PUBLIC;