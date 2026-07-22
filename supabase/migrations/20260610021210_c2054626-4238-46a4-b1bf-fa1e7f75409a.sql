DROP POLICY IF EXISTS caixas_update ON public.caixas;
CREATE POLICY caixas_update ON public.caixas
FOR UPDATE TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS comandas_update ON public.comandas;
CREATE POLICY comandas_update ON public.comandas
FOR UPDATE TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS itens_pedido_manage ON public.itens_pedido;
CREATE POLICY itens_pedido_manage ON public.itens_pedido
FOR ALL TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'cozinha'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'cozinha'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS mesas_update ON public.mesas;
CREATE POLICY mesas_update ON public.mesas
FOR UPDATE TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS pagamentos_manage ON public.pagamentos;
CREATE POLICY pagamentos_manage ON public.pagamentos
FOR ALL TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);

DROP POLICY IF EXISTS pedidos_manage ON public.pedidos;
CREATE POLICY pedidos_manage ON public.pedidos
FOR ALL TO authenticated
USING (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'cozinha'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
)
WITH CHECK (
  empresa_id = minha_empresa_id()
  AND (
    has_role(auth.uid(), 'garcom'::app_role)
    OR has_role(auth.uid(), 'cozinha'::app_role)
    OR has_role(auth.uid(), 'caixa'::app_role)
    OR is_admin(auth.uid())
  )
);