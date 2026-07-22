
-- =====================================================================
-- 1) TABELA EMPRESAS
-- =====================================================================
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_fantasia text,
  razao_social text,
  cnpj text,
  inscricao_estadual text,
  endereco_cep text,
  endereco_logradouro text,
  endereco_numero text,
  endereco_complemento text,
  endereco_bairro text,
  endereco_cidade text,
  endereco_estado text,
  onboarding_completo boolean NOT NULL DEFAULT false,
  onboarding_etapa integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER empresas_touch_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =====================================================================
-- 2) EMPRESA PADRÃO + ADD empresa_id (nullable) + BACKFILL
-- =====================================================================
DO $$
DECLARE
  v_default_id uuid;
BEGIN
  INSERT INTO public.empresas (nome, onboarding_completo, onboarding_etapa)
  VALUES ('Empresa Principal', true, 5)
  RETURNING id INTO v_default_id;

  PERFORM set_config('app.default_empresa', v_default_id::text, false);
END $$;

-- helper para o backfill
CREATE OR REPLACE FUNCTION pg_temp.default_empresa() RETURNS uuid LANGUAGE sql AS $$
  SELECT id FROM public.empresas ORDER BY created_at LIMIT 1;
$$;

-- Add empresa_id to all data tables
ALTER TABLE public.profiles               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.user_roles             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.produtos               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.categorias             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.mesas                  ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.comandas               ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pedidos                ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.itens_pedido           ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pagamentos             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.caixas                 ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.movimentacoes_caixa    ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.configuracoes          ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.pin_diario             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.print_jobs             ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.print_job_logs         ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.print_agent_heartbeats ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.comanda_historico      ADD COLUMN empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Backfill all rows
UPDATE public.profiles               SET empresa_id = pg_temp.default_empresa();
UPDATE public.user_roles             SET empresa_id = pg_temp.default_empresa();
UPDATE public.produtos               SET empresa_id = pg_temp.default_empresa();
UPDATE public.categorias             SET empresa_id = pg_temp.default_empresa();
UPDATE public.mesas                  SET empresa_id = pg_temp.default_empresa();
UPDATE public.comandas               SET empresa_id = pg_temp.default_empresa();
UPDATE public.pedidos                SET empresa_id = pg_temp.default_empresa();
UPDATE public.itens_pedido           SET empresa_id = pg_temp.default_empresa();
UPDATE public.pagamentos             SET empresa_id = pg_temp.default_empresa();
UPDATE public.caixas                 SET empresa_id = pg_temp.default_empresa();
UPDATE public.movimentacoes_caixa    SET empresa_id = pg_temp.default_empresa();
UPDATE public.configuracoes          SET empresa_id = pg_temp.default_empresa();
UPDATE public.pin_diario             SET empresa_id = pg_temp.default_empresa();
UPDATE public.print_jobs             SET empresa_id = pg_temp.default_empresa();
UPDATE public.print_job_logs         SET empresa_id = pg_temp.default_empresa();
UPDATE public.print_agent_heartbeats SET empresa_id = pg_temp.default_empresa();
UPDATE public.comanda_historico      SET empresa_id = pg_temp.default_empresa();

-- Mark configuracoes of default empresa as onboarded
-- (handled by empresas insert above)

-- NOT NULL on every empresa_id
ALTER TABLE public.profiles               ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.user_roles             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.produtos               ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.categorias             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.mesas                  ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.comandas               ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pedidos                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.itens_pedido           ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pagamentos             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.caixas                 ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.movimentacoes_caixa    ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.configuracoes          ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.pin_diario             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.print_jobs             ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.print_job_logs         ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.print_agent_heartbeats ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.comanda_historico      ALTER COLUMN empresa_id SET NOT NULL;

