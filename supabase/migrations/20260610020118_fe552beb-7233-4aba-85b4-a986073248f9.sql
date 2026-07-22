GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pin_diario TO authenticated;
GRANT ALL ON public.pin_diario TO service_role;