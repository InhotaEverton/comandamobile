
-- Slug público e toggle de pedido online na empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS pedido_online_ativo boolean NOT NULL DEFAULT false;

-- Origem da comanda (salao | online)
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'salao';

-- RPC pública: cardápio por slug
CREATE OR REPLACE FUNCTION public.get_cardapio_publico(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
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

  SELECT jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', v_emp.id,
      'nome', COALESCE(v_emp.nome_fantasia, v_emp.nome),
      'slug', v_emp.slug
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
        'categoria_id', p.categoria_id
      ) ORDER BY p.nome)
      FROM public.produtos p
      WHERE p.empresa_id = v_emp.id AND p.ativo = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_cardapio_publico(text) TO anon, authenticated;

-- RPC pública: criar pedido online
CREATE OR REPLACE FUNCTION public.criar_pedido_online(
  _slug text, _cliente text, _itens jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp record;
  v_mesa uuid;
  v_comanda uuid;
  v_pedido uuid;
  v_item jsonb;
  v_produto record;
  v_qtd int;
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
  IF _itens IS NULL OR jsonb_typeof(_itens) <> 'array' OR jsonb_array_length(_itens) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um item';
  END IF;

  -- Reutiliza qualquer mesa da empresa (comanda virtual)
  SELECT id INTO v_mesa FROM public.mesas WHERE empresa_id = v_emp.id LIMIT 1;
  IF v_mesa IS NULL THEN
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (9999, 1, 'online', 'livre', v_emp.id)
    RETURNING id INTO v_mesa;
  END IF;

  INSERT INTO public.comandas (mesa_id, status, cliente_nome, empresa_id, origem)
  VALUES (v_mesa, 'aberta', btrim(_cliente), v_emp.id, 'online')
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
    INSERT INTO public.itens_pedido (pedido_id, produto_id, nome_snapshot, preco_unit, quantidade, subtotal, empresa_id)
    VALUES (v_pedido, v_produto.id, v_produto.nome, v_produto.preco, v_qtd, v_produto.preco * v_qtd, v_emp.id);
  END LOOP;

  RETURN jsonb_build_object('comanda_id', v_comanda, 'pedido_id', v_pedido);
END;
$$;

GRANT EXECUTE ON FUNCTION public.criar_pedido_online(text, text, jsonb) TO anon, authenticated;
