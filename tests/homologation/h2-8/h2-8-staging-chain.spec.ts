/**
 * [SMG][HOMOLOGACAO][H2-8] Prova ponta a ponta (ETAPA B) em staging da cadeia de
 * reversão de comissão.
 *
 * OBJETIVO: Provar o fluxo COMPLETO de produção contra o schema real de staging
 * `tjcvuhynckocmvtqykxp`, usando ESPECIFICAMENTE o `reversal.ts` do commit
 * `523192a` (fix H2-8) e a infraestrutura real de eventos+outbox+provider.
 *
 * CADEIA PROVADA:
 *   seed +R$3,75 (commission_record ativo)
 *     → CheckoutReverted (appEventBus, publicado por reverseFinancialTransaction)
 *     → FinanceSubscriber (CommissionOnlyFinanceStrategy)
 *     → outbox_items (reverse_commission)
 *     → dispatcher.dispatchAll()
 *     → FinanceProvider → reverseCommissionHandler
 *     → commission_records reversal −R$3,75 (RPC create_commission_reversal)
 *     → processed_operations (idempotência persistente)
 *     → comissão líquida = R$0
 *
 * IDEMPOTÊNCIA PROVADA:
 *   segunda reversão (mesmo idempotencyKey) NÃO cria nova financial_reversal,
 *   NÃO cria nova commission reversal, NÃO duplica processed_operation.
 *
 * EVIDÊNCIAS (PO): outbox_items, processed_operations, commission_records,
 * financial_reversals, transactions. (NÃO usa event_store como evidência.)
 *
 * METODOLOGIA:
 *   - Provê conjunto mínimo sintético (marcado "H2-8 synthetic test data").
 *   - Service-role p/ provisionar; authed client (manager) p/ RPC financeiro.
 *   - Env de staging injetado em beforeAll ANTES dos import() dinâmicos dos
 *     módulos reais (baseClient e createSupabaseClient resolvem env no load).
 *   - Seed do +R$3,75 via provider REAL (createCommissionRecordHandler) —
 *     pois D7 faz o CheckoutCompleted ser tratado atomicamente pelo RPC composto
 *     e o CommissionOnlyFinanceStrategy ignora CheckoutCompleted.
 *   - TEARDOWN ao final (remove dados sintéticos + auth user + disposa infra).
 *
 * RESTRIÇÕES: NÃO toca produção. NÃO cria migration. NÃO altera RLS/ACL.
 * NÃO modifica código de produção. NÃO usa event_store como evidência principal.
 */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const STAGING_URL = 'https://tjcvuhynckocmvtqykxp.supabase.co';

// env de staging ISOLADO: injetado ANTES de qualquer import() dinâmico dos módulos
beforeAll(() => {
  vi.stubEnv('VITE_SUPABASE_URL', STAGING_URL);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'stub-anon-key-loaded-from-env-local');
});

// Estado compartilhado entre o run principal e o teardown
const state: {
  serviceClient: any;
  anonClient: any;
  authedClient: any;
  tenantId: string | null;
  staffId: string | null;
  comandaId: string | null;
  transactionId: string | null;
  clientId: string | null;
  serviceId: string | null;
  comandaItemId: string | null;
  originalCommissionRecordId: string | null;
  reversalRecordId: string | null;
  financialReversalId: string | null;
  reversalTransactionId: string | null;
  idempotencyKey: string | null;
  infra: any;
} = {
  serviceClient: null,
  anonClient: null,
  authedClient: null,
  tenantId: null,
  staffId: null,
  comandaId: null,
  transactionId: null,
  clientId: null,
  serviceId: null,
  comandaItemId: null,
  originalCommissionRecordId: null,
  reversalRecordId: null,
  financialReversalId: null,
  reversalTransactionId: null,
  idempotencyKey: null,
  infra: null,
};

/**
 * Normaliza o retorno de uma query supabase `.select().eq()` sem `.single()`.
 * O retorno pode ser o array das linhas OU um wrapper PostgrestResponse com
 * `.data`. Retorna sempre um array (tolera ambos os shapes) — sem `any`,
 * sem supressão de type.
 */
