
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'garcom', 'cozinha', 'caixa');
CREATE TYPE public.mesa_status AS ENUM ('livre', 'ocupada', 'fechando');
CREATE TYPE public.comanda_status AS ENUM ('aberta', 'fechando', 'fechada', 'cancelada');
CREATE TYPE public.pedido_status AS ENUM ('pendente', 'preparo', 'pronto', 'entregue', 'cancelado');
CREATE TYPE public.setor AS ENUM ('cozinha', 'bar', 'sobremesas');
CREATE TYPE public.forma_pagamento AS ENUM ('pix', 'dinheiro', 'credito', 'debito');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  telefone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver todos profiles autenticados"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários atualizam próprio profile"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "Inserir próprio profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- ============ ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin')
$$;

CREATE POLICY "Ver próprias roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "Admin gerencia roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ TRIGGER: criar profile + role admin para primeiro user ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'garcom');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ CATEGORIAS ============
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  setor setor NOT NULL DEFAULT 'cozinha',
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias TO authenticated;
GRANT ALL ON public.categorias TO service_role;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos autenticados leem categorias" ON public.categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia categorias" ON public.categorias FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ PRODUTOS ============
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  imagem_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER produtos_touch BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos autenticados leem produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia produtos" ON public.produtos FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ============ MESAS ============
CREATE TABLE public.mesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL UNIQUE,
  lugares INT NOT NULL DEFAULT 4,
  setor TEXT,
  status mesa_status NOT NULL DEFAULT 'livre',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER mesas_touch BEFORE UPDATE ON public.mesas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesas TO authenticated;
GRANT ALL ON public.mesas TO service_role;
ALTER TABLE public.mesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem mesas" ON public.mesas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Garçom/admin atualiza mesa" ON public.mesas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()));
CREATE POLICY "Admin gerencia mesas" ON public.mesas FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admin deleta mesas" ON public.mesas FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============ COMANDAS ============
CREATE TABLE public.comandas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mesa_id UUID NOT NULL REFERENCES public.mesas(id) ON DELETE RESTRICT,
  garcom_id UUID NOT NULL REFERENCES auth.users(id),
  status comanda_status NOT NULL DEFAULT 'aberta',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  observacao TEXT,
  aberta_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  fechada_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER comandas_touch BEFORE UPDATE ON public.comandas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_comandas_mesa_status ON public.comandas(mesa_id, status);
GRANT SELECT, INSERT, UPDATE ON public.comandas TO authenticated;
GRANT ALL ON public.comandas TO service_role;
ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem comandas" ON public.comandas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Garçom/admin/caixa cria comanda" ON public.comandas FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()));
CREATE POLICY "Garçom/admin/caixa atualiza comanda" ON public.comandas FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'caixa'));

-- ============ PEDIDOS ============
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  setor setor NOT NULL DEFAULT 'cozinha',
  status pedido_status NOT NULL DEFAULT 'pendente',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER pedidos_touch BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_pedidos_status ON public.pedidos(status);
CREATE INDEX idx_pedidos_setor ON public.pedidos(setor, status);
GRANT SELECT, INSERT, UPDATE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem pedidos" ON public.pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Garçom/admin cria pedido" ON public.pedidos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()));
CREATE POLICY "Cozinha/garçom/admin atualiza pedido" ON public.pedidos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'cozinha') OR public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()));

-- ============ ITENS PEDIDO ============
CREATE TABLE public.itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  produto_nome TEXT NOT NULL,
  preco_unit NUMERIC(10,2) NOT NULL,
  quantidade INT NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  observacao TEXT,
  subtotal NUMERIC(10,2) GENERATED ALWAYS AS (preco_unit * quantidade) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_itens_pedido ON public.itens_pedido(pedido_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_pedido TO authenticated;
GRANT ALL ON public.itens_pedido TO service_role;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem itens" ON public.itens_pedido FOR SELECT TO authenticated USING (true);
CREATE POLICY "Garçom/admin gerencia itens" ON public.itens_pedido FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'garcom') OR public.is_admin(auth.uid()));

-- ============ PAGAMENTOS ============
CREATE TABLE public.pagamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id UUID NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  forma forma_pagamento NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  cliente_nome TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.pagamentos TO authenticated;
GRANT ALL ON public.pagamentos TO service_role;
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem pagamentos" ON public.pagamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Caixa/admin registra pagamento" ON public.pagamentos FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'caixa') OR public.is_admin(auth.uid()) OR public.has_role(auth.uid(), 'garcom'));
CREATE POLICY "Admin remove pagamento" ON public.pagamentos FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============ TRIGGER: atualizar total da comanda ============
CREATE OR REPLACE FUNCTION public.recalcular_total_comanda()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE c_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN c_id := OLD.comanda_id; ELSE c_id := NEW.comanda_id; END IF;
  UPDATE public.comandas SET total = COALESCE((
    SELECT SUM(p.total) FROM public.pedidos p
    WHERE p.comanda_id = c_id AND p.status <> 'cancelado'
  ), 0) WHERE id = c_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER pedidos_recalc AFTER INSERT OR UPDATE OR DELETE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_comanda();

CREATE OR REPLACE FUNCTION public.recalcular_total_pedido()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE p_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN p_id := OLD.pedido_id; ELSE p_id := NEW.pedido_id; END IF;
  UPDATE public.pedidos SET total = COALESCE((
    SELECT SUM(subtotal) FROM public.itens_pedido WHERE pedido_id = p_id
  ), 0) WHERE id = p_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER itens_recalc AFTER INSERT OR UPDATE OR DELETE ON public.itens_pedido
  FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_pedido();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_pedido;
ALTER TABLE public.mesas REPLICA IDENTITY FULL;
ALTER TABLE public.comandas REPLICA IDENTITY FULL;
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.itens_pedido REPLICA IDENTITY FULL;

-- ============ SEED ============
INSERT INTO public.categorias (nome, setor, ordem) VALUES
  ('Bebidas', 'bar', 1),
  ('Porções', 'cozinha', 2),
  ('Pratos', 'cozinha', 3),
  ('Sobremesas', 'sobremesas', 4);

INSERT INTO public.mesas (numero, lugares, setor) VALUES
  (1,4,'Salão'),(2,4,'Salão'),(3,2,'Salão'),(4,6,'Salão'),
  (5,4,'Varanda'),(6,4,'Varanda'),(7,8,'Reservado'),(8,2,'Balcão');
