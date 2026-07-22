
-- Add horário & PIN settings to configuracoes
ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS horario_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horarios jsonb NOT NULL DEFAULT '{
    "dom":{"abre":"00:00","fecha":"00:00","aberto":false},
    "seg":{"abre":"08:00","fecha":"23:00","aberto":true},
    "ter":{"abre":"08:00","fecha":"23:00","aberto":true},
    "qua":{"abre":"08:00","fecha":"23:00","aberto":true},
    "qui":{"abre":"08:00","fecha":"23:00","aberto":true},
    "sex":{"abre":"08:00","fecha":"23:59","aberto":true},
    "sab":{"abre":"08:00","fecha":"23:59","aberto":true}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS pin_diario_ativo boolean NOT NULL DEFAULT false;

-- PIN diário table
CREATE TABLE IF NOT EXISTS public.pin_diario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL UNIQUE,
  pin text NOT NULL,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pin_diario TO authenticated;
GRANT ALL ON public.pin_diario TO service_role;

ALTER TABLE public.pin_diario ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem pin" ON public.pin_diario;
CREATE POLICY "Autenticados leem pin" ON public.pin_diario
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gerencia pin insert" ON public.pin_diario;
CREATE POLICY "Admin gerencia pin insert" ON public.pin_diario
  FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia pin update" ON public.pin_diario;
CREATE POLICY "Admin gerencia pin update" ON public.pin_diario
  FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin gerencia pin delete" ON public.pin_diario;
CREATE POLICY "Admin gerencia pin delete" ON public.pin_diario
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

DROP TRIGGER IF EXISTS pin_diario_touch ON public.pin_diario;
CREATE TRIGGER pin_diario_touch BEFORE UPDATE ON public.pin_diario
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
