
-- ============================================================
-- V2: Nova aplicação simplificada — tabelas paralelas
-- ============================================================

-- 1) CATEGORIAS
CREATE TABLE public.v2_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  icone text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_categorias_empresa_idx ON public.v2_categorias(empresa_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_categorias TO authenticated;
GRANT SELECT ON public.v2_categorias TO anon;
GRANT ALL ON public.v2_categorias TO service_role;
ALTER TABLE public.v2_categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_categorias_empresa_rw" ON public.v2_categorias FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "v2_categorias_public_read" ON public.v2_categorias FOR SELECT TO anon USING (ativo = true);

-- 2) PRODUTOS
CREATE TABLE public.v2_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria_id uuid REFERENCES public.v2_categorias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  descricao text,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  foto_url text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_produtos_empresa_idx ON public.v2_produtos(empresa_id, categoria_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_produtos TO authenticated;
GRANT SELECT ON public.v2_produtos TO anon;
GRANT ALL ON public.v2_produtos TO service_role;
ALTER TABLE public.v2_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_produtos_empresa_rw" ON public.v2_produtos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "v2_produtos_public_read" ON public.v2_produtos FOR SELECT TO anon USING (ativo = true);

-- 3) GRUPOS DE ADICIONAIS
CREATE TABLE public.v2_grupos_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT false,
  min_escolhas int NOT NULL DEFAULT 0,
  max_escolhas int NOT NULL DEFAULT 1,
  selecao_multipla boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_grupos_adicionais TO authenticated;
GRANT SELECT ON public.v2_grupos_adicionais TO anon;
GRANT ALL ON public.v2_grupos_adicionais TO service_role;
ALTER TABLE public.v2_grupos_adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_grupos_empresa_rw" ON public.v2_grupos_adicionais FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "v2_grupos_public_read" ON public.v2_grupos_adicionais FOR SELECT TO anon USING (true);

-- 4) ADICIONAIS
CREATE TABLE public.v2_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.v2_grupos_adicionais(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_adicionais_grupo_idx ON public.v2_adicionais(grupo_id, ordem);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_adicionais TO authenticated;
GRANT SELECT ON public.v2_adicionais TO anon;
GRANT ALL ON public.v2_adicionais TO service_role;
ALTER TABLE public.v2_adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_adicionais_empresa_rw" ON public.v2_adicionais FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "v2_adicionais_public_read" ON public.v2_adicionais FOR SELECT TO anon USING (ativo = true);

-- 5) PRODUTO ↔ GRUPO
CREATE TABLE public.v2_produto_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.v2_produtos(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.v2_grupos_adicionais(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(produto_id, grupo_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_produto_grupos TO authenticated;
GRANT SELECT ON public.v2_produto_grupos TO anon;
GRANT ALL ON public.v2_produto_grupos TO service_role;
ALTER TABLE public.v2_produto_grupos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_pg_empresa_rw" ON public.v2_produto_grupos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "v2_pg_public_read" ON public.v2_produto_grupos FOR SELECT TO anon USING (true);

-- 6) COMANDAS
CREATE TABLE public.v2_comandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  numero int NOT NULL,
  cliente_nome text,
  status text NOT NULL DEFAULT 'aberta',
  total numeric(10,2) NOT NULL DEFAULT 0,
  aberta_em timestamptz NOT NULL DEFAULT now(),
  fechada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_comandas TO authenticated;
GRANT ALL ON public.v2_comandas TO service_role;
ALTER TABLE public.v2_comandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_comandas_empresa_rw" ON public.v2_comandas FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());

-- 7) PEDIDOS
CREATE TABLE public.v2_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  comanda_id uuid REFERENCES public.v2_comandas(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'interno', -- interno | online
  status text NOT NULL DEFAULT 'novo', -- novo | preparo | pronto | finalizado | cancelado
  tipo text, -- mesa | retirada | entrega
  cliente_nome text,
  cliente_whatsapp text,
  observacao text,
  total numeric(10,2) NOT NULL DEFAULT 0,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  impresso_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_pedidos_empresa_status_idx ON public.v2_pedidos(empresa_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_pedidos TO authenticated;
GRANT SELECT, INSERT ON public.v2_pedidos TO anon;
GRANT ALL ON public.v2_pedidos TO service_role;
ALTER TABLE public.v2_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_pedidos_empresa_rw" ON public.v2_pedidos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());
-- (política de anon para cardápio público será restrita depois, na fase online)

-- 8) ITENS DO PEDIDO
CREATE TABLE public.v2_itens_pedido (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.v2_pedidos(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.v2_produtos(id) ON DELETE SET NULL,
  produto_nome text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  preco_unit numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_itens_pedido_idx ON public.v2_itens_pedido(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_itens_pedido TO authenticated;
GRANT SELECT, INSERT ON public.v2_itens_pedido TO anon;
GRANT ALL ON public.v2_itens_pedido TO service_role;
ALTER TABLE public.v2_itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_itens_empresa_rw" ON public.v2_itens_pedido FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());

-- 9) ITEM ↔ ADICIONAIS
CREATE TABLE public.v2_item_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.v2_itens_pedido(id) ON DELETE CASCADE,
  adicional_id uuid REFERENCES public.v2_adicionais(id) ON DELETE SET NULL,
  adicional_nome text NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  quantidade int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX v2_item_adicionais_idx ON public.v2_item_adicionais(item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.v2_item_adicionais TO authenticated;
GRANT SELECT, INSERT ON public.v2_item_adicionais TO anon;
GRANT ALL ON public.v2_item_adicionais TO service_role;
ALTER TABLE public.v2_item_adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "v2_item_ad_empresa_rw" ON public.v2_item_adicionais FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id()) WITH CHECK (empresa_id = public.minha_empresa_id());

-- Triggers updated_at
CREATE TRIGGER v2_categorias_updated BEFORE UPDATE ON public.v2_categorias FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER v2_produtos_updated BEFORE UPDATE ON public.v2_produtos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER v2_grupos_updated BEFORE UPDATE ON public.v2_grupos_adicionais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER v2_adicionais_updated BEFORE UPDATE ON public.v2_adicionais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER v2_comandas_updated BEFORE UPDATE ON public.v2_comandas FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER v2_pedidos_updated BEFORE UPDATE ON public.v2_pedidos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Recalcular totais
CREATE OR REPLACE FUNCTION public.v2_recalc_pedido() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p_id uuid;
BEGIN
  p_id := COALESCE(NEW.pedido_id, OLD.pedido_id);
  UPDATE public.v2_pedidos SET total = COALESCE((
    SELECT SUM(subtotal) FROM public.v2_itens_pedido WHERE pedido_id = p_id
  ), 0), updated_at = now() WHERE id = p_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER v2_itens_recalc AFTER INSERT OR UPDATE OR DELETE ON public.v2_itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.v2_recalc_pedido();

CREATE OR REPLACE FUNCTION public.v2_recalc_comanda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c_id uuid;
BEGIN
  c_id := COALESCE(NEW.comanda_id, OLD.comanda_id);
  IF c_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  UPDATE public.v2_comandas SET total = COALESCE((
    SELECT SUM(total) FROM public.v2_pedidos WHERE comanda_id = c_id AND status <> 'cancelado'
  ), 0), updated_at = now() WHERE id = c_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER v2_pedidos_recalc AFTER INSERT OR UPDATE OR DELETE ON public.v2_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.v2_recalc_comanda();