-- Indexes for performance
CREATE INDEX idx_profiles_empresa               ON public.profiles(empresa_id);
CREATE INDEX idx_user_roles_empresa             ON public.user_roles(empresa_id);
CREATE INDEX idx_produtos_empresa               ON public.produtos(empresa_id);
CREATE INDEX idx_categorias_empresa             ON public.categorias(empresa_id);
CREATE INDEX idx_mesas_empresa                  ON public.mesas(empresa_id);
CREATE INDEX idx_comandas_empresa               ON public.comandas(empresa_id);
CREATE INDEX idx_pedidos_empresa                ON public.pedidos(empresa_id);
CREATE INDEX idx_itens_pedido_empresa           ON public.itens_pedido(empresa_id);
CREATE INDEX idx_pagamentos_empresa             ON public.pagamentos(empresa_id);
CREATE INDEX idx_caixas_empresa                 ON public.caixas(empresa_id);
CREATE INDEX idx_movimentacoes_caixa_empresa    ON public.movimentacoes_caixa(empresa_id);
CREATE INDEX idx_configuracoes_empresa          ON public.configuracoes(empresa_id);
CREATE INDEX idx_pin_diario_empresa             ON public.pin_diario(empresa_id);
CREATE INDEX idx_print_jobs_empresa             ON public.print_jobs(empresa_id);
CREATE INDEX idx_print_job_logs_empresa         ON public.print_job_logs(empresa_id);
CREATE INDEX idx_print_agent_heartbeats_empresa ON public.print_agent_heartbeats(empresa_id);
CREATE INDEX idx_comanda_historico_empresa      ON public.comanda_historico(empresa_id);

-- configuracoes: drop singleton, add unique(empresa_id)
ALTER TABLE public.configuracoes DROP CONSTRAINT IF EXISTS configuracoes_singleton_key;
ALTER TABLE public.configuracoes ADD CONSTRAINT configuracoes_empresa_unique UNIQUE (empresa_id);

-- =====================================================================
-- 3) TENANT HELPER FUNCTION
-- =====================================================================
CREATE OR REPLACE FUNCTION public.get_empresa_id_do_usuario(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.minha_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- =====================================================================
-- 4) DROP ALL EXISTING RLS POLICIES (we'll re-create with empresa filter)
-- =====================================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('caixas','categorias','comanda_historico','comandas','configuracoes',
                        'itens_pedido','mesas','movimentacoes_caixa','pagamentos','pedidos',
                        'pin_diario','print_agent_heartbeats','print_job_logs','print_jobs',
                        'produtos','profiles','user_roles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- =====================================================================
-- 5) NEW POLICIES — all scoped by empresa_id = minha_empresa_id()
-- =====================================================================

-- PROFILES: user reads own profile + profiles of same empresa
CREATE POLICY "profiles_select_same_empresa" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR empresa_id = public.minha_empresa_id());
CREATE POLICY "profiles_update_self_or_admin" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid())))
  WITH CHECK (id = auth.uid() OR (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid())));
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- USER_ROLES
CREATE POLICY "user_roles_select_same_empresa" ON public.user_roles FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- EMPRESAS
CREATE POLICY "empresas_select_own" ON public.empresas FOR SELECT TO authenticated
  USING (id = public.minha_empresa_id());
CREATE POLICY "empresas_update_admin" ON public.empresas FOR UPDATE TO authenticated
  USING (id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- PRODUTOS
CREATE POLICY "produtos_select" ON public.produtos FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "produtos_admin_manage" ON public.produtos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- CATEGORIAS
CREATE POLICY "categorias_select" ON public.categorias FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "categorias_admin_manage" ON public.categorias FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- MESAS
CREATE POLICY "mesas_select" ON public.mesas FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "mesas_insert" ON public.mesas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.is_admin(auth.uid())));
CREATE POLICY "mesas_update" ON public.mesas FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "mesas_delete" ON public.mesas FOR DELETE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- COMANDAS
CREATE POLICY "comandas_select" ON public.comandas FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "comandas_insert" ON public.comandas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())));
CREATE POLICY "comandas_update" ON public.comandas FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- PEDIDOS
CREATE POLICY "pedidos_select" ON public.pedidos FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "pedidos_manage" ON public.pedidos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.has_role(auth.uid(),'cozinha') OR public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- ITENS_PEDIDO
CREATE POLICY "itens_pedido_select" ON public.itens_pedido FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "itens_pedido_manage" ON public.itens_pedido FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'garcom') OR public.has_role(auth.uid(),'cozinha') OR public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- PAGAMENTOS
CREATE POLICY "pagamentos_select" ON public.pagamentos FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "pagamentos_manage" ON public.pagamentos FOR ALL TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- CAIXAS
CREATE POLICY "caixas_select" ON public.caixas FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())));
CREATE POLICY "caixas_insert" ON public.caixas FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())));
CREATE POLICY "caixas_update" ON public.caixas FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- MOVIMENTACOES_CAIXA
CREATE POLICY "movcaixa_select" ON public.movimentacoes_caixa FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())));
CREATE POLICY "movcaixa_insert" ON public.movimentacoes_caixa FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND (public.has_role(auth.uid(),'caixa') OR public.is_admin(auth.uid())));

