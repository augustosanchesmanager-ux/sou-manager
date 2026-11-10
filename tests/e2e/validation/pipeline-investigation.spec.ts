import { type BrowserContext, type Page, type ConsoleMessage } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  getAdminClient,
  loadEnvLocal,
  createConfirmedUser,
  deleteUserByEmail,
} from '../helpers/supabaseAdmin';

/**
 * READ-ONLY PIPELINE INVESTIGATION — Trilha B commission divergence.
 *
 * Runs the same checkout flow, but:
 *   1. Captures browser console logs (to detect subscriber/dispatcher errors)
 *   2. Waits 15s after checkout (multiple dispatch cycles)
 *   3. Queries ALL pipeline tables BEFORE teardown
 *
 * No production code is modified. Ephemeral tenant only.
 */

const PRINCIPAL_TENANT_ID = 'b716e290-f7f6-4449-b790-5ae9dcdadcab';
const PASSWORD = 'Trb-Validation-2026!';

const log = (checkpoint: string, payload: unknown) => {
  console.log(`[PIPELINE][${checkpoint}] ${JSON.stringify(payload)}`);
};

const admin = () => getAdminClient();

let runId = Date.now();
let tenantId = '';
let managerUser = { email: '', password: PASSWORD, userId: '' };
let barberUser = { email: '', password: PASSWORD, userId: '' };
let barberStaffId = '';
let clientId = '';
let serviceId = '';
let clientName = '';
let serviceName = '';
let comandaId = '';
let browserLogs: string[] = [];

async function countPrincipal(table: string): Promise<number> {
  const { count, error } = await admin().from(table).select('*', { count: 'exact', head: true }).eq('tenant_id', PRINCIPAL_TENANT_ID);
  if (error) throw new Error(`principal count ${table} failed: ${error.message}`);
  return count ?? -1;
}

async function applyVercelBypass(context: BrowserContext): Promise<void> {
  const secret = loadEnvLocal().VERCEL_AUTOMATION_BYPASS_SECRET;
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
  if (!secret || !baseUrl) return;
  const origin = new URL(baseUrl).origin;
  await context.route(`${origin}/**`, async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), 'x-vercel-protection-bypass': secret },
    });
  });
}

async function uiLogin(page: Page): Promise<void> {
  await page.goto('/#/login');
  const emailInput = page.locator('input[type="email"]');
  await emailInput.waitFor({ state: 'visible', timeout: 20_000 });
  await emailInput.fill(managerUser.email);
  await page.locator('input[type="password"]').fill(managerUser.password, { timeout: 15_000 });
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/#\/dashboard/, { timeout: 40_000 });
}

async function performCheckout(page: Page): Promise<void> {
  await page.goto('/#/checkout?mode=comanda');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await page.waitForTimeout(2_000);

  const clientButton = page.getByRole('button', { name: /Buscar/ }).first();
  await clientButton.waitFor({ state: 'visible', timeout: 20_000 });
  await clientButton.click();

  const clientSearch = page.locator('input[placeholder="Buscar cliente..."]');
  await clientSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await clientSearch.fill(clientName);
  await page.waitForTimeout(1_500);
  await page.getByText(clientName, { exact: false }).first().click();
  await page.waitForTimeout(500);

  const addServiceButton = page.getByRole('button', { name: /\+\s*Servi/ }).first();
  await expect(addServiceButton).toBeEnabled({ timeout: 30_000 });
  await addServiceButton.click();

  const serviceSearch = page.locator('input[placeholder*="Buscar"]').last();
  await serviceSearch.waitFor({ state: 'visible', timeout: 15_000 });
  await serviceSearch.fill(serviceName);
  await page.waitForTimeout(1_500);
  await page.getByText(serviceName, { exact: false }).first().click();
  await page.waitForTimeout(800);

  const fecharAgora = page.getByRole('button', { name: /Fechar agora/ }).first();
  if (await fecharAgora.isVisible().catch(() => false)) {
    await fecharAgora.click().catch(() => undefined);
  }
  const dinheiro = page.getByRole('button', { name: /^Dinheiro$/ }).first();
  if (await dinheiro.isVisible().catch(() => false)) {
    await dinheiro.click().catch(() => undefined);
  }

  const finishButton = page.getByRole('button', { name: /Confirmar e fechar|Concluir venda|Abrir e fechar agora/ }).first();
  await finishButton.waitFor({ state: 'visible', timeout: 15_000 });
  await finishButton.click();

  await page
    .waitForURL((u) => !u.hash.includes('/checkout'), { timeout: 45_000 })
    .catch(async () => {
      await page.getByText(/sucesso|registrada|finalizada/i).first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => undefined);
    });
}

test.describe.configure({ mode: 'serial' });

