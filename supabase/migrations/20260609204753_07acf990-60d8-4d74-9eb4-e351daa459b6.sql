
ALTER TABLE public.profiles               ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.user_roles             ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.produtos               ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.categorias             ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.mesas                  ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.comandas               ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.pedidos                ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.itens_pedido           ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.pagamentos             ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.caixas                 ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.movimentacoes_caixa    ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.configuracoes          ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.pin_diario             ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.print_jobs             ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.print_job_logs         ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.print_agent_heartbeats ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
ALTER TABLE public.comanda_historico      ALTER COLUMN empresa_id SET DEFAULT public.minha_empresa_id();
