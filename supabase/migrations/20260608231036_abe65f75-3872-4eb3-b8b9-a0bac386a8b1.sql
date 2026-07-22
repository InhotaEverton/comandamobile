-- 1) Restrict configuracoes base table SELECT to admins only; non-admin operational reads go through configuracoes_publicas view
DROP POLICY IF EXISTS "Autenticados leem configuracoes operacional" ON public.configuracoes;
CREATE POLICY "Admins leem configuracoes completo"
  ON public.configuracoes FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Ensure the view (already excludes sensitive fields) is queryable by all authenticated users via security_invoker
ALTER VIEW public.configuracoes_publicas SET (security_invoker = on);
GRANT SELECT ON public.configuracoes_publicas TO authenticated;

-- Allow authenticated to read the operational subset through the view even though base table is admin-only:
-- security_invoker requires base-table access for the caller, so add a permissive SELECT policy for the operational columns by routing through a SECURITY DEFINER source? Simpler: keep view as security_definer (default) so it bypasses the base-table RLS for the safe columns.
ALTER VIEW public.configuracoes_publicas SET (security_invoker = off);

-- 2) Restrict print_jobs SELECT to roles that operate the queue (cozinha/caixa/admin) and to the garcom who created the job
DROP POLICY IF EXISTS "Autenticados leem fila de impressao" ON public.print_jobs;
CREATE POLICY "Equipe operacional le fila de impressao"
  ON public.print_jobs FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'cozinha'::app_role)
    OR public.has_role(auth.uid(), 'caixa'::app_role)
    OR public.is_admin(auth.uid())
    OR created_by = auth.uid()
  );

-- 3) Revoke EXECUTE on SECURITY DEFINER admin RPC from anon/public; restrict to authenticated (function itself enforces is_admin)
REVOKE EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) TO authenticated;