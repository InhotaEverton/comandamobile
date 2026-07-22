
DROP FUNCTION IF EXISTS public.get_configuracoes_completo();

ALTER TABLE public.configuracoes
  DROP COLUMN IF EXISTS regime_tributario,
  DROP COLUMN IF EXISTS tipo_doc_fiscal,
  DROP COLUMN IF EXISTS serie_fiscal,
  DROP COLUMN IF EXISTS ambiente_fiscal;

CREATE OR REPLACE FUNCTION public.get_configuracoes_completo()
 RETURNS SETOF public.configuracoes
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_admin boolean := public.is_admin(auth.uid());
  v_is_caixa boolean := public.has_role(auth.uid(), 'caixa');
  v_empresa uuid := public.minha_empresa_id();
BEGIN
  IF NOT (v_is_admin OR v_is_caixa) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_is_admin THEN
    RETURN QUERY SELECT * FROM public.configuracoes WHERE empresa_id = v_empresa LIMIT 1;
  ELSE
    RETURN QUERY
      SELECT
        c.id, c.singleton, c.taxa_garcom_ativa, c.taxa_garcom_percentual,
        c.taxa_garcom_auto, c.couvert_ativo, c.couvert_valor, c.updated_at,
        c.modo_operacao, c.impressao_auto, c.qz_host, c.horario_ativo,
        c.horarios, c.pin_diario_ativo,
        NULL::text, NULL::text, NULL::text, NULL::text,
        c.nome_fantasia, c.razao_social,
        NULL::text, NULL::text,
        c.telefone_comercial, c.whatsapp_empresa, c.email_comercial,
        c.endereco_cep, c.endereco_logradouro, c.endereco_numero,
        c.endereco_complemento, c.endereco_bairro, c.endereco_cidade,
        c.endereco_estado,
        c.qtd_comandas, c.tipo_numeracao,
        c.empresa_id
      FROM public.configuracoes c
      WHERE c.empresa_id = v_empresa
      LIMIT 1;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_configuracoes_completo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_completo() TO authenticated;
