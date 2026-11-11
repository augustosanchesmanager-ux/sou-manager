-- ============================================================================
-- Migration: 20261111214500_clients_phone_deduplication_and_unique_guard.sql
-- Description:
--   1. Cria função IMMUTABLE public.normalize_br_phone(TEXT) para chave canônica
--      de telefone (DDD + número, removendo +55/55 e ignorando placeholders como
--      11111111111 ou números < 10 dígitos).
--   2. Adiciona coluna is_shared_phone em public.clients para dependentes que
--      compartilham WhatsApp do titular (ex.: pai/filho).
--   3. Executa o saneamento dos Grupos A e B conforme autorização do PO:
--      - Mescla os 13 grupos do Grupo A mantendo o registro de maior histórico.
--      - Aplica o mapeamento explícito do Grupo B (mesclas, exclusão, apelido e
--        marcação de telefone compartilhado para dependentes).
--   4. Cria UNIQUE INDEX parcial clients_tenant_canon_phone_uidx garantindo
--      unicidade por (tenant_id, normalize_br_phone(phone)) quando não
--      compartilhado e não placeholder.
--   5. Atualiza create_public_booking, create_site_sanchez_appointment e
--      import_clients_batch para buscar/reutilizar cliente via normalize_br_phone.
-- ============================================================================

