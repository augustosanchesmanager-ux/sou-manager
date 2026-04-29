import type {
  DashboardAppointment,
  DashboardChartPoint,
  DashboardClient,
  DashboardData,
  DashboardMetrics,
  DashboardService,
  DashboardStaff,
  ReturningClient,
  RiskClient,
  SmartReturnCategory,
  SmartReturnClient,
  UpcomingBirthday,
  UpcomingBirthdayStatus,
} from './types';

export const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  revenue: 0,
  revenuePrevious: 0,
  revenueGrowth: 0,
  revenueGoal: 0,
  activeStaffPercent: 0,
  todayAppointments: 0,
  previousAppointments: 0,
  appointmentsGrowth: 0,
  appointmentsGoal: 0,
  avgTicket: 0,
  avgTicketPrevious: 0,
  avgTicketGrowth: 0,
  retentionRate: 0,
};

export const EMPTY_DASHBOARD_DATA: DashboardData = {
  clients: [],
  staffList: [],
  servicesList: [],
  appointments: [],
  upcomingBirthdays: [],
  returningClients: [],
  chartData: [],
  metrics: EMPTY_DASHBOARD_METRICS,
  profile: null,
};

const toNumber = (value: unknown): number => Number(value ?? 0) || 0;

export const normalizeServiceRecord = (record: any): DashboardService => ({
  id: record.id,
  name: record.name,
  duration: toNumber(record.duration ?? record.duration_minutes) || 30,
  duration_minutes: toNumber(record.duration_minutes) || undefined,
  price: toNumber(record.price),
});

export const normalizeAppointmentRecord = (record: any): DashboardAppointment => ({
  id: record.id,
  client_name: record.client_name || record.clients?.name || '',
  client_phone: record.client_phone || record.clients?.phone || null,
  service_name: record.service_name || '',
  staff_name: record.staff_name || '',
  start_time: record.start_time,
  status: record.status || 'pending',
});

export const buildUpcomingBirthdays = (clients: DashboardClient[]): UpcomingBirthday[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return clients
    .filter((client) => Boolean(client.birthday))
    .map((client) => {
      const birthdayValue = client.birthday || '';
      const birthdayDate = new Date(`${birthdayValue}T00:00:00`);
      const nextBirthday = new Date(today.getFullYear(), birthdayDate.getMonth(), birthdayDate.getDate());

      if (nextBirthday < today) {
        nextBirthday.setFullYear(today.getFullYear() + 1);
      }

      const diffTime = Math.abs(nextBirthday.getTime() - today.getTime());
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let lastVisitText = 'Sem registro';
      if (client.last_visit) {
        const lastVisitDate = new Date(client.last_visit);
        const diffVisit = Math.floor((today.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24));
        lastVisitText = diffVisit === 0 ? 'Hoje' : diffVisit === 1 ? 'Ontem' : `${diffVisit} Dias atras`;
      }

      return {
        ...client,
        displayDate: birthdayDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', ''),
        daysUntil,
        lastVisitText,
        status: (daysUntil <= 7 ? 'due_soon' : daysUntil <= 30 ? 'visited_recently' : 'overdue') as UpcomingBirthdayStatus,
      };
    })
    .sort((first, second) => first.daysUntil - second.daysUntil)
    .slice(0, 5);
};

export const buildRevenueChartData = (transactions: any[]): DashboardChartPoint[] => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const grouped: Record<string, number> = {};

  transactions.forEach((transaction) => {
    const transactionDate = new Date(transaction.date);
    if (transactionDate >= startOfThisMonth && transactionDate < startOfNextMonth) {
      const label = transactionDate.getDate().toString();
      grouped[label] = (grouped[label] || 0) + toNumber(transaction.amount || transaction.val);
    }
  });

  const points: DashboardChartPoint[] = [];
  for (let day = 1; day <= 30; day += 5) {
    points.push({ name: day.toString(), value: grouped[day.toString()] || 0 });
  }

  return points;
};

