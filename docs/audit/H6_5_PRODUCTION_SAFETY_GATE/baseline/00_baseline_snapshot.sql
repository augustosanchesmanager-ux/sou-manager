-- ==============================================================================
-- H-6.5 PRODUCTION SAFETY GATE — BASELINE READ-ONLY (pré-aplicação das 10 migrations)
-- ==============================================================================
-- Contexto: docs/audit/H6_5_PRODUCTION_SAFETY_GATE.md
-- Natureza: 100% READ-ONLY (SELECT / \d) — NÃO altera schema, dados, policies,
--   grants ou RLS. Pode ser executado repetidamente com segurança.
-- Execução: supabase db query --linked --file <este arquivo>
--   OU no SQL Editor do dashboard (removendo os meta-comandos \d / \df se necessário).
-- Objetivo: registrar o estado PRÉ-fix das 10 migrations H-6 para comparação
--   pós-aplicação e para o rollback individual.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- B-1. Policies das tabelas afetadas (pré-estado)
-- ------------------------------------------------------------------------------
\echo '===== B-1.1 tenants ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'tenants'
ORDER BY policyname;

\echo '===== B-1.2 services ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'services'
ORDER BY policyname;

\echo '===== B-1.3 profiles ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles'
ORDER BY policyname;

\echo '===== B-1.4 kiosk_addons ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'kiosk_addons'
ORDER BY policyname;

\echo '===== B-1.5 ticket_messages ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ticket_messages'
ORDER BY policyname;

\echo '===== B-1.6 support_tickets ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'support_tickets'
ORDER BY policyname;

\echo '===== B-1.7 plan_change_requests ====='
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'plan_change_requests'
ORDER BY policyname;

-- ------------------------------------------------------------------------------
-- B-2. Grants de tabelas afetadas
-- ------------------------------------------------------------------------------
\echo '===== B-2.1 grants: tenants/services/profiles/kiosk_addons/ticket_messages/support_tickets/plan_change_requests ====='
SELECT grantee, privilege_type, table_name
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('tenants','services','profiles','kiosk_addons','ticket_messages','support_tickets','plan_change_requests')
ORDER BY table_name, grantee, privilege_type;

-- ------------------------------------------------------------------------------
-- B-3. RLS habilitado (relrowsecurity) das tabelas afetadas
-- ------------------------------------------------------------------------------
\echo '===== B-3 RLS enabled ====='
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('tenants','services','profiles','kiosk_addons','ticket_messages','support_tickets','plan_change_requests')
ORDER BY c.relname;

-- ------------------------------------------------------------------------------
-- B-4. Assinaturas das RPCs alteradas
-- ------------------------------------------------------------------------------
\echo '===== B-4.1 tenant_has_feature ====='
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result,
       p.provolatile, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'tenant_has_feature';

\echo '===== B-4.2 get_role_permissions ====='
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result,
       p.provolatile, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'get_role_permissions';

\echo '===== B-4.3 current_tenant_id_from_auth_uid ====='
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid) AS result,
       p.provolatile, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id_from_auth_uid';

\echo '===== B-4.4 close_order / approve_access_request ====='
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
       p.provolatile, p.prosecdef
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('close_order','approve_access_request')
ORDER BY p.proname;

\echo '===== B-4.5 grants de EXECUTE das RPCs alteradas ====='
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN ('tenant_has_feature','get_role_permissions','current_tenant_id_from_auth_uid','close_order','approve_access_request')
ORDER BY routine_name, grantee;

-- ------------------------------------------------------------------------------
-- B-5. Roles (anon/authenticated/service_role/superadmin)
-- ------------------------------------------------------------------------------
\echo '===== B-5 roles ====='
SELECT rolname, rolsuper, rolinherit, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication
FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role','superadmin','postgres','authenticator')
ORDER BY rolname;

-- ------------------------------------------------------------------------------
-- B-6. Contagem de tenants + tenant Sanchez
-- ------------------------------------------------------------------------------
\echo '===== B-6.1 total tenants por status ====='
SELECT status, count(*) FROM public.tenants GROUP BY status ORDER BY status;

\echo '===== B-6.2 tenant Sanchez Barber ====='
SELECT id, name, slug, status, plan, app_slug
FROM public.tenants
WHERE id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';

-- ------------------------------------------------------------------------------
-- B-7. Sanchez crítica (dados operacionais p/ comparação pós-fix)
-- ------------------------------------------------------------------------------
\echo '===== B-7.1 profiles da Sanchez ====='
SELECT id, full_name, role, status, onboarding_completed, tenant_id
FROM public.profiles
WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
ORDER BY role, full_name;

