CREATE TABLE public.print_agent_heartbeats (
  station_id TEXT PRIMARY KEY,
  host TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  qz_connected BOOLEAN NOT NULL DEFAULT false,
  printer_name TEXT,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.print_agent_heartbeats TO authenticated;
GRANT ALL ON public.print_agent_heartbeats TO service_role;

ALTER TABLE public.print_agent_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operacional pode ler heartbeats"
ON public.print_agent_heartbeats FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'caixa')
  OR public.has_role(auth.uid(), 'cozinha')
  OR public.has_role(auth.uid(), 'garcom')
);

CREATE POLICY "Usuario autenticado escreve seu heartbeat"
ON public.print_agent_heartbeats FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'caixa')
    OR public.has_role(auth.uid(), 'cozinha')
  )
);

CREATE POLICY "Usuario atualiza seu heartbeat"
ON public.print_agent_heartbeats FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin remove heartbeats"
ON public.print_agent_heartbeats FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

CREATE TRIGGER touch_print_agent_heartbeats
BEFORE UPDATE ON public.print_agent_heartbeats
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.print_agent_heartbeats;