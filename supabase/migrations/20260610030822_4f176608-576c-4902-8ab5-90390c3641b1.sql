DELETE FROM auth.identities i
WHERE NOT EXISTS (
  SELECT 1
  FROM auth.users u
  WHERE u.id = i.user_id
);

CREATE OR REPLACE FUNCTION public.reparar_identidade_auth_orfa_por_email(_email text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_deleted integer := 0;
  v_email text := lower(nullif(btrim(_email), ''));
BEGIN
  IF v_email IS NULL THEN
    RETURN 0;
  END IF;

  DELETE FROM auth.identities i
  WHERE lower(i.email) = v_email
    AND NOT EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = i.user_id
    );

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.reparar_identidade_auth_orfa_por_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reparar_identidade_auth_orfa_por_email(text) TO service_role;