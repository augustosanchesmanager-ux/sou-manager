import { supabase, getClientForTable } from '../../../services/supabaseClient';
import { businessDateInTimeZone } from '../../../shared/dates/timezone';

export interface BiCockpitMetrics {
  grossRevenue: number;
  netRevenue: number;
  totalExpenses: number;
  netProfitMargin: number;
  averageTicket: number;
  totalAppointments: number;
  occupancyRate: number;
  growthVsPrev: number;
}

export interface BiTimelinePoint {
  label: string;
  date: string;
  grossRevenue: number;
  netRevenue: number;
  expenses: number;
}

export interface BiRevenueCompositionSlice {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface BiGoalProgress {
  metric: string;
  target: number;
  current: number;
  percentage: number;
  projectedMonthEnd: number;
  unit: 'currency' | 'count';
  status: 'on_track' | 'at_risk' | 'behind';
}

export interface BiStaffRadarPoint {
  subject: string;
  fullMark: number;
  [staffKey: string]: number | string;
}

export interface BiStaffRadarProfile {
  id: string;
  name: string;
  color: string;
}

export interface BiCockpitData {
  metrics: BiCockpitMetrics;
  timeline: BiTimelinePoint[];
  composition: BiRevenueCompositionSlice[];
  goals: BiGoalProgress[];
  radar: {
    points: BiStaffRadarPoint[];
    staffProfiles: BiStaffRadarProfile[];
  };
}

export type BiPeriod = 'today' | '7d' | '30d' | '90d';

interface BiTransactionRow {
  id?: string;
  amount: number | string | null;
  date?: string | null;
  type: string | null;
  category?: string | null;
  payment_method?: string | null;
}

interface BiAppointmentRow {
  id: string;
  start_time: string;
  staff_id: string | null;
  staff_name?: string | null;
  price: number | string | null;
  status: string | null;
  service_name?: string | null;
  client_id?: string | null;
}

interface BiComandaItemRow {
  id: string;
  product_id: string | null;
  service_id: string | null;
  product_name?: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  comanda_id: string | null;
  staff_id?: string | null;
  created_at?: string | null;
}

interface BiComandaRow {
  id: string;
  total: number | string | null;
  staff_id?: string | null;
  client_id?: string | null;
  status: string | null;
  created_at?: string | null;
}

interface BiStaffRow {
  id: string;
  name: string;
  status: string | null;
  role?: string | null;
}

interface BiSubscriptionRow {
  id: string;
  plan_id: string;
  status: string | null;
  created_at?: string | null;
}

interface BiPlanRow {
  id: string;
  name: string;
  monthly_price: number | string | null;
}

interface BiStaffStats {
  count: number;
  revenue: number;
  ticket: number;
  completionRate: number;
  productSales: number;
}

type BiStaffStatKey = keyof BiStaffStats;

export function getBiDateRange(period: BiPeriod, baseDate: Date = new Date()): { from: Date; to: Date; prevFrom: Date; prevTo: Date } {
  const to = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 23, 59, 59, 999);
  let from = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);

  if (period === 'today') {
    from = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate(), 0, 0, 0, 0);
  } else if (period === '7d') {
    from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);
  } else if (period === '30d') {
    from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
  } else if (period === '90d') {
    from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000 + 1);
  }

  const durationMs = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - durationMs);

  return { from, to, prevFrom, prevTo };
}

export async function fetchBiCockpitData(tenantId: string, period: BiPeriod = '30d'): Promise<BiCockpitData> {
  const { from, to, prevFrom, prevTo } = getBiDateRange(period);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const prevFromIso = prevFrom.toISOString();
  const prevToIso = prevTo.toISOString();

  const transactionsClient = getClientForTable('transactions', 'barber');
  const appointmentsClient = getClientForTable('appointments', 'barber');
  const comandaItemsClient = getClientForTable('comanda_items', 'barber');
  const comandasClient = getClientForTable('comandas', 'barber');

  // 1. Buscar simultaneamente todas as fontes de dados necessárias
  const [
    transactionsRes,
    prevTransactionsRes,
    appointmentsRes,
    comandaItemsRes,
    comandasRes,
    staffRes,
    goalsRes,
    subscriptionsRes,
    plansRes,
  ] = await Promise.all([
    transactionsClient
      .from('transactions')
      .select('id, amount, date, type, category, payment_method')
      .eq('tenant_id', tenantId)
      .gte('date', fromIso.split('T')[0])
      .lte('date', toIso.split('T')[0])
      .order('date', { ascending: true }),

    transactionsClient
      .from('transactions')
      .select('amount, type')
      .eq('tenant_id', tenantId)
      .gte('date', prevFromIso.split('T')[0])
      .lte('date', prevToIso.split('T')[0]),

    appointmentsClient
      .from('appointments')
      .select('id, start_time, staff_id, staff_name, price, status, service_name, client_id')
      .eq('tenant_id', tenantId)
      .gte('start_time', fromIso)
      .lte('start_time', toIso),

    comandaItemsClient
      .from('comanda_items')
      .select('id, product_id, service_id, product_name, quantity, unit_price, comanda_id, created_at')
      .eq('tenant_id', tenantId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    comandasClient
      .from('comandas')
      .select('id, total, staff_id, client_id, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'paid')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    supabase
      .from('staff')
      .select('id, name, status, role')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),

    supabase
      .from('tenant_goals')
      .select('revenue_goal, appointments_goal, clients_goal, period')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .maybeSingle(),

    supabase
      .from('customer_subscriptions')
      .select('id, plan_id, status, created_at')
      .eq('tenant_id', tenantId)
      .eq('status', 'active'),

    supabase
      .from('customer_plans')
      .select('id, name, monthly_price')
      .eq('tenant_id', tenantId)
      .eq('active', true),
  ]);

  const transactions = (transactionsRes.data as BiTransactionRow[] | null) || [];
  const prevTransactions = (prevTransactionsRes.data as BiTransactionRow[] | null) || [];
  const appointments = (appointmentsRes.data as BiAppointmentRow[] | null) || [];
  const comandaItems = (comandaItemsRes.data as BiComandaItemRow[] | null) || [];
  const comandas = (comandasRes.data as BiComandaRow[] | null) || [];
  const staffList = (staffRes.data as BiStaffRow[] | null) || [];
  const activeSubs = (subscriptionsRes.data as BiSubscriptionRow[] | null) || [];
  const plans = (plansRes.data as BiPlanRow[] | null) || [];

  // Plan map para cálculo de receita de assinaturas
  const planMap = new Map<string, number>(plans.map((p) => [p.id, Number(p.monthly_price) || 0]));
  const monthlyClubRevenue = activeSubs.reduce((sum, s) => sum + (planMap.get(s.plan_id) || 0), 0);

  // 2. Faturamento Bruto e Despesas
  let incomeFromTx = 0;
  let expensesTotal = 0;
  transactions.forEach((t) => {
    const amt = Math.abs(Number(t.amount) || 0);
    if (t.type === 'income') incomeFromTx += amt;
    else if (t.type === 'expense') expensesTotal += amt;
  });

  const comandasGross = comandas.reduce((sum, c) => sum + (Number(c.total) || 0), 0);

  // Receita bruta realizada: prioriza lançamentos de caixa; usa comandas apenas se não houver transações no período
  const effectiveGross = incomeFromTx > 0 ? incomeFromTx : comandasGross;

  // Receita líquida baseada apenas em receitas e despesas reais registradas no período
  const netRevenue = Math.max(0, effectiveGross - expensesTotal);
  const netProfitMargin = effectiveGross > 0 ? (netRevenue / effectiveGross) * 100 : 0;

  // Comparativo com período anterior
  let prevIncome = 0;
  prevTransactions.forEach((t) => {
    if (t.type === 'income') prevIncome += Math.abs(Number(t.amount) || 0);
  });
  const growthVsPrev = prevIncome > 0 ? ((effectiveGross - prevIncome) / prevIncome) * 100 : 0;

  const validAppointments = appointments.filter((a) => !['cancelled', 'no_show'].includes(String(a.status).toLowerCase()));
  const totalAppointments = validAppointments.length;
  const averageTicket = totalAppointments > 0 ? effectiveGross / totalAppointments : 0;

  // Ocupação estimada: assumindo capacidade de 8 atendimentos/dia por profissional ativo
  const activeStaffCount = Math.max(1, staffList.filter((s) => s.status === 'active').length);
  const daysInPeriod = Math.max(1, Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)));
  const totalCapacity = activeStaffCount * daysInPeriod * 8;
  const occupancyRate = Math.min(100, totalCapacity > 0 ? (totalAppointments / totalCapacity) * 100 : 0);

  // 3. Composição da Receita (Serviços, Produtos, Clube dos Chefes)
  let productsRevenue = 0;
  let servicesRevenue = 0;

  comandaItems.forEach((it) => {
    const val = (Number(it.quantity) || 1) * (Number(it.unit_price) || 0);
    if (it.product_id) {
      productsRevenue += val;
    } else {
      servicesRevenue += val;
    }
  });

  // Composição estritamente baseada nos itens reais de comanda e assinaturas ativas (sem split fabricado)
  const periodClubRevenue = period === 'today'
    ? monthlyClubRevenue / 30
    : period === '7d'
      ? (monthlyClubRevenue / 30) * 7
      : monthlyClubRevenue;

  const compositionTotal = servicesRevenue + productsRevenue + periodClubRevenue || 1;
  const composition: BiRevenueCompositionSlice[] = [
    {
      name: 'Serviços de Bancada',
      value: Math.round(servicesRevenue),
      percentage: Math.round((servicesRevenue / compositionTotal) * 100),
      color: '#B88A44', // Dourado latão
    },
    {
      name: 'Produtos de Balcão',
      value: Math.round(productsRevenue),
      percentage: Math.round((productsRevenue / compositionTotal) * 100),
      color: '#D4AF37', // Ouro brilhante
    },
    {
      name: 'Club dos Chefes',
      value: Math.round(periodClubRevenue),
      percentage: Math.round((periodClubRevenue / compositionTotal) * 100),
      color: '#10B981', // Esmeralda nobre
    },
  ];

  // 4. Linha do Tempo (Timeline para Smooth Area Chart)
  const timeline: BiTimelinePoint[] = [];
  if (period === 'today') {
    const hourBuckets = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    hourBuckets.forEach((bucket, idx) => {
      const bucketAppts = validAppointments.filter((a) => {
        const h = new Date(a.start_time).getHours();
        const startH = 8 + idx * 2;
        return h >= startH && h < startH + 2;
      });
      const g = bucketAppts.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
      const exp = 0;
      const net = Math.max(0, g - exp);
      timeline.push({
        label: bucket,
        date: bucket,
        grossRevenue: g,
        netRevenue: net,
        expenses: exp,
      });
    });
  } else {
    const pointsCount = period === '7d' ? 7 : period === '30d' ? 10 : 12;
    const intervalMs = (to.getTime() - from.getTime()) / pointsCount;
    for (let i = 0; i < pointsCount; i++) {
      const pStart = new Date(from.getTime() + i * intervalMs);
      const pEnd = new Date(pStart.getTime() + intervalMs);
      const label = pStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');

      const pTxs = transactions.filter((t) => {
        if (!t.date) return false;
        const d = new Date(t.date);
        return d >= pStart && d < pEnd;
      });

      const g = pTxs
        .filter((t) => t.type === 'income')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);
      const exp = pTxs
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

      timeline.push({
        label,
        date: businessDateInTimeZone(pStart),
        grossRevenue: Math.round(g),
        netRevenue: Math.round(Math.max(0, g - exp)),
        expenses: Math.round(exp),
      });
    }
  }

  // 5. Metas do Estabelecimento (public.tenant_goals + Run-Rate)
  const goalsData = goalsRes.data;
  const targetRevenue = Number(goalsData?.revenue_goal) || 25000;
  const targetAppts = Number(goalsData?.appointments_goal) || 350;
  const targetClients = Number(goalsData?.clients_goal) || 60;

  // Run-Rate e Projeção do Fim do Mês
  const now = new Date();
  const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const currentDay = Math.max(1, now.getDate());
  const monthProgressFraction = currentDay / daysInCurrentMonth;

  const currentRevenue = effectiveGross;
  const projectedMonthRevenue = Math.round(currentRevenue / monthProgressFraction);
  const revenueGoalPct = Math.min(100, Math.round((currentRevenue / targetRevenue) * 100));

  const currentAppts = totalAppointments;
  const projectedMonthAppts = Math.round(currentAppts / monthProgressFraction);
  const apptsGoalPct = Math.min(100, Math.round((currentAppts / targetAppts) * 100));

  const currentClients = new Set(validAppointments.map((a) => a.client_id).filter(Boolean)).size;
  const projectedMonthClients = Math.round(currentClients / monthProgressFraction);
  const clientsGoalPct = Math.min(100, Math.round((currentClients / targetClients) * 100));

  const goals: BiGoalProgress[] = [
    {
      metric: 'Faturamento Líquido',
      target: targetRevenue,
      current: Math.round(currentRevenue),
      percentage: revenueGoalPct,
      projectedMonthEnd: projectedMonthRevenue,
      unit: 'currency',
      status: revenueGoalPct >= 80 ? 'on_track' : revenueGoalPct >= 50 ? 'at_risk' : 'behind',
    },
    {
      metric: 'Atendimentos Realizados',
      target: targetAppts,
      current: currentAppts,
      percentage: apptsGoalPct,
      projectedMonthEnd: projectedMonthAppts,
      unit: 'count',
      status: apptsGoalPct >= 80 ? 'on_track' : apptsGoalPct >= 50 ? 'at_risk' : 'behind',
    },
    {
      metric: 'Clientes Atendidos',
      target: targetClients,
      current: currentClients,
      percentage: clientsGoalPct,
      projectedMonthEnd: projectedMonthClients,
      unit: 'count',
      status: clientsGoalPct >= 80 ? 'on_track' : clientsGoalPct >= 50 ? 'at_risk' : 'behind',
    },
  ];

  // 6. Radar Multidimensional da Equipe (5 Eixos Comparativos)
  const activeStaff = staffList.filter((s) => s.status === 'active');
  const staffColors = ['#B88A44', '#10B981', '#EAB308', '#F97316', '#64748B'];

  const staffProfiles: BiStaffRadarProfile[] = activeStaff.slice(0, 4).map((s, idx) => ({
    id: s.id,
    name: s.name.split(' ')[0] || `Barbeiro ${idx + 1}`,
    color: staffColors[idx % staffColors.length],
  }));

  // Agregar estatísticas reais por profissional (sem fórmulas fabricadas)
  const statsByStaff: Record<string, BiStaffStats> = {};
  activeStaff.forEach((s) => {
    const sAppts = validAppointments.filter((a) => a.staff_id === s.id);
    const count = sAppts.length;
    const completedCount = sAppts.filter((a) => String(a.status).toLowerCase() === 'completed').length;
    const revenue = sAppts.reduce((sum, a) => sum + (Number(a.price) || 0), 0);
    const ticket = count > 0 ? revenue / count : 0;
    const completionRate = count > 0 ? Math.round((completedCount / count) * 100) : 0;
    const productSales = comandaItems
      .filter((it) => Boolean(it.product_id) && it.staff_id === s.id)
      .reduce((sum, it) => sum + (Number(it.quantity) || 1) * (Number(it.unit_price) || 0), 0);

    statsByStaff[s.id] = { count, revenue, ticket, completionRate, productSales };
  });

  const maxCount = Math.max(1, ...Object.values(statsByStaff).map((v) => v.count));
  const maxRevenue = Math.max(1, ...Object.values(statsByStaff).map((v) => v.revenue));
  const maxTicket = Math.max(1, ...Object.values(statsByStaff).map((v) => v.ticket));
  const maxProductSales = Math.max(1, ...Object.values(statsByStaff).map((v) => v.productSales));

  const radarAxes: Array<{ subject: string; key: BiStaffStatKey; max: number }> = [
    { subject: 'Volume', key: 'count', max: maxCount },
    { subject: 'Faturamento', key: 'revenue', max: maxRevenue },
    { subject: 'Ticket Médio', key: 'ticket', max: maxTicket },
    { subject: 'Conclusão', key: 'completionRate', max: 100 },
    { subject: 'Venda Balcão', key: 'productSales', max: maxProductSales },
  ];

  const radarPoints: BiStaffRadarPoint[] = radarAxes.map((axis) => {
    const point: BiStaffRadarPoint = {
      subject: axis.subject,
      fullMark: 100,
    };

    staffProfiles.forEach((profile) => {
      const sStat = statsByStaff[profile.id];
      if (!sStat) {
        point[profile.name] = 0;
        return;
      }
      const rawVal = sStat[axis.key] || 0;
      const normalizedScore = axis.max > 0 ? Math.min(100, Math.round((rawVal / axis.max) * 100)) : 0;
      point[profile.name] = normalizedScore;
    });

    return point;
  });

  return {
    metrics: {
      grossRevenue: Math.round(effectiveGross),
      netRevenue: Math.round(netRevenue),
      totalExpenses: Math.round(expensesTotal),
      netProfitMargin: Math.round(netProfitMargin * 10) / 10,
      averageTicket: Math.round(averageTicket * 100) / 100,
      totalAppointments,
      occupancyRate: Math.round(occupancyRate),
      growthVsPrev: Math.round(growthVsPrev * 10) / 10,
    },
    timeline,
    composition,
    goals,
    radar: {
      points: radarPoints,
      staffProfiles,
    },
  };
}
