/**
 * [SMG][HOMOLOGACAO][H2-8] Prova ISOLADA do caminho de CRIAÇÃO de comissão em
 * staging (schema real `tjcvuhynckocmvtqykxp`).
 *
 * ESCOPO: somente a criação de commission_record via caminho REAL
 * (createCommissionRecordHandler). NÃO executa reversão, idempotência de
 * reversão, CheckoutReverted, reverse_commission, financial_reversal.
 *
 * OBJETIVO: comprovar que o schema drift corrigido nos repositories
 * (comanda_items.sem staff_id; service_execution_participants usa
 * professional_id) desbloqueia o caminho real de criação de comissão.
 *
 * FLUXO PROVADO (REAL, sem atalhos):
 *   provisionamento sintético (service role)
 *     → comanda R$15 (paid) + comanda_item (unit_price 15) + participant
 *     → enqueue create_commission_record (outbox REAL)
 *     → dispatcher.dispatchAll() (REAL)
 *     → FinanceProvider → createCommissionRecordHandler
 *     → commission_records: received_value=15, commission_value=3.75, status=active
 *
 * MATEMÁTICA: 15 × 50% (participant payout share) × 50% (staff commission_rate)
 *             = 3,75
 *
 * RESTRIÇÕES: NÃO toca produção. NÃO cria migration. NÃO altera schema.
 * NÃO usa event_store como evidência. NÃO edita h2-8-staging-chain.spec.ts.
 */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const STAGING_URL = 'https://tjcvuhynckocmvtqykxp.supabase.co';
const MARKER = { note: 'H2-8 synthetic test data - commission creation' };

// env de staging ISOLADO: injetado ANTES de qualquer import() dinâmico dos módulos
beforeAll(() => {
  vi.stubEnv('VITE_SUPABASE_URL', STAGING_URL);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'stub-anon-key-loaded-from-env-local');
});

const state: {
  serviceClient: any;
  anonClient: any;
  infra: any;
  tenantId: string | null;
  staffId: string | null;
  clientId: string | null;
  serviceId: string | null;
  comandaId: string | null;
  comandaItemId: string | null;
} = {
  serviceClient: null,
  anonClient: null,
  infra: null,
  tenantId: null,
  staffId: null,
  clientId: null,
  serviceId: null,
  comandaId: null,
  comandaItemId: null,
};

