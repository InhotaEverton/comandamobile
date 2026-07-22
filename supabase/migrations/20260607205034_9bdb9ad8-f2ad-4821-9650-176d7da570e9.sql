
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS modo_operacao text NOT NULL DEFAULT 'mesas',
  ADD COLUMN IF NOT EXISTS impressao_auto boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS qz_host text NOT NULL DEFAULT 'localhost';

ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_modo_operacao_check
  CHECK (modo_operacao IN ('mesas','comandas','ambos'));

ALTER TABLE public.comandas ALTER COLUMN mesa_id DROP NOT NULL;
