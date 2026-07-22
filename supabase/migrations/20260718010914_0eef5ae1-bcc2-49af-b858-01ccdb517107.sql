
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Políticas do bucket 'logos'
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_admin_insert" ON storage.objects;
CREATE POLICY "logos_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'logos'
    AND public.is_admin(auth.uid())
    AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
  );

DROP POLICY IF EXISTS "logos_admin_update" ON storage.objects;
CREATE POLICY "logos_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_admin(auth.uid())
    AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
  );

DROP POLICY IF EXISTS "logos_admin_delete" ON storage.objects;
CREATE POLICY "logos_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'logos'
    AND public.is_admin(auth.uid())
    AND (storage.foldername(name))[1] = public.minha_empresa_id()::text
  );

-- Atualiza get_cardapio_publico para incluir logo_url
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
