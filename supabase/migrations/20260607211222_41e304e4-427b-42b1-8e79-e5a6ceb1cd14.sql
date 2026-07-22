
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.validar_pin_hoje(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_comanda() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated;
