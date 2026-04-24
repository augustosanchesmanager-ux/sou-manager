BEGIN;

DO $$
DECLARE
  target_schema text;
  source_constraint_name text;
  channel_constraint_name text;
BEGIN
  FOREACH target_schema IN ARRAY ARRAY['public', 'barber']
  LOOP
    IF to_regclass(format('%I.appointments', target_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS client_phone TEXT DEFAULT ''''', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT ''''', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS source TEXT DEFAULT ''app''', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS channel TEXT', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS external_source TEXT', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS external_id TEXT', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT DEFAULT ''''', target_schema);
    EXECUTE format('ALTER TABLE %I.appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ', target_schema);

    SELECT c.conname
      INTO source_constraint_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = target_schema
      AND rel.relname = 'appointments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%source%'
    LIMIT 1;

    IF source_constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.appointments DROP CONSTRAINT %I', target_schema, source_constraint_name);
    END IF;

    SELECT c.conname
      INTO channel_constraint_name
    FROM pg_constraint c
    JOIN pg_class rel ON rel.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = target_schema
      AND rel.relname = 'appointments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%channel%'
    LIMIT 1;

    IF channel_constraint_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE %I.appointments DROP CONSTRAINT %I', target_schema, channel_constraint_name);
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.appointments ADD CONSTRAINT appointments_source_check CHECK (source IN (''app'', ''kiosk'', ''site_sanchez''))',
      target_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.appointments ADD CONSTRAINT appointments_channel_check CHECK (channel IS NULL OR channel IN (''totem'', ''qr'', ''whatsapp'', ''admin'', ''site''))',
      target_schema
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_appointments_active_slot ON %I.appointments (tenant_id, staff_id, start_time) WHERE lower(coalesce(status, ''pending'')) NOT IN (''cancelled'', ''no_show'')',
      target_schema,
      target_schema
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_%s_appointments_external_site ON %I.appointments (tenant_id, external_source, external_id) WHERE external_source IS NOT NULL AND external_id IS NOT NULL',
      target_schema,
      target_schema
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_site_sanchez_appointment(
  p_tenant_id UUID,
  p_client_name TEXT,
  p_phone TEXT,
  p_service_id UUID,
  p_professional_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_notes TEXT DEFAULT NULL,
  p_domain_schema TEXT DEFAULT 'public',
  p_status TEXT DEFAULT 'active',
  p_site_appointment_id TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_schema TEXT := lower(coalesce(nullif(btrim(p_domain_schema), ''), 'public'));
  v_client_id UUID;
  v_client_name TEXT := nullif(btrim(coalesce(p_client_name, '')), '');
  v_clean_phone TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_service_name TEXT;
  v_service_price NUMERIC(10,2) := 0;
  v_service_duration_minutes NUMERIC := 30;
  v_staff_name TEXT;
  v_start_time TIMESTAMPTZ := p_scheduled_at;
  v_end_time TIMESTAMPTZ;
  v_duration_hours NUMERIC(6,2);
  v_status TEXT := lower(coalesce(nullif(btrim(p_status), ''), 'active'));
  v_site_appointment_id TEXT := nullif(btrim(coalesce(p_site_appointment_id, '')), '');
  v_external_id TEXT := nullif(btrim(coalesce(p_external_id, '')), '');
  v_conflict_id UUID;
  v_appointment_id UUID;
BEGIN
  IF v_schema NOT IN ('public', 'barber') THEN
    RAISE EXCEPTION 'Schema de dominio invalido';
  END IF;

  IF to_regclass(format('%I.services', v_schema)) IS NULL
    OR to_regclass(format('%I.clients', v_schema)) IS NULL
    OR to_regclass(format('%I.appointments', v_schema)) IS NULL THEN
    RAISE EXCEPTION 'Schema de dominio nao esta preparado para agendamentos';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant Sanchez nao configurado';
  END IF;

  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio';
  END IF;

  IF p_service_id IS NULL OR p_professional_id IS NULL OR v_start_time IS NULL THEN
    RAISE EXCEPTION 'Servico, profissional e horario sao obrigatorios';
  END IF;

  IF v_status NOT IN ('active', 'cancelled', 'rescheduled') THEN
    RAISE EXCEPTION 'Status de integracao invalido';
  END IF;

  IF v_site_appointment_id IS NULL THEN
    RAISE EXCEPTION 'Identificador externo do site e obrigatorio';
  END IF;

  IF v_status = 'active' AND (length(v_clean_phone) < 10 OR length(v_clean_phone) > 13) THEN
    RAISE EXCEPTION 'Telefone invalido';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_tenant_id::text || ':' || p_professional_id::text, 0)
  );

  IF v_status IN ('cancelled', 'rescheduled') THEN
    EXECUTE format(
      'UPDATE %I.appointments a
          SET status = ''cancelled'',
              cancellation_reason = coalesce(nullif(to_jsonb(a)->>''cancellation_reason'', ''''), $5),
              cancelled_at = coalesce(nullif(to_jsonb(a)->>''cancelled_at'', '''')::timestamptz, now())
        WHERE a.tenant_id = $1
          AND a.source = ''site_sanchez''
          AND lower(coalesce(a.status, ''pending'')) NOT IN (''cancelled'', ''no_show'', ''completed'')
          AND (
            a.external_id = $2
            OR a.external_id = $3
            OR ($3 ~* ''^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'' AND a.id = $3::uuid)
          )
        RETURNING a.id',
      v_schema
    )
    INTO v_appointment_id
    USING
      p_tenant_id,
      v_site_appointment_id,
      v_external_id,
      v_status,
      CASE
        WHEN v_status = 'rescheduled' THEN 'rescheduled_from_site_sanchez'
        ELSE 'cancelled_from_site_sanchez'
      END;

    IF v_appointment_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok', true,
        'appointment_id', v_external_id,
        'client_id', null,
        'status', v_status,
        'source', 'site_sanchez',
        'not_found', true
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'appointment_id', v_appointment_id,
      'client_id', null,
      'status', v_status,
      'source', 'site_sanchez'
    );
  END IF;

  EXECUTE format(
    'SELECT s.name,
            coalesce(nullif(to_jsonb(s)->>''price'', '''')::numeric, 0),
            coalesce(
              nullif(to_jsonb(s)->>''duration_minutes'', '''')::numeric,
              nullif(to_jsonb(s)->>''duration'', '''')::numeric,
              30
            )
       FROM %I.services s
      WHERE s.id = $1
        AND s.tenant_id = $2
        AND coalesce(
          nullif(to_jsonb(s)->>''is_active'', '''')::boolean,
          nullif(to_jsonb(s)->>''active'', '''')::boolean,
          true
        ) = true
      LIMIT 1',
    v_schema
  )
  INTO v_service_name, v_service_price, v_service_duration_minutes
  USING p_service_id, p_tenant_id;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Servico invalido para a Sanchez Barber';
  END IF;

  SELECT st.name
    INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_professional_id
    AND st.tenant_id = p_tenant_id
    AND lower(coalesce(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido para a Sanchez Barber';
  END IF;

  v_service_duration_minutes := greatest(coalesce(v_service_duration_minutes, 30), 1);
  v_duration_hours := round((v_service_duration_minutes / 60.0)::numeric, 2);
  v_end_time := v_start_time + (v_service_duration_minutes * interval '1 minute');

  EXECUTE format(
    'SELECT c.id
       FROM %I.clients c
      WHERE c.tenant_id = $1
        AND regexp_replace(coalesce(c.phone, ''''), ''\D'', '''', ''g'') = $2
      ORDER BY c.created_at ASC
      LIMIT 1',
    v_schema
  )
  INTO v_client_id
  USING p_tenant_id, v_clean_phone;

  IF v_client_id IS NULL THEN
    EXECUTE format(
      'INSERT INTO %I.clients (tenant_id, name, phone)
       VALUES ($1, $2, $3)
       RETURNING id',
      v_schema
    )
    INTO v_client_id
    USING p_tenant_id, v_client_name, v_clean_phone;
  END IF;

  EXECUTE format(
    'SELECT a.id
       FROM %I.appointments a
      WHERE a.tenant_id = $1
        AND a.source = ''site_sanchez''
        AND a.external_id = $2
      LIMIT 1',
    v_schema
  )
  INTO v_appointment_id
  USING p_tenant_id, v_site_appointment_id;

  IF v_appointment_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'appointment_id', v_appointment_id,
      'client_id', v_client_id,
      'status', 'confirmed',
      'source', 'site_sanchez',
      'idempotent', true
    );
  END IF;

  EXECUTE format(
    'SELECT a.id
       FROM %I.appointments a
      WHERE a.tenant_id = $1
        AND a.staff_id = $2
        AND lower(coalesce(a.status, ''pending'')) NOT IN (''cancelled'', ''no_show'')
        AND tstzrange(
          a.start_time,
          coalesce(
            nullif(to_jsonb(a)->>''end_time'', '''')::timestamptz,
            a.start_time + (coalesce(nullif(to_jsonb(a)->>''duration'', '''')::numeric, 1) * interval ''1 hour'')
          ),
          ''[)''
        ) && tstzrange($3, $4, ''[)'')
      LIMIT 1',
    v_schema
  )
  INTO v_conflict_id
  USING p_tenant_id, p_professional_id, v_start_time, v_end_time;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Horario indisponivel para este profissional' USING ERRCODE = '23P01';
  END IF;

  EXECUTE format(
    'INSERT INTO %I.appointments (
      tenant_id,
      client_id,
      service_id,
      staff_id,
      client_name,
      client_phone,
      service_name,
      staff_name,
      start_time,
      end_time,
      duration,
      price,
      status,
      source,
      channel,
      external_source,
      external_id,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, ''confirmed'', ''site_sanchez'', ''site'', ''site_sanchez'', $13, $14)
    RETURNING id',
    v_schema
  )
  INTO v_appointment_id
  USING
    p_tenant_id,
    v_client_id,
    p_service_id,
    p_professional_id,
    v_client_name,
    v_clean_phone,
    v_service_name,
    v_staff_name,
    v_start_time,
    v_end_time,
    v_duration_hours,
    v_service_price,
    v_site_appointment_id,
    nullif(btrim(coalesce(p_notes, '')), '');

  RETURN jsonb_build_object(
    'ok', true,
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'status', 'confirmed',
    'source', 'site_sanchez',
    'start_time', v_start_time,
    'end_time', v_end_time
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
