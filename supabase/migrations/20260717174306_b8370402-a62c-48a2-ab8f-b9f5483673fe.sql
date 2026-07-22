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
  SELECT id, nome_fantasia, nome, pedido_online_ativo, slug
    INTO v_emp FROM public.empresas WHERE slug = lower(btrim(_slug)) LIMIT 1;
  IF v_emp.id IS NULL OR NOT v_emp.pedido_online_ativo THEN RETURN NULL; END IF;

  SELECT horario_ativo, horarios, whatsapp_empresa, telefone_comercial,
         COALESCE(delivery_retirada_ativo,false) AS delivery_retirada_ativo,
         COALESCE(aceita_retirada,true) AS aceita_retirada,
         COALESCE(aceita_entrega,false) AS aceita_entrega,
         COALESCE(cobrar_taxa_entrega,true) AS cobrar_taxa_entrega,
         COALESCE(taxa_entrega,0) AS taxa_entrega,
         COALESCE(pedido_minimo,0) AS pedido_minimo,
         COALESCE(tempo_preparo_min,30) AS tempo_preparo_min,
         COALESCE(exibir_cardapio_online,true) AS exibir_cardapio_online
    INTO v_cfg FROM public.configuracoes WHERE empresa_id = v_emp.id LIMIT 1;

  IF NOT COALESCE(v_cfg.exibir_cardapio_online, true) THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', v_emp.id, 'nome', COALESCE(v_emp.nome_fantasia, v_emp.nome), 'slug', v_emp.slug,
      'whatsapp', v_cfg.whatsapp_empresa, 'telefone', v_cfg.telefone_comercial,
      'horario_ativo', COALESCE(v_cfg.horario_ativo, false),
      'horarios', COALESCE(v_cfg.horarios, '{}'::jsonb)
    ),
    'config_delivery', jsonb_build_object(
      'delivery_retirada_ativo', v_cfg.delivery_retirada_ativo,
      'aceita_retirada', v_cfg.aceita_retirada,
      'aceita_entrega', v_cfg.aceita_entrega,
      'cobrar_taxa_entrega', v_cfg.cobrar_taxa_entrega,
      'taxa_entrega', v_cfg.taxa_entrega,
      'pedido_minimo', v_cfg.pedido_minimo,
      'tempo_preparo_min', v_cfg.tempo_preparo_min
    ),
    'bairros', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome, 'valor_frete', b.valor_frete, 'pedido_minimo', b.pedido_minimo) ORDER BY b.nome)
      FROM public.bairros_entrega b WHERE b.empresa_id = v_emp.id AND b.ativo = true
    ), '[]'::jsonb),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'ordem', c.ordem) ORDER BY c.ordem, c.nome)
      FROM public.categorias c
      WHERE c.empresa_id = v_emp.id AND c.ativo = true
        AND EXISTS (SELECT 1 FROM public.produtos p WHERE p.categoria_id = c.id AND p.empresa_id = v_emp.id AND p.ativo = true AND COALESCE(p.exibir_online, true) = true)
    ), '[]'::jsonb),
    'produtos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'nome', p.nome, 'descricao', p.descricao, 'preco', p.preco, 'imagem_url', p.imagem_url, 'categoria_id', p.categoria_id, 'tem_adicionais', p.tem_adicionais) ORDER BY p.nome)
      FROM public.produtos p WHERE p.empresa_id = v_emp.id AND p.ativo = true AND COALESCE(p.exibir_online, true) = true
    ), '[]'::jsonb),
    'grupos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', g.id, 'nome', g.nome, 'descricao', g.descricao,
        'tipo_selecao', g.tipo_selecao, 'min_selecao', g.min_selecao,
        'max_selecao', g.max_selecao, 'max_ilimitado', g.max_ilimitado,
        'obrigatorio', g.obrigatorio
      ) ORDER BY g.nome)
      FROM public.grupos_adicionais g WHERE g.empresa_id = v_emp.id AND g.ativo = true
    ), '[]'::jsonb),
    'produto_grupos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('produto_id', pg.produto_id, 'grupo_id', pg.grupo_id, 'ordem', pg.ordem,
        'min_selecao', pg.min_selecao, 'max_selecao', pg.max_selecao, 'obrigatorio', pg.obrigatorio))
      FROM public.produto_grupos_adicionais pg JOIN public.produtos p ON p.id = pg.produto_id
      WHERE p.empresa_id = v_emp.id AND p.ativo = true AND COALESCE(p.exibir_online, true) = true
    ), '[]'::jsonb),
    'adicionais', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', a.id, 'grupo_id', a.grupo_id, 'nome', a.nome, 'preco', a.preco) ORDER BY a.nome)
      FROM public.adicionais a JOIN public.grupos_adicionais g ON g.id = a.grupo_id
      WHERE g.empresa_id = v_emp.id AND a.ativo = true
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$function$;