-- Protege o Administrador Principal: nunca permitir que a empresa fique sem admin ativo
CREATE OR REPLACE FUNCTION public.guard_last_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa uuid;
  v_user uuid;
  v_remaining int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role <> 'admin' THEN RETURN OLD; END IF;
    v_empresa := OLD.empresa_id;
    v_user := OLD.user_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role <> 'admin' THEN RETURN NEW; END IF;
    IF NEW.role = 'admin' AND NEW.empresa_id = OLD.empresa_id AND NEW.user_id = OLD.user_id THEN
      RETURN NEW;
    END IF;
    v_empresa := OLD.empresa_id;
    v_user := OLD.user_id;
  ELSE
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_remaining
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.empresa_id = v_empresa
    AND ur.role = 'admin'
    AND ur.user_id <> v_user
    AND COALESCE(p.ativo, true) = true;

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'É necessário existir pelo menos um administrador ativo na empresa.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_admin ON public.user_roles;
CREATE TRIGGER trg_guard_last_admin
BEFORE UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin();

-- Também impede desativar o último admin via profiles.ativo
CREATE OR REPLACE FUNCTION public.guard_last_admin_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_remaining int;
BEGIN
  IF COALESCE(NEW.ativo, true) = COALESCE(OLD.ativo, true) OR COALESCE(NEW.ativo, true) = true THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = OLD.id AND role = 'admin' AND empresa_id = OLD.empresa_id
  ) INTO v_is_admin;
  IF NOT v_is_admin THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_remaining
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.empresa_id = OLD.empresa_id
    AND ur.role = 'admin'
    AND ur.user_id <> OLD.id
    AND COALESCE(p.ativo, true) = true;

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'É necessário existir pelo menos um administrador ativo na empresa.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_last_admin_profile ON public.profiles;
CREATE TRIGGER trg_guard_last_admin_profile
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_last_admin_profile();