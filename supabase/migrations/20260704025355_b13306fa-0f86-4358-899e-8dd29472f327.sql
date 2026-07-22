CREATE OR REPLACE FUNCTION public.criar_pedido_online(_slug text, _cliente text, _whatsapp text, _tipo text, _itens jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record; v_cfg record; v_mesa uuid; v_comanda uuid; v_pedido uuid;
  v_item jsonb; v_ad jsonb; v_produto record; v_adic record; v_item_id uuid;
  v_qtd int; v_extras_total numeric; v_tipo text; v_obs text;
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_dia text; v_dia_cfg jsonb; v_abre time; v_fecha time; v_hora time;
BEGIN
  SELECT id, pedido_online_ativo INTO v_emp FROM public.empresas
    WHERE slug = lower(btrim(_slug)) LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RAISE EXCEPTION 'Pedidos online indisponíveis no momento.';
  END IF;

  SELECT horario_ativo, horarios INTO v_cfg FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;
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
  IF _whatsapp IS NULL OR length(regexp_replace(_whatsapp, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido';
  END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item';
  END IF;

  v_tipo := CASE lower(coalesce(_tipo, 'retirada')) WHEN 'local' THEN 'local' ELSE 'retirada' END;

  SELECT id INTO v_mesa FROM public.mesas WHERE empresa_id = v_emp.id LIMIT 1;
  IF v_mesa IS NULL THEN
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (9999, 1, 'online', 'livre', v_emp.id) RETURNING id INTO v_mesa;
  END IF;

  v_obs := format('[ONLINE • %s] WhatsApp: %s',
                  CASE v_tipo WHEN 'local' THEN 'CONSUMO LOCAL' ELSE 'RETIRADA' END,
                  btrim(_whatsapp));

  INSERT INTO public.comandas (mesa_id, status, cliente_nome, empresa_id, origem, observacao)
  VALUES (v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online', v_obs)
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

  RETURN jsonb_build_object('comanda_id', v_comanda, 'pedido_id', v_pedido);
END;
$function$;