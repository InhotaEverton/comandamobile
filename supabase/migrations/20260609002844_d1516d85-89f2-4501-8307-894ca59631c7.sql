
-- Helper inline expressions reuse has_role / is_admin

-- =========================
-- CAIXAS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem caixas" ON public.caixas;
CREATE POLICY "Caixa/admin leem caixas"
  ON public.caixas FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caixa') OR is_admin(auth.uid()));

-- =========================
-- MOVIMENTACOES DE CAIXA
-- =========================
DROP POLICY IF EXISTS "Autenticados leem movimentacoes" ON public.movimentacoes_caixa;
CREATE POLICY "Caixa/admin leem movimentacoes"
  ON public.movimentacoes_caixa FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'caixa') OR is_admin(auth.uid()));

-- =========================
-- PAGAMENTOS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem pagamentos" ON public.pagamentos;
CREATE POLICY "Equipe financeira lê pagamentos"
  ON public.pagamentos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'caixa')
    OR has_role(auth.uid(),'garcom')
    OR is_admin(auth.uid())
  );

-- =========================
-- COMANDA HISTORICO
-- =========================
DROP POLICY IF EXISTS "Autenticados leem historico" ON public.comanda_historico;
CREATE POLICY "Equipe operacional lê historico"
  ON public.comanda_historico FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Usuário registra historico em próprio nome" ON public.comanda_historico;
CREATE POLICY "Equipe registra historico em próprio nome"
  ON public.comanda_historico FOR INSERT TO authenticated
  WITH CHECK (
    usuario_id = auth.uid()
    AND (
      has_role(auth.uid(),'garcom')
      OR has_role(auth.uid(),'cozinha')
      OR has_role(auth.uid(),'caixa')
      OR is_admin(auth.uid())
    )
  );

-- =========================
-- COMANDAS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem comandas" ON public.comandas;
CREATE POLICY "Equipe operacional lê comandas"
  ON public.comandas FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- Permitir caixa também criar/encerrar comandas (já existia update p/ caixa)
DROP POLICY IF EXISTS "Garçom/admin/caixa cria comanda" ON public.comandas;
DROP POLICY IF EXISTS "Garçom/admin/caixa cria comanda " ON public.comandas;
DROP POLICY IF EXISTS "Garçom/admin/caixa cria comanda" ON public.comandas;
CREATE POLICY "Garçom/caixa/admin cria comanda"
  ON public.comandas FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- =========================
-- PEDIDOS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem pedidos" ON public.pedidos;
CREATE POLICY "Equipe operacional lê pedidos"
  ON public.pedidos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- =========================
-- ITENS DE PEDIDO
-- =========================
DROP POLICY IF EXISTS "Autenticados leem itens" ON public.itens_pedido;
CREATE POLICY "Equipe operacional lê itens"
  ON public.itens_pedido FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- Cozinha pode atualizar status do item (pronto/entregue)
CREATE POLICY "Cozinha atualiza status item"
  ON public.itens_pedido FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'cozinha'))
  WITH CHECK (has_role(auth.uid(),'cozinha'));

-- =========================
-- MESAS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem mesas" ON public.mesas;
CREATE POLICY "Equipe operacional lê mesas"
  ON public.mesas FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- Permitir caixa atualizar mesa também
DROP POLICY IF EXISTS "Garçom/admin atualiza mesa" ON public.mesas;
CREATE POLICY "Garçom/caixa/admin atualiza mesa"
  ON public.mesas FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- =========================
-- PRODUTOS / CATEGORIAS
-- =========================
DROP POLICY IF EXISTS "Todos autenticados leem produtos" ON public.produtos;
CREATE POLICY "Equipe operacional lê produtos"
  ON public.produtos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "Todos autenticados leem categorias" ON public.categorias;
CREATE POLICY "Equipe operacional lê categorias"
  ON public.categorias FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'garcom')
    OR has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- =========================
-- PRINT JOB LOGS
-- =========================
DROP POLICY IF EXISTS "Autenticados leem logs de impressao" ON public.print_job_logs;
CREATE POLICY "Equipe de produção lê logs de impressao"
  ON public.print_job_logs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'cozinha')
    OR has_role(auth.uid(),'caixa')
    OR is_admin(auth.uid())
  );

-- =========================
-- PIN DIARIO — caixa também precisa validar
-- =========================
DROP POLICY IF EXISTS "Admin lê pin" ON public.pin_diario;
CREATE POLICY "Admin/caixa leem pin"
  ON public.pin_diario FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(),'caixa'));
