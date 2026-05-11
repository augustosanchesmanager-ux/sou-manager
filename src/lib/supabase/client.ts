import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type AppSlug,
  DEFAULT_APP_SLUG,
  type SupabaseSchemaName,
  getSchemaForTable,
  resolveSchemaForApp,
  SHARED_SCHEMA,
} from './schemas';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);
const LOCAL_DEMO_STORAGE_KEY = 'soumanager.local.demo.session';
const LOCAL_DEMO_DB_STORAGE_KEY = 'soumanager.local.demo.db';
const LOCAL_DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';
const LOCAL_DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000101';
const LOCAL_DEMO_EMAIL = 'teste@soumanager.local';
const LOCAL_DEMO_PASSWORD = '12345678';

type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'INITIAL_SESSION';
type AuthChangeCallback = (event: AuthChangeEvent, session: any) => void;

const isLocalBrowserHost = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const hostname = window.location.hostname;
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
};

const isLocalDemoEnabled = (): boolean => !hasSupabaseEnv && isLocalBrowserHost();

const getDemoTenantRecord = () => ({
  id: LOCAL_DEMO_TENANT_ID,
  name: 'Sou Manager Demo',
  slug: 'sou-manager-demo',
  app_slug: DEFAULT_APP_SLUG,
  active: true,
  created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
});

const getDemoUser = () => ({
  id: LOCAL_DEMO_USER_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: LOCAL_DEMO_EMAIL,
  email_confirmed_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  phone: '',
  confirmed_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  last_sign_in_at: new Date().toISOString(),
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    first_name: 'Teste',
    last_name: 'Local',
    full_name: 'Teste Local',
    role: 'manager',
    shop_name: 'Sou Manager Demo',
    tenant_id: LOCAL_DEMO_TENANT_ID,
  },
  identities: [],
  created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
  updated_at: new Date().toISOString(),
  is_anonymous: false,
});

const buildDemoSession = () => ({
  access_token: 'local-demo-access-token',
  refresh_token: 'local-demo-refresh-token',
  expires_in: 60 * 60 * 24,
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  token_type: 'bearer',
  user: getDemoUser(),
});

const readDemoSession = () => {
  if (!isLocalDemoEnabled() || typeof window === 'undefined') {
    return null;
  }

  return window.localStorage.getItem(LOCAL_DEMO_STORAGE_KEY) === '1' ? buildDemoSession() : null;
};

const writeDemoSession = (enabled: boolean) => {
  if (!isLocalDemoEnabled() || typeof window === 'undefined') {
    return;
  }

  if (enabled) {
    window.localStorage.setItem(LOCAL_DEMO_STORAGE_KEY, '1');
  } else {
    window.localStorage.removeItem(LOCAL_DEMO_STORAGE_KEY);
  }
};

const authSubscribers = new Map<string, AuthChangeCallback>();

const notifyAuthSubscribers = (event: AuthChangeEvent, session: any) => {
  authSubscribers.forEach((callback) => {
    callback(event, session);
  });
};

interface LocalDemoClientRecord {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
}

