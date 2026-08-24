import { type BrowserContext, type Page } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createConfirmedUser,
  deleteUserByEmail,
  getAdminClient,
  loadEnvLocal,
} from '../helpers/supabaseAdmin';
import { test, expect } from '../fixtures/auth.fixture';

/**
 * TD-001 B3.4-H — Controlled Financial Validation (PO-approved plan).
 *
 * Executes the ACTIVE commission-only financial path end-to-end against the
 * real production Supabase project via the Vercel Preview deployment:
 *
 *   UI Checkout -> CheckoutCompleted -> FinanceSubscriber -> Outbox(target=finance)
 *     -> FinanceProvider -> create_commission_record -> commission_records
 *   UI Reversal  -> finance_reverse_transaction RPC -> CheckoutReverted
 *     -> reverse_commission op -> create_commission_reversal RPC (advisory lock)
 *
 * PO adjustments enforced here:
 *   1. Tenant isolation is PROVEN before any comanda exists (dedicated
 *      b34h-val-* tenant, never Barbearia Principal b716e290-f7f6-4449-b790-5ae9dcdadcab).
 *   2. Concurrency proofs are separate: 4A = two simultaneous REAL handler
 *      executions via dual browser contexts; 4B = direct concurrent RPC calls
 *      proving pg_advisory_xact_lock + FOR UPDATE + SUM validation.
 *   3. Overflow behavior is OBSERVED and documented, never assumed; no
 *      functional code changes are made to make tests pass.
 *
 * Golden rules: no migrations, no functional code changes during execution,
 * full FK-aware teardown of the dedicated tenant.
 */

const PRINCIPAL_TENANT_ID = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const BLOCKED_OPERATION_TYPES = [
  'create_transaction',
  'reverse_revenue',
  'deduct_credits',
  'close_daily_cash',
];
const DISPATCH_WAIT_MS = 8_000;
const PASSWORD = 'B34h-Validation-2026!';

const log = (checkpoint: string, payload: unknown) => {
  console.log(`[B34H][${checkpoint}] ${JSON.stringify(payload)}`);
};

const num = (v: unknown): number => Number(v ?? 0);

// ---------------------------------------------------------------------------
// Module-level state shared across serial tests
// ---------------------------------------------------------------------------
let runId = Date.now();
let tenantId = '';
let managerUser = { email: '', password: PASSWORD, userId: '' };
let barberUser = { email: '', password: PASSWORD, userId: '' };
let barberStaffId = '';
let clientId = '';
let serviceId = '';
let clientName = '';
let serviceName = '';

let comandaAId = '';
let commissionA: Record<string, unknown> | null = null;

let comandaBId = '';
let commissionB: Record<string, unknown> | null = null;

let comandaCId = '';
let commissionC: Record<string, unknown> | null = null;

let comandaDId = '';
let commissionD: Record<string, unknown> | null = null;

const admin = () => getAdminClient();

/** Authenticated (anon key + user login) client for direct RPC calls under RLS. */
async function createAuthenticatedClient(): Promise<SupabaseClient> {
  const env = loadEnvLocal();
  const url = env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in .env.local');
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: managerUser.email,
    password: managerUser.password,
  });
  if (error) throw new Error(`signInWithPassword failed: ${error.message}`);
  return client;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
async function applyVercelBypass(context: BrowserContext): Promise<void> {
  const secret =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    loadEnvLocal().VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (!secret || !baseUrl) return;
  const origin = new URL(baseUrl).origin;
  await context.route(`${origin}/**`, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
    });
  });
}

async function newLoggedContext(browser: {
  newContext: () => Promise<BrowserContext>;
}): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  await applyVercelBypass(ctx);
  const page = await ctx.newPage();
  await uiLogin(page);
  return { ctx, page };
}

async function uiLogin(page: Page): Promise<void> {
  await page.goto('/#/login');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(managerUser.email);
  try {
    await page.locator('input[type="password"]').fill(managerUser.password, { timeout: 15_000 });
  } catch (err) {
    const inputs = await page
      .locator('input')
      .evaluateAll((els) =>
        els.map((e) => {
          const el = e as HTMLInputElement;
          return {
            type: el.type,
            placeholder: el.placeholder,
            visible: !!el.offsetParent,
            value: el.value.slice(0, 40),
          };
        }),
      )
      .catch(() => [] as unknown[]);
    console.log(
      `[B34H][ui-login-debug] ${JSON.stringify({ url: page.url(), title: await page.title(), inputs })}`,
    );
    const bodyText = (await page.locator('body').innerText().catch(() => '')).slice(0, 600);
    console.log(`[B34H][ui-login-debug-body] ${JSON.stringify(bodyText)}`);
    throw err;
  }
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/dashboard/, { timeout: 40_000 });
  log('ui-login', { ok: true });
}

