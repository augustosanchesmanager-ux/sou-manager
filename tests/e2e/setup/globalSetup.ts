import * as fs from 'fs';
import * as path from 'path';
import { createConfirmedUser, deleteUserByEmail, getAdminClient } from '../helpers/supabaseAdmin';
import type { E2EFixtureState } from '../data/fixtureState';

/**
 * Playwright globalSetup — seeds the deterministic E2E tenant.
 *
 * The main suite runs against REAL Supabase (flow6-tenant-provisioning already
 * validated the app-side provisioning path). This script provisions the
 * *fixture* tenant used by loggedAdmin/loggedManager/loggedBarber/loggedCashier
 * fixtures and by page-load tests. It creates users via the Admin API
 * (email_confirm=true), which bypasses SMTP delivery, GoTrue DNS/MX email
 * validation and signup rate limits — the same decision documented in
 * flow6/flow6a and MIGRATION_EXCEPTION_20260801.md.
 *
 * Seeding strategy:
 *   1. Create 3 confirmed users (manager, barber, cashier) via Admin API.
 *   2. Insert tenant (status active, app_slug barber) via service role.
 *   3. Insert profiles (role must pass CHECK (superadmin,manager,staff,barber);
 *      cashier uses 'staff'), user_tenants and staff rows.
 *      The manager profile insert fires handle_new_manager_profile(), which
 *      auto-creates the Manager staff row.
 *   4. Seed minimal domain data (tenant_settings, clients, services) so pages
 *      render real rows instead of empty states.
 *   5. Persist credentials to test-results/.e2e-fixture-state.json for the
 *      auth fixtures (see tests/e2e/data/fixtureState.ts).
 *
 * Teardown (returned function): deletes the 3 auth users (profiles and
 * user_tenants cascade) and removes the tenant domain rows + tenant, keeping
 * the database clean between runs.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const runId = Date.now();
  const PASSWORD = 'E2e-Fixture-2026!';

  const users = {
    manager: { email: `e2e-suite-${runId}-manager@gmail.com`, password: PASSWORD },
    barber: { email: `e2e-suite-${runId}-barber@gmail.com`, password: PASSWORD },
    cashier: { email: `e2e-suite-${runId}-cashier@gmail.com`, password: PASSWORD },
  };

  const admin = getAdminClient();

  // 1. Confirmed users via Admin API (no shop_name -> no pendingRegistration).
  const userIds: Record<'manager' | 'barber' | 'cashier', string> = {
    manager: await createConfirmedUser({
      email: users.manager.email,
      password: users.manager.password,
      userMetadata: { first_name: 'E2E', last_name: 'Manager' },
    }),
    barber: await createConfirmedUser({
      email: users.barber.email,
      password: users.barber.password,
      userMetadata: { first_name: 'E2E', last_name: 'Barber' },
    }),
    cashier: await createConfirmedUser({
      email: users.cashier.email,
      password: users.cashier.password,
      userMetadata: { first_name: 'E2E', last_name: 'Cashier' },
    }),
  };

  const tenantSlug = `e2e-suite-${runId}`;

  // 2. Tenant (active, barber app).
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .insert({
      name: `E2E Suite ${runId}`,
      slug: tenantSlug,
      app_slug: 'barber',
      plan: 'free',
      status: 'active',
    })
    .select('id')
    .single();
  if (tenantError || !tenant) {
    throw new Error(`seed: tenants insert failed: ${tenantError?.message ?? 'no tenant returned'}`);
  }
  const tenantId = tenant.id as string;

  const fail = (step: string, error: unknown): never => {
    const detail = error && typeof error === 'object' && 'message' in error
      ? (error as { message: string }).message
      : String(error);
    throw new Error(`seed: ${step} failed: ${detail} | ${JSON.stringify(error, null, 2)}`);
  };

  // 3. Profiles (may fire remote triggers that auto-create staff/user_tenants
  //    rows). Insert them, then clear tenant-scoped rows so the seed is fully
  //    deterministic regardless of remote trigger drift.
  const { error: profilesError } = await admin.from('profiles').insert([
    {
      id: userIds.manager,
      tenant_id: tenantId,
      full_name: 'E2E Manager',
      role: 'manager',
      status: 'active',
      onboarding_completed: true,
    },
    {
      id: userIds.barber,
      tenant_id: tenantId,
      full_name: 'E2E Barber',
      role: 'barber',
      status: 'active',
      onboarding_completed: true,
    },
    {
      id: userIds.cashier,
      tenant_id: tenantId,
      full_name: 'E2E Cashier',
      role: 'staff',
      status: 'active',
      onboarding_completed: true,
    },
  ]);
  if (profilesError) fail('profiles insert', profilesError);

  // Diagnostic: report what remote triggers auto-created after the profile
  // insert (kept for operator visibility, not required for the seed).
  const { data: autoStaff } = await admin.from('staff').select('id, email, role').eq('tenant_id', tenantId);
  const { data: autoMemberships } = await admin.from('user_tenants').select('user_id, role').eq('tenant_id', tenantId);
  console.log(
    `[e2e-seed] after profiles insert -> staff=${JSON.stringify(autoStaff)} memberships=${JSON.stringify(autoMemberships)}`,
  );

  // Clear any trigger-created rows for this tenant so the following inserts
  // are the single source of truth.
  const { error: staffClearError } = await admin.from('staff').delete().eq('tenant_id', tenantId);
  if (staffClearError) fail('staff clear (trigger cleanup)', staffClearError);
  const { error: membershipsClearError } = await admin.from('user_tenants').delete().eq('tenant_id', tenantId);
  if (membershipsClearError) fail('user_tenants clear (trigger cleanup)', membershipsClearError);

  const { error: membershipsError } = await admin.from('user_tenants').insert([
    { user_id: userIds.manager, tenant_id: tenantId, role: 'manager', is_primary: true },
    { user_id: userIds.barber, tenant_id: tenantId, role: 'barber', is_primary: false },
    { user_id: userIds.cashier, tenant_id: tenantId, role: 'receptionist', is_primary: false },
  ]);
  if (membershipsError) fail('user_tenants insert', membershipsError);

  const { error: staffError } = await admin.from('staff').insert([
    {
      name: 'E2E Manager',
      email: users.manager.email,
      phone: '',
      role: 'Manager',
      avatar: '',
      commission_rate: 0,
      status: 'active',
      tenant_id: tenantId,
    },
    {
      name: 'E2E Barber',
      email: users.barber.email,
      phone: '',
      role: 'Barber',
      avatar: '',
      commission_rate: 40,
      status: 'active',
      tenant_id: tenantId,
    },
    {
      name: 'E2E Cashier',
      email: users.cashier.email,
      phone: '',
      role: 'Receptionist',
      avatar: '',
      commission_rate: 0,
      status: 'active',
      tenant_id: tenantId,
    },
  ]);
  if (staffError) fail('staff insert', staffError);

  // 4. Minimal domain data so pages render real content.
  const { error: settingsError } = await admin
    .from('tenant_settings')
    .upsert({ tenant_id: tenantId, chair_count: 2 }, { onConflict: 'tenant_id' });
  if (settingsError) fail('tenant_settings upsert', settingsError);

  const { error: clientsError } = await admin.from('clients').insert([
    { tenant_id: tenantId, name: 'Carlos E2E', phone: '11999990001', email: 'carlos@e2e.com', status: 'active' },
    { tenant_id: tenantId, name: 'Fernanda E2E', phone: '11999990002', email: 'fernanda@e2e.com', status: 'active' },
  ]);
  if (clientsError) fail('clients insert', clientsError);

  const { error: servicesError } = await admin.from('services').insert([
    { tenant_id: tenantId, name: 'Corte masculino', category: 'Cabelo', price: 65, duration: 45, active: true },
    { tenant_id: tenantId, name: 'Barba', category: 'Barba', price: 55, duration: 35, active: true },
  ]);
  if (servicesError) fail('services insert', servicesError);

  // 5. Persist fixture state for the auth fixtures.
  const state: E2EFixtureState = {
    runId,
    tenantId,
    users,
  };
  const stateDir = path.resolve(process.cwd(), 'test-results');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, '.e2e-fixture-state.json'),
    JSON.stringify(state, null, 2),
    'utf-8',
  );

  console.log(`[e2e-seed] tenant ${tenantId} (${tenantSlug}) ready`);

  // Teardown: best-effort cleanup after the whole run.
  return async () => {
    try {
      for (const user of Object.values(users)) {
        await deleteUserByEmail(user.email);
      }
      await admin.from('clients').delete().eq('tenant_id', tenantId);
      await admin.from('services').delete().eq('tenant_id', tenantId);
      await admin.from('staff').delete().eq('tenant_id', tenantId);
      await admin.from('tenant_settings').delete().eq('tenant_id', tenantId);
      await admin.from('tenants').delete().eq('id', tenantId);
      console.log('[e2e-seed] teardown complete');
    } catch (err) {
      console.warn('[e2e-seed] teardown failed (tenant left for operator cleanup):', err);
    }
  };
}
