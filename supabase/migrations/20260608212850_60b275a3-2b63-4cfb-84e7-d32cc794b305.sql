
-- Clean up previous attempts
DROP VIEW IF EXISTS public.configuracoes_publicas;
DROP POLICY IF EXISTS "Admin e caixa leem configuracoes" ON public.configuracoes;
DROP POLICY IF EXISTS "Autenticados leem config operacional" ON public.configuracoes;

-- Column-level SELECT privileges: authenticated can only read operational columns
REVOKE SELECT ON public.configuracoes FROM authenticated;
GRANT SELECT (
  id, singleton, modo_operacao, impressao_auto, qz_host,
  taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
  couvert_ativo, couvert_valor, horario_ativo, horarios,
  pin_diario_ativo, updated_at
) ON public.configuracoes TO authenticated;

-- Permissive SELECT policy (column grants enforce which columns are readable)
CREATE POLICY "Autenticados leem configuracoes operacional"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (true);

-- Admin-gated function to read full row including sensitive owner/fiscal data
CREATE OR REPLACE FUNCTION public.get_configuracoes_completo()
RETURNS SETOF public.configuracoes
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'caixa')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY SELECT * FROM public.configuracoes LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_configuracoes_completo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;
