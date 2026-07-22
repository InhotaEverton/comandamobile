CREATE OR REPLACE FUNCTION public.validar_pin_hoje(_pin text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_empresa uuid := public.minha_empresa_id();
  v_now timestamptz := now() AT TIME ZONE 'America/Sao_Paulo';
  v_cfg record;
  v_dia text;
  v_dia_cfg jsonb;
  v_abre time;
  v_fecha time;
  v_hora time;
  v_ok boolean;
BEGIN
  IF v_empresa IS NULL THEN
    RETURN false;
  END IF;

  SELECT horario_ativo, horarios
    INTO v_cfg
    FROM public.configuracoes
   WHERE empresa_id = v_empresa
   LIMIT 1;

  IF COALESCE(v_cfg.horario_ativo, false) THEN
    v_dia := CASE extract(dow FROM v_now)::int
               WHEN 0 THEN 'dom' WHEN 1 THEN 'seg' WHEN 2 THEN 'ter'
               WHEN 3 THEN 'qua' WHEN 4 THEN 'qui' WHEN 5 THEN 'sex'
               WHEN 6 THEN 'sab' END;
    v_dia_cfg := v_cfg.horarios -> v_dia;
    IF v_dia_cfg IS NULL OR NOT COALESCE((v_dia_cfg->>'aberto')::boolean, false) THEN
      RETURN false;
    END IF;
    v_abre := (v_dia_cfg->>'abre')::time;
    v_fecha := (v_dia_cfg->>'fecha')::time;
    v_hora := v_now::time;
    IF v_fecha > v_abre THEN
      IF v_hora < v_abre OR v_hora > v_fecha THEN
        RETURN false;
      END IF;
    ELSE
      -- virada de dia (ex.: 18:00 -> 02:00)
      IF v_hora < v_abre AND v_hora > v_fecha THEN
        RETURN false;
      END IF;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pin_diario
    WHERE empresa_id = v_empresa
      AND data = v_now::date
      AND pin = _pin
  ) INTO v_ok;

  RETURN v_ok;
END;
$function$;