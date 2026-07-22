
-- 1) Remove sensitive tables from Realtime publication (financial + config data)
ALTER PUBLICATION supabase_realtime DROP TABLE public.caixas;
ALTER PUBLICATION supabase_realtime DROP TABLE public.movimentacoes_caixa;
ALTER PUBLICATION supabase_realtime DROP TABLE public.configuracoes;

-- 2) Fix SECURITY DEFINER view: make configuracoes_publicas use SECURITY INVOKER,
-- and grant column-level SELECT on safe columns so non-admin staff can still read
-- operational settings via the view, without exposing sensitive fiscal/contact fields.
ALTER VIEW public.configuracoes_publicas SET (security_invoker = on);

-- Column-level grants on the underlying table (safe fields only)
REVOKE SELECT ON public.configuracoes FROM authenticated;
GRANT SELECT (
  id, singleton, modo_operacao, impressao_auto, qz_host,
  taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
  couvert_ativo, couvert_valor, horario_ativo, horarios,
  pin_diario_ativo, qtd_comandas, tipo_numeracao, updated_at
) ON public.configuracoes TO authenticated;

-- Allow authenticated staff to SELECT the safe columns via RLS
-- (admin/caixa retain their existing broader policy for sensitive fields)
DROP POLICY IF EXISTS "Equipe le configuracoes publicas" ON public.configuracoes;
CREATE POLICY "Equipe le configuracoes publicas"
  ON public.configuracoes FOR SELECT
  TO authenticated
  USING (true);

-- 3) Minor: allow garcom to read print job logs for jobs they created
DROP POLICY IF EXISTS "Garcom le logs de seus jobs" ON public.print_job_logs;
CREATE POLICY "Garcom le logs de seus jobs"
  ON public.print_job_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.print_jobs j
      WHERE j.id = print_job_logs.print_job_id
        AND j.created_by = auth.uid()
    )
  );
