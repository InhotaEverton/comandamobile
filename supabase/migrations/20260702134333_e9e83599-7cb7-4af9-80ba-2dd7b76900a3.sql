
-- Token do Print Agent por empresa
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS print_agent_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS print_agent_token_created_at timestamptz;

-- Campos adicionais para heartbeat do agent nativo
ALTER TABLE public.print_agent_heartbeats
  ADD COLUMN IF NOT EXISTS agent_version text,
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Gerar / rotacionar token (admin da empresa)
CREATE OR REPLACE FUNCTION public.gerar_print_agent_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid := public.minha_empresa_id();
  v_token text;
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  v_token := 'pat_' || encode(gen_random_bytes(32), 'hex');

  UPDATE public.empresas
     SET print_agent_token = v_token,
         print_agent_token_created_at = now(),
         updated_at = now()
   WHERE id = v_empresa;

  RETURN v_token;
END;
$$;

-- Revogar token
CREATE OR REPLACE FUNCTION public.revogar_print_agent_token()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid := public.minha_empresa_id();
BEGIN
  IF v_user IS NULL OR NOT public.is_admin(v_user) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.empresas
     SET print_agent_token = NULL,
         print_agent_token_created_at = NULL,
         updated_at = now()
   WHERE id = v_empresa;
END;
$$;

