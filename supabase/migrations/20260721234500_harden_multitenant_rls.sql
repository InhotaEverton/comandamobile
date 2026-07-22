-- Multi-tenant isolation hardening.
-- Tenant identity must never be changeable through a client session.

CREATE OR REPLACE FUNCTION public.enforce_profile_empresa_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     AND COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'empresa_id do perfil nao pode ser alterado'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_empresa_immutable ON public.profiles;
CREATE TRIGGER trg_profiles_empresa_immutable
  BEFORE UPDATE OF empresa_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_empresa_immutable();

REVOKE ALL ON FUNCTION public.enforce_profile_empresa_immutable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_profile_empresa_immutable() TO service_role;

DROP POLICY IF EXISTS profiles_update_self_or_admin ON public.profiles;
CREATE POLICY profiles_update_self_or_admin
ON public.profiles
FOR UPDATE TO authenticated
USING (
  empresa_id = public.minha_empresa_id()
  AND (id = auth.uid() OR public.is_admin(auth.uid()))
)
WITH CHECK (
  empresa_id = public.minha_empresa_id()
  AND (id = auth.uid() OR public.is_admin(auth.uid()))
);

-- A role and its profile must belong to the same tenant.
CREATE OR REPLACE FUNCTION public.enforce_user_role_empresa_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = NEW.user_id
      AND p.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'papel e perfil devem pertencer a mesma empresa'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_roles_empresa_match ON public.user_roles;
CREATE TRIGGER trg_user_roles_empresa_match
  BEFORE INSERT OR UPDATE OF user_id, empresa_id ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_user_role_empresa_match();

REVOKE ALL ON FUNCTION public.enforce_user_role_empresa_match() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_user_role_empresa_match() TO service_role;

DROP POLICY IF EXISTS user_roles_admin_manage ON public.user_roles;
CREATE POLICY user_roles_admin_manage
ON public.user_roles
FOR ALL TO authenticated
USING (
  empresa_id = public.minha_empresa_id()
  AND public.is_admin(auth.uid())
)
WITH CHECK (
  empresa_id = public.minha_empresa_id()
  AND public.is_admin(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = user_id
      AND p.empresa_id = user_roles.empresa_id
  )
);

-- Role checks only accept a role whose tenant matches the user's current profile.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p
      ON p.id = ur.user_id
     AND p.empresa_id = ur.empresa_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.empresa_id = public.minha_empresa_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role);
$$;

-- This helper must not disclose another user's tenant id.
CREATE OR REPLACE FUNCTION public.get_empresa_id_do_usuario(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.empresa_id
  FROM public.profiles p
  WHERE p.id = _user_id
    AND (_user_id = auth.uid() OR auth.role() = 'service_role')
  LIMIT 1;
$$;

-- Administrative/trigger functions are not client RPCs.
REVOKE ALL ON FUNCTION public.reparar_identidade_auth_orfa_por_email(text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reparar_identidade_auth_orfa_por_email(text)
  TO service_role;

REVOKE ALL ON FUNCTION public.set_pagamento_origem_caixa()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_pagamento_origem_caixa()
  TO service_role;

-- Public ordering RPCs remain intentionally available, but not through PUBLIC.
REVOKE ALL ON FUNCTION public.get_cardapio_publico(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.buscar_cliente_online(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_cardapio_publico(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buscar_cliente_online(text, text) TO anon, authenticated, service_role;

