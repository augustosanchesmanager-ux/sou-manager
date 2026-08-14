import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  createConfirmedUser,
  deleteUserByEmail,
  getAdminClient,
  loadEnvLocal,
} from '../helpers/supabaseAdmin';
import { signInAsUser } from '../helpers/supabaseUser';

/**
 * H-6.5 — Probes de segurança FAIL-CLOSED (pós-aplicação das 10 migrations H-6)
 *
 * Requer Supabase REAL (.env.local) e gate E2E_PROVISIONING=1.
 * Tenants E2E ISOLADOS (D-HOM-19) — NUNCA Sanchez Barber, NUNCA dados reais.
 *
 * DIFERENÇA vs h6-security.spec.ts (auditoria adversarial que COLETA achados):
 * esta suite é a VERIFICAÇÃO do comportamento correto PÓS-FIX. Cada probe usa
 * EXPECTATION HARD (expect) do comportamento fail-closed que as 10 migrations
 * devem garantir. Rodar SOMENTE após a aplicação das migrations; se qualquer
 * probe falhar, a migration correspondente NÃO está aplicada/efetiva.
 *
 * Cobertura (7 probes):
 *   P-1 cross-tenant: managerA NÃO lê clientes/serviços de tenantB (RLS)
 *   P-2 anon: anon NÃO lê profiles; lê apenas subconjunto público de tenants
 *      (id,name,slug,status) e services de tenants ativos
 *   P-3 autenticado: managerA lê clientes da PRÓPRIA tenant (fluxo legítimo)
 *   P-4 RPC protegida: tenant_has_feature(tenantB) -> false; get_role_permissions(tenantB) -> erro
 *   P-5 manipulação de tenant_id: INSERT com tenant_id de OUTRA tenant bloqueado (RLS)
 *   P-6 ticket_messages: managerA NÃO lê/insere mensagens de tenantB
 *   P-7 close_order: authenticated NÃO executa close_order (revoked) + anon NÃO executa
 *
 * Setup: cria tenants A e B isolados + managerA (tenant A) + managerB (tenant B) +
 * superadmin OPS. Nenhum dado é tocado em produção.
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H6-2026!';
const runId = Date.now();

const emails = {
  managerA: `e2e-h65-${runId}-a@gmail.com`,
  managerB: `e2e-h65-${runId}-b@gmail.com`,
  superadmin: `e2e-h65-${runId}-ops@gmail.com`,
};

test.describe.configure({ mode: 'serial' });

test.describe('H6.5 — Probes de segurança fail-closed (REST, tenants isolados)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantA = '';
  let tenantB = '';
  let clientAId = '';
  let clientBId = '';
  let serviceAId = '';
  let serviceBId = '';
  let ticketBId = '';

  let managerA: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let managerB: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let anon: ReturnType<typeof createClient> | null = null;

  function a(): NonNullable<typeof managerA> {
    if (!managerA) throw new Error('managerA session not ready');
    return managerA;
  }
  function b(): NonNullable<typeof managerB> {
    if (!managerB) throw new Error('managerB session not ready');
    return managerB;
  }
  function anonC(): NonNullable<typeof anon> {
    if (!anon) throw new Error('anon client not ready');
    return anon;
  }
  async function rpcLoose(
    client: unknown,
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> {
    const c = client as {
      rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
    };
    return c.rpc(fn, args);
  }

  test.beforeAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    const env = loadEnvLocal();
    anon = createClient(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false },
    }) as unknown as ReturnType<typeof createClient>;

    const ua = await createConfirmedUser({
      email: emails.managerA,
      password: PASSWORD,
      userMetadata: { first_name: 'H6.5', last_name: 'ManagerA' },
    });
    const ub = await createConfirmedUser({
      email: emails.managerB,
      password: PASSWORD,
      userMetadata: { first_name: 'H6.5', last_name: 'ManagerB' },
    });
    const us = await createConfirmedUser({
      email: emails.superadmin,
      password: PASSWORD,
      userMetadata: { first_name: 'H6.5', last_name: 'Ops' },
    });

    const mk = async (name: string, slug: string, plan: string, status = 'active'): Promise<string> => {
      const r = await admin
        .from('tenants')
        .insert({ name, slug, app_slug: 'barber', plan, status })
        .select('id')
        .single();
      if (r.error || !r.data) throw new Error(`seed tenant ${name} failed: ${r.error?.message}`);
      return (r.data as { id: string }).id;
    };
    tenantA = await mk(`E2E H6.5 A ${runId}`, `e2e-h65-a-${runId}`, 'free');
    tenantB = await mk(`E2E H6.5 B ${runId}`, `e2e-h65-b-${runId}`, 'premium');
    const opsTenantId = await mk(`E2E H6.5 OPS ${runId}`, `e2e-h65-ops-${runId}`, 'pro');

    await admin.from('profiles').insert([
      { id: ua, tenant_id: tenantA, full_name: 'H6.5 Manager A', role: 'manager', status: 'active', onboarding_completed: true },
      { id: ub, tenant_id: tenantB, full_name: 'H6.5 Manager B', role: 'manager', status: 'active', onboarding_completed: true },
      { id: us, tenant_id: opsTenantId, full_name: 'H6.5 Superadmin', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    await admin.from('user_tenants').insert([
      { user_id: ua, tenant_id: tenantA, role: 'manager', is_primary: true },
      { user_id: ub, tenant_id: tenantB, role: 'manager', is_primary: true },
    ]);
    await admin.from('staff').insert([
      { id: ua, name: 'H6.5 Manager A', email: emails.managerA, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: ub, name: 'H6.5 Manager B', email: emails.managerB, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantB },
    ]);

    const clientA = await admin.from('clients').insert({ tenant_id: tenantA, name: 'Cliente A', phone: '11999990001', email: 'clientea@e2e.com', status: 'active' }).select('id').single();
    if (clientA.error || !clientA.data) throw new Error(`seed clientA failed: ${clientA.error?.message}`);
    clientAId = (clientA.data as { id: string }).id;
    const clientB = await admin.from('clients').insert({ tenant_id: tenantB, name: 'Cliente B', phone: '11999990002', email: 'clienteb@e2e.com', status: 'active' }).select('id').single();
    if (clientB.error || !clientB.data) throw new Error(`seed clientB failed: ${clientB.error?.message}`);
    clientBId = (clientB.data as { id: string }).id;

    const serviceA = await admin.from('services').insert({ tenant_id: tenantA, name: 'Corte A', category: 'Cabelo', price: 50, duration: 40, active: true }).select('id').single();
    if (serviceA.error || !serviceA.data) throw new Error(`seed serviceA failed: ${serviceA.error?.message}`);
    serviceAId = (serviceA.data as { id: string }).id;
    const serviceB = await admin.from('services').insert({ tenant_id: tenantB, name: 'Corte B', category: 'Cabelo', price: 80, duration: 45, active: true }).select('id').single();
    if (serviceB.error || !serviceB.data) throw new Error(`seed serviceB failed: ${serviceB.error?.message}`);
    serviceBId = (serviceB.data as { id: string }).id;

    // Suporte: tenant B tem um ticket; tenant A tem um ticket vazio (para verificar
    // que managerA não enxerga mensagens de B via JOIN).
    const ticketB = await admin.from('support_tickets').insert({ tenant_id: tenantB, user_id: ub, subject: 'Ticket B', status: 'open' }).select('id').single();
    if (ticketB.error || !ticketB.data) throw new Error(`seed ticketB failed: ${ticketB.error?.message}`);
    ticketBId = (ticketB.data as { id: string }).id;
    const msgB = await admin.from('ticket_messages').insert({ ticket_id: ticketBId, sender_id: ub, message: 'Mensagem sensível do tenant B' }).select('id').single();
    if (msgB.error) throw new Error(`seed ticket_messages failed: ${msgB.error?.message}`);

    managerA = await signInAsUser(emails.managerA, PASSWORD);
    managerB = await signInAsUser(emails.managerB, PASSWORD);

    console.log(`[h6.5] seeded: tenantA=${tenantA} tenantB=${tenantB} clientA=${clientAId} clientB=${clientBId} ticketB=${ticketBId}`);
  });

  test.afterAll(async () => {
    if (!enabled) return;
    try {
      const admin = getAdminClient();
      await admin.from('ticket_messages').delete().eq('ticket_id', ticketBId);
      await admin.from('support_tickets').delete().eq('id', ticketBId);
      await admin.from('clients').delete().eq('id', clientAId);
      await admin.from('clients').delete().eq('id', clientBId);
      await admin.from('services').delete().eq('id', serviceAId);
      await admin.from('services').delete().eq('id', serviceBId);
      await admin.from('staff').delete().eq('tenant_id', tenantA);
      await admin.from('staff').delete().eq('tenant_id', tenantB);
      await admin.from('user_tenants').delete().eq('tenant_id', tenantA);
      await admin.from('user_tenants').delete().eq('tenant_id', tenantB);
      await admin.from('profiles').delete().eq('tenant_id', tenantA);
      await admin.from('profiles').delete().eq('tenant_id', tenantB);
      await admin.from('tenants').delete().eq('id', tenantA);
      await admin.from('tenants').delete().eq('id', tenantB);
      for (const user of Object.values(emails)) {
        await deleteUserByEmail(user);
      }
    } catch (err) {
      console.warn('[h6.5] teardown incomplete (left for operator cleanup):', err);
    }
  });

  // ---------------------------------------------------------------------------
  // P-1 — Cross-tenant: managerA NÃO lê clientes/serviços de tenantB (RLS)
  // ---------------------------------------------------------------------------
  test('P-1 cross-tenant: managerA não lê dados do tenantB', async () => {
    const clientsB = await a().from('clients').select('id').eq('tenant_id', tenantB);
    expect(clientsB.error, `clientes tenantB via managerA: ${clientsB.error?.message}`).toBeNull();
    expect(clientsB.data ?? []).toHaveLength(0);

    const servicesB = await a().from('services').select('id').eq('tenant_id', tenantB);
    expect(servicesB.error, `serviços tenantB via managerA: ${servicesB.error?.message}`).toBeNull();
    expect(servicesB.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // P-2 — Anon: NÃO lê profiles; lê apenas subconjunto público
  // ---------------------------------------------------------------------------
  test('P-2 anon: não lê profiles; leitura pública limitada', async () => {
    const profilesAnon = await anonC().from('profiles').select('id');
    expect(profilesAnon.error).toBeNull();
    expect(profilesAnon.data ?? []).toHaveLength(0);

    // Anon deve enxergar APENAS tenants ativos/trial e APENAS colunas públicas.
    const tenantsAnon = await anonC().from('tenants').select('id, name, slug, status, plan').eq('slug', `e2e-h65-a-${runId}`);
    // Após F6-A, 'plan' não é concedido ao anon: a query retorna erro 42501 OU
    // coluna ausente no select — em ambos os casos NÃO pode retornar o plan real.
    const planExposed = (tenantsAnon.data as Array<Record<string, unknown>> | null)?.some((r) => 'plan' in r && r.plan !== undefined && r.plan !== null);
    expect(planExposed).toBeFalsy();

    // Anon ainda resolve o tenant público por slug (fluxo kiosk/portal preservado).
    const tenantsAnonPublic = await anonC().from('tenants').select('id, name, slug, status').eq('slug', `e2e-h65-a-${runId}`);
    expect(tenantsAnonPublic.error, `anon tenants public: ${tenantsAnonPublic.error?.message}`).toBeNull();
    expect(tenantsAnonPublic.data ?? []).toHaveLength(1);

    // Anon lista apenas serviços de tenants operacionais (tenantA está ativo).
    const servicesAnon = await anonC().from('services').select('id, tenant_id, name').eq('tenant_id', tenantA);
    expect(servicesAnon.error, `anon services public: ${servicesAnon.error?.message}`).toBeNull();
    expect(servicesAnon.data ?? []).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // P-3 — Autenticado: managerA lê clientes da PRÓPRIA tenant (fluxo legítimo)
  // ---------------------------------------------------------------------------
  test('P-3 autenticado: managerA lê dados da própria tenant', async () => {
    const clientsA = await a().from('clients').select('id').eq('tenant_id', tenantA);
    expect(clientsA.error, `clientes própria tenant via managerA: ${clientsA.error?.message}`).toBeNull();
    expect(clientsA.data ?? []).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // P-4 — RPC protegida: tenant_has_feature(tenantB) -> false;
  //        get_role_permissions(tenantB) -> erro
  // ---------------------------------------------------------------------------
  test('P-4 RPC protegida: feature/RBAC de outra tenant bloqueados', async () => {
    const feat = await a().rpc('tenant_has_feature', { p_tenant_id: tenantB, p_feature: 'chef_club' });
    expect(feat.error, `tenant_has_feature(tenantB): ${feat.error?.message}`).toBeNull();
    expect(feat.data).toBe(false);

    // Feature da própria tenant deve continuar resolvendo (tenantA free).
    const featOwn = await a().rpc('tenant_has_feature', { p_tenant_id: tenantA, p_feature: 'chef_club' });
    expect(featOwn.error, `tenant_has_feature(própria): ${featOwn.error?.message}`).toBeNull();

    const rbac = await a().rpc('get_role_permissions', { p_tenant_id: tenantB, p_role: 'manager' });
    expect(rbac.error, `get_role_permissions(tenantB) deveria falhar: ${JSON.stringify(rbac)}`).not.toBeNull();
    expect(rbac.data ?? []).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // P-5 — Manipulação de tenant_id: INSERT com tenant_id de outra tenant -> RLS
  // ---------------------------------------------------------------------------
  test('P-5 manipulação de tenant_id: insert cross-tenant bloqueado', async () => {
    const hijack = await a().from('clients').insert({
      tenant_id: tenantB,
      name: 'Invasor',
      phone: '11999990099',
      email: 'invasor@e2e.com',
      status: 'active',
    });
    expect(hijack.error, `insert cross-tenant deveria falhar: ${JSON.stringify(hijack)}`).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // P-6 — ticket_messages: managerA NÃO lê/insere mensagens do tenantB
  // ---------------------------------------------------------------------------
  test('P-6 ticket_messages: isolamento por ticket/tenant', async () => {
    const msgs = await a().from('ticket_messages').select('id').eq('ticket_id', ticketBId);
    expect(msgs.error, `ticket_messages tenantB via managerA: ${msgs.error?.message}`).toBeNull();
    expect(msgs.data ?? []).toHaveLength(0);

    const hijackMsg = await a().from('ticket_messages').insert({ ticket_id: ticketBId, sender_id: (await a().auth.getUser()).data.user?.id, message: 'Invasão' });
    expect(hijackMsg.error, `insert ticket_messages em ticket de B deveria falhar: ${JSON.stringify(hijackMsg)}`).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // P-7 — close_order: authenticated NÃO executa (revoked); anon NÃO executa
  // ---------------------------------------------------------------------------
  test('P-7 close_order: desativado para authenticated/anon', async () => {
    const comandaB = await b().from('comandas').insert({ tenant_id: tenantB, client_id: clientBId, status: 'open', total: 30, items: [], payment_method: 'pix' }).select('id').single();
    // Se a tabela comandas não aceitar o shape acima, usamos o fallback: sem comanda.
    const comandaId = comandaB.error ? '00000000-0000-0000-0000-000000000000' : (comandaB.data as { id: string }).id;

    const rpcAuth = await rpcLoose(a(), 'close_order', { p_comanda_id: comandaId });
    expect(rpcAuth.error, `close_order via authenticated deveria falhar: ${JSON.stringify(rpcAuth)}`).not.toBeNull();

    const rpcAnon = await rpcLoose(anonC(), 'close_order', { p_comanda_id: comandaId });
    expect(rpcAnon.error, `close_order via anon deveria falhar: ${JSON.stringify(rpcAnon)}`).not.toBeNull();

    if (!comandaB.error && comandaId !== '00000000-0000-0000-0000-000000000000') {
      await getAdminClient().from('comandas').delete().eq('id', comandaId);
    }
  });
});
