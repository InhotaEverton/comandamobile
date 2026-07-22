
CREATE TABLE public.itens_pedido_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  item_pedido_id uuid NOT NULL REFERENCES public.itens_pedido(id) ON DELETE CASCADE,
  adicional_id uuid REFERENCES public.adicionais(id) ON DELETE SET NULL,
  grupo_id uuid REFERENCES public.grupos_adicionais(id) ON DELETE SET NULL,
  grupo_nome text,
  adicional_nome text NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  quantidade int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_ipa_empresa ON public.itens_pedido_adicionais(empresa_id);
CREATE INDEX idx_ipa_item ON public.itens_pedido_adicionais(item_pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_pedido_adicionais TO authenticated;
GRANT ALL ON public.itens_pedido_adicionais TO service_role;
ALTER TABLE public.itens_pedido_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ipa_select" ON public.itens_pedido_adicionais
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "ipa_insert" ON public.itens_pedido_adicionais
  FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "ipa_update_admin" ON public.itens_pedido_adicionais
  FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')))
  WITH CHECK (empresa_id = public.minha_empresa_id());

CREATE POLICY "ipa_delete_admin" ON public.itens_pedido_adicionais
  FOR DELETE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));
