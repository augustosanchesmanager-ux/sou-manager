-- ============================================================================
-- F01 — Takeover de conta entre tenants pelo fluxo de convite
-- PROPOSTA DE CORREÇÃO — NÃO APLICAR DIRETAMENTE
-- ============================================================================
-- Achado: docs/security-audit/relatorio-auditoria-seguranca.pdf (F01)
-- Superfície: public.prepare_invite_user(text, text)
-- Risco: gestor do tenant A obtém o token de um convite para o e-mail de um
--        usuário do tenant B e redefine a senha global dessa conta como anon.
--
-- Esta proposta é deliberadamente mínima: remove a escrita em auth.users sem
-- exigir mudança imediata de frontend. Ela NÃO resolve o retorno do token por
-- invite_team_member (fase 2) nem substitui o fluxo por magic link.
--
-- Antes de aplicar:
--   1. aprovação explícita do PO (migration em produção);
--   2. revisão do ACL real de prepare_invite_user em produção;
--   3. execução dos testes de regressão cross-tenant descritos no fim.
-- ============================================================================

BEGIN;

-- 1) Elimina o grant default de PUBLIC e o grant explícito a anon.
--    O PostgREST chama a função como anon no fluxo de primeiro acesso, então
--    o grant a anon é restaurado no fim; o que muda é o comportamento interno.
REVOKE ALL ON FUNCTION public.prepare_invite_user(text, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- 2) Recria a função sem alterar senha de usuário existente.
--    Para usuário existente, apenas sinaliza que o aceite deve ocorrer via
--    accept_invite (autenticado, com e-mail do auth.uid() igual ao do convite).
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
    SELECT 1 FROM auth.users
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
--    Fase 2: após o frontend criar usuário novo via signUp, remover anon.
REVOKE ALL ON FUNCTION public.prepare_invite_user(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text)
  TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text)
  TO service_role;

COMMIT;

-- ============================================================================
-- TESTES DE ACEITE (executar em staging antes de produção)
-- ============================================================================
-- A) Cross-tenant (o ataque):
--    Como manager do tenant A:
--      SELECT * FROM public.invite_team_member(
--        '<tenant_A>', 'owner@tenantB.com', 'barber');
--    Guardar o token retornado e, como anon:
--      SELECT public.prepare_invite_user('<token>', 'senha-atacante');
--    Esperado: user_exists = true, requires_login = true, success = false.
--    Verificar que auth.users.encrypted_password de owner@tenantB.com NÃO mudou
--    e que o login com a senha antiga continua funcionando.
--
-- B) Convite novo (fluxo legítimo de primeiro acesso):
--      SELECT public.prepare_invite_user('<token_novo>', 'senha-forte');
--    Esperado: user_exists = false, success = true; em seguida o signUp do
--    convidado cria a conta e accept_invite vincula ao tenant.
--
-- C) Token inválido/expirado/revogado:
--    Esperado: exceção, sem qualquer escrita em auth.users.
--
-- D) ACL:
--      SELECT proname, proacl FROM pg_proc
--      WHERE proname = 'prepare_invite_user';
--    Esperado: sem EXECUTE para PUBLIC; anon/authenticated/service_role
--    apenas com o grant explícito acima.
--
-- ============================================================================
-- FASE 2 (fora desta proposta)
-- ============================================================================
-- 1. invite_team_member não deve retornar o token ao chamador autenticado.
--    Gerar o token no servidor, guardar apenas hash e entregar o valor bruto
--    somente no link enviado por e-mail (Edge Function com service role).
-- 2. Criar RPC autenticada e auditada para "copiar link do convite" uma única
--    vez, se o produto mantiver essa UX.
-- 3. No frontend, para e-mail já cadastrado, trocar a chamada de
--    prepare_invite_user por login + accept_invite; exibir mensagem de
--    "conta existente, entre com sua senha" em vez de pedir nova senha.
-- 4. Após a fase 2, remover o grant a anon e o parâmetro p_password.
--
-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- Recriar public.prepare_invite_user exatamente como em
-- supabase/migrations/20261020210000_prepare_invite_user_rpc.sql e restaurar:
--   GRANT EXECUTE ON FUNCTION public.prepare_invite_user(text, text)
--     TO anon, authenticated, service_role;
-- ============================================================================
