
-- Extensão do cardápio público: inclui horários, contatos e grupos de adicionais
CREATE OR REPLACE FUNCTION public.get_cardapio_publico(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record;
  v_cfg record;
  v_result jsonb;
BEGIN
  SELECT id, nome_fantasia, nome, pedido_online_ativo, slug,
         whatsapp_empresa, telefone_comercial
    INTO v_emp
    FROM public.empresas
   WHERE slug = lower(btrim(_slug))
   LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RETURN NULL;
  END IF;

  SELECT horario_ativo, horarios INTO v_cfg
    FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;

  SELECT jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', v_emp.id,
      'nome', COALESCE(v_emp.nome_fantasia, v_emp.nome),
      'slug', v_emp.slug,
      'whatsapp', v_emp.whatsapp_empresa,
      'telefone', v_emp.telefone_comercial,
      'horario_ativo', COALESCE(v_cfg.horario_ativo, false),
      'horarios', COALESCE(v_cfg.horarios, '{}'::jsonb)
    ),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'ordem', c.ordem
      ) ORDER BY c.ordem, c.nome)
      FROM public.categorias c
      WHERE c.empresa_id = v_emp.id AND c.ativo = true
    ), '[]'::jsonb),
    'produtos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'nome', p.nome, 'preco', p.preco,
        'descricao', p.descricao, 'imagem_url', p.imagem_url,
        'categoria_id', p.categoria_id,
        'tem_adicionais', COALESCE(p.tem_adicionais, false)
      ) ORDER BY p.nome)
      FROM public.produtos p
      WHERE p.empresa_id = v_emp.id AND p.ativo = true
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
      WHERE g.empresa_id = v_emp.id AND g.ativo = true
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
      WHERE pg.empresa_id = v_emp.id
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

-- Aceita WhatsApp, tipo (retirada/local) e adicionais por item
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _slug text,
  _cliente text,
  _whatsapp text,
  _tipo text,
  _itens jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp record;
  v_mesa uuid;
  v_comanda uuid;
  v_pedido uuid;
  v_item jsonb;
  v_ad jsonb;
  v_produto record;
  v_adic record;
  v_item_id uuid;
  v_qtd int;
  v_extras_total numeric;
  v_tipo text;
  v_obs text;
BEGIN
  SELECT id, pedido_online_ativo INTO v_emp
    FROM public.empresas
    WHERE slug = lower(btrim(_slug))
    LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN
    RAISE EXCEPTION 'Pedido online indisponível';
  END IF;
  IF _cliente IS NULL OR btrim(_cliente) = '' THEN
    RAISE EXCEPTION 'Informe seu nome';
  END IF;
  IF _whatsapp IS NULL OR length(regexp_replace(_whatsapp, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Informe um WhatsApp válido';
  END IF;
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item';
  END IF;

  v_tipo := CASE lower(coalesce(_tipo, 'retirada'))
              WHEN 'local' THEN 'local'
              ELSE 'retirada'
            END;

  SELECT id INTO v_mesa FROM public.mesas WHERE empresa_id = v_emp.id LIMIT 1;
  IF v_mesa IS NULL THEN
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (9999, 1, 'online', 'livre', v_emp.id)
    RETURNING id INTO v_mesa;
  END IF;

  v_obs := format('[ONLINE • %s] WhatsApp: %s',
                  CASE v_tipo WHEN 'local' THEN 'CONSUMO LOCAL' ELSE 'RETIRADA' END,
                  btrim(_whatsapp));

  INSERT INTO public.comandas (mesa_id, status, cliente_nome, empresa_id, origem, observacao)
  VALUES (v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online', v_obs)
  RETURNING id INTO v_comanda;

  INSERT INTO public.pedidos (comanda_id, setor, status, total, empresa_id)
  VALUES (v_comanda, 'cozinha', 'aberto', 0, v_emp.id)
  RETURNING id INTO v_pedido;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_itens) LOOP
    SELECT id, nome, preco INTO v_produto
      FROM public.produtos
      WHERE id = (v_item->>'produto_id')::uuid
        AND empresa_id = v_emp.id AND ativo = true;
    IF v_produto.id IS NULL THEN CONTINUE; END IF;
    v_qtd := GREATEST(1, COALESCE((v_item->>'quantidade')::int, 1));

    v_extras_total := 0;
    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome
          INTO v_adic
          FROM public.adicionais a
          JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid
           AND a.empresa_id = v_emp.id AND a.ativo = true;
        IF v_adic.id IS NULL THEN CONTINUE; END IF;
        v_extras_total := v_extras_total + v_adic.preco * GREATEST(1, COALESCE((v_ad->>'quantidade')::int, 1));
      END LOOP;
    END IF;

    INSERT INTO public.itens_pedido (pedido_id, produto_id, nome_snapshot, preco_unit, quantidade, subtotal, empresa_id, observacao)
    VALUES (v_pedido, v_produto.id, v_produto.nome,
            v_produto.preco + v_extras_total,
            v_qtd,
            (v_produto.preco + v_extras_total) * v_qtd,
            v_emp.id,
            NULLIF(btrim(coalesce(v_item->>'observacao','')), ''))
    RETURNING id INTO v_item_id;

    IF v_item ? 'adicionais' AND jsonb_typeof(v_item->'adicionais') = 'array' THEN
      FOR v_ad IN SELECT * FROM jsonb_array_elements(v_item->'adicionais') LOOP
        SELECT a.id, a.nome, a.preco, a.grupo_id, g.nome AS grupo_nome
          INTO v_adic
          FROM public.adicionais a
          JOIN public.grupos_adicionais g ON g.id = a.grupo_id
         WHERE a.id = (v_ad->>'adicional_id')::uuid
           AND a.empresa_id = v_emp.id AND a.ativo = true;
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

-- Remove versão antiga com 3 argumentos (assinatura mudou)
DROP FUNCTION IF EXISTS public.criar_pedido_online(text, text, jsonb);
