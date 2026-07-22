
-- 1. Adicionar valores aos enums
ALTER TYPE forma_pagamento ADD VALUE IF NOT EXISTS 'convenio';
ALTER TYPE mesa_status ADD VALUE IF NOT EXISTS 'fechamento_solicitado';
ALTER TYPE mesa_status ADD VALUE IF NOT EXISTS 'em_pagamento';

-- 2. Colunas extras em comandas
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS acrescimo numeric NOT NULL DEFAULT 0;

-- 3. Coluna ativo em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- 4. Tabela caixas
CREATE TABLE IF NOT EXISTS public.caixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid NOT NULL,
  valor_inicial numeric NOT NULL DEFAULT 0,
  valor_final_informado numeric,
  valor_esperado numeric,
  diferenca numeric,
  status text NOT NULL DEFAULT 'aberto', -- aberto | fechado
  aberto_em timestamptz NOT NULL DEFAULT now(),
  fechado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.caixas TO authenticated;
GRANT ALL ON public.caixas TO service_role;

ALTER TABLE public.caixas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem caixas" ON public.caixas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Caixa/admin abre caixa" ON public.caixas
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'caixa') OR is_admin(auth.uid()));
CREATE POLICY "Caixa/admin fecha caixa" ON public.caixas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'caixa') OR is_admin(auth.uid()));

-- 5. Movimentações de caixa
CREATE TABLE IF NOT EXISTS public.movimentacoes_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caixa_id uuid NOT NULL REFERENCES public.caixas(id) ON DELETE CASCADE,
  tipo text NOT NULL, -- entrada | saida | sangria | reforco
  valor numeric NOT NULL,
  descricao text,
  registrado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.movimentacoes_caixa TO authenticated;
GRANT ALL ON public.movimentacoes_caixa TO service_role;

ALTER TABLE public.movimentacoes_caixa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem movimentacoes" ON public.movimentacoes_caixa
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Caixa/admin registra movimentacao" ON public.movimentacoes_caixa
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'caixa') OR is_admin(auth.uid()));

-- 6. Realtime nas novas tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE public.caixas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.movimentacoes_caixa;

-- 7. Permitir admin deletar pedidos e itens (para cancelar de verdade já existe UPDATE status; mantém)
-- Permitir admin reabrir comanda já é coberto por UPDATE policy existente (admin via has_role/is_admin).

-- 8. Garantir realtime nas demais tabelas operacionais (idempotente)
DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='comandas';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.comandas; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pedidos';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='itens_pedido';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.itens_pedido; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='mesas';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.mesas; END IF;
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='pagamentos';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.pagamentos; END IF;
END $$;