test('H2-8 (criação): comanda R$15 -> createCommissionRecordHandler -> commission_record 3.75 active', async () => {
  // ─── creds de staging do .env.local ───
  const fs = await import('node:fs');
  const path = await import('node:path');
  const envRaw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  // .env.local é um arquivo mesclado de múltiplos projetos; o bloco de STAGING
  // (tjcvuhynckocmvtqykxp) é o ÚLTIMO. Lê a última ocorrência de cada chave.
  const readEnv = (k: string) => {
    const lines = envRaw.split('\n').filter((l) => l.startsWith(`${k}=`));
    const line = lines[lines.length - 1];
    return line ? line.slice(k.length + 1).trim() : '';
  };
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  // reinjeta a anon key real (substitui o stub) ANTES dos import() dinâmicos
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', anonKey);

  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(STAGING_URL, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const svc = createClient(STAGING_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  state.serviceClient = svc;
  state.anonClient = anon;

  // ─── provisionamento sintético (service role) ───
  const slug = `h2-8c-sintetico-${Date.now()}`;
  const authUserId = crypto.randomUUID();

  const { data: tenant, error: tenantErr } = await svc
    .from('tenants')
    .insert({ name: 'H2-8C Sintetico Staging (criacao)', slug, plan: 'free', status: 'active', app_slug: 'barber', settings: MARKER })
    .select('id')
    .single();
  expect(tenantErr, `tenant insert: ${tenantErr?.message}`).toBeFalsy();
  state.tenantId = tenant.id;

  const { data: staff, error: staffErr } = await svc
    .from('staff')
    .insert({ id: authUserId, tenant_id: tenant.id, name: 'H2-8C Barber', role: 'manager', commission_rate: 50, status: 'active' })
    .select('id')
    .single();
  expect(staffErr, `staff insert: ${staffErr?.message}`).toBeFalsy();
  state.staffId = staff.id;

  const email = `h2-8c-${Date.now()}@soumanager.test`;
  const password = 'H2-8c-homolog-12345';
  const { data: authUser, error: authErr } = await svc.auth.admin.createUser({
    id: authUserId,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'H2-8C Barber' },
  });
  expect(authErr, `auth createUser: ${authErr?.message}`).toBeFalsy();
  expect(authUser?.user?.id).toBe(authUserId);

  const { error: profErr } = await svc.from('profiles').insert({
    id: authUserId,
    tenant_id: tenant.id,
    full_name: 'H2-8C Barber',
    role: 'manager',
    status: 'active',
    onboarding_completed: true,
  });
  expect(profErr, `profiles insert: ${profErr?.message}`).toBeFalsy();

  const { data: client, error: clientErr } = await svc
    .from('clients')
    .insert({ tenant_id: tenant.id, name: 'H2-8C Cliente' })
    .select('id')
    .single();
  expect(clientErr, `client insert: ${clientErr?.message}`).toBeFalsy();
  state.clientId = client.id;

  const { data: service, error: serviceErr } = await svc
    .from('services')
    .insert({ tenant_id: tenant.id, name: 'Penteado H2-8C', category: 'Cabelo', price: 15, duration: 30, active: true })
    .select('id')
    .single();
  expect(serviceErr, `service insert: ${serviceErr?.message}`).toBeFalsy();
  state.serviceId = service.id;

  const { data: comanda, error: comandaErr } = await svc
    .from('comandas')
    .insert({
      tenant_id: tenant.id,
      client_id: client.id,
      staff_id: staff.id,
      status: 'paid',
      total: 15,
      payment_method: 'cash',
      closure_mode: 'standard',
      financial_effect: true,
      membership_credit_effect: true,
    })
    .select('id')
    .single();
  expect(comandaErr, `comanda insert: ${comandaErr?.message}`).toBeFalsy();
  state.comandaId = comanda.id;

  const { data: comandaItem, error: itemErr } = await svc
    .from('comanda_items')
    .insert({ tenant_id: tenant.id, comanda_id: comanda.id, service_id: service.id, quantity: 1, unit_price: 15 })
    .select('id')
    .single();
  expect(itemErr, `comanda_item insert: ${itemErr?.message}`).toBeFalsy();
  state.comandaItemId = comandaItem.id;

  const { error: partErr } = await svc.from('service_execution_participants').insert({
    tenant_id: tenant.id,
    comanda_item_id: comandaItem.id,
    professional_id: staff.id,
    role: 'primary',
    payout_type: 'percentage',
    payout_value: 50,
    affects_revenue: true,
    affects_commission: true,
  });
  expect(partErr, `participant insert: ${partErr?.message}`).toBeFalsy();

  // ─── 1) inicializa infraestrutura REAL de eventos+outbox+provider ───
  // Importado dinamicamente APÓS o stub de env -> baseClient aponta p/ staging.
  // RLS: o baseClient (shared) precisa de sessão autenticada do manager, senão
  // outbox_items/processed_operations/commission_records rejeitam o INSERT.
  vi.resetModules();
  const { getSharedClient } = await import('../../../services/supabaseClient');
  const { initializeEventInfrastructure, disposeEventInfrastructure } = await import('../../../src/bootstrap/eventInfrastructure');

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  expect(signInErr, `signIn: ${signInErr?.message}`).toBeFalsy();

  await getSharedClient().auth.setSession({
    access_token: signIn.session!.access_token,
    refresh_token: signIn.session!.refresh_token,
  });
  const infra = initializeEventInfrastructure();
  state.infra = infra;
  infra.stopDispatchLoop(); // dirigiremos dispatchAll() manualmente

  // ─── 2) caminho REAL de criação de comissão via provider ───
  //   CommissionOnlyFinanceStrategy ignora CheckoutCompleted (D7); o caminho
  //   fiel de produção enfileira create_commission_record e despacha.
  const comandaId: string = comanda.id;
  const tenantId: string = tenant.id;
  const seedEventId = `evt_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const seedIdemKey = `seed_commission_${comandaId}`;
  await infra.outbox.enqueue({
    eventId: seedEventId,
    eventType: 'CheckoutCompleted',
    tenantId,
    targets: [{ provider: 'finance', config: {} }],
    payload: {
      operationType: 'create_commission_record',
      operationData: { comandaId, tenantId, receivedValue: 15 },
      sourceEvent: 'CheckoutCompleted',
      idempotencyKey: seedIdemKey,
    },
    metadata: { tenantId, correlationId: seedIdemKey, source: 'H2-8C commission creation' },
  });

  const seedProcessed = await infra.dispatcher.dispatchAll();
  expect(seedProcessed, `creation dispatchAll`).toBeGreaterThanOrEqual(1);

  // ─── 3) EVIDÊNCIA: commission_record criado pelo caminho REAL ───
  const { data: records, error: recErr } = await svc
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .eq('record_type', 'commission');
  expect(recErr, `commission_records select: ${recErr?.message}`).toBeFalsy();
  expect(records && records.length, 'commission_records (criacao)').toBe(1);

  const record = records[0];
  expect(record.tenant_id, 'tenant isolation').toBe(tenantId);
  expect(record.comanda_id, 'comanda reference').toBe(comandaId);
  expect(record.comanda_item_id, 'comanda_item reference').toBe(comandaItem.id);
  expect(record.staff_id, 'staff reference').toBe(staff.id);
  expect(Number(record.received_value), 'received_value').toBeCloseTo(15, 2);
  expect(Number(record.commission_value), 'commission_value (15 x 50% x 50%)').toBeCloseTo(3.75, 2);
  expect(record.status, 'status').toBe('active');
  expect(Number(record.commission_rate), 'commission_rate').toBeCloseTo(0.5, 2);

  console.log('H2-8C CREATION RESULT:',
    JSON.stringify({
      tenantId,
      comandaId,
      commissionRecord: {
        id: record.id,
        received_value: Number(record.received_value),
        commission_value: Number(record.commission_value),
        status: record.status,
        staff_id: record.staff_id,
        comanda_id: record.comanda_id,
        comanda_item_id: record.comanda_item_id,
        record_type: record.record_type,
        commission_rate: Number(record.commission_rate),
      },
    }, null, 2));

  // disposa a infraestrutura (stop do dispatch loop manual)
  try {
    disposeEventInfrastructure();
  } catch {
    // best-effort
  }
}, 120000);

afterAll(async () => {
  if (state.infra) {
    try {
      const { disposeEventInfrastructure } = await import('../../../src/bootstrap/eventInfrastructure');
      disposeEventInfrastructure();
    } catch {
      // best-effort
    }
  }

  if (!state.tenantId || !state.serviceClient) return;
  const svc = state.serviceClient;
  const tid = state.tenantId;
  const tables = [
    'service_execution_participants',
    'comanda_items',
    'commission_records',
    'transactions',
    'outbox_items',
    'processed_operations',
    'comandas',
    'clients',
    'services',
    'user_tenants',
    'profiles',
    'staff',
  ];
  for (const t of tables) {
    try {
      await svc.from(t).delete().eq('tenant_id', tid);
    } catch {
      // teardown best-effort por tabela
    }
  }
  if (state.staffId) {
    try {
      await svc.auth.admin.deleteUser(state.staffId);
    } catch {
      // best-effort
    }
  }
  try {
    await svc.from('tenants').delete().eq('id', tid);
  } catch {
    // best-effort
  }
  console.log('TEARDOWN_H2_8C: sintetico removido do staging');
});
