-- Switch the public view to security_invoker so it enforces the caller's grants/RLS instead of the view owner's.
ALTER VIEW public.configuracoes_publicas SET (security_invoker = on);

-- Lock down direct access to the base table, then re-grant only the safe operational columns to authenticated.
REVOKE SELECT ON public.configuracoes FROM anon, authenticated;

GRANT SELECT (
  id,
  singleton,
  modo_operacao,
  impressao_auto,
  qz_host,
  taxa_garcom_ativa,
  taxa_garcom_percentual,
  taxa_garcom_auto,
  couvert_ativo,
  couvert_valor,
  horario_ativo,
  horarios,
  pin_diario_ativo,
  qtd_comandas,
  tipo_numeracao,
  updated_at
) ON public.configuracoes TO authenticated;

-- Ensure the view itself is queryable by authenticated users.
GRANT SELECT ON public.configuracoes_publicas TO authenticated;

-- Add a permissive SELECT policy for authenticated; column GRANTs above limit which fields they can actually read.
-- Sensitive columns remain unreadable for non-admins; admins continue to read full row via get_configuracoes_completo() (SECURITY DEFINER).
DROP POLICY IF EXISTS "Admins leem configuracoes completo" ON public.configuracoes;
CREATE POLICY "Autenticados leem colunas operacionais"
  ON public.configuracoes FOR SELECT
  TO authenticated
  USING (true);