import { createClient } from '@supabase/supabase-js';
import { loadEnvLocal } from '../helpers/supabaseAdmin';

const env = loadEnvLocal();
const STAGING_URL = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

export interface SeedChefClubResult {
  subscriptionA: {
    id: string;
    receivableIds: { pending: string; overdue: string; paid: string };
  };
  subscriptionB: {
    id: string;
    receivableIds: { pending: string; overdue: string; paid: string };
  };
  clientId: string;
  managerId: string;
  tenantB: {
    subscriptionId: string;
    receivableIds: { pending: string; overdue: string; paid: string };
    clientId: string;
    managerId: string;
    tenantId: string;
  };
}

async function seedChefClubData(tenantId: string): Promise<SeedChefClubResult> {
  const admin = createClient(STAGING_URL, SERVICE_ROLE_KEY);

  const { data: managerStaff } = await admin
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'manager')
    .single();

  if (!managerStaff) {
    throw new Error(`No manager found for tenant ${tenantId}`);
  }

  const { data: existingClients } = await admin
    .from('clients')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(2);

  let clientAId: string;
  let clientBId: string;

  if (existingClients && existingClients.length >= 2) {
    clientAId = existingClients[0].id;
    clientBId = existingClients[1].id;
  } else if (existingClients && existingClients.length === 1) {
    clientAId = existingClients[0].id;
    const { data: newClient, error: clientError } = await admin
      .from('clients')
      .insert({
        tenant_id: tenantId,
        name: 'E2E Client B',
        email: `e2e-client-b-${Date.now()}@test.local`,
        phone: '11999999999',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (clientError || !newClient) {
      throw new Error(`Failed to create second client: ${clientError?.message}`);
    }
    clientBId = newClient.id;
  } else {
    throw new Error(`No clients found for tenant ${tenantId}`);
  }

  const now = new Date().toISOString();

  let plan;
  const { data: existingPlan } = await admin
    .from('customer_plans')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .limit(1)
    .single();

  if (existingPlan) {
    plan = existingPlan;
  } else {
    const { data: newPlan, error: planError } = await admin
      .from('customer_plans')
      .insert({
        tenant_id: tenantId,
        name: 'Plano Teste E2E',
        monthly_price: 99.90,
        service_credits: 5,
        active: true,
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (planError) {
      throw new Error(`Failed to create plan: ${planError.message}`);
    }
    plan = newPlan;
  }

  const subA = await insertSubscriptionWithReceivables(admin, tenantId, clientAId, plan.id, now, managerStaff.id);
  const subB = await insertSubscriptionWithReceivables(admin, tenantId, clientBId, plan.id, now, managerStaff.id);

  const tenantB = await seedTenantB(admin, tenantId, plan.id, now, managerStaff.id);

  return {
    subscriptionA: { id: subA.subscriptionId, receivableIds: subA.receivableIds },
    subscriptionB: { id: subB.subscriptionId, receivableIds: subB.receivableIds },
    clientId: clientAId,
    managerId: managerStaff.id,
    tenantB,
  };
}

async function insertSubscriptionWithReceivables(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
  clientId: string,
  planId: string,
  now: string,
  managerId: string,
) {
  const subscriptionId = crypto.randomUUID();

  const { error: subError } = await admin
    .from('customer_subscriptions')
    .insert({
      id: subscriptionId,
      tenant_id: tenantId,
      client_id: clientId,
      plan_id: planId,
      status: 'active',
      started_at: now,
      cycle_start: now,
      cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    });

  if (subError) {
    throw new Error(`Failed to create subscription: ${subError.message}`);
  }

  const pendingId = crypto.randomUUID();
  const overdueId = crypto.randomUUID();
  const paidId = crypto.randomUUID();

  const receivables = [
    {
      id: pendingId,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      customer_id: clientId,
      plan_id: planId,
      amount: 99.90,
      status: 'pending',
      billing_cycle_start: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      billing_cycle_end: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    },
    {
      id: overdueId,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      customer_id: clientId,
      plan_id: planId,
      amount: 99.90,
      status: 'overdue',
      billing_cycle_start: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      billing_cycle_end: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    },
    {
      id: paidId,
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      customer_id: clientId,
      plan_id: planId,
      amount: 99.90,
      status: 'paid',
      billing_cycle_start: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
      billing_cycle_end: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paid_at: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
    },
  ];

  const { error: recvError } = await admin
    .from('customer_subscription_receivables')
    .insert(receivables);

  if (recvError) {
    throw new Error(`Failed to create receivables: ${recvError.message}`);
  }

  const { error: creditError } = await admin
    .from('customer_credits')
    .insert({
      id: crypto.randomUUID(),
      tenant_id: tenantId,
      client_id: clientId,
      subscription_id: subscriptionId,
      available_credits: 5,
      used_credits: 2,
      period_start: now,
      period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
    });

  if (creditError) {
    throw new Error(`Failed to create credits: ${creditError.message}`);
  }

  return {
    subscriptionId,
    receivableIds: { pending: pendingId, overdue: overdueId, paid: paidId },
  };
}

async function seedTenantB(
  admin: ReturnType<typeof createClient>,
  tenantAId: string,
  planAId: string,
  now: string,
  tenantAManagerId: string,
): Promise<SeedChefClubResult['tenantB']> {
  const tenantSlug = `e2e-tenant-b-${Date.now()}`;
  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .insert({
      name: `E2E Tenant B ${Date.now()}`,
      slug: tenantSlug,
      app_slug: 'barber',
      plan: 'pro',
      status: 'active',
    })
    .select('id')
    .single();

  if (tErr || !tenant) {
    throw new Error(`Failed to create Tenant B: ${tErr?.message}`);
  }
  const tenantBId = tenant.id;

  const managerEmail = `e2e-tenant-b-manager-${Date.now()}@gmail.com`;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: managerEmail,
    password: 'E2e-TenantB-2026!',
    email_confirm: true,
    user_metadata: { first_name: 'E2E', last_name: 'TenantB-Manager' },
  });
  if (authErr || !authUser?.user?.id) {
    throw new Error(`Failed to create Tenant B user: ${authErr?.message}`);
  }
  const userId = authUser.user.id;

  await admin.from('profiles').insert({
    id: userId,
    tenant_id: tenantBId,
    full_name: 'E2E Tenant B Manager',
    role: 'manager',
    status: 'active',
    onboarding_completed: true,
  });

  await admin.from('user_tenants').insert({
    user_id: userId,
    tenant_id: tenantBId,
    role: 'manager',
    is_primary: true,
  });

  await admin.from('staff').insert({
    id: userId,
    name: 'E2E Tenant B Manager',
    email: managerEmail,
    phone: '',
    role: 'manager',
    avatar: '',
    commission_rate: 0,
    status: 'active',
    tenant_id: tenantBId,
  });

  await admin.from('tenant_settings').insert({
    tenant_id: tenantBId,
    chair_count: 1,
  });

  const { data: clientB } = await admin
    .from('clients')
    .insert({
      tenant_id: tenantBId,
      name: 'Carlos Tenant B',
      phone: '11999990003',
      email: 'carlos-tenantb@e2e.com',
      status: 'active',
    })
    .select('id')
    .single();

  if (!clientB) {
    throw new Error('Failed to create Tenant B client');
  }

  const { data: planB } = await admin
    .from('customer_plans')
    .insert({
      tenant_id: tenantBId,
      name: 'Plano Teste Tenant B',
      monthly_price: 149.90,
      service_credits: 3,
      active: true,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (!planB) {
    throw new Error('Failed to create Tenant B plan');
  }

  const subId = crypto.randomUUID();
  await admin.from('customer_subscriptions').insert({
    id: subId,
    tenant_id: tenantBId,
    client_id: clientB.id,
    plan_id: planB.id,
    status: 'active',
    started_at: now,
    cycle_start: now,
    cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    created_at: now,
    updated_at: now,
  });

  const pendingB = crypto.randomUUID();
  const overdueB = crypto.randomUUID();
  const paidB = crypto.randomUUID();

  await admin.from('customer_subscription_receivables').insert([
    {
      id: pendingB,
      tenant_id: tenantBId,
      subscription_id: subId,
      customer_id: clientB.id,
      plan_id: planB.id,
      amount: 149.90,
      status: 'pending',
      billing_cycle_start: now,
      billing_cycle_end: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    },
    {
      id: overdueB,
      tenant_id: tenantBId,
      subscription_id: subId,
      customer_id: clientB.id,
      plan_id: planB.id,
      amount: 149.90,
      status: 'overdue',
      billing_cycle_start: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      billing_cycle_end: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: now,
      updated_at: now,
    },
    {
      id: paidB,
      tenant_id: tenantBId,
      subscription_id: subId,
      customer_id: clientB.id,
      plan_id: planB.id,
      amount: 149.90,
      status: 'paid',
      billing_cycle_start: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
      billing_cycle_end: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      due_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      paid_at: new Date(Date.now() - 33 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: now,
      updated_at: now,
    },
  ]);

  return {
    subscriptionId: subId,
    receivableIds: { pending: pendingB, overdue: overdueB, paid: paidB },
    clientId: clientB.id,
    managerId: userId,
    tenantId: tenantBId,
  };
}

export { seedChefClubData };
