-- =====================================================
-- PHASE 6.0.4.3 (PARTE 1) — FIX DO PADRÃO DE AUTORIZAÇÃO
-- =====================================================
-- Root cause:
--   staff.id = gen_random_uuid() para o manager/owner INICIAL (o trigger
--   handle_new_manager_profile e o backfill não definem id = auth.uid());
--   apenas accept_invite (6.0.3) define staff.id = auth.uid(). Logo, o
--   padrão `s.id = auth.uid()` usado nas policies RLS e RPCs de Billing
--   (6.0.4.2) e Convites (6.0.3) autorizava SOMENTE superadmin — gestores
--   reais eram bloqueados (ex.: start_trial falharia no complete_onboarding).
--
-- Fix:
--   Checar o papel via profiles (p.id = auth.uid(), p.status='active',
--   p.role IN ('owner','manager','admin')) — o MESMO vínculo usado por
--   current_tenant_id_from_auth_uid() e pela guard do complete_onboarding.
--   Centralizado no helper SECURITY DEFINER current_is_tenant_manager_from_auth_uid.
--
-- Escopo (aprovado pelo PO em 2026-08-06):
--   Billing 6.0.4.2: 4 policies + 3 RPCs (start_trial/activate/cancel)
--   Convites 6.0.3 : 2 policies + 5 RPCs (upsert/reset role_permissions,
--                   invite/revoke/resend/list team invitations)
--
-- Padrão: idempotente (DROP IF EXISTS / CREATE OR REPLACE).
-- =====================================================

-- =====================================================
-- 1) HELPER — current_is_tenant_manager_from_auth_uid
-- =====================================================
-- Gestor ativo do tenant (owner/manager/admin) OU superadmin.
CREATE OR REPLACE FUNCTION public.current_is_tenant_manager_from_auth_uid(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.tenant_id = p_tenant_id
        AND p.status = 'active'
        AND p.role IN ('owner', 'manager', 'admin')
    );
$function$;

REVOKE EXECUTE ON FUNCTION public.current_is_tenant_manager_from_auth_uid(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_is_tenant_manager_from_auth_uid(uuid) TO authenticated;

-- =====================================================
-- 2) BILLING (6.0.4.2) — POLICIES
-- =====================================================

DROP POLICY IF EXISTS "subscriptions_select_tenant" ON public.subscriptions;
CREATE POLICY "subscriptions_select_tenant" ON public.subscriptions FOR SELECT
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

DROP POLICY IF EXISTS "invoices_select_tenant" ON public.invoices;
CREATE POLICY "invoices_select_tenant" ON public.invoices FOR SELECT
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

DROP POLICY IF EXISTS "billing_events_select_tenant" ON public.billing_events;
CREATE POLICY "billing_events_select_tenant" ON public.billing_events FOR SELECT
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

DROP POLICY IF EXISTS "payment_attempts_select_tenant" ON public.payment_attempts;
CREATE POLICY "payment_attempts_select_tenant" ON public.payment_attempts FOR SELECT
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

-- =====================================================
-- 3) BILLING (6.0.4.2) — RPCS
-- =====================================================

