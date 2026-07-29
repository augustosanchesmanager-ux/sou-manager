/**
 * E2E Test Data — Matches actual local demo mode seed data
 *
 * Source of truth: src/lib/supabase/client.ts createSeedDemoDatabase()
 * All tests run against localhost in local demo mode.
 */

export const DEMO_TENANT = {
  id: '00000000-0000-0000-0000-000000000101',
  name: 'Barbearia Demo',
  slug: 'demo',
};

/**
 * Local demo mode only supports ONE user:
 * Email: teste@soumanager.local
 * Password: 12345678
 * Role: manager
 */
export const DEMO_USER = {
  email: 'teste@soumanager.local',
  password: '12345678',
  role: 'manager' as const,
  name: 'Teste Local',
};

/** Demo seed data — clients */
export const DEMO_CLIENTS = [
  {
    id: 'demo-client-1',
    name: 'Carlos Demo',
    phone: '11999990001',
    email: 'carlos@demo.com',
  },
  {
    id: 'demo-client-2',
    name: 'Fernanda Demo',
    phone: '11999990002',
    email: 'fernanda@demo.com',
  },
];

/** Demo seed data — staff */
export const DEMO_STAFF = [
  {
    id: 'demo-staff-1',
    name: 'Marcos Demo',
    role: 'barber',
    commission_rate: 0.4,
  },
  {
    id: 'demo-staff-2',
    name: 'Julia Demo',
    role: 'manager',
    commission_rate: 0.15,
  },
];

/** Demo seed data — services */
export const DEMO_SERVICES = [
  {
    id: 'demo-service-1',
    name: 'Corte masculino',
    price: 65.0,
    duration: 45,
  },
  {
    id: 'demo-service-2',
    name: 'Barba',
    price: 55.0,
    duration: 35,
  },
];

/** Demo seed data — products */
export const DEMO_PRODUCTS = [
  {
    id: 'demo-product-1',
    name: 'Pomada Modeladora',
    price: 35.0,
    stock: 3,
  },
];

/** Demo seed data — plans */
export const DEMO_PLANS = [
  {
    id: 'demo-plan-gold',
    name: 'Gold',
    price: 99.9,
    credits: 2,
    validity_days: 30,
  },
  {
    id: 'demo-plan-black',
    name: 'Black',
    price: 149.9,
    credits: 4,
    validity_days: 30,
  },
];

/** Demo seed data — comandas */
export const DEMO_COMANDAS = [
  {
    id: 'demo-comanda-1',
    status: 'open',
    total: 65.0,
  },
  {
    id: 'demo-comanda-2',
    status: 'paid',
    total: 120.0,
  },
];

/**
 * Generate a unique idempotency key for tests
 */
export function generateTestKey(prefix = 'e2e'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}
