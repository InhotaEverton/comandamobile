DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid()
  AND (
    empresa_id IS NULL
    OR empresa_id = public.get_empresa_id_do_usuario(auth.uid())
  )
);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.minha_empresa_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_comanda() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_publicas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO authenticated;