
-- Revoke execute from public/anon on SECURITY DEFINER functions; grant only to authenticated where appropriate.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.validar_pin_hoje(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, setor, jsonb, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, setor, jsonb, text, boolean) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.claim_next_print_job(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO authenticated, service_role;

-- Trigger functions: not meant to be called via API at all.
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_comanda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
