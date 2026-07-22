-- Remove broad SELECT policy that exposed sensitive owner/fiscal data to all authenticated users
DROP POLICY IF EXISTS "Equipe le configuracoes publicas" ON public.configuracoes;

-- Make the safe-projection view run as definer so non-admin staff can still read
-- only operational fields without needing direct SELECT on the base table.
ALTER VIEW public.configuracoes_publicas SET (security_invoker = off);

-- Ensure the view is readable by authenticated users (and anon if needed for public flows)
GRANT SELECT ON public.configuracoes_publicas TO authenticated;
GRANT SELECT ON public.configuracoes_publicas TO anon;