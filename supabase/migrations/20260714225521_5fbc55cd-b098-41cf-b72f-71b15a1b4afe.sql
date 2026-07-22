
-- 1. Configuracoes: novas colunas
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS delivery_retirada_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aceita_retirada boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS aceita_entrega boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cobrar_taxa_entrega boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pedido_minimo numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tempo_preparo_min integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS exibir_cardapio_online boolean NOT NULL DEFAULT true;

-- 2. Comandas: novas colunas de entrega/pagamento
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS tipo_entrega text,
  ADD COLUMN IF NOT EXISTS endereco_cep text,
  ADD COLUMN IF NOT EXISTS endereco_rua text,
  ADD COLUMN IF NOT EXISTS endereco_numero text,
  ADD COLUMN IF NOT EXISTS endereco_complemento text,
  ADD COLUMN IF NOT EXISTS endereco_bairro text,
  ADD COLUMN IF NOT EXISTS endereco_cidade text,
  ADD COLUMN IF NOT EXISTS endereco_estado text,
  ADD COLUMN IF NOT EXISTS forma_pagamento text,
  ADD COLUMN IF NOT EXISTS troco_para numeric(10,2),
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric(10,2) NOT NULL DEFAULT 0;

-- 3. Bairros
CREATE TABLE IF NOT EXISTS public.bairros_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  valor_frete numeric(10,2) NOT NULL DEFAULT 0,
  pedido_minimo numeric(10,2),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bairros_entrega TO authenticated;
GRANT ALL ON public.bairros_entrega TO service_role;
ALTER TABLE public.bairros_entrega ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bairros_select" ON public.bairros_entrega;
CREATE POLICY "bairros_select" ON public.bairros_entrega
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
DROP POLICY IF EXISTS "bairros_admin_all" ON public.bairros_entrega;
CREATE POLICY "bairros_admin_all" ON public.bairros_entrega
  FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_bairros_updated ON public.bairros_entrega;
CREATE TRIGGER trg_bairros_updated BEFORE UPDATE ON public.bairros_entrega
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Clientes online (upsert automático via RPC — sem acesso direto pelo cliente publico)
CREATE TABLE IF NOT EXISTS public.clientes_online (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  whatsapp text NOT NULL,
  nome text,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  forma_pagamento text,
  last_pedido_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, whatsapp)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_online TO authenticated;
GRANT ALL ON public.clientes_online TO service_role;
ALTER TABLE public.clientes_online ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_online_admin" ON public.clientes_online;
CREATE POLICY "clientes_online_admin" ON public.clientes_online
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());

