CREATE OR REPLACE FUNCTION public.enqueue_print_job(_pedido_id uuid, _comanda_id uuid, _setor setor, _payload jsonb, _origem text DEFAULT 'auto'::text, _affects_pedido_status boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id uuid;
  v_user_id uuid := auth.uid();
  v_pedido_ids uuid[];
  v_cliente text;
  v_comanda text;
  v_via text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'garcom')
    OR public.has_role(v_user_id, 'cozinha')
    OR public.has_role(v_user_id, 'caixa')
    OR public.is_admin(v_user_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_pedido_ids := ARRAY(
    SELECT value::uuid
    FROM jsonb_array_elements_text(COALESCE(_payload->'pedidoIds', jsonb_build_array(_pedido_id::text))) AS value
  );
  v_cliente := NULLIF(btrim(COALESCE(_payload->>'cliente', '')), '');
  v_comanda := NULLIF(btrim(COALESCE(_payload->>'comandaNumero', '')), '');
  v_via := NULLIF(btrim(COALESCE(_payload->>'via', '')), '');

  INSERT INTO public.print_jobs (
    pedido_id,
    comanda_id,
    setor,
    origem,
    affects_pedido_status,
    payload,
    status,
    created_by
  ) VALUES (
    _pedido_id,
    _comanda_id,
    _setor,
    COALESCE(NULLIF(_origem, ''), 'auto'),
    _affects_pedido_status,
    _payload,
    'pendente_impressao',
    v_user_id
  )
  RETURNING id INTO v_job_id;

  IF _affects_pedido_status THEN
    UPDATE public.pedidos
    SET print_status = 'pendente_impressao',
        impresso_em = NULL,
        ultima_impressao_erro = NULL,
        updated_at = now()
    WHERE id = ANY(v_pedido_ids);
  END IF;

  INSERT INTO public.print_job_logs (
    print_job_id,
    pedido_id,
    status,
    message,
    detalhes,
    station
  ) VALUES (
    v_job_id,
    _pedido_id,
    'pendente_impressao',
    CASE
      WHEN COALESCE(NULLIF(_origem, ''), 'auto') = 'manual' THEN 'Pedido reenviado para a fila central de impressão'
      WHEN COALESCE(NULLIF(_origem, ''), 'auto') = 'item' THEN 'Item enviado para a fila central de impressão'
      WHEN coalesce(array_length(v_pedido_ids, 1), 0) > 1 THEN 'Envio consolidado para a fila central de impressão'
      ELSE 'Pedido enviado para a fila central de impressão'
    END,
    jsonb_build_object(
      'origem', COALESCE(NULLIF(_origem, ''), 'auto'),
      'pedido_ids', to_jsonb(v_pedido_ids),
      'cliente', v_cliente,
      'comanda', v_comanda,
      'via', v_via
    ),
    'app'
  );

  RETURN v_job_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_next_print_job(_claimed_by text DEFAULT NULL::text)
 RETURNS SETOF print_jobs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.print_jobs%ROWTYPE;
  v_station text := COALESCE(NULLIF(_claimed_by, ''), 'estacao-central');
  v_user_id uuid := auth.uid();
  v_pedido_ids uuid[];
  v_cliente text;
  v_comanda text;
  v_via text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'cozinha')
    OR public.has_role(v_user_id, 'caixa')
    OR public.is_admin(v_user_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH next_job AS (
    SELECT j.id
    FROM public.print_jobs j
    WHERE j.status = 'pendente_impressao'
    ORDER BY j.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.print_jobs j
  SET status = 'imprimindo',
      attempts = j.attempts + 1,
      claimed_by = v_station,
      claimed_at = now(),
      updated_at = now()
  FROM next_job
  WHERE j.id = next_job.id
  RETURNING j.* INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  v_pedido_ids := ARRAY(
    SELECT value::uuid
    FROM jsonb_array_elements_text(COALESCE(v_job.payload->'pedidoIds', jsonb_build_array(v_job.pedido_id::text))) AS value
  );
  v_cliente := NULLIF(btrim(COALESCE(v_job.payload->>'cliente', '')), '');
  v_comanda := NULLIF(btrim(COALESCE(v_job.payload->>'comandaNumero', '')), '');
  v_via := NULLIF(btrim(COALESCE(v_job.payload->>'via', '')), '');

  IF v_job.affects_pedido_status THEN
    UPDATE public.pedidos
    SET print_status = 'imprimindo',
        ultima_impressao_erro = NULL,
        updated_at = now()
    WHERE id = ANY(v_pedido_ids);
  END IF;

  INSERT INTO public.print_job_logs (
    print_job_id,
    pedido_id,
    status,
    message,
    detalhes,
    station
  ) VALUES (
    v_job.id,
    v_job.pedido_id,
    'imprimindo',
    'Estação central iniciou a impressão',
    jsonb_build_object(
      'attempts', v_job.attempts,
      'origem', v_job.origem,
      'pedido_ids', to_jsonb(v_pedido_ids),
      'cliente', v_cliente,
      'comanda', v_comanda,
      'via', v_via
    ),
    v_station
  );

  RETURN NEXT v_job;
END;
$function$;

CREATE OR REPLACE FUNCTION public.finish_print_job(_job_id uuid, _success boolean, _message text DEFAULT NULL::text, _details jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job public.print_jobs%ROWTYPE;
  v_user_id uuid := auth.uid();
  v_pedido_ids uuid[];
  v_cliente text;
  v_comanda text;
  v_via text;
  v_log_details jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT (
    public.has_role(v_user_id, 'cozinha')
    OR public.has_role(v_user_id, 'caixa')
    OR public.is_admin(v_user_id)
  ) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT * INTO v_job
  FROM public.print_jobs
  WHERE id = _job_id;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Print job not found';
  END IF;

  v_pedido_ids := ARRAY(
    SELECT value::uuid
    FROM jsonb_array_elements_text(COALESCE(v_job.payload->'pedidoIds', jsonb_build_array(v_job.pedido_id::text))) AS value
  );
  v_cliente := NULLIF(btrim(COALESCE(v_job.payload->>'cliente', '')), '');
  v_comanda := NULLIF(btrim(COALESCE(v_job.payload->>'comandaNumero', '')), '');
  v_via := NULLIF(btrim(COALESCE(v_job.payload->>'via', '')), '');
  v_log_details := COALESCE(_details, '{}'::jsonb) || jsonb_build_object(
    'pedido_ids', to_jsonb(v_pedido_ids),
    'cliente', v_cliente,
    'comanda', v_comanda,
    'via', v_via
  );

  IF _success THEN
    UPDATE public.print_jobs
    SET status = 'impresso',
        impresso_em = now(),
        last_error = NULL,
        updated_at = now()
    WHERE id = _job_id;

    IF v_job.affects_pedido_status THEN
      UPDATE public.pedidos
      SET print_status = 'impresso',
          impresso_em = now(),
          ultima_impressao_erro = NULL,
          updated_at = now()
      WHERE id = ANY(v_pedido_ids);
    END IF;

    INSERT INTO public.print_job_logs (
      print_job_id,
      pedido_id,
      status,
      message,
      detalhes,
      station
    ) VALUES (
      v_job.id,
      v_job.pedido_id,
      'impresso',
      COALESCE(NULLIF(_message, ''), 'Pedido impresso pela estação central'),
      v_log_details,
      v_job.claimed_by
    );
  ELSE
    UPDATE public.print_jobs
    SET status = 'erro_impressao',
        last_error = COALESCE(NULLIF(_message, ''), 'Falha ao imprimir'),
        updated_at = now()
    WHERE id = _job_id;

    IF v_job.affects_pedido_status THEN
      UPDATE public.pedidos
      SET print_status = 'erro_impressao',
          ultima_impressao_erro = COALESCE(NULLIF(_message, ''), 'Falha ao imprimir'),
          updated_at = now()
      WHERE id = ANY(v_pedido_ids);
    END IF;

    INSERT INTO public.print_job_logs (
      print_job_id,
      pedido_id,
      status,
      message,
      detalhes,
      station
    ) VALUES (
      v_job.id,
      v_job.pedido_id,
      'erro_impressao',
      COALESCE(NULLIF(_message, ''), 'Falha ao imprimir'),
      v_log_details,
      v_job.claimed_by
    );
  END IF;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'configuracoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.configuracoes;
  END IF;
END $$;