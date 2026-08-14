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
 * H-6 Segurança — Auditoria adversarial (read-only) por REST.
 *
 * Requer Supabase REAL (.env.local) e gate E2E_PROVISIONING=1.
 * Tenant E2E ISOLADO (D-HOM-19) — nunca Sanchez Barber, nunca dados reais.
 *
 * Regra do PO: auditoria read-only PRIMEIRO, nenhum fix automático. Cada probe
 * registra PASS (controle confirmado) ou ACHADO (F6-x, com evidência). A suíte
 * sempre executa até o fim para coletar a matriz completa; o veredito é
 * derivado dos achados no relatório, não de pass/fail de teste.
 *
 * Bateria adversarial (PO):
 *   anon matrix (H6-1) · acesso legítimo + catálogo público (H6-2/H6-7)
 *   RLS cross-tenant leitura/escrita/delete (H6-3/5/8) · manipulação de
 *   tenant_id / resource ID swap via RPC (H6-9/10) · admin ops como usuário
 *   comum (H6-11) · usuário suspenso (H6-12) · feature flag bypass (H6-15)
 *   tabelas legadas abertas (F6-5/6/7) · exposição de dados sensíveis (H6-16)
 */
const enabled = process.env.E2E_PROVISIONING === '1';
const PASSWORD = 'E2e-H6-2026!';
const runId = Date.now();

const emails = {
  managerA: `e2e-h6-${runId}-a@gmail.com`,
  managerB: `e2e-h6-${runId}-b@gmail.com`,
  superadmin: `e2e-h6-${runId}-ops@gmail.com`,
};

const findings: string[] = [];
const passes: string[] = [];

function probe(label: string, secure: boolean, detail: string): void {
  if (secure) {
    passes.push(label);
    console.log(`[h6][PASS] ${label}`);
  } else {
    findings.push(`${label} :: ${detail}`);
    console.log(`[h6][FINDING] ${label} :: ${detail}`);
  }
}

function rowsOf(d: unknown): unknown[] {
  return Array.isArray(d) ? d : [];
}

test.describe.configure({ mode: 'serial' });