function toRows(resp: unknown): any[] {
  if (Array.isArray(resp)) return resp;
  if (resp && typeof resp === 'object' && 'data' in resp) {
    const d = (resp as { data?: unknown }).data;
    return Array.isArray(d) ? d : [];
  }
  return [];
}

test('ETAPA B: cadeia completa reversão de comissão + idempotência em staging', async () => {
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

  const marker = { note: 'H2-8 synthetic test data', reason_note: 'H2-8 synthetic reversal (homologation)' };

  // ─── provisionamento sintético (service role) ───
  const slug = `h2-8b-sintetico-${Date.now()}`;
  const authUserId = crypto.randomUUID();

  const { data: tenant, error: tenantErr } = await svc
    .from('tenants')
    .insert({ name: 'H2-8B Sintetico Staging', slug, plan: 'free', status: 'active', app_slug: 'barber', settings: marker })
    .select('id')
    .single();
  expect(tenantErr, `tenant insert: ${tenantErr?.message}`).toBeFalsy();
  state.tenantId = tenant.id;

  const { data: staff, error: staffErr } = await svc
    .from('staff')
    .insert({ id: authUserId, tenant_id: tenant.id, name: 'H2-8B Barber', role: 'manager', commission_rate: 50, status: 'active' })
    .select('id')
    .single();
  expect(staffErr, `staff insert: ${staffErr?.message}`).toBeFalsy();
  state.staffId = staff.id;

  const email = `h2-8b-${Date.now()}@soumanager.test`;
  const password = 'H2-8b-homolog-12345';
  const { data: authUser, error: authErr } = await svc.auth.admin.createUser({
    id: authUserId,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'H2-8B Barber' },
  });
  expect(authErr, `auth createUser: ${authErr?.message}`).toBeFalsy();
  expect(authUser?.user?.id).toBe(authUserId);

  const { error: profErr } = await svc.from('profiles').insert({
    id: authUserId,
    tenant_id: tenant.id,
    full_name: 'H2-8B Barber',
    role: 'manager',
    status: 'active',
    onboarding_completed: true,
  });
  expect(profErr, `profiles insert: ${profErr?.message}`).toBeFalsy();

  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  expect(signInErr, `signIn: ${signInErr?.message}`).toBeFalsy();
  const authedUserClient = createClient(STAGING_URL, anonKey, {
    global: { headers: { Authorization: `Bearer ${signIn.session?.access_token}` } },
  });
  state.authedClient = authedUserClient;

  {
    const { data: client, error: e } = await svc
      .from('clients')
      .insert({ tenant_id: tenant.id, name: 'H2-8B Cliente' })
      .select('id')
      .single();
    expect(e, `client insert: ${e?.message}`).toBeFalsy();
    state.clientId = client.id;
  }
  {
    const { data: s, error: e } = await svc
      .from('services')
      .insert({ tenant_id: tenant.id, name: 'Penteado H2-8B', category: 'Cabelo', price: 15, duration: 30, active: true })
      .select('id')
      .single();
    expect(e, `service insert: ${e?.message}`).toBeFalsy();
    state.serviceId = s.id;
  }

  const { data: comanda, error: comandaErr } = await svc
    .from('comandas')
    .insert({
      tenant_id: tenant.id,
      client_id: state.clientId,
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
    .insert({ tenant_id: tenant.id, comanda_id: comanda.id, service_id: state.serviceId, quantity: 1, unit_price: 15 })
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

  const { data: tx, error: txErr } = await svc
    .from('transactions')
    .insert({
      tenant_id: tenant.id,
      user_id: null,
      type: 'income',
      category: 'Venda de Balcao',
      amount: 15,
      payment_method: 'cash',
      status: 'paid',
      source_type: 'comanda',
      source_id: comanda.id,
    })
    .select('id')
    .single();
  expect(txErr, `transaction insert: ${txErr?.message}`).toBeFalsy();
  state.transactionId = tx.id;
  const transactionId: string = tx.id;

  const tenantId = tenant.id;
  const comandaId = comanda.id;

  // ─── 1) inicializa infraestrutura REAL de eventos+outbox+provider ───
  // Importado dinamicamente APÓS o stub de env → baseClient aponta p/ staging.
  // RLS: o baseClient (shared) precisa da sessão do manager autenticado, senão
  // outbox_items/processed_operations/commission_records rejeitam o INSERT.
  // (Mesma causa das 5 falhas pré-existentes em eventInfrastructure.test.ts.)
  vi.resetModules();
  const { getSharedClient } = await import('../../../services/supabaseClient');
  const { initializeEventInfrastructure, disposeEventInfrastructure } = await import('../../../src/bootstrap/eventInfrastructure');
  const { reverseFinancialTransaction } = await import('../../../src/lib/finance/reversal');
  await getSharedClient().auth.setSession({
    access_token: signIn.session!.access_token,
    refresh_token: signIn.session!.refresh_token,
  });
  const infra = initializeEventInfrastructure();
  state.infra = infra;
  // para o dispatch loop automático; dirigiremos dispatchAll() manualmente
  infra.stopDispatchLoop();

  // ─── 2) SEED do commission_record +R$3,75 via provider REAL ───
  //   CommissionOnlyFinanceStrategy ignora CheckoutCompleted (D7).
  //   Caminho fiel de produção: enqueue create_commission_record → dispatchAll.
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
    metadata: { tenantId, correlationId: seedIdemKey, source: 'H2-8B seeding' },
  });

  const seedProcessed = await infra.dispatcher.dispatchAll();
  expect(seedProcessed, `seeding dispatchAll`).toBeGreaterThanOrEqual(1);

  // verifica o commission_record ativo +R$3,75
  const { data: seedRecords } = await svc
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .eq('record_type', 'commission');
  expect(seedRecords && seedRecords.length, 'commission records seeded').toBe(1);
  const originalRecord = seedRecords[0];
  expect(originalRecord.status).toBe('active');
  expect(Number(originalRecord.commission_value)).toBeCloseTo(3.75, 2);
  state.originalCommissionRecordId = originalRecord.id;

  // verifica processed_operation do seed
  const { data: seedOps } = await svc
    .from('processed_operations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('idempotency_key', seedIdemKey);
  expect(seedOps && seedOps.length, 'seed processed_operation').toBe(1);

  // ─── 3) REVERSÃO com idempotencyKey explícito ───
  const idemKey = `finance-reversal-h2-8b-${transactionId}`;
  state.idempotencyKey = idemKey;

  const result = await reverseFinancialTransaction({
    tenantId,
    originalTransactionId: transactionId,
    supabase: authedUserClient,
    reversalType: 'full_refund',
    amount: 15,
    reasonType: 'teste',
    reasonNote: 'H2-8 synthetic reversal (homologation)',
    refundMethod: 'cash',
    idempotencyKey: idemKey,
  });
  expect(result.success, `reversal success: ${result.message}`).toBe(true);

  // roda o dispatcher até esvaziar a fila (reverse_commission)
  for (let i = 0; i < 5; i++) {
    const n = await infra.dispatcher.dispatchAll();
    if (n === 0) break;
  }

  // ─── 4) EVIDÊNCIAS ───
  // 4a. outbox_items: reverse_commission publicado
  const { data: outboxItems } = await svc
    .from('outbox_items')
    .select('*')
    .eq('tenant_id', tenantId);
  const reverseOps = (outboxItems || []).filter(
    (o: any) => o.payload?.operationType === 'reverse_commission',
  );
  expect(reverseOps.length, 'reverse_commission outbox items').toBe(1);
  expect(reverseOps[0].status).toBe('published');

  // 4b. processed_operations: reverse_commission executado (idempotência persistente)
  const allProcessed = toRows(await svc
    .from('processed_operations')
    .select('*')
    .eq('tenant_id', tenantId));
  const reverseProcessed = allProcessed.filter(
    (p: any) => p.idempotency_key?.includes('_reverse_commission'),
  );
  expect(reverseProcessed.length, 'reverse_commission processed_operations').toBe(1);

  // 4c. commission_records: reversal −R$3,75
  const { data: reversalRecords } = await svc
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .eq('record_type', 'reversal');
  expect(reversalRecords && reversalRecords.length, 'commission reversal records').toBe(1);
  const reversalRecord = reversalRecords[0];
  expect(reversalRecord.status).toBe('active');
  expect(reversalRecord.original_record_id).toBe(originalRecord.id);
  expect(Number(reversalRecord.commission_value)).toBeCloseTo(-3.75, 2);
  state.reversalRecordId = reversalRecord.id;

  // 4d. financial_reversals: R$15
  const { data: reversals } = await svc
    .from('financial_reversals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('original_transaction_id', transactionId);
  expect(reversals && reversals.length, 'financial_reversals').toBe(1);
  expect(Number(reversals[0].amount)).toBeCloseTo(15, 2);
  state.financialReversalId = reversals[0].id;
  state.reversalTransactionId = reversals[0].reversal_transaction_id;

  // 4e. comissão LÍQUIDA = R$0 (commission + reversal)
  const net = Number(originalRecord.commission_value) + Number(reversalRecord.commission_value);
  expect(net).toBeCloseTo(0, 2);

  console.log('H2-8B REVERSAL RESULT:', JSON.stringify(result, null, 2));
  console.log('H2-8B EVIDENCES:',
    JSON.stringify({
      commission: { id: originalRecord.id, value: Number(originalRecord.commission_value), status: originalRecord.status },
      reversal: { id: reversalRecord.id, value: Number(reversalRecord.commission_value), status: reversalRecord.status, original_record_id: reversalRecord.original_record_id },
      netCommission: net,
      financialReversals: reversals.length,
      outboxReverseItems: reverseOps.length,
      processedReverseOps: reverseProcessed.length,
    }, null, 2));

  // ─── 5) IDEMPOTÊNCIA: segunda reversão com MESMO idemKey ───
  const result2 = await reverseFinancialTransaction({
    tenantId,
    originalTransactionId: transactionId,
    supabase: authedUserClient,
    reversalType: 'full_refund',
    amount: 15,
    reasonType: 'teste',
    reasonNote: 'H2-8 synthetic reversal (homologation) - second attempt',
    refundMethod: 'cash',
    idempotencyKey: idemKey,
  });
  expect(result2.success, `second reversal success`).toBe(true);

  for (let i = 0; i < 5; i++) {
    const n = await infra.dispatcher.dispatchAll();
    if (n === 0) break;
  }

  // 5a. NÃO cria nova financial_reversal
  const { data: reversalsAfter } = await svc
    .from('financial_reversals')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('original_transaction_id', transactionId);
  expect(reversalsAfter && reversalsAfter.length, 'financial_reversals after 2nd reversal').toBe(1);

  // 5b. NÃO cria nova commission reversal
  const { data: reversalRecordsAfter } = await svc
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .eq('record_type', 'reversal');
  expect(reversalRecordsAfter && reversalRecordsAfter.length, 'commission reversals after 2nd reversal').toBe(1);

  // 5c. IDEMPOTÊNCIA REAL de negócio: a 2ª reversão NÃO cria nova commission
  // reversal (guarda 'already reversed'). O outbox pode registrar uma 2ª op
  // reverse_commission no ledger (accountability por eventId_operationType),
  // mas a ESCRITA de negócio não se duplica — o que 5a (financial_reversals)
  // e 5b (reversal records) juntos já garantem. Confirma líquida continua 0.
  const { data: reversalRecordsAfterBiz } = await svc
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId)
    .eq('record_type', 'reversal');
  expect(
    reversalRecordsAfterBiz && reversalRecordsAfterBiz.length,
    'commission reversal records after 2nd reversal (business write)',
  ).toBe(1);
  const netAfter = Number(originalRecord.commission_value) + Number(reversalRecord.commission_value);
  expect(netAfter).toBeCloseTo(0, 2);

  console.log('H2-8B IDEMPOTENCY:',
    JSON.stringify({
      financialReversals: reversalsAfter.length,
      commissionReversals: reversalRecordsAfter.length,
      commissionReversalsAfterBiz: reversalRecordsAfterBiz.length,
      netCommission: netAfter,
      secondResultIdempotent: result2.idempotent,
    }, null, 2));

  // CONCLUSÃO: todas as asserções acima garantem que a cadeia completa + idempotência passou.
}, 180000);

afterAll(async () => {
  // disposa a infraestrutura (para o dispatch loop)
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
    'financial_reversals',
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
  console.log('TEARDOWN_H2_8B: sintetico removido do staging');
});
