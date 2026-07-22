-- Corrige a divergência entre a configuração de delivery e o schema remoto.
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS taxa_entrega numeric(10,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.configuracoes.taxa_entrega IS
  'Taxa de entrega padrão usada quando não há um bairro com frete específico.';

NOTIFY pgrst, 'reload schema';