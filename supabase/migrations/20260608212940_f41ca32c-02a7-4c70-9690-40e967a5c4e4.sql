
CREATE OR REPLACE VIEW public.configuracoes_publicas
WITH (security_invoker = true) AS
SELECT
  id, singleton, modo_operacao, impressao_auto, qz_host,
  taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
  couvert_ativo, couvert_valor, horario_ativo, horarios,
  pin_diario_ativo, updated_at
FROM public.configuracoes;

GRANT SELECT ON public.configuracoes_publicas TO authenticated;

-- Tighten get_configuracoes_completo: revoke from anon/public
REVOKE EXECUTE ON FUNCTION public.get_configuracoes_completo() FROM PUBLIC, anon;