-- Resolver empresa a partir do token (usado pelas rotas públicas)
CREATE OR REPLACE FUNCTION public.empresa_por_print_agent_token(_token text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.empresas
   WHERE print_agent_token = _token
   LIMIT 1;
$$;

-- Claim job (por token, sem auth.uid())
CREATE OR REPLACE FUNCTION public.claim_next_print_job_by_token(
  _token text,
  _station text DEFAULT 'print-agent',
  _agent_version text DEFAULT NULL,
  _printer text DEFAULT NULL
)
RETURNS SETOF public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_job public.print_jobs%ROWTYPE;
  v_pedido_ids uuid[];
BEGIN
  v_empresa := public.empresa_por_print_agent_token(_token);
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  -- heartbeat rápido
  INSERT INTO public.print_agent_heartbeats
    (station_id, host, empresa_id, qz_connected, printer_name, agent_version, last_seen)
  VALUES
    (COALESCE(NULLIF(_station,''),'print-agent'), 'agent', v_empresa, true, _printer, _agent_version, now())
  ON CONFLICT (station_id) DO UPDATE
    SET empresa_id = EXCLUDED.empresa_id,
        printer_name = COALESCE(EXCLUDED.printer_name, public.print_agent_heartbeats.printer_name),
        agent_version = COALESCE(EXCLUDED.agent_version, public.print_agent_heartbeats.agent_version),
        qz_connected = true,
        last_seen = now();

  WITH next_job AS (
    SELECT j.id
      FROM public.print_jobs j
     WHERE j.status = 'pendente_impressao'
       AND j.empresa_id = v_empresa
     ORDER BY j.created_at ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED
  )
  UPDATE public.print_jobs j
     SET status = 'imprimindo',
         attempts = j.attempts + 1,
         claimed_by = COALESCE(NULLIF(_station,''),'print-agent'),
         claimed_at = now(),
         updated_at = now()
    FROM next_job
   WHERE j.id = next_job.id
  RETURNING j.* INTO v_job;

  IF v_job.id IS NULL THEN
    RETURN;
  END IF;

  v_pedido_ids := ARRAY(
    SELECT value::uuid FROM jsonb_array_elements_text(
      COALESCE(v_job.payload->'pedidoIds', jsonb_build_array(v_job.pedido_id::text))
    ) AS value
  );

  IF v_job.affects_pedido_status THEN
    UPDATE public.pedidos
       SET print_status = 'imprimindo',
           ultima_impressao_erro = NULL,
           updated_at = now()
     WHERE id = ANY(v_pedido_ids);
  END IF;

  INSERT INTO public.print_job_logs
    (print_job_id, pedido_id, status, message, detalhes, station)
  VALUES
    (v_job.id, v_job.pedido_id, 'imprimindo',
     'Print Agent nativo iniciou a impressão',
     jsonb_build_object('attempts', v_job.attempts, 'agent_version', _agent_version),
     COALESCE(NULLIF(_station,''),'print-agent'));

  RETURN NEXT v_job;
END;
$$;

-- Finalizar job (por token)
CREATE OR REPLACE FUNCTION public.finish_print_job_by_token(
  _token text,
  _job_id uuid,
  _success boolean,
  _message text DEFAULT NULL,
  _station text DEFAULT 'print-agent'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_job public.print_jobs%ROWTYPE;
  v_pedido_ids uuid[];
BEGIN
  v_empresa := public.empresa_por_print_agent_token(_token);
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;

  SELECT * INTO v_job FROM public.print_jobs WHERE id = _job_id AND empresa_id = v_empresa;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job não encontrado';
  END IF;

  v_pedido_ids := ARRAY(
    SELECT value::uuid FROM jsonb_array_elements_text(
      COALESCE(v_job.payload->'pedidoIds', jsonb_build_array(v_job.pedido_id::text))
    ) AS value
  );

  IF _success THEN
    UPDATE public.print_jobs
       SET status='impresso', impresso_em=now(), last_error=NULL, updated_at=now()
     WHERE id=_job_id;
    IF v_job.affects_pedido_status THEN
      UPDATE public.pedidos
         SET print_status='impresso', impresso_em=now(),
             ultima_impressao_erro=NULL, updated_at=now()
       WHERE id = ANY(v_pedido_ids);
    END IF;
    INSERT INTO public.print_job_logs (print_job_id, pedido_id, status, message, station)
    VALUES (_job_id, v_job.pedido_id, 'impresso',
            COALESCE(NULLIF(_message,''),'Impresso pelo Print Agent'), _station);
  ELSE
    UPDATE public.print_jobs
       SET status='erro_impressao',
           last_error=COALESCE(NULLIF(_message,''),'Falha ao imprimir'),
           updated_at=now()
     WHERE id=_job_id;
    IF v_job.affects_pedido_status THEN
      UPDATE public.pedidos
         SET print_status='erro_impressao',
             ultima_impressao_erro=COALESCE(NULLIF(_message,''),'Falha ao imprimir'),
             updated_at=now()
       WHERE id = ANY(v_pedido_ids);
    END IF;
    INSERT INTO public.print_job_logs (print_job_id, pedido_id, status, message, station)
    VALUES (_job_id, v_job.pedido_id, 'erro_impressao',
            COALESCE(NULLIF(_message,''),'Falha ao imprimir'), _station);
  END IF;
END;
$$;

-- Heartbeat isolado (usado quando não há jobs)
CREATE OR REPLACE FUNCTION public.print_agent_heartbeat_by_token(
  _token text,
  _station text DEFAULT 'print-agent',
  _agent_version text DEFAULT NULL,
  _printer text DEFAULT NULL,
  _online boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  v_empresa := public.empresa_por_print_agent_token(_token);
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Token inválido';
  END IF;
  INSERT INTO public.print_agent_heartbeats
    (station_id, host, empresa_id, qz_connected, printer_name, agent_version, last_seen)
  VALUES
    (COALESCE(NULLIF(_station,''),'print-agent'), 'agent', v_empresa, _online, _printer, _agent_version, now())
  ON CONFLICT (station_id) DO UPDATE
    SET empresa_id = EXCLUDED.empresa_id,
        printer_name = COALESCE(EXCLUDED.printer_name, public.print_agent_heartbeats.printer_name),
        agent_version = COALESCE(EXCLUDED.agent_version, public.print_agent_heartbeats.agent_version),
        qz_connected = EXCLUDED.qz_connected,
        last_seen = now();
END;
$$;

-- Reimprimir job (admin/caixa) — reseta status
CREATE OR REPLACE FUNCTION public.reimprimir_print_job(_job_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid := public.minha_empresa_id();
BEGIN
  IF v_user IS NULL OR NOT (public.is_admin(v_user) OR public.has_role(v_user,'caixa')) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE public.print_jobs
     SET status='pendente_impressao', claimed_by=NULL, claimed_at=NULL,
         last_error=NULL, updated_at=now()
   WHERE id=_job_id AND empresa_id=v_empresa;
END;
$$;
