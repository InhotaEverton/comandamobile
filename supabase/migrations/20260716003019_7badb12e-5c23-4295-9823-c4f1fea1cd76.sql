
-- 1) Remove old overload that caused ambiguous function resolution in PostgREST
DROP FUNCTION IF EXISTS public.criar_pedido_online(text, text, text, text, jsonb);

-- 2) Rebuild the 7-arg function so it uses the neighborhood table for delivery fee
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _slug text, _cliente text, _whatsapp text, _tipo text, _itens jsonb,
  _entrega jsonb DEFAULT NULL, _pagamento jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_emp record; v_cfg record; v_mesa uuid; v_comanda uuid; v_pedido uuid;
  v_item jsonb; v_ad jsonb; v_produto record; v_adic record; v_item_id uuid;
  v_qtd int; v_extras_total numeric; v_tipo text; v_obs text;
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dia text; v_dia_cfg jsonb; v_abre time; v_fecha time; v_hora time;
  v_wa text := regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g');
  v_taxa numeric(10,2) := 0; v_forma text; v_troco numeric(10,2);
  v_bairro_id uuid; v_bairro record; v_subtotal numeric := 0; v_min_bairro numeric;
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
         COALESCE(pedido_minimo,0) AS pedido_minimo
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

  -- Compute delivery fee from bairro when informed, else fallback to configuracoes.taxa_entrega
  IF v_tipo = 'entrega' AND v_cfg.cobrar_taxa_entrega THEN
    v_bairro_id := NULLIF(_entrega->>'bairro_id','')::uuid;
    IF v_bairro_id IS NOT NULL THEN
      SELECT id, nome, valor_frete, pedido_minimo, ativo INTO v_bairro
        FROM public.bairros_entrega WHERE id = v_bairro_id AND empresa_id = v_emp.id LIMIT 1;
      IF v_bairro.id IS NULL OR NOT v_bairro.ativo THEN
        RAISE EXCEPTION 'Bairro indisponível para entrega.';
      END IF;
      v_taxa := COALESCE(v_bairro.valor_frete, 0);
      v_min_bairro := v_bairro.pedido_minimo;
    ELSE
      v_taxa := COALESCE(v_cfg.taxa_entrega, 0);
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
    CASE v_tipo WHEN 'entrega' THEN 'ENTREGA' WHEN 'local' THEN 'CONSUMO LOCAL' ELSE 'RETIRADA' END, v_wa);

  INSERT INTO public.comandas (mesa_id, status, cliente_nome, empresa_id, origem, observacao, status_online,
    tipo_entrega, endereco_cep, endereco_rua, endereco_numero, endereco_complemento,
    endereco_bairro, endereco_cidade, endereco_estado, forma_pagamento, troco_para, taxa_entrega)
  VALUES (v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online', v_obs, 'novo', v_tipo,
    _entrega->>'cep', _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(_entrega->>'bairro', v_bairro.nome),
    _entrega->>'cidade', _entrega->>'estado',
    v_forma, v_troco, COALESCE(v_taxa,0))
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
    v_subtotal := v_subtotal + (v_produto.preco + v_extras_total) * v_qtd;
    INSERT INTO public.itens_pedido (pedido_id, produto_id, produto_nome, preco_unit, quantidade, empresa_id, observacao)
    VALUES (v_pedido, v_produto.id, v_produto.nome, v_produto.preco + v_extras_total, v_qtd, v_emp.id,
            NULLIF(btrim(coalesce(v_item->>'observacao','')), '')) RETURNING id INTO v_item_id;
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

  -- Validate minimums (do this at the end for consistency; will still rollback on RAISE)
  IF v_cfg.pedido_minimo > 0 AND v_subtotal < v_cfg.pedido_minimo THEN
    RAISE EXCEPTION 'Pedido mínimo de R$ %.', to_char(v_cfg.pedido_minimo,'FM999999990.00');
  END IF;
  IF v_min_bairro IS NOT NULL AND v_subtotal < v_min_bairro THEN
    RAISE EXCEPTION 'Pedido mínimo para este bairro: R$ %.', to_char(v_min_bairro,'FM999999990.00');
  END IF;

  INSERT INTO public.clientes_online (empresa_id, whatsapp, nome, cep, rua, numero, complemento, bairro, cidade, estado, forma_pagamento, last_pedido_at)
  VALUES (v_emp.id, v_wa, btrim(_cliente),
    _entrega->>'cep', _entrega->>'rua', _entrega->>'numero', _entrega->>'complemento',
    COALESCE(_entrega->>'bairro', v_bairro.nome), _entrega->>'cidade', _entrega->>'estado', v_forma, now())
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
END; $$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_online(text,text,text,text,jsonb,jsonb,jsonb) TO anon, authenticated;
