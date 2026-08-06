-- Fix: accept_invite raised "column reference \"tenant_id\" is ambiguous"
--   (code 42702, "could refer to either a PL/pgSQL variable or a table column").
--   Root cause: RETURNS TABLE(tenant_id, role, staff_id) declares OUT params that
--   collide with unqualified columns in the SELECT list below.
--   Fix: qualify the SELECT list with a table alias.
--   Applied on top of 20260806000000 (do not edit the base migration).

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

  SELECT t.id, t.tenant_id, t.email, t.role, t.status, t.expires_at
  INTO v_invite
  FROM public.team_invitations t
  WHERE t.token = p_token
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

  -- profiles (dispara triggers de sincronizacao legados; rodape normaliza is_primary depois)
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
  -- Aplica apos os inserts para que o trigger sync_profile_to_user_tenants
  -- (que seta is_primary=true) seja sobrescrito.
  -- Nota: DELETE+INSERT no lugar de ON CONFLICT (user_id, tenant_id) porque
  -- "tenant_id" no conflict target colide com o OUT param do RETURNS TABLE.
  DELETE FROM public.user_tenants
  WHERE user_tenants.user_id = auth.uid()
    AND user_tenants.tenant_id = v_invite.tenant_id;

  INSERT INTO public.user_tenants (user_id, tenant_id, role, is_primary)
  VALUES (auth.uid(), v_invite.tenant_id, v_invite.role, false);

  RETURN QUERY
  SELECT v_invite.tenant_id, v_invite.role, v_staff_id;
END;
$function$;
