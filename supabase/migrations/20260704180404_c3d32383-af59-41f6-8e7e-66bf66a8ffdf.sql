CREATE POLICY "comandas_delete"
ON public.comandas
FOR DELETE
TO authenticated
USING (
  empresa_id = public.minha_empresa_id()
  AND (
    public.has_role(auth.uid(), 'garcom'::public.app_role)
    OR public.has_role(auth.uid(), 'cozinha'::public.app_role)
    OR public.has_role(auth.uid(), 'caixa'::public.app_role)
    OR public.is_admin(auth.uid())
  )
);