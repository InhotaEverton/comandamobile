-- 1) Adiciona código curto público à comanda
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS codigo text;

UPDATE public.comandas
SET codigo = upper(substring(replace(id::text, '-', '') from 1 for 5))
WHERE codigo IS NULL OR codigo = '';

CREATE UNIQUE INDEX IF NOT EXISTS comandas_codigo_key
  ON public.comandas (codigo);

ALTER TABLE public.comandas
  ALTER COLUMN codigo SET NOT NULL;

-- 2) Trigger para gerar código curto automaticamente quando ausente
CREATE OR REPLACE FUNCTION public.gen_comanda_codigo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_try text;
  v_attempt int := 0;
BEGIN
  IF NEW.codigo IS NOT NULL AND NEW.codigo <> '' THEN
    RETURN NEW;
  END IF;

  LOOP
    v_try := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 5));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.comandas WHERE codigo = v_try);
    v_attempt := v_attempt + 1;
    IF v_attempt > 8 THEN
      v_try := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
      EXIT;
    END IF;
  END LOOP;

  NEW.codigo := v_try;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS comandas_gen_codigo ON public.comandas;
CREATE TRIGGER comandas_gen_codigo
  BEFORE INSERT ON public.comandas
  FOR EACH ROW EXECUTE FUNCTION public.gen_comanda_codigo();

-- 3) Modo de operação padrão = comandas
ALTER TABLE public.configuracoes
  ALTER COLUMN modo_operacao SET DEFAULT 'comandas';

UPDATE public.configuracoes
SET modo_operacao = 'comandas'
WHERE modo_operacao <> 'comandas';