-- 1. Função canônica de normalização de telefone brasileiro
CREATE OR REPLACE FUNCTION public.normalize_br_phone(p_raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  WITH cleaned AS (
    SELECT regexp_replace(coalesce(p_raw, ''), '\D', '', 'g') AS d
  ),
  stripped AS (
    SELECT
      CASE
        WHEN length(d) IN (12, 13) AND left(d, 2) = '55' THEN substr(d, 3)
        ELSE d
      END AS br
    FROM cleaned
  )
  SELECT
    CASE
      WHEN length(br) BETWEEN 10 AND 11 AND br !~ '^(\d)\1+$' THEN br
      ELSE NULL
    END
  FROM stripped;
$$;

REVOKE ALL ON FUNCTION public.normalize_br_phone(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_br_phone(TEXT) TO anon, authenticated, service_role;

-- 2. Suporte a telefone compartilhado para dependentes (pai/filho)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_shared_phone BOOLEAN NOT NULL DEFAULT false;

-- 3. Saneamento controlado dos Grupos A e B
CREATE OR REPLACE FUNCTION pg_temp.smg_merge_client(p_source_id UUID, p_target_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_src RECORD;
  v_tgt RECORD;
BEGIN
  IF p_source_id IS NULL OR p_target_id IS NULL OR p_source_id = p_target_id THEN
    RETURN;
  END IF;

  SELECT * INTO v_src FROM public.clients WHERE id = p_source_id;
  SELECT * INTO v_tgt FROM public.clients WHERE id = p_target_id;

  IF v_src.id IS NULL OR v_tgt.id IS NULL THEN
    RETURN;
  END IF;

  IF v_src.tenant_id IS DISTINCT FROM v_tgt.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant client merge is forbidden (% vs %)', v_src.tenant_id, v_tgt.tenant_id;
  END IF;

  -- Preserva metadados complementares no registro principal sem sobrescrever o nome escolhido
  UPDATE public.clients
     SET email = COALESCE(NULLIF(btrim(email), ''), NULLIF(btrim(v_src.email), '')),
         birthday = COALESCE(NULLIF(btrim(birthday), ''), NULLIF(btrim(v_src.birthday), '')),
         notes = CASE
           WHEN NULLIF(btrim(v_src.notes), '') IS NULL THEN notes
           WHEN NULLIF(btrim(notes), '') IS NULL THEN v_src.notes
           WHEN position(btrim(v_src.notes) IN notes) > 0 THEN notes
           ELSE notes || E'\n' || v_src.notes
         END,
         last_visit = CASE
           WHEN last_visit IS NULL THEN v_src.last_visit
           WHEN v_src.last_visit IS NULL THEN last_visit
           ELSE GREATEST(last_visit, v_src.last_visit)
         END,
         total_spent = COALESCE(total_spent, 0) + COALESCE(v_src.total_spent, 0)
   WHERE id = p_target_id;

  -- Reapontar todas as FKs conhecidas para o registro principal
  UPDATE public.appointments SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.comandas SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.client_wallets SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.client_wallet_transactions SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.customer_subscriptions SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.customer_subscription_receivables SET customer_id = p_target_id WHERE customer_id = p_source_id;
  UPDATE public.customer_credits SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.customer_benefit_consumptions SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.customer_plan_credit_usages SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.customer_vouchers SET customer_id = p_target_id WHERE customer_id = p_source_id;
  UPDATE public.portal_sessions SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.subscription_recurring_slots SET client_id = p_target_id WHERE client_id = p_source_id;
  UPDATE public.waitlist SET client_id = p_target_id WHERE client_id = p_source_id;

  DELETE FROM public.clients WHERE id = p_source_id;
END;
$$;

DO $$
DECLARE
  v_group RECORD;
  v_primary_id UUID;
  v_dup_id UUID;
BEGIN
  -- 3A. Grupo B (regras explícitas definidas pelo PO)

  -- 11912492022 (Sanchez): excluir Felipe Cordeiro (preserva registros financeiros sem FK órfã)
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = '0ca3568b-5400-4ae7-8ecf-3c294c89a6a4') THEN
    UPDATE public.appointments
       SET client_id = NULL
     WHERE client_id = '0ca3568b-5400-4ae7-8ecf-3c294c89a6a4';
    UPDATE public.comandas
       SET client_id = NULL
     WHERE client_id = '0ca3568b-5400-4ae7-8ecf-3c294c89a6a4';
    DELETE FROM public.clients
     WHERE id = '0ca3568b-5400-4ae7-8ecf-3c294c89a6a4';
  END IF;

  -- 11922295180 (Sanchez): unificar mantendo PARLA - LUAN
  PERFORM pg_temp.smg_merge_client('3a74aaa4-ec0f-4d19-895c-906e7dd7580e', 'c64535fb-35d2-4cf7-938c-141d0d7e0ea1');

  -- 11955710407 (Sanchez): unificar mantendo chileno (e higienizar telefone com chars invisíveis)
  PERFORM pg_temp.smg_merge_client('a1d83175-aec0-4046-8ac4-8383e06b24ad', '4e9bd5d3-c50a-485d-9806-2fa009580480');

  -- 11958713888 (Sanchez): SAMUEL - ISRAEL é filho do ISRAEL (telefone compartilhado)
  UPDATE public.clients
     SET is_shared_phone = true
   WHERE id = '9a906603-57b9-4867-867e-295bb8be8c54';

  -- 11959926704 (Sanchez): unificar Muryllo Henrique + Lucas Henrique
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = 'b9cdc447-6645-4c72-972c-550ee92dc5b8')
     AND EXISTS (SELECT 1 FROM public.clients WHERE id = 'bc489112-7f3f-4af2-9cfb-edbe93cdcbd0') THEN
    UPDATE public.clients
       SET notes = trim(both E'\n' from concat_ws(E'\n', nullif(btrim(notes), ''), 'Cadastro unificado: Lucas Henrique'))
     WHERE id = 'bc489112-7f3f-4af2-9cfb-edbe93cdcbd0'
       AND position('Lucas Henrique' IN coalesce(notes, '')) = 0;
    PERFORM pg_temp.smg_merge_client('b9cdc447-6645-4c72-972c-550ee92dc5b8', 'bc489112-7f3f-4af2-9cfb-edbe93cdcbd0');
  END IF;

  -- 11977828632 (Sanchez): unificar CRISTIAN - HERON + exploid (adicionar apelido)
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = 'ced7365b-9899-46ae-b855-2ff8ddc9d0e4')
     AND EXISTS (SELECT 1 FROM public.clients WHERE id = 'daf1e5d4-efa4-4dbb-96f3-e4e6321f4f40') THEN
    PERFORM pg_temp.smg_merge_client('ced7365b-9899-46ae-b855-2ff8ddc9d0e4', 'daf1e5d4-efa4-4dbb-96f3-e4e6321f4f40');
    UPDATE public.clients
       SET name = 'CRISTIAN - HERON (exploid)',
           notes = trim(both E'\n' from concat_ws(E'\n', nullif(btrim(notes), ''), 'Apelido: exploid'))
     WHERE id = 'daf1e5d4-efa4-4dbb-96f3-e4e6321f4f40'
       AND position('exploid' IN coalesce(name, '')) = 0;
  END IF;

  -- 11978007465 (Sanchez): unificar WEVERTON NASTI + ALEMÃO LU
  IF EXISTS (SELECT 1 FROM public.clients WHERE id = '277cf7a6-87a7-45c1-9903-c9ca734ddecf')
     AND EXISTS (SELECT 1 FROM public.clients WHERE id = 'f4dccb74-98e2-4be8-8c7b-5692e3341667') THEN
    UPDATE public.clients
       SET notes = trim(both E'\n' from concat_ws(E'\n', nullif(btrim(notes), ''), 'Cadastro unificado: ALEMÃO LU'))
     WHERE id = 'f4dccb74-98e2-4be8-8c7b-5692e3341667'
       AND position('ALEMÃO LU' IN coalesce(notes, '')) = 0;
    PERFORM pg_temp.smg_merge_client('277cf7a6-87a7-45c1-9903-c9ca734ddecf', 'f4dccb74-98e2-4be8-8c7b-5692e3341667');
  END IF;

  -- 11980176863 (Sanchez): unificar mantendo BLESSED ALEMÃO
  PERFORM pg_temp.smg_merge_client('03904dcc-b321-49df-89d9-8f539b65f6e4', 'b0d9ee68-0c45-4e8a-bfab-0fd55edacc86');

  -- 11994496447 (Sanchez): PIETRO é filho do ELVINHO; ANDERSON LUIS sem ligação (limpa telefone)
  UPDATE public.clients
     SET is_shared_phone = true
   WHERE id = '196bd3ad-1a50-4bdc-ab5f-79256a56ad70';

  UPDATE public.clients
     SET phone = NULL,
         notes = trim(both E'\n' from concat_ws(E'\n', nullif(btrim(notes), ''), 'Telefone +5511994496447 removido no saneamento (sem ligação com titular)'))
   WHERE id = 'cea9fe19-4fa9-4a6b-b94f-40065c1e53c5'
     AND phone IS NOT NULL;

  -- 11994896450 (Sanchez): unificar mantendo LK FÉ EM DEUS
  PERFORM pg_temp.smg_merge_client('01899d11-9ccf-4137-a9ee-4c542d29a405', '33045c13-8663-4d3a-9f27-ecc50925d121');

  -- 82996138127 (Sanchez): unificar mantendo Kauan cliente- Heron
  PERFORM pg_temp.smg_merge_client('ba7a5063-54d2-41bb-8785-c9b3919fe559', '662781cf-1753-4180-a17c-8679ce3df3ae');

  -- 3B. Grupo A (13 grupos autorizados: mesmo telefone + nome/apelido similar)
  FOR v_group IN
    SELECT * FROM (VALUES
      ('8fb669d2-4cc0-4e01-a115-a7af7b62e536'::uuid, '11961142570'),
      ('8fb669d2-4cc0-4e01-a115-a7af7b62e536'::uuid, '11976844344'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11933811981'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11939043152'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11939551823'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11942312429'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11952288360'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11954218017'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11965341634'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11965743443'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11985597464'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11993128976'),
      ('b716e290-f7f6-4449-b790-5ae9dcdadcab'::uuid, '11999568363')
    ) AS g(tenant_id, canon_phone)
  LOOP
    -- Escolhe o registro principal com maior histórico de agendamentos+comandas (desempate: mais antigo)
    SELECT c.id INTO v_primary_id
      FROM public.clients c
     WHERE c.tenant_id = v_group.tenant_id
       AND public.normalize_br_phone(c.phone) = v_group.canon_phone
       AND c.is_shared_phone = false
     ORDER BY
       (
         (SELECT COUNT(*) FROM public.appointments a WHERE a.client_id = c.id) +
         (SELECT COUNT(*) FROM public.comandas cm WHERE cm.client_id = c.id)
       ) DESC,
       c.created_at ASC,
       c.id ASC
     LIMIT 1;

    IF v_primary_id IS NOT NULL THEN
      FOR v_dup_id IN
        SELECT c.id
          FROM public.clients c
         WHERE c.tenant_id = v_group.tenant_id
           AND public.normalize_br_phone(c.phone) = v_group.canon_phone
           AND c.is_shared_phone = false
           AND c.id <> v_primary_id
      LOOP
        PERFORM pg_temp.smg_merge_client(v_dup_id, v_primary_id);
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 4. Trava única definitiva por tenant + telefone normalizado (exclui placeholders e compartilhados)
CREATE UNIQUE INDEX IF NOT EXISTS clients_tenant_canon_phone_uidx
  ON public.clients (tenant_id, public.normalize_br_phone(phone))
  WHERE tenant_id IS NOT NULL
    AND public.normalize_br_phone(phone) IS NOT NULL
    AND is_shared_phone = false;

