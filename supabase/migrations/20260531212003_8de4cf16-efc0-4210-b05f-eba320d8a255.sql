
-- 1. produtos.exige_preparo
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS exige_preparo boolean NOT NULL DEFAULT true;

-- 2. comandas: campos de fechamento
ALTER TABLE public.comandas
  ADD COLUMN IF NOT EXISTS taxa_servico numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS couvert_valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS couvert_pessoas integer NOT NULL DEFAULT 0;

-- 3. configuracoes (singleton)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  taxa_garcom_ativa boolean NOT NULL DEFAULT false,
  taxa_garcom_percentual numeric NOT NULL DEFAULT 10,
  taxa_garcom_auto boolean NOT NULL DEFAULT true,
  couvert_ativo boolean NOT NULL DEFAULT false,
  couvert_valor numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.configuracoes TO authenticated;
GRANT INSERT, UPDATE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;

ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem configuracoes"
  ON public.configuracoes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin altera configuracoes"
  ON public.configuracoes FOR UPDATE TO authenticated
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admin insere configuracoes"
  ON public.configuracoes FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Linha singleton inicial
INSERT INTO public.configuracoes (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;
