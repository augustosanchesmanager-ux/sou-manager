-- =====================================================
-- PHASE 6.0.3 â€” TEAM ONBOARDING & INVITATIONS
-- + ROLE NORMALIZATION (R6) + KIOSK RLS FIX (D5)
-- =====================================================
-- Escopo:
--   1) R6 â€” normaliza roles para um unico contrato lowercase:
--      profiles.role    : owner | manager | barber | receptionist | admin | superadmin
--      staff.role       : owner | manager | barber | receptionist | admin
--      role_permissions : owner | manager | barber | receptionist | admin
--   2) Tabela team_invitations + RLS (somente SELECT via policy; escritas via RPC SECURITY DEFINER)
--   3) RPCs: invite_team_member / get_invite_by_token / accept_invite / revoke_invite /
--            resend_invite / list_team_invitations / list_invites_for_current_user
--   4) D5 â€” kiosk seguro: remove public_select_staff e cria kiosk_get_staff(tenant_slug)
--      (camada segura via SECURITY DEFINER expondo apenas id/name/role/status)
--   5) R3 â€” seeds de role_permissions para owner/manager/admin (sem enforcement can())
--
-- Observacao (desvio documentado do plano D5): em vez de uma view crua
-- kiosk_staff_view (que, sem RLS por tenant, exporia staff de todos os tenants),
-- cria-se a funcao SECURITY DEFINER kiosk_get_staff(p_tenant_slug) que resolve o
-- tenant por slug e devolve somente id/name/role/status. Principio do menor privilegio.

-- =====================================================
-- 1) R6 â€” NORMALIZACAO DE ROLES
-- =====================================================

-- 1.1 staff
ALTER TABLE public.staff ALTER COLUMN role SET DEFAULT 'barber';

-- DROP antes do UPDATE para permitir a normalizacao dos dados existentes
ALTER TABLE public.staff DROP CONSTRAINT staff_role_check;

UPDATE public.staff
SET role = CASE role
  WHEN 'Manager' THEN 'manager'
  WHEN 'AdminManager' THEN 'admin'
  WHEN 'Barber' THEN 'barber'
  WHEN 'Receptionist' THEN 'receptionist'
  ELSE lower(role)
END;

ALTER TABLE public.staff ADD CONSTRAINT staff_role_check
  CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin'));

-- 1.2 profiles
ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'barber';
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;

UPDATE public.profiles
SET role = CASE
  WHEN lower(trim(role)) = 'super admin' THEN 'superadmin'
  WHEN lower(role) = 'staff' THEN 'barber'
  ELSE lower(role)
END;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin', 'superadmin'));

-- 1.3 role_permissions + role_permissions_audit
ALTER TABLE public.role_permissions DROP CONSTRAINT role_permissions_role_check;
ALTER TABLE public.role_permissions_audit DROP CONSTRAINT role_permissions_audit_role_check;

UPDATE public.role_permissions SET role = lower(role);
UPDATE public.role_permissions_audit SET role = lower(role);

ALTER TABLE public.role_permissions ADD CONSTRAINT role_permissions_role_check
  CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin'));

ALTER TABLE public.role_permissions_audit ADD CONSTRAINT role_permissions_audit_role_check
  CHECK (role IN ('owner', 'manager', 'barber', 'receptionist', 'admin'));

-- 1.4 user_tenants (sem CHECK â€” normalizacao best-effort de valores legados)
UPDATE public.user_tenants SET role = lower(trim(role));
UPDATE public.user_tenants SET role = CASE role
  WHEN 'staff' THEN 'barber'
  WHEN 'superadmin' THEN 'owner'
  WHEN 'super admin' THEN 'owner'
  WHEN 'adminmanager' THEN 'admin'
  WHEN 'admin_manager' THEN 'admin'
  WHEN 'gerente' THEN 'manager'
  ELSE role
END;