/** Drives one REAL checkout through the PDV/comanda UI. */
async function performUiCheckout(page: Page): Promise<void> {
  await page.goto('/#/checkout?mode=comanda');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(2_000);

  // 1. Select client (button with search icon labeled "Buscar")
  const clientButton = page.getByRole('button', { name: /Buscar/ }).first();
  try {
    await clientButton.waitFor({ state: 'visible', timeout: 20_000 });
  } catch (err) {
    const buttons = await page
      .locator('button')
      .evaluateAll((els) =>
        els
          .filter((e) => !!(e as HTMLElement).offsetParent)
          .map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 50))
          .slice(0, 40),
      )
      .catch(() => [] as string[]);
    const bodyText = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 800);
    console.log(
      `[B34H][checkout-debug] ${JSON.stringify({ url: page.url(), buttons, bodyText })}`,
    );
    throw err;
  }
  await clientButton.click();

  const clientSearch = page.locator('input[placeholder="Buscar cliente..."]');
  await clientSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await clientSearch.fill(clientName);
  await page.waitForTimeout(1_500); // debounce + query
  await page.getByText(clientName, { exact: false }).first().click();
  await page.waitForTimeout(500);

  // 2. Add service (+ Serviço button opens the item modal on services tab)
  const addServiceButton = page.getByRole('button', { name: /\+\s*Servi/ }).first();
  await addServiceButton.click();

  const serviceSearch = page.locator('input[placeholder*="Buscar"]').last();
  await serviceSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await serviceSearch.fill(serviceName);
  await page.waitForTimeout(1_500);
  await page.getByText(serviceName, { exact: false }).first().click();
  await page.waitForTimeout(800);

  // 3. Assign the professional on the cart item's inline staff select.
  //    Uniquely identified by its exclusive "Nenhum" option. Setting
  //    item.staff_id makes checkout persist a PRIMARY participant at 100%
  //    (syncParticipants fallback) -> share 1.0 -> commission R$40.
  const staffSelects = page
    .locator('select')
    .filter({ has: page.locator('option', { hasText: 'Nenhum' }) });
  const staffSelectCount = await staffSelects.count();
  if (staffSelectCount === 0) {
    throw new Error('[B34H] cart item staff select not found');
  }
  await staffSelects.first().selectOption({ label: 'B34H Barbeiro' });
  await page.waitForTimeout(400);
  log('checkout-professional-assigned', { assigned: true, selects: staffSelectCount });

  // 4. Ensure payment status = paid (default) and pick payment method
  const fecharAgora = page.getByRole('button', { name: /Fechar agora/ }).first();
  if (await fecharAgora.isVisible().catch(() => false)) {
    await fecharAgora.click().catch(() => undefined);
  }
  const dinheiro = page.getByRole('button', { name: /^Dinheiro$/ }).first();
  if (await dinheiro.isVisible().catch(() => false)) {
    await dinheiro.click().catch(() => undefined);
  }

  // 5. Finish checkout ('Confirmar e fechar' when paymentStatus=paid)
  const finishButton = page.getByRole('button', { name: /Confirmar e fechar|Concluir venda|Abrir e fechar agora/ }).first();
  await finishButton.waitFor({ state: 'visible', timeout: 15_000 });

  // Capture app feedback during the finish call.
  const consoleMessages: string[] = [];
  const consoleListener = (msg: any) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    if (
      msg.type() === 'error' ||
      msg.type() === 'warning' ||
      /checkout|commission|finance|rollback|erro|fail/i.test(text)
    ) {
      consoleMessages.push(text.slice(0, 300));
    }
  };
  page.on('console', consoleListener);

  await finishButton.click();

  // 6. Wait for success feedback (toast or navigation away from /checkout)
  await page
    .waitForURL((u) => !u.hash.includes('/checkout'), { timeout: 45_000 })
    .catch(async () => {
      await page
        .getByText(/sucesso|registrada|finalizada/i)
        .first()
        .waitFor({ state: 'visible', timeout: 10_000 })
        .catch(() => undefined);
    });
  const toasts = await page
    .locator('[class*="toast"], [role="alert"], [role="status"]')
    .allInnerTexts()
    .catch(() => [] as string[]);
  log('checkout-ui-done', { url: page.url(), toasts, consoleMessages: consoleMessages.slice(0, 15) });
  page.off('console', consoleListener);
  await page.waitForTimeout(2_000);
}

async function openReversalModalAndFill(page: Page, note: string): Promise<void> {
  await page.goto('/#/cashflow');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(3_000);

  const estornar = page.getByRole('button', { name: /Estornar/ }).first();
  await estornar.waitFor({ state: 'visible', timeout: 30_000 });
  await estornar.click();

  const noteInput = page.locator('textarea[placeholder*="estorno" i], textarea[placeholder*="auditoria" i]').first();
  await noteInput.waitFor({ state: 'visible', timeout: 15_000 });
  await noteInput.fill(note);

  await page.locator('input[type="checkbox"]').first().check();
}

async function confirmReversal(page: Page): Promise<'success' | 'error'> {
  await page.getByRole('button', { name: /Confirmar estorno auditado/ }).click();
  const successToast = page.getByText(/registrada com sucesso/i).first();
  const errorToast = page.getByText(/Nenhuma altera|excede|inválida|Não foi poss/i).first();
  const winner = await Promise.race([
    successToast
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'success' as const)
      .catch(() => null),
    errorToast
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'error' as const)
      .catch(() => null),
  ]);
  return winner ?? 'unknown';
}

// ---------------------------------------------------------------------------
// DB helpers (service role — bypasses RLS)
// ---------------------------------------------------------------------------
async function pollUntil<T>(
  fn: () => Promise<T | null>,
  label: string,
  timeoutMs = 40_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: T | null = null;
  while (Date.now() < deadline) {
    last = await fn();
    if (last !== null && last !== undefined) return last;
    await new Promise((r) => setTimeout(r, 2_000));
  }
  throw new Error(`[B34H] pollUntil('${label}') timed out after ${timeoutMs}ms`);
}

