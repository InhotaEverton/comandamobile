DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome_empresa text;
  v_nome_responsavel text;
  v_empresa_id uuid;
  v_invited_empresa uuid;
  v_initial_role public.app_role;
BEGIN
  v_nome_responsavel := COALESCE(
    NULLIF(btrim(NEW.raw_user_meta_data->>'nome'), ''),
    split_part(NEW.email, '@', 1)
  );

  v_invited_empresa := NULLIF(NEW.raw_user_meta_data->>'invited_by_empresa', '')::uuid;
  v_initial_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'initial_role', '')::public.app_role, 'garcom'::public.app_role);

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
    false, 0, false, '[]'::jsonb,
    false, 50, 'continua'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

ALTER TABLE public.mesas DROP CONSTRAINT IF EXISTS mesas_numero_key;
ALTER TABLE public.mesas ADD CONSTRAINT mesas_empresa_numero_key UNIQUE (empresa_id, numero);

ALTER TABLE public.pin_diario DROP CONSTRAINT IF EXISTS pin_diario_data_key;
ALTER TABLE public.pin_diario ADD CONSTRAINT pin_diario_empresa_data_key UNIQUE (empresa_id, data);

DELETE FROM public.configuracoes c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.empresa_id = c.empresa_id
);

DELETE FROM public.empresas e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.profiles p
  WHERE p.empresa_id = e.id
);