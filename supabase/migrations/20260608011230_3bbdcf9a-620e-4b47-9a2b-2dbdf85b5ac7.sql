REVOKE ALL ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_next_print_job(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_print_job(uuid, uuid, public.setor, jsonb, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_next_print_job(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_print_job(uuid, boolean, text, jsonb) TO service_role;