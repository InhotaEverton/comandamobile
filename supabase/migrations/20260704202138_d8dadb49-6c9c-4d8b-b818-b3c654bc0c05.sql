ALTER TABLE public.user_roles DISABLE TRIGGER trg_guard_last_admin;

WITH audit_empresas AS (
  SELECT id
  FROM public.empresas
  WHERE nome LIKE 'Audit Empresa%'
     OR nome LIKE 'Pin Audit Empresa%'
     OR nome = 'Should Be Own Company'
), deleted_roles AS (
  DELETE FROM public.user_roles ur
  USING audit_empresas ae
  WHERE ur.empresa_id = ae.id
  RETURNING ur.id
), deleted_config AS (
  DELETE FROM public.configuracoes c
  USING audit_empresas ae
  WHERE c.empresa_id = ae.id
  RETURNING c.id
), deleted_pins AS (
  DELETE FROM public.pin_diario p
  USING audit_empresas ae
  WHERE p.empresa_id = ae.id
  RETURNING p.id
), deleted_profiles AS (
  DELETE FROM public.profiles p
  USING audit_empresas ae
  WHERE p.empresa_id = ae.id
  RETURNING p.id
)
DELETE FROM public.empresas e
USING audit_empresas ae
WHERE e.id = ae.id;

ALTER TABLE public.user_roles ENABLE TRIGGER trg_guard_last_admin;