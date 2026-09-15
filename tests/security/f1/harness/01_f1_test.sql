-- =============================================================================
-- F1 harness — gate de segurança (seed + helpers + vetores + fluxos legítimos)
-- Aplicado DEPOIS da migration F1 (setup.ps1 faz stub -> migration -> este file).
-- Qualquer falha levanta F1HARNESS-FAIL e aborta com ON_ERROR_STOP=1 (exit != 0).
-- =============================================================================

-- =============================================================================
-- 1. SEED (inserções de sistema: GUC vazio -> auth.uid() IS NULL -> ALLOW)
--    Ordem importa: auth.users -> tenants -> staff -> profiles, porque o
--    trigger AFTER INSERT em profiles (handle_new_manager_profile) cria staff
--    e o WHERE NOT EXISTS evita duplicatas em relação ao staff já semeado.
-- =============================================================================

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('20000000-0000-0000-0000-000000000001', 'super@x.com',            '{"full_name":"Super"}'),
  ('20000000-0000-0000-0000-000000000002', 'admin@x.com',            '{"full_name":"Admin"}'),
  ('20000000-0000-0000-0000-000000000003', 'manager@x.com',          '{"full_name":"Manager"}'),
  ('20000000-0000-0000-0000-000000000004', 'barber@x.com',           '{"full_name":"Barber"}'),
  ('20000000-0000-0000-0000-000000000005', 'attack@x.com',           '{"full_name":"Attack1"}'),
  ('20000000-0000-0000-0000-000000000006', 'attack2@x.com',          '{"full_name":"Attack2"}'),
  ('20000000-0000-0000-0000-000000000007', 'convite@x.com',          '{"full_name":"Convite"}'),
  ('20000000-0000-0000-0000-000000000008', 'convite2@x.com',         '{"full_name":"Convite2"}'),
  ('20000000-0000-0000-0000-000000000009', 'novo.mgr@x.com',         '{"full_name":"Novo Mgr"}'),
  ('20000000-0000-0000-0000-00000000000a', 'legado@x.com',           '{"full_name":"Legado"}'),
  ('20000000-0000-0000-0000-00000000000b', 'super2@x.com',           '{"full_name":"Super2"}'),
  ('20000000-0000-0000-0000-00000000000c', 'sysboot@x.com',          '{"full_name":"Sysboot"}');

INSERT INTO public.tenants (id, name, slug) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Barbearia Central', 'central');

-- staff manual (id=uid para testes de self em staff; targets para terceiros)
INSERT INTO public.staff (id, tenant_id, name, email, role) VALUES
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Admin',    'admin@x.com',   'admin'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Barber',   'barber@x.com',  'barber'),
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Admin2',   'admin2@x.com',  'admin'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Mgr2',     'mgr2@x.com',    'manager'),
  ('30000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Barber2',  'barber2@x.com', 'barber'),
  ('30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Barber3',  'barber3@x.com', 'barber'),
  ('30000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Barber4',  'barber4@x.com', 'barber'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'Barber5',  'barber5@x.com', 'barber');

-- profiles (superadmin/manager/acima disparam handle_new_manager_profile;
-- NOT EXISTS por tenant+email bloqueia duplicatas do staff manual acima)
INSERT INTO public.profiles (id, tenant_id, full_name, role) VALUES
  ('20000000-0000-0000-0000-000000000001', NULL,    'Super',    'superadmin'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Admin',    'admin'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Manager',  'manager'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'Barber',   'barber'),
  ('20000000-0000-0000-0000-00000000000a', NULL,    'Legado',   'barber'),
  ('20000000-0000-0000-0000-00000000000b', NULL,    'Super2',   'superadmin');

-- =============================================================================
-- 2. HELPERS de teste
-- =============================================================================