DROP TRIGGER IF EXISTS trg_clientes_online_updated ON public.clientes_online;
CREATE TRIGGER trg_clientes_online_updated BEFORE UPDATE ON public.clientes_online
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5. Cardápio público atualizado
CREATE OR REPLACE FUNCTION public.get_cardapio_publico(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp record;
  v_cfg record;
  v_result jsonb;
BEGIN
  SELECT id, nome_fantasia, nome, pedido_online_ativo, slug
    INTO v_emp
    FROM public.empresas
   WHERE slug = lower(btrim(_slug))
   LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RETURN NULL;
  END IF;

  SELECT horario_ativo, horarios, whatsapp_empresa, telefone_comercial,
         COALESCE(delivery_retirada_ativo,false) AS delivery_retirada_ativo,
         COALESCE(aceita_retirada,true) AS aceita_retirada,
         COALESCE(aceita_entrega,false) AS aceita_entrega,
         COALESCE(cobrar_taxa_entrega,true) AS cobrar_taxa_entrega,
         COALESCE(pedido_minimo,0) AS pedido_minimo,
         COALESCE(tempo_preparo_min,30) AS tempo_preparo_min,
         COALESCE(exibir_cardapio_online,true) AS exibir_cardapio_online
    INTO v_cfg
    FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;

  IF NOT COALESCE(v_cfg.exibir_cardapio_online, true) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', v_emp.id,
      'nome', COALESCE(v_emp.nome_fantasia, v_emp.nome),
      'slug', v_emp.slug,
      'whatsapp', v_cfg.whatsapp_empresa,
      'telefone', v_cfg.telefone_comercial,
      'horario_ativo', COALESCE(v_cfg.horario_ativo, false),
      'horarios', COALESCE(v_cfg.horarios, '{}'::jsonb)
    ),
    'config_delivery', jsonb_build_object(
      'delivery_retirada_ativo', v_cfg.delivery_retirada_ativo,
      'aceita_retirada', v_cfg.aceita_retirada,
      'aceita_entrega', v_cfg.aceita_entrega,
      'cobrar_taxa_entrega', v_cfg.cobrar_taxa_entrega,
      'pedido_minimo', v_cfg.pedido_minimo,
      'tempo_preparo_min', v_cfg.tempo_preparo_min
    ),
    'bairros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', b.id, 'nome', b.nome, 'valor_frete', b.valor_frete, 'pedido_minimo', b.pedido_minimo
      ) ORDER BY b.nome)
      FROM public.bairros_entrega b
      WHERE b.empresa_id = v_emp.id AND b.ativo = true
    ), '[]'::jsonb),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'ordem', c.ordem
      ) ORDER BY c.ordem, c.nome)
      FROM public.categorias c
      WHERE c.empresa_id = v_emp.id
        AND c.ativo = true
        AND EXISTS (
          SELECT 1 FROM public.produtos p
          WHERE p.categoria_id = c.id
            AND p.empresa_id = v_emp.id
            AND p.ativo = true
            AND p.exibir_online = true
        )
    ), '[]'::jsonb),
    'produtos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'preco', p.preco,
        'descricao', p.descricao, 'imagem_url', p.imagem_url,
        'categoria_id', p.categoria_id,
        'tem_adicionais', COALESCE(p.tem_adicionais, false)
      ) ORDER BY p.nome)
      FROM public.produtos p
      WHERE p.empresa_id = v_emp.id
        AND p.ativo = true
        AND p.exibir_online = true
    ), '[]'::jsonb),
    'grupos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'nome', g.nome, 'descricao', g.descricao,
        'tipo_selecao', g.tipo_selecao,
        'min_selecao', g.min_selecao, 'max_selecao', g.max_selecao,
        'max_ilimitado', g.max_ilimitado, 'obrigatorio', g.obrigatorio,
        'adicionais', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', a.id, 'nome', a.nome, 'preco', a.preco, 'ordem', a.ordem
          ) ORDER BY a.ordem, a.nome)
          FROM public.adicionais a
          WHERE a.grupo_id = g.id AND a.ativo = true
        ), '[]'::jsonb)
      ) ORDER BY g.ordem, g.nome)
      FROM public.grupos_adicionais g
      WHERE g.empresa_id = v_emp.id
        AND g.ativo = true
        AND EXISTS (
          SELECT 1 FROM public.produto_grupos_adicionais pg
          JOIN public.produtos p ON p.id = pg.produto_id
          WHERE pg.grupo_id = g.id
            AND p.ativo = true
            AND p.exibir_online = true
        )
    ), '[]'::jsonb),
    'produto_grupos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'produto_id', pg.produto_id,
        'grupo_id', pg.grupo_id,
        'min_selecao', pg.min_selecao,
        'max_selecao', pg.max_selecao,
        'obrigatorio', pg.obrigatorio,
        'ordem', pg.ordem
      ) ORDER BY pg.ordem)
      FROM public.produto_grupos_adicionais pg
      JOIN public.produtos p ON p.id = pg.produto_id
      WHERE pg.empresa_id = v_emp.id
        AND p.ativo = true
        AND p.exibir_online = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- 6. Buscar cliente online por WhatsApp (público via RPC)
CREATE OR REPLACE FUNCTION public.buscar_cliente_online(_slug text, _whatsapp text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp_id uuid;
  v_wa text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g');
  v_result jsonb;
BEGIN
  IF length(v_wa) < 10 THEN RETURN NULL; END IF;
  SELECT id INTO v_emp_id FROM public.empresas WHERE slug = lower(btrim(_slug)) AND pedido_online_ativo LIMIT 1;
  IF v_emp_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'nome', nome, 'whatsapp', whatsapp,
    'cep', cep, 'rua', rua, 'numero', numero, 'complemento', complemento,
    'bairro', bairro, 'cidade', cidade, 'estado', estado,
    'forma_pagamento', forma_pagamento
  ) INTO v_result
  FROM public.clientes_online
  WHERE empresa_id = v_emp_id AND whatsapp = v_wa
  LIMIT 1;
  RETURN v_result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.buscar_cliente_online(text, text) TO anon, authenticated;

