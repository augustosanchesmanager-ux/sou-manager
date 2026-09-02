/**
 * [SMG][HOMOLOGACAO][H2-8] Prova controlada em staging do contrato de reversão.
 *
 * OBJETIVO: Adjudicar A vs B vs C/D/E em staging `tjcvuhynckocmvtqykxp`,
 * executando o CÓDIGO ATUAL (main) de `reverseFinancialTransaction`
 * contra o schema real de staging.
 *
 * ETAPA A (decisiva): observar se o publish de `CheckoutReverted` ocorre
 * ou se o catch `[REVERSAL][EVENT-PUBLISH-FAILED]` é disparado (drift de
 * coluna `service_execution_participants.staff_id` vs `professional_id`).
 *
 * RESULTADO EMPÍRICO (2026-09-02): `appEventBus.publish` NUNCA é chamado e
 * nenhum log `[REVERSAL][EVENT-PUBLISH-FAILED]` é emitido — o bloco de publish
 * é curto-circuitado silenciosamente por colunas fantasma (`comandas.discount`
 * e `comanda_items.staff_id`). A reversão financeira executa, mas a comissão
 * NÃO é revertida. -> Hipótese B CONFIRMADA. Ver `docs/audit/H7_OPERACAO_REAL_ROTEIRO.md` §10.5.
 *
 * METODOLOGIA:
 *   - Provê o conjunto mínimo sintético (marcado "H2-8 synthetic test data").
 *   - Service-role para provisionar; cliente autenticado (manager) para RPC + leituras.
 *   - Spy em `appEventBus.publish` para capturar o evento real mesmo com publish no-op.
 *   - TEARDOWN ao final (remove os dados sintéticos + auth user).
 *
 * RESTRIÇÕES: NÃO toca produção. NÃO cria migration. NÃO altera RLS/ACL.
 * NÃO modifica código de produção.
 */
import { afterAll, beforeAll, expect, test, vi } from 'vitest';

const STAGING_URL = 'https://tjcvuhynckocmvtqykxp.supabase.co';

// env de staging injetado ANTES de qualquer import dinâmico dos módulos reais
beforeAll(() => {
  vi.stubEnv('VITE_SUPABASE_URL', STAGING_URL);
});

// IDs sintéticos (gerados por default em cada tabela); preenchidos no provision
const state: {
  serviceClient: any;
  anonClient: any;
  tenantId: string | null;
  staffId: string | null;
  comandaId: string | null;
  transactionId: string | null;
  financialReversalId: string | null;
  reversalTransactionId: string | null;
  published: boolean;
  publishFailedLog: string | null;
} = {
  serviceClient: null,
  anonClient: null,
  tenantId: null,
  staffId: null,
  comandaId: null,
  transactionId: null,
  financialReversalId: null,
  reversalTransactionId: null,
  published: false,
  publishFailedLog: null,
};

