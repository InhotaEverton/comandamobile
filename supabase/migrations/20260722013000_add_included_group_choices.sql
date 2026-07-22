ALTER TABLE public.grupos_adicionais
  ADD COLUMN IF NOT EXISTS qtd_inclusa integer NOT NULL DEFAULT 0 CHECK (qtd_inclusa >= 0);

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

  SELECT horario_ativo, horarios, whatsapp_empresa, telefone_comercial, logo_url,
         COALESCE(delivery_retirada_ativo,false) AS delivery_retirada_ativo,
         COALESCE(aceita_retirada,true) AS aceita_retirada,
         COALESCE(aceita_entrega,false) AS aceita_entrega,
         COALESCE(cobrar_taxa_entrega,true) AS cobrar_taxa_entrega,
         COALESCE(pedido_minimo,0) AS pedido_minimo,
         COALESCE(tempo_preparo_min,30) AS tempo_preparo_min,
         COALESCE(exibir_cardapio_online,true) AS exibir_cardapio_online,
         COALESCE(taxa_entrega,0) AS taxa_entrega,
         COALESCE(tempo_entrega_min,0) AS tempo_entrega_min,
         COALESCE(tempo_entrega_max,0) AS tempo_entrega_max,
         COALESCE(tempo_retirada_min,0) AS tempo_retirada_min,
         COALESCE(tempo_retirada_max,0) AS tempo_retirada_max,
         COALESCE(exibir_tempo_estimado,true) AS exibir_tempo_estimado
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
      'logo_url', v_cfg.logo_url,
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
      'tempo_preparo_min', v_cfg.tempo_preparo_min,
      'taxa_entrega', v_cfg.taxa_entrega,
      'tempo_entrega_min', v_cfg.tempo_entrega_min,
      'tempo_entrega_max', v_cfg.tempo_entrega_max,
      'tempo_retirada_min', v_cfg.tempo_retirada_min,
      'tempo_retirada_max', v_cfg.tempo_retirada_max,
      'exibir_tempo_estimado', v_cfg.exibir_tempo_estimado
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
        'qtd_inclusa', COALESCE(g.qtd_inclusa, 0),
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


