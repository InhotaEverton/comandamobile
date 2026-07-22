
-- Restrict full configuracoes SELECT to admin/caixa
DROP POLICY IF EXISTS "Autenticados leem configuracoes" ON public.configuracoes;

CREATE POLICY "Admin e caixa leem configuracoes"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'caixa'));

-- Operational-only view for non-admin staff (garcom, cozinha, etc.)
CREATE OR REPLACE VIEW public.configuracoes_publicas
WITH (security_invoker = true) AS
SELECT
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
  updated_at
FROM public.configuracoes;

-- Allow any authenticated user to read operational settings via the view.
-- security_invoker means the underlying RLS applies, so we also need a
-- companion policy granting SELECT on the operational columns.
CREATE POLICY "Autenticados leem config operacional"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (true);

-- The above policy still exposes all columns at the table level. To truly
-- restrict sensitive fields, drop the permissive policy and instead use
-- column-level grants.
DROP POLICY IF EXISTS "Autenticados leem config operacional" ON public.configuracoes;

-- Column-level SELECT grants: revoke broad SELECT and grant only operational columns to authenticated.
REVOKE SELECT ON public.configuracoes FROM authenticated;
GRANT SELECT (
  id, singleton, modo_operacao, impressao_auto, qz_host,
  taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
  couvert_ativo, couvert_valor, horario_ativo, horarios,
  pin_diario_ativo, updated_at
) ON public.configuracoes TO authenticated;

-- Re-add a permissive RLS SELECT policy; column grants now enforce which columns are readable.
CREATE POLICY "Autenticados leem config operacional"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (true);

-- Admin/caixa retain full read access; grant full SELECT back to those via role membership
-- is not directly possible (roles in auth are app-level, not DB roles). The "Admin e caixa leem configuracoes"
-- policy above is redundant given the permissive policy + column grants, so drop it to avoid confusion.
DROP POLICY IF EXISTS "Admin e caixa leem configuracoes" ON public.configuracoes;

-- Grant full SELECT on the view to authenticated (view enforces its column whitelist).
GRANT SELECT ON public.configuracoes_publicas TO authenticated;

-- Service role keeps full access
GRANT ALL ON public.configuracoes TO service_role;