-- Espera que p_sql levante erro contendo 'F1-SEC'. Falha: não levantou ou
-- levantou outro erro.
CREATE OR REPLACE FUNCTION public.f1_expect_block(p_sql TEXT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_msg TEXT;
BEGIN
  BEGIN
    EXECUTE p_sql;
    RAISE EXCEPTION 'F1HARNESS-FAIL: % — esperava BLOQUEIO, mas o comando passou', p_label;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
    IF v_msg LIKE 'F1HARNESS-FAIL%' THEN
      RAISE;
    END IF;
    IF position('F1-SEC' in v_msg) > 0 THEN
      RAISE NOTICE 'OK BLOQUEADO [%]: %', p_label, v_msg;
    ELSE
      RAISE EXCEPTION 'F1HARNESS-FAIL: % — erro diferente de F1-SEC: %', p_label, v_msg;
    END IF;
  END;
END;
$$;

-- Espera que p_sql seja permitido. Falha se levantar qualquer erro.
CREATE OR REPLACE FUNCTION public.f1_expect_ok(p_sql TEXT, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE p_sql;
  RAISE NOTICE 'OK PERMITIDO [%]', p_label;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'F1HARNESS-FAIL: % — fluxo legítimo bloqueado: %', p_label, SQLERRM;
END;
$$;

-- Assert de condição (contagens, estados).
CREATE OR REPLACE FUNCTION public.f1_assert_true(p_cond BOOLEAN, p_label TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_cond THEN
    RAISE NOTICE 'OK ASSERT [%]', p_label;
  ELSE
    RAISE EXCEPTION 'F1HARNESS-FAIL: assert falhou — %', p_label;
  END IF;
END;
$$;

-- =============================================================================
-- 3. VETORES DE SEGURANÇA (devem BLOQUEAR — hierarquia canônica)
-- =============================================================================

-- V1. barber TENTA promover outro barber -> manager (F1-a: novo rank >= chamador)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$UPDATE public.staff SET role = 'manager' WHERE id = '30000000-0000-0000-0000-000000000003'$q$,
    'V1 barber->promover barber a manager'
  );
END $$;

-- V2. barber TENTA criar staff com role manager (F1-b: rank pedido >= chamador)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'Novo', 'novo@x.com', 'manager')$q$,
    'V2 barber->criar staff manager'
  );
END $$;

-- V3. manager TENTA criar outro manager (F1-b: igual -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000003'); -- manager
  PERFORM public.f1_expect_block(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'MgrNovo', 'mgrnovo@x.com', 'manager')$q$,
    'V3 manager->criar outro manager'
  );
END $$;

-- V4. barber TENTA excluir outro barber (F1-c: igual -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000006'$q$,
    'V4 barber->excluir barber igual'
  );
END $$;

-- V5. manager TENTA excluir admin (F1-c: superior -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000003'); -- manager
  PERFORM public.f1_expect_block(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000001'$q$,
    'V5 manager->excluir admin superior'
  );
END $$;

-- V6. papel desconhecido em INSERT de staff (F1-b: rank 0 -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_block(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'Ceo', 'ceo@x.com', 'ceo')$q$,
    'V6 admin->criar staff com papel desconhecido'
  );
END $$;

-- V7. usuário TENTA se autodeclarar superadmin no profiles (F1-d INSERT self)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000005'); -- attack1 (sem profile)
  PERFORM public.f1_expect_block(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000005', NULL, 'Attack1', 'superadmin')$q$,
    'V7 autodeclaracao superadmin (perfil)'
  );
END $$;

-- V8. usuário TENTA se autodeclarar admin no profiles (F1-d INSERT self)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000006'); -- attack2 (sem profile)
  PERFORM public.f1_expect_block(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000006', NULL, 'Attack2', 'admin')$q$,
    'V8 autodeclaracao admin (perfil)'
  );
END $$;

-- V9. barber TENTA elevar o próprio perfil para admin (F1-d UPDATE self, tenant != NULL)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$UPDATE public.profiles SET role = 'admin' WHERE id = '20000000-0000-0000-0000-000000000004'$q$,
    'V9 barber->elevar proprio perfil a admin'
  );
END $$;

-- V10. barber TENTA elevar o próprio perfil para superadmin (F1-d UPDATE self)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$UPDATE public.profiles SET role = 'superadmin' WHERE id = '20000000-0000-0000-0000-000000000004'$q$,
    'V10 barber->elevar proprio perfil a superadmin'
  );
END $$;

-- V11. barber TENTA elevar o próprio staff (F1-a UPDATE self)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$UPDATE public.staff SET role = 'manager' WHERE id = '20000000-0000-0000-0000-000000000004'$q$,
    'V11 barber->elevar proprio staff'
  );
