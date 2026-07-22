
-- Restore full SELECT grant on table (column grants removed)
DROP POLICY IF EXISTS "Autenticados leem config operacional" ON public.configuracoes;
REVOKE SELECT ON public.configuracoes FROM authenticated;
GRANT SELECT ON public.configuracoes TO authenticated;

-- Only admin/caixa can read base table (sensitive columns)
CREATE POLICY "Admin e caixa leem configuracoes"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'caixa'));

-- Recreate view as security DEFINER (default) so it bypasses RLS for operational-only columns
DROP VIEW IF EXISTS public.configuracoes_publicas;
CREATE VIEW public.configuracoes_publicas AS
SELECT
  id, singleton, modo_operacao, impressao_auto, qz_host,
  taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
  couvert_ativo, couvert_valor, horario_ativo, horarios,
  pin_diario_ativo, updated_at
FROM public.configuracoes;

GRANT SELECT ON public.configuracoes_publicas TO authenticated;
