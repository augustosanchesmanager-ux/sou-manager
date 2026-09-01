import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createConfirmedUser,
  deleteUserByEmail,
  getAdminClient,
  loadEnvLocal,
} from '../helpers/supabaseAdmin';

/**
 * H-6.6-SEC — Regressão de segurança da RPC bulk_close_comandas_with_credits
 * (achado CRÍTICO F1.4 — RPC AUTH SWEEP 01/09/2026)
 *
 * Requer Supabase REAL (.env.local) e gate E2E_PROVISIONING=1.
 * Tenants E2E ISOLADOS — NUNCA Sanchez Barber, NUNCA dados reais.
 *
 * Verifica o comportamento fail-closed da RPC CORRIGIDA (migration
 * 20260901120000_seguranca_fix_bulk_close_comandas_with_credits.sql). Cada probe
 * usa EXPECTATION HARD (expect) do comportamento esperado; qualquer falha indica
 * que a migration de correção não está aplicada/efetiva.
 *
 * Matriz de autorização esperada (papel -> resultado na RPC):
 *   anon            -> DENY  (auth.uid() NULL)
 *   barber          -> DENY  (papel não gerencial)
 *   receptionist    -> DENY  (papel não gerencial)
 *   manager(NULL)   -> DENY  (p_tenant_id NULL rejeitado p/ não-superadmin)
 *   managerA(tenantB) -> DENY (tenant incompatível)
 *   managerA(IDs mistos A+B) -> DENY (fail-closed, lote inteiro)
 *   managerA(ID de tenantB)  -> DENY (IDOR cross-tenant)
 *   manager         -> ALLOW (papel gerencial + membership + tenant próprio)
 *   admin           -> ALLOW
 *   owner           -> ALLOW
 *   superadmin(CHECK) -> ALLOW (exceção explícita; NULL = todos os tenants)
 *
 * Segurança financeira (Fase 5 do gate F1.4):
 *   Em qualquer tentativa DENY, NENHUMA comanda é alterada, NENHUM crédito do
 *   Clube é consumido (membership_credit_effect ausente) e NENHUM efeito
 *   financeiro ocorre. Em fechamento ALLOW autorizado, o efeito de crédito
 *   acontece DENTRO do tenant correto.
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H6-2026!';
const runId = Date.now();

const emails = {
  managerA: `e2e-f14-${runId}-mgrA@gmail.com`,
  adminA: `e2e-f14-${runId}-admA@gmail.com`,
  ownerA: `e2e-f14-${runId}-ownA@gmail.com`,
  barberA: `e2e-f14-${runId}-barA@gmail.com`,
  receptionistA: `e2e-f14-${runId}-recA@gmail.com`,
  managerB: `e2e-f14-${runId}-mgrB@gmail.com`,
  superadmin: `e2e-f14-${runId}-ops@gmail.com`,
};

test.describe.configure({ mode: 'serial' });

test.describe('H6.6-SEC — bulk_close_comandas_with_credits autorização (REST, tenants isolados)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantA = '';
  let tenantB = '';
  let clientAId = '';
  let clientBId = '';
  let subscriptionAId = '';
  let creditsAId = '';
  let serviceAId = '';

  // comandas A: fechadas por manager/admin/owner; comandaB pertence ao tenant B;
  // comandaA_credit: com item de serviço (para validar consumo de crédito)
  let comandaA_mgr = '';
  let comandaA_adm = '';
  let comandaA_own = '';
  let comandaA_credit = '';
  let comandaB = '';
  let comandaB_credit = '';

  let managerA: SupabaseClient | null = null;
  let adminA: SupabaseClient | null = null;
  let ownerA: SupabaseClient | null = null;
  let barberA: SupabaseClient | null = null;
  let receptionistA: SupabaseClient | null = null;
  let managerB: SupabaseClient | null = null;
  let superadmin: SupabaseClient | null = null;
  let anon: SupabaseClient | null = null;

  async function signInSession(email: string, password: string): Promise<SupabaseClient> {
    const env = loadEnvLocal();
    const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
    const anonKey = env.VITE_SUPABASE_ANON_KEY;
    if (!url || !anonKey) throw new Error('E2E requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
    const client = createClient(url, anonKey, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`signInSession(${email}) failed: ${error.message}`);
    return client;
  }

  function a(): SupabaseClient {
    if (!managerA) throw new Error('managerA session not ready');
    return managerA;
  }
  function adm(): SupabaseClient {
    if (!adminA) throw new Error('adminA session not ready');
    return adminA;
  }
  function own(): SupabaseClient {
    if (!ownerA) throw new Error('ownerA session not ready');
    return ownerA;
  }
  function bar(): SupabaseClient {
    if (!barberA) throw new Error('barberA session not ready');
    return barberA;
  }
  function rec(): SupabaseClient {
    if (!receptionistA) throw new Error('receptionistA session not ready');
    return receptionistA;
  }
  function b(): SupabaseClient {
    if (!managerB) throw new Error('managerB session not ready');
    return managerB;
  }
  function sa(): SupabaseClient {
    if (!superadmin) throw new Error('superadmin session not ready');
    return superadmin;
  }
  function anonC(): SupabaseClient {
    if (!anon) throw new Error('anon client not ready');
    return anon;
  }

  async function openComanda(client: SupabaseClient, tenantId: string, clientId: string, total: number): Promise<string> {
    const r = await client
      .from('comandas')
      .insert({ tenant_id: tenantId, client_id: clientId, status: 'open', total })
      .select('id')
      .single();
    if (r.error || !r.data) throw new Error(`seed comanda failed: ${r.error?.message}`);
    return (r.data as { id: string }).id;
  }

  async function creditsFor(subscriptionId: string): Promise<number> {
    const r = await getAdminClient()
      .from('customer_credits')
      .select('available_credits')
      .eq('subscription_id', subscriptionId)
      .single();
    if (r.error || !r.data) throw new Error(`read credits failed: ${r.error?.message}`);
    return (r.data as { available_credits: number }).available_credits;
  }

  async function comandaStatus(id: string): Promise<string> {
    const r = await getAdminClient().from('comandas').select('status').eq('id', id).single();
    if (r.error || !r.data) throw new Error(`read comanda status failed: ${r.error?.message}`);
    return (r.data as { status: string }).status;
  }

  test.beforeAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    const env = loadEnvLocal();
    anon = createClient(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false },
    });

    const mkUser = async (email: string, tag: string) =>
      createConfirmedUser({ email, password: PASSWORD, userMetadata: { first_name: 'F14', last_name: tag } });

    const ua = await mkUser(emails.managerA, 'MgrA');
    const uadm = await mkUser(emails.adminA, 'AdmA');
    const uown = await mkUser(emails.ownerA, 'OwnA');
    const ubar = await mkUser(emails.barberA, 'BarA');
    const urec = await mkUser(emails.receptionistA, 'RecA');
    const ub = await mkUser(emails.managerB, 'MgrB');
    const us = await mkUser(emails.superadmin, 'Ops');

    const mk = async (name: string, slug: string, plan: string): Promise<string> => {
      const r = await admin
        .from('tenants')
        .insert({ name, slug, app_slug: 'barber', plan, status: 'active' })
        .select('id')
        .single();
      if (r.error || !r.data) throw new Error(`seed tenant ${name} failed: ${r.error?.message}`);
      return (r.data as { id: string }).id;
    };
    tenantA = await mk(`E2E F14 A ${runId}`, `e2e-f14-a-${runId}`, 'free');
    tenantB = await mk(`E2E F14 B ${runId}`, `e2e-f14-b-${runId}`, 'premium');
    const opsTenantId = await mk(`E2E F14 OPS ${runId}`, `e2e-f14-ops-${runId}`, 'pro');

    await admin.from('profiles').insert([
      { id: ua, tenant_id: tenantA, full_name: 'F14 Mgr A', role: 'manager', status: 'active', onboarding_completed: true },
      { id: uadm, tenant_id: tenantA, full_name: 'F14 Adm A', role: 'admin', status: 'active', onboarding_completed: true },
      { id: uown, tenant_id: tenantA, full_name: 'F14 Own A', role: 'owner', status: 'active', onboarding_completed: true },
      { id: ubar, tenant_id: tenantA, full_name: 'F14 Bar A', role: 'barber', status: 'active', onboarding_completed: true },
      { id: urec, tenant_id: tenantA, full_name: 'F14 Rec A', role: 'receptionist', status: 'active', onboarding_completed: true },
      { id: ub, tenant_id: tenantB, full_name: 'F14 Mgr B', role: 'manager', status: 'active', onboarding_completed: true },
      { id: us, tenant_id: opsTenantId, full_name: 'F14 Ops', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    await admin.from('user_tenants').insert([
      { user_id: ua, tenant_id: tenantA, role: 'manager', is_primary: true },
      { user_id: uadm, tenant_id: tenantA, role: 'admin', is_primary: true },
      { user_id: uown, tenant_id: tenantA, role: 'owner', is_primary: true },
      { user_id: ubar, tenant_id: tenantA, role: 'barber', is_primary: true },
      { user_id: urec, tenant_id: tenantA, role: 'receptionist', is_primary: true },
      { user_id: ub, tenant_id: tenantB, role: 'manager', is_primary: true },
      { user_id: us, tenant_id: opsTenantId, role: 'superadmin', is_primary: true },
    ]);
    await admin.from('staff').insert([
      { id: ua, name: 'F14 Mgr A', email: emails.managerA, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: uadm, name: 'F14 Adm A', email: emails.adminA, phone: '', role: 'admin', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: uown, name: 'F14 Own A', email: emails.ownerA, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: ubar, name: 'F14 Bar A', email: emails.barberA, phone: '', role: 'barber', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: urec, name: 'F14 Rec A', email: emails.receptionistA, phone: '', role: 'receptionist', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: ub, name: 'F14 Mgr B', email: emails.managerB, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantB },
      { id: us, name: 'F14 Ops', email: emails.superadmin, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: opsTenantId },
    ]);

    const clA = await admin.from('clients').insert({ tenant_id: tenantA, name: 'F14 Client A', phone: '11980000001' }).select('id').single();
    if (clA.error || !clA.data) throw new Error(`seed clientA failed: ${clA.error?.message}`);
    clientAId = (clA.data as { id: string }).id;
    const clB = await admin.from('clients').insert({ tenant_id: tenantB, name: 'F14 Client B', phone: '11980000002' }).select('id').single();
    if (clB.error || !clB.data) throw new Error(`seed clientB failed: ${clB.error?.message}`);
    clientBId = (clB.data as { id: string }).id;

    // Serviço (obrigatório p/ consumo de crédito; comanda_items precisa de service_id)
    const svc = await admin.from('services').insert({ tenant_id: tenantA, name: 'F14 Service A', price: 50, duration_minutes: 30, active: true }).select('id').single();
    if (svc.error || !svc.data) throw new Error(`seed service failed: ${svc.error?.message}`);
    serviceAId = (svc.data as { id: string }).id;

    // Plano + assinatura ativa + créditos disponíveis para clientA
    const plan = await admin
      .from('customer_plans')
      .insert({ tenant_id: tenantA, name: 'F14 Plan A', monthly_price: 99, service_credits: 10, active: true })
      .select('id')
      .single();
    if (plan.error || !plan.data) throw new Error(`seed plan failed: ${plan.error?.message}`);
    const planId = (plan.data as { id: string }).id;

    const sub = await admin
      .from('customer_subscriptions')
      .insert({ tenant_id: tenantA, client_id: clientAId, plan_id: planId, status: 'active' })
      .select('id')
      .single();
    if (sub.error || !sub.data) throw new Error(`seed subscription failed: ${sub.error?.message}`);
    subscriptionAId = (sub.data as { id: string }).id;

    const cred = await admin
      .from('customer_credits')
      .insert({ tenant_id: tenantA, subscription_id: subscriptionAId, client_id: clientAId, available_credits: 5, used_credits: 0 })
      .select('id')
      .single();
    if (cred.error || !cred.data) throw new Error(`seed credits failed: ${cred.error?.message}`);
    creditsAId = (cred.data as { id: string }).id;

    managerA = await signInSession(emails.managerA, PASSWORD);
    adminA = await signInSession(emails.adminA, PASSWORD);
    ownerA = await signInSession(emails.ownerA, PASSWORD);
    barberA = await signInSession(emails.barberA, PASSWORD);
    receptionistA = await signInSession(emails.receptionistA, PASSWORD);
    managerB = await signInSession(emails.managerB, PASSWORD);
    superadmin = await signInSession(emails.superadmin, PASSWORD);

    comandaA_mgr = await openComanda(a(), tenantA, clientAId, 10);
    comandaA_adm = await openComanda(a(), tenantA, clientAId, 20);
    comandaA_own = await openComanda(a(), tenantA, clientAId, 30);
    comandaA_credit = await openComanda(a(), tenantA, clientAId, 40);
    comandaB = await openComanda(b(), tenantB, clientBId, 50);
    comandaB_credit = await openComanda(b(), tenantB, clientBId, 60);

    // comanda_items para o consumo de crédito (comandaA_credit -> serviceA)
    const ci = await a()
      .from('comanda_items')
      .insert({ comanda_id: comandaA_credit, service_id: serviceAId, quantity: 1, unit_price: 40, client_id: clientAId })
      .select('id');
    if (ci.error) throw new Error(`seed comanda_item failed: ${ci.error?.message}`);

    console.log(`[h6f14] seeded A=${tenantA} B=${tenantB} ops=${opsTenantId} sub=${subscriptionAId} creds=${creditsAId} cmA_mgr=${comandaA_mgr} cmA_adm=${comandaA_adm} cmA_own=${comandaA_own} cmA_credit=${comandaA_credit} cmB=${comandaB}`);
  });

  test.afterAll(async () => {
    if (!enabled) return;
    try {
      const admin = getAdminClient();
      await admin.from('comanda_items').delete().eq('comanda_id', comandaA_credit);
      await admin.from('comandas').delete().in('id', [comandaA_mgr, comandaA_adm, comandaA_own, comandaA_credit, comandaB, comandaB_credit]);
      await admin.from('customer_credits').delete().eq('id', creditsAId);
      await admin.from('customer_subscriptions').delete().eq('id', subscriptionAId);
      await admin.from('customer_plans').delete().eq('tenant_id', tenantA);
      await admin.from('services').delete().eq('tenant_id', tenantA);
      await admin.from('clients').delete().in('id', [clientAId, clientBId]);
      await admin.from('staff').delete().eq('tenant_id', tenantA);
      await admin.from('staff').delete().eq('tenant_id', tenantB);
      await admin.from('user_tenants').delete().eq('tenant_id', tenantA);
      await admin.from('user_tenants').delete().eq('tenant_id', tenantB);
      await admin.from('profiles').delete().eq('tenant_id', tenantA);
      await admin.from('profiles').delete().eq('tenant_id', tenantB);
      await admin.from('tenants').delete().in('id', [tenantA, tenantB]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      console.log('[h6f14] teardown complete');
    } catch (err) {
      console.warn('[h6f14] teardown incomplete (left for operator cleanup):', err);
    }
  });

  // ─── DENY ────────────────────────────────────────────────────────────────
  // 1) anon -> DENY
  test('SEC-1 anon: execução bloqueada', async () => {
    const res = await anonC().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_mgr],
      p_tenant_id: tenantA,
      p_closure_note: 'anon',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `anon.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    expect(await comandaStatus(comandaA_mgr)).toBe('open');
  });

  // 2) barber -> DENY (papel não gerencial)
  test('SEC-2 barber: execução bloqueada, comanda intocada', async () => {
    const res = await bar().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_own],
      p_tenant_id: tenantA,
      p_closure_note: 'barber',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `barber.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    expect(await comandaStatus(comandaA_own)).toBe('open');
  });

  // 3) receptionist -> DENY
  test('SEC-3 receptionist: execução bloqueada, comanda intocada', async () => {
    const res = await rec().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_own],
      p_tenant_id: tenantA,
      p_closure_note: 'receptionist',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `receptionist.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    expect(await comandaStatus(comandaA_own)).toBe('open');
  });

  // 4) manager com p_tenant_id NULL -> DENY (regra F1.4: NULL só superadmin)
  test('SEC-4 manager com p_tenant_id NULL: bloqueado', async () => {
    const before = await creditsFor(subscriptionAId);
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_credit],
      p_tenant_id: null,
      p_closure_note: 'null-tenant',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `manager p_tenant_id=NULL deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    // Fase 5: nenhuma comanda alterada, nenhum crédito consumido
    expect(await comandaStatus(comandaA_credit)).toBe('open');
    expect(await creditsFor(subscriptionAId)).toBe(before);
  });

  // 5) managerA operando tenant B (p_tenant_id=B) -> DENY
  test('SEC-5 managerA fechando comanda do tenantB: bloqueado', async () => {
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaB],
      p_tenant_id: tenantB,
      p_closure_note: 'cross-tenant',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `managerA.rpc(tenantB) deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    expect(await comandaStatus(comandaB)).toBe('open');
  });

  // 6) IDs mistos A+B no mesmo lote -> DENY (fail-closed)
  test('SEC-6 managerA com IDs mistos (A+B): bloqueado, lote inteiro', async () => {
    const before = await creditsFor(subscriptionAId);
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_own, comandaB],
      p_tenant_id: tenantA,
      p_closure_note: 'mixed-ids',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `managerA.rpc(IDs mistos) deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    // Nenhuma comanda do lote alterada (nem a própria, nem a de outro tenant)
    expect(await comandaStatus(comandaA_own)).toBe('open');
    expect(await comandaStatus(comandaB)).toBe('open');
    // Nenhum crédito do tenant A consumido
    expect(await creditsFor(subscriptionAId)).toBe(before);
  });

  // 7) ID de outro tenant isolado -> DENY (IDOR cross-tenant)
  test('SEC-7 managerA com ID do tenantB: bloqueado', async () => {
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaB_credit],
      p_tenant_id: tenantA,
      p_closure_note: 'idor-id',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `managerA.rpc(ID de B) deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    expect(await comandaStatus(comandaB_credit)).toBe('open');
  });

  // 8) comanda inexistente -> comportamento seguro (sem erro, count 0) — ALLOW
  test('SEC-8 comanda inexistente: retorno seguro count 0', async () => {
    const ghost = '00000000-0000-0000-0000-000000000000';
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [ghost],
      p_tenant_id: tenantA,
      p_closure_note: 'ghost',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `comanda inexistente: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(0);
  });

  // ─── ALLOW ───────────────────────────────────────────────────────────────
  // 9) manager autorizado -> ALLOW + consumo de crédito no tenant correto
  test('SEC-9 manager: fecha comanda com crédito do próprio tenant', async () => {
    const before = await creditsFor(subscriptionAId);
    expect(before).toBeGreaterThan(0);
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_credit],
      p_tenant_id: tenantA,
      p_closure_note: 'manager-allowed',
      p_payment_method: 'Club dos Chefes',
      p_apply_credits: true,
    });
    expect(res.error, `manager.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    const after = await getAdminClient()
      .from('comandas')
      .select('status, closure_mode, financial_effect, membership_credit_effect, payment_method')
      .eq('id', comandaA_credit)
      .single();
    const row = after.data as { status: string; closure_mode: string; financial_effect: boolean; membership_credit_effect: boolean; payment_method: string };
    expect(row.status).toBe('paid');
    expect(row.closure_mode).toBe('standard');
    expect(row.financial_effect).toBe(true);
    expect(row.membership_credit_effect).toBe(true);
    expect(row.payment_method).toBe('Club dos Chefes');
    // Efeito de crédito DENTRO do tenant correto: available decresceu
    expect(await creditsFor(subscriptionAId)).toBe(before - 1);
  });

  // 10) admin autorizado -> ALLOW
  test('SEC-10 admin: fecha comanda do próprio tenant', async () => {
    const res = await adm().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_adm],
      p_tenant_id: tenantA,
      p_closure_note: 'admin-allowed',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `admin.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    expect(await comandaStatus(comandaA_adm)).toBe('paid');
  });

  // 11) owner autorizado -> ALLOW
  test('SEC-11 owner: fecha comanda do próprio tenant', async () => {
    const res = await own().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_own],
      p_tenant_id: tenantA,
      p_closure_note: 'owner-allowed',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `owner.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    expect(await comandaStatus(comandaA_own)).toBe('paid');
  });

  // 12) superadmin via p_tenant_id NULL (regra de domínio: NULL = todos) -> ALLOW
  test('SEC-12 superadmin: fecha comanda via p_tenant_id NULL', async () => {
    const cmNew = await openComanda(b(), tenantB, clientBId, 70);
    const res = await sa().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [cmNew],
      p_tenant_id: null,
      p_closure_note: 'superadmin-all',
      p_payment_method: 'Dinheiro',
      p_apply_credits: true,
    });
    expect(res.error, `superadmin.rpc(NULL) deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect(await comandaStatus(cmNew)).toBe('paid');
    await getAdminClient().from('comandas').delete().eq('id', cmNew);
  });

  // 13) manager: fechamento sem consumo de crédito quando apply_credits=false
  test('SEC-13 manager com p_apply_credits=false: fecha sem consumir crédito', async () => {
    const before = await creditsFor(subscriptionAId);
    const res = await a().rpc('bulk_close_comandas_with_credits', {
      p_comanda_ids: [comandaA_mgr],
      p_tenant_id: tenantA,
      p_closure_note: 'no-credits',
      p_payment_method: 'Dinheiro',
      p_apply_credits: false,
    });
    expect(res.error, `manager.rpc(apply_credits=false) deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    expect(await comandaStatus(comandaA_mgr)).toBe('paid');
    expect(await creditsFor(subscriptionAId)).toBe(before);
  });
});