-- 5. Atualizar create_public_booking para buscar/reutilizar via normalize_br_phone (ignorando +55/55)
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_tenant_identifier TEXT,
  p_staff_id UUID,
  p_service_ids UUID[],
  p_start_time TIMESTAMPTZ,
  p_client_name TEXT,
  p_client_phone TEXT,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'extensions'
AS $$
DECLARE
  v_tenant_id UUID;
  v_settings RECORD;
  v_timezone TEXT := 'America/Sao_Paulo';
  v_appointment_id UUID;
  v_client_id UUID;
  v_clean_phone TEXT := regexp_replace(coalesce(p_client_phone, ''), '\D', '', 'g');
  v_canon_phone TEXT := public.normalize_br_phone(p_client_phone);
  v_end_time TIMESTAMPTZ;
  v_total_duration INTEGER := 0;
  v_duration_hours NUMERIC(4, 2) := 1;
  v_total_price NUMERIC(10, 2) := 0;
  v_service_names TEXT;
  v_first_service_id UUID;
  v_staff_name TEXT;
  v_comanda_id UUID;
  v_comanda_status TEXT := 'open';
  v_existing_idempotent RECORD;
  v_public_token TEXT;
  v_token_hash VARCHAR(255);
  v_token_id UUID;
  v_token_expires_at TIMESTAMPTZ;
  v_min_notice INTEGER;