export const buildDashboardMetrics = (
  transactions: any[],
  staffList: DashboardStaff[],
  todayAppointmentsByStaff: Array<{ staff_id?: string | null }>,
  todayAppointmentsCount: number,
  yesterdayTransactions: any[],
  yesterdayAppointmentsCount: number,
  last30daysAppointments: any[],
  last60to90daysAppointments: any[],
  revenueGoal: number = 0,
  appointmentsGoal: number = 0,
): DashboardMetrics => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let thisMonthRevenue = 0;
  let lastMonthRevenue = 0;
  let thisMonthIncomeCount = 0;

  transactions.forEach((transaction) => {
    const transactionDate = new Date(transaction.date);
    const amount = toNumber(transaction.amount || transaction.val);

    if (transactionDate >= startOfThisMonth && transactionDate < startOfNextMonth) {
      thisMonthRevenue += amount;
      thisMonthIncomeCount += 1;
      return;
    }

    if (transactionDate >= startOfLastMonth && transactionDate < startOfThisMonth) {
      lastMonthRevenue += amount;
    }
  });

  let yesterdayRevenue = 0;
  let yesterdayIncomeCount = 0;
  yesterdayTransactions.forEach((transaction) => {
    const amount = toNumber(transaction.amount || transaction.val);
    yesterdayRevenue += amount;
    yesterdayIncomeCount += 1;
  });

  const activeIds = new Set(todayAppointmentsByStaff.map((appointment) => appointment.staff_id).filter(Boolean));
  const activeStaffPercent = staffList.length > 0 ? (activeIds.size / staffList.length) * 100 : 0;

  const revenueGrowth = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0;
  const appointmentsGrowth = yesterdayAppointmentsCount > 0 ? ((todayAppointmentsCount - yesterdayAppointmentsCount) / yesterdayAppointmentsCount) * 100 : 0;
  const yesterdayAvgTicket = yesterdayIncomeCount > 0 ? yesterdayRevenue / yesterdayIncomeCount : 0;
  const avgTicketGrowth = yesterdayAvgTicket > 0 ? ((thisMonthIncomeCount > 0 ? thisMonthRevenue / thisMonthIncomeCount : 0) - yesterdayAvgTicket) / yesterdayAvgTicket * 100 : 0;

  const prevVisitorIds = new Set(
    last60to90daysAppointments
      .filter((a: any) => !['cancelled', 'canceled'].includes(a.status))
      .map((a: any) => a.client_id)
      .filter(Boolean)
  );

  const currentVisitorIds = new Set(
    last30daysAppointments
      .filter((a: any) => !['cancelled', 'canceled'].includes(a.status))
      .map((a: any) => a.client_id)
      .filter(Boolean)
  );

  let returning = 0;
  prevVisitorIds.forEach((id) => {
    if (currentVisitorIds.has(id)) returning++;
  });
  const retentionRate = prevVisitorIds.size > 0 ? (returning / prevVisitorIds.size) * 100 : 0;

  return {
    revenue: thisMonthRevenue,
    revenuePrevious: yesterdayRevenue,
    revenueGrowth,
    revenueGoal,
    avgTicket: thisMonthIncomeCount > 0 ? thisMonthRevenue / thisMonthIncomeCount : 0,
    avgTicketPrevious: yesterdayAvgTicket,
    avgTicketGrowth,
    activeStaffPercent,
    todayAppointments: todayAppointmentsCount || 0,
    previousAppointments: yesterdayAppointmentsCount,
    appointmentsGrowth,
    appointmentsGoal,
    retentionRate,
  };
};

export const buildRiskClients = (clients: DashboardClient[], minimumDays = 18): RiskClient[] => {
  const today = new Date();

  return clients
    .filter((client) => Boolean(client.last_visit))
    .map((client) => ({
      ...client,
      days: Math.floor((today.getTime() - new Date(client.last_visit as string).getTime()) / 86400000),
    }))
    .filter((client) => client.days >= minimumDays)
    .sort((first, second) => second.days - first.days);
};

