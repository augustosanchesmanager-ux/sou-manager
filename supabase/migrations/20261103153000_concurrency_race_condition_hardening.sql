-- ============================================================================
-- Migration: 20261103153000_concurrency_race_condition_hardening.sql
-- Description: Hardening contra condições de corrida (Race Conditions)
--   1. Criação do índice parcial UNIQUE idx_comandas_single_voucher_usage.
--   2. Hardening com FOR UPDATE em public.accept_invite.
--   3. Hardening com FOR UPDATE em public.approve_access_request.
--   4. Hardening com FOR UPDATE em public.register_comanda_payment.
--   5. Hardening com FOR UPDATE em public.reverse_comanda_payment.
--   6. Hardening de concorrência com advisory lock e checagem de sobreposição
--      em public.create_appointment_with_comanda e public.create_appointment_with_services.
-- ============================================================================

BEGIN;

-- ── 1. Constraint Única: Impede que duas comandas fechadas usem o mesmo voucher ──
CREATE UNIQUE INDEX IF NOT EXISTS idx_comandas_single_voucher_usage
  ON public.comandas (tenant_id, voucher_id)
  WHERE voucher_id IS NOT NULL AND status IN ('paid', 'closed');

-- ── 2. Hardening em accept_invite (FOR UPDATE) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_invite(
  p_token text,
  p_first_name text,
  p_last_name text
)
RETURNS TABLE(
  tenant_id uuid,
  role text,
  staff_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_invite record;
  v_user_email text;
  v_full_name text;
  v_commission int;
  v_staff_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock pessimista na linha do convite para impedir duplo aceite concorrente
  SELECT t.id, t.tenant_id, t.email, t.role, t.status, t.expires_at
  INTO v_invite
  FROM public.team_invitations t
  WHERE t.token = p_token
  FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invite not found';
  END IF;

  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Invite already accepted';
  ELSIF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Invite has been revoked';
  ELSIF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    UPDATE public.team_invitations
    SET status = 'expired', updated_at = now()
    WHERE id = v_invite.id;
    RAISE EXCEPTION 'Invite has expired';
  END IF;

  -- Email do convite deve ser o email do usuario autenticado
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  IF lower(trim(coalesce(v_user_email, ''))) <> lower(trim(v_invite.email)) THEN
    RAISE EXCEPTION 'Invite was sent to a different email. Sign in with the invited email address.';
  END IF;

  -- Usuario ja membro do tenant?
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.tenant_id = v_invite.tenant_id
  ) THEN
    RAISE EXCEPTION 'You are already a member of this team';
  END IF;

  -- Multi-tenant membership: nao pode reassignar perfil/staff que ja pertence
  -- a outro tenant (evita clobber em aceites de contas ja ativas em outro lugar).
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.tenant_id IS DISTINCT FROM v_invite.tenant_id
  ) THEN
    RAISE EXCEPTION 'Your account already belongs to another team. Sign in with the invited email or contact support.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.id = auth.uid() AND s.tenant_id IS DISTINCT FROM v_invite.tenant_id
  ) THEN
    RAISE EXCEPTION 'Your account already belongs to another team. Sign in with the invited email or contact support.';
  END IF;

  v_full_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  IF v_full_name = '' THEN
    v_full_name := split_part(v_invite.email, '@', 1);
  END IF;

  v_commission := CASE WHEN v_invite.role = 'barber' THEN 50 ELSE 0 END;

  -- Mutação atômica condicional
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invite.id AND status = 'pending';

  -- profiles
  INSERT INTO public.profiles (id, tenant_id, full_name, role, status, onboarding_completed)
  VALUES (auth.uid(), v_invite.tenant_id, v_full_name, v_invite.role, 'active', true)
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = EXCLUDED.tenant_id,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    onboarding_completed = true;

  INSERT INTO public.staff (id, name, email, phone, role, avatar, commission_rate, status, tenant_id)
  VALUES (
    auth.uid(),
    v_full_name,
    v_invite.email,
    '',
    v_invite.role,
    'https://ui-avatars.com/api/?name=' || REPLACE(v_full_name, ' ', '+') || '&background=0066ff&color=fff',
    v_commission,
    'active',
    v_invite.tenant_id
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    commission_rate = EXCLUDED.commission_rate,
    status = EXCLUDED.status,
    tenant_id = EXCLUDED.tenant_id;

  v_staff_id := auth.uid();

  DELETE FROM public.user_tenants
  WHERE user_tenants.user_id = auth.uid()
    AND user_tenants.tenant_id = v_invite.tenant_id;

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (auth.uid(), v_invite.tenant_id, v_invite.role, false);

  RETURN QUERY
  SELECT v_invite.tenant_id, v_invite.role, v_staff_id;
END;
$function$;

-- ── 3. Hardening em approve_access_request (FOR UPDATE) ──────────────────────
CREATE OR REPLACE FUNCTION public.approve_access_request(p_request_id UUID)
RETURNS VOID AS $$
DECLARE
  v_request RECORD;
  v_tenant_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.current_is_super_admin_from_auth_uid() THEN
    RAISE EXCEPTION 'Insufficient permissions: superadmin required to approve access requests';
  END IF;

  -- Lock pessimista no pedido de acesso
  SELECT * FROM public.access_requests INTO v_request WHERE id = p_request_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_request.status = 'approved' THEN
    RAISE EXCEPTION 'Pedido já aprovado';
  END IF;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, slug)
  VALUES (v_request.tenant_name, lower(regexp_replace(v_request.tenant_name, '[^a-zA-Z0-9]+', '-', 'g')))
  RETURNING id INTO v_tenant_id;

  -- 2. Atualizar pedido atomicamente
  UPDATE public.access_requests
  SET status = 'approved',
      updated_at = now()
  WHERE id = p_request_id AND status <> 'approved';

  -- 3. Create initial notification for the new tenant
  INSERT INTO public.notifications (tenant_id, type, title, description)
  VALUES (v_tenant_id, 'system_alert', 'Bem-vindo!', 'Sua barbearia foi ativada com sucesso. Comece configurando seu time e serviços.');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'auth';

