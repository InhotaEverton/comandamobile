
ALTER TABLE public.grupos_adicionais
  ADD COLUMN IF NOT EXISTS tipo_selecao text NOT NULL DEFAULT 'unica',
  ADD COLUMN IF NOT EXISTS min_selecao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_selecao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_ilimitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS obrigatorio boolean NOT NULL DEFAULT false;

ALTER TABLE public.grupos_adicionais
  DROP CONSTRAINT IF EXISTS grupos_adicionais_tipo_selecao_chk;
ALTER TABLE public.grupos_adicionais
  ADD CONSTRAINT grupos_adicionais_tipo_selecao_chk
  CHECK (tipo_selecao IN ('unica','multipla','quantidade'));
