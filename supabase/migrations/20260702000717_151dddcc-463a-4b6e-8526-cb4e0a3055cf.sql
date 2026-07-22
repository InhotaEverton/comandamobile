
-- 1) Flag no produto
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS tem_adicionais boolean NOT NULL DEFAULT false;

-- 2) Grupos de adicionais (reutilizáveis)
CREATE TABLE public.grupos_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_grupos_adicionais_empresa ON public.grupos_adicionais(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_adicionais TO authenticated;
GRANT ALL ON public.grupos_adicionais TO service_role;
ALTER TABLE public.grupos_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupos_adicionais_select" ON public.grupos_adicionais
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "grupos_adicionais_admin_write" ON public.grupos_adicionais
  FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')));

CREATE TRIGGER trg_grupos_adicionais_touch BEFORE UPDATE ON public.grupos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) Adicionais (itens de um grupo)
CREATE TABLE public.adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.grupos_adicionais(id) ON DELETE CASCADE,
  nome text NOT NULL,
  preco numeric(10,2) NOT NULL DEFAULT 0,
  ordem int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_adicionais_empresa ON public.adicionais(empresa_id);
CREATE INDEX idx_adicionais_grupo ON public.adicionais(grupo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adicionais TO authenticated;
GRANT ALL ON public.adicionais TO service_role;
ALTER TABLE public.adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adicionais_select" ON public.adicionais
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "adicionais_admin_write" ON public.adicionais
  FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')));

CREATE TRIGGER trg_adicionais_touch BEFORE UPDATE ON public.adicionais
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) Vínculo produto ↔ grupo (com regras por produto)
CREATE TABLE public.produto_grupos_adicionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL REFERENCES public.grupos_adicionais(id) ON DELETE CASCADE,
  obrigatorio boolean NOT NULL DEFAULT false,
  min_selecao int NOT NULL DEFAULT 0,
  max_selecao int NOT NULL DEFAULT 1,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (produto_id, grupo_id),
  CHECK (min_selecao >= 0),
  CHECK (max_selecao >= min_selecao)
);
CREATE INDEX idx_pga_empresa ON public.produto_grupos_adicionais(empresa_id);
CREATE INDEX idx_pga_produto ON public.produto_grupos_adicionais(produto_id);
CREATE INDEX idx_pga_grupo ON public.produto_grupos_adicionais(grupo_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_grupos_adicionais TO authenticated;
GRANT ALL ON public.produto_grupos_adicionais TO service_role;
ALTER TABLE public.produto_grupos_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pga_select" ON public.produto_grupos_adicionais
  FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());

CREATE POLICY "pga_admin_write" ON public.produto_grupos_adicionais
  FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.is_admin(auth.uid()) OR public.has_role(auth.uid(),'caixa')));

CREATE TRIGGER trg_pga_touch BEFORE UPDATE ON public.produto_grupos_adicionais
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