-- 7. Criar pedido online (com delivery)
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _slug text,
  _cliente text,
  _whatsapp text,
  _tipo text,
  _itens jsonb,
  _entrega jsonb DEFAULT NULL,
  _pagamento jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_emp record; v_cfg record; v_mesa uuid; v_comanda uuid; v_pedido uuid;
  v_item jsonb; v_ad jsonb; v_produto record; v_adic record; v_item_id uuid;
  v_qtd int; v_extras_total numeric; v_tipo text; v_obs text;
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dia text; v_dia_cfg jsonb; v_abre time; v_fecha time; v_hora time;
  v_wa text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g');
  v_taxa numeric(10,2) := 0;
  v_forma text;
  v_troco numeric(10,2);
  v_bairro_nome text;
  v_bairro_id uuid;
BEGIN
  SELECT id, pedido_online_ativo INTO v_emp FROM public.empresas
    WHERE slug = lower(btrim(_slug)) LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RAISE EXCEPTION 'Pedidos online indisponíveis no momento.';
  END IF;

  SELECT horario_ativo, horarios,
         COALESCE(aceita_retirada,true) AS aceita_retirada,
         COALESCE(aceita_entrega,false) AS aceita_entrega,
         COALESCE(pedido_minimo,0) AS pedido_minimo
    INTO v_cfg FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;
  IF COALESCE(v_cfg.horario_ativo, false) THEN
    v_dia := CASE extract(dow FROM v_now)::int
               WHEN 0 THEN 'dom' WHEN 1 THEN 'seg' WHEN 2 THEN 'ter'
               WHEN 3 THEN 'qua' WHEN 4 THEN 'qui' WHEN 5 THEN 'sex'
               WHEN 6 THEN 'sab' END;
    v_dia_cfg := v_cfg.horarios -> v_dia;
    v_hora := v_now::time;
    IF v_dia_cfg IS NULL OR NOT COALESCE((v_dia_cfg->>'aberto')::boolean, false) THEN
      RAISE EXCEPTION 'Estamos fechados no momento. Confira nosso horário de funcionamento.';
    END IF;
    v_abre := (v_dia_cfg->>'abre')::time; v_fecha := (v_dia_cfg->>'fecha')::time;
    IF v_hora < v_abre OR v_hora > v_fecha THEN
      RAISE EXCEPTION 'Estamos fechados no momento. Confira nosso horário de funcionamento.';
    END IF;
  END IF;

  IF _cliente IS NULL OR btrim(_cliente) = '' THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  IF length(v_wa) < 10 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item';
  END IF;

  v_tipo := CASE lower(coalesce(_tipo, 'retirada'))
              WHEN 'entrega' THEN 'entrega'
              WHEN 'local' THEN 'local'
              ELSE 'retirada' END;

  IF v_tipo = 'entrega' AND NOT v_cfg.aceita_entrega THEN
    RAISE EXCEPTION 'Entrega indisponível.';
  END IF;
  IF v_tipo = 'retirada' AND NOT v_cfg.aceita_retirada THEN
    RAISE EXCEPTION 'Retirada indisponível.';
  END IF;

  -- Taxa de entrega
  IF v_tipo = 'entrega' AND _entrega IS NOT NULL THEN
    v_bairro_id := NULLIF(_entrega->>'bairro_id','')::uuid;
    IF v_bairro_id IS NOT NULL THEN
      SELECT nome, valor_frete INTO v_bairro_nome, v_taxa
        FROM public.bairros_entrega
        WHERE id = v_bairro_id AND empresa_id = v_emp.id AND ativo = true;
      IF v_bairro_nome IS NULL THEN v_taxa := 0; END IF;
    END IF;
  END IF;

  v_forma := NULLIF(_pagamento->>'forma','');
  IF v_forma NOT IN ('pix','dinheiro','cartao_entrega') OR v_forma IS NULL THEN v_forma := 'pix'; END IF;
  v_troco := NULLIF(_pagamento->>'troco_para','')::numeric;

  SELECT id INTO v_mesa FROM public.mesas WHERE empresa_id = v_emp.id AND setor = 'online' LIMIT 1;
  IF v_mesa IS NULL THEN
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (9999, 1, 'online', 'livre', v_emp.id) RETURNING id INTO v_mesa;
  END IF;

  v_obs := format('[ONLINE • %s] WhatsApp: %s',
                  CASE v_tipo WHEN 'entrega' THEN 'ENTREGA' WHEN 'local' THEN 'CONSUMO LOCAL' ELSE 'RETIRADA' END,
                  v_wa);

  INSERT INTO public.comandas (
    mesa_id, status, cliente_nome, empresa_id, origem, observacao, status_online,
    tipo_entrega, endereco_cep, endereco_rua, endereco_numero, endereco_complemento,
    endereco_bairro, endereco_cidade, endereco_estado,
    forma_pagamento, troco_para, taxa_entrega
  )
  VALUES (
    v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online', v_obs, 'novo',
    v_tipo,
    _entrega->>'cep', _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(v_bairro_nome, _entrega->>'bairro'), _entrega->>'cidade', _entrega->>'estado',
    v_forma, v_troco, COALESCE(v_taxa,0)
  )
  RETURNING id INTO v_comanda;

  INSERT INTO public.pedidos (comanda_id, setor, status, total, empresa_id)
  VALUES (v_comanda, 'cozinha', 'pendente', 0, v_emp.id) RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    SELECT id, nome, preco INTO v_produto FROM public.produtos
      WHERE id = (v_item->>'produto_id')::uuid AND empresa_id = v_emp.id AND ativo = true;
    IF v_produto.id IS NULL THEN CONTINUE; END IF;
    v_qtd := GREATEST(1, COALESCE((v_item->>'quantidade')::int, 1));

    v_extras_total := 0;
    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome INTO v_adic
          FROM public.adicionais a JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid AND a.empresa_id = v_emp.id AND a.ativo = true;
        IF v_adic.id IS NULL THEN CONTINUE; END IF;
        v_extras_total := v_extras_total + v_adic.preco * GREATEST(1, COALESCE((v_ad->>'quantidade')::int, 1));
      END LOOP;
    END IF;

    INSERT INTO public.itens_pedido (pedido_id, produto_id, produto_nome, preco_unit, quantidade, empresa_id, observacao)
    VALUES (v_pedido, v_produto.id, v_produto.nome,
            v_produto.preco + v_extras_total, v_qtd, v_emp.id,
            NULLIF(btrim(coalesce(v_item->>'observacao','')), ''))
    RETURNING id INTO v_item_id;

    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome INTO v_adic
          FROM public.adicionais a JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid AND a.empresa_id = v_emp.id AND a.ativo = true;
        IF v_adic.id IS NULL THEN CONTINUE; END IF;
        INSERT INTO public.itens_pedido_adicionais
          (item_pedido_id, adicional_id, adicional_nome, grupo_id, grupo_nome, preco, quantidade, empresa_id)
        VALUES (v_item_id, v_adic.id, v_adic.nome, v_adic.grupo_id, v_adic.grupo_nome,
                v_adic.preco, GREATEST(1, COALESCE((v_ad->>'quantidade')::int, 1)), v_emp.id);
      END LOOP;
    END IF;
  END LOOP;

  -- Upsert cadastro do cliente (armazena preferências para o próximo pedido)
  INSERT INTO public.clientes_online (
    empresa_id, whatsapp, nome, cep, rua, numero, complemento, bairro, cidade, estado, forma_pagamento, last_pedido_at
  ) VALUES (
    v_emp.id, v_wa, btrim(_cliente),
    _entrega->>'cep', _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(v_bairro_nome, _entrega->>'bairro'), _entrega->>'cidade', _entrega->>'estado',
    v_forma, now()
  )
  ON CONFLICT (empresa_id, whatsapp) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.clientes_online.nome),
    cep = COALESCE(EXCLUDED.cep, public.clientes_online.cep),
    rua = COALESCE(EXCLUDED.rua, public.clientes_online.rua),
    numero = COALESCE(EXCLUDED.numero, public.clientes_online.numero),
    complemento = COALESCE(EXCLUDED.complemento, public.clientes_online.complemento),
    bairro = COALESCE(EXCLUDED.bairro, public.clientes_online.bairro),
    cidade = COALESCE(EXCLUDED.cidade, public.clientes_online.cidade),
    estado = COALESCE(EXCLUDED.estado, public.clientes_online.estado),
    forma_pagamento = COALESCE(EXCLUDED.forma_pagamento, public.clientes_online.forma_pagamento),
    last_pedido_at = now();

  RETURN jsonb_build_object('comanda_id', v_comanda, 'pedido_id', v_pedido, 'taxa_entrega', v_taxa);
END;
$$;
GRANT EXECUTE ON FUNCTION public.criar_pedido_online(text, text, text, text, jsonb, jsonb, jsonb) TO anon, authenticated;
