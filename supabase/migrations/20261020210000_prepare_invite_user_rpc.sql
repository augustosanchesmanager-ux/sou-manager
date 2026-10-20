-- Migration: prepare_invite_user RPC for team invitation acceptance
-- Allows invitees with a valid, pending team invitation token to set their password
-- and confirm their email directly without being blocked by GoTrue confirmation loops.

CREATE OR REPLACE FUNCTION public.prepare_invite_user(p_token text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invite record;
  v_user_exists boolean;
BEGIN
  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'A senha deve ter no mínimo 6 caracteres.';
  END IF;

  SELECT id, email, status, expires_at
  INTO v_invite
  FROM public.team_invitations
  WHERE token = p_token;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado.';
  END IF;

  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Este convite já foi aceito.';
  ELSIF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Este convite foi revogado.';
  ELSIF v_invite.status = 'expired' OR v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(trim(email)) = lower(trim(v_invite.email))
  ) INTO v_user_exists;

  IF v_user_exists THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE lower(trim(email)) = lower(trim(v_invite.email));
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_exists', v_user_exists,
    'email', v_invite.email
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
