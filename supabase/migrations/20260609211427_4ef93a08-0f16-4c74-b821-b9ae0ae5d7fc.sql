
DROP POLICY IF EXISTS configuracoes_select ON public.configuracoes;
CREATE POLICY configuracoes_select ON public.configuracoes
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS pin_diario_select ON public.pin_diario;
CREATE POLICY pin_diario_select ON public.pin_diario
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));
