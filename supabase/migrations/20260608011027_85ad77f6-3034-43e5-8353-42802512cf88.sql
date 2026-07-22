DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'print_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.print_status AS ENUM (
      'pendente_impressao',
      'imprimindo',
      'impresso',
      'erro_impressao'
    );
  END IF;
END $$;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS print_status public.print_status NOT NULL DEFAULT 'impresso',
  ADD COLUMN IF NOT EXISTS impresso_em timestamp with time zone,
  ADD COLUMN IF NOT EXISTS ultima_impressao_erro text;

CREATE TABLE IF NOT EXISTS public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  comanda_id uuid NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  setor public.setor NOT NULL,
  origem text NOT NULL DEFAULT 'auto',
  affects_pedido_status boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL,
  status public.print_status NOT NULL DEFAULT 'pendente_impressao',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  claimed_by text,
  claimed_at timestamp with time zone,
  impresso_em timestamp with time zone,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT print_jobs_origem_check CHECK (origem IN ('auto', 'manual', 'item'))
);
GRANT SELECT, INSERT, UPDATE ON public.print_jobs TO authenticated;
GRANT ALL ON public.print_jobs TO service_role;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem fila de impressao"
ON public.print_jobs
FOR SELECT
TO authenticated
USING (true);
CREATE POLICY "Equipe enfileira impressao"
ON public.print_jobs
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'garcom')
  OR public.has_role(auth.uid(), 'cozinha')
  OR public.has_role(auth.uid(), 'caixa')
  OR public.is_admin(auth.uid())
);
CREATE POLICY "Equipe opera fila de impressao"
ON public.print_jobs
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'cozinha')
  OR public.has_role(auth.uid(), 'caixa')
  OR public.is_admin(auth.uid())
);

CREATE TABLE IF NOT EXISTS public.print_job_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id uuid NOT NULL REFERENCES public.print_jobs(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  status public.print_status,
  message text NOT NULL,
  detalhes jsonb,
  station text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_job_logs TO authenticated;
GRANT ALL ON public.print_job_logs TO service_role;
ALTER TABLE public.print_job_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem logs de impressao"
ON public.print_job_logs
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX IF NOT EXISTS idx_print_jobs_status_created_at
  ON public.print_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_print_jobs_pedido_id
  ON public.print_jobs(pedido_id);
CREATE INDEX IF NOT EXISTS idx_print_job_logs_job_created_at
  ON public.print_job_logs(print_job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_job_logs_pedido_created_at
  ON public.print_job_logs(pedido_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enqueue_print_job(
  _pedido_id uuid,
  _comanda_id uuid,
  _setor public.setor,
  _payload jsonb,
  _origem text DEFAULT 'auto',
  _affects_pedido_status boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_user_id uuid := auth.uid();
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
    WHERE id = _pedido_id;
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
      ELSE 'Pedido enviado para a fila central de impressão'
    END,
    jsonb_build_object('origem', COALESCE(NULLIF(_origem, ''), 'auto')),
    'app'
  );

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_print_job(_claimed_by text DEFAULT NULL)
RETURNS SETOF public.print_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.print_jobs%ROWTYPE;
  v_station text := COALESCE(NULLIF(_claimed_by, ''), 'estacao-central');
  v_user_id uuid := auth.uid();
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

  IF v_job.affects_pedido_status THEN
    UPDATE public.pedidos
    SET print_status = 'imprimindo',
        ultima_impressao_erro = NULL,
        updated_at = now()
    WHERE id = v_job.pedido_id;
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
    jsonb_build_object('attempts', v_job.attempts, 'origem', v_job.origem),
    v_station
  );

  RETURN NEXT v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_print_job(
  _job_id uuid,
  _success boolean,
  _message text DEFAULT NULL,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.print_jobs%ROWTYPE;
  v_user_id uuid := auth.uid();
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
      WHERE id = v_job.pedido_id;
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
      _details,
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
      WHERE id = v_job.pedido_id;
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
      _details,
      v_job.claimed_by
    );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_print_jobs_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_print_jobs_touch_updated_at
    BEFORE UPDATE ON public.print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'print_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_jobs;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'print_job_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.print_job_logs;
  END IF;
END $$;