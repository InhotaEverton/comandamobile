-- 1) Novos campos de configuração
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS qtd_comandas integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS tipo_numeracao text NOT NULL DEFAULT 'continua';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_tipo_numeracao_check') THEN
    ALTER TABLE public.configuracoes
      ADD CONSTRAINT configuracoes_tipo_numeracao_check
      CHECK (tipo_numeracao IN ('continua', 'diaria', 'mensal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'configuracoes_qtd_comandas_check') THEN
    ALTER TABLE public.configuracoes
      ADD CONSTRAINT configuracoes_qtd_comandas_check
      CHECK (qtd_comandas BETWEEN 1 AND 999);
  END IF;
END $$;

-- 2) Recria a visão pública para incluir os novos campos
DROP VIEW IF EXISTS public.configuracoes_publicas;
CREATE VIEW public.configuracoes_publicas
WITH (security_invoker = true) AS
SELECT id, singleton, modo_operacao, impressao_auto, qz_host,
       taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
       couvert_ativo, couvert_valor, horario_ativo, horarios,
       pin_diario_ativo, qtd_comandas, tipo_numeracao, updated_at
  FROM public.configuracoes;

GRANT SELECT ON public.configuracoes_publicas TO authenticated, anon;

-- 3) Seed inicial: cria pool de 50 comandas se ainda não houver nenhuma
INSERT INTO public.mesas (numero, lugares, setor, status)
SELECT i, 1, 'comanda', 'livre'
FROM generate_series(1, 50) i
WHERE NOT EXISTS (SELECT 1 FROM public.mesas)
ON CONFLICT (numero) DO NOTHING;

-- 4) RPC para regenerar o pool conforme a quantidade configurada (apenas admin)
CREATE OR REPLACE FUNCTION public.regenerar_pool_comandas(_qtd integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_removidas int := 0;
  v_total int;
  i int;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF _qtd IS NULL OR _qtd < 1 OR _qtd > 999 THEN
    RAISE EXCEPTION 'Quantidade fora do intervalo permitido (1-999)';
  END IF;

  FOR i IN 1.._qtd LOOP
    INSERT INTO public.mesas (numero, lugares, setor, status)
    VALUES (i, 1, 'comanda', 'livre')
    ON CONFLICT (numero) DO NOTHING;
  END LOOP;

  WITH del AS (
    DELETE FROM public.mesas m
     WHERE m.numero > _qtd
       AND NOT EXISTS (SELECT 1 FROM public.comandas c WHERE c.mesa_id = m.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_removidas FROM del;

  SELECT count(*) INTO v_total FROM public.mesas;

  RETURN jsonb_build_object('total', v_total, 'removidas', v_removidas, 'solicitado', _qtd);
END;
$$;

REVOKE ALL ON FUNCTION public.regenerar_pool_comandas(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerar_pool_comandas(integer) TO authenticated;