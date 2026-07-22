DROP POLICY IF EXISTS "Autenticados leem colunas operacionais" ON public.configuracoes;
DROP POLICY IF EXISTS "Admins leem configuracoes completo" ON public.configuracoes;

CREATE POLICY "Admin e caixa leem configuracoes completas"
ON public.configuracoes
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.has_role(auth.uid(), 'caixa'::public.app_role)
);

REVOKE ALL ON public.configuracoes FROM anon, authenticated;
GRANT SELECT, UPDATE ON public.configuracoes TO authenticated;

CREATE OR REPLACE VIEW public.configuracoes_publicas AS
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
  qtd_comandas,
  tipo_numeracao,
  updated_at
FROM public.configuracoes;

ALTER VIEW public.configuracoes_publicas SET (security_invoker = off);
GRANT SELECT ON public.configuracoes_publicas TO authenticated;
REVOKE ALL ON public.configuracoes_publicas FROM anon;

REVOKE EXECUTE ON FUNCTION public.get_configuracoes_completo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;