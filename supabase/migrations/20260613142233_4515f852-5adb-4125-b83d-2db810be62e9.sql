
-- Revoke EXECUTE from anon on all SECURITY DEFINER functions in public.
-- These are only meant to be called by authenticated users or via triggers.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.minha_empresa_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validar_pin_hoje(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_configuracoes_completo() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_configuracoes_publicas() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_next_print_job(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reparar_identidade_auth_orfa_por_email(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_comanda() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gen_comanda_codigo() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, PUBLIC;

-- Grant back to authenticated for RPCs the app actually calls
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.minha_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_publicas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) TO authenticated;