END $$;

-- V12. admin TENTA rebaixar outro admin (F1-a: OLD rank == chamador -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_block(
    $q$UPDATE public.staff SET role = 'manager' WHERE id = '30000000-0000-0000-0000-000000000001'$q$,
    'V12 admin->rebaixar outro admin'
  );
END $$;

-- V13. barber TENTA alterar papel de staff manager (F1-a: alvo superior)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_block(
    $q$UPDATE public.staff SET role = 'barber' WHERE id = '30000000-0000-0000-0000-000000000002'$q$,
    'V13 barber->alterar papel de manager'
  );
END $$;

-- V14. manager TENTA excluir outro manager (F1-c: igual -> bloqueia)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000003'); -- manager
  PERFORM public.f1_expect_block(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000002'$q$,
    'V14 manager->excluir outro manager'
  );
END $$;

-- V15. admin TENTA rebaixar perfil de superadmin (F1-d UPDATE terceiro: OLD rank 4)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_block(
    $q$UPDATE public.profiles SET role = 'manager' WHERE id = '20000000-0000-0000-0000-00000000000b'$q$,
    'V15 admin->rebaixar perfil superadmin'
  );
END $$;

-- =============================================================================
-- 4. FLUXOS LEGÍTIMOS (devem PASSAR)
-- =============================================================================

-- F1. accept_invite: perfil barber + staff self (id = auth.uid()), convite barbeiro
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000007'); -- convite
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000007',
               '10000000-0000-0000-0000-000000000001', 'Convite', 'barber')$q$,
    'F1 accept_invite->perfil barber self'
  );
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.staff (id, tenant_id, name, email, role)
       VALUES ('20000000-0000-0000-0000-000000000007',
               '10000000-0000-0000-0000-000000000001', 'Convite', 'convite@x.com', 'barber')$q$,
    'F1 accept_invite->staff barber self'
  );
END $$;

-- F2. accept_invite variante receptionist
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000008'); -- convite2
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000008',
               '10000000-0000-0000-0000-000000000001', 'Convite2', 'receptionist')$q$,
    'F2 accept_invite->perfil receptionist self'
  );
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.staff (id, tenant_id, name, email, role)
       VALUES ('20000000-0000-0000-0000-000000000008',
               '10000000-0000-0000-0000-000000000001', 'Convite2', 'convite2@x.com', 'receptionist')$q$,
    'F2 accept_invite->staff receptionist self'
  );
END $$;

-- F3. provision_new_tenant: INSERT perfil manager self + CADEIA handle_new_manager_profile
--     (trigger AFTER INSERT cria staff por EMAIL do chamador — F1-b self-by-email)
DO $$
DECLARE v_cnt INTEGER;
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000009'); -- novo.mgr
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000009',
               '10000000-0000-0000-0000-000000000001', 'Novo Mgr', 'manager')$q$,
    'F3 provision->perfil manager self'
  );
  SELECT count(*) INTO v_cnt FROM public.staff
    WHERE email = 'novo.mgr@x.com' AND role = 'manager'
      AND tenant_id = '10000000-0000-0000-0000-000000000001';
  PERFORM public.f1_assert_true(v_cnt = 1,
    'F3 provision->handle_new_manager_profile criou staff manager por email');
END $$;

-- F4. re-provision carve-out: perfil barber SEM tenant elevado a manager
--     (provision_new_tenant ON CONFLICT DO UPDATE; profiles.tenant_id nullable)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-00000000000a'); -- legado
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.profiles SET role = 'manager', tenant_id = '10000000-0000-0000-0000-000000000001'
       WHERE id = '20000000-0000-0000-0000-00000000000a'$q$,
    'F4 re-provision->perfil sem tenant promovido a manager'
  );
END $$;

-- F5. admin cria staff barber (F1-b terceiro: rank 1 < 3)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'NovoBarb', 'novobarb@x.com', 'barber')$q$,
    'F5 admin->criar staff barber'
  );
END $$;

-- F6. admin promove barber -> manager (F1-a: NEW rank 2 < 3, OLD rank 1 < 3)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.staff SET role = 'manager' WHERE id = '30000000-0000-0000-0000-000000000004'$q$,
    'F6 admin->promover barber a manager'
  );