-- ── 4. Hardening em register_comanda_payment (FOR UPDATE na comanda) ─────────
CREATE OR REPLACE FUNCTION public.register_comanda_payment(
  p_tenant_id       UUID,
  p_comanda_id      UUID,
  p_payment_type    public.payment_type,
  p_amount          NUMERIC,
  p_payment_method  TEXT DEFAULT NULL,
  p_motivo          TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid       UUID := auth.uid();
  v_comanda        public.comandas%ROWTYPE;
  v_existing       public.comanda_payments%ROWTYPE;
  v_is_super_admin BOOLEAN;
  v_access_role    TEXT;
  v_membership_role TEXT;
  v_normalized_role TEXT;
  v_can_register   BOOLEAN := false;
  v_total_paid     NUMERIC;
  v_count_paid     BIGINT;
BEGIN
  -- ── Auth + validation ──
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_id IS NULL THEN RAISE EXCEPTION 'comanda_id obrigatorio'; END IF;
  IF p_payment_type IS NULL THEN RAISE EXCEPTION 'payment_type obrigatorio'; END IF;
  IF COALESCE(p_amount, 0) <= 0 THEN RAISE EXCEPTION 'Valor deve ser maior que zero'; END IF;

  -- ── Role gate: recepção + gestão ──
  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;
  SELECT LOWER(BTRIM(COALESCE(p2.role, ''))) INTO v_access_role
  FROM public.profiles p2 WHERE p2.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  v_normalized_role := COALESCE(NULLIF(v_access_role, ''), v_membership_role, '');

  -- Management: owner/admin/manager/gerente/superadmin
  IF COALESCE(v_is_super_admin, false)
     OR v_normalized_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin', 'super admin')
     OR v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
  THEN
    v_can_register := true;
  END IF;

  -- Reception: receptionist
  IF NOT v_can_register AND v_normalized_role = 'receptionist' THEN
    v_can_register := true;
  END IF;

  IF NOT v_can_register THEN
    RAISE EXCEPTION 'Usuario sem permissao para registrar pagamento';
  END IF;

  -- ── Load comanda com lock FOR UPDATE para serializar pagamentos concorrentes ──
  SELECT * INTO v_comanda FROM public.comandas
  WHERE id = p_comanda_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comanda nao encontrada para este tenant';
  END IF;

  IF v_comanda.status IN ('cancelled', 'paid') THEN
    RAISE EXCEPTION 'Comanda com status "%" nao pode receber pagamento', v_comanda.status;
  END IF;

  -- ── Idempotency check ──
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.comanda_payments
    WHERE tenant_id = p_tenant_id
      AND idempotency_key = p_idempotency_key
      AND reversed_at IS NULL
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'comanda_payment_id', v_existing.id,
        'message', 'Pagamento ja registrado anteriormente.'
      );
    END IF;
  END IF;

  -- ── Validate total doesn't exceed comanda total ──
  SELECT COUNT(*), COALESCE(SUM(amount), 0)
  INTO v_count_paid, v_total_paid
  FROM public.comanda_payments
  WHERE comanda_id = p_comanda_id
    AND tenant_id = p_tenant_id
    AND reversed_at IS NULL;

  -- Allow small floating-point tolerance (0.01)
  IF (v_total_paid + p_amount) > (COALESCE(v_comanda.total, 0) + 0.01) THEN
    RAISE EXCEPTION 'Total de pagamentos (R$ %) excede o total da comanda (R$ %)',
      v_total_paid + p_amount, COALESCE(v_comanda.total, 0);
  END IF;

  -- ── Insert payment ──
  INSERT INTO public.comanda_payments (
    tenant_id, comanda_id, payment_type, amount,
    payment_method, actor_id, motivo, idempotency_key
  ) VALUES (
    p_tenant_id, p_comanda_id, p_payment_type, p_amount,
    p_payment_method, v_auth_uid, p_motivo, p_idempotency_key
  );

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_id', p_comanda_id,
    'payment_type', p_payment_type::text,
    'amount', p_amount,
    'total_paid', v_total_paid + p_amount,
    'comanda_total', COALESCE(v_comanda.total, 0),
    'remaining', COALESCE(v_comanda.total, 0) - (v_total_paid + p_amount),
    'message', 'Pagamento registrado com sucesso.'
  );