test.describe('PIPELINE - Commission pipeline read-only investigation', () => {
  test.setTimeout(240_000);

  test.beforeAll(async () => {
    runId = Date.now();
    clientName = `Cliente PL ${runId}`;
    serviceName = `Servico PL ${runId}`;
    managerUser.email = `pipeline-val-${runId}-manager@gmail.com`;
    barberUser.email = `pipeline-val-${runId}-barber@gmail.com`;

    managerUser.userId = await createConfirmedUser({
      email: managerUser.email,
      password: managerUser.password,
      userMetadata: { first_name: 'PL', last_name: 'Manager' },
    });
    barberUser.userId = await createConfirmedUser({
      email: barberUser.email,
      password: PASSWORD,
      userMetadata: { first_name: 'AAA', last_name: 'PL Barbeiro' },
    });

    const { data: tenant, error: tenantError } = await admin()
      .from('tenants')
      .insert({ name: `Pipeline Investigation ${runId}`, slug: `pipeline-val-${runId}`, app_slug: 'barber', plan: 'pro', status: 'active' })
      .select('id')
      .single();
    if (tenantError || !tenant) throw new Error(`tenants insert failed: ${tenantError?.message}`);
    tenantId = (tenant as { id: string }).id;
    expect(tenantId).not.toBe(PRINCIPAL_TENANT_ID);

    const { error: profilesError } = await admin().from('profiles').insert([
      { id: managerUser.userId, tenant_id: tenantId, full_name: 'PL Manager', role: 'manager', status: 'active', onboarding_completed: true },
      { id: barberUser.userId, tenant_id: tenantId, full_name: 'AAA PL Barbeiro', role: 'barber', status: 'active', onboarding_completed: true },
    ]);
    if (profilesError) throw new Error(`profiles insert failed: ${profilesError.message}`);

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
        { id: managerUser.userId, name: 'ZZZ PL Manager', email: managerUser.email, phone: '', role: 'manager', avatar: '', commission_rate: 0, status: 'active', tenant_id: tenantId },
        { id: barberUser.userId, name: 'AAA PL Barbeiro', email: barberUser.email, phone: '', role: 'barber', avatar: '', commission_rate: 40, status: 'active', tenant_id: tenantId },
      ])
      .select('id, name');
    if (staffError || !staffRows) throw new Error(`staff insert failed: ${staffError?.message}`);
    barberStaffId = staffRows.find((s: { name: string }) => s.name === 'AAA PL Barbeiro')!.id as string;

    const { error: settingsError } = await admin()
      .from('tenant_settings')
      .upsert({ tenant_id: tenantId, chair_count: 1 }, { onConflict: 'tenant_id' });
    if (settingsError) throw new Error(`tenant_settings upsert failed: ${settingsError.message}`);

    const { data: clientRow, error: clientsError } = await admin()
      .from('clients')
      .insert({ tenant_id: tenantId, name: clientName, phone: '11000000001', email: `pl-${runId}@val.com`, status: 'active' })
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

    log('seed-complete', { tenantId, barberStaffId, clientId, serviceId });
  });

  test('pipeline investigation: checkout + wait + capture all evidence', async ({ browser }) => {
    test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'PLAYWRIGHT_BASE_URL not set');

    const ctx = await browser.newContext();
    await applyVercelBypass(ctx);
    const page = await ctx.newPage();

    browserLogs = [];
    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      browserLogs.push(`[${msg.type()}] ${text}`);
    });
    page.on('pageerror', (err) => {
      browserLogs.push(`[PAGE_ERROR] ${err.message}`);
    });

    await uiLogin(page);
    await performCheckout(page);

    log('checkout-done', { url: page.url(), timestamp: Date.now() });

    // CRITICAL: wait 15 seconds for dispatch loop (5s intervals = 3 cycles)
    await page.waitForTimeout(15_000);
    log('wait-complete', { timestamp: Date.now() });

    // Now capture ALL evidence while browser is still alive
    // (in case we need to inspect anything via page.evaluate)

    // Close browser — all in-memory state lost from this point
    await ctx.close();

    // === DB EVIDENCE COLLECTION (service role, RLS bypass) ===

    // 1. Find the comanda
    const { data: comandas } = await admin()
      .from('comandas')
      .select('id, status, total, staff_id, payment_method, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);
    log('evidence-comandas', comandas);
    expect(comandas?.length).toBeGreaterThan(0);
    const comanda = comandas![0] as { id: string; status: string; total: number; staff_id: string | null };
    comandaId = comanda.id;

    // 2. comanda_items
    const { data: items } = await admin()
      .from('comanda_items')
      .select('id, staff_id, product_name, unit_price, quantity')
      .eq('comanda_id', comandaId);
    log('evidence-items', items);
    expect(items).toHaveLength(1);

    // 3. service_execution_participants
    const itemIds = (items || []).map((i: { id: string }) => i.id);
    const { data: participants } = await admin()
      .from('service_execution_participants')
      .select('*')
      .in('comanda_item_id', itemIds);
    log('evidence-participants', participants);

    // 4. commission_records (the failing assertion)
    const { data: commissions, error: commError } = await admin()
      .from('commission_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('comanda_id', comandaId);
    log('evidence-commissions', { rows: commissions, error: commError?.message });

    // 5. ALL commission_records for this tenant (broader search)
    const { data: allCommissions } = await admin()
      .from('commission_records')
      .select('id, record_type, comanda_id, staff_id, commission_value, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20);
    log('evidence-all-commissions-tenant', allCommissions);

    // 6. processed_operations
    const { data: processedOps, error: poError } = await admin()
      .from('processed_operations')
      .select('*')
      .eq('tenant_id', tenantId);
    log('evidence-processed-operations', { rows: processedOps, error: poError?.message });

    // 7. event_store (may be empty — code doesn't write to it, but verify)
    const { data: eventStoreRows } = await admin()
      .from('event_store')
      .select('id, event_type, aggregate_id, created_at')
      .eq('metadata->>tenantId', tenantId)
      .limit(10);
    log('evidence-event-store', eventStoreRows);

    // 8. transactions (settlement writes these BEFORE event)
    const { data: transactions } = await admin()
      .from('transactions')
      .select('id, type, amount, status, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(5);
    log('evidence-transactions', transactions);

    // 9. Console logs from browser
    const relevantLogs = browserLogs.filter((l) =>
      l.includes('event') || l.includes('outbox') || l.includes('dispatch') ||
      l.includes('finance') || l.includes('commission') || l.includes('error') ||
      l.includes('Error') || l.includes('subscriber') || l.includes('TRB')
    );
    log('evidence-browser-logs', { total: browserLogs.length, relevant: relevantLogs });

    // 10. Principal integrity
    const principalSnap: Record<string, number> = {};
    for (const t of ['comandas', 'comanda_items', 'staff', 'clients', 'services', 'transactions', 'commission_records']) {
      principalSnap[t] = await countPrincipal(t);
    }
    log('evidence-principal-integrity', principalSnap);
  });

  test.afterAll(async () => {
    if (!tenantId) return;

    const steps: Array<[string, () => PromiseLike<{ error?: { message?: string } | null }>]> = [
      ['notifications', () => admin().from('notifications').delete().eq('tenant_id', tenantId)],
      ['commission_records', () => admin().from('commission_records').delete().eq('tenant_id', tenantId)],
      ['processed_operations', () => admin().from('processed_operations').delete().eq('tenant_id', tenantId)],
      ['event_store', () => admin().from('event_store').delete().eq('metadata->>tenantId', tenantId)],
      ['service_execution_participants', async () => {
        const { data: comandas } = await admin().from('comandas').select('id').eq('tenant_id', tenantId);
        const ids = (comandas || []).map((c: { id: string }) => c.id);
        if (!ids.length) return { error: null };
        const { data: itemIds } = await admin().from('comanda_items').select('id').in('comanda_id', ids);
        const iids = (itemIds || []).map((i: { id: string }) => i.id);
        if (!iids.length) return { error: null };
        return admin().from('service_execution_participants').delete().in('comanda_item_id', iids);
      }],
      ['comanda_items', async () => {
        const { data: comandas } = await admin().from('comandas').select('id').eq('tenant_id', tenantId);
        const ids = (comandas || []).map((c: { id: string }) => c.id);
        if (!ids.length) return { error: null };
        return admin().from('comanda_items').delete().in('comanda_id', ids);
      }],
      ['comandas', () => admin().from('comandas').delete().eq('tenant_id', tenantId)],
      ['financial_reversals', () => admin().from('financial_reversals').delete().eq('tenant_id', tenantId)],
      ['transactions', () => admin().from('transactions').delete().eq('tenant_id', tenantId)],
      ['appointments', () => admin().from('appointments').delete().eq('tenant_id', tenantId)],
      ['clients', () => admin().from('clients').delete().eq('tenant_id', tenantId)],
      ['services', () => admin().from('services').delete().eq('tenant_id', tenantId)],
      ['tenant_settings', () => admin().from('tenant_settings').delete().eq('tenant_id', tenantId)],
      ['staff', () => admin().from('staff').delete().eq('tenant_id', tenantId)],
      ['user_tenants', () => admin().from('user_tenants').delete().eq('tenant_id', tenantId)],
      ['profiles', () => admin().from('profiles').delete().eq('tenant_id', tenantId)],
      ['tenants', () => admin().from('tenants').delete().eq('id', tenantId)],
    ];

    for (const [name, fn] of steps) {
      const res = await fn();
      if (res?.error) log('teardown-warn', { step: name, error: res.error.message });
    }
    await deleteUserByEmail(managerUser.email);
    await deleteUserByEmail(barberUser.email);
    log('teardown-done', { tenantId });
  });
});
