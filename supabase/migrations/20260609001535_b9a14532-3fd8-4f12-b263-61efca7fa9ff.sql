DROP FUNCTION IF EXISTS public.get_configuracoes_completo();

CREATE OR REPLACE FUNCTION public.get_configuracoes_completo()
RETURNS SETOF public.configuracoes
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'caixa')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY SELECT * FROM public.configuracoes LIMIT 1;
END;
$function$;