CREATE OR REPLACE FUNCTION public.criar_pedido_online(_slug text, _cliente text, _whatsapp text, _tipo text, _itens jsonb, _entrega jsonb DEFAULT NULL::jsonb, _pagamento jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record; v_cfg record; v_mesa uuid; v_comanda uuid; v_pedido uuid;
  v_item jsonb; v_ad jsonb; v_produto record; v_adic record; v_item_id uuid;
  v_qtd int; v_extras_total numeric; v_tipo text; v_obs text;
  v_grupo_usado jsonb; v_ad_qtd int; v_livre int; v_cobravel int; v_preco_cobrado numeric;
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dia text; v_dia_cfg jsonb; v_abre time; v_fecha time; v_hora time;
  v_wa text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g');
  v_taxa numeric(10,2) := 0; v_forma text; v_troco numeric(10,2);
  v_bairro_id uuid;
  v_bairro_nome text := NULL;
  v_bairro_valor numeric := NULL;
  v_bairro_min numeric := NULL;
  v_bairro_ativo boolean := NULL;
  v_subtotal numeric := 0;
  v_tempo_min int; v_tempo_max int;
BEGIN
  SELECT id, pedido_online_ativo INTO v_emp FROM public.empresas WHERE slug = lower(btrim(_slug)) LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RAISE EXCEPTION 'Pedidos online indisponíveis no momento.';
  END IF;

  SELECT horario_ativo, horarios,
         COALESCE(aceita_retirada,true) AS aceita_retirada,
         COALESCE(aceita_entrega,false) AS aceita_entrega,
         COALESCE(cobrar_taxa_entrega,true) AS cobrar_taxa_entrega,
         COALESCE(taxa_entrega,0) AS taxa_entrega,
         COALESCE(pedido_minimo,0) AS pedido_minimo,
         tempo_entrega_min, tempo_entrega_max,
         tempo_retirada_min, tempo_retirada_max
    INTO v_cfg FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;

  v_hora := v_now::time;
  IF COALESCE(v_cfg.horario_ativo, false) THEN
    v_dia := CASE extract(dow FROM v_now)::int WHEN 0 THEN 'dom' WHEN 1 THEN 'seg' WHEN 2 THEN 'ter'
               WHEN 3 THEN 'qua' WHEN 4 THEN 'qui' WHEN 5 THEN 'sex' WHEN 6 THEN 'sab' END;
    v_dia_cfg := v_cfg.horarios -> v_dia;
    IF v_dia_cfg IS NULL OR NOT COALESCE((v_dia_cfg->>'aberto')::boolean, false) THEN
      RAISE EXCEPTION 'Estamos fechados no momento.';
    END IF;
    v_abre := (v_dia_cfg->>'abre')::time; v_fecha := (v_dia_cfg->>'fecha')::time;
    IF v_hora < v_abre OR v_hora > v_fecha THEN
      RAISE EXCEPTION 'Estamos fechados no momento.';
    END IF;
  END IF;

  IF _cliente IS NULL OR btrim(_cliente) = '' THEN RAISE EXCEPTION 'Informe seu nome'; END IF;
  IF length(v_wa) < 10 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item';
  END IF;

  v_tipo := CASE lower(coalesce(_tipo, 'retirada'))
              WHEN 'entrega' THEN 'entrega' WHEN 'local' THEN 'local' ELSE 'retirada' END;

  IF v_tipo = 'entrega' AND NOT v_cfg.aceita_entrega THEN RAISE EXCEPTION 'Entrega indisponível.'; END IF;
  IF v_tipo = 'retirada' AND NOT v_cfg.aceita_retirada THEN RAISE EXCEPTION 'Retirada indisponível.'; END IF;

  IF v_tipo = 'entrega' AND v_cfg.cobrar_taxa_entrega THEN
    v_bairro_id := NULLIF(_entrega->>'bairro_id','')::uuid;
    IF v_bairro_id IS NOT NULL THEN
      SELECT nome, valor_frete, pedido_minimo, ativo
        INTO v_bairro_nome, v_bairro_valor, v_bairro_min, v_bairro_ativo
        FROM public.bairros_entrega WHERE id = v_bairro_id AND empresa_id = v_emp.id LIMIT 1;
      IF v_bairro_nome IS NULL OR NOT COALESCE(v_bairro_ativo,false) THEN
        RAISE EXCEPTION 'Bairro indisponível para entrega.';
      END IF;
      v_taxa := COALESCE(v_bairro_valor, 0);
    ELSE
      v_taxa := COALESCE(v_cfg.taxa_entrega, 0);
    END IF;
  END IF;

  v_forma := NULLIF(_pagamento->>'forma','');
  IF v_forma NOT IN ('pix','dinheiro','cartao_entrega') OR v_forma IS NULL THEN v_forma := 'pix'; END IF;
  v_troco := NULLIF(_pagamento->>'troco_para','')::numeric;

  -- Snapshot do tempo estimado no momento da compra
  IF v_tipo = 'entrega' THEN
    v_tempo_min := v_cfg.tempo_entrega_min;
    v_tempo_max := v_cfg.tempo_entrega_max;
  ELSIF v_tipo = 'retirada' THEN
    v_tempo_min := v_cfg.tempo_retirada_min;
    v_tempo_max := v_cfg.tempo_retirada_max;
  END IF;

  SELECT id INTO v_mesa FROM public.mesas WHERE empresa_id = v_emp.id AND setor = 'online' LIMIT 1;
  IF v_mesa IS NULL THEN
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (9999, 1, 'online', 'livre', v_emp.id) RETURNING id INTO v_mesa;
  END IF;

  v_obs := format('[ONLINE • %s] WhatsApp: %s',
    CASE v_tipo WHEN 'entrega' THEN 'ENTREGA' WHEN 'local' THEN 'CONSUMO LOCAL' ELSE 'RETIRADA' END, v_wa);

  INSERT INTO public.comandas (mesa_id, status, cliente_nome, empresa_id, origem, observacao, status_online,
    tipo_entrega, endereco_rua, endereco_numero, endereco_complemento,
    endereco_bairro, forma_pagamento, troco_para, taxa_entrega,
    tempo_estimado_min, tempo_estimado_max)
  VALUES (v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online', v_obs, 'novo', v_tipo,
    _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(_entrega->>'bairro', v_bairro_nome),
    v_forma, v_troco, COALESCE(v_taxa,0),
    v_tempo_min, v_tempo_max)
  RETURNING id INTO v_comanda;

  INSERT INTO public.pedidos (comanda_id, setor, status, total, empresa_id)
  VALUES (v_comanda, 'cozinha', 'pendente', 0, v_emp.id) RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    SELECT id, nome, preco INTO v_produto FROM public.produtos
      WHERE id = (v_item->>'produto_id')::uuid AND empresa_id = v_emp.id AND ativo = true;
    IF v_produto.id IS NULL THEN CONTINUE; END IF;
    v_qtd := GREATEST(1, COALESCE((v_item->>'quantidade')::int, 1));
    v_extras_total := 0;
    v_grupo_usado := '{}'::jsonb;
    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome, COALESCE(g.qtd_inclusa,0) AS qtd_inclusa INTO v_adic
          FROM public.adicionais a JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid AND a.empresa_id = v_emp.id AND a.ativo = true;
        IF v_adic.id IS NULL THEN CONTINUE; END IF;
        v_ad_qtd := GREATEST(1, COALESCE((v_ad->>'quantidade')::int, 1));
        v_livre := GREATEST(0, v_adic.qtd_inclusa - COALESCE((v_grupo_usado->>v_adic.grupo_id::text)::int, 0));
        v_cobravel := GREATEST(0, v_ad_qtd - v_livre);
        v_preco_cobrado := v_adic.preco * v_cobravel;
        v_grupo_usado := jsonb_set(v_grupo_usado, ARRAY[v_adic.grupo_id::text], to_jsonb(COALESCE((v_grupo_usado->>v_adic.grupo_id::text)::int, 0) + v_ad_qtd));
        v_extras_total := v_extras_total + v_preco_cobrado;
      END LOOP;
    END IF;
    v_subtotal := v_subtotal + (v_produto.preco + v_extras_total) * v_qtd;
    INSERT INTO public.itens_pedido (pedido_id, produto_id, produto_nome, preco_unit, quantidade, empresa_id, observacao)
    VALUES (v_pedido, v_produto.id, v_produto.nome, v_produto.preco + v_extras_total, v_qtd, v_emp.id,
            NULLIF(btrim(coalesce(v_item->>'observacao','')), '')) RETURNING id INTO v_item_id;
    v_grupo_usado := '{}'::jsonb;
    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome, COALESCE(g.qtd_inclusa,0) AS qtd_inclusa INTO v_adic
          FROM public.adicionais a JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid AND a.empresa_id = v_emp.id AND a.ativo = true;
        IF v_adic.id IS NULL THEN CONTINUE; END IF;
        v_ad_qtd := GREATEST(1, COALESCE((v_ad->>'quantidade')::int, 1));
        v_livre := GREATEST(0, v_adic.qtd_inclusa - COALESCE((v_grupo_usado->>v_adic.grupo_id::text)::int, 0));
        v_cobravel := GREATEST(0, v_ad_qtd - v_livre);
        v_preco_cobrado := v_adic.preco * v_cobravel;
        v_grupo_usado := jsonb_set(v_grupo_usado, ARRAY[v_adic.grupo_id::text], to_jsonb(COALESCE((v_grupo_usado->>v_adic.grupo_id::text)::int, 0) + v_ad_qtd));
        INSERT INTO public.itens_pedido_adicionais
          (item_pedido_id, adicional_id, adicional_nome, grupo_id, grupo_nome, preco, quantidade, empresa_id)
        VALUES (v_item_id, v_adic.id, v_adic.nome, v_adic.grupo_id, v_adic.grupo_nome,
                CASE WHEN v_ad_qtd > 0 THEN v_preco_cobrado / v_ad_qtd ELSE 0 END, v_ad_qtd, v_emp.id);
      END LOOP;
    END IF;
  END LOOP;

  IF v_cfg.pedido_minimo > 0 AND v_subtotal < v_cfg.pedido_minimo THEN
    RAISE EXCEPTION 'Pedido mínimo de R$ %.', to_char(v_cfg.pedido_minimo,'FM999999990.00');
  END IF;
  IF v_bairro_min IS NOT NULL AND v_subtotal < v_bairro_min THEN
    RAISE EXCEPTION 'Pedido mínimo para este bairro: R$ %.', to_char(v_bairro_min,'FM999999990.00');
  END IF;

  INSERT INTO public.clientes_online (empresa_id, whatsapp, nome, rua, numero, complemento, bairro, forma_pagamento, last_pedido_at)
  VALUES (v_emp.id, v_wa, btrim(_cliente),
    _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(_entrega->>'bairro', v_bairro_nome), v_forma, now())
  ON CONFLICT (empresa_id, whatsapp) DO UPDATE SET
    nome = COALESCE(EXCLUDED.nome, public.clientes_online.nome),
    rua = COALESCE(EXCLUDED.rua, public.clientes_online.rua),
    numero = COALESCE(EXCLUDED.numero, public.clientes_online.numero),
    complemento = COALESCE(EXCLUDED.complemento, public.clientes_online.complemento),
    bairro = COALESCE(EXCLUDED.bairro, public.clientes_online.bairro),
    forma_pagamento = COALESCE(EXCLUDED.forma_pagamento, public.clientes_online.forma_pagamento),
    last_pedido_at = now();

  RETURN jsonb_build_object(
    'comanda_id', v_comanda,
    'pedido_id', v_pedido,
    'taxa_entrega', v_taxa,
    'tempo_estimado_min', v_tempo_min,
    'tempo_estimado_max', v_tempo_max
  );
END; $function$;
