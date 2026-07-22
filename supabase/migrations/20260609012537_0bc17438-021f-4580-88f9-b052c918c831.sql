
-- 1. Drop the security-definer view
DROP VIEW IF EXISTS public.configuracoes_publicas;

-- 2. Public/operational config via SECURITY DEFINER function (safe columns only)
CREATE OR REPLACE FUNCTION public.get_configuracoes_publicas()
RETURNS TABLE (
  id uuid,
  singleton boolean,
  modo_operacao text,
  impressao_auto boolean,
  qz_host text,
  taxa_garcom_ativa boolean,
  taxa_garcom_percentual numeric,
  taxa_garcom_auto boolean,
  couvert_ativo boolean,
  couvert_valor numeric,
  horario_ativo boolean,
  horarios jsonb,
  pin_diario_ativo boolean,
  qtd_comandas integer,
  tipo_numeracao text,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, singleton, modo_operacao, impressao_auto, qz_host,
         taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
         couvert_ativo, couvert_valor, horario_ativo, horarios,
         pin_diario_ativo, qtd_comandas, tipo_numeracao, updated_at
  FROM public.configuracoes
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_configuracoes_publicas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_configuracoes_publicas() TO authenticated, anon;

-- 3. Restrict direct table reads to admin only (cashiers go through the function)
DROP POLICY IF EXISTS "Admin e caixa leem configuracoes completas" ON public.configuracoes;
CREATE POLICY "Admin le configuracoes completas"
  ON public.configuracoes FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 4. Hide sensitive personal/fiscal columns from non-admins inside the completo function
CREATE OR REPLACE FUNCTION public.get_configuracoes_completo()
RETURNS SETOF public.configuracoes
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean := public.is_admin(auth.uid());
  v_is_caixa boolean := public.has_role(auth.uid(), 'caixa');
BEGIN
  IF NOT (v_is_admin OR v_is_caixa) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_is_admin THEN
    RETURN QUERY SELECT * FROM public.configuracoes LIMIT 1;
  ELSE
    -- caixa: mask sensitive personal & fiscal credentials
    RETURN QUERY
      SELECT
        c.id, c.singleton, c.taxa_garcom_ativa, c.taxa_garcom_percentual,
        c.taxa_garcom_auto, c.couvert_ativo, c.couvert_valor, c.updated_at,
        c.modo_operacao, c.impressao_auto, c.qz_host, c.horario_ativo,
        c.horarios, c.pin_diario_ativo,
        NULL::text AS responsavel_nome,
        NULL::text AS responsavel_email,
        NULL::text AS responsavel_whatsapp,
        NULL::text AS responsavel_cpf,
        c.nome_fantasia, c.razao_social,
        NULL::text AS cnpj,
        NULL::text AS inscricao_estadual,
        c.telefone_comercial, c.whatsapp_empresa, c.email_comercial,
        c.endereco_cep, c.endereco_logradouro, c.endereco_numero,
        c.endereco_complemento, c.endereco_bairro, c.endereco_cidade,
        c.endereco_estado,
        NULL::text AS regime_tributario,
        NULL::text AS tipo_doc_fiscal,
        NULL::text AS serie_fiscal,
        NULL::text AS ambiente_fiscal,
        c.qtd_comandas, c.tipo_numeracao
      FROM public.configuracoes c
      LIMIT 1;
  END IF;
END;
$$;