\echo '===== B-7.2 staff da Sanchez ====='
SELECT id, name, role, status, commission_rate, email
FROM public.staff
WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
ORDER BY role, name;

\echo '===== B-7.3 subscriptions da Sanchez ====='
SELECT id, status, plan, current_period_start, current_period_end
FROM public.subscriptions
WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
ORDER BY status;

\echo '===== B-7.4 feature_flags da Sanchez ====='
SELECT feature_key, override, updated_at
FROM public.feature_flags
WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
ORDER BY feature_key;

\echo '===== B-7.5 user_tenants da Sanchez ====='
SELECT user_id, role, is_primary
FROM public.user_tenants
WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab'
ORDER BY role;

\echo '===== B-7.6 contagens operacionais da Sanchez ====='
SELECT
  (SELECT count(*) FROM public.clients WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS clients,
  (SELECT count(*) FROM public.services WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS services,
  (SELECT count(*) FROM public.appointments WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS appointments,
  (SELECT count(*) FROM public.comandas WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS comandas,
  (SELECT count(*) FROM public.transactions WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS transactions,
  (SELECT count(*) FROM public.commissions WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS commissions,
  (SELECT count(*) FROM public.cash_closings WHERE tenant_id = 'b716e290-f7f6-4449-b790-5ae9dcdadcab') AS cash_closings;

-- ------------------------------------------------------------------------------
-- B-8. PRÉ-CONDIÇÃO F6-8 (120400): usuários que perderiam acesso
-- ------------------------------------------------------------------------------
-- 120400 exige status='active' em profiles E staff. Usuário ativo com
-- profile.status <> 'active' OU (sem profile active) staff.status <> 'active'
-- deixaria de resolver tenant → perda de acesso REST.
\echo '===== B-8.1 profiles com status <> active (por tenant) ====='
SELECT p.tenant_id, p.status, count(*) AS profiles
FROM public.profiles p
WHERE p.status IS DISTINCT FROM 'active'
GROUP BY p.tenant_id, p.status
ORDER BY p.tenant_id;

\echo '===== B-8.2 staff com status <> active (por tenant) ====='
SELECT s.tenant_id, s.status, count(*) AS staff
FROM public.staff s
WHERE s.status IS DISTINCT FROM 'active'
GROUP BY s.tenant_id, s.status
ORDER BY s.tenant_id;

\echo '===== B-8.3 usuarios ativos que dependem de staff para tenant (perfil sem tenant ativo) ====='
SELECT u.id, u.email, s.tenant_id, s.status AS staff_status
FROM auth.users u
JOIN public.staff s ON s.id = u.id
WHERE s.status IS DISTINCT FROM 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = u.id AND p.status = 'active'
  )
ORDER BY s.tenant_id;

\echo '===== B-8.4 resumo: usuarios com profile ativo porem staff inativo (ainda terao acesso via COALESCE) ====='
SELECT s.tenant_id, s.status AS staff_status, count(*) AS users
FROM public.staff s
JOIN public.profiles p ON p.id = s.id AND p.status = 'active'
WHERE s.status IS DISTINCT FROM 'active'
GROUP BY s.tenant_id, s.status
ORDER BY s.tenant_id;

-- ------------------------------------------------------------------------------
-- B-9. Kiosk/portal: colunas de services (produto-bug §9.3 / guarda IF EXISTS)
-- ------------------------------------------------------------------------------
\echo '===== B-9 colunas de public.services ====='
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
ORDER BY ordinal_position;

\echo '===== B-9.2 duration_minutes/is_active existem? (deve ser 0 linhas) ====='
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'services'
  AND column_name IN ('duration_minutes','is_active');

-- ------------------------------------------------------------------------------
-- B-10. Fase 4 (Event Store / Outbox) — migrations H-6 não devem afetar
-- ------------------------------------------------------------------------------
\echo '===== B-10.1 event_store ====='
SELECT count(*) AS total_events FROM public.event_store;

\echo '===== B-10.2 processed_operations (idempotency) ====='
SELECT count(*) AS total_processed FROM public.processed_operations;

\echo '===== B-10.3 RLS em event_store/processed_operations ====='
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('event_store','processed_operations');

-- ==============================================================================
-- FIM DO BASELINE READ-ONLY — nenhuma alteração de dados/schema foi executada.
-- ==============================================================================