export interface BuildReturningClientsParams {
  clients: DashboardClient[];
  appointments: any[];
  upcomingClientIds: Set<string>;
}

export interface BuildSmartReturnClientsParams {
  clients: DashboardClient[];
  appointments: any[];
  upcomingClientIds: Set<string>;
}

export const buildSmartReturnClients = ({
  clients,
  appointments,
  upcomingClientIds,
}: BuildSmartReturnClientsParams): SmartReturnClient[] => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

  const clientLastVisitMap: Record<string, { lastVisit: Date; name: string; phone?: string | null }> = {};

  appointments.forEach((apt: any) => {
    if (!apt.client_id) return;
    const aptDate = new Date(apt.start_time);
    if (!clientLastVisitMap[apt.client_id] || aptDate > clientLastVisitMap[apt.client_id].lastVisit) {
      const clientInfo = clients.find((c) => c.id === apt.client_id);
      clientLastVisitMap[apt.client_id] = {
        lastVisit: aptDate,
        name: clientInfo?.name || apt.client_name || 'Cliente',
        phone: clientInfo?.phone || null,
      };
    }
  });

  const result: SmartReturnClient[] = [];

  Object.entries(clientLastVisitMap).forEach(([clientId, info]) => {
    if (upcomingClientIds.has(clientId)) return;
    const daysSince = Math.floor((now.getTime() - info.lastVisit.getTime()) / 86400000);

    let category: SmartReturnCategory;
    if (info.lastVisit >= sixtyDaysAgo && info.lastVisit < thirtyDaysAgo) {
      category = 'returning';
    } else if (info.lastVisit >= ninetyDaysAgo && info.lastVisit < sixtyDaysAgo) {
      category = 'risk';
    } else if (info.lastVisit < ninetyDaysAgo) {
      category = 'inactive';
    } else {
      return;
    }

    result.push({
      id: clientId,
      name: info.name,
      phone: info.phone ?? '',
      lastVisit: info.lastVisit.toISOString(),
      daysSinceVisit: daysSince,
      category,
      hasUpcomingAppointment: upcomingClientIds.has(clientId),
    });
  });

  return result.sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
};

export const buildReturningClients = ({
  clients,
  appointments,
  upcomingClientIds,
}: BuildReturningClientsParams): ReturningClient[] => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86400000);

  const clientLastVisitMap: Record<string, { lastVisit: Date; name: string; phone?: string | null }> = {};

  appointments.forEach((apt: any) => {
    if (!apt.client_id) return;
    const aptDate = new Date(apt.start_time);
    if (!clientLastVisitMap[apt.client_id] || aptDate > clientLastVisitMap[apt.client_id].lastVisit) {
      const clientInfo = clients.find((c) => c.id === apt.client_id);
      clientLastVisitMap[apt.client_id] = {
        lastVisit: aptDate,
        name: clientInfo?.name || apt.client_name || 'Cliente',
        phone: clientInfo?.phone || null,
      };
    }
  });

  const returning: ReturningClient[] = [];

  Object.entries(clientLastVisitMap).forEach(([clientId, info]) => {
    if (upcomingClientIds.has(clientId)) return;
    const daysSince = Math.floor((now.getTime() - info.lastVisit.getTime()) / 86400000);
    if (info.lastVisit >= sixtyDaysAgo && info.lastVisit < thirtyDaysAgo) {
      returning.push({
        id: clientId,
        name: info.name,
        phone: info.phone,
        lastVisit: info.lastVisit.toISOString(),
        daysSinceVisit: daysSince,
      });
    }
  });

  return returning
    .sort((a, b) => new Date(a.lastVisit).getTime() - new Date(b.lastVisit).getTime())
    .slice(0, 5);
};

export const formatAppointmentTime = (isoString: string): string => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

