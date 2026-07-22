
ALTER TABLE public.pagamentos
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS caixa_id uuid REFERENCES public.caixas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pagamentos_caixa_id_idx ON public.pagamentos(caixa_id);
CREATE INDEX IF NOT EXISTS pagamentos_origem_idx ON public.pagamentos(empresa_id, origem);

CREATE OR REPLACE FUNCTION public.set_pagamento_origem_caixa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem_comanda text;
  v_tipo text;
  v_emp uuid;
BEGIN
  IF NEW.origem IS NULL OR NEW.caixa_id IS NULL THEN
    SELECT c.origem, c.tipo_entrega, c.empresa_id
      INTO v_origem_comanda, v_tipo, v_emp
      FROM public.comandas c WHERE c.id = NEW.comanda_id;

    IF NEW.empresa_id IS NULL THEN NEW.empresa_id := v_emp; END IF;

    IF NEW.origem IS NULL THEN
      NEW.origem := CASE
        WHEN v_origem_comanda = 'online' AND v_tipo = 'entrega' THEN 'delivery'
        WHEN v_origem_comanda = 'online' AND v_tipo = 'retirada' THEN 'retirada'
        WHEN v_origem_comanda = 'online' THEN 'pedido_online'
        ELSE 'comanda'
      END;
    END IF;

    IF NEW.caixa_id IS NULL AND NEW.empresa_id IS NOT NULL THEN
      SELECT id INTO NEW.caixa_id
        FROM public.caixas
       WHERE empresa_id = NEW.empresa_id AND status = 'aberto'
       ORDER BY aberto_em DESC LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_set_pagamento_origem_caixa ON public.pagamentos;
CREATE TRIGGER trg_set_pagamento_origem_caixa
  BEFORE INSERT ON public.pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_pagamento_origem_caixa();

-- Backfill: origem
UPDATE public.pagamentos p SET origem = CASE
    WHEN c.origem = 'online' AND c.tipo_entrega = 'entrega' THEN 'delivery'
    WHEN c.origem = 'online' AND c.tipo_entrega = 'retirada' THEN 'retirada'
    WHEN c.origem = 'online' THEN 'pedido_online'
    ELSE 'comanda' END
  FROM public.comandas c WHERE c.id = p.comanda_id AND p.origem IS NULL;

-- Backfill: caixa_id (pega caixa cujo intervalo abre/fecha contém created_at)
UPDATE public.pagamentos p SET caixa_id = k.id
  FROM public.caixas k
 WHERE k.empresa_id = p.empresa_id
   AND p.created_at >= k.aberto_em
   AND (k.fechado_em IS NULL OR p.created_at <= k.fechado_em)
   AND p.caixa_id IS NULL;
