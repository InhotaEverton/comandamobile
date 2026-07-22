CREATE OR REPLACE FUNCTION public.regenerar_pool_comandas(_qtd integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid := public.minha_empresa_id();
  v_removidas int := 0;
  v_total int;
  i int;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada para o usuário';
  END IF;
  IF _qtd IS NULL OR _qtd < 1 OR _qtd > 999 THEN
    RAISE EXCEPTION 'Quantidade fora do intervalo permitido (1-999)';
  END IF;

  FOR i IN 1.._qtd LOOP
    INSERT INTO public.mesas (numero, lugares, setor, status, empresa_id)
    VALUES (i, 1, 'comanda', 'livre', v_empresa)
    ON CONFLICT (empresa_id, numero) DO NOTHING;
  END LOOP;

  WITH del AS (
    DELETE FROM public.mesas m
     WHERE m.empresa_id = v_empresa
       AND m.numero > _qtd
       AND NOT EXISTS (SELECT 1 FROM public.comandas c WHERE c.mesa_id = m.id)
    RETURNING 1
  )
  SELECT count(*) INTO v_removidas FROM del;

  SELECT count(*) INTO v_total FROM public.mesas WHERE empresa_id = v_empresa;

  RETURN jsonb_build_object('total', v_total, 'removidas', v_removidas, 'solicitado', _qtd);
END;
$function$;