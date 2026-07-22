CREATE OR REPLACE FUNCTION public.validar_pin_hoje(_pin text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pin_diario
    WHERE empresa_id = public.minha_empresa_id()
      AND data = (now() AT TIME ZONE 'America/Sao_Paulo')::date
      AND pin = _pin
  )
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome_empresa text;
  v_nome_responsavel text;
  v_empresa_id uuid;
  v_invited_empresa uuid;
  v_initial_role public.app_role;
  v_default_horarios jsonb := '{
    "dom": {"abre": "00:00", "fecha": "00:00", "aberto": false},
    "seg": {"abre": "08:00", "fecha": "23:00", "aberto": true},
    "ter": {"abre": "08:00", "fecha": "23:00", "aberto": true},
    "qua": {"abre": "08:00", "fecha": "23:00", "aberto": true},
    "qui": {"abre": "08:00", "fecha": "23:00", "aberto": true},
    "sex": {"abre": "08:00", "fecha": "23:59", "aberto": true},
    "sab": {"abre": "08:00", "fecha": "23:59", "aberto": true}
  }'::jsonb;
BEGIN
  v_nome_responsavel := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'nome'), ''),
    NULLIF(btrim(NEW.raw_app_meta_data->>'nome'), ''),
    split_part(NEW.email, '@', 1)
  );

  v_invited_empresa := NULLIF(NEW.raw_app_meta_data->>'invited_by_empresa', '')::uuid;
  v_initial_role := COALESCE(NULLIF(NEW.raw_app_meta_data->>'initial_role', '')::public.app_role, 'garcom'::public.app_role);

  IF v_invited_empresa IS NOT NULL THEN
    v_empresa_id := v_invited_empresa;

    INSERT INTO public.profiles (id, nome, empresa_id)
    VALUES (NEW.id, v_nome_responsavel, v_empresa_id)
    ON CONFLICT (id) DO UPDATE
      SET nome = EXCLUDED.nome,
          empresa_id = EXCLUDED.empresa_id;

    INSERT INTO public.user_roles (user_id, role, empresa_id)
    VALUES (NEW.id, v_initial_role, v_empresa_id)
    ON CONFLICT (user_id, role) DO NOTHING;

    RETURN NEW;
  END IF;

  v_nome_empresa := COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'nome_empresa'), ''), 'Minha Empresa');

  INSERT INTO public.empresas (nome, onboarding_completo, onboarding_etapa)
  VALUES (v_nome_empresa, false, 1)
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.profiles (id, nome, empresa_id)
  VALUES (NEW.id, v_nome_responsavel, v_empresa_id);

  INSERT INTO public.user_roles (user_id, role, empresa_id)
  VALUES (NEW.id, 'admin', v_empresa_id);

  INSERT INTO public.configuracoes (
    empresa_id, modo_operacao, impressao_auto, qz_host,
    taxa_garcom_ativa, taxa_garcom_percentual, taxa_garcom_auto,
    couvert_ativo, couvert_valor, horario_ativo, horarios,
    pin_diario_ativo, qtd_comandas, tipo_numeracao
  ) VALUES (
    v_empresa_id, 'ambos', false, 'localhost',
    false, 10, false,
    false, 0, false, v_default_horarios,
    false, 50, 'continua'
  );

  RETURN NEW;
END;
$function$;