END;
$$;

-- ── 5. Hardening em reverse_comanda_payment (FOR UPDATE + atômico) ───────────
CREATE OR REPLACE FUNCTION public.reverse_comanda_payment(
  p_tenant_id        UUID,
  p_comanda_payment_id UUID,
  p_motivo           TEXT,
  p_refund_method    TEXT DEFAULT 'internal_credit',
  p_actor_id         UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_uid    UUID := auth.uid();
  v_payment     public.comanda_payments%ROWTYPE;
  v_access_role TEXT;
  v_membership_role TEXT;
  v_is_super_admin BOOLEAN;
BEGIN
  -- ── Auth + role gate ──
  IF v_auth_uid IS NULL THEN RAISE EXCEPTION 'Usuario autenticado obrigatorio'; END IF;
  IF p_tenant_id IS NULL THEN RAISE EXCEPTION 'tenant_id obrigatorio'; END IF;
  IF p_comanda_payment_id IS NULL THEN RAISE EXCEPTION 'comanda_payment_id obrigatorio'; END IF;
  IF p_motivo IS NULL OR BTRIM(p_motivo) = '' THEN
    RAISE EXCEPTION 'Motivo obrigatorio para reversao de pagamento';
  END IF;

  SELECT public.current_is_super_admin_from_auth_uid() INTO v_is_super_admin;

  -- Resolve papel via profiles + user_tenants
  SELECT LOWER(BTRIM(COALESCE(p.role, ''))) INTO v_access_role
  FROM public.profiles p WHERE p.id = v_auth_uid LIMIT 1;
  IF v_access_role IS NULL THEN
    SELECT LOWER(BTRIM(COALESCE(s.role, ''))) INTO v_access_role
    FROM public.staff s WHERE s.id = v_auth_uid LIMIT 1;
  END IF;
  SELECT LOWER(BTRIM(COALESCE(ut.role, ''))) INTO v_membership_role
  FROM public.user_tenants ut
  WHERE ut.user_id = v_auth_uid AND ut.tenant_id = p_tenant_id
  ORDER BY COALESCE(ut.is_primary, false) DESC LIMIT 1;

  IF NOT COALESCE(v_is_super_admin, false)
     AND COALESCE(v_access_role, '') NOT IN ('owner', 'admin', 'manager', 'gerente', 'superadmin')
     AND NOT COALESCE(v_membership_role IN ('owner', 'admin', 'manager', 'gerente', 'superadmin'), false)
  THEN
    RAISE EXCEPTION 'Usuario sem permissao para reversao de pagamento';
  END IF;

  -- ── Load payment com lock FOR UPDATE para impedir estorno duplo concorrente ──
  SELECT * INTO v_payment FROM public.comanda_payments
  WHERE id = p_comanda_payment_id AND tenant_id = p_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pagamento nao encontrado para este tenant';
  END IF;
  IF v_payment.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Pagamento ja foi revertido';
  END IF;

  -- ── Mark reversed (append-only e atômico) ──
  UPDATE public.comanda_payments
  SET reversed_at = now()
  WHERE id = p_comanda_payment_id AND tenant_id = p_tenant_id AND reversed_at IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'comanda_payment_id', p_comanda_payment_id,
    'comanda_id', v_payment.comanda_id,
    'amount', v_payment.amount,
    'payment_type', v_payment.payment_type::text,
    'reversed_at', now(),
    'message', 'Reversao de pagamento registrada com sucesso.'
  );