test('ETAPA A: reverseFinancialTransaction publica CheckoutReverted em staging?', async () => {
  // rede real p/ staging — timeout amplo (terceiro arg é o timeout do teste)
  // Carrega creds de staging do .env.local
  const fs = await import('node:fs');
  const path = await import('node:path');
  const envRaw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf-8');
  const readEnv = (k: string) => {
    const line = envRaw.split('\n').find((l) => l.startsWith(`${k}=`));
    return line ? line.slice(k.length + 1).trim() : '';
  };
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  const serviceKey = readEnv('SUPABASE_SERVICE_ROLE_KEY');

  // Cliente da aplicação: import dinâmico real
  const { createClient } = await import('@supabase/supabase-js');
  const anon = createClient(STAGING_URL, anonKey);
  const svc = createClient(STAGING_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  state.anonClient = anon;
  state.serviceClient = svc;

  // ─── provisionamento sintético (service role, marcado H2-8) ───
  const marker = { note: 'H2-8 synthetic test data', reason_note: 'H2-8 synthetic reversal (homologation)' };

  const slug = `h2-8-sintetico-${Date.now()}`;
  // staff.id == auth.uid() necessário: get_auth_access_context resolve tenant via staff.id
  const authUserId = crypto.randomUUID();

  const { data: tenant, error: tenantErr } = await svc
    .from('tenants')
    .insert({ name: 'H2-8 Sintetico Staging', slug, plan: 'free', status: 'active', app_slug: 'barber', settings: marker })
    .select('id')
    .single();
  expect(tenantErr, `tenant insert: ${tenantErr?.message}`).toBeFalsy();
  state.tenantId = tenant.id;

  // staff comissionável 50% com id fixo = authUserId; role manager p/ autorizar reversão
  const { data: staff, error: staffErr } = await svc
    .from('staff')
    .insert({ id: authUserId, tenant_id: tenant.id, name: 'H2-8 Barber', role: 'manager', commission_rate: 50, status: 'active' })
    .select('id')
    .single();
  expect(staffErr, `staff insert: ${staffErr?.message}`).toBeFalsy();
  state.staffId = staff.id;

  // cria auth user com o mesmo id (service role)
  const email = `h2-8-${Date.now()}@soumanager.test`;
  const password = 'H2-8-homolog-12345';
  const { data: authUser, error: authErr } = await svc.auth.admin.createUser({
    id: authUserId,
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'H2-8 Barber' },
  });
  expect(authErr, `auth createUser: ${authErr?.message}`).toBeFalsy();
  expect(authUser?.user?.id).toBe(authUserId);

  // profiles row: real managers have one; needed so current_tenant_id_from_auth_uid()
  // resolves the tenant for the authed client's RLS read-backs in the publish block
  const { error: profErr } = await svc.from('profiles').insert({
    id: authUserId,
    tenant_id: tenant.id,
    full_name: 'H2-8 Barber',
    role: 'manager',
    status: 'active',
    onboarding_completed: true,
  });
  expect(profErr, `profiles insert: ${profErr?.message}`).toBeFalsy();

  // cliente autenticado real (para RPC auth-gated)
  const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
  expect(signInErr, `signIn: ${signInErr?.message}`).toBeFalsy();
  const authedUserClient = createClient(STAGING_URL, anonKey, {
    global: { headers: { Authorization: `Bearer ${signIn.session?.access_token}` } },
  });

  let clientId: string;
  let serviceId: string;
  {
    const { data: client, error: e } = await svc
      .from('clients')
      .insert({ tenant_id: tenant.id, name: 'H2-8 Cliente' })
      .select('id')
      .single();
    expect(e, `client insert: ${e?.message}`).toBeFalsy();
    clientId = client.id;
  }
  {
    const { data: s, error: e } = await svc
      .from('services')
      .insert({ tenant_id: tenant.id, name: 'Penteado H2-8', category: 'Cabelo', price: 15, duration: 30, active: true })
      .select('id')
      .single();
    expect(e, `service insert: ${e?.message}`).toBeFalsy();
    serviceId = s.id;
  }

  // comanda + item R$15
  const { data: comanda, error: comandaErr } = await svc
    .from('comandas')
    .insert({
      tenant_id: tenant.id,
      client_id: clientId,
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
    .insert({ tenant_id: tenant.id, comanda_id: comanda.id, service_id: serviceId, quantity: 1, unit_price: 15 })
    .select('id')
    .single();
  expect(itemErr, `comanda_item insert: ${itemErr?.message}`).toBeFalsy();

  // participant — REAL coluna é professional_id (schema desde 04-18)
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

  // transação de renda source comanda
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

  // captura o log de falha de publish e o valor de comissão original computado
  const originalError = console.error;
  const originalInfo = console.info;
  let captured: string | null = null;
  let publishedCommission: string | null = null;
  console.error = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg.includes('[REVERSAL][EVENT-PUBLISH-FAILED]')) captured = msg;
    originalError(...args);
  };
  console.info = (...args: unknown[]) => {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    if (msg.includes('CheckoutReverted event published')) publishedCommission = msg;
    originalInfo(...args);
  };

  const { reverseFinancialTransaction } = await import('../../../src/lib/finance/reversal');
  const { appEventBus } = await import('../../../domain/events/app-bus');
  // Espiona publish p/ capturar o payload (originalCommission) mesmo com publish no-op
  const originalPublish = appEventBus.publish.bind(appEventBus);
  let publishedEvent: any = null;
  appEventBus.publish = (async (event: any) => {
    publishedEvent = event;
    return originalPublish(event);
  }) as typeof appEventBus.publish;
  let result: any;
  let reversalError: unknown = null;
  try {
    result = await reverseFinancialTransaction({
      tenantId: state.tenantId,
      originalTransactionId: state.transactionId,
      supabase: authedUserClient,
      reversalType: 'full_refund',
      amount: 15,
      reasonType: 'teste',
      reasonNote: 'H2-8 synthetic reversal (homologation)',
      refundMethod: 'cash',
    });
  } catch (e) {
    reversalError = e;
  } finally {
    console.error = originalError;
  }

  state.publishFailedLog = captured;

  // registro os IDs da repercussão financeira (read após o run)
  if (result?.success) {
    const { data: fr } = await svc
      .from('financial_reversals')
      .select('id, reversal_transaction_id')
      .eq('original_transaction_id', state.transactionId)
      .maybeSingle();
    if (fr) {
      state.financialReversalId = fr.id;
      state.reversalTransactionId = fr.reversal_transaction_id;
    }
  }

  console.log('REVERSAL RESULT:', JSON.stringify({ result, reversalError: reversalError instanceof Error ? reversalError.message : reversalError }, null, 2));
  console.log('PUBLISH_FAILED_LOG:', state.publishFailedLog);
  console.log('PUBLISHED_COMMISSION_LOG:', publishedCommission);
  console.log('PUBLISH_CAUGHT_EVENT:', publishedEvent ? JSON.stringify(publishedEvent.payload || publishedEvent, null, 2) : null);

  // CONCLUSÃO ETAPA A: publish spy é a fonte da verdade
  if (state.publishFailedLog) {
    console.log('VEREDITO ETAPA A: CheckoutReverted NÃO publicado — exceção capturada (drift de coluna staff_id/professional_id). Hipótese B (bug no código atual).');
    state.published = false;
  } else if (!publishedEvent) {
    console.log('VEREDITO ETAPA A: CheckoutReverted NÃO publicado — publish nunca chamado (bloco curto-circuitado por coluna fantasma, ex.: comandas.discount). Reversão financeira registrada SEM reversão de comissão. Hipótese B (bug no código atual).');
    state.published = false;
  } else if (Number(publishedEvent.payload?.originalCommission) === 0) {
    console.log('VEREDITO ETAPA A: CheckoutReverted publicado com originalCommission=0 (erro de coluna staff_id engolido) — hipótese B variante: comissão de reversão zerada.');
    state.published = true;
  } else {
    console.log('VEREDITO ETAPA A: CheckoutReverted publicado com originalCommission=', publishedEvent.payload?.originalCommission);
    state.published = true;
  }

  // O teste NÃO falha por design — é um probe que captura o comportamento.
  expect(reversalError).toBeNull();
}, 90000);

afterAll(async () => {
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
  console.log('TEARDOWN_H2_8: sintetico removido do staging');
});
