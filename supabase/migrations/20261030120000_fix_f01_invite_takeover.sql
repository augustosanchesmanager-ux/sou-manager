-- ============================================================================
-- F01 — Takeover de conta entre tenants pelo fluxo de convite
-- ============================================================================
-- Achado: docs/security-audit/relatorio-auditoria-seguranca.pdf (F01, crítico)
-- Superfície: public.prepare_invite_user(text, text)
--
-- O helper pré-login aceitava o token do convite e gravava
-- auth.users.encrypted_password para qualquer e-mail existente. Como
-- invite_team_member devolve o token ao gestor do tenant A, um gestor podia
-- redefinir a senha global de um usuário do tenant B.
--
-- Correção fase 1 (esta migration): o helper nunca mais escreve em auth.users.
-- Para conta existente ele apenas sinaliza que o aceite deve ocorrer pelo fluxo
-- autenticado (accept_invite), que valida auth.uid()/auth.email() e o tenant.
-- A fase 2 (não incluída aqui) remove o retorno do token em invite_team_member,
-- troca o fluxo por magic link e revoga o EXECUTE de anon.
--
-- Rollback: recriar a função exatamente como em
-- supabase/migrations/20261020210000_prepare_invite_user_rpc.sql e restaurar
-- o ACL anterior (PUBLIC/anon/authenticated/service_role).
-- ============================================================================

-- 1) Elimina o grant default de PUBLIC e os grants explícitos.
REVOKE ALL ON FUNCTION public.prepare_invite_user(text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- 2) Recria a função sem alterar senha de usuário existente.
CREATE OR REPLACE FUNCTION public.prepare_invite_user(
  p_token text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_invite record;
  v_user_exists boolean;
BEGIN
  -- p_password é mantido na assinatura por compatibilidade com o cliente atual.
  -- Ele NÃO é mais usado para gravar senha de conta existente.
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
    SELECT 1
    FROM auth.users
    WHERE lower(trim(email)) = lower(trim(v_invite.email))
  ) INTO v_user_exists;

  -- Ponto central da correção: nunca escrever encrypted_password a partir de
  -- um token de convite. Usuário existente precisa autenticar e usar
  -- accept_invite, que valida auth.uid()/auth.email() e o tenant.
  IF v_user_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'user_exists', true,
      'requires_login', true,
      'email', v_invite.email
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'user_exists', false,
    'email', v_invite.email
  );
END;
$$;

-- 3) Restaura apenas o necessário para o fluxo de primeiro acesso.
--    anon continua necessário porque a página de aceite roda sem sessão.
--    Fase 2: após o frontend trocar para magic link/signUp, remover anon.
GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text)
  TO service_role;