END $$;

-- F7. admin rebaixa manager -> barber (F1-a: ambos abaixo do chamador)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.staff SET role = 'barber' WHERE id = '30000000-0000-0000-0000-000000000002'$q$,
    'F7 admin->rebaixar manager a barber'
  );
END $$;

-- F8. admin exclui staff barber (F1-c)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000003'$q$,
    'F8 admin->excluir staff barber'
  );
END $$;

-- F9. manager cria staff barber (F1-b: rank 1 < 2)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000003'); -- manager
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'BarbMgr', 'barbmgr@x.com', 'barber')$q$,
    'F9 manager->criar staff barber'
  );
END $$;

-- F10. manager exclui staff barber (F1-c)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000003'); -- manager
  PERFORM public.f1_expect_ok(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000005'$q$,
    'F10 manager->excluir staff barber'
  );
END $$;

-- F11. no-op de role em UPDATE (Team.tsx envia role em todo update) — após F7,
--      st_mgr2 já é barber; reenviar role='barber' deve passar (F1-a no-op)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.staff SET name = 'Mgr2 Editado', role = 'barber'
       WHERE id = '30000000-0000-0000-0000-000000000002'$q$,
    'F11 admin->editar staff com role inalterado'
  );
END $$;

-- F12. superadmin rebaixa perfil de outro superadmin (bypass total)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000001'); -- super
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.profiles SET role = 'manager' WHERE id = '20000000-0000-0000-0000-00000000000b'$q$,
    'F12 superadmin->rebaixar perfil de outro superadmin'
  );
END $$;

-- F13. sistema/service role (auth.uid() IS NULL): backfill de staff manager
DO $$
BEGIN
  PERFORM public.f1_set_system();
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.staff (tenant_id, name, email, role)
       VALUES ('10000000-0000-0000-0000-000000000001', 'Backfill', 'backfill@x.com', 'manager')$q$,
    'F13 sistema->backfill de staff manager'
  );
END $$;

-- F14. sistema cria perfil superadmin (admin-create-user com service key)
DO $$
BEGIN
  PERFORM public.f1_set_system();
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-00000000000c', NULL, 'Sysboot', 'superadmin')$q$,
    'F14 sistema->criar perfil superadmin'
  );
END $$;

-- F15. superadmin exclui staff admin (bypass total)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000001'); -- super
  PERFORM public.f1_expect_ok(
    $q$DELETE FROM public.staff WHERE id = '30000000-0000-0000-0000-000000000001'$q$,
    'F15 superadmin->excluir staff admin'
  );
END $$;

-- F16. barber edita o próprio staff com role inalterado (no-op self)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000004'); -- barber
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.staff SET name = 'Barber Editado', role = 'barber'
       WHERE id = '20000000-0000-0000-0000-000000000004'$q$,
    'F16 barber->editar proprio staff com role inalterado'
  );
END $$;

-- F17. admin rebaixa o PRÓPRIO staff (auto-demote permitido: r_new <= r_old)
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$UPDATE public.staff SET role = 'barber' WHERE id = '20000000-0000-0000-0000-000000000002'$q$,
    'F17 admin->rebaixar proprio staff'
  );
END $$;

-- F18. admin cria perfil de TERCEIRO (barber) — F1-d INSERT trd: rank 1 < 3
DO $$
BEGIN
  PERFORM public.f1_set_auth('20000000-0000-0000-0000-000000000002'); -- admin
  PERFORM public.f1_expect_ok(
    $q$INSERT INTO public.profiles (id, tenant_id, full_name, role)
       VALUES ('20000000-0000-0000-0000-000000000005',
               '10000000-0000-0000-0000-000000000001', 'Attack1', 'barber')$q$,
    'F18 admin->criar perfil barber de terceiro'
  );
END $$;

-- =============================================================================
-- 5. RESUMO — chegou até aqui = todas as validações passaram
-- =============================================================================
DO $$
BEGIN
  RAISE NOTICE 'F1 GATE PASSED — 15 vetores bloqueados, 18 fluxos legitimios aprovados';
END $$;