interface LocalDemoPlanRecord {
  id: string;
  tenant_id: string;
  name: string;
  monthly_price: number;
  service_credits: number;
  service_credit_map?: Array<{
    service_id: string;
    service_name: string;
    credits: number;
  }>;
  description: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface LocalDemoSubscriptionRecord {
  id: string;
  tenant_id: string;
  client_id: string;
  plan_id: string;
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  started_at: string;
  cycle_start: string;
  cycle_end: string;
  next_billing_date: string;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalDemoCreditRecord {
  id: string;
  tenant_id: string;
  subscription_id: string;
  client_id: string;
  available_credits: number;
  used_credits: number;
  service_balance_map?: Array<{
    service_id: string;
    service_name: string;
    available: number;
    used: number;
  }>;
  period_start: string;
  period_end: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalDemoReceivableRecord {
  id: string;
  tenant_id: string;
  customer_id: string;
  subscription_id: string;
  plan_id: string;
  billing_cycle_start: string;
  billing_cycle_end: string;
  due_date: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  payment_method: string | null;
  paid_at: string | null;
  paid_by: string | null;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LocalDemoDatabase {
  clients: LocalDemoClientRecord[];
  suppliers: Array<{
    id: string;
    tenant_id: string;
    name: string;
    email: string;
    phone: string;
    category: string;
    document?: string;
    address?: string;
  }>;
  staff: Array<{
    id: string;
    tenant_id: string;
    name: string;
    role: string;
    status: string;
    avatar?: string;
    commission_rate?: number | null;
  }>;
  services: Array<{
    id: string;
    tenant_id: string;
    name: string;
    category: string;
    duration: number;
    price: number;
    active: boolean;
  }>;
  appointments: Array<{
    id: string;
    tenant_id: string;
    client_id: string | null;
    service_id: string | null;
    staff_id: string | null;
    client_name: string;
    client_phone?: string;
    service_name: string;
    staff_name: string;
    start_time: string;
    duration: number;
    price?: number;
    notes?: string;
    hidden_from_schedule?: boolean;
    is_overbooked?: boolean;
    status: string;
    idempotency_key?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  products: Array<{
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    cost_price: number;
    sale_price: number;
    stock_quantity: number;
    minimum_stock: number;
    auto_generate_purchase_order: boolean;
    active: boolean;
  }>;
  promotions: Array<{
    id: string;
    tenant_id: string;
    title: string;
    end_date: string;
    active: boolean;
  }>;
  transactions: Array<{
    id: string;
    tenant_id: string;
    user_id?: string;
    type: string;
    amount: number;
    date: string;
    description?: string;
    category?: string;
    status?: string;
    payment_method?: string;
    due_day?: number;
    notes?: string;
  }>;
  comandas: Array<{
    id: string;
    tenant_id: string;
    appointment_id: string | null;
    client_id: string | null;
    staff_id: string | null;
    status: string;
    total: number;
    idempotency_key?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  comanda_items: Array<{
    id: string;
    tenant_id: string;
    comanda_id: string;
    staff_id?: string | null;
    service_id?: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    created_at: string;
    updated_at: string;
'comandas.status'?: string;
    'comandas.created_at'?: string;
  }>;
  service_execution_participants: Array<{
    id: string;
    comanda_item_id: string;
    professional_id: string;
    role: 'primary' | 'assistant' | 'co_executor';
    payout_type: 'percentage' | 'fixed';
    payout_value: number;
    affects_revenue: boolean;
    affects_commission: boolean;
    tenant_id: string;
    created_at: string;
  }>;
  customer_plans: LocalDemoPlanRecord[];
  customer_subscriptions: LocalDemoSubscriptionRecord[];
  customer_credits: LocalDemoCreditRecord[];
  customer_subscription_receivables: LocalDemoReceivableRecord[];
  notifications: Array<{
    id: string;
    tenant_id: string;
    user_id: string | null;
    type: string;
    title: string;
    message: string;
    entity_type: string | null;
    entity_id: string | null;
    severity: 'info' | 'warning' | 'critical';
    status: 'unread' | 'read' | 'archived';
    read_at: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
  }>;
  notification_preferences: Array<{
    id: string;
    tenant_id: string;
    user_id: string;
    type: string;
    enabled: boolean;
    created_at: string;
    updated_at: string;
  }>;
}

const createDemoId = (prefix: string) =>
  `${prefix}-${Math.random().toString(16).slice(2, 10)}-${Date.now().toString(16)}`;

const createSeedDemoDatabase = (): LocalDemoDatabase => {
  const now = new Date('2026-04-18T10:00:00-03:00').toISOString();
  return {
    clients: [
      {
        id: 'demo-client-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Carlos Demo',
        phone: '(11) 99999-0001',
      },
      {
        id: 'demo-client-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Fernanda Demo',
        phone: '(11) 99999-0002',
      },
    ],
    suppliers: [
      {
        id: 'demo-supplier-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Distribuidora Alpha',
        email: 'contato@alpha-demo.local',
        phone: '(11) 4002-1000',
        category: 'Produtos',
        document: '12.345.678/0001-99',
        address: 'Rua das Navalhas, 120 - São Paulo/SP',
      },
      {
        id: 'demo-supplier-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Equipamentos Prime',
        email: 'vendas@prime-demo.local',
        phone: '(11) 4002-2000',
        category: 'Equipamentos',
        document: '98.765.432/0001-11',
        address: 'Av. dos Barbeiros, 55 - São Paulo/SP',
      },
    ],
    staff: [
      {
        id: 'demo-staff-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Marcos Demo',
        role: 'Barber',
        status: 'active',
        commission_rate: 40,
      },
      {
        id: 'demo-staff-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Julia Demo',
        role: 'Manager',
        status: 'active',
        commission_rate: 15,
      },
    ],
    services: [
      {
        id: 'demo-service-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Corte Tradicional',
        category: 'Cabelo',
        duration: 30,
        price: 45,
        active: true,
      },
      {
        id: 'demo-service-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Barba Premium',
        category: 'Barba',
        duration: 30,
        price: 35,
        active: true,
      },
    ],
    appointments: [
      {
        id: 'demo-appointment-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        client_id: 'demo-client-2',
        service_id: 'demo-service-1',
        staff_id: 'demo-staff-1',
        client_name: 'Fernanda Demo',
        client_phone: '(11) 99999-0002',
        service_name: 'Corte Tradicional',
        staff_name: 'Marcos Demo',
        start_time: new Date('2026-04-18T15:00:00-03:00').toISOString(),
        duration: 0.5,
        status: 'confirmed',
        hidden_from_schedule: false,
        is_overbooked: false,
        created_at: now,
        updated_at: now,
      },
    ],
    products: [
      {
        id: 'demo-product-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Pomada Modeladora',
        description: 'Fixação média para acabamento e finalização.',
        cost_price: 18,
        sale_price: 35,
        stock_quantity: 3,
        minimum_stock: 5,
        auto_generate_purchase_order: true,
        active: true,
      },
    ],
    promotions: [
      {
        id: 'demo-promo-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        title: 'Combo Corte + Barba',
        end_date: '2026-04-30',
        active: true,
      },
    ],
    transactions: [
      {
        id: 'demo-transaction-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        type: 'income',
        amount: 120,
        date: '2026-04-08T12:00:00-03:00',
        description: 'Venda de balcão',
        category: 'Receita',
        status: 'paid',
        payment_method: 'Dinheiro',
      },
      {
        id: 'demo-transaction-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        type: 'income',
        amount: 180,
        date: '2026-04-15T12:00:00-03:00',
        description: 'Atendimento premium',
        category: 'Receita',
        status: 'paid',
        payment_method: 'Dinheiro',
      },
      {
        id: 'demo-transaction-3',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        type: 'expense',
        amount: 85,
        date: '2026-04-10T09:00:00-03:00',
        description: 'Compra de toalhas',
        category: 'Infraestrutura',
        status: 'paid',
        payment_method: 'Cartão',
      },
      {
        id: 'demo-transaction-4',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        type: 'expense',
        amount: 120,
        date: '2026-04-16T10:30:00-03:00',
        description: 'Reposição de pomadas',
        category: 'Estoque',
        status: 'pending',
        payment_method: 'PIX',
      },
    ],
    comandas: [
      {
        id: 'demo-comanda-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        appointment_id: null,
        client_id: 'demo-client-2',
        staff_id: 'demo-staff-1',
        status: 'open',
        total: 45,
        created_at: '2026-04-17T14:00:00-03:00',
        updated_at: now,
      },
      {
        id: 'demo-comanda-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        appointment_id: 'demo-appointment-1',
        client_id: 'demo-client-2',
        staff_id: 'demo-staff-1',
        status: 'paid',
        total: 80,
        created_at: '2026-04-15T15:00:00-03:00',
        updated_at: now,
      },
    ],
    comanda_items: [
      {
        id: 'demo-comanda-item-1',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        comanda_id: 'demo-comanda-1',
        staff_id: 'demo-staff-1',
        service_id: 'demo-service-1',
        product_name: 'Corte Tradicional',
        quantity: 1,
        unit_price: 45,
        created_at: now,
        updated_at: now,
        'comandas.status': 'open',
        'comandas.created_at': '2026-04-17T14:00:00-03:00',
      },
      {
        id: 'demo-comanda-item-2',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        comanda_id: 'demo-comanda-2',
        staff_id: 'demo-staff-1',
        service_id: 'demo-service-1',
        product_name: 'Corte Tradicional',
        quantity: 1,
        unit_price: 45,
        created_at: '2026-04-15T15:00:00-03:00',
        updated_at: now,
        'comandas.status': 'paid',
        'comandas.created_at': '2026-04-15T15:00:00-03:00',
      },
      {
        id: 'demo-comanda-item-3',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        comanda_id: 'demo-comanda-2',
        staff_id: 'demo-staff-1',
        service_id: 'demo-service-2',
        product_name: 'Barba Premium',
        quantity: 1,
        unit_price: 35,
        created_at: '2026-04-15T15:00:00-03:00',
        updated_at: now,
'comandas.status': 'paid',
        'comandas.created_at': '2026-04-15T15:00:00-03:00',
      },
    ],
    service_execution_participants: [
      {
        id: 'demo-sep-1',
        comanda_item_id: 'demo-comanda-item-1',
        professional_id: 'demo-staff-1',
        role: 'primary',
        payout_type: 'percentage',
        payout_value: 40,
        affects_revenue: true,
        affects_commission: true,
        tenant_id: LOCAL_DEMO_TENANT_ID,
        created_at: now,
      },
      {
        id: 'demo-sep-2',
        comanda_item_id: 'demo-comanda-item-2',
        professional_id: 'demo-staff-1',
        role: 'primary',
        payout_type: 'percentage',
        payout_value: 40,
        affects_revenue: true,
        affects_commission: true,
        tenant_id: LOCAL_DEMO_TENANT_ID,
        created_at: '2026-04-15T15:00:00-03:00',
      },
      {
        id: 'demo-sep-3',
        comanda_item_id: 'demo-comanda-item-3',
        professional_id: 'demo-staff-1',
        role: 'primary',
        payout_type: 'percentage',
        payout_value: 40,
        affects_revenue: true,
        affects_commission: true,
        tenant_id: LOCAL_DEMO_TENANT_ID,
        created_at: '2026-04-15T15:00:00-03:00',
      },
    ],
    customer_plans: [
      {
        id: 'demo-plan-gold',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Gold',
        monthly_price: 99.9,
        service_credits: 2,
        service_credit_map: [
          {
            service_id: 'demo-service-1',
            service_name: 'Corte Tradicional',
            credits: 2,
          },
        ],
        description: 'Plano mensal com 2 creditos.',
        active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'demo-plan-black',
        tenant_id: LOCAL_DEMO_TENANT_ID,
        name: 'Black',
        monthly_price: 149.9,
        service_credits: 4,
        service_credit_map: [
          {
            service_id: 'demo-service-1',
            service_name: 'Corte Tradicional',
            credits: 2,
          },
          {
            service_id: 'demo-service-2',
            service_name: 'Barba Premium',
            credits: 2,
          },
        ],
        description: 'Plano premium com 4 creditos.',
        active: true,
        created_at: now,
        updated_at: now,
      },
    ],
    customer_subscriptions: [],
    customer_credits: [],
    customer_subscription_receivables: [],
    notifications: [],
    notification_preferences: [],
  };
};

const mergeSeedRows = <T extends { id: string }>(current: T[], seed: T[]): T[] => {
  const merged = [...current];
  seed.forEach((seedRow) => {
    if (!merged.some((row) => row.id === seedRow.id)) {
      merged.push(seedRow);
    }
  });
  return merged;
};

const readDemoDatabase = (): LocalDemoDatabase => {
  if (typeof window === 'undefined') {
    return createSeedDemoDatabase();
  }

  const raw = window.localStorage.getItem(LOCAL_DEMO_DB_STORAGE_KEY);
  if (!raw) {
    const seed = createSeedDemoDatabase();
    window.localStorage.setItem(LOCAL_DEMO_DB_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LocalDemoDatabase>;
    const seed = createSeedDemoDatabase();
    const normalizedServices = Array.isArray(parsed.services)
      ? parsed.services.map((service) => ({
          ...service,
          category:
            typeof service?.category === 'string' && service.category.trim()
              ? service.category
              : typeof service?.name === 'string' && service.name.toLowerCase().includes('barba')
                ? 'Barba'
                : 'Cabelo',
        }))
      : [];
    const normalizedProducts = Array.isArray(parsed.products)
      ? parsed.products.map((product) => ({
          ...product,
          description: typeof product?.description === 'string' ? product.description : '',
          cost_price: Number(product?.cost_price ?? 0),
          sale_price: Number(product?.sale_price ?? 0),
          stock_quantity: Number(product?.stock_quantity ?? (product as { stock?: number }).stock ?? 0),
          minimum_stock: Number(product?.minimum_stock ?? (product as { min_stock?: number }).min_stock ?? 0),
          auto_generate_purchase_order: Boolean(product?.auto_generate_purchase_order),
          active: typeof product?.active === 'boolean' ? product.active : true,
        }))
      : [];
    const normalizedStaff = Array.isArray(parsed.staff)
      ? parsed.staff.map((member) => ({
          ...member,
          commission_rate: member?.commission_rate ?? null,
        }))
      : [];

    return {
      clients: Array.isArray(parsed.clients) ? parsed.clients : [],
      suppliers: mergeSeedRows(Array.isArray(parsed.suppliers) ? parsed.suppliers : [], seed.suppliers),
      staff: mergeSeedRows(normalizedStaff, seed.staff),
      services: mergeSeedRows(normalizedServices, seed.services),
      appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
      products: normalizedProducts,
      promotions: Array.isArray(parsed.promotions) ? parsed.promotions : [],
      transactions: mergeSeedRows(
        Array.isArray(parsed.transactions)
          ? parsed.transactions.map((transaction) => ({
            ...transaction,
            description: typeof transaction?.description === 'string' ? transaction.description : '',
            category: typeof transaction?.category === 'string' ? transaction.category : '',
            status: typeof transaction?.status === 'string' ? transaction.status : 'paid',
            payment_method: typeof transaction?.payment_method === 'string' ? transaction.payment_method : 'Dinheiro',
          }))
          : [],
        seed.transactions,
      ),
comandas: mergeSeedRows(Array.isArray(parsed.comandas) ? parsed.comandas : [], seed.comandas),
      comanda_items: mergeSeedRows(
        Array.isArray(parsed.comanda_items)
          ? parsed.comanda_items.map((item) => ({
              ...item,
              staff_id: item?.staff_id ?? null,
            }))
          : [],
        seed.comanda_items,
      ),
      service_execution_participants: mergeSeedRows(
        Array.isArray(parsed.service_execution_participants) ? parsed.service_execution_participants : [],
        seed.service_execution_participants,
      ),
      customer_plans: Array.isArray(parsed.customer_plans) ? parsed.customer_plans : [],
      customer_subscriptions: Array.isArray(parsed.customer_subscriptions) ? parsed.customer_subscriptions : [],
      customer_credits: Array.isArray(parsed.customer_credits) ? parsed.customer_credits : [],
      customer_subscription_receivables: Array.isArray(parsed.customer_subscription_receivables)
        ? parsed.customer_subscription_receivables
        : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      notification_preferences: Array.isArray(parsed.notification_preferences) ? parsed.notification_preferences : [],
    };
  } catch {
    const seed = createSeedDemoDatabase();
    window.localStorage.setItem(LOCAL_DEMO_DB_STORAGE_KEY, JSON.stringify(seed));
    return seed;
  }
};

const writeDemoDatabase = (db: LocalDemoDatabase) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCAL_DEMO_DB_STORAGE_KEY, JSON.stringify(db));
};

const cloneRows = <T,>(rows: T[]): T[] => rows.map((row) => ({ ...row }));

const createLocalDemoQueryBuilder = (table: string) => {
  const filters: Array<(row: Record<string, any>) => boolean> = [];
  let orderConfig: { field: string; ascending: boolean } | null = null;
  let selectedColumns: string | undefined;
  let selectOptions: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean } | undefined;
  let limitCount: number | null = null;
  let mutationRows: Record<string, any>[] | null = null;

  const getRowsForTable = (db: LocalDemoDatabase) => {
    const demoTenant = getDemoTenantRecord();

    switch (table) {
      case 'profiles':
        return [{
          id: LOCAL_DEMO_USER_ID,
          tenant_id: LOCAL_DEMO_TENANT_ID,
          role: 'manager',
          status: 'active',
          full_name: 'Teste Local',
          created_at: new Date('2026-04-02T10:00:00-03:00').toISOString(),
          updated_at: new Date().toISOString(),
        }];
      case 'staff':
        return cloneRows(db.staff);
      case 'services':
        return cloneRows(db.services);
      case 'appointments':
        return cloneRows(db.appointments);
      case 'products':
        return cloneRows(db.products);
      case 'promotions':
        return cloneRows(db.promotions);
      case 'transactions':
        return cloneRows(db.transactions);
      case 'comandas':
        return cloneRows(db.comandas);
case 'comanda_items':
        return cloneRows(db.comanda_items);
      case 'service_execution_participants':
        return cloneRows(db.service_execution_participants);
      case 'user_tenants':
        return [{
          user_id: LOCAL_DEMO_USER_ID,
          tenant_id: LOCAL_DEMO_TENANT_ID,
          role: 'manager',
          is_primary: true,
        }];
      case 'tenants':
        return [demoTenant];
      case 'clients':
        return cloneRows(db.clients);
      case 'suppliers':
        return cloneRows(db.suppliers);
      case 'customer_plans':
        return cloneRows(db.customer_plans);
      case 'customer_subscriptions':
        return cloneRows(db.customer_subscriptions);
      case 'customer_credits':
        return cloneRows(db.customer_credits);
      case 'customer_subscription_receivables':
        return cloneRows(db.customer_subscription_receivables);
      case 'notifications':
        return cloneRows(db.notifications);
      case 'notification_preferences':
        return cloneRows(db.notification_preferences);
      case 'usage_logs':
      case 'alerts':
      case 'notification_channels':
        return [];
      default:
        return [];
    }
  };

  const applySelectedShape = (rows: Record<string, any>[]) => {
    const db = readDemoDatabase();

    if (table === 'customer_subscriptions' && selectedColumns?.includes('client:clients')) {
      return rows.map((row) => {
        const client = db.clients.find((item) => item.id === row.client_id) ?? null;
        const plan = db.customer_plans.find((item) => item.id === row.plan_id) ?? null;
        const credits = db.customer_credits.find((item) => item.subscription_id === row.id);

        return {
          id: row.id,
          status: row.status,
          cycle_end: row.cycle_end,
          next_billing_date: row.next_billing_date,
          client: client ? { name: client.name, phone: client.phone } : null,
          plan: plan ? { name: plan.name, service_credits: plan.service_credits } : null,
          credits: credits ? [{ available_credits: credits.available_credits }] : [],
        };
      });
    }

    if (table === 'customer_subscriptions' && selectedColumns?.includes('plan:customer_plans(name)')) {
      return rows.map((row) => {
        const plan = db.customer_plans.find((item) => item.id === row.plan_id) ?? null;
        const credits = db.customer_credits.find((item) => item.subscription_id === row.id);

        return {
          status: row.status,
          plan: plan ? { name: plan.name } : null,
          credits: credits ? [{ available_credits: credits.available_credits }] : [],
        };
      });
    }

    if (table === 'customer_subscriptions' && selectedColumns === 'client_id, plan:customer_plans(name)') {
      return rows.map((row) => {
        const plan = db.customer_plans.find((item) => item.id === row.plan_id) ?? null;
        return {
          client_id: row.client_id,
          plan: plan ? { name: plan.name } : null,
        };
      });
    }

    if (selectedColumns === 'id') {
      return rows.map((row) => ({ id: row.id }));
    }

    return rows;
  };

  const resolveRows = () => {
    const baseRows = mutationRows ? cloneRows(mutationRows) : getRowsForTable(readDemoDatabase());
    let rows = baseRows.filter((row) => filters.every((predicate) => predicate(row)));

    if (orderConfig) {
      const { field, ascending } = orderConfig;
      rows = [...rows].sort((first, second) => {
        const firstValue = first[field];
        const secondValue = second[field];
        if (firstValue === secondValue) return 0;
        if (firstValue == null) return ascending ? -1 : 1;
        if (secondValue == null) return ascending ? 1 : -1;
        if (typeof firstValue === 'number' && typeof secondValue === 'number') {
          return ascending ? firstValue - secondValue : secondValue - firstValue;
        }
        const comparison = String(firstValue).localeCompare(String(secondValue));
        return ascending ? comparison : -comparison;
      });
    }

    if (typeof limitCount === 'number') {
      rows = rows.slice(0, limitCount);
    }

    return applySelectedShape(rows);
  };

  const resolveResult = () => {
    const rows = resolveRows();
    const count = selectOptions?.count ? rows.length : null;
    return Promise.resolve({
      data: selectOptions?.head ? null : rows,
      error: null,
      count,
    });
  };

  const builder = {
    select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }) {
      selectedColumns = columns;
      selectOptions = options;
      return builder;
    },
    eq(field: string, value: unknown) {
      filters.push((row) => row[field] === value);
      return builder;
    },
    neq(field: string, value: unknown) {
      filters.push((row) => row[field] !== value);
      return builder;
    },
    not(field: string, operator: string, value: unknown) {
      filters.push((row) => {
        if (operator === 'is' && value === null) {
          return row[field] !== null && row[field] !== undefined;
        }

        if (operator === 'eq') {
          return row[field] !== value;
        }

        if (operator === 'in' && Array.isArray(value)) {
          return !value.includes(row[field]);
        }

        return true;
      });
      return builder;
    },
    gte(field: string, value: unknown) {
      filters.push((row) => row[field] >= value);
      return builder;
    },
    lte(field: string, value: unknown) {
      filters.push((row) => row[field] <= value);
      return builder;
    },
    lt(field: string, value: unknown) {
      filters.push((row) => row[field] < value);
      return builder;
    },
    in(field: string, values: unknown[]) {
      filters.push((row) => values.includes(row[field]));
      return builder;
    },
    or(expression: string) {
      const conditions = expression.split(',');
      const orFilters: Array<(row: Record<string, any>) => boolean> = [];

      for (const cond of conditions) {
        const trimmed = cond.trim();
        const dotIndex = trimmed.indexOf('.');

        if (dotIndex === -1) continue;

        const field = trimmed.slice(0, dotIndex);
        const rest = trimmed.slice(dotIndex + 1);
        const opDotIndex = rest.indexOf('.');

        if (opDotIndex === -1) continue;

        const op = rest.slice(0, opDotIndex);
        const rawValue = rest.slice(opDotIndex + 1);

        let value: unknown;
        if (rawValue === 'null') {
          value = null;
        } else if (rawValue === 'true') {
          value = true;
        } else if (rawValue === 'false') {
          value = false;
        } else if (!isNaN(Number(rawValue))) {
          value = Number(rawValue);
        } else {
          value = rawValue;
        }

        switch (op) {
          case 'eq':
            orFilters.push((row) => row[field] === value);
            break;
          case 'neq':
            orFilters.push((row) => row[field] !== value);
            break;
          case 'gt':
            orFilters.push((row) => row[field] > value);
            break;
          case 'gte':
            orFilters.push((row) => row[field] >= value);
            break;
          case 'lt':
            orFilters.push((row) => row[field] < value);
            break;
          case 'lte':
            orFilters.push((row) => row[field] <= value);
            break;
          case 'is':
            if (value === null) {
              orFilters.push((row) => row[field] === null || row[field] === undefined);
            }
            break;
        }
      }

      if (orFilters.length > 0) {
        filters.push((row) => orFilters.some((f) => f(row)));
      }

      return builder;
    },
    order(field: string, options?: { ascending?: boolean }) {
      orderConfig = { field, ascending: options?.ascending !== false };
      return builder;
    },
    limit(count: number) {
      limitCount = count;
      return builder;
    },
    insert(payload: Record<string, any> | Record<string, any>[]) {
      const db = readDemoDatabase();
      const rows = Array.isArray(payload) ? payload : [payload];
      const now = new Date().toISOString();

      const nextRows = rows.map((row) => ({
        ...row,
        id: row.id || createDemoId(table),
        created_at: row.created_at || now,
        updated_at: now,
      }));

      if (table === 'customer_subscriptions') {
        db.customer_subscriptions.push(...(nextRows as LocalDemoSubscriptionRecord[]));
      } else if (table === 'customer_credits') {
        db.customer_credits.push(...(nextRows as LocalDemoCreditRecord[]));
      } else if (table === 'customer_subscription_receivables') {
        db.customer_subscription_receivables.push(...(nextRows as LocalDemoReceivableRecord[]));
      } else if (table === 'customer_plans') {
        db.customer_plans.push(...(nextRows as LocalDemoPlanRecord[]));
      } else if (table === 'appointments') {
        db.appointments.push(...nextRows as typeof db.appointments);
      } else if (table === 'comandas') {
        db.comandas.push(...nextRows as typeof db.comandas);
} else if (table === 'comanda_items') {
        db.comanda_items.push(...nextRows as typeof db.comanda_items);
      } else if (table === 'service_execution_participants') {
        db.service_execution_participants.push(...nextRows as typeof db.service_execution_participants);
      } else if (table === 'clients') {
        db.clients.push(...(nextRows as LocalDemoClientRecord[]));
      } else if (table === 'suppliers') {
        db.suppliers.push(...(nextRows as typeof db.suppliers));
      } else if (table === 'notifications') {
        db.notifications.push(...(nextRows as typeof db.notifications));
      } else if (table === 'notification_preferences') {
        db.notification_preferences.push(...(nextRows as typeof db.notification_preferences));
      } else if (table === 'transactions') {
        db.transactions.push(...(nextRows as typeof db.transactions));
      }

      writeDemoDatabase(db);
      mutationRows = nextRows;
      return builder;
    },
    update(payload: Record<string, any>) {
      const db = readDemoDatabase();
      const now = new Date().toISOString();
      const rows = getRowsForTable(db);
      const matchingRows = rows.filter((row) => filters.every((predicate) => predicate(row)));
      const updatedRows = matchingRows.map((row) => ({ ...row, ...payload, updated_at: now }));

      const replaceRows = <T extends { id: string }>(source: T[]) =>
        source.map((row) => {
          const next = updatedRows.find((updated) => (updated as { id: string }).id === row.id);
          return next ? ({ ...row, ...next } as T) : row;
        });

      if (table === 'customer_subscriptions') {
        db.customer_subscriptions = replaceRows(db.customer_subscriptions);
      } else if (table === 'customer_credits') {
        db.customer_credits = replaceRows(db.customer_credits);
      } else if (table === 'customer_subscription_receivables') {
        db.customer_subscription_receivables = replaceRows(db.customer_subscription_receivables);
      } else if (table === 'customer_plans') {
        db.customer_plans = replaceRows(db.customer_plans);
      } else if (table === 'appointments') {
        db.appointments = replaceRows(db.appointments);
      } else if (table === 'comandas') {
        db.comandas = replaceRows(db.comandas);
} else if (table === 'comanda_items') {
        db.comanda_items = replaceRows(db.comanda_items);
      } else if (table === 'service_execution_participants') {
        db.service_execution_participants = replaceRows(db.service_execution_participants);
      } else if (table === 'clients') {
        db.clients = replaceRows(db.clients);
      } else if (table === 'suppliers') {
        db.suppliers = replaceRows(db.suppliers);
      } else if (table === 'notifications') {
        db.notifications = replaceRows(db.notifications);
      } else if (table === 'notification_preferences') {
        db.notification_preferences = replaceRows(db.notification_preferences);
      } else if (table === 'transactions') {
        db.transactions = replaceRows(db.transactions);
      }

      writeDemoDatabase(db);
      mutationRows = updatedRows;
      return builder;
    },
    upsert(payload: Record<string, any> | Record<string, any>[], options?: { onConflict?: string }) {
      const db = readDemoDatabase();
      const rows = Array.isArray(payload) ? payload : [payload];
      const onConflict = options?.onConflict || 'id';
      const now = new Date().toISOString();

      const targetRows = table === 'customer_credits'
        ? db.customer_credits
        : table === 'customer_subscriptions'
          ? db.customer_subscriptions
          : table === 'customer_subscription_receivables'
            ? db.customer_subscription_receivables
            : table === 'customer_plans'
              ? db.customer_plans
              : table === 'appointments'
              ? db.appointments
              : table === 'comandas'
                ? db.comandas
                : table === 'comanda_items'
                  ? db.comanda_items
                  : table === 'suppliers'
                    ? db.suppliers
                    : table === 'notifications'
                      ? db.notifications
                      : table === 'notification_preferences'
                        ? db.notification_preferences
                        : table === 'transactions'
                          ? db.transactions
                        : db.clients;

      const upsertedRows = rows.map((row) => {
        const existingIndex = targetRows.findIndex((item: any) => item[onConflict] === row[onConflict]);
        if (existingIndex >= 0) {
          const updatedRow = { ...targetRows[existingIndex], ...row, updated_at: now };
          targetRows[existingIndex] = updatedRow as never;
          return updatedRow;
        }

        const insertedRow = {
          ...row,
          id: row.id || createDemoId(table),
          created_at: row.created_at || now,
          updated_at: now,
        };
        targetRows.push(insertedRow as never);
        return insertedRow;
      });

      writeDemoDatabase(db);
      mutationRows = upsertedRows;
      return Promise.resolve({ data: upsertedRows, error: null });
    },
    delete() {
      const db = readDemoDatabase();
      const rows = getRowsForTable(db);
      const remainingRows = rows.filter((row) => !filters.every((predicate) => predicate(row)));

      if (table === 'customer_subscriptions') {
        db.customer_subscriptions = remainingRows as LocalDemoSubscriptionRecord[];
      } else if (table === 'customer_credits') {
        db.customer_credits = remainingRows as LocalDemoCreditRecord[];
      } else if (table === 'customer_subscription_receivables') {
        db.customer_subscription_receivables = remainingRows as LocalDemoReceivableRecord[];
      } else if (table === 'customer_plans') {
        db.customer_plans = remainingRows as LocalDemoPlanRecord[];
      } else if (table === 'appointments') {
        db.appointments = remainingRows as typeof db.appointments;
      } else if (table === 'comandas') {
        db.comandas = remainingRows as typeof db.comandas;
} else if (table === 'comanda_items') {
        db.comanda_items = remainingRows as typeof db.comanda_items;
      } else if (table === 'service_execution_participants') {
        db.service_execution_participants = remainingRows as typeof db.service_execution_participants;
      } else if (table === 'clients') {
        db.clients = remainingRows as LocalDemoClientRecord[];
      } else if (table === 'suppliers') {
        db.suppliers = remainingRows as typeof db.suppliers;
      } else if (table === 'notifications') {
        db.notifications = remainingRows as typeof db.notifications;
      } else if (table === 'notification_preferences') {
        db.notification_preferences = remainingRows as typeof db.notification_preferences;
      } else if (table === 'transactions') {
        db.transactions = remainingRows as typeof db.transactions;
      }

      writeDemoDatabase(db);
      mutationRows = [];
      return builder;
    },
    maybeSingle() {
      const rows = resolveRows();
      return Promise.resolve({ data: rows[0] ?? null, error: null, count: rows.length });
    },
    single() {
      const rows = resolveRows();
      return Promise.resolve({ data: rows[0] ?? null, error: null, count: rows.length });
    },
    then(
      onFulfilled: (value: { data: unknown[] | null; error: null; count: number | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return resolveResult().then(onFulfilled, onRejected);
    },
  };

  return builder;
};

const createLocalDemoClient = (): SupabaseClient => {
  const createRpcResult = (data: unknown, error: Error | null) => ({
    data,
    error,
    single: async () => ({ data, error }),
    maybeSingle: async () => ({ data, error }),
    then: (
      onFulfilled: (value: { data: unknown; error: Error | null }) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve({ data, error }).then(onFulfilled, onRejected),
  });

  const auth = {
    getSession: async () => ({ data: { session: readDemoSession() }, error: null }),
    onAuthStateChange: (callback: AuthChangeCallback) => {
      const id = `${Date.now()}-${Math.random()}`;
      authSubscribers.set(id, callback);
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              authSubscribers.delete(id);
            },
          },
        },
      };
    },
    signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
      const normalizedEmail = email.trim().toLowerCase();
      if (!isLocalDemoEnabled()) {
        return {
          data: { user: null, session: null },
          error: new Error('Supabase nao configurado neste ambiente.'),
        };
      }

      if (normalizedEmail !== LOCAL_DEMO_EMAIL || password !== LOCAL_DEMO_PASSWORD) {
        return {
          data: { user: null, session: null },
          error: new Error('Invalid login credentials'),
        };
      }

      writeDemoSession(true);
      const session = buildDemoSession();
      notifyAuthSubscribers('SIGNED_IN', session);
      return { data: { user: session.user, session }, error: null };
    },
    signOut: async () => {
      writeDemoSession(false);
      notifyAuthSubscribers('SIGNED_OUT', null);
      return { error: null };
    },
    signUp: async () => ({
      data: { user: null, session: null },
      error: new Error('Cadastro remoto indisponivel no modo local. Use o acesso de teste.'),
    }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
    updateUser: async () => ({ data: { user: getDemoUser() }, error: null }),
    getUser: async () => ({ data: { user: readDemoSession()?.user ?? null }, error: null }),
  };

  const notificationCatalog = [
    { type: 'comanda_aberta', label: 'Comandas abertas', description: 'Avisar quando uma nova comanda for aberta.' },
    { type: 'estoque_baixo', label: 'Estoque baixo', description: 'Avisar quando um produto atingir o estoque minimo.' },
    { type: 'pagamento_a_realizar', label: 'Pagamentos a realizar', description: 'Avisar sobre contas pendentes, vencendo ou vencidas.' },
    { type: 'cobranca_clube_chefes', label: 'Cobrancas do Clube dos Chefes', description: 'Avisar sobre mensalidades pendentes ou vencidas.' },
    { type: 'proximo_cliente', label: 'Proximo cliente', description: 'Avisar sobre o proximo atendimento da agenda.' },
    { type: 'cliente_atrasado', label: 'Cliente atrasado', description: 'Avisar quando o horario do atendimento ja passou.' },
  ];

  const isNotificationEnabled = (db: LocalDemoDatabase, type: string) => {
    const preference = db.notification_preferences.find(
      (item) => item.tenant_id === LOCAL_DEMO_TENANT_ID && item.user_id === LOCAL_DEMO_USER_ID && item.type === type,
    );
    return preference?.enabled !== false;
  };

  const upsertDemoNotification = (
    db: LocalDemoDatabase,
    payload: {
      type: string;
      title: string;
      message: string;
      entity_type?: string | null;
      entity_id?: string | null;
      severity?: 'info' | 'warning' | 'critical';
      metadata?: Record<string, unknown>;
    },
  ) => {
    if (!isNotificationEnabled(db, payload.type)) return null;

    const now = new Date().toISOString();
    const existing = db.notifications.find(
      (item) =>
        item.tenant_id === LOCAL_DEMO_TENANT_ID &&
        item.user_id === LOCAL_DEMO_USER_ID &&
        item.type === payload.type &&
        (item.entity_type || '') === (payload.entity_type || '') &&
        (item.entity_id || '') === (payload.entity_id || '') &&
        item.status === 'unread',
    );

    if (existing) {
      existing.title = payload.title;
      existing.message = payload.message;
      existing.severity = payload.severity || 'info';
      existing.metadata = payload.metadata || {};
      existing.created_at = now;
      existing.updated_at = now;
      return existing.id;
    }

    const row = {
      id: createDemoId('notification'),
      tenant_id: LOCAL_DEMO_TENANT_ID,
      user_id: LOCAL_DEMO_USER_ID,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      entity_type: payload.entity_type || null,
      entity_id: payload.entity_id || null,
      severity: payload.severity || 'info',
      status: 'unread' as const,
      read_at: null,
      metadata: payload.metadata || {},
      created_at: now,
      updated_at: now,
    };
    db.notifications.push(row);
    return row.id;
  };

const client = {
    auth,
    from: (table: string) => createLocalDemoQueryBuilder(table),
    schema: () => client,
    channel: (_name: string) => ({
      on: () => ({
        subscribe: () => ({}),
      }),
      subscribe: () => ({}),
    }),
    removeChannel: async () => null,
    rpc: (fn: string, params?: Record<string, unknown>) => {
      if (fn === 'get_auth_access_context' && readDemoSession()) {
        return createRpcResult({
          tenant_id: LOCAL_DEMO_TENANT_ID,
          access_role: 'manager',
          profile_status: 'active',
          is_super_admin: false,
        }, null);
      }

      if (fn === 'get_notification_preferences' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        return createRpcResult(
          notificationCatalog.map((item) => ({
            ...item,
            enabled: isNotificationEnabled(db, item.type),
          })),
          null,
        );
      }

      if (fn === 'set_notification_preferences' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        const now = new Date().toISOString();
        const preferences = Array.isArray(params?.p_preferences) ? params?.p_preferences as Array<{ type?: string; enabled?: boolean }> : [];

        preferences.forEach((preference) => {
          if (!preference.type || !notificationCatalog.some((item) => item.type === preference.type)) return;
          const existing = db.notification_preferences.find(
            (item) =>
              item.tenant_id === LOCAL_DEMO_TENANT_ID &&
              item.user_id === LOCAL_DEMO_USER_ID &&
              item.type === preference.type,
          );
          if (existing) {
            existing.enabled = preference.enabled !== false;
            existing.updated_at = now;
          } else {
            db.notification_preferences.push({
              id: createDemoId('notification-preference'),
              tenant_id: LOCAL_DEMO_TENANT_ID,
              user_id: LOCAL_DEMO_USER_ID,
              type: preference.type,
              enabled: preference.enabled !== false,
              created_at: now,
              updated_at: now,
            });
          }
        });

        writeDemoDatabase(db);
        return createRpcResult(
          notificationCatalog.map((item) => ({
            ...item,
            enabled: isNotificationEnabled(db, item.type),
          })),
          null,
        );
      }

      if (fn === 'list_internal_notifications' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        const status = params?.p_status as string | null | undefined;
        const limit = Number(params?.p_limit || 50);
        const rows = db.notifications
          .filter((item) =>
            item.tenant_id === LOCAL_DEMO_TENANT_ID &&
            item.user_id === LOCAL_DEMO_USER_ID &&
            (!status || item.status === status),
          )
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .slice(0, limit);

        return createRpcResult(rows, null);
      }

      if (fn === 'count_unread_notifications' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        return createRpcResult(
          db.notifications.filter(
            (item) =>
              item.tenant_id === LOCAL_DEMO_TENANT_ID &&
              item.user_id === LOCAL_DEMO_USER_ID &&
              item.status === 'unread',
          ).length,
          null,
        );
      }

      if (fn === 'mark_notification_read' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        const id = params?.p_notification_id as string;
        const row = db.notifications.find((item) => item.id === id && item.user_id === LOCAL_DEMO_USER_ID);
        if (row) {
          row.status = 'read';
          row.read_at = row.read_at || new Date().toISOString();
          row.updated_at = new Date().toISOString();
          writeDemoDatabase(db);
        }
        return createRpcResult(null, null);
      }

      if (fn === 'mark_all_notifications_read' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        const now = new Date().toISOString();
        let count = 0;
        db.notifications.forEach((item) => {
          if (item.tenant_id === LOCAL_DEMO_TENANT_ID && item.user_id === LOCAL_DEMO_USER_ID && item.status === 'unread') {
            item.status = 'read';
            item.read_at = item.read_at || now;
            item.updated_at = now;
            count += 1;
          }
        });
        writeDemoDatabase(db);
        return createRpcResult(count, null);
      }

      if (fn === 'archive_notification' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        const id = params?.p_notification_id as string;
        const row = db.notifications.find((item) => item.id === id && item.user_id === LOCAL_DEMO_USER_ID);
        if (row) {
          row.status = 'archived';
          row.read_at = row.read_at || new Date().toISOString();
          row.updated_at = new Date().toISOString();
          writeDemoDatabase(db);
        }
        return createRpcResult(null, null);
      }

      if (fn === 'generate_system_notifications' && isLocalDemoEnabled()) {
        const db = readDemoDatabase();
        let generated = 0;
        db.products
          .filter((product) => product.tenant_id === LOCAL_DEMO_TENANT_ID && product.active && product.stock_quantity <= product.minimum_stock)
          .forEach((product) => {
            const id = upsertDemoNotification(db, {
              type: 'estoque_baixo',
              title: 'Estoque baixo',
              message: `O produto ${product.name} está com estoque abaixo do mínimo.`,
              entity_type: 'products',
              entity_id: product.id,
              severity: product.stock_quantity <= 0 ? 'critical' : 'warning',
              metadata: { stock_quantity: product.stock_quantity, minimum_stock: product.minimum_stock },
            });
            if (id) generated += 1;
          });

        const openComanda = db.comandas.find((item) => item.tenant_id === LOCAL_DEMO_TENANT_ID && item.status === 'open');
        if (openComanda) {
          const clientRow = db.clients.find((item) => item.id === openComanda.client_id);
          const id = upsertDemoNotification(db, {
            type: 'comanda_aberta',
            title: 'Nova comanda aberta',
            message: `Uma nova comanda foi aberta para ${clientRow?.name || `comanda #${openComanda.id.slice(0, 8)}`}.`,
            entity_type: 'comandas',
            entity_id: openComanda.id,
            severity: 'info',
            metadata: { comanda_id: openComanda.id },
          });
          if (id) generated += 1;
        }

        const pendingExpense = db.transactions.find((item) => item.tenant_id === LOCAL_DEMO_TENANT_ID && item.type === 'expense' && item.status === 'pending');
        if (pendingExpense) {
          const id = upsertDemoNotification(db, {
            type: 'pagamento_a_realizar',
            title: 'Pagamento a realizar',
            message: `Existe um pagamento de R$ ${Number(pendingExpense.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com vencimento em ${new Date(pendingExpense.date).toLocaleDateString('pt-BR')}.`,
            entity_type: 'transactions',
            entity_id: pendingExpense.id,
            severity: new Date(pendingExpense.date) < new Date() ? 'critical' : 'warning',
            metadata: { amount: pendingExpense.amount, due_date: pendingExpense.date },
          });
          if (id) generated += 1;
        }

        writeDemoDatabase(db);
        return createRpcResult({ generated, tenant_id: LOCAL_DEMO_TENANT_ID }, null);
      }

      if (fn === 'create_appointment_with_services' && isLocalDemoEnabled()) {
        const p = params as {
          p_tenant_id?: string;
          p_client_id?: string;
          p_client_name?: string;
          p_client_phone?: string;
          p_staff_id?: string;
          p_start_time?: string;
          p_notes?: string;
          p_idempotency_key?: string;
          p_is_overbooked?: boolean;
          p_services?: Array<{ service_id?: string; service_name?: string; name?: string }> | string;
        };

        const db = readDemoDatabase();
        const tenantId = p.p_tenant_id || LOCAL_DEMO_TENANT_ID;

        if (p.p_idempotency_key) {
          const existing = db.appointments.find((a) => a.idempotency_key === p.p_idempotency_key && a.tenant_id === tenantId);
          if (existing) {
            const existingComanda = db.comandas.find((c) => c.appointment_id === existing.id);
            const existingComandaItem = existingComanda ? db.comanda_items.find((ci) => ci.comanda_id === existingComanda.id) : null;
            return createRpcResult({
              appointment_id: existing.id,
              comanda_id: existingComanda?.id || null,
              comanda_item_id: existingComandaItem?.id || null,
              total_price: existingComanda?.total || 0,
              total_duration_minutes: Math.round(Number(existing.duration || 0) * 60),
              appointment_status: existing.status,
              idempotent: true,
            }, null);
          }
        }

        let requestedServices: Array<{ service_id?: string; service_name?: string; name?: string }> = [];
        if (Array.isArray(p.p_services)) {
          requestedServices = p.p_services;
        } else if (typeof p.p_services === 'string' && p.p_services.trim()) {
          try {
            const parsed = JSON.parse(p.p_services);
            requestedServices = Array.isArray(parsed) ? parsed : [parsed];
          } catch {
            requestedServices = [{ service_name: p.p_services }];
          }
        }

        const selectedServices = requestedServices
          .map((requested) => db.services.find((service) =>
            service.tenant_id === tenantId &&
            (service.id === requested.service_id ||
              service.name.toLowerCase() === `${requested.service_name || requested.name || ''}`.toLowerCase())
          ))
          .filter((service): service is typeof db.services[number] => Boolean(service));

        if (selectedServices.length === 0) {
          return createRpcResult(null, new Error('Selecione pelo menos um servico valido'));
        }

        const now = new Date().toISOString();
        const staff = db.staff.find((s) => s.id === p.p_staff_id);
        const totalPrice = selectedServices.reduce((sum, service) => sum + Number(service.price || 0), 0);
        const totalDurationMinutes = selectedServices.reduce((sum, service) => sum + Number(service.duration || 30), 0);
        const durationHours = Math.max(0.25, Math.round((totalDurationMinutes / 60) * 10) / 10);
        const firstService = selectedServices[0];
        const appointmentId = `demo-appointment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const comandaId = `demo-comanda-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        let lastComandaItemId: string | null = null;

        db.appointments.push({
          id: appointmentId,
          tenant_id: tenantId,
          client_id: p.p_client_id || null,
          service_id: firstService.id,
          staff_id: p.p_staff_id || null,
          client_name: p.p_client_name || '',
          client_phone: p.p_client_phone || '',
          service_name: selectedServices.length === 1 ? firstService.name : `${firstService.name} +${selectedServices.length - 1}`,
          staff_name: staff?.name || '',
          start_time: p.p_start_time || now,
          duration: durationHours,
          price: totalPrice,
          notes: p.p_notes || '',
          hidden_from_schedule: false,
          is_overbooked: Boolean(p.p_is_overbooked),
          status: 'confirmed',
          idempotency_key: p.p_idempotency_key || null,
          created_at: now,
          updated_at: now,
        });

        db.comandas.push({
          id: comandaId,
          tenant_id: tenantId,
          appointment_id: appointmentId,
          client_id: p.p_client_id || null,
          staff_id: p.p_staff_id || null,
          status: 'open',
          total: totalPrice,
          idempotency_key: p.p_idempotency_key || null,
          created_at: now,
          updated_at: now,
        });

        selectedServices.forEach((service) => {
          const comandaItemId = `demo-comanda-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
          lastComandaItemId = comandaItemId;
          db.comanda_items.push({
            id: comandaItemId,
            tenant_id: tenantId,
            comanda_id: comandaId,
            service_id: service.id,
            staff_id: p.p_staff_id || null,
            product_name: service.name,
            quantity: 1,
            unit_price: Number(service.price || 0),
            created_at: now,
            updated_at: now,
          });
        });

        writeDemoDatabase(db);
        return createRpcResult({
          appointment_id: appointmentId,
          comanda_id: comandaId,
          comanda_item_id: lastComandaItemId,
          total_price: totalPrice,
          service_price: totalPrice,
          total_duration_minutes: totalDurationMinutes,
          appointment_status: 'confirmed',
          idempotent: false,
        }, null);
      }

      if (fn === 'create_appointment_with_comanda' && isLocalDemoEnabled()) {
        console.log('[create_appointment_with_comanda] demo RPC called with params:', params);
        const p = params as {
          p_tenant_id?: string;
          p_client_id?: string;
          p_client_name?: string;
          p_client_phone?: string;
          p_service_id?: string;
          p_staff_id?: string;
          p_start_time?: string;
          p_price?: number;
          p_notes?: string;
          p_idempotency_key?: string;
          p_is_overbooked?: boolean;
        };

        const db = readDemoDatabase();

        if (p.p_idempotency_key) {
          const existing = db.appointments.find(
            (a) => a.idempotency_key === p.p_idempotency_key && a.tenant_id === (p.p_tenant_id || LOCAL_DEMO_TENANT_ID)
          );
          if (existing) {
            const existingComanda = db.comandas.find((c) => c.appointment_id === existing.id);
            const existingComandaItem = existingComanda ? db.comanda_items.find((ci) => ci.comanda_id === existingComanda.id) : null;
            console.log('[create_appointment_with_comanda] demo RPC found existing idempotent appointment:', existing.id);
            return createRpcResult({
              appointment_id: existing.id,
              comanda_id: existingComanda?.id || null,
              comanda_item_id: existingComandaItem?.id || null,
              service_price: existingComanda?.total || 0,
              appointment_status: existing.status,
            }, null);
          }
        }

        const now = new Date().toISOString();

        const service = db.services.find((s) => s.id === p.p_service_id);
        const staff = db.staff.find((s) => s.id === p.p_staff_id);

        const durationHours = service ? Math.round((Number(service.duration || 30) / 60) * 10) / 10 : 0.5;
        const price = p.p_price ?? service?.price ?? 0;

        const appointmentId = `demo-appointment-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const comandaId = `demo-comanda-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const comandaItemId = `demo-comanda-item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;

        const newAppointment = {
          id: appointmentId,
          tenant_id: p.p_tenant_id || LOCAL_DEMO_TENANT_ID,
          client_id: p.p_client_id || null,
          service_id: p.p_service_id || null,
          staff_id: p.p_staff_id || null,
          client_name: p.p_client_name || '',
          client_phone: p.p_client_phone || '',
          service_name: service?.name || '',
          staff_name: staff?.name || '',
          start_time: p.p_start_time || now,
          duration: durationHours,
          price,
          notes: p.p_notes || '',
          hidden_from_schedule: false,
          is_overbooked: Boolean(p.p_is_overbooked),
          status: 'confirmed',
          idempotency_key: p.p_idempotency_key || null,
          created_at: now,
          updated_at: now,
        };

        const newComanda = {
          id: comandaId,
          tenant_id: p.p_tenant_id || LOCAL_DEMO_TENANT_ID,
          appointment_id: appointmentId,
          client_id: p.p_client_id || null,
          staff_id: p.p_staff_id || null,
          status: 'open',
          total: price,
          idempotency_key: p.p_idempotency_key || null,
          created_at: now,
          updated_at: now,
        };

        const newComandaItem = {
          id: comandaItemId,
          tenant_id: p.p_tenant_id || LOCAL_DEMO_TENANT_ID,
          comanda_id: comandaId,
          service_id: p.p_service_id || null,
          staff_id: p.p_staff_id || null,
          product_name: service?.name || '',
          quantity: 1,
          unit_price: price,
          created_at: now,
          updated_at: now,
        };

        db.appointments.push(newAppointment);
        db.comandas.push(newComanda);
        db.comanda_items.push(newComandaItem);
        writeDemoDatabase(db);

        const rpcResult = {
          appointment_id: appointmentId,
          comanda_id: comandaId,
          comanda_item_id: comandaItemId,
          service_price: price,
          appointment_status: 'confirmed',
        };
        console.log('[create_appointment_with_comanda] demo RPC result:', rpcResult, 'db.appointments count:', db.appointments.length);

        return createRpcResult(rpcResult, null);
      }

      if ((fn === 'generate_club_receivables' || fn === 'refresh_club_receivable_statuses') && isLocalDemoEnabled()) {
        const p = params as { p_tenant_id?: string };
        const db = readDemoDatabase();
        const tenantId = p?.p_tenant_id || LOCAL_DEMO_TENANT_ID;
        const today = new Date().toISOString().slice(0, 10);
        let generated = 0;
        let updated = 0;

        if (fn === 'generate_club_receivables') {
          db.customer_subscriptions
            .filter((subscription) => subscription.tenant_id === tenantId && ['active', 'past_due'].includes(subscription.status))
            .forEach((subscription) => {
              const plan = db.customer_plans.find((item) => item.id === subscription.plan_id && item.tenant_id === tenantId);
              if (!plan) return;

              const exists = db.customer_subscription_receivables.some(
                (item) =>
                  item.subscription_id === subscription.id &&
                  item.billing_cycle_start === subscription.cycle_start &&
                  item.billing_cycle_end === subscription.cycle_end,
              );

              if (!exists) {
                const now = new Date().toISOString();
                db.customer_subscription_receivables.push({
                  id: createDemoId('customer_subscription_receivables'),
                  tenant_id: tenantId,
                  customer_id: subscription.client_id,
                  subscription_id: subscription.id,
                  plan_id: subscription.plan_id,
                  billing_cycle_start: subscription.cycle_start,
                  billing_cycle_end: subscription.cycle_end,
                  due_date: subscription.cycle_start.slice(0, 10),
                  amount: Number(plan.monthly_price || 0),
                  status: subscription.cycle_start.slice(0, 10) < today ? 'overdue' : 'pending',
                  payment_method: null,
                  paid_at: null,
                  paid_by: null,
                  transaction_id: null,
                  notes: null,
                  created_at: now,
                  updated_at: now,
                });
              }

              generated += 1;
            });
        }

        db.customer_subscription_receivables = db.customer_subscription_receivables.map((receivable) => {
          if (receivable.tenant_id === tenantId && receivable.status === 'pending' && receivable.due_date < today) {
            updated += 1;
            return { ...receivable, status: 'overdue', updated_at: new Date().toISOString() };
          }
          return receivable;
        });

        writeDemoDatabase(db);
        return createRpcResult(fn === 'generate_club_receivables' ? generated : updated, null);
      }

      if (fn === 'pay_club_receivable' && isLocalDemoEnabled()) {
        const p = params as {
          p_receivable_id?: string;
          p_payment_method?: string;
          p_paid_at?: string;
          p_notes?: string | null;
        };
        const db = readDemoDatabase();
        const now = new Date().toISOString();
        const receivable = db.customer_subscription_receivables.find((item) => item.id === p.p_receivable_id);

        if (!receivable) {
          return createRpcResult(null, new Error('Recebimento não encontrado'));
        }

        if (!['pending', 'overdue'].includes(receivable.status)) {
          return createRpcResult(null, new Error('Recebimento não está pendente ou atrasado'));
        }

        if (receivable.transaction_id) {
          return createRpcResult(null, new Error('Recebimento já possui lançamento financeiro'));
        }

        const plan = db.customer_plans.find((item) => item.id === receivable.plan_id && item.tenant_id === receivable.tenant_id);
        const subscription = db.customer_subscriptions.find((item) => item.id === receivable.subscription_id);

        if (!plan || !subscription) {
          return createRpcResult(null, new Error('Assinatura ou plano não encontrado'));
        }

        const plannedServiceBalanceMap = (plan.service_credit_map || [])
          .map((entry) => ({
            service_id: entry.service_id,
            service_name: entry.service_name,
            available: Math.max(0, Number(entry.credits) || 0),
            used: 0,
          }))
          .filter((entry) => entry.service_id && entry.service_name && entry.available > 0);
        const availableCredits = plannedServiceBalanceMap.reduce((total, entry) => total + entry.available, 0);

        if (availableCredits <= 0) {
          return createRpcResult(null, new Error('Plano sem créditos por serviço configurados'));
        }

        const transaction = {
          id: createDemoId('transactions'),
          tenant_id: receivable.tenant_id,
          user_id: LOCAL_DEMO_USER_ID,
          type: 'income',
          amount: Number(receivable.amount || 0),
          date: p.p_paid_at || now,
          description: `Mensalidade Clube do Chefe - ${plan.name}`,
          category: 'Receita recorrente Clube do Chefe',
          status: 'paid',
          payment_method: p.p_payment_method || 'Pix',
          notes: p.p_notes || undefined,
        };
        db.transactions.push(transaction);

        db.customer_subscription_receivables = db.customer_subscription_receivables.map((item) =>
          item.id === receivable.id
            ? {
                ...item,
                status: 'paid',
                payment_method: p.p_payment_method || 'Pix',
                paid_at: p.p_paid_at || now,
                paid_by: LOCAL_DEMO_USER_ID,
                transaction_id: transaction.id,
                notes: p.p_notes || null,
                updated_at: now,
              }
            : item,
        );

        db.customer_credits = [
          ...db.customer_credits.filter((item) => item.subscription_id !== receivable.subscription_id),
          {
            id: db.customer_credits.find((item) => item.subscription_id === receivable.subscription_id)?.id || createDemoId('customer_credits'),
            tenant_id: receivable.tenant_id,
            subscription_id: receivable.subscription_id,
            client_id: receivable.customer_id,
            available_credits: availableCredits,
            used_credits: 0,
            service_balance_map: plannedServiceBalanceMap,
            period_start: receivable.billing_cycle_start,
            period_end: receivable.billing_cycle_end,
            created_at: now,
            updated_at: now,
          },
        ];

        const nextCycleStart = receivable.billing_cycle_end;
        const nextCycleEndDate = new Date(nextCycleStart);
        nextCycleEndDate.setMonth(nextCycleEndDate.getMonth() + 1);
        const nextCycleEnd = nextCycleEndDate.toISOString();

        db.customer_subscriptions = db.customer_subscriptions.map((item) =>
          item.id === subscription.id
            ? {
                ...item,
                status: 'active',
                cycle_start: receivable.billing_cycle_start,
                cycle_end: receivable.billing_cycle_end,
                next_billing_date: receivable.billing_cycle_end.slice(0, 10),
                updated_at: now,
              }
            : item,
        );

        if (!db.customer_subscription_receivables.some((item) =>
          item.subscription_id === subscription.id &&
          item.billing_cycle_start === nextCycleStart &&
          item.billing_cycle_end === nextCycleEnd
        )) {
          db.customer_subscription_receivables.push({
            id: createDemoId('customer_subscription_receivables'),
            tenant_id: receivable.tenant_id,
            customer_id: receivable.customer_id,
            subscription_id: subscription.id,
            plan_id: plan.id,
            billing_cycle_start: nextCycleStart,
            billing_cycle_end: nextCycleEnd,
            due_date: nextCycleStart.slice(0, 10),
            amount: Number(plan.monthly_price || 0),
            status: 'pending',
            payment_method: null,
            paid_at: null,
            paid_by: null,
            transaction_id: null,
            notes: null,
            created_at: now,
            updated_at: now,
          });
        }

        writeDemoDatabase(db);
        return createRpcResult({ receivable, transaction }, null);
      }

      if (fn === 'create_chef_club_subscription' && isLocalDemoEnabled()) {
        const p = params as {
          p_tenant_id?: string;
          p_client_id?: string;
          p_plan_id?: string;
          p_next_billing_date?: string;
          p_replace_existing?: boolean;
        };
        const db = readDemoDatabase();
        const tenantId = p.p_tenant_id || LOCAL_DEMO_TENANT_ID;
        const now = new Date().toISOString();
        const cycleEnd = new Date(`${p.p_next_billing_date}T12:00:00`).toISOString();
        const client = db.clients.find((item) => item.id === p.p_client_id && item.tenant_id === tenantId);
        const plan = db.customer_plans.find((item) => item.id === p.p_plan_id && item.tenant_id === tenantId);

        if (!client) {
          return createRpcResult(null, new Error('Cliente não encontrado para este tenant'));
        }

        if (!plan) {
          return createRpcResult(null, new Error('Plano não encontrado para este tenant'));
        }

        if (!plan.active) {
          return createRpcResult(null, new Error('Plano inativo'));
        }

        const plannedServiceBalanceMap = (plan.service_credit_map || [])
          .map((entry) => ({
            service_id: entry.service_id,
            service_name: entry.service_name,
            available: Math.max(0, Number(entry.credits) || 0),
            used: 0,
          }))
          .filter((entry) => entry.service_id && entry.service_name && entry.available > 0);
        const availableCredits = plannedServiceBalanceMap.reduce((total, entry) => total + entry.available, 0);

        if (plannedServiceBalanceMap.length === 0 || availableCredits <= 0) {
          return createRpcResult(null, new Error('Plano sem créditos por serviço configurados'));
        }

        const pendingServiceBalanceMap = plannedServiceBalanceMap.map((entry) => ({
          ...entry,
          available: 0,
          used: 0,
        }));

        let subscription = db.customer_subscriptions.find(
          (item) => item.tenant_id === tenantId && item.client_id === p.p_client_id && item.status === 'active',
        );

        if (subscription && !p.p_replace_existing) {
          return createRpcResult(null, new Error('Cliente já possui assinatura ativa'));
        }

        if (subscription) {
          subscription = {
            ...subscription,
            plan_id: plan.id,
            status: 'active',
            cycle_start: now,
            cycle_end: cycleEnd,
            next_billing_date: p.p_next_billing_date || cycleEnd.slice(0, 10),
            canceled_at: null,
            updated_at: now,
          };
          db.customer_subscriptions = db.customer_subscriptions.map((item) =>
            item.id === subscription!.id ? subscription! : item,
          );
        } else {
          subscription = {
            id: `demo-subscription-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
            tenant_id: tenantId,
            client_id: client.id,
            plan_id: plan.id,
            status: 'active',
            started_at: now,
            cycle_start: now,
            cycle_end: cycleEnd,
            next_billing_date: p.p_next_billing_date || cycleEnd.slice(0, 10),
            canceled_at: null,
            created_at: now,
            updated_at: now,
          };
          db.customer_subscriptions.push(subscription);
        }

        const creditRecord = {
          id: db.customer_credits.find((item) => item.subscription_id === subscription.id)?.id
            || `demo-credit-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          tenant_id: tenantId,
          subscription_id: subscription.id,
          client_id: client.id,
          available_credits: 0,
          used_credits: 0,
          service_balance_map: pendingServiceBalanceMap,
          period_start: subscription.cycle_start,
          period_end: subscription.cycle_end,
          created_at: now,
          updated_at: now,
        };

        db.customer_credits = [
          ...db.customer_credits.filter((item) => item.subscription_id !== subscription!.id),
          creditRecord,
        ];

        const existingReceivable = db.customer_subscription_receivables.find(
          (item) =>
            item.subscription_id === subscription!.id &&
            item.billing_cycle_start === subscription!.cycle_start &&
            item.billing_cycle_end === subscription!.cycle_end,
        );
        const receivable = {
          id: existingReceivable?.id || `demo-receivable-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          tenant_id: tenantId,
          customer_id: client.id,
          subscription_id: subscription.id,
          plan_id: plan.id,
          billing_cycle_start: subscription.cycle_start,
          billing_cycle_end: subscription.cycle_end,
          due_date: subscription.cycle_start.slice(0, 10),
          amount: Number(plan.monthly_price || 0),
          status: new Date(subscription.cycle_start.slice(0, 10)) < new Date(new Date().toISOString().slice(0, 10)) ? 'overdue' : 'pending',
          payment_method: null,
          paid_at: null,
          paid_by: null,
          transaction_id: null,
          notes: null,
          created_at: existingReceivable?.created_at || now,
          updated_at: now,
        } as LocalDemoReceivableRecord;
        db.customer_subscription_receivables = [
          ...db.customer_subscription_receivables.filter((item) => item.id !== receivable.id),
          receivable,
        ];
        writeDemoDatabase(db);

        return createRpcResult({ subscription, receivable_id: receivable.id, credits: creditRecord }, null);
      }

      return createRpcResult(null, new Error('RPC indisponivel no modo local.'));
    },
    functions: {
      invoke: (_name: string, _options?: { headers?: Record<string, string>; body?: unknown }) => {
        return Promise.resolve({ data: null, error: new Error('Edge functions indisponiveis no modo local.') }) as any;
      },
    } as any,
  };

  return client as unknown as SupabaseClient;
};

const baseClient = hasSupabaseEnv
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : createLocalDemoClient();

interface ActiveAppState {
  appSlug: AppSlug;
  schema: SupabaseSchemaName;
  hostname: string;
}

let activeAppState: ActiveAppState = {
  appSlug: DEFAULT_APP_SLUG,
  schema: resolveSchemaForApp(DEFAULT_APP_SLUG),
  hostname: 'localhost',
};

const schemaClientCache = new Map<SupabaseSchemaName, SupabaseClient>();
const scopedClientCache = new Map<AppSlug, SupabaseClient>();

const getOrCreateSchemaClient = (schema: SupabaseSchemaName): SupabaseClient => {
  if (schema === SHARED_SCHEMA) {
    return baseClient;
  }

  const cachedClient = schemaClientCache.get(schema);
  if (cachedClient) {
    return cachedClient;
  }

  const schemaClient = baseClient.schema(schema) as unknown as SupabaseClient;
  schemaClientCache.set(schema, schemaClient);
  return schemaClient;
};

export const setActiveAppContext = (nextState: ActiveAppState): void => {
  activeAppState = nextState;
};

export const getActiveAppContext = (): ActiveAppState => activeAppState;

export const getSharedClient = (): SupabaseClient => baseClient;

export const getSchemaClient = (schema: SupabaseSchemaName): SupabaseClient =>
  getOrCreateSchemaClient(schema);

const createScopedClient = (appSlug: AppSlug): SupabaseClient => {
  const targetClient = getSchemaClient(resolveSchemaForApp(appSlug));

  return new Proxy(targetClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => getClientForTable(table, appSlug).from(table);
      }

      if (prop === 'schema') {
        return (schema: SupabaseSchemaName) => getSchemaClient(schema);
      }

      if (prop === 'rpc') {
        return (...args: unknown[]) =>
          (getSharedClient().rpc as (...rpcArgs: unknown[]) => unknown)(...args);
      }

      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient;
};

export const getScopedClient = (appSlug: AppSlug = activeAppState.appSlug): SupabaseClient => {
  const cachedClient = scopedClientCache.get(appSlug);
  if (cachedClient) {
    return cachedClient;
  }

  const scopedClient = createScopedClient(appSlug);
  scopedClientCache.set(appSlug, scopedClient);
  return scopedClient;
};

export const getClientForTable = (
  table: string,
  appSlug: AppSlug = activeAppState.appSlug,
): SupabaseClient => {
  const schema = getSchemaForTable(table, appSlug);
  return getSchemaClient(schema);
};

export const supabase = new Proxy(baseClient, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return (table: string) => getClientForTable(table).from(table);
    }

    if (prop === 'schema') {
      return (schema: SupabaseSchemaName) => getSchemaClient(schema);
    }

    if (prop === 'rpc') {
      return (...args: unknown[]) =>
        (getSharedClient().rpc as (...rpcArgs: unknown[]) => unknown)(...args);
    }

    if (prop === 'functions') {
      return getSharedClient().functions;
    }

    if (prop === 'auth') {
      return target.auth;
    }

    return Reflect.get(target, prop, receiver);
  },
}) as SupabaseClient;