-- CONFIGURACOES
CREATE POLICY "configuracoes_select" ON public.configuracoes FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "configuracoes_insert" ON public.configuracoes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));
CREATE POLICY "configuracoes_update" ON public.configuracoes FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- PIN_DIARIO
CREATE POLICY "pin_diario_select" ON public.pin_diario FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "pin_diario_insert" ON public.pin_diario FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));
CREATE POLICY "pin_diario_update" ON public.pin_diario FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()))
  WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "pin_diario_delete" ON public.pin_diario FOR DELETE TO authenticated
  USING (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- PRINT_JOBS
CREATE POLICY "print_jobs_select" ON public.print_jobs FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_jobs_insert" ON public.print_jobs FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_jobs_update" ON public.print_jobs FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id())
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- PRINT_JOB_LOGS
CREATE POLICY "print_job_logs_select" ON public.print_job_logs FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_job_logs_insert" ON public.print_job_logs FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id());

-- PRINT_AGENT_HEARTBEATS
CREATE POLICY "print_hb_select" ON public.print_agent_heartbeats FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_hb_insert" ON public.print_agent_heartbeats FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_hb_update" ON public.print_agent_heartbeats FOR UPDATE TO authenticated
  USING (empresa_id = public.minha_empresa_id())
  WITH CHECK (empresa_id = public.minha_empresa_id());
CREATE POLICY "print_hb_delete" ON public.print_agent_heartbeats FOR DELETE TO authenticated
  USING (empresa_id = public.minha_empresa_id());

-- COMANDA_HISTORICO
CREATE POLICY "comanda_historico_select" ON public.comanda_historico FOR SELECT TO authenticated
  USING (empresa_id = public.minha_empresa_id());
CREATE POLICY "comanda_historico_insert" ON public.comanda_historico FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.minha_empresa_id() AND usuario_id = auth.uid());

-- =====================================================================
-- 6) handle_new_user: cria empresa + admin + configuracoes default
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_empresa text;
  v_nome_responsavel text;
  v_empresa_id uuid;
BEGIN
  v_nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'nome_empresa'), ''), 'Minha Empresa');
  v_nome_responsavel := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'nome'), ''),
    split_part(NEW.email, '@', 1)
  );

  -- Cria empresa nova para este usuário
  INSERT INTO public.empresas (nome, onboarding_completo, onboarding_etapa)
  VALUES (v_nome_empresa, false, 1)
  RETURNING id INTO v_empresa_id;

  -- Profile
  INSERT INTO public.profiles (id, nome, empresa_id)
  VALUES (NEW.id, v_nome_responsavel, v_empresa_id);

  -- Sempre admin (multi-tenant: cada signup é dono da própria empresa)
  INSERT INTO public.user_roles (user_id, role, empresa_id)
  VALUES (NEW.id, 'admin', v_empresa_id);

  -- Configurações padrão
  INSERT INTO public.configuracoes (
    empresa_id, modo_operacao, impressao_auto, qz_host,
    taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
    couvert_ativo, couvert_valor, horario_ativo, horarios,
    pin_diario_ativo, qtd_comandas, tipo_numeracao
  ) VALUES (
    v_empresa_id, 'ambos', false, 'localhost',
    false, 10, false,
    false, 0, false, '[]'::jsonb,
    false, 50, 'continua'
  );

  RETURN NEW;
END;
$$;

-- =====================================================================
-- 7) Revoke anon access to public functions that leak
-- =====================================================================
REVOKE EXECUTE ON FUNCTION public.minha_empresa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.minha_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_empresa_id_do_usuario(uuid) TO authenticated;