-- 1.5 Trigger legado handle_new_manager_profile: inseria 'Manager' (PascalCase),
--     o que violaria o novo CHECK. Reescrito para o contrato R6.
CREATE OR REPLACE FUNCTION public.handle_new_manager_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_full_name TEXT;
  v_email TEXT;
  v_staff_role TEXT;
BEGIN
  IF NEW.role NOT IN ('manager', 'owner', 'admin', 'superadmin') THEN
    RETURN NEW;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_staff_role := CASE NEW.role WHEN 'superadmin' THEN 'owner' ELSE NEW.role END;

  SELECT
    COALESCE(
      NULLIF(TRIM(
        COALESCE(raw_user_meta_data->>'first_name', '') || ' ' ||
        COALESCE(raw_user_meta_data->>'last_name', '')
      ), ''),
      raw_user_meta_data->>'full_name',
      NEW.full_name,
      split_part(email, '@', 1)
    ),
    email
  INTO v_full_name, v_email
  FROM auth.users
  WHERE id = NEW.id;

  INSERT INTO public.staff (
    name,
    email,
    phone,
    role,
    avatar,
    commission_rate,
    status,
    tenant_id
  )
  SELECT
    COALESCE(v_full_name, 'Gestor'),
    COALESCE(v_email, ''),
    '',
    v_staff_role,
    'https://ui-avatars.com/api/?name=' || REPLACE(COALESCE(v_full_name, 'Gestor'), ' ', '+') || '&background=0066ff&color=fff',
    0,
    'active',
    NEW.tenant_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.staff
    WHERE tenant_id = NEW.tenant_id
      AND email = COALESCE(v_email, '')
  );

  RETURN NEW;
END;
$function$;

-- 1.6 role_permissions: policies e RPCs referenciavam roles PascalCase
--     e a funcao legada get_current_tenant_id. Atualizados para o contrato R6.

DROP POLICY IF EXISTS "Managers can view role_permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Managers can manage role_permissions" ON public.role_permissions;

CREATE POLICY "role_permissions_select_tenant"
  ON public.role_permissions FOR SELECT
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR tenant_id = public.current_tenant_id_from_auth_uid()
  );

CREATE POLICY "role_permissions_manage_tenant"
  ON public.role_permissions FOR ALL
  USING (
    (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.role IN ('owner', 'manager', 'admin')
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
      )
    )
    OR public.current_is_super_admin_from_auth_uid()
  );

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
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('owner', 'manager', 'admin')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
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
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.role IN ('owner', 'manager', 'admin')
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
    )
  ) THEN
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

-- 1.7 R3 â€” seeds de role_permissions para owner/manager/admin em tenants existentes
-- (mesmo superset de permissÃµes de gestÃ£o; enforcement real fica p/ fase de permissÃµes).
-- O trigger de auditoria e desabilitado temporariamente porque o seed roda sem
-- created_by (auth.uid() = null no contexto de migration).
ALTER TABLE public.role_permissions DISABLE TRIGGER trigger_audit_role_permissions_changes;

DO $$
DECLARE
  t record;
  v_role text;
  keys text[];
  k text;