async function fetchCommissionByComanda(comandaId: string, recordType?: 'commission' | 'reversal') {
  let q = admin()
    .from('commission_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('comanda_id', comandaId);
  if (recordType) q = q.eq('record_type', recordType);
  const { data, error } = await q;
  if (error) throw new Error(`commission_records query failed: ${error.message}`);
  return data || [];
}

async function waitForCommissionRecord(comandaId: string): Promise<Record<string, unknown>> {
  await new Promise((r) => setTimeout(r, DISPATCH_WAIT_MS));
  return pollUntil(async () => {
    const rows = await fetchCommissionByComanda(comandaId, 'commission');
    return rows.length === 1 ? (rows[0] as Record<string, unknown>) : null;
  }, `commission record for comanda ${comandaId}`);
}

async function latestComandaId(excluding: string[]): Promise<string | null> {
  const { data } = await admin()
    .from('comandas')
    .select('id')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(10);
  const rows = (data || []) as Array<{ id: string }>;
  const found = rows.find((r) => !excluding.includes(r.id));
  return found ? found.id : null;
}

async function assertNoForbiddenRows(): Promise<void> {
  const { data, error } = await admin()
    .from('processed_operations')
    .select('*')
    .eq('tenant_id', tenantId);
  if (error) throw new Error(`processed_operations query failed: ${error.message}`);
  const rows = data || [];
  log('processed-operations-all', rows.map((r: any) => ({
    operation_type: r.operation_type,
    idempotency_key: r.idempotency_key,
  })));
  const forbidden = rows.filter((r: any) => BLOCKED_OPERATION_TYPES.includes(r.operation_type));
  expect(forbidden, 'forbidden financial operations must not exist').toHaveLength(0);
}

test.describe.configure({ mode: 'serial' });

test.describe('B34H - Controlled Financial Validation', () => {
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    runId = Date.now();
    clientName = `Cliente Val B34H ${runId}`;
    serviceName = `Servico Val B34H ${runId}`;
    managerUser.email = `b34h-val-${runId}-manager@gmail.com`;

    const barberEmail = `b34h-val-${runId}-barber@gmail.com`;
    barberUser.email = barberEmail;
    managerUser.userId = await createConfirmedUser({
      email: managerUser.email,
      password: managerUser.password,
      userMetadata: { first_name: 'B34H', last_name: 'Manager' },
    });
    barberUser.userId = await createConfirmedUser({
      email: barberEmail,
      password: PASSWORD,
      userMetadata: { first_name: 'B34H', last_name: 'Barbeiro' },
    });

    const { data: tenant, error: tenantError } = await admin()
      .from('tenants')
      .insert({
        name: `B34H Validation ${runId}`,
        slug: `b34h-val-${runId}`,
        app_slug: 'barber',
        plan: 'pro',
        status: 'active',
      })
      .select('id')
      .single();
    if (tenantError || !tenant) throw new Error(`tenants insert failed: ${tenantError?.message}`);
    tenantId = (tenant as { id: string }).id;

    // PO ADJUSTMENT 1 — isolation checkpoint BEFORE anything else.
    log('CHECKPOINT-tenant-isolation', {
      b34hTenantId: tenantId,
      principalTenantId: PRINCIPAL_TENANT_ID,
      distinct: tenantId !== PRINCIPAL_TENANT_ID,
    });
    expect(tenantId).not.toBe(PRINCIPAL_TENANT_ID);
    expect(typeof tenantId).toBe('string');
    expect(tenantId).toMatch(/^[0-9a-f-]{36}$/i);

    const { error: profilesError } = await admin().from('profiles').insert([
      { id: managerUser.userId, tenant_id: tenantId, full_name: 'B34H Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: barberUser.userId, tenant_id: tenantId, full_name: 'B34H Barbeiro', role: 'barber', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`profiles insert failed: ${profilesError.message}`);

    // Deterministic re-seed regardless of trigger drift (same strategy as globalSetup).
    await admin().from('staff').delete().eq('tenant_id', tenantId);
    await admin().from('user_tenants').delete().eq('tenant_id', tenantId);

    const { error: membershipsError } = await admin().from('user_tenants').insert([
      { user_id: managerUser.userId, tenant_id: tenantId, role: 'manager', is_primary: true },
      { user_id: barberUser.userId, tenant_id: tenantId, role: 'barber', is_primary: false },
    ]);
    if (membershipsError) throw new Error(`user_tenants insert failed: ${membershipsError.message}`);

    const { data: staffRows, error: staffError } = await admin()
      .from('staff')
      .insert([
        { id: managerUser.userId, name: 'B34H Manager', email: managerUser.email, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
        { id: barberUser.userId, name: 'B34H Barbeiro', email: barberEmail, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      ])
      .select('id, name');
    if (staffError || !staffRows) throw new Error(`staff insert failed: ${staffError?.message}`);
    barberStaffId = staffRows.find((s: any) => s.name === 'B34H Barbeiro')!.id as string;

    const { error: settingsError } = await admin()
      .from('tenant_settings')
      .upsert({ tenant_id: tenantId, chair_count: 1 }, { onConflict: 'tenant_id' });
    if (settingsError) throw new Error(`tenant_settings upsert failed: ${settingsError.message}`);

    const { data: clientRow, error: clientsError } = await admin()
      .from('clients')
      .insert({ tenant_id: tenantId, name: clientName, phone: '11000000001', email: `b34h-${runId}@val.com`, status: 'active' })
      .select('id')
      .single();
    if (clientsError || !clientRow) throw new Error(`clients insert failed: ${clientsError?.message}`);
    clientId = (clientRow as { id: string }).id;

    const { data: serviceRow, error: servicesError } = await admin()
      .from('services')
      .insert({ tenant_id: tenantId, name: serviceName, category: 'Validacao', price: 100, duration: 30, active: true })
      .select('id')
      .single();
    if (servicesError || !serviceRow) throw new Error(`services insert failed: ${servicesError?.message}`);
    serviceId = (serviceRow as { id: string }).id;

    log('seed-complete', { tenantId, managerUser: managerUser.email, barberStaffId, clientId, serviceId });
  });

  test.afterAll(async () => {
    // FK-aware teardown. Commission records first (RESTRICT on staff), then
    // items -> comandas -> transactions, then reference data, then users+tenant.
    type TeardownResult = { error?: { message?: string } | null };
    const steps: Array<[string, () => PromiseLike<TeardownResult>]> = [
      // notifications reference users AND tenant; must go first or auth-user
      // deletion fails ("Database error deleting user") and the tenant delete
      // hits an FK violation (observed in run b34h-val-1787530041878).
      ['notifications', () => admin().from('notifications').delete().eq('tenant_id', tenantId)],
      ['commission_records', () => admin().from('commission_records').delete().eq('tenant_id', tenantId)],
      ['comanda_items', async () => {
        const { data: comandas } = await admin().from('comandas').select('id').eq('tenant_id', tenantId);
        const ids = (comandas || []).map((c: any) => c.id);
        if (!ids.length) return { error: null };
        return admin().from('comanda_items').delete().in('comanda_id', ids);
      }],
      ['comandas', () => admin().from('comandas').delete().eq('tenant_id', tenantId)],
      // financial_reversals references transactions (FK
      // financial_reversals_original_transaction_id_fkey) and must be removed
      // BEFORE transactions (observed in reversal-phase run e7ce162c).
      ['financial_reversals', () => admin().from('financial_reversals').delete().eq('tenant_id', tenantId)],
      ['transactions', () => admin().from('transactions').delete().eq('tenant_id', tenantId)],
      ['appointments', () => admin().from('appointments').delete().eq('tenant_id', tenantId)],
      ['processed_operations', () => admin().from('processed_operations').delete().eq('tenant_id', tenantId)],
      ['event_store', () => admin().from('event_store').delete().eq('metadata->>tenantId', tenantId)],
      ['clients', () => admin().from('clients').delete().eq('tenant_id', tenantId)],
      ['services', () => admin().from('services').delete().eq('tenant_id', tenantId)],
      ['staff', () => admin().from('staff').delete().eq('tenant_id', tenantId)],
      ['user_tenants', () => admin().from('user_tenants').delete().eq('tenant_id', tenantId)],
      ['profiles', () => admin().from('profiles').delete().eq('tenant_id', tenantId)],
      ['auth-users-manager', () => deleteUserByEmail(managerUser.email).then(() => ({ error: null }))],
      // TD-001 / Test Infrastructure — Auth User Teardown Gap: the barber user
      // was previously never removed and accumulated across runs (26 orphaned
      // auth users found on 2026-08-24). Exact run-scoped identity only —
      // deleteUserByEmail resolves the exact email to its ID before deleting;
      // no prefix-based deletion.
      ['auth-users-barber', () => deleteUserByEmail(barberUser.email).then(() => ({ error: null }))],
      ['tenant_settings', () => admin().from('tenant_settings').delete().eq('tenant_id', tenantId)],
      ['tenants', () => admin().from('tenants').delete().eq('id', tenantId)],
    ];
    for (const [name, fn] of steps) {
      try {
        const res = await fn();
        const error = res?.error ?? null;
        if (error) console.warn(`[B34H][teardown] ${name} failed: ${error.message}`);
        else log('teardown', { step: name, ok: true });
      } catch (err) {
        console.warn(`[B34H][teardown] ${name} threw`, err);
      }
    }
  });

  // -------------------------------------------------------------------------
  test('FASE 1 - Real UI checkout produces exactly one correct commission record', async ({ page }) => {
    test.info().annotations.push({ description: 'UI Checkout -> CheckoutCompleted -> commission_records', type: 'b34h' });

    // Persistent console capture across the whole dispatch window.
    const allLogs: string[] = [];
    const collector = (msg: any) => {
      const text = msg.text();
      if (
        msg.type() === 'error' ||
        /COMMISSION_RECORD_HANDLER|OUTBOX|FINANCE_SUBSCRIBER|FINANCE_PROVIDER|dead.?letter|reversal/i.test(text)
      ) {
        allLogs.push(`[${msg.type()}] ${text.slice(0, 400)}`);
      }
    };
    page.on('console', collector);

    try {
      await uiLogin(page);
      await performUiCheckout(page);

      let firstPoll = true;
      const comanda = (await pollUntil(async () => {
        const r = await admin()
          .from('comandas')
          .select('id, tenant_id, status, total')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(1);
        if (firstPoll) {
          console.log(
            `[B34H][FASE1-first-poll] ${JSON.stringify({ row: r.data?.[0] ?? null, err: r.error?.message ?? null })}`,
          );
          firstPoll = false;
        }
        return r.data && r.data.length ? (r.data[0] as Record<string, unknown>) : null;
      }, 'comanda row', 60_000)) as Record<string, unknown>;
      comandaAId = comanda.id as string;
      log('FASE1-comanda', comanda);
      expect(comandaAId).toBeTruthy();

      try {
        var record = await waitForCommissionRecord(comandaAId);
      } catch (err) {
        console.log(
          `[B34H][FASE1-dispatch-logs-on-timeout] ${JSON.stringify(allLogs.slice(-40))}`,
        );
        // Ground-truth dump BEFORE teardown wipes evidence.
        const dbgItems = await admin()
          .from('comanda_items')
          .select('id, staff_id, service_id, unit_price, quantity')
          .eq('comanda_id', comandaAId);
        const itemIdsDbg = (dbgItems.data || []).map((i: any) => i.id);
        const dbgParts = itemIdsDbg.length
          ? await admin()
              .from('service_execution_participants')
              .select('*')
              .in('comanda_item_id', itemIdsDbg)
          : { data: [] as any[] };
        const dbgComanda = await admin()
          .from('comandas')
          .select('id, staff_id, status, total, discount, closure_mode, payment_method, financial_effect')
          .eq('id', comandaAId);
        console.log(
          `[B34H][FASE1-db-ground-truth] ${JSON.stringify({
            comanda: dbgComanda.data?.[0] ?? null,
            items: dbgItems.data ?? null,
            itemsErr: dbgItems.error?.message ?? null,
            participants: dbgParts.data ?? null,
            partsErr: (dbgParts as any).error?.message ?? null,
          })}`,
        );
        // Offline replay of the handler decision with REAL domain functions
        // on live-fetched rows — isolates logic vs runtime divergence.
        try {
          const participantsMod = await import('../../../domain/commission/participants');
          const calcMod = await import('../../../domain/commission/calculate');
          const rolesMod = await import('../../../src/lib/staff/roles');
          const cm: any = dbgComanda.data?.[0];
          const it0: any = dbgItems.data?.[0];
          const staffRows = await admin()
            .from('staff')
            .select('id, name, role, status, commission_rate')
            .eq('tenant_id', tenantId);
          const staffById = new Map((staffRows.data || []).map((s: any) => [s.id, s]));
          const parts: any[] = dbgParts.data || [];
          const norm = participantsMod.normalizeCommissionParticipants(
            { id: it0.id, service_id: it0.service_id, staff_id: it0.staff_id },
            { staff_id: cm.staff_id },
            parts,
            Number(it0.unit_price),
            staffById as any,
          );
          const detail = norm.participants.map((p: any) => {
            const sid = p.staff_id || p.professional_id;
            const st: any = staffById.get(sid);
            const fb = calcMod.resolveFinancialBase({
              item: it0,
              discount: Number(it0.discount) || Number(cm.discount) || 0,
              paidAmount: Number(cm.paid_amount ?? cm.amount_paid ?? cm.total),
              quantity: Number(it0.quantity) || 1,
            });
            const rate = rolesMod.getEffectiveCommissionRate(st);
            const val = calcMod.calculateCommissionValue(fb.receivedValue, p, rate);
            return {
              sid,
              role: st?.role,
              receives: st ? rolesMod.receivesCommission(st) : null,
              gross: fb.grossValue,
              net: fb.netValue,
              received: fb.receivedValue,
              payout_value: p.payout_value,
              rate,
              value: val,
            };
          });
          const p0: any = norm.participants[0] || {
            payout_type: 'percentage',
            payout_value: 100,
            staff_id: '',
          };
          const rate0 = rolesMod.getEffectiveCommissionRate(staffById.get(p0.staff_id || '') || null);
          // Chain A (handler intent on raw row): absent column falls through to total.
          const rawPaid = Number(cm.paid_amount ?? cm.amount_paid ?? cm.total);
          const rawFb = calcMod.resolveFinancialBase({
            item: it0,
            discount: Number(it0.discount) || Number(cm.discount) || 0,
            paidAmount: rawPaid,
            quantity: Number(it0.quantity) || 1,
          });
          const rawVal = calcMod.calculateCommissionValue(rawFb.receivedValue, p0, rate0);
          // Chain B (actual runtime): repository maps phantom paid_amount -> 0
          // (domain/comanda/repository.ts:43); `0 ?? total` keeps the 0.
          const mappedPaid =
            typeof cm.paid_amount === 'number' ? cm.paid_amount : 0;
          const mappedFb = calcMod.resolveFinancialBase({
            item: it0,
            discount: Number(it0.discount) || Number(cm.discount) || 0,
            paidAmount: mappedPaid,
            quantity: Number(it0.quantity) || 1,
          });
          const mappedVal = calcMod.calculateCommissionValue(
            mappedFb.receivedValue,
            p0,
            rate0,
          );
          console.log(
            `[B34H][FASE1-offline-replay] ${JSON.stringify({
              primaryStaffId: norm.primaryStaffId,
              participantCount: norm.participants.length,
              isShared: norm.isShared,
              detail,
              chainA_rawRow: {
                paidAmountSource: 'comanda.total',
                paidAmount: rawPaid,
                receivedValue: rawFb.receivedValue,
                rate: rate0,
                commissionValue: rawVal,
              },
              chainB_repositoryMapped: {
                syntheticPaidAmount: mappedPaid,
                receivedValue: mappedFb.receivedValue,
                rate: rate0,
                commissionValue: mappedVal,
                note: 'mirrors domain/comanda/repository.ts:43 + handler nullish chain',
              },
            })}`,
          );
        } catch (repErr) {
          console.log(`[B34H][FASE1-offline-replay] failure ${String(repErr)}`);
        }
        // Discriminator: run the EXACT handler input queries under the
        // manager session so RLS visibility matches handler runtime.
        try {
          const { createClient: createUserClient } = await import('@supabase/supabase-js');
          const envLocal = (await loadEnvLocal()) as Record<string, string>;
          const userClient = createUserClient(envLocal.VITE_SUPABASE_URL, envLocal.VITE_SUPABASE_ANON_KEY);
          const { error: signInErr } = await userClient.auth.signInWithPassword({
            email: managerUser.email,
            password: managerUser.password,
          });
          const asManager = async (q: () => PromiseLike<any>) => {
            if (signInErr) return { err: `signIn failed: ${signInErr.message}` };
            const r = await q();
            return { rows: r.data, err: r.error?.message ?? null };
          };
          const mItems = await asManager(() =>
            userClient.from('comanda_items').select('id, staff_id, unit_price, quantity').eq('tenant_id', tenantId).eq('comanda_id', comandaAId),
          );
          const itemIdsM = ((mItems as any).rows || []).map((i: any) => i.id);
          const mParts = await asManager(() =>
            userClient.from('service_execution_participants').select('id, comanda_item_id, staff_id, role, payout_type, payout_value, affects_commission, tenant_id').eq('tenant_id', tenantId).in('comanda_item_id', itemIdsM.length ? itemIdsM : ['00000000-0000-0000-0000-000000000000']),
          );
          const mStaff = await asManager(() =>
            userClient.from('staff').select('id, name, role, status, commission_rate, tenant_id').eq('tenant_id', tenantId),
          );
          console.log(
            `[B34H][FASE1-manager-view] ${JSON.stringify({ signInErr: signInErr?.message ?? null, items: mItems, participants: mParts, staff: mStaff })}`,
          );
        } catch (dbgErr) {
          console.log(`[B34H][FASE1-manager-view] setup-failure ${String(dbgErr)}`);
        }
        throw err;
      }
      commissionA = record;
      log('CHECKPOINT-FASE1-commission-record', record);
      console.log(`[B34H][FASE1-handler-logs] ${JSON.stringify(allLogs.slice(-25))}`);

      expect(record.record_type).toBe('commission');
      expect(record.staff_id).toBe(barberStaffId);
      expect(num(record.gross_value)).toBe(100);
      expect(num(record.net_value)).toBe(100);
      expect(num(record.received_value)).toBe(100);
      expect(num(record.commission_rate)).toBeCloseTo(0.4, 4);
      expect(num(record.participant_share)).toBeCloseTo(1.0, 4);
      expect(record.payout_type).toBe('percentage');
      expect(record.affects_commission).toBe(true);
      expect(num(record.commission_value)).toBe(40);
      expect(record.original_record_id).toBeNull();
      expect(String(record.status)).toBe('active');
      expect(String(record.idempotency_key)).toBeTruthy();
      expect(String(record.event_type)).toBe('CheckoutCompleted');

      // Sync path intact: transaction row still created synchronously at checkout.
      const { data: txs, error: txError } = await admin()
        .from('transactions')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('source_id', comandaAId);
      if (txError) throw new Error(`transactions query failed: ${txError.message}`);
      log('FASE1-sync-transactions', (txs || []).map((t: any) => ({ id: t.id, amount: t.amount, source_type: t.source_type })));
      expect((txs || []).length).toBeGreaterThanOrEqual(1);
    } finally {
      page.off('console', collector);
    }
  });

  // -------------------------------------------------------------------------
  test('FASE 2 - Replay guard proven at database level (unique indexes)', async () => {
    test.info().annotations.push({ description: 'DB-level idempotency evidence for FASE 2 replay', type: 'b34h' });
    if (!commissionA) throw new Error('FASE 1 state missing');

    // Honest scope note: the outbox is in-memory per browser session, so an
    // external event replay cannot be triggered against this deployment. The
    // hard guarantee lives in the database constraints; subscriber-level
    // idempotency was already covered by unit tests (B3.4-E suite).
    log('FASE2-scope-note', {
      externalReplayPossible: false,
      reason: 'InMemoryOutbox is per-browser-session; no persistent queue to drain twice.',
    });

    // 2A — unique (staff_id, comanda_id) prevents a second commission for the
    // same professional/comanda.
    const dupOriginal = await admin()
      .from('commission_records')
      .insert({
        tenant_id: tenantId,
        record_type: 'commission',
        comanda_id: comandaAId,
        staff_id: barberStaffId,
        gross_value: 100,
        net_value: 100,
        received_value: 100,
        commission_rate: 0.4,
        commission_value: 40,
        idempotency_key: `b34h-replay-dup-original-${runId}`,
        event_id: 'b34h-replay-dup-original-event',
        event_type: 'CheckoutCompleted',
      });
    log('CHECKPOINT-FASE2-2A-staff-comanda-blocked', { blocked: !!dupOriginal.error, detail: dupOriginal.error?.message });
    expect(dupOriginal.error).not.toBeNull();
    expect(dupOriginal.error!.message).toContain('idx_commission_records_staff_comanda');

    // 2B — unique idempotency_key prevents reprocessing the same operation.
    // We deliberately use a DIFFERENT (staff, comanda) pair so the staff/comanda
    // index cannot mask this second guarantee; only the idempotency index should fire.
    const { data: altComanda, error: altErr } = await admin()
      .from('comandas')
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        staff_id: barberStaffId,
        status: 'paid',
        total: 100,
        subtotal: 100,
        discount: 0,
        payment_method: 'cash',
        idempotency_key: `b34h-alt-comanda-${runId}`,
      })
      .select('id')
      .single();
    expect(altErr).toBeNull();
    expect(altComanda).not.toBeNull();
    const originalKey = String(commissionA.idempotency_key);
    const dupIdem = await admin()
      .from('commission_records')
      .insert({
        tenant_id: tenantId,
        record_type: 'commission',
        comanda_id: altComanda!.id,
        staff_id: barberStaffId,
        gross_value: 100,
        net_value: 100,
        received_value: 100,
        commission_rate: 0.4,
        commission_value: 40,
        idempotency_key: originalKey,
        event_id: 'b34h-replay-dup-idem-event',
        event_type: 'CheckoutCompleted',
      });
    log('CHECKPOINT-FASE2-2B-idempotency-blocked', { blocked: !!dupIdem.error, detail: dupIdem.error?.message });
    expect(dupIdem.error).not.toBeNull();
    expect(dupIdem.error!.message).toContain('idx_commission_records_idempotency');

    // No extra rows appeared for the original comanda.
    const rows = await fetchCommissionByComanda(comandaAId, 'commission');
    expect(rows).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
    test('FASE 3 - Real UI reversal produces audited reversal, preserves original, nets zero', async ({ page }) => {
    test.info().annotations.push({ description: 'UI Cashflow reversal -> CheckoutReverted -> reverse_commission', type: 'b34h' });
    if (!commissionA) throw new Error('FASE 1 state missing');

    // INSTRUMENTATION (TD-001 B3.4-H): capture browser console for FASE 3 page
    // so reversal.ts publish logs ([reversal]… / [REVERSAL][EVENT-PUBLISH-FAILED]) are observed.
    const f3Logs: string[] = [];
    const f3Collector = (msg: any) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      if (msg.type() === 'error' || /COMMISSION_RECORD_HANDLER|OUTBOX|FINANCE_SUBSCRIBER|FINANCE_PROVIDER|dead.?letter|reversal/i.test(text)) {
        f3Logs.push(text.slice(0, 400));
      }
    };
    page.on('console', f3Collector);

    const snapshotBefore = {
      commission_value: commissionA.commission_value,
      gross_value: commissionA.gross_value,
      net_value: commissionA.net_value,
      received_value: commissionA.received_value,
      staff_id: commissionA.staff_id,
      status: commissionA.status,
    };
    log('FASE3-original-snapshot-before', snapshotBefore);

    await uiLogin(page);
    await openReversalModalAndFill(page, 'Validacao controlada B3.4-H FASE 3');
    const outcome = await confirmReversal(page);
    log('CHECKPOINT-FASE3-reversal-outcome', { outcome });
    expect(outcome).toBe('success');

    // ── INSTRUMENTATION (TD-001 B3.4-H correction gate) ───────────────────────
    // Capture the discriminators between the two candidate failure modes:
    //  (1) originalTx.source_type !== 'comanda'  → publish skipped silently
    //  (2) source_type === 'comanda' but originalCommission === 0 → reverse_commission not enqueued
    // All reads are spec-side (no reversal.ts change).
    const txProbe = await admin()
      .from('transactions')
      .select('id, source_id, source_type, type, amount, idempotency_key')
      .eq('source_id', comandaAId);
    log('CHECKPOINT-FASE3-instrument-tx', { rows: txProbe.data ?? null, err: txProbe.error?.message ?? null });

    const esProbe = await admin()
      .from('event_store')
      .select('id, event_type, payload')
      .eq('metadata->>tenantId', tenantId)
      .eq('event_type', 'CheckoutReverted');
    log('CHECKPOINT-FASE3-instrument-eventstore', {
      count: esProbe.data?.length ?? 0,
      events: (esProbe.data ?? []).map((e: any) => ({
        eventType: e.event_type,
        payload: e.payload,
      })),
      err: esProbe.error?.message ?? null,
    });
    log('CHECKPOINT-FASE3-browser-logs', { logs: f3Logs });
    // ──────────────────────────────────────────────────────────────────────────

    await new Promise((r) => setTimeout(r, DISPATCH_WAIT_MS));

    const reversals = await pollUntil(async () => {
      const rows = await fetchCommissionByComanda(comandaAId, 'reversal');
      return rows.length >= 1 ? rows : null;
    }, 'reversal record');
    const reversal = reversals[0] as Record<string, unknown>;
    log('CHECKPOINT-FASE3-reversal-record', reversal);
    log('CHECKPOINT-FASE3-reversal-count', { enqueued_reverse_commission: reversals.length });

    expect(reversal.record_type).toBe('reversal');
    expect(reversal.original_record_id).toBe(commissionA.id);
    expect(num(reversal.commission_value)).toBe(-40);
    expect(num(reversal.gross_value)).toBe(0);
    expect(num(reversal.received_value)).toBe(0);
    expect(reversal.affects_commission).toBe(false);
    expect(reversal.staff_id).toBe(barberStaffId);
    // Idempotency-key contract is split across two entities (TD-001 B3.4-H):
    //  - the reversal TRANSACTION uses the finance-reversal-* prefix
    //  - the commission_records.reversal uses the evt_*_reverse_commission_* prefix
    const reversalTx = (txProbe.data ?? []).find(
      (t: any) => t.type === 'expense' && String(t.idempotency_key ?? '').startsWith('finance-reversal-'),
    );
    expect(reversalTx, 'reversal transaction must carry a finance-reversal-* idempotency key').toBeTruthy();
    expect(String(reversalTx.idempotency_key)).toMatch(/^finance-reversal-/);
    expect(String(reversal.idempotency_key)).toMatch(/^evt_.*_reverse_commission_/);
    expect(String(reversal.status)).toBe('active');

    // Original row untouched (append-only guarantee).
    const originals = await fetchCommissionByComanda(comandaAId, 'commission');
    expect(originals).toHaveLength(1);
    const after = originals[0] as Record<string, unknown>;
    expect(after).toMatchObject(snapshotBefore);
    log('CHECKPOINT-FASE3-original-preserved', after);

    // Net effect zero.
    const all = await fetchCommissionByComanda(comandaAId);
    const netSum = all.reduce((acc: number, r: any) => acc + num(r.commission_value), 0);
    log('CHECKPOINT-FASE3-net-sum-zero', { netSum });
    expect(netSum).toBe(0);
  });

  // -------------------------------------------------------------------------
  test('FASE 4A - Concurrent real handler executions produce exactly ONE effective reversal', async ({ browser }) => {
    test.info().annotations.push({ description: 'Dual-context simultaneous UI reversals (real pipeline)', type: 'b34h' });

    // Second checkout (comanda B) with its own live commission record.
    const seed = await newLoggedContext(browser);
    await performUiCheckout(seed.page);
    comandaBId = await pollUntil(
      () => latestComandaId([comandaAId]),
      'comanda B',
    );
    expect(comandaBId).toBeTruthy();
    commissionB = await waitForCommissionRecord(comandaBId);
    log('FASE4A-second-checkout', { comandaBId, commissionValue: commissionB!.commission_value });
    expect(num(commissionB!.commission_value)).toBe(40);
    await seed.ctx.close(); // safe: commission record already persisted

    // Dual contexts, both driving the REAL reversal pipeline simultaneously.
    // Each modal generates its own random finance-reversal-* idempotency key,
    // so dedup MUST come from the pipeline/RPC guards, not from key reuse.
    const [a, b] = await Promise.all([newLoggedContext(browser), newLoggedContext(browser)]);
    await Promise.all([
      openReversalModalAndFill(a.page, 'Validacao B3.4-H FASE 4A contexto A'),
      openReversalModalAndFill(b.page, 'Validacao B3.4-H FASE 4A contexto B'),
    ]);
    const outcomes = await Promise.all([confirmReversal(a.page), confirmReversal(b.page)]);
    log('CHECKPOINT-FASE4A-ui-outcomes', outcomes);

    await new Promise((r) => setTimeout(r, DISPATCH_WAIT_MS));
    const effectiveReversals = await pollUntil(async () => {
      const rows = await fetchCommissionByComanda(comandaBId, 'reversal');
      return rows.length >= 1 ? rows : [];
    }, '4A reversals');
    log('CHECKPOINT-FASE4A-effective-reversals', effectiveReversals.map((r: any) => ({
      id: r.id,
      value: r.commission_value,
      idempotency_key: r.idempotency_key,
    })));
    expect(effectiveReversals).toHaveLength(1);
    expect(num(effectiveReversals[0].commission_value)).toBe(-40);

    await a.ctx.close();
    await b.ctx.close();
  });

  // -------------------------------------------------------------------------
  test('FASE 4B - Direct concurrent RPC calls prove advisory lock + SUM validation', async ({ browser }) => {
    test.info().annotations.push({ description: 'Parallel create_commission_reversal calls (authenticated session)', type: 'b34h' });

    // Third checkout via UI (comanda C) — context kept open until record lands.
    const seed = await newLoggedContext(browser);
    await performUiCheckout(seed.page);
    comandaCId = await pollUntil(() => latestComandaId([comandaAId, comandaBId]), 'comanda C');
    expect(comandaCId).toBeTruthy();
    commissionC = await waitForCommissionRecord(comandaCId);
    log('FASE4B-third-checkout', { comandaCId, commissionValue: commissionC!.commission_value });
    expect(num(commissionC!.commission_value)).toBe(40);
    await seed.ctx.close();

    // Direct parallel RPC calls with DISTINCT idempotency keys: idempotency
    // cannot dedupe these; only pg_advisory_xact_lock + FOR UPDATE + the SUM
    // validation can. Exactly one must succeed.
    const userClient = await createAuthenticatedClient();
    const call = (suffix: string) =>
      userClient.rpc('create_commission_reversal', {
        p_tenant_id: tenantId,
        p_original_record_id: commissionC!.id,
        p_commission_value: -40,
        p_idempotency_key: `b34h-rpc-${runId}-${suffix}`,
        p_event_id: `b34h-rpc-${runId}-${suffix}`,
        p_event_type: 'CheckoutReverted',
      });
    const [resA, resB] = await Promise.all([call('a'), call('b')]);
    log('CHECKPOINT-FASE4B-rpc-a', { error: resA.error?.message ?? null, data: resA.data });
    log('CHECKPOINT-FASE4B-rpc-b', { error: resB.error?.message ?? null, data: resB.data });

    const successes = [resA, resB].filter(
      (r) => !r.error && (r.data as any)?.success === true && (r.data as any)?.idempotent === false,
    );
    expect(successes).toHaveLength(1);

    const dbReversals = await fetchCommissionByComanda(comandaCId, 'reversal');
    log('CHECKPOINT-FASE4B-db-reversals', dbReversals.map((r: any) => ({
      id: r.id, value: r.commission_value, idempotency_key: r.idempotency_key,
    })));
    expect(dbReversals).toHaveLength(1);
    expect(num(dbReversals[0].commission_value)).toBe(-40);
  });

  // -------------------------------------------------------------------------
  test('FASE 5 - Overflow attempt observed and documented; negative matrix clean', async ({ browser }) => {
    test.info().annotations.push({ description: 'Overflow observation + forbidden-operation matrix', type: 'b34h' });

    // Fourth checkout via UI (comanda D) — fresh original with full balance.
    const seed = await newLoggedContext(browser);
    await performUiCheckout(seed.page);
    comandaDId = await pollUntil(
      () => latestComandaId([comandaAId, comandaBId, comandaCId]),
      'comanda D',
    );
    expect(comandaDId).toBeTruthy();
    commissionD = await waitForCommissionRecord(comandaDId);
    log('FASE5-fourth-checkout', { comandaDId, commissionValue: commissionD!.commission_value });
    expect(num(commissionD!.commission_value)).toBe(40);
    await seed.ctx.close();

    // PO ADJUSTMENT 3: OBSERVE behavior — do not assume cap vs rejection,
    // do not change any code to make this pass.
    const userClient = await createAuthenticatedClient();
    const attempt = await userClient.rpc('create_commission_reversal', {
      p_tenant_id: tenantId,
      p_original_record_id: commissionD!.id,
      p_commission_value: -9999,
      p_idempotency_key: `b34h-overflow-${runId}`,
      p_event_id: `b34h-overflow-${runId}`,
      p_event_type: 'CheckoutReverted',
    });
    log('CHECKPOINT-FASE5-overflow-attempt', {
      error: attempt.error?.message ?? null,
      data: attempt.data,
    });

    if (attempt.error) {
      log('FASE5-OBSERVED-behavior', { kind: 'rejection', detail: attempt.error.message });
      expect(attempt.error.message).toContain('excede');
    } else if ((attempt.data as any)?.success === true) {
      log('FASE5-OBSERVED-behavior', { kind: 'accepted-or-capped', detail: attempt.data });
      // Documented, NOT failed: behavior observation only (PO rule).
    }

    // Final DB truth for comanda D (whatever behavior was observed).
    const allD = await fetchCommissionByComanda(comandaDId);
    log('CHECKPOINT-FASE5-comanda-D-final-state', allD.map((r: any) => ({
      record_type: r.record_type,
      commission_value: r.commission_value,
      idempotency_key: r.idempotency_key,
    })));

    // Negative matrix: zero forbidden operations ever enqueued/executed for
    // this tenant across ALL phases.
    await assertNoForbiddenRows();
  });
});
