
DROP POLICY IF EXISTS "Autenticados leem pin" ON public.pin_diario;

CREATE POLICY "Admin lê pin" ON public.pin_diario
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.validar_pin_hoje(_pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pin_diario
    WHERE data = (now() AT TIME ZONE 'UTC')::date
      AND pin = _pin
  )
$$;

REVOKE ALL ON FUNCTION public.validar_pin_hoje(text) FROM public;
GRANT EXECUTE ON FUNCTION public.validar_pin_hoje(text) TO authenticated;
