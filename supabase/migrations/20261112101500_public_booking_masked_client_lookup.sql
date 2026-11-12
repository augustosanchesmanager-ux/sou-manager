-- Public booking masked client lookup & promotional lead registration (LGPD-safe).
-- Never returns full PII (full name, email, birthday, id) on unauthenticated phone lookup.

CREATE OR REPLACE FUNCTION public.mask_public_client_name(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_words text[];
  v_word text;
  v_result text[] := '{}';
  v_clean text := btrim(coalesce(p_name, ''));
BEGIN
  IF v_clean = '' THEN
    RETURN NULL;
  END IF;

  v_words := regexp_split_to_array(v_clean, '\s+');
  FOREACH v_word IN ARRAY v_words LOOP
    IF char_length(v_word) <= 1 THEN
      v_result := array_append(v_result, '*');
    ELSE
      v_result := array_append(
        v_result,
        left(v_word, 1) || repeat('*', LEAST(char_length(v_word) - 1, 6))
      );
    END IF;
  END LOOP;

  RETURN array_to_string(v_result, ' ');
END;
$$;

CREATE OR REPLACE FUNCTION public.lookup_public_booking_client(
  p_tenant_identifier text,
  p_client_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id uuid;
  v_canon_phone text;
  v_client_name text;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RETURN jsonb_build_object('found', false, 'masked_name', NULL);
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('found', false, 'masked_name', NULL);
  END IF;

  v_canon_phone := public.normalize_br_phone(p_client_phone);
  IF v_canon_phone IS NULL THEN
    RETURN jsonb_build_object('found', false, 'masked_name', NULL);
  END IF;

  SELECT c.name
    INTO v_client_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND COALESCE(c.is_shared_phone, false) = false
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY c.created_at ASC
   LIMIT 1;

  IF v_client_name IS NULL THEN
    RETURN jsonb_build_object('found', false, 'masked_name', NULL);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'masked_name', public.mask_public_client_name(v_client_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.register_public_booking_promo_lead(
  p_tenant_identifier text,
  p_client_name text,
  p_client_phone text,
  p_client_email text DEFAULT NULL,
  p_birthday text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id uuid;
  v_canon_phone text;
  v_clean_name text := btrim(coalesce(p_client_name, ''));
  v_clean_email text := NULLIF(btrim(coalesce(p_client_email, '')), '');
  v_clean_birthday text := NULLIF(btrim(coalesce(p_birthday, '')), '');
  v_existing_id uuid;
  v_existing_name text;
  v_reconciled boolean := false;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RAISE EXCEPTION 'tenant_required' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  IF char_length(v_clean_name) < 3 THEN
    RAISE EXCEPTION 'invalid_name' USING ERRCODE = 'P0001';
  END IF;

  v_canon_phone := public.normalize_br_phone(p_client_phone);
  IF v_canon_phone IS NULL THEN
    RAISE EXCEPTION 'invalid_phone' USING ERRCODE = 'P0001';
  END IF;

  SELECT c.id, c.name
    INTO v_existing_id, v_existing_name
    FROM public.clients c
   WHERE c.tenant_id = v_tenant_id
     AND public.normalize_br_phone(c.phone) = v_canon_phone
   ORDER BY c.is_shared_phone ASC, c.created_at ASC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    v_reconciled := true;
    -- Non-destructive enrichment: only fill blank email/birthday
    UPDATE public.clients
       SET email = COALESCE(NULLIF(btrim(email), ''), v_clean_email),
           birthday = COALESCE(NULLIF(btrim(birthday), ''), v_clean_birthday)
     WHERE id = v_existing_id
       AND tenant_id = v_tenant_id;
  ELSE
    BEGIN
      INSERT INTO public.clients (tenant_id, name, phone, email, birthday)
      VALUES (v_tenant_id, v_clean_name, v_canon_phone, v_clean_email, v_clean_birthday)
      RETURNING id, name INTO v_existing_id, v_existing_name;
    EXCEPTION WHEN unique_violation THEN
      v_reconciled := true;
      SELECT c.id, c.name
        INTO v_existing_id, v_existing_name
        FROM public.clients c
       WHERE c.tenant_id = v_tenant_id
         AND public.normalize_br_phone(c.phone) = v_canon_phone
       ORDER BY c.is_shared_phone ASC, c.created_at ASC
       LIMIT 1;
    END;
  END IF;

  RETURN jsonb_build_object(
    'registered', true,
    'reconciled', v_reconciled,
    'masked_name', public.mask_public_client_name(COALESCE(v_existing_name, v_clean_name))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_booking_client(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_booking_client(text, text) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.register_public_booking_promo_lead(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_public_booking_promo_lead(text, text, text, text, text) TO anon, authenticated, service_role;
