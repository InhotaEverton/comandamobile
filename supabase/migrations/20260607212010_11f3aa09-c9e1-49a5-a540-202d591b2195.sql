DROP POLICY IF EXISTS "Admin gerencia mesas" ON public.mesas;
CREATE POLICY "Garcom/admin cria mesa" ON public.mesas FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'garcom'::app_role) OR is_admin(auth.uid()));