-- 3.0 record_billing_event — guard de autenticacao (era anon-callable e sem guard;
-- a plataforma Supabase auto-concede EXECUTE a anon em toda criacao de funcao)
CREATE OR REPLACE FUNCTION public.record_billing_event(
  p_tenant_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.billing_events (tenant_id, event_type, payload)
  VALUES (p_tenant_id, p_event_type, p_payload);
END;
$function$;

-- 3.1 start_trial
CREATE OR REPLACE FUNCTION public.start_trial(
  p_tenant_id uuid,
  p_plan text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_status text;
  v_tenant_plan text;
  v_tenant_created timestamptz;
  v_sub_id uuid;
  v_sub_status text;
  v_trial_end timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT t.status, t.plan, t.created_at
  INTO v_tenant_status, v_tenant_plan, v_tenant_created
  FROM public.tenants t
  WHERE t.id = p_tenant_id;

  IF v_tenant_status IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  -- Chamador: superadmin ou gestor ativo do tenant (owner/manager/admin)
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to start trial';
  END IF;

  -- Idempotência: devolve a subscription ativa existente (se houver)
  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
    AND s.status IN ('trialing', 'active', 'past_due')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    RETURN QUERY
    SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
           s.current_period_start, s.current_period_end
    FROM public.subscriptions s
    WHERE s.id = v_sub_id;
    RETURN;
  END IF;

  -- Status da subscription derivado do status do tenant (defensivo p/ tenants legados)
  v_sub_status := CASE
    WHEN v_tenant_status IN ('trial', 'draft') THEN 'trialing'
    WHEN v_tenant_status = 'active' THEN 'active'
    WHEN v_tenant_status = 'past_due' THEN 'past_due'
    ELSE 'trialing'
  END;

  -- Trial: 14 dias a partir do provisionamento (D3)
  v_trial_end := v_tenant_created + interval '14 days';

  INSERT INTO public.subscriptions AS sub (
    tenant_id, plan, status, trial_started_at, trial_ends_at,
    current_period_start, current_period_end
  )
  VALUES (
    p_tenant_id,
    COALESCE(NULLIF(p_plan, ''), v_tenant_plan, 'free'),
    v_sub_status,
    v_tenant_created,
    v_trial_end,
    v_tenant_created,
    v_trial_end
  )
  RETURNING sub.id INTO v_sub_id;

  -- F10: draft -> trial (nunca draft -> active direto)
  IF v_tenant_status = 'draft' THEN
    UPDATE public.tenants
    SET status = 'trial', updated_at = now()
    WHERE id = p_tenant_id;
  END IF;

  PERFORM public.record_billing_event(
    p_tenant_id,
    'TenantTrialStarted',
    jsonb_build_object('subscription_id', v_sub_id, 'trial_ends_at', v_trial_end)
  );

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.trial_started_at, s.trial_ends_at,
         s.current_period_start, s.current_period_end
  FROM public.subscriptions s
  WHERE s.id = v_sub_id;
END;
$function$;

-- 3.2 activate_subscription — trialing -> active (sem gateway; manual/superadmin na 6.0.4)
CREATE OR REPLACE FUNCTION public.activate_subscription(
  p_tenant_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to activate subscription';
  END IF;

  UPDATE public.subscriptions
  SET status = 'active',
      current_period_start = COALESCE(current_period_start, now()),
      current_period_end = COALESCE(current_period_end, now() + interval '1 month'),
      updated_at = now()
  WHERE tenant_id = p_tenant_id AND status = 'trialing';

  UPDATE public.tenants
  SET status = 'active', updated_at = now()
  WHERE id = p_tenant_id AND status = 'trial';

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    PERFORM public.record_billing_event(
      p_tenant_id,
      'TenantSubscriptionActivated',
      jsonb_build_object('subscription_id', v_sub_id)
    );
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- 3.3 cancel_subscription — trialing/active/past_due -> cancelled
CREATE OR REPLACE FUNCTION public.cancel_subscription(
  p_tenant_id uuid
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  plan text,
  status text,
  canceled_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_sub_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to cancel subscription';
  END IF;

  UPDATE public.subscriptions
  SET status = 'cancelled', canceled_at = now(), updated_at = now()
  WHERE tenant_id = p_tenant_id AND status IN ('trialing', 'active', 'past_due');

  UPDATE public.tenants
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_tenant_id;

  SELECT s.id INTO v_sub_id
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_sub_id IS NOT NULL THEN
    PERFORM public.record_billing_event(
      p_tenant_id,
      'TenantSubscriptionCancelled',
      jsonb_build_object('subscription_id', v_sub_id)
    );
  END IF;

  RETURN QUERY
  SELECT s.id, s.tenant_id, s.plan, s.status, s.canceled_at
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$function$;

-- =====================================================
-- 4) ROLE_PERMISSIONS (6.0.3) — POLICY + RPCS
-- =====================================================

DROP POLICY IF EXISTS "role_permissions_manage_tenant" ON public.role_permissions;
CREATE POLICY "role_permissions_manage_tenant"
  ON public.role_permissions FOR ALL
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

CREATE OR REPLACE FUNCTION public.upsert_role_permissions(
  p_tenant_id UUID,
  p_role TEXT,
  p_permissions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  v_permission_key TEXT;
  v_enabled BOOLEAN;
  v_created_by UUID;
BEGIN
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to modify role_permissions';
  END IF;

  v_created_by := auth.uid();

  FOR item IN SELECT * FROM jsonb_array_elements(p_permissions)
  LOOP
    v_permission_key := item->>'permission_key';
    v_enabled := (item->>'enabled')::boolean;

    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES (p_tenant_id, p_role, v_permission_key, v_enabled, v_created_by)
    ON CONFLICT (tenant_id, role, permission_key)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      updated_at = now(),
      created_by = EXCLUDED.created_by;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_role_permissions_to_default(
  p_tenant_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_created_by UUID;
BEGIN
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to reset role_permissions';
  END IF;

  v_created_by := auth.uid();

  DELETE FROM public.role_permissions
  WHERE tenant_id = p_tenant_id AND role = p_role;

  IF p_role = 'barber' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'barber', 'schedule.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'barber', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'barber', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'barber', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'barber', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'barber', 'services.register_services', true, v_created_by),
      (p_tenant_id, 'barber', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'barber', 'clients.view_own_history', true, v_created_by),
      (p_tenant_id, 'barber', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'barber', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'barber', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'barber', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'barber', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'barber', 'team.view_own_commission', true, v_created_by),
      (p_tenant_id, 'barber', 'team.view_own_goals', true, v_created_by),
      (p_tenant_id, 'barber', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'barber', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'barber', 'reports.view_personal_productivity', true, v_created_by),
      (p_tenant_id, 'barber', 'communication.view_notifications', true, v_created_by);
  ELSIF p_role = 'receptionist' THEN
    INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
    VALUES
      (p_tenant_id, 'receptionist', 'schedule.view_general_schedule', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.create_appointments', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.edit_appointments', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.cancel_appointments', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.view_available_times', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.manage_waitlist', true, v_created_by),
      (p_tenant_id, 'receptionist', 'schedule.confirm_arrival', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.create', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.view_basic', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.view_full_history', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.edit', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.add_notes', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.view_preferences', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.view_documents', true, v_created_by),
      (p_tenant_id, 'receptionist', 'clients.view_payment_history', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.view_catalog', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.view_prices', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.sell_services', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.view_stock', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.sell_products', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.apply_discounts', true, v_created_by),
      (p_tenant_id, 'receptionist', 'services.register_additions', true, v_created_by),
      (p_tenant_id, 'receptionist', 'financial.open_close_cash', true, v_created_by),
      (p_tenant_id, 'receptionist', 'financial.register_payments', true, v_created_by),
      (p_tenant_id, 'receptionist', 'financial.register_basic_expenses', true, v_created_by),
      (p_tenant_id, 'receptionist', 'financial.issue_receipts', true, v_created_by),
      (p_tenant_id, 'receptionist', 'financial.view_daily_movement', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.view_own_schedule', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.request_time_off', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.view_team_schedules', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.internal_communication', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.edit_own_profile', true, v_created_by),
      (p_tenant_id, 'receptionist', 'team.change_own_password', true, v_created_by),
      (p_tenant_id, 'receptionist', 'reports.view_daily_attendance', true, v_created_by),
      (p_tenant_id, 'receptionist', 'reports.view_schedule_overview', true, v_created_by),
      (p_tenant_id, 'receptionist', 'reports.view_busy_free_times', true, v_created_by),
      (p_tenant_id, 'receptionist', 'reports.view_service_revenue', true, v_created_by),
      (p_tenant_id, 'receptionist', 'communication.send_reminders', true, v_created_by),
      (p_tenant_id, 'receptionist', 'communication.view_notifications', true, v_created_by),
      (p_tenant_id, 'receptionist', 'communication.respond_to_messages', true, v_created_by),
      (p_tenant_id, 'receptionist', 'communication.view_communication_history', true, v_created_by);
  END IF;
END;
$$;

-- =====================================================
-- 5) TEAM_INVITATIONS (6.0.3) — POLICY + RPCS
-- =====================================================

DROP POLICY IF EXISTS "team_invitations_select_tenant" ON public.team_invitations;
CREATE POLICY "team_invitations_select_tenant"
  ON public.team_invitations FOR SELECT
  USING (public.current_is_tenant_manager_from_auth_uid(tenant_id));

-- 5.1 invite_team_member
CREATE OR REPLACE FUNCTION public.invite_team_member(
  p_tenant_id uuid,
  p_email text,
  p_role text
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  email text,
  role text,
  token text,
  status text,
  expires_at timestamptz,
  invited_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_normalized_email text;
  v_plan text;
  v_active_staff int;
  v_pending_invites int;
  v_total int;
  v_role text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Chamador deve ser gestor do tenant (owner/manager/admin) ou superadmin
  IF NOT public.current_is_tenant_manager_from_auth_uid(p_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to invite team members';
  END IF;

  -- D2: apenas Barber + Receptionist sao convidaveis
  v_role := lower(trim(p_role));
  IF v_role NOT IN ('barber', 'receptionist') THEN
    RAISE EXCEPTION 'Invalid invite role. Allowed: barber, receptionist';
  END IF;

  v_normalized_email := lower(trim(p_email));
  IF v_normalized_email = '' OR v_normalized_email NOT LIKE '%@%' THEN
    RAISE EXCEPTION 'Invalid email';
  END IF;

  -- Nao pode convidar quem ja e staff do tenant
  IF EXISTS (
    SELECT 1 FROM public.staff s
    WHERE s.tenant_id = p_tenant_id
      AND lower(trim(s.email)) = v_normalized_email
  ) THEN
    RAISE EXCEPTION 'This email is already a team member';
  END IF;

  -- Nao pode haver convite pendente para o mesmo email+tenant (constraint parcial)
  -- (a UNIQUE parcial ja impede; aqui garantimos mensagem amigavel)

  -- D3: limite por plano (Free=1, Pro=5, Premium=ilimitado) contando staff ativos + invites pendentes
  SELECT t.plan INTO v_plan FROM public.tenants t WHERE t.id = p_tenant_id;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Tenant not found';
  END IF;

  SELECT count(*) INTO v_active_staff
  FROM public.staff s
  WHERE s.tenant_id = p_tenant_id AND s.status = 'active';

  SELECT count(*) INTO v_pending_invites
  FROM public.team_invitations i
  WHERE i.tenant_id = p_tenant_id AND i.status = 'pending';

  v_total := v_active_staff + v_pending_invites;

  IF v_plan = 'free' AND v_total >= 1 THEN
    RAISE EXCEPTION 'Team limit reached: the free plan allows 1 professional. Please upgrade your plan.';
  ELSIF v_plan = 'pro' AND v_total >= 5 THEN
    RAISE EXCEPTION 'Team limit reached: the pro plan allows 5 professionals. Please upgrade your plan.';
  END IF;

  RETURN QUERY
  INSERT INTO public.team_invitations AS inv (tenant_id, email, role, token, status, invited_by)
  VALUES (
    p_tenant_id,
    v_normalized_email,
    v_role,
    encode(extensions.gen_random_bytes(24), 'hex'),
    'pending',
    auth.uid()
  )
  RETURNING
    inv.id, inv.tenant_id, inv.email, inv.role, inv.token, inv.status, inv.expires_at, inv.invited_by, inv.created_at;
END;
$function$;

-- 5.2 revoke_invite
CREATE OR REPLACE FUNCTION public.revoke_invite(
  p_invitation_id uuid
)
RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_invitations i
    WHERE i.id = p_invitation_id
      AND public.current_is_tenant_manager_from_auth_uid(i.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to revoke this invite';
  END IF;

  RETURN QUERY
  UPDATE public.team_invitations AS inv
  SET status = 'revoked', updated_at = now()
  WHERE inv.id = p_invitation_id AND inv.status = 'pending'
  RETURNING inv.id, inv.status;
END;
$function$;

-- 5.3 resend_invite (rotaciona token + renova expiracao)
CREATE OR REPLACE FUNCTION public.resend_invite(
  p_invitation_id uuid
)
RETURNS TABLE(id uuid, email text, role text, token text, status text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_invitations i
    WHERE i.id = p_invitation_id
      AND public.current_is_tenant_manager_from_auth_uid(i.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Insufficient permissions to resend this invite';
  END IF;

  RETURN QUERY
  UPDATE public.team_invitations AS inv
  SET resend_count = inv.resend_count + 1,
      token = encode(extensions.gen_random_bytes(24), 'hex'),
      expires_at = now() + interval '7 days',
      updated_at = now()
  WHERE inv.id = p_invitation_id AND inv.status = 'pending'
  RETURNING inv.id, inv.email, inv.role, inv.token, inv.status, inv.expires_at;
END;
$function$;

-- 5.4 list_team_invitations (sem token — para a UI do gestor)
CREATE OR REPLACE FUNCTION public.list_team_invitations()
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  resend_count int,
  invited_by uuid,
  created_at timestamptz,
  accepted_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
BEGIN
  v_tenant_id := public.current_tenant_id_from_auth_uid();

  IF NOT public.current_is_tenant_manager_from_auth_uid(v_tenant_id) THEN
    RAISE EXCEPTION 'Insufficient permissions to list invites';
  END IF;

  RETURN QUERY
  SELECT i.id, i.email, i.role, i.status, i.expires_at, i.resend_count,
         i.invited_by, i.created_at, i.accepted_at
  FROM public.team_invitations i
  WHERE i.tenant_id = v_tenant_id
  ORDER BY i.created_at DESC;
END;
$function$;

-- =====================================================
-- GRANTS (reafirma para as funcoes recriadas; CREATE OR REPLACE preserva,
-- mas reafirmar mantem a idempotencia e a clareza do contrato)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_role_permissions(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_role_permissions_to_default(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resend_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_team_invitations() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.start_trial(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_subscription(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_role_permissions(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_role_permissions_to_default(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_invitations() TO authenticated;

-- =====================================================
-- SECURITY HARDENING — REVOKE anon (default do Supabase auto-concede EXECUTE
-- a anon na criacao da funcao; o contrato deste modulo e authenticated-only,
-- exceto get_invite_by_token/kiosk_get_staff que sao intencionalmente publicos)
-- =====================================================
REVOKE EXECUTE ON FUNCTION public.current_is_tenant_manager_from_auth_uid(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_billing_event(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.start_trial(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_subscription(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_subscription() FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_role_permissions(uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_role_permissions_to_default(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_invite(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resend_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_team_invitations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_invites_for_current_user() FROM anon;