END;
$$;

-- ── 6. Hardening em create_appointment_with_comanda (Advisory Lock + Conflito)
CREATE OR REPLACE FUNCTION public.create_appointment_with_comanda(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_service_id UUID DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_price NUMERIC DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_is_overbooked BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_client_name TEXT;
  v_service_name TEXT;
  v_staff_name TEXT;
  v_service_price NUMERIC(10, 2) := 0;
  v_service_duration_minutes NUMERIC := 30;
  v_duration_hours NUMERIC(3, 1) := 1;
  v_end_time TIMESTAMPTZ;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_item_id UUID;
  v_existing_appointment JSONB;
  v_comanda_status TEXT := 'open';
  v_sub_id UUID;
  v_eligible BOOLEAN := false;
  v_reason TEXT;
  v_avail_credits INTEGER := 0;
  v_plan_preview JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido para criar agendamento';
  END IF;

  IF p_service_id IS NULL OR p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Preencha todos os campos obrigatorios';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'comanda_item_id', ci.id,
      'service_price', COALESCE(NULLIF(to_jsonb(a)->>'price', '')::numeric, 0),
      'appointment_status', a.status
    ) INTO v_existing_appointment
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    LEFT JOIN public.comanda_items ci ON ci.comanda_id = c.id AND ci.tenant_id = a.tenant_id
    WHERE a.idempotency_key = p_idempotency_key AND a.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_existing_appointment IS NOT NULL THEN
      RETURN v_existing_appointment;
    END IF;
  END IF;

  SELECT
    s.name,
    COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0),
    COALESCE(
      NULLIF(to_jsonb(s)->>'duration', '')::numeric,
      NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
      30
    )
  INTO v_service_name, v_service_price, v_service_duration_minutes
  FROM public.services s
  WHERE s.id = p_service_id AND s.tenant_id = p_tenant_id
    AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true
  LIMIT 1;

  IF v_service_name IS NULL THEN
    RAISE EXCEPTION 'Servico invalido para este tenant';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido para este tenant';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido para este tenant';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente e obrigatorio';
  END IF;

  IF p_price IS NOT NULL AND p_price >= 0 THEN
    v_service_price := p_price;
  END IF;

  v_duration_hours := ROUND((GREATEST(COALESCE(v_service_duration_minutes, 30), 1) / 60.0)::numeric, 1);
  v_end_time := p_start_time + (v_duration_hours * interval '1 hour');

  -- Concurrency check: se não for overbooking explícito, serializa via advisory lock e barra concorrência
  IF NOT COALESCE(p_is_overbooked, false) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_staff_id::text, 0));

    IF EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.tenant_id = p_tenant_id
        AND a.staff_id = p_staff_id
        AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
        AND a.end_time > a.start_time
        AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
    ) THEN
      RAISE EXCEPTION 'Horário já ocupado para este profissional.' USING ERRCODE = '23P01';
    END IF;
  END IF;

  IF p_start_time::date > current_date THEN
    v_comanda_status := 'blocked';
  END IF;

  IF p_client_id IS NOT NULL AND to_regprocedure('public.preview_plan_credit_for_service(uuid,uuid,uuid,timestamp with time zone)') IS NOT NULL THEN
    SELECT eligible, reason, available_credits, subscription_id
    INTO v_eligible, v_reason, v_avail_credits, v_sub_id
    FROM public.preview_plan_credit_for_service(p_tenant_id, p_client_id, p_service_id, p_start_time)
    LIMIT 1;

    v_plan_preview := jsonb_build_object(
      'service_id', p_service_id,
      'service_name', v_service_name,
      'subscription_id', v_sub_id,
      'eligible', v_eligible,
      'reason', v_reason,
      'available_credits', v_avail_credits,
      'checked_at', now()
    );
  END IF;

  INSERT INTO public.appointments (
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
    notes,
    status,
    idempotency_key,
    is_overbooked,
    subscription_id,
    eligible_for_plan_credit,
    expected_plan_service,
    plan_credit_preview
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    p_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_service_name,
    v_staff_name,
    p_start_time,
    v_end_time,
    v_duration_hours,
    v_service_price,
    NULLIF(BTRIM(p_notes), ''),
    'confirmed',
    p_idempotency_key,
    COALESCE(p_is_overbooked, false),
    v_sub_id,
    v_eligible,
    CASE WHEN v_eligible THEN v_service_name ELSE NULL END,
    v_plan_preview
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (tenant_id, appointment_id, client_id, staff_id, status, total, idempotency_key)
  VALUES (p_tenant_id, v_appointment_id, p_client_id, p_staff_id, v_comanda_status, v_service_price, p_idempotency_key)
  RETURNING id INTO v_comanda_id;

  INSERT INTO public.comanda_items (tenant_id, comanda_id, service_id, product_name, quantity, unit_price, staff_id)
  VALUES (p_tenant_id, v_comanda_id, p_service_id, v_service_name, 1, v_service_price, p_staff_id)
  RETURNING id INTO v_comanda_item_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'comanda_item_id', v_comanda_item_id,
    'service_price', v_service_price,
    'appointment_status', 'confirmed',
    'chef_club_eligible', v_eligible,
    'subscription_id', v_sub_id,
    'plan_credit_preview', v_plan_preview
  );