test.describe('H6 — Segurança adversarial (REST, tenants isolados)', () => {
  test.skip(!enabled, 'Requires E2E_PROVISIONING=1 and real Supabase in .env.local');

  let tenantA = '';
  let tenantB = '';
  let opsTenantId = '';
  let clientA = '';
  let clientB = '';
  let comandaB = '';
  let productB = '';
  let subA = '';
  let subB = '';
  let requestId = '';
  let ticketBId = '';
  let planChangeReqId = '';
  let userIdB = '';

  let managerA: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let managerB: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let superadmin: Awaited<ReturnType<typeof signInAsUser>> | null = null;
  let anon: ReturnType<typeof createClient> | null = null;

  function a(): NonNullable<typeof managerA> {
    if (!managerA) throw new Error('managerA session not ready');
    return managerA;
  }
  function b(): NonNullable<typeof managerB> {
    if (!managerB) throw new Error('managerB session not ready');
    return managerB;
  }
  function sa(): NonNullable<typeof superadmin> {
    if (!superadmin) throw new Error('superadmin session not ready');
    return superadmin;
  }
  function anonC(): NonNullable<typeof anon> {
    if (!anon) throw new Error('anon client not ready');
    return anon;
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
      userMetadata: { first_name: 'H6', last_name: 'ManagerA' },
    });
    userIdB = await createConfirmedUser({
      email: emails.managerB,
      password: PASSWORD,
      userMetadata: { first_name: 'H6', last_name: 'ManagerB' },
    });
    const us = await createConfirmedUser({
      email: emails.superadmin,
      password: PASSWORD,
      userMetadata: { first_name: 'H6', last_name: 'Ops' },
    });

    const mk = async (name: string, slug: string, plan: string): Promise<string> => {
      const r = await admin
        .from('tenants')
        .insert({ name, slug, app_slug: 'barber', plan, status: 'active' })
        .select('id')
        .single();
      if (r.error || !r.data) throw new Error(`seed tenant ${name} failed: ${r.error?.message}`);
      return (r.data as { id: string }).id;
    };
    tenantA = await mk(`E2E H6 A ${runId}`, `e2e-h6-a-${runId}`, 'free');
    tenantB = await mk(`E2E H6 B ${runId}`, `e2e-h6-b-${runId}`, 'premium');
    opsTenantId = await mk(`E2E H6 OPS ${runId}`, `e2e-h6-ops-${runId}`, 'pro');

    await admin.from('profiles').insert([
      { id: ua, tenant_id: tenantA, full_name: 'H6 Manager A', role: 'manager', status: 'active', onboarding_completed: true },
      { id: userIdB, tenant_id: tenantB, full_name: 'H6 Manager B', role: 'manager', status: 'active', onboarding_completed: true },
      { id: us, tenant_id: opsTenantId, full_name: 'H6 Superadmin', role: 'superadmin', status: 'active', onboarding_completed: true },
    ]);
    await admin.from('user_tenants').insert([
      { user_id: ua, tenant_id: tenantA, role: 'manager', is_primary: true },
      { user_id: userIdB, tenant_id: tenantB, role: 'manager', is_primary: true },
      { user_id: us, tenant_id: opsTenantId, role: 'superadmin', is_primary: true },
    ]);
    await admin.from('staff').insert([
      { id: ua, name: 'H6 Manager A', email: emails.managerA, phone: '', role: 'Manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantA },
      { id: userIdB, name: 'H6 Manager B', email: emails.managerB, phone: '', role: 'Manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantB },
      { id: us, name: 'H6 Superadmin', email: emails.superadmin, phone: '', role: 'owner', avatar: '', commission_rate: 0, status: 'active', tenant_id: opsTenantId },
    ]);

    const clA = await admin.from('clients').insert({ tenant_id: tenantA, name: 'H6 Client A', phone: '11900000001' }).select('id').single();
    if (clA.error || !clA.data) throw new Error(`seed clientA failed: ${clA.error?.message}`);
    clientA = (clA.data as { id: string }).id;

    const clB = await admin.from('clients').insert({ tenant_id: tenantB, name: 'H6 Client B', phone: '11900000002' }).select('id').single();
    if (clB.error || !clB.data) throw new Error(`seed clientB failed: ${clB.error?.message}`);
    clientB = (clB.data as { id: string }).id;

    const prB = await admin.from('products').insert({ tenant_id: tenantB, name: 'H6 Prod B', price: 10, stock_quantity: 5, sku: `h6-${runId}` }).select('id').single();
    if (prB.error || !prB.data) throw new Error(`seed productB failed: ${prB.error?.message}`);
    productB = (prB.data as { id: string }).id;

    // comandas NÃO podem ser semeadas via service role: o AFTER INSERT trigger
    // `trg_notify_comanda_open_insert` exige auth.uid() (lança "Usuario nao
    // autenticado" p/ service role). Seed via sessão autenticada de managerB.
    managerB = await signInAsUser(emails.managerB, PASSWORD);
    const cmB = await managerB
      .from('comandas')
      .insert({ tenant_id: tenantB, client_id: clientB, status: 'open', total: 20 })
      .select('id')
      .single();
    if (cmB.error || !cmB.data) throw new Error(`seed comandaB failed: ${cmB.error?.message}`);
    comandaB = (cmB.data as { id: string }).id;

    const cmItem = await managerB.from('comanda_items').insert({ comanda_id: comandaB, tenant_id: tenantB, product_id: productB, product_name: 'H6 Prod B', quantity: 1, unit_price: 10 });
    if (cmItem.error) throw new Error(`seed comanda_item failed: ${cmItem.error.message}`);

    const sA = await admin.from('subscriptions').insert({ tenant_id: tenantA, plan: 'free', status: 'active', current_period_start: new Date(Date.now() - 10 * 864e5).toISOString(), current_period_end: new Date(Date.now() + 20 * 864e5).toISOString() }).select('id').single();
    if (sA.error || !sA.data) throw new Error(`seed subA failed: ${sA.error?.message}`);
    subA = (sA.data as { id: string }).id;

    const sB = await admin.from('subscriptions').insert({ tenant_id: tenantB, plan: 'premium', status: 'active', current_period_start: new Date(Date.now() - 10 * 864e5).toISOString(), current_period_end: new Date(Date.now() + 20 * 864e5).toISOString() }).select('id').single();
    if (sB.error || !sB.data) throw new Error(`seed subB failed: ${sB.error?.message}`);
    subB = (sB.data as { id: string }).id;

    const req = await admin
      .from('access_requests')
      .insert({ tenant_name: `E2E H6 Approve Probe ${runId}`, owner_name: 'H6', email: emails.managerB, status: 'pending' })
      .select('id')
      .single();
    if (req.error || !req.data) throw new Error(`seed access_request failed: ${req.error?.message}`);
    requestId = (req.data as { id: string }).id;

    const reqRow = await admin
      .from('plan_change_requests')
      .insert({ user_id: userIdB, current_plan: 'free', requested_plan: 'premium', status: 'pending' })
      .select('id')
      .single();
    if (reqRow.error || !reqRow.data) throw new Error(`seed plan_change_request failed: ${reqRow.error?.message}`);
    planChangeReqId = (reqRow.data as { id: string }).id;

    const tk = await admin.from('support_tickets').insert({ tenant_id: tenantB, user_id: userIdB, subject: 'H6 ticket', status: 'open' }).select('id').single();
    if (tk.error || !tk.data) throw new Error(`seed ticket failed: ${tk.error?.message}`);
    ticketBId = (tk.data as { id: string }).id;
    await admin.from('ticket_messages').insert({ ticket_id: ticketBId, sender_id: userIdB, message: 'H6 confidential support message' });

    await admin.from('kiosk_addons').upsert({ tenant_id: tenantB, status: 'enabled', max_devices: 2, kiosk_theme: 'default' }, { onConflict: 'tenant_id' });

    // Matriz de permissões do tenant B (para o probe F6-4 get_role_permissions).
    // O trigger audit_role_permissions_changes exige auth.uid() (changed_by NOT
    // NULL) → seed via sessão autenticada de superadmin (service role falha).
    superadmin = await signInAsUser(emails.superadmin, PASSWORD);
    const rpSeed = await sa().from('role_permissions').insert({ tenant_id: tenantB, role: 'barber', permission_key: 'checkout', enabled: true, created_by: us });
    if (rpSeed.error) throw new Error(`seed role_permissions failed: ${rpSeed.error.message}`);

    managerA = await signInAsUser(emails.managerA, PASSWORD);

    console.log(`[h6] seeded A=${tenantA} B=${tenantB} OPS=${opsTenantId}`);
  });

  test('H6-1 anon matrix: RPCs sensíveis e tabelas protegidas bloqueadas p/ anon', async () => {
    const rpcs: { name: string; args: Record<string, unknown>; okWhenFailClosed?: (d: unknown) => boolean }[] = [
      {
        name: 'finance_settle_comanda',
        args: { p_tenant_id: tenantB, p_comanda_id: comandaB, p_payment_method: 'pix', p_paid_amount: 20, p_source: 'checkout' },
      },
      { name: 'change_tenant_plan', args: { p_tenant_id: tenantA, p_plan: 'premium', p_reason: 'anon' } },
      { name: 'tenant_has_feature', args: { p_tenant_id: tenantA, p_feature: 'bi' }, okWhenFailClosed: (d) => d === false },
      { name: 'get_role_permissions', args: { p_tenant_id: tenantA, p_role: 'manager' }, okWhenFailClosed: (d) => Array.isArray(d) && (d as unknown[]).length === 0 },
      { name: 'upsert_role_permissions', args: { p_tenant_id: tenantA, p_role: 'manager', p_permissions: {} } },
      {
        name: 'provision_new_tenant',
        args: { p_user_id: '00000000-0000-0000-0000-000000000000', p_tenant_name: 'anon', p_first_name: 'a', p_last_name: 'b' },
      },
      { name: 'suspend_subscription', args: { p_subscription_id: subB } },
      { name: 'approve_access_request', args: { p_request_id: requestId } },
      { name: 'close_order', args: { p_comanda_id: comandaB } },
    ];
    for (const { name, args, okWhenFailClosed } of rpcs) {
      const res = await anonC().rpc(name, args);
      const success = res.error === null;
      const failClosed = success === true && !!okWhenFailClosed && okWhenFailClosed(res.data);
      probe(
        `H6-1 anon.rpc(${name}) bloqueado/fail-closed`,
        !success || failClosed,
        `error=${res.error?.code} ${res.error?.message} data=${JSON.stringify(res.data)}`,
      );
    }

    for (const table of ['tenants', 'profiles', 'subscriptions', 'comandas', 'clients', 'products', 'feature_flags', 'role_permissions', 'access_requests', 'tenant_addons', 'kiosk_addons']) {
      const res = await anonC().from(table).select('*').limit(1);
      const blocked = res.error !== null || (res.data && (res.data as unknown[]).length === 0);
      probe(
        `H6-1 anon.select(${table}) bloqueado`,
        blocked,
        `data=${JSON.stringify(res.data)} error=${res.error?.message}`,
      );
    }
  });

  test('H6-2/H6-7 acesso legítimo + catálogo público + flags via RPC', async () => {
    for (const table of ['plans', 'features', 'plan_features']) {
      const res = await anonC().from(table).select('*').limit(3);
      probe(`H6-7 catálogo público anon.select(${table})`, res.error === null, `error=${res.error?.message}`);
    }

    const ff = await a().from('feature_flags').select('*').limit(1);
    probe(
      'H6-15 feature_flags SEM SELECT autenticado (D-6.0.5.3-6)',
      ff.error !== null || (ff.data as unknown[]).length === 0,
      `data=${JSON.stringify(ff.data)} error=${ff.error?.message}`,
    );

    const own = await a().rpc('tenant_has_feature', { p_tenant_id: tenantA, p_feature: 'chef_club' });
    probe('H6-2 free→chef_club=false (own tenant)', own.error === null && own.data === false, `data=${JSON.stringify(own.data)} error=${own.error?.message}`);

    const ownB = await b().rpc('tenant_has_feature', { p_tenant_id: tenantB, p_feature: 'bi' });
    probe('H6-2 premium→bi=true (own tenant)', ownB.error === null && ownB.data === true, `data=${JSON.stringify(ownB.data)} error=${ownB.error?.message}`);

    const rp = await a().from('role_permissions').select('*').eq('tenant_id', tenantA).limit(1);
    probe('H6-2 role_permissions próprio tenant legível', rp.error === null, `error=${rp.error?.message}`);

    const cross = await a().from('clients').select('id').eq('tenant_id', tenantB).limit(1);
    probe('H6-5 RLS clients: A não vê B por tenant_id', cross.error === null && (cross.data as unknown[]).length === 0, `data=${JSON.stringify(cross.data)}`);

    const crossByPk = await a().from('clients').select('id').eq('id', clientB).limit(1);
    probe('H6-5 RLS clients: A não vê B por PK (resource swap)', (crossByPk.data as unknown[]).length === 0, `data=${JSON.stringify(crossByPk.data)}`);
  });

  test('H6-3/5/8 RLS cross-tenant: update/delete/insert de recurso do outro tenant', async () => {
    const upd = await a().from('clients').update({ name: 'H6 pwned' }).eq('id', clientB);
    probe('H6-3 cross-tenant UPDATE clients (0 rows)', upd.error === null && rowsOf(upd.data).length === 0, `error=${upd.error?.message} data=${JSON.stringify(upd.data)}`);

    const del = await a().from('clients').delete().eq('id', clientB);
    probe('H6-3 cross-tenant DELETE clients (0 rows)', del.error === null && rowsOf(del.data).length === 0, `error=${del.error?.message} data=${JSON.stringify(del.data)}`);

    const ins = await a().from('clients').insert({ tenant_id: tenantB, name: 'H6 injected B' });
    probe('H6-3 cross-tenant INSERT clients (bloqueado)', ins.error !== null || rowsOf(ins.data).length === 0, `error=${ins.error?.message} data=${JSON.stringify(ins.data)}`);

    const ownIns = await a().from('clients').insert({ tenant_id: tenantA, name: 'H6 own A' });
    probe('H6-3 INSERT no próprio tenant funciona', ownIns.error === null, `error=${ownIns.error?.message}`);
  });

  test('H6-9/10 manipulação de tenant_id / resource ID swap via RPC', async () => {
    const tf = await a().rpc('tenant_has_feature', { p_tenant_id: tenantB, p_feature: 'bi' });
    const tfExposed = tf.error === null && tf.data === true;
    probe('F6-3 tenant_has_feature NÃO revela feature de outro tenant', !tfExposed, `error=${tf.error?.message} data=${JSON.stringify(tf.data)}`);

    const gp = await a().rpc('get_role_permissions', { p_tenant_id: tenantB, p_role: 'barber' });
    const gpExposed = gp.error === null && Array.isArray(gp.data) && (gp.data as unknown[]).length > 0;
    probe('F6-4 get_role_permissions NÃO revela matriz de outro tenant', !gpExposed, `error=${gp.error?.message} data=${JSON.stringify(gp.data)}`);

    const ups = await a().rpc('upsert_role_permissions', { p_tenant_id: tenantB, p_role: 'manager', p_permissions: { bi: true } });
    probe('H6-9 upsert_role_permissions cross-tenant bloqueado (guarda manager)', ups.error !== null, `error=${ups.error?.message} data=${JSON.stringify(ups.data)}`);

    const chg = await a().rpc('change_tenant_plan', { p_tenant_id: tenantA, p_plan: 'premium', p_reason: 'h6-regular-user' });
    probe('H6-11 change_tenant_plan por manager bloqueado (superadmin)', chg.error !== null, `error=${chg.error?.message} data=${JSON.stringify(chg.data)}`);

    const settle = await a().rpc('finance_settle_comanda', { p_tenant_id: tenantB, p_comanda_id: comandaB, p_payment_method: 'pix', p_paid_amount: 20, p_source: 'h6-cross' });
    probe('H6-10 finance_settle_comanda cross-tenant bloqueado', settle.error !== null, `error=${settle.error?.message} data=${JSON.stringify(settle.data)}`);

    // F6-2: close_order (legacy, SECURITY DEFINER sem guarda) cross-tenant
    const clo = await a().rpc('close_order', { p_comanda_id: comandaB });
    const admin = getAdminClient();
    const cmAfter = await admin.from('comandas').select('status').eq('id', comandaB).single();
    const prAfter = await admin.from('products').select('stock_quantity').eq('id', productB).single();
    const comandaMutated = !cmAfter.error && (cmAfter.data as { status: string })?.status === 'paid';
    const stockMutated = !prAfter.error && (prAfter.data as { stock_quantity: number })?.stock_quantity < 5;
    probe(
      'F6-2 close_order cross-tenant NÃO muta comanda/estoque de outro tenant',
      !comandaMutated && !stockMutated && clo.error !== null,
      `rpcError=${clo.error?.message} comanda=${JSON.stringify(cmAfter.data)} stock=${JSON.stringify(prAfter.data)}`,
    );

    const susp = await a().rpc('suspend_subscription', { p_subscription_id: subA });
    probe('H6-11 suspend_subscription por manager bloqueado', susp.error !== null, `error=${susp.error?.message} data=${JSON.stringify(susp.data)}`);
  });

  test('H6-11 admin ops como usuário comum + F6-1 approve_access_request', async () => {
    const appr = await a().rpc('approve_access_request', { p_request_id: requestId });
    const afterReq = await getAdminClient().from('access_requests').select('status').eq('id', requestId).single();
    const approved = !afterReq.error && (afterReq.data as { status: string })?.status === 'approved';
    probe(
      'F6-1 approve_access_request NÃO aprova pedido por usuário comum',
      !approved && appr.error !== null,
      `rpcError=${appr.error?.message} statusPós=${JSON.stringify(afterReq.data)} approved=${approved}`,
    );
  });

  test('H6-15 feature flag bypass (escrita/leitura direta bloqueada p/ autenticado)', async () => {
    const ins = await a().from('feature_flags').insert({ tenant_id: tenantA, feature_key: 'bi', override: true, reason: 'h6-bypass' });
    probe('H6-15 INSERT feature_flags por autenticado bloqueado', ins.error !== null, `error=${ins.error?.message} data=${JSON.stringify(ins.data)}`);

    // DELETE: seed via superadmin e verifica se managerA consegue remover
    const ok = await sa().from('feature_flags').insert({ tenant_id: tenantA, feature_key: 'bi', override: true, reason: 'h6-ops' });
    probe('H6-15 INSERT feature_flags por superadmin funciona (controle)', ok.error === null, `error=${ok.error?.message}`);
    const admin = getAdminClient();
    const before = await admin.from('feature_flags').select('feature_key').eq('tenant_id', tenantA).eq('feature_key', 'bi');
    await a().from('feature_flags').delete().eq('tenant_id', tenantA).eq('feature_key', 'bi');
    const after = await admin.from('feature_flags').select('feature_key').eq('tenant_id', tenantA).eq('feature_key', 'bi');
    const rowStillThere = rowsOf(after.data).length === 1;
    probe(
      'H6-15 DELETE feature_flags por autenticado bloqueado',
      rowStillThere,
      `antes=${JSON.stringify(before.data)} depois=${JSON.stringify(after.data)}`,
    );

    const flagAfter = await a().rpc('tenant_has_feature', { p_tenant_id: tenantA, p_feature: 'bi' });
    probe('H6-15 override superadmin efetivo via RPC (bi=true)', flagAfter.error === null && flagAfter.data === true, `data=${JSON.stringify(flagAfter.data)} error=${flagAfter.error?.message}`);
  });

  test('H6-5 tabelas legadas abertas: F6-5/F6-6/F6-7 leitura/escrita cross-tenant', async () => {
    const pcr = await a().from('plan_change_requests').select('*');
    probe('F6-5 plan_change_requests sem vazamento cross-tenant', pcr.error !== null || (pcr.data as unknown[]).length === 0, `rows=${(pcr.data as unknown[]).length} data=${JSON.stringify(pcr.data)}`);

    const tm = await a().from('ticket_messages').select('*');
    probe('F6-6 ticket_messages sem vazamento cross-tenant', tm.error !== null || (tm.data as unknown[]).length === 0, `rows=${(tm.data as unknown[]).length} data=${JSON.stringify(tm.data)}`);

    const ka = await a().from('kiosk_addons').select('*').eq('tenant_id', tenantB);
    probe('F6-7 kiosk_addons sem leitura cross-tenant', ka.error !== null || rowsOf(ka.data).length === 0, `data=${JSON.stringify(ka.data)} error=${ka.error?.message}`);

    // Escrita cross-tenant: managerA tenta alterar config de kiosk do tenant B;
    // verifica o estado persistido via service role (upsert retorna data=null).
    await a().from('kiosk_addons').upsert({ tenant_id: tenantB, status: 'disabled', max_devices: 9, kiosk_theme: 'custom' }, { onConflict: 'tenant_id' });
    const kaAfter = await getAdminClient().from('kiosk_addons').select('status', 'max_devices', 'kiosk_theme').eq('tenant_id', tenantB).single();
    const kaRow = kaAfter.error ? null : (kaAfter.data as { status: string; max_devices: number; kiosk_theme: string });
    const kaMutated = kaRow !== null && kaRow.status === 'disabled' && kaRow.max_devices === 9;
    probe('F6-7 kiosk_addons sem escrita cross-tenant', !kaMutated, `após=${JSON.stringify(kaAfter.data)}`);
  });

  test('H6-12 usuário suspenso perde acesso (controle de sessão/contexto)', async () => {
    const admin = getAdminClient();
    await admin.from('profiles').update({ status: 'suspended' }).eq('id', userIdB);
    await admin.from('staff').update({ status: 'suspended' }).eq('tenant_id', tenantB);

    const ctx = await b().rpc('get_auth_access_context');
    const ctxText = JSON.stringify(ctx.data) + ' ' + (ctx.error?.message ?? '');
    const restricted = ctx.error !== null || /suspended|pending/i.test(ctxText);
    probe('H6-12 contexto restrito para usuário suspenso', restricted, `error=${ctx.error?.message} data=${JSON.stringify(ctx.data)}`);

    const read = await b().from('clients').select('*').eq('tenant_id', tenantB);
    const blocked = read.error !== null || (read.data as unknown[]).length === 0;
    probe('H6-12 leitura RLS bloqueada p/ usuário suspenso', blocked, `rows=${(read.data as unknown[]).length} error=${read.error?.message}`);
  });

  test.afterAll(async () => {
    if (!enabled) return;
    const admin = getAdminClient();
    try {
      for (const tid of [tenantA, tenantB, opsTenantId]) {
        if (!tid) continue;
        await admin.from('feature_flags').delete().eq('tenant_id', tid);
        await admin.from('subscriptions').delete().eq('tenant_id', tid);
        await admin.from('kiosk_addons').delete().eq('tenant_id', tid);
        await admin.from('notifications').delete().eq('tenant_id', tid);
        await admin.from('billing_events').delete().eq('tenant_id', tid);
        await admin.from('audit_logs').delete().eq('tenant_id', tid);
        await admin.from('comanda_items').delete().eq('comanda_id', comandaB);
        await admin.from('comandas').delete().eq('tenant_id', tid);
        await admin.from('clients').delete().eq('tenant_id', tid);
        await admin.from('products').delete().eq('tenant_id', tid);
        await admin.from('staff').delete().eq('tenant_id', tid);
        await admin.from('user_tenants').delete().eq('tenant_id', tid);
        await admin.from('tenant_settings').delete().eq('tenant_id', tid);
        await admin.from('tenants').delete().eq('id', tid);
      }
      if (requestId) await admin.from('access_requests').delete().eq('id', requestId);
      if (planChangeReqId) await admin.from('plan_change_requests').delete().eq('id', planChangeReqId);
      if (ticketBId) await admin.from('ticket_messages').delete().eq('ticket_id', ticketBId);
      if (ticketBId) await admin.from('support_tickets').delete().eq('id', ticketBId);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(email);
      }
      console.log('[h6] teardown complete');
    } catch (err) {
      console.warn('[h6] teardown failed (tenants left for operator cleanup):', err);
    }
    console.log(`[h6] === PASSES (${passes.length}) ===`);
    for (const p of passes) console.log(`[h6] + ${p}`);
    console.log(`[h6] === ACHADOS (${findings.length}) ===`);
    for (const f of findings) console.log(`[h6] - ${f}`);
  });
});
