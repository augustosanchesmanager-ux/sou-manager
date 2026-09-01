import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createConfirmedUser,
  deleteUserByEmail,
  getAdminClient,
  loadEnvLocal,
} from '../helpers/supabaseAdmin';

/**
 * H-6.5-SEC — Regressão de segurança da RPC bulk_close_comandas_admin
 * (achado CRÍTICO F1.1/F3.1 — auditoria 31/08/2026)
 *
 * Requer Supabase REAL (.env.local) e gate E2E_PROVISIONING=1.
 * Tenants E2E ISOLADOS (D-HOM-19) — NUNCA Sanchez Barber, NUNCA dados reais.
 *
 * Verifica o comportamento fail-closed da RPC CORRIGIDA (migration
 * 20260831120000_seguranca_fix_bulk_close_comandas_admin.sql). Cada probe usa
 * EXPECTATION HARD (expect) do comportamento esperado; qualquer falha indica
 * que a migration de correção não está aplicada/efetiva.
 *
 * Matriz de autorização esperada (papel -> resultado na RPC):
 *   anon            -> DENY  (auth.uid() NULL)
 *   barber          -> DENY  (papel não gerencial)
 *   receptionist    -> DENY  (papel não gerencial)
 *   manager         -> ALLOW (papel gerencial + membership)
 *   admin           -> ALLOW (papel gerencial)
 *   owner           -> ALLOW (papel gerencial)
 *   superadmin      -> ALLOW (exceção explícita; NULL = todos os tenants)
 * Cobertura adicional:
 *   p_tenant_id NULL (não-superadmin)  -> DENY
 *   Tenant A operando comanda de Tenant B -> DENY
 *   IDs de tenants diferentes no mesmo lote -> DENY
 *   tenant correto + IDs corretos -> ALLOW
 *   comanda inexistente -> comportamento seguro (sem erro, count 0)
 *   nenhuma alteração financeira fora do escopo (sem transaction criada)
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H6-2026!';
const runId = Date.now();

const emails = {
  managerA: `e2e-sec-${runId}-mgrA@gmail.com`,
  adminA: `e2e-sec-${runId}-admA@gmail.com`,
  ownerA: `e2e-sec-${runId}-ownA@gmail.com`,
  barberA: `e2e-sec-${runId}-barA@gmail.com`,
  receptionistA: `e2e-sec-${runId}-recA@gmail.com`,
  managerB: `e2e-sec-${runId}-mgrB@gmail.com`,
  superadmin: `e2e-sec-${runId}-ops@gmail.com`,
};

test.describe.configure({ mode: 'serial' });

test.describe('H6.5-SEC — bulk_close_comandas_admin autorização (REST, tenants isolados)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantA = '';
  let tenantB = '';
  let clientAId = '';
  let clientBId = '';

  let comandaA_mgr = '';  // fechada por manager
  let comandaA_adm = '';  // fechada por admin
  let comandaA_own = '';  // fechada por owner
  let comandaB = '';      // pertence ao tenant B

  let managerA: SupabaseClient | null = null;
  let adminA: SupabaseClient | null = null;
  let ownerA: SupabaseClient | null = null;
  let barberA: SupabaseClient | null = null;
  let receptionistA: SupabaseClient | null = null;
  let managerB: SupabaseClient | null = null;
  let superadmin: SupabaseClient | null = null;
  let anon: SupabaseClient | null = null;

  // Cliente de sessão tipado como `SupabaseClient` puro (como b34h), para o .rpc
  // resolver os overloads corretamente; idêntico ao fluxo anon + signInWithPassword.
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

  test.beforeAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    const env = loadEnvLocal();
    anon = createClient(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false },
    });

    const mkUser = async (email: string, tag: string) =>
      createConfirmedUser({ email, password: PASSWORD, userMetadata: { first_name: 'SEC', last_name: tag } });

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
    tenantA = await mk(`E2E SEC A ${runId}`, `e2e-sec-a-${runId}`, 'free');
    tenantB = await mk(`E2E SEC B ${runId}`, `e2e-sec-b-${runId}`, 'premium');
    const opsTenantId = await mk(`E2E SEC OPS ${runId}`, `e2e-sec-ops-${runId}`, 'pro');

    // profiles (papel + tenant), user_tenants (membership) e staff (fallback role)
    await admin.from('profiles').insert([
      { id: ua, tenant_id: tenantA, full_name: 'SEC Mgr A', role: 'manager', status: 'active', onboarding_completed: true },
      { id: uadm, tenant_id: tenantA, full_name: 'SEC Adm A', role: 'admin', status: 'active', onboarding_completed: true },
      { id: uown, tenant_id: tenantA, full_name: 'SEC Own A', role: 'owner', status: 'active', onboarding_completed: true },
      { id: ubar, tenant_id: tenantA, full_name: 'SEC Bar A', role: 'barber', status: 'active', onboarding_completed: true },
      { id: urec, tenant_id: tenantA, full_name: 'SEC Rec A', role: 'receptionist', status: 'active', onboarding_completed: true },
      { id: ub, tenant_id: tenantB, full_name: 'SEC Mgr B', role: 'manager', status: 'active', onboarding_completed: true },
      { id: us, tenant_id: opsTenantId, full_name: 'SEC Ops', role: 'superadmin', status: 'active', onboarding_completed: true },
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
      { id: ua, name: 'SEC Mgr A', email: emails.managerA, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: uadm, name: 'SEC Adm A', email: emails.adminA, phone: '', role: 'admin', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: uown, name: 'SEC Own A', email: emails.ownerA, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: ubar, name: 'SEC Bar A', email: emails.barberA, phone: '', role: 'barber', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: urec, name: 'SEC Rec A', email: emails.receptionistA, phone: '', role: 'receptionist', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: ub, name: 'SEC Mgr B', email: emails.managerB, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantB },
      { id: us, name: 'SEC Ops', email: emails.superadmin, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: opsTenantId },
    ]);

    const clA = await admin.from('clients').insert({ tenant_id: tenantA, name: 'SEC Client A', phone: '11970000001' }).select('id').single();
    if (clA.error || !clA.data) throw new Error(`seed clientA failed: ${clA.error?.message}`);
    clientAId = (clA.data as { id: string }).id;
    const clB = await admin.from('clients').insert({ tenant_id: tenantB, name: 'SEC Client B', phone: '11970000002' }).select('id').single();
    if (clB.error || !clB.data) throw new Error(`seed clientB failed: ${clB.error?.message}`);
    clientBId = (clB.data as { id: string }).id;

    // Comandas só podem ser semeadas via sessão autenticada (trigger exige auth.uid()).
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
    comandaB = await openComanda(b(), tenantB, clientBId, 40);

    console.log(`[h6sec] seeded A=${tenantA} B=${tenantB} ops=${opsTenantId} cmA_mgr=${comandaA_mgr} cmA_adm=${comandaA_adm} cmA_own=${comandaA_own} cmB=${comandaB}`);
  });

  test.afterAll(async () => {
    if (!enabled) return;
    try {
      const admin = getAdminClient();
      await admin.from('comandas').delete().eq('id', comandaA_mgr);
      await admin.from('comandas').delete().eq('id', comandaA_adm);
      await admin.from('comandas').delete().eq('id', comandaA_own);
      await admin.from('comandas').delete().eq('id', comandaB);
      await admin.from('clients').delete().eq('id', clientAId);
      await admin.from('clients').delete().eq('id', clientBId);
      await admin.from('staff').delete().eq('tenant_id', tenantA);
      await admin.from('staff').delete().eq('tenant_id', tenantB);
      await admin.from('staff').delete().in('id', []); // no-op guard
      await admin.from('user_tenants').delete().eq('tenant_id', tenantA);
      await admin.from('user_tenants').delete().eq('tenant_id', tenantB);
      await admin.from('profiles').delete().eq('tenant_id', tenantA);
      await admin.from('profiles').delete().eq('tenant_id', tenantB);
      await admin.from('tenants').delete().eq('id', tenantA);
      await admin.from('tenants').delete().eq('id', tenantB);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      console.log('[h6sec] teardown complete');
    } catch (err) {
      console.warn('[h6sec] teardown incomplete (left for operator cleanup):', err);
    }
  });

  // 1) Não autenticado -> DENY
  test('SEC-1 anon: execução bloqueada (auth.uid NULL + sem grant)', async () => {
    const res = await anonC().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_mgr],
      p_tenant_id: tenantA,
      p_closure_note: 'anon',
    });
    expect(res.error, `anon.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
  });

  // 2) barber -> DENY (papel não gerencial)
  test('SEC-2 barber: execução bloqueada', async () => {
    const res = await bar().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaB],
      p_tenant_id: tenantA,
      p_closure_note: 'barber',
    });
    expect(res.error, `barber.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    const after = await getAdminClient().from('comandas').select('status').eq('id', comandaB).single();
    expect((after.data as { status: string })?.status).toBe('open');
  });

  // 3) receptionist -> DENY (papel não gerencial)
  test('SEC-3 receptionist: execução bloqueada', async () => {
    const res = await rec().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaB],
      p_tenant_id: tenantA,
      p_closure_note: 'receptionist',
    });
    expect(res.error, `receptionist.rpc deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    const after = await getAdminClient().from('comandas').select('status').eq('id', comandaB).single();
    expect((after.data as { status: string })?.status).toBe('open');
  });

  // 8) p_tenant_id NULL (não-superadmin) -> DENY
  test('SEC-4 manager com p_tenant_id NULL: bloqueado', async () => {
    const res = await a().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_mgr],
      p_tenant_id: null,
      p_closure_note: 'null-tenant',
    });
    expect(res.error, `manager p_tenant_id=NULL deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
  });

  // 9) Tenant A operando comanda do Tenant B (tenant_id=B) -> DENY
  test('SEC-5 managerA fechando comanda do tenantB (p_tenant_id=B): bloqueado', async () => {
    const res = await a().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaB],
      p_tenant_id: tenantB,
      p_closure_note: 'cross-tenant',
    });
    expect(res.error, `managerA.rpc(tenantB) deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    const after = await getAdminClient().from('comandas').select('status').eq('id', comandaB).single();
    expect((after.data as { status: string })?.status).toBe('open');
  });

  // 10) IDs de tenants diferentes no mesmo lote -> DENY
  test('SEC-6 managerA com IDs mistos (A+B): bloqueado', async () => {
    const res = await a().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_own, comandaB],
      p_tenant_id: tenantA,
      p_closure_note: 'mixed-ids',
    });
    expect(res.error, `managerA.rpc(IDs mistos) deveria falhar: ${JSON.stringify(res)}`).not.toBeNull();
    const afterOwn = await getAdminClient().from('comandas').select('status').eq('id', comandaA_own).single();
    const afterB = await getAdminClient().from('comandas').select('status').eq('id', comandaB).single();
    expect((afterOwn.data as { status: string })?.status).toBe('open');
    expect((afterB.data as { status: string })?.status).toBe('open');
  });

  // 4) manager autorizado -> ALLOW
  test('SEC-7 manager: fecha comanda do próprio tenant', async () => {
    const res = await a().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_mgr],
      p_tenant_id: tenantA,
      p_closure_note: 'manager-allowed',
      p_legacy_reference_month: '2026-07-01',
    });
    expect(res.error, `manager.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    const after = await getAdminClient()
      .from('comandas')
      .select('status, closure_mode, financial_effect, legacy_reference_month')
      .eq('id', comandaA_mgr)
      .single();
    const row = after.data as { status: string; closure_mode: string; financial_effect: boolean; legacy_reference_month: string | null };
    expect(row.status).toBe('paid');
    expect(row.closure_mode).toBe('legacy_membership');
    expect(row.financial_effect).toBe(false);
    expect(row.legacy_reference_month).toBe('2026-07-01');
  });

  // 5) admin autorizado -> ALLOW
  test('SEC-8 admin: fecha comanda do próprio tenant', async () => {
    const res = await adm().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_adm],
      p_tenant_id: tenantA,
      p_closure_note: 'admin-allowed',
    });
    expect(res.error, `admin.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    const after = await getAdminClient().from('comandas').select('status').eq('id', comandaA_adm).single();
    expect((after.data as { status: string })?.status).toBe('paid');
  });

  // 6) owner autorizado -> ALLOW
  test('SEC-9 owner: fecha comanda do próprio tenant', async () => {
    const res = await own().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [comandaA_own],
      p_tenant_id: tenantA,
      p_closure_note: 'owner-allowed',
    });
    expect(res.error, `owner.rpc deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(1);
    const after = await getAdminClient().from('comandas').select('status').eq('id', comandaA_own).single();
    expect((after.data as { status: string })?.status).toBe('paid');
  });

  // 7) superadmin (regra existente: p_tenant_id NULL = todos os tenants) -> ALLOW
  test('SEC-10 superadmin: fecha comanda via p_tenant_id NULL', async () => {
    const cmNew = await openComanda(b(), tenantB, clientBId, 50);
    const res = await sa().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [cmNew],
      p_tenant_id: null,
      p_closure_note: 'superadmin-all',
    });
    const after = await getAdminClient().from('comandas').select('status').eq('id', cmNew).single();
    expect(res.error, `superadmin.rpc(NULL) deveria funcionar: ${JSON.stringify(res)}`).toBeNull();
    expect((after.data as { status: string })?.status).toBe('paid');
    await getAdminClient().from('comandas').delete().eq('id', cmNew);
  });

  // 11) tenant correto + IDs corretos -> ALLOW (já coberto por SEC-7/8/9);
  // 12) comanda inexistente -> comportamento seguro (sem erro, count 0, sem mutação)
  test('SEC-11 comanda inexistente: retorno seguro count 0', async () => {
    const ghost = '00000000-0000-0000-0000-000000000000';
    const res = await a().rpc('bulk_close_comandas_admin', {
      p_comanda_ids: [ghost],
      p_tenant_id: tenantA,
      p_closure_note: 'ghost',
    });
    // Comanda inexistente NÃO é erro: retorna success com updated_count 0.
    expect(res.error, `comanda inexistente: ${JSON.stringify(res)}`).toBeNull();
    expect((res.data as { updated_count?: number })?.updated_count).toBe(0);
  });

  // 13) nenhuma alteração financeira fora do escopo: fechamento admin NÃO cria transaction
  test('SEC-12 fechamento admin não cria transação financeira', async () => {
    const txs = await getAdminClient()
      .from('transactions')
      .select('id')
      .eq('source_type', 'comanda')
      .eq('source_id', comandaA_mgr);
    expect(txs.error).toBeNull();
    expect(txs.data ?? []).toHaveLength(0);
  });
});
