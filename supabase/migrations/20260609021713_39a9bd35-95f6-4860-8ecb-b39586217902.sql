CREATE OR REPLACE FUNCTION public.validar_pin_hoje(_pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.pin_diario
    WHERE data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND pin = _pin
  )
$function$;