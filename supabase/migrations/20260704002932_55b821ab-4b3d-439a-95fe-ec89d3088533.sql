-- Remove infraestrutura de impressão automática e tabelas V2 paralelas.

-- 1) Print Agent / QZ
DROP TABLE IF EXISTS public.print_job_logs CASCADE;
DROP TABLE IF EXISTS public.print_jobs CASCADE;
DROP TABLE IF EXISTS public.print_agent_heartbeats CASCADE;

DROP FUNCTION IF EXISTS public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_print_job(text) CASCADE;
DROP FUNCTION IF EXISTS public.claim_next_print_job_by_token(text, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.finish_print_job(uuid, boolean, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.finish_print_job_by_token(text, uuid, boolean, text, text) CASCADE;
DROP FUNCTION IF EXISTS public.print_agent_heartbeat_by_token(text, text, text, text, boolean) CASCADE;
DROP FUNCTION IF EXISTS public.reimprimir_print_job(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.gerar_print_agent_token() CASCADE;
DROP FUNCTION IF EXISTS public.revogar_print_agent_token() CASCADE;
DROP FUNCTION IF EXISTS public.empresa_por_print_agent_token(text) CASCADE;

DROP TYPE IF EXISTS public.print_status CASCADE;

ALTER TABLE public.empresas
  DROP COLUMN IF EXISTS print_agent_token,
  DROP COLUMN IF EXISTS print_agent_token_created_at;

ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS print_status,
  DROP COLUMN IF EXISTS impresso_em,
  DROP COLUMN IF EXISTS ultima_impressao_erro;

ALTER TABLE public.configuracoes
  DROP COLUMN IF EXISTS impressao_auto,
  DROP COLUMN IF EXISTS qz_host;

-- 2) V2 paralela
DROP TABLE IF EXISTS public.v2_item_adicionais CASCADE;
DROP TABLE IF EXISTS public.v2_itens_pedido CASCADE;
DROP TABLE IF EXISTS public.v2_pedidos CASCADE;
DROP TABLE IF EXISTS public.v2_comandas CASCADE;
DROP TABLE IF EXISTS public.v2_produto_grupos CASCADE;
DROP TABLE IF EXISTS public.v2_adicionais CASCADE;
DROP TABLE IF EXISTS public.v2_grupos_adicionais CASCADE;
DROP TABLE IF EXISTS public.v2_produtos CASCADE;
DROP TABLE IF EXISTS public.v2_categorias CASCADE;

DROP FUNCTION IF EXISTS public.v2_recalc_pedido() CASCADE;
DROP FUNCTION IF EXISTS public.v2_recalc_comanda() CASCADE;
DROP FUNCTION IF EXISTS public.v2_cardapio_publico(text) CASCADE;
DROP FUNCTION IF EXISTS public.v2_criar_pedido_online(text, text, text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.v2_dashboard() CASCADE;
DROP FUNCTION IF EXISTS public.v2_gerar_slug_empresa() CASCADE;
DROP FUNCTION IF EXISTS public.v2_slugify(text) CASCADE;

ALTER TABLE public.empresas
  DROP COLUMN IF EXISTS v2_slug,
  DROP COLUMN IF EXISTS v2_pedidos_online_ativo,
  DROP COLUMN IF EXISTS v2_retirada_ativo,
  DROP COLUMN IF EXISTS v2_consumo_local_ativo,
  DROP COLUMN IF EXISTS v2_entrega_ativo;
