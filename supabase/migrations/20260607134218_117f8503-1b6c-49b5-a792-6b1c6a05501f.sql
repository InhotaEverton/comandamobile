
-- 1. Profiles: restrict SELECT to own row or admin
DROP POLICY IF EXISTS "Usuários podem ver todos profiles autenticados" ON public.profiles;
CREATE POLICY "Usuários veem próprio profile ou admin vê todos"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

-- 2. comanda_historico: enforce usuario_id = auth.uid()
DROP POLICY IF EXISTS "Autenticados registram historico" ON public.comanda_historico;
CREATE POLICY "Usuário registra historico em próprio nome"
  ON public.comanda_historico FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

-- 3. Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- 4. Revoke EXECUTE on internal trigger/handler functions from anon & authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_pedido() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.recalcular_total_comanda() FROM anon, authenticated, public;

-- Keep has_role / is_admin executable by authenticated since they're used in policies
-- (they only check existence in user_roles; cannot be abused for escalation)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
