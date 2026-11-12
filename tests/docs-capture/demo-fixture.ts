/**
 * Fixture de captura — dados fictícios do Local Demo Mode ancorados em HOJE.
 *
 * ─── Por que existe ──────────────────────────────────────────────────────
 * O seed do Local Demo Mode (`src/lib/supabase/client.ts`) usa datas fixas de
 * abril/2026. Como as telas filtram "hoje" e "mês atual", as capturas saíam
 * zeradas (Faturamento R$ 0,00, "Nenhuma movimentação", caixa VAZIO).
 *
 * Esta fixture é escrita em `localStorage['soumanager.local.demo.db']` antes
 * do primeiro load. Nenhuma linha de produto é alterada: o client emulado
 * lê esse objeto como se fosse o banco local do demo.
 *
 * ─── Regras que NÃO podem ser quebradas ──────────────────────────────────
 * 1. Nada de dado real: nomes, telefones e valores são inventados.
 * 2. Ids das linhas de seed (`demo-client-*`, `demo-staff-*`,
 *    `demo-service-*`, `demo-transaction-*`, `demo-comanda-*`) são REUSADOS.
 *    `mergeSeedRows` só concatena seed quando o id não existe, então reusar
 *    evita duplicar linhas de abril/2026 no meio do material.
 * 3. Todo timestamp é ISO com `Z` (`.toISOString()`), porque os filtros do
 *    demo client comparam STRING (`row[field] >= value`). Misturar
 *    `-03:00` com `Z` quebraria `gte`/`lte`.
 * 4. Horários de hoje ficam entre 09:00 e 18:00 em America/Sao_Paulo, para
 *    que o ISO em UTC continue no mesmo dia (`startsWith('YYYY-MM-DD')`).
 * 5. Tabelas não mescladas com seed (`clients`, `appointments`, `products`,
 *    `promotions`) são substituídas por inteiro — precisam vir completas.
 *
 * Invariantes verificadas por `demo-fixture.test.ts`.
 */

export const DEMO_SESSION_KEY = 'soumanager.local.demo.session';
export const DEMO_DB_KEY = 'soumanager.local.demo.db';
export const DEMO_TENANT_ID = '00000000-0000-0000-0000-000000000101';
export const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001';

const STAFF_MARCOS = 'demo-staff-1';
const STAFF_JULIA = 'demo-staff-2';

const CLIENT_IDS = [
  'demo-client-1',
  'demo-client-2',
  'demo-client-3',
  'demo-client-4',
  'demo-client-5',
  'demo-client-6',
  'demo-client-7',
  'demo-client-8',
  'demo-client-9',
  'demo-client-10',
];

const CLIENTS = [
  { name: 'Carlos Demo', phone: '(11) 99999-0001', email: 'carlos.demo@exemplo.local' },
  { name: 'Fernanda Demo', phone: '(11) 99999-0002', email: 'fernanda.demo@exemplo.local' },
  { name: 'Rafael Andrade', phone: '(11) 98888-1203', email: 'rafael.andrade@exemplo.local' },
  { name: 'Bruno Tavares', phone: '(11) 98888-4410', email: 'bruno.tavares@exemplo.local' },
  { name: 'Diego Moreira', phone: '(11) 97777-8821', email: 'diego.moreira@exemplo.local' },
  { name: 'Lucas Ferreira', phone: '(11) 97777-3390', email: '' },
  { name: 'Pedro Henrique', phone: '(11) 96666-2214', email: 'pedro.henrique@exemplo.local' },
  { name: 'Thiago Ramos', phone: '(11) 96666-7788', email: '' },
  { name: 'Gustavo Lima', phone: '(11) 95555-1020', email: 'gustavo.lima@exemplo.local' },
  { name: 'Vitor Almeida', phone: '(11) 95555-9070', email: 'vitor.almeida@exemplo.local' },
];

const SERVICES = {
  corte: { id: 'demo-service-1', name: 'Sanchez Signature Cut', price: 65, duration: 45 },
  barba: { id: 'demo-service-2', name: 'Ritual de Barba Prime', price: 55, duration: 35 },
  combo: { id: 'demo-service-3', name: 'Combo Executivo', price: 110, duration: 80 },
};

const PRODUCT_POMADA = { name: 'Pomada Sanchez Finish', price: 35 };

const STAFF_NAMES: Record<string, string> = {
  [STAFF_MARCOS]: 'Marcos Demo',
  [STAFF_JULIA]: 'Julia Demo',
};

// ─── Helpers de data (America/Sao_Paulo, sem DST desde 2019 → -03:00 fixo) ───

