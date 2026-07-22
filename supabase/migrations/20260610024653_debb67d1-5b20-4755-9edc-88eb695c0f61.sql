-- 1. Privilege escalation fix: remove broken INSERT policy.
-- Profiles are created exclusively by the handle_new_user trigger (SECURITY DEFINER),
-- so the client never needs to INSERT directly.
DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;

-- Keep a strict fallback: allow self-insert only when the target empresa matches
-- the empresa already linked to the authenticated user via a NON-NULL lookup.
CREATE POLICY profiles_insert_self_strict
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = auth.uid()
    AND empresa_id IS NOT NULL
    AND empresa_id = public.get_empresa_id_do_usuario(auth.uid())
  );

-- 2. Lock down SECURITY DEFINER helpers: only authenticated callers.
REVOKE EXECUTE ON FUNCTION public.minha_empresa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_configuracoes_publicas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_configuracoes_completo() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validar_pin_hoje(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_next_print_job(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.minha_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_publicas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) TO authenticated;