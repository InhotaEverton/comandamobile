-- Fix WITH CHECK to also require admin
ALTER POLICY configuracoes_update ON public.configuracoes
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

ALTER POLICY pin_diario_update ON public.pin_diario
  WITH CHECK (empresa_id = public.minha_empresa_id() AND public.is_admin(auth.uid()));

-- Scope role checks to caller's tenant to prevent cross-tenant privilege escalation
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND empresa_id = public.minha_empresa_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
      AND empresa_id = public.minha_empresa_id()
  )
$$;