const SP_OFFSET = '-03:00';

const pad = (value: number): string => String(value).padStart(2, '0');

/** Partes Y/M/D de `base` no calendário de São Paulo. */
const spDayParts = (base: Date): { year: number; month: number; day: number } => {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
  const [year, month, day] = formatted.split('-').map(Number);
  return { year, month, day };
};

/** Instante de `day`/`month` (offset em meses), hora local de São Paulo. */
const spTimestamp = (
  base: Date,
  monthOffset: number,
  day: number,
  hour: number,
  minute = 0,
): string => {
  const { year, month } = spDayParts(base);
  const iso = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00${SP_OFFSET}`;
  const date = new Date(iso);
  date.setUTCMonth(date.getUTCMonth() + monthOffset);
  return date.toISOString();
};

/** Hoje, hora local de São Paulo. */
const todayAt = (base: Date, hour: number, minute = 0): string =>
  spTimestamp(base, 0, spDayParts(base).day, hour, minute);

export interface DemoFixture {
  [table: string]: Array<Record<string, unknown>>;
}

export const buildDemoFixture = (now: Date = new Date()): DemoFixture => {
  const { day: todayDay } = spDayParts(now);
  const createdAt = todayAt(now, 8, 0);

  const clients = CLIENTS.map((client, index) => ({
    id: CLIENT_IDS[index],
    tenant_id: DEMO_TENANT_ID,
    name: client.name,
    phone: client.phone,
    email: client.email,
    status: 'active',
    last_visit: spTimestamp(now, 0, Math.max(todayDay - (index + 1), 1), 10, 0),
    created_at: spTimestamp(now, -3, Math.max(index + 2, 1), 10, 0),
  }));

  // ─── Agenda de hoje: 9 atendimentos (6 já concluídos, 3 ainda por vir) ───
  const todaySlots = [
    { hour: 9, minute: 0, client: 2, service: SERVICES.barba, staff: STAFF_MARCOS, status: 'completed' },
    { hour: 9, minute: 45, client: 0, service: SERVICES.corte, staff: STAFF_MARCOS, status: 'completed' },
    { hour: 10, minute: 30, client: 3, service: SERVICES.combo, staff: STAFF_JULIA, status: 'completed' },
    { hour: 11, minute: 30, client: 4, service: SERVICES.combo, staff: STAFF_MARCOS, status: 'completed' },
    { hour: 13, minute: 30, client: 5, service: SERVICES.corte, staff: STAFF_JULIA, status: 'completed' },
    { hour: 14, minute: 30, client: 6, service: SERVICES.barba, staff: STAFF_MARCOS, status: 'completed' },
    { hour: 15, minute: 30, client: 7, service: SERVICES.combo, staff: STAFF_MARCOS, status: 'confirmed' },
    { hour: 16, minute: 30, client: 8, service: SERVICES.barba, staff: STAFF_JULIA, status: 'confirmed' },
    { hour: 17, minute: 30, client: 9, service: SERVICES.corte, staff: STAFF_MARCOS, status: 'confirmed' },
  ];

  const appointments = todaySlots.map((slot, index) => ({
    id: `demo-appointment-today-${index + 1}`,
    tenant_id: DEMO_TENANT_ID,
    client_id: CLIENT_IDS[slot.client],
    service_id: slot.service.id,
    staff_id: slot.staff,
    client_name: CLIENTS[slot.client].name,
    client_phone: CLIENTS[slot.client].phone,
    service_name: slot.service.name,
    staff_name: STAFF_NAMES[slot.staff],
    start_time: todayAt(now, slot.hour, slot.minute),
    duration: Number((slot.service.duration / 60).toFixed(2)),
    price: slot.service.price,
    status: slot.status,
    hidden_from_schedule: false,
    is_overbooked: false,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  // Histórico: alimenta gráfico de 30 dias, "clientes recorrentes" e ocupação.
  const pastAppointments = Array.from({ length: 14 }).map((_, index) => {
    const daysAgo = index + 2;
    const clientIndex = index % CLIENTS.length;
    const service = [SERVICES.corte, SERVICES.barba, SERVICES.combo][index % 3];
    const staff = index % 2 === 0 ? STAFF_MARCOS : STAFF_JULIA;
    return {
      id: `demo-appointment-past-${index + 1}`,
      tenant_id: DEMO_TENANT_ID,
      client_id: CLIENT_IDS[clientIndex],
      service_id: service.id,
      staff_id: staff,
      client_name: CLIENTS[clientIndex].name,
      client_phone: CLIENTS[clientIndex].phone,
      service_name: service.name,
      staff_name: STAFF_NAMES[staff],
      start_time: spTimestamp(now, 0, Math.max(todayDay - daysAgo, 1), 10 + (index % 6), 0),
      duration: Number((service.duration / 60).toFixed(2)),
      price: service.price,
      status: 'completed',
      hidden_from_schedule: false,
      is_overbooked: false,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  // ─── Comandas de hoje ───────────────────────────────────────────────────
  type ComandaPlan = {
    id: string;
    hour: number;
    minute: number;
    staff: string;
    client: number;
    appointmentId: string | null;
    items: Array<{ name: string; price: number; quantity?: number; serviceId: string | null }>;
    status: 'paid' | 'open';
    paymentMethod?: string;
  };

  const closedPlans: ComandaPlan[] = [
    {
      id: 'demo-comanda-1',
      hour: 9,
      minute: 50,
      staff: STAFF_MARCOS,
      client: 0,
      appointmentId: 'demo-appointment-today-2',
      items: [
        { name: SERVICES.corte.name, price: SERVICES.corte.price, serviceId: SERVICES.corte.id },
        { name: PRODUCT_POMADA.name, price: PRODUCT_POMADA.price, serviceId: null },
      ],
      status: 'paid',
      paymentMethod: 'PIX',
    },
    {
      id: 'demo-comanda-2',
      hour: 10,
      minute: 5,
      staff: STAFF_MARCOS,
      client: 2,
      appointmentId: 'demo-appointment-today-1',
      items: [{ name: SERVICES.barba.name, price: SERVICES.barba.price, serviceId: SERVICES.barba.id }],
      status: 'paid',
      paymentMethod: 'Cartão de crédito',
    },
    {
      id: 'demo-comanda-3',
      hour: 11,
      minute: 45,
      staff: STAFF_JULIA,
      client: 3,
      appointmentId: 'demo-appointment-today-3',
      items: [{ name: SERVICES.combo.name, price: SERVICES.combo.price, serviceId: SERVICES.combo.id }],
      status: 'paid',
      paymentMethod: 'PIX',
    },
    {
      id: 'demo-comanda-4',
      hour: 12,
      minute: 50,
      staff: STAFF_MARCOS,
      client: 4,
      appointmentId: 'demo-appointment-today-4',
      items: [{ name: SERVICES.combo.name, price: SERVICES.combo.price, serviceId: SERVICES.combo.id }],
      status: 'paid',
      paymentMethod: 'Cartão de débito',
    },
    {
      id: 'demo-comanda-5',
      hour: 14,
      minute: 10,
      staff: STAFF_JULIA,
      client: 5,
      appointmentId: 'demo-appointment-today-5',
      items: [{ name: SERVICES.corte.name, price: SERVICES.corte.price, serviceId: SERVICES.corte.id }],
      status: 'paid',
      paymentMethod: 'Dinheiro',
    },
    {
      id: 'demo-comanda-6',
      hour: 15,
      minute: 20,
      staff: STAFF_MARCOS,
      client: 6,
      appointmentId: 'demo-appointment-today-6',
      items: [{ name: SERVICES.barba.name, price: SERVICES.barba.price, serviceId: SERVICES.barba.id }],
      status: 'paid',
      paymentMethod: 'PIX',
    },
  ];

  const openPlans: ComandaPlan[] = [
    {
      id: 'demo-comanda-7',
      hour: 16,
      minute: 0,
      staff: STAFF_MARCOS,
      client: 7,
      appointmentId: 'demo-appointment-today-7',
      items: [
        { name: SERVICES.combo.name, price: SERVICES.combo.price, serviceId: SERVICES.combo.id },
        { name: PRODUCT_POMADA.name, price: PRODUCT_POMADA.price, serviceId: null },
      ],
      status: 'open',
    },
    {
      id: 'demo-comanda-8',
      hour: 16,
      minute: 40,
      staff: STAFF_JULIA,
      client: 8,
      appointmentId: 'demo-appointment-today-8',
      items: [{ name: SERVICES.barba.name, price: SERVICES.barba.price, serviceId: SERVICES.barba.id }],
      status: 'open',
    },
  ];

  const comandas: Array<Record<string, unknown>> = [];
  const comandaItems: Array<Record<string, unknown>> = [];
  const participants: Array<Record<string, unknown>> = [];
  const transactions: Array<Record<string, unknown>> = [];

  [...closedPlans, ...openPlans].forEach((plan, planIndex) => {
    const total = plan.items.reduce((sum, item) => sum + item.price * (item.quantity ?? 1), 0);
    const openedAt = todayAt(now, plan.hour, plan.minute);
    const closedAt = plan.status === 'paid' ? todayAt(now, plan.hour, plan.minute + 8) : null;

    comandas.push({
      id: plan.id,
      tenant_id: DEMO_TENANT_ID,
      appointment_id: plan.appointmentId,
      client_id: CLIENT_IDS[plan.client],
      staff_id: plan.staff,
      status: plan.status,
      total,
      payment_method: plan.paymentMethod ?? null,
      closure_mode: plan.status === 'paid' ? 'manual' : null,
      closure_note: null,
      financial_effect: plan.status === 'paid',
      membership_credit_effect: false,
      legacy_reference_month: null,
      closed_at: closedAt,
      payment_date_real: closedAt,
      settled_at: closedAt,
      settled_by_user_id: plan.status === 'paid' ? DEMO_USER_ID : null,
      idempotency_key: null,
      created_at: openedAt,
      updated_at: closedAt ?? openedAt,
    });

    plan.items.forEach((item, itemIndex) => {
      const itemId = `${plan.id}-item-${itemIndex + 1}`;
      comandaItems.push({
        id: itemId,
        tenant_id: DEMO_TENANT_ID,
        comanda_id: plan.id,
        staff_id: plan.staff,
        service_id: item.serviceId,
        product_name: item.name,
        quantity: item.quantity ?? 1,
        unit_price: item.price,
        created_at: openedAt,
        updated_at: closedAt ?? openedAt,
        'comandas.status': plan.status,
        'comandas.created_at': openedAt,
      });

      participants.push({
        id: `${itemId}-participant`,
        comanda_item_id: itemId,
        professional_id: plan.staff,
        role: 'primary',
        payout_type: 'percentage',
        payout_value: plan.staff === STAFF_MARCOS ? 40 : 30,
        affects_revenue: true,
        affects_commission: true,
        tenant_id: DEMO_TENANT_ID,
        created_at: openedAt,
      });
    });

    if (plan.status === 'paid') {
      transactions.push({
        id: `demo-transaction-comanda-${planIndex + 1}`,
        tenant_id: DEMO_TENANT_ID,
        user_id: DEMO_USER_ID,
        type: 'income',
        amount: total,
        date: closedAt,
        description: `Comanda ${CLIENT_IDS[plan.client].replace('demo-client-', 'cliente ')}`,
        category: 'Serviços',
        status: 'paid',
        payment_method: plan.paymentMethod,
        source_type: 'comanda',
        source_id: plan.id,
        idempotency_key: null,
      });
    }
  });

  // ─── Histórico financeiro: mês atual (antes de hoje) e mês anterior ─────
  const currentMonthDays = [2, 3, 4, 5, 6, 7, 8];
  currentMonthDays.forEach((dayOfMonth, index) => {
    if (dayOfMonth > todayDay) return;
    transactions.push({
      id: `demo-transaction-current-${index + 1}`,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      type: 'income',
      amount: [420, 285, 510, 340, 265, 480, 395][index],
      date: spTimestamp(now, 0, dayOfMonth, 12 + (index % 5), 0),
      description: 'Atendimentos do dia',
      category: 'Serviços',
      status: 'paid',
      payment_method: index % 2 === 0 ? 'PIX' : 'Cartão de crédito',
    });
  });

  // Ids `demo-transaction-3` e `demo-transaction-4` são reusados de propósito:
  // o seed de abril/2026 usa esses ids e `mergeSeedRows` pularia a linha só se
  // o id já existir.
  [
    { id: 'demo-transaction-3', dayOfMonth: 3, amount: 320, description: 'Reposição de estoque', category: 'Estoque' },
    { id: 'demo-transaction-4', dayOfMonth: 6, amount: 180, description: 'Energia e água', category: 'Infraestrutura' },
    { id: 'demo-transaction-expense-3', dayOfMonth: 8, amount: 240, description: 'Marketing local', category: 'Marketing' },
  ].forEach((expense) => {
    if (expense.dayOfMonth > todayDay) return;
    transactions.push({
      id: expense.id,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      type: 'expense',
      amount: expense.amount,
      date: spTimestamp(now, 0, expense.dayOfMonth, 9, 30),
      description: expense.description,
      category: expense.category,
      status: 'paid',
      payment_method: 'PIX',
    });
  });

  transactions.push({
    id: 'demo-transaction-1',
    tenant_id: DEMO_TENANT_ID,
    user_id: DEMO_USER_ID,
    type: 'expense',
    amount: 85,
    date: todayAt(now, 8, 15),
    description: 'Insumos de barbearia',
    category: 'Estoque',
    status: 'paid',
    payment_method: 'Dinheiro',
  });

  [2, 5, 9, 12, 16, 19, 22, 25, 27, 28].forEach((dayOfMonth, index) => {
    transactions.push({
      id: `demo-transaction-previous-${index + 1}`,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      type: 'income',
      amount: [310, 265, 420, 298, 355, 240, 410, 375, 290, 330][index],
      date: spTimestamp(now, -1, dayOfMonth, 12 + (index % 5), 0),
      description: 'Atendimentos do dia',
      category: 'Serviços',
      status: 'paid',
      payment_method: index % 2 === 0 ? 'PIX' : 'Cartão de débito',
    });
  });

  [
    { id: 'demo-transaction-2', dayOfMonth: 4, amount: 300, description: 'Reposição de estoque', category: 'Estoque' },
    { id: 'demo-transaction-previous-expense-2', dayOfMonth: 14, amount: 175, description: 'Energia e água', category: 'Infraestrutura' },
    { id: 'demo-transaction-previous-expense-3', dayOfMonth: 24, amount: 200, description: 'Marketing local', category: 'Marketing' },
  ].forEach((expense) => {
    transactions.push({
      id: expense.id,
      tenant_id: DEMO_TENANT_ID,
      user_id: DEMO_USER_ID,
      type: 'expense',
      amount: expense.amount,
      date: spTimestamp(now, -1, expense.dayOfMonth, 9, 0),
      description: expense.description,
      category: expense.category,
      status: 'paid',
      payment_method: 'PIX',
    });
  });

  return {
    clients,
    staff: [
      { id: STAFF_MARCOS, tenant_id: DEMO_TENANT_ID, name: 'Marcos Demo', role: 'Barber', status: 'active', commission_rate: 40 },
      { id: STAFF_JULIA, tenant_id: DEMO_TENANT_ID, name: 'Julia Demo', role: 'Manager', status: 'active', commission_rate: 30 },
    ],
    services: [
      {
        id: SERVICES.corte.id,
        tenant_id: DEMO_TENANT_ID,
        name: 'Corte masculino',
        commercial_name: SERVICES.corte.name,
        description: 'Corte de assinatura com consultoria de estilo e finalização premium.',
        category: 'Corte',
        duration: SERVICES.corte.duration,
        price: SERVICES.corte.price,
        active: true,
      },
      {
        id: SERVICES.barba.id,
        tenant_id: DEMO_TENANT_ID,
        name: 'Barba',
        commercial_name: SERVICES.barba.name,
        description: 'Toalha quente, desenho de barba e acabamento de alto padrão.',
        category: 'Barba',
        duration: SERVICES.barba.duration,
        price: SERVICES.barba.price,
        active: true,
      },
      {
        id: SERVICES.combo.id,
        tenant_id: DEMO_TENANT_ID,
        name: 'Combo corte + barba',
        commercial_name: SERVICES.combo.name,
        description: 'Corte, barba e finalização em uma única sessão.',
        category: 'Combo',
        duration: SERVICES.combo.duration,
        price: SERVICES.combo.price,
        active: true,
      },
    ],
    appointments: [...appointments, ...pastAppointments],
    products: [
      {
        id: 'demo-product-1',
        tenant_id: DEMO_TENANT_ID,
        name: PRODUCT_POMADA.name,
        commercial_name: PRODUCT_POMADA.name,
        description: 'Fixação média para acabamento e finalização.',
        cost_price: 18,
        sale_price: PRODUCT_POMADA.price,
        stock_quantity: 24,
        minimum_stock: 8,
        auto_generate_purchase_order: false,
        active: true,
      },
      {
        id: 'demo-product-2',
        tenant_id: DEMO_TENANT_ID,
        name: 'Óleo para barba',
        commercial_name: 'Óleo Barber Care',
        description: 'Hidratação e brilho para barba.',
        cost_price: 12,
        sale_price: 29,
        stock_quantity: 16,
        minimum_stock: 6,
        auto_generate_purchase_order: false,
        active: true,
      },
    ],
    promotions: [
      { id: 'demo-promo-1', tenant_id: DEMO_TENANT_ID, title: 'Combo Executivo de Terça', end_date: spTimestamp(now, 1, 28, 0, 0).slice(0, 10), active: true },
      { id: 'demo-promo-2', tenant_id: DEMO_TENANT_ID, title: 'Indique e ganhe 20%', end_date: spTimestamp(now, 2, 15, 0, 0).slice(0, 10), active: true },
    ],
    transactions,
    comandas,
    comanda_items: comandaItems,
    service_execution_participants: participants,
  };
};