BEGIN
  IF p_tenant_identifier IS NULL OR btrim(p_tenant_identifier) = '' THEN
    RAISE EXCEPTION 'tenant_required' USING ERRCODE = 'P0001';
  END IF;

  v_tenant_id := public.resolve_public_booking_tenant_id(p_tenant_identifier);

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_settings FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  v_timezone := COALESCE(v_settings.timezone, 'America/Sao_Paulo');
  v_min_notice := COALESCE(v_settings.min_booking_notice_minutes, 30);

  IF NOT COALESCE(v_settings.booking_enabled, true) THEN
    RAISE EXCEPTION 'booking_disabled' USING ERRCODE = 'P0001';
  END IF;

  -- Checagem de idempotência
  IF p_idempotency_key IS NOT NULL THEN
    SELECT a.id, a.client_id, a.staff_id, a.start_time, a.end_time, a.status, a.notes
      INTO v_existing_idempotent
      FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.idempotency_key = p_idempotency_key
     LIMIT 1;

    IF v_existing_idempotent.id IS NOT NULL THEN
      SELECT t.id, t.expires_at INTO v_token_id, v_token_expires_at
        FROM public.public_booking_tokens t
       WHERE t.appointment_id = v_existing_idempotent.id
       ORDER BY t.created_at DESC LIMIT 1;

      RETURN jsonb_build_object(
        'appointment_id', v_existing_idempotent.id,
        'client_id', v_existing_idempotent.client_id,
        'status', v_existing_idempotent.status,
        'public_token', NULL,
        'public_token_id', v_token_id,
        'expires_at', v_token_expires_at,
        'services', (
          SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
            FROM public.appointment_services aps
            JOIN public.services s ON s.id = aps.service_id
           WHERE aps.appointment_id = v_existing_idempotent.id
        ),
        'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = v_existing_idempotent.staff_id),
        'start_time', v_existing_idempotent.start_time,
        'end_time', v_existing_idempotent.end_time,
        'idempotent', true
      );
    END IF;
  END IF;

  IF p_staff_id IS NULL OR p_service_ids IS NULL OR array_length(p_service_ids, 1) = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF btrim(COALESCE(p_client_name, '')) = '' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  IF v_clean_phone !~ '^\d{10,13}$' THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Tolerância de 5 minutos na antecedência mínima para evitar falso positivo por lag de rede/relógio
  IF p_start_time < (now() + (v_min_notice || ' minutes')::interval - interval '5 minutes') THEN
    RAISE EXCEPTION 'booking_too_soon' USING ERRCODE = 'P0001';
  END IF;

  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date + COALESCE(v_settings.booking_horizon_days, 30) THEN
    RAISE EXCEPTION 'booking_too_far' USING ERRCODE = 'P0001';
  END IF;

  -- Obter nome do profissional
  SELECT st.name INTO v_staff_name
    FROM public.staff st
   WHERE st.id = p_staff_id
     AND st.tenant_id = v_tenant_id
     AND st.status = 'active'
     AND lower(st.role) IN ('barber', 'manager');

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Calcular total de duração, preço, nomes e primeiro serviço
  SELECT
    COALESCE(SUM(s.duration), 0),
    COALESCE(SUM(s.price), 0),
    string_agg(s.name, ', ' ORDER BY ord.ordinality),
    (ARRAY_AGG(s.id ORDER BY ord.ordinality))[1]
  INTO v_total_duration, v_total_price, v_service_names, v_first_service_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  IF v_total_duration = 0 THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  v_duration_hours := ROUND((v_total_duration::numeric / 60.0), 2);
  v_end_time := p_start_time + (v_total_duration || ' minutes')::interval;

  -- Trava transacional de concorrência por profissional
  PERFORM pg_advisory_xact_lock(hashtextextended(v_tenant_id::text || ':' || p_staff_id::text, 0));

  -- Verificar colisão com agendamentos existentes
  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND a.staff_id = p_staff_id
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
       AND a.end_time > a.start_time
       AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'slot_occupied' USING ERRCODE = '23P01';
  END IF;

  -- Rate limit por telefone normalizado (máx 1 agendamento a cada 2 minutos pelo portal web)
  IF EXISTS (
    SELECT 1 FROM public.appointments a
     WHERE a.tenant_id = v_tenant_id
       AND (
         (v_canon_phone IS NOT NULL AND public.normalize_br_phone(a.client_phone) = v_canon_phone)
         OR (v_canon_phone IS NULL AND regexp_replace(coalesce(a.client_phone, ''), '\D', '', 'g') = v_clean_phone)
       )
       AND a.source = 'booking_web'
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
       AND a.created_at > now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  -- Obter cliente existente pelo telefone canônico (prioriza titular não compartilhado, sem sobrescrever nome)
  IF v_canon_phone IS NOT NULL THEN
    SELECT id INTO v_client_id
      FROM public.clients c
     WHERE c.tenant_id = v_tenant_id
       AND public.normalize_br_phone(c.phone) = v_canon_phone
     ORDER BY c.is_shared_phone ASC, c.created_at ASC
     LIMIT 1;
  ELSE
    SELECT id INTO v_client_id
      FROM public.clients c
     WHERE c.tenant_id = v_tenant_id
       AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_clean_phone
     ORDER BY c.created_at ASC
     LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    BEGIN
      INSERT INTO public.clients (tenant_id, name, phone)
      VALUES (v_tenant_id, btrim(p_client_name), COALESCE(v_canon_phone, v_clean_phone))
      RETURNING id INTO v_client_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_client_id
        FROM public.clients c
       WHERE c.tenant_id = v_tenant_id
         AND public.normalize_br_phone(c.phone) = v_canon_phone
       ORDER BY c.is_shared_phone ASC, c.created_at ASC
       LIMIT 1;
    END;
  END IF;

  -- Inserir agendamento com dados completos de serviço e valor
  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, staff_id, client_name, client_phone,
    service_name, staff_name, start_time, end_time, duration, price,
    status, source, channel, notes, idempotency_key
  ) VALUES (
    v_tenant_id, v_client_id, v_first_service_id, p_staff_id, btrim(p_client_name), COALESCE(v_canon_phone, v_clean_phone),
    COALESCE(v_service_names, ''), COALESCE(v_staff_name, ''), p_start_time, v_end_time, v_duration_hours, v_total_price,
    CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'booking_web', 'site', p_notes, p_idempotency_key
  ) RETURNING id INTO v_appointment_id;

  -- Inserir tabela associativa de serviços
  INSERT INTO public.appointment_services (
    tenant_id, appointment_id, service_id, unit_price, duration_minutes, quantity, sort_order
  )
  SELECT
    v_tenant_id, v_appointment_id, s.id, s.price, s.duration, 1, ord.ordinality
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  -- Criação automática da comanda vinculada ao agendamento
  IF (p_start_time AT TIME ZONE v_timezone)::date > (CURRENT_TIMESTAMP AT TIME ZONE v_timezone)::date THEN
    v_comanda_status := 'blocked';
  ELSE
    v_comanda_status := 'open';
  END IF;

  INSERT INTO public.comandas (
    tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key
  ) VALUES (
    v_tenant_id, v_appointment_id, v_client_id, p_staff_id, v_comanda_status, v_total_price, p_idempotency_key
  ) RETURNING id INTO v_comanda_id;

  -- Inserir itens da comanda
  INSERT INTO public.comanda_items (
    tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id
  )
  SELECT
    v_tenant_id,
    v_comanda_id,
    s.id,
    s.name,
    1,
    s.price,
    p_staff_id
  FROM public.services s
  JOIN unnest(p_service_ids) WITH ORDINALITY AS ord(val, ordinality) ON s.id = ord.val
  WHERE s.tenant_id = v_tenant_id
    AND s.active = true;

  -- Gerar token público de consulta/cancelamento
  v_public_token := encode(extensions.gen_random_bytes(32), 'base64');
  v_token_hash := encode(extensions.digest(btrim(v_public_token), 'sha256'), 'hex');
  v_token_expires_at := v_end_time + interval '30 days';

  INSERT INTO public.public_booking_tokens (
    tenant_id, appointment_id, token_hash, expires_at
  ) VALUES (
    v_tenant_id, v_appointment_id, v_token_hash, v_token_expires_at
  ) RETURNING id INTO v_token_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'client_id', v_client_id,
    'status', CASE WHEN COALESCE(v_settings.auto_confirm_online_bookings, true) THEN 'confirmed' ELSE 'pending' END,
    'public_token', v_public_token,
    'public_token_id', v_token_id,
    'expires_at', v_token_expires_at,
    'services', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('service_id', s.id, 'name', s.name, 'duration', aps.duration_minutes, 'price', aps.unit_price) ORDER BY aps.sort_order), '[]'::jsonb)
        FROM public.appointment_services aps
        JOIN public.services s ON s.id = aps.service_id
       WHERE aps.appointment_id = v_appointment_id
    ),
    'staff', (SELECT jsonb_build_object('id', st.id, 'name', st.name) FROM public.staff st WHERE st.id = p_staff_id),
    'start_time', p_start_time,
    'end_time', v_end_time,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(TEXT, UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- 6. Atualizar create_site_sanchez_appointment para buscar/reutilizar via normalize_br_phone
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
SET search_path TO 'public'
AS $$
DECLARE
  v_schema TEXT := lower(coalesce(nullif(btrim(p_domain_schema), ''), 'public'));
  v_client_id UUID;
  v_client_name TEXT := nullif(btrim(coalesce(p_client_name, '')), '');
  v_clean_phone TEXT := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_canon_phone TEXT := public.normalize_br_phone(p_phone);
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
  IF v_schema != 'public' THEN
    RAISE EXCEPTION 'Schema de domínio invalido para esta migration corretiva. Apenas ''public'' e suportado. Recebido: %', v_schema;
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
    UPDATE public.appointments a
       SET status = 'cancelled',
           cancellation_reason = coalesce(nullif(to_jsonb(a)->>'cancellation_reason', ''), CASE WHEN v_status = 'rescheduled' THEN 'rescheduled_from_site_sanchez' ELSE 'cancelled_from_site_sanchez' END),
           cancelled_at = coalesce(nullif(to_jsonb(a)->>'cancelled_at', '')::timestamptz, now())
     WHERE a.tenant_id = p_tenant_id
       AND a.source = 'site_sanchez'
       AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show', 'completed')
       AND (
         a.external_id = v_site_appointment_id
         OR a.external_id = v_external_id
         OR (v_external_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' AND a.id = v_external_id::uuid)
       )
     RETURNING a.id INTO v_appointment_id;

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

  SELECT s.name,
         coalesce(nullif(to_jsonb(s)->>'price', '')::numeric, 0),
         coalesce(
           nullif(to_jsonb(s)->>'duration_minutes', '')::numeric,
           nullif(to_jsonb(s)->>'duration', '')::numeric,
           30
         )
    INTO v_service_name, v_service_price, v_service_duration_minutes
    FROM public.services s
   WHERE s.id = p_service_id
     AND s.tenant_id = p_tenant_id
     AND coalesce(
       nullif(to_jsonb(s)->>'is_active', '')::boolean,
       nullif(to_jsonb(s)->>'active', '')::boolean,
       true
     ) = true
   LIMIT 1;

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

  -- Buscar/reutilizar cliente existente via telefone canônico
  IF v_canon_phone IS NOT NULL THEN
    SELECT id INTO v_client_id
      FROM public.clients c
     WHERE c.tenant_id = p_tenant_id
       AND public.normalize_br_phone(c.phone) = v_canon_phone
     ORDER BY c.is_shared_phone ASC, c.created_at ASC
     LIMIT 1;
  ELSE
    SELECT id INTO v_client_id
      FROM public.clients c
     WHERE c.tenant_id = p_tenant_id
       AND regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_clean_phone
     ORDER BY c.created_at ASC
     LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    BEGIN
      INSERT INTO public.clients (tenant_id, name, phone)
      VALUES (p_tenant_id, v_client_name, coalesce(v_canon_phone, v_clean_phone))
      RETURNING id INTO v_client_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_client_id
        FROM public.clients c
       WHERE c.tenant_id = p_tenant_id
         AND public.normalize_br_phone(c.phone) = v_canon_phone
       ORDER BY c.is_shared_phone ASC, c.created_at ASC
       LIMIT 1;
    END;
  END IF;

  SELECT a.id INTO v_conflict_id
    FROM public.appointments a
   WHERE a.tenant_id = p_tenant_id
     AND a.staff_id = p_professional_id
     AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
     AND tstzrange(
       a.start_time,
       coalesce(nullif(to_jsonb(a)->>'end_time', '')::timestamptz, a.start_time + (coalesce(nullif(to_jsonb(a)->>'duration', '')::numeric, 1) * interval '1 hour')),
       '[)'
     ) && tstzrange(v_start_time, v_end_time, '[)')
   LIMIT 1;

  IF v_conflict_id IS NOT NULL THEN
    RAISE EXCEPTION 'Horario indisponivel para este profissional' USING ERRCODE = '23P01';
  END IF;

  INSERT INTO public.appointments (
    tenant_id, client_id, service_id, staff_id, client_name, client_phone,
    service_name, staff_name, start_time, end_time, duration, price,
    status, source, channel, external_source, external_id, notes
  )
  VALUES (
    p_tenant_id, v_client_id, p_service_id, p_professional_id, v_client_name, coalesce(v_canon_phone, v_clean_phone),
    v_service_name, v_staff_name, v_start_time, v_end_time, v_duration_hours, v_service_price,
    'confirmed', 'site_sanchez', 'site', 'site_sanchez', v_external_id, nullif(btrim(coalesce(p_notes, '')), '')
  )
  RETURNING id INTO v_appointment_id;

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

REVOKE ALL ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_site_sanchez_appointment(UUID, TEXT, TEXT, UUID, UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- 7. Atualizar import_clients_batch para detectar duplicidade pelo telefone canônico
CREATE OR REPLACE FUNCTION public.import_clients_batch(p_job_id UUID, p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tenant_id UUID;
  v_job RECORD;
  v_row RECORD;
  v_imported INTEGER := 0;
  v_skipped INTEGER := 0;
  v_total INTEGER := 0;
  v_phone TEXT;
  v_canon_phone TEXT;
  v_existing_client RECORD;
  v_imported_id UUID;
  v_error_msg TEXT;
BEGIN
  IF p_job_id IS NULL THEN
    RAISE EXCEPTION 'job_id e obrigatorio';
  END IF;

  v_tenant_id := public.current_tenant_id_from_auth_uid();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant nao identificado';
  END IF;

  IF jsonb_array_length(p_rows) > 5000 THEN
    RAISE EXCEPTION 'Limite de 5000 linhas por importacao excedido';
  END IF;
  IF pg_column_size(p_rows) > 5 * 1024 * 1024 THEN
    RAISE EXCEPTION 'Tamanho do lote excede 5 MB';
  END IF;

  UPDATE public.import_jobs
     SET status = 'processing'
   WHERE id = p_job_id
     AND tenant_id = (SELECT public.current_tenant_id_from_auth_uid())
     AND status = 'pending'
   RETURNING * INTO v_job;

  IF NOT FOUND THEN
    SELECT * INTO v_job
      FROM public.import_jobs
     WHERE id = p_job_id
       AND tenant_id = (SELECT public.current_tenant_id_from_auth_uid());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Job de importacao nao encontrado ou acesso negado';
    END IF;

    RETURN jsonb_build_object(
      'jobId', p_job_id,
      'totalRows', v_job.total_rows,
      'importedRows', v_job.imported_rows,
      'skippedRows', v_job.skipped_rows,
      'message', 'Job já processado anteriormente'
    );
  END IF;

  FOR v_row IN
    SELECT * FROM jsonb_array_elements(p_rows) AS elem(row_data)
  LOOP
    v_total := v_total + 1;
    v_phone := (v_row.row_data ->> 'phone')::TEXT;
    v_canon_phone := public.normalize_br_phone(v_phone);

    SELECT id INTO v_existing_client
      FROM public.clients
     WHERE tenant_id = v_tenant_id
       AND (
         (v_canon_phone IS NOT NULL AND public.normalize_br_phone(phone) = v_canon_phone)
         OR (v_canon_phone IS NULL AND phone = v_phone)
       )
     LIMIT 1;

    IF FOUND THEN
      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, error_message
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'skipped',
        'Duplicata candidata: telefone ja cadastrado no tenant'
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;

      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.clients (
        tenant_id, name, email, phone, birthday, avatar, status, created_at
      ) VALUES (
        v_tenant_id,
        (v_row.row_data ->> 'name')::TEXT,
        (v_row.row_data ->> 'email')::TEXT,
        coalesce(v_canon_phone, v_phone),
        (v_row.row_data ->> 'birthday')::TEXT,
        'https://ui-avatars.com/api/?name=' || replace((v_row.row_data ->> 'name')::TEXT, ' ', '%20') || '&background=random',
        'active',
        now()
      )
      RETURNING id INTO v_imported_id;

      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, imported_id
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'imported', v_imported_id
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;

      v_imported := v_imported + 1;

    EXCEPTION
      WHEN unique_violation THEN
        v_error_msg := 'Violacao de unicidade (telefone ou linha duplicada)';
      WHEN check_violation THEN
        v_error_msg := 'Dados invalidos (violam restricao de dominio)';
      WHEN not_null_violation THEN
        v_error_msg := 'Campo obrigatorio ausente';
      WHEN OTHERS THEN
        v_error_msg := 'Erro interno ao processar linha';
    END;

    IF v_error_msg IS NOT NULL THEN
      INSERT INTO public.import_rows (
        import_job_id, tenant_id, row_number, raw_data, status, error_message
      ) VALUES (
        p_job_id, v_tenant_id, v_total, v_row.row_data, 'error', v_error_msg
      )
      ON CONFLICT (tenant_id, import_job_id, row_number) DO NOTHING;

      v_skipped := v_skipped + 1;
      v_error_msg := NULL;
    END IF;
  END LOOP;

  UPDATE public.import_jobs
     SET status = CASE
           WHEN v_skipped = 0 THEN 'completed'
           WHEN v_imported = 0 THEN 'failed'
           ELSE 'partial'
         END,
         imported_rows = v_imported,
         skipped_rows = v_skipped,
         total_rows = v_total,
         completed_at = now()
   WHERE id = p_job_id;

  RETURN jsonb_build_object(
    'jobId', p_job_id,
    'totalRows', v_total,
    'importedRows', v_imported,
    'skippedRows', v_skipped
  );
END;
$$;

REVOKE ALL ON FUNCTION public.import_clients_batch(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_clients_batch(UUID, JSONB) TO authenticated;
