-- ==============================================================================
-- H6 F6-8: current_tenant_id_from_auth_uid — avalia status do perfil/staff
-- ==============================================================================
-- Contexto: homologação H-6 (docs/audit/H6_SECURITY_AUDIT.md). Achado F6-8 (P2).
--   RLS isolava por tenant mas NÃO avaliava status: usuário com
--   profiles.status='suspended' (+ staff.status='suspended') continuava lendo o
--   próprio tenant via PostgREST (o status só era aplicado na camada de app).
-- Correção (aprovada pelo PO): o helper passa a exigir status='active' tanto em
--   profiles quanto em staff. Suspenso/pendente → NULL → todas as policies que
--   usam o helper passam a falhar fechado (suspensão = hard block no banco).
-- Impacto verificado:
--   - Todos os fluxos legítimos criam perfis com status='active'
--     (provision_new_tenant: 20260801000000; accept_invite: 20260806010000).
--   - Inactive staff com profile ativo mantêm acesso (COALESCE profiles-first).
--   - Superadmin usa helper próprio (current_is_super_admin_from_auth_uid)
--     sem checagem de status — bypass preservado.
-- OBSERVAÇÃO (fora do escopo dos 9 achados): a suspensão REAL de tenant
-- (suspend_subscription, 20260807010000) altera apenas subscriptions/tenants.status
-- e NÃO mexe em profiles.status — usuários de tenant suspenso continuam lendo via
-- REST. Decisão de política (bloquear por tenants.status) fica para o PO.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id_from_auth_uid()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active' LIMIT 1),
    (SELECT s.tenant_id FROM public.staff s WHERE s.id = auth.uid() AND s.status = 'active' LIMIT 1)
  );
$$;

-- NOTIFY pgrst, 'reload schema';