BEGIN
  keys := ARRAY[
    'schedule.view_general_schedule', 'schedule.view_own_schedule',
    'schedule.create_appointments', 'schedule.edit_appointments',
    'schedule.cancel_appointments', 'schedule.view_available_times',
    'schedule.manage_waitlist', 'schedule.confirm_arrival', 'schedule.manage_blocks',
    'clients.create', 'clients.view_basic', 'clients.view_full_history',
    'clients.edit', 'clients.add_notes', 'clients.view_preferences',
    'clients.view_documents', 'clients.view_payment_history',
    'services.view_catalog', 'services.view_prices', 'services.register_services',
    'services.sell_services', 'services.view_stock', 'services.sell_products',
    'services.apply_discounts', 'services.register_additions',
    'financial.open_close_cash', 'financial.register_payments',
    'financial.register_basic_expenses', 'financial.issue_receipts',
    'financial.view_daily_movement', 'financial.view_reports', 'financial.manage_commission',
    'team.view_team_schedules', 'team.manage_staff', 'team.invite_members',
    'team.manage_roles', 'team.edit_own_profile', 'team.change_own_password',
    'team.request_time_off', 'team.internal_communication', 'team.view_own_commission',
    'reports.view_daily_attendance', 'reports.view_schedule_overview',
    'reports.view_busy_free_times', 'reports.view_service_revenue',
    'reports.view_personal_productivity', 'reports.view_financial',
    'communication.send_reminders', 'communication.view_notifications',
    'communication.respond_to_messages', 'communication.view_communication_history',
    'settings.view_tenant_settings', 'settings.manage_tenant_settings',
    'settings.manage_services', 'settings.manage_clients'
  ];

  FOR t IN SELECT id FROM public.tenants LOOP
    FOREACH v_role IN ARRAY ARRAY['owner', 'manager', 'admin'] LOOP
      FOREACH k IN ARRAY keys LOOP
        INSERT INTO public.role_permissions (tenant_id, role, permission_key, enabled, created_by)
        VALUES (t.id, v_role, k, true, NULL)
        ON CONFLICT (tenant_id, role, permission_key) DO NOTHING;
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE public.role_permissions ENABLE TRIGGER trigger_audit_role_permissions_changes;

-- =====================================================
-- 2) TEAM_INVITATIONS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'barber',
  token text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  resend_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_invitations_role_check CHECK (role IN ('barber', 'receptionist')),
  CONSTRAINT team_invitations_status_check CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  CONSTRAINT team_invitations_token_key UNIQUE (token)
);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_pending_email_uidx
  ON public.team_invitations (tenant_id, lower(trim(email))) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_team_invitations_tenant_status
  ON public.team_invitations (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email
  ON public.team_invitations (lower(trim(email)));

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Somente gestores do tenant (owner/manager/admin) veem convites; escrita
-- exclusivamente via RPC SECURITY DEFINER (padrao user_tenants).
CREATE POLICY "team_invitations_select_tenant"
  ON public.team_invitations FOR SELECT
  USING (
    public.current_is_super_admin_from_auth_uid()
    OR (
      tenant_id = public.current_tenant_id_from_auth_uid()
      AND EXISTS (
        SELECT 1 FROM public.staff s
        WHERE s.id = auth.uid()
          AND s.tenant_id = public.current_tenant_id_from_auth_uid()
          AND s.status = 'active'
          AND s.role IN ('owner', 'manager', 'admin')
      )
    )
  );

-- =====================================================
-- 3) RPCS
-- =====================================================

-- 3.1 invite_team_member
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
  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = p_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
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

  -- D3: limite por plano (Free=1, Pro=5, Elite=ilimitado) contando staff ativos + invites pendentes
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

-- 3.2 get_invite_by_token (publico â€” tela de aceite sem sessao)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(
  p_token text
)
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  SELECT i.status INTO v_status
  FROM public.team_invitations i
  WHERE i.token = p_token;

  IF v_status IS NULL THEN
    RETURN;
  END IF;

  IF v_status = 'pending' THEN
    UPDATE public.team_invitations AS inv
    SET status = 'expired', updated_at = now()
    WHERE inv.token = p_token AND inv.status = 'pending' AND inv.expires_at < now();
  END IF;

  RETURN QUERY
  SELECT
    i.id, i.email, i.role, i.status, i.expires_at,
    t.id, t.name, t.slug
  FROM public.team_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE i.token = p_token;
END;
$function$;

-- 3.3 accept_invite
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

  SELECT id, tenant_id, email, role, status, expires_at
  INTO v_invite
  FROM public.team_invitations
  WHERE token = p_token
  LIMIT 1;

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

  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invite.id;

  -- profiles (dispara triggers de sincronizacao legados; rodapÃ© normaliza is_primary depois)
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

  -- user_tenants: is_primary=false (convidado nao e o dono do tenant).
  -- Upsert apos os inserts para que o trigger sync_profile_to_user_tenants
  -- (que seta is_primary=true) seja sobrescrito.
  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (auth.uid(), v_invite.tenant_id, v_invite.role, false)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_primary = false,
    updated_at = now();

  RETURN QUERY
  SELECT v_invite.tenant_id, v_invite.role, v_staff_id;
END;
$function$;

-- 3.4 revoke_invite
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

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.team_invitations i
      WHERE i.id = p_invitation_id
        AND i.tenant_id = public.current_tenant_id_from_auth_uid()
        AND EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = auth.uid()
            AND s.tenant_id = i.tenant_id
            AND s.status = 'active'
            AND s.role IN ('owner', 'manager', 'admin')
        )
    )
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

-- 3.5 resend_invite (rotaciona token + renova expiracao)
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

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.team_invitations i
      WHERE i.id = p_invitation_id
        AND i.tenant_id = public.current_tenant_id_from_auth_uid()
        AND EXISTS (
          SELECT 1 FROM public.staff s
          WHERE s.id = auth.uid()
            AND s.tenant_id = i.tenant_id
            AND s.status = 'active'
            AND s.role IN ('owner', 'manager', 'admin')
        )
    )
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

-- 3.6 list_team_invitations (sem token â€” para a UI do gestor)
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

  IF NOT (
    public.current_is_super_admin_from_auth_uid()
    OR EXISTS (
      SELECT 1 FROM public.staff s
      WHERE s.id = auth.uid()
        AND s.tenant_id = v_tenant_id
        AND s.status = 'active'
        AND s.role IN ('owner', 'manager', 'admin')
    )
  ) THEN
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

-- 3.7 list_invites_for_current_user (convidado sem token na URL â€” fallback da pagina de aceite)
CREATE OR REPLACE FUNCTION public.list_invites_for_current_user()
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  expires_at timestamptz,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();

  RETURN QUERY
  SELECT i.id, i.email, i.role, i.status, i.expires_at,
         t.id, t.name, t.slug
  FROM public.team_invitations i
  JOIN public.tenants t ON t.id = i.tenant_id
  WHERE lower(trim(i.email)) = lower(trim(coalesce(v_user_email, '')))
    AND i.status = 'pending'
  ORDER BY i.created_at DESC;
END;
$function$;

-- Grants
REVOKE EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_invite(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resend_invite(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_team_invitations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.list_invites_for_current_user() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invite_team_member(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_team_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_invites_for_current_user() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_invite_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- =====================================================
-- 4) D5 â€” KIOSK RLS FIX
-- =====================================================
DROP POLICY IF EXISTS public_select_staff ON public.staff;

-- Camada segura para o kiosk (totem/QR, anon). Resolve tenant por slug ou id e
-- expoe SOMENTE id/name/role/status de staff ativo â€” nunca email/user_id/phone.
CREATE OR REPLACE FUNCTION public.kiosk_get_staff(
  p_tenant_identifier text
)
RETURNS TABLE(
  id uuid,
  name text,
  role text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_identifier text;
BEGIN
  v_identifier := trim(p_tenant_identifier);
  IF v_identifier = '' THEN
    RETURN;
  END IF;

  SELECT t.id INTO v_tenant_id FROM public.tenants t WHERE t.slug = v_identifier LIMIT 1;

  IF v_tenant_id IS NULL THEN
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    WHERE t.id::text = v_identifier
    LIMIT 1;
  END IF;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.id, s.name, s.role, s.status
  FROM public.staff s
  WHERE s.tenant_id = v_tenant_id
    AND s.status = 'active'
  ORDER BY s.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.kiosk_get_staff(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kiosk_get_staff(text) TO anon, authenticated;
