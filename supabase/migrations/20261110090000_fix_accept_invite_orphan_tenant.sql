-- ============================================================================
-- Migration: 20261110090000_fix_accept_invite_orphan_tenant.sql
-- Issue: #216 (GAP-03) — Tratar profiles.tenant_id IS NULL no accept_invite
--
-- Contexto:
--   A guarda anterior em public.accept_invite usava `p.tenant_id IS DISTINCT FROM
--   v_invite.tenant_id` (e o mesmo para `public.staff`), que avalia TRUE quando
--   `tenant_id IS NULL`. Isso bloqueava contas solo / pré-cadastradas (órfãs)
--   de aceitarem convites legítimos.
--
-- Correção:
--   1. Mantém `FOR UPDATE` em `team_invitations` e adiciona `SELECT ... FOR UPDATE`
--      em `profiles` e `staff` antes da checagem de pertencimento para evitar
--      race condition entre dois convites concorrentes.
--   2. Permite adoção explícita de perfil/staff órfão (`tenant_id IS NULL`) ->
--      `v_invite.tenant_id`, preservando todas as validações de token,
--      expiração, status e e-mail do usuário autenticado.
--   3. Mantém bloqueio estrito cross-tenant (`tenant_id IS NOT NULL AND
--      tenant_id <> v_invite.tenant_id`) com SQLSTATE `42501`.
--   4. Mantém `trg_f5_profiles_tenant_status_guard` intacto (SECURITY DEFINER).
--   5. Registra em `public.audit_logs` quando um perfil órfão é vinculado.
-- ============================================================================

BEGIN;

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
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite record;
  v_user_email text;
  v_full_name text;
  v_commission int;
  v_staff_id uuid;
  v_existing_profile_exists boolean := false;
  v_existing_profile_tenant_id uuid;
  v_existing_staff_tenant_id uuid;
  v_orphan_profile_attached boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Lock pessimista na linha do convite para impedir duplo aceite concorrente
  SELECT t.id, t.tenant_id, t.email, t.role, t.status, t.expires_at, t.invited_by
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

  -- Lock pessimista no perfil e no registro de staff antes das validações de vínculo
  SELECT true, p.tenant_id
  INTO v_existing_profile_exists, v_existing_profile_tenant_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
  FOR UPDATE;

  SELECT s.tenant_id
  INTO v_existing_staff_tenant_id
  FROM public.staff s
  WHERE s.id = auth.uid()
  FOR UPDATE;

  -- Usuario ja membro do tenant?
  IF COALESCE(v_existing_profile_exists, false)
     AND v_existing_profile_tenant_id = v_invite.tenant_id THEN
    RAISE EXCEPTION 'You are already a member of this team';
  END IF;

  -- Multi-tenant membership: permite perfil/staff órfão (tenant_id IS NULL),
  -- mas bloqueia estritamente migração cross-tenant (Tenant A -> Tenant B).
  IF COALESCE(v_existing_profile_exists, false)
     AND v_existing_profile_tenant_id IS NOT NULL
     AND v_existing_profile_tenant_id <> v_invite.tenant_id THEN
    RAISE EXCEPTION 'Your account already belongs to another team. Sign in with the invited email or contact support.'
      USING ERRCODE = '42501';
  END IF;

  IF v_existing_staff_tenant_id IS NOT NULL
     AND v_existing_staff_tenant_id <> v_invite.tenant_id THEN
    RAISE EXCEPTION 'Your account already belongs to another team. Sign in with the invited email or contact support.'
      USING ERRCODE = '42501';
  END IF;

  v_orphan_profile_attached :=
    COALESCE(v_existing_profile_exists, false) AND v_existing_profile_tenant_id IS NULL;

  v_full_name := trim(coalesce(p_first_name, '') || ' ' || coalesce(p_last_name, ''));
  IF v_full_name = '' THEN
    v_full_name := split_part(v_invite.email, '@', 1);
  END IF;

  v_commission := CASE WHEN v_invite.role = 'barber' THEN 50 ELSE 0 END;

  -- Mutação atômica condicional
  UPDATE public.team_invitations
  SET status = 'accepted', accepted_at = now(), updated_at = now()
  WHERE id = v_invite.id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite already accepted';
  END IF;

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

  IF v_orphan_profile_attached THEN
    INSERT INTO public.audit_logs (
      table_name,
      record_id,
      action,
      old_data,
      new_data,
      changed_by,
      tenant_id
    )
    VALUES (
      'profiles',
      auth.uid()::text,
      'UPDATE',
      jsonb_build_object('tenant_id', NULL, 'event', 'profile_tenant_attached'),
      jsonb_build_object(
        'event', 'profile_tenant_attached',
        'tenant_id', v_invite.tenant_id,
        'role', v_invite.role,
        'invited_by', v_invite.invited_by,
        'invite_id', v_invite.id,
        'source', 'accept_invite'
      ),
      auth.uid(),
      v_invite.tenant_id
    );
  END IF;

  RETURN QUERY
  SELECT v_invite.tenant_id, v_invite.role, v_staff_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.accept_invite(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