END;
$func$;

-- ── 7. Hardening em create_appointment_with_services (Advisory Lock + Conflito)
CREATE OR REPLACE FUNCTION public.create_appointment_with_services(
  p_tenant_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_client_name TEXT DEFAULT NULL,
  p_client_phone TEXT DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_start_time TIMESTAMPTZ DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_services JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_current_tenant_id UUID;
  v_is_super_admin BOOLEAN := false;
  v_client_name TEXT;
  v_staff_name TEXT;
  v_services JSONB;
  v_services_text TEXT;
  v_service_ids UUID[];
  v_service_row RECORD;
  v_first_service_id UUID;
  v_first_service_name TEXT;
  v_total_price NUMERIC(10, 2) := 0;
  v_total_duration_minutes INTEGER := 0;
  v_duration_hours NUMERIC(3, 1) := 1;
  v_end_time TIMESTAMPTZ;
  v_appointment_id UUID;
  v_comanda_id UUID;
  v_comanda_status TEXT := 'open';
  v_sort_order INTEGER := 0;
  v_existing_result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado';
  END IF;

  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  SELECT public.current_tenant_id_from_auth_uid(), public.current_is_super_admin_from_auth_uid()
  INTO v_current_tenant_id, v_is_super_admin;

  IF NOT COALESCE(v_is_super_admin, false) AND p_tenant_id <> v_current_tenant_id THEN
    RAISE EXCEPTION 'Tenant invalido';
  END IF;

  IF p_services IS NULL THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF jsonb_typeof(p_services) = 'array' THEN
    v_services := p_services;
  ELSIF jsonb_typeof(p_services) = 'object' THEN
    v_services := jsonb_build_array(p_services);
  ELSIF jsonb_typeof(p_services) = 'string' THEN
    v_services_text := NULLIF(BTRIM(p_services #>> '{}'), '');

    IF v_services_text IS NULL THEN
      v_services := NULL;
    ELSIF left(v_services_text, 1) IN ('[', '{') THEN
      BEGIN
        v_services := v_services_text::jsonb;
        IF jsonb_typeof(v_services) = 'object' THEN
          v_services := jsonb_build_array(v_services);
        END IF;
      EXCEPTION WHEN others THEN
        v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
      END;
    ELSE
      v_services := jsonb_build_array(jsonb_build_object('service_name', v_services_text));
    END IF;
  ELSE
    v_services := NULL;
  END IF;

  IF v_services IS NULL OR jsonb_array_length(v_services) = 0 THEN
    RAISE EXCEPTION 'Selecione pelo menos um servico';
  END IF;

  IF p_staff_id IS NULL OR p_start_time IS NULL THEN
    RAISE EXCEPTION 'Profissional e horario sao obrigatorios';
  END IF;

  SELECT st.name INTO v_staff_name
  FROM public.staff st
  WHERE st.id = p_staff_id
    AND st.tenant_id = p_tenant_id
    AND lower(COALESCE(st.status, 'active')) = 'active'
  LIMIT 1;

  IF v_staff_name IS NULL THEN
    RAISE EXCEPTION 'Profissional invalido';
  END IF;

  IF p_client_id IS NOT NULL THEN
    SELECT c.name INTO v_client_name
    FROM public.clients c
    WHERE c.id = p_client_id AND c.tenant_id = p_tenant_id
    LIMIT 1;

    IF v_client_name IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido';
    END IF;
  END IF;

  v_client_name := NULLIF(BTRIM(COALESCE(p_client_name, v_client_name)), '');
  IF v_client_name IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente obrigatorio';
  END IF;

  IF p_idempotency_key IS NOT NULL AND p_idempotency_key <> '' THEN
    SELECT jsonb_build_object(
      'appointment_id', a.id,
      'comanda_id', c.id,
      'total_price', COALESCE(c.total, COALESCE(a.price, 0)),
      'total_duration_minutes', GREATEST(ROUND(COALESCE(a.duration, 0) * 60)::integer, 0),
      'idempotent', true
    )
    INTO v_existing_result
    FROM public.appointments a
    LEFT JOIN public.comandas c ON c.appointment_id = a.id AND c.tenant_id = a.tenant_id
    WHERE a.tenant_id = p_tenant_id
      AND a.idempotency_key = p_idempotency_key
    LIMIT 1;

    IF v_existing_result IS NOT NULL THEN
      RETURN v_existing_result;
    END IF;
  END IF;

  WITH requested AS (
    SELECT
      ordinality::integer AS sort_order,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(elem->>'service_id', '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_key,
      CASE
        WHEN jsonb_typeof(elem) = 'object' THEN NULLIF(BTRIM(COALESCE(elem->>'service_name', elem->>'name')), '')
        WHEN jsonb_typeof(elem) = 'string' THEN trim(both '"' from elem::text)
        ELSE NULL
      END AS service_name
    FROM jsonb_array_elements(v_services) WITH ORDINALITY AS e(elem, ordinality)
  )
  SELECT array_agg(s.id ORDER BY requested.sort_order)
  INTO v_service_ids
  FROM requested
  JOIN public.services s
    ON s.tenant_id = p_tenant_id
   AND (
      (requested.service_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND s.id = requested.service_key::uuid)
      OR lower(s.name) = lower(COALESCE(requested.service_name, requested.service_key))
    )
   AND COALESCE(
      NULLIF(to_jsonb(s)->>'active', '')::boolean,
      NULLIF(to_jsonb(s)->>'is_active', '')::boolean,
      true
    ) = true;

  IF array_length(v_service_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado para este tenant';
  END IF;

  v_total_price := 0;
  v_total_duration_minutes := 0;
  v_sort_order := 0;

  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes,
      COALESCE(NULLIF(to_jsonb(s)->>'buffer', '')::numeric, 0)::integer AS buffer_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    IF v_sort_order = 0 THEN
      v_first_service_id := v_service_row.id;
      v_first_service_name := v_service_row.name;
    END IF;

    v_total_price := v_total_price + COALESCE(v_service_row.unit_price, 0);
    v_total_duration_minutes := v_total_duration_minutes
      + COALESCE(v_service_row.duration_minutes, 30)
      + COALESCE(v_service_row.buffer_minutes, 0);
    v_sort_order := v_sort_order + 1;
  END LOOP;

  IF v_first_service_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum servico valido encontrado';
  END IF;

  v_duration_hours := ROUND((GREATEST(v_total_duration_minutes, 15)::numeric / 60.0), 1);
  v_end_time := p_start_time + (v_total_duration_minutes || ' minutes')::interval;

  -- Concurrency check: serializa via advisory lock e barra concorrência na mesma vaga
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_staff_id::text, 0));

  IF EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.tenant_id = p_tenant_id
      AND a.staff_id = p_staff_id
      AND lower(coalesce(a.status, 'pending')) NOT IN ('cancelled', 'no_show')
      AND a.end_time > a.start_time
      AND tstzrange(a.start_time, a.end_time, '[)') && tstzrange(p_start_time, v_end_time, '[)')
  ) THEN
    RAISE EXCEPTION 'Horário já ocupado para este profissional.' USING ERRCODE = '23P01';
  END IF;

  IF p_start_time::date > current_date THEN
    v_comanda_status := 'blocked';
  END IF;

  INSERT INTO public.appointments (
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
    notes,
    idempotency_key
  )
  VALUES (
    p_tenant_id,
    p_client_id,
    v_first_service_id,
    p_staff_id,
    v_client_name,
    NULLIF(BTRIM(p_client_phone), ''),
    v_first_service_name,
    v_staff_name,
    p_start_time,
    v_end_time,
    v_duration_hours,
    v_total_price,
    'confirmed',
    NULLIF(BTRIM(p_notes), ''),
    p_idempotency_key
  )
  RETURNING id INTO v_appointment_id;

  INSERT INTO public.comandas (
    tenant_id,
    appointment_id,
    client_id,
    staff_id,
    status,
    total,
    idempotency_key
  )
  VALUES (
    p_tenant_id,
    v_appointment_id,
    p_client_id,
    p_staff_id,
    v_comanda_status,
    v_total_price,
    p_idempotency_key
  )
  RETURNING id INTO v_comanda_id;

  v_sort_order := 0;

  FOR v_service_row IN
    SELECT
      s.id,
      s.name,
      COALESCE(NULLIF(to_jsonb(s)->>'price', '')::numeric, 0) AS unit_price,
      COALESCE(
        NULLIF(to_jsonb(s)->>'duration', '')::numeric,
        NULLIF(to_jsonb(s)->>'duration_minutes', '')::numeric,
        30
      )::integer AS duration_minutes
    FROM unnest(v_service_ids) WITH ORDINALITY AS ids(service_id, ordinality)
    JOIN public.services s ON s.id = ids.service_id
    WHERE s.tenant_id = p_tenant_id
    ORDER BY ids.ordinality
  LOOP
    INSERT INTO public.comanda_items (
      tenant_id,
      comanda_id,
      service_id,
      product_name,
      quantity,
      unit_price,
      staff_id
    )
    VALUES (
      p_tenant_id,
      v_comanda_id,
      v_service_row.id,
      v_service_row.name,
      1,
      v_service_row.unit_price,
      p_staff_id
    );

    IF to_regclass('public.appointment_services') IS NOT NULL THEN
      INSERT INTO public.appointment_services (
        tenant_id,
        appointment_id,
        service_id,
        unit_price,
        duration_minutes,
        quantity,
        sort_order
      )
      VALUES (
        p_tenant_id,
        v_appointment_id,
        v_service_row.id,
        v_service_row.unit_price,
        v_service_row.duration_minutes,
        1,
        v_sort_order
      );
    END IF;

    v_sort_order := v_sort_order + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'appointment_id', v_appointment_id,
    'comanda_id', v_comanda_id,
    'total_price', v_total_price,
    'total_duration_minutes', v_total_duration_minutes,
    'idempotent', false
  );
END;
$func$;

COMMIT;
