DROP POLICY IF EXISTS movimentacoes_caixa_no_delete ON public.movimentacoes_caixa;
CREATE POLICY movimentacoes_caixa_no_delete ON public.movimentacoes_caixa
FOR DELETE TO authenticated
USING (false);