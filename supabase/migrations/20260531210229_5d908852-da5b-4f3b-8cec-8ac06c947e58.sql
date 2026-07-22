
-- Itens: cancelamento lógico
ALTER TABLE public.itens_pedido
  ADD COLUMN IF NOT EXISTS cancelado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text;

-- Comandas: cancelamento e reabertura
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS reaberta_em timestamptz,
  ADD COLUMN IF NOT EXISTS reaberta_por uuid,
  ADD COLUMN IF NOT EXISTS motivo_reabertura text;

-- Recalcular total ignorando itens cancelados
CREATE OR REPLACE FUNCTION public.recalcular_total_pedido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN p_id := OLD.pedido_id; ELSE p_id := NEW.pedido_id; END IF;
  UPDATE public.pedidos SET total = COALESCE((
    SELECT SUM(subtotal) FROM public.itens_pedido
    WHERE pedido_id = p_id AND cancelado = false
  ), 0) WHERE id = p_id;
  RETURN COALESCE(NEW, OLD);
END; $$;

-- Histórico de comanda
CREATE TABLE IF NOT EXISTS public.comanda_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id uuid NOT NULL,
  usuario_id uuid,
  usuario_nome text,
  acao text NOT NULL,
  detalhes jsonb,
  valor numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historico_comanda ON public.comanda_historico (comanda_id, created_at DESC);

GRANT SELECT, INSERT ON public.comanda_historico TO authenticated;
GRANT ALL ON public.comanda_historico TO service_role;

ALTER TABLE public.comanda_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem historico"
  ON public.comanda_historico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados registram historico"
  ON public.comanda_historico FOR INSERT TO authenticated WITH CHECK (true);
