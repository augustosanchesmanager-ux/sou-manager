import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getScopedClient, getClientForTable } from '../../services/supabaseClient';
import { useAuth } from '../../context/AuthContext';
import type {
  BusinessPeriod,
  BusinessInsightsFilters,
  BusinessInsightsData,
  FinancialKPIs,
  ClientKPIs,
  OperationalKPIs,
  TopService,
  TopProfessional,
  TopClient,
  RevenueByMethod,
  RevenueEvolutionPoint,
} from '../types/business-insights';

const getPeriodDates = (period: BusinessPeriod): { from: Date; to: Date; prevFrom: Date; prevTo: Date } => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let from: Date;
  let duration: number;

  switch (period) {
    case 'today':
      from = today;
      duration = 1;
      break;
    case '7d':
      from = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      duration = 7;
      break;
    case '30d':
      from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      duration = 30;
      break;
    case '90d':
      from = new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000);
      duration = 90;
      break;
    default:
      from = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      duration = 30;
  }

  return {
    from,
    to: now,
    prevFrom: new Date(from.getTime() - duration * 24 * 60 * 60 * 1000),
    prevTo: from,
  };
};

const diffDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / 86400000);

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const APP_SLUG_FOR_BI = 'barber' as const;

export const useBusinessInsights = (filters: BusinessInsightsFilters) => {
  const { tenantId } = useAuth();
  const barberSupabase = getScopedClient('barber');

  const [data, setData] = useState<BusinessInsightsData>({
    loading: true,
    error: null,
    period: filters.period,
    financial: {
      revenue: 0,
      revenuePrevious: 0,
      revenueGrowth: 0,
      expenses: 0,
      profit: 0,
      profitMargin: 0,
      avgTicket: 0,
      avgTicketPrevious: 0,
      avgTicketGrowth: 0,
    },
    clients: {
      newClients: 0,
      newClientsPrevious: 0,
      newClientsGrowth: 0,
      returningClients: 0,
      retentionRate: 0,
      avgFrequencyDays: 0,
      inactiveClients: 0,
      inactiveClients60Days: 0,
    },
    operations: {
      totalAppointments: 0,
      completedAppointments: 0,
      cancelledAppointments: 0,
      noShowAppointments: 0,
      completedRate: 0,
      cancelledRate: 0,
      noShowRate: 0,
    },
    analytics: {
      topServices: [],
      topProfessionals: [],
      topClients: [],
      revenueByMethod: [],
      revenueEvolution: [],
    },
    insights: [],
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { from, to, prevFrom, prevTo } = getPeriodDates(filters.period);

      const transactionsClient = getClientForTable('transactions', APP_SLUG_FOR_BI);
      const appointmentsClient = getClientForTable('appointments', APP_SLUG_FOR_BI);
      const clientsClient = getClientForTable('clients', APP_SLUG_FOR_BI);
      const productsClient = getClientForTable('products', APP_SLUG_FOR_BI);
      const comandaItemsClient = getClientForTable('comanda_items', APP_SLUG_FOR_BI);
      const comandasClient = getClientForTable('comandas', APP_SLUG_FOR_BI);

      const [
        transactionsRes,
        appointmentsRes,
        clientsRes,
        staffRes,
        productsRes,
        comandaItemsRes,
        comandasRes,
      ] = await Promise.all([
        transactionsClient
          .from('transactions')
          .select('id, amount, date, type, payment_method')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: true }),
        appointmentsClient
          .from('appointments')
          .select('id, status, start_time, client_id, staff_id, staff_name, service_name')
          .eq('tenant_id', tenantId)
          .order('start_time', { ascending: false }),
        clientsClient
          .from('clients')
          .select('id, name, created_at, last_visit, total_spent')
          .eq('tenant_id', tenantId)
          .order('name'),
        supabase
          .from('staff')
          .select('id, name, avatar')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        productsClient
          .from('products')
          .select('id, name, stock_quantity, minimum_stock')
          .eq('tenant_id', tenantId),
        comandaItemsClient
          .from('comanda_items')
          .select('id, product_id, service_id, product_name, quantity, unit_price, comanda_id')
          .eq('tenant_id', tenantId),
        comandasClient
          .from('comandas')
          .select('id, total, staff_id, client_id, status, created_at')
          .eq('tenant_id', tenantId)
          .eq('status', 'paid'),
      ]);

      const transactions = transactionsRes.error ? [] : (transactionsRes.data || []);
      const appointments = appointmentsRes.error ? [] : (appointmentsRes.data || []);
      const clients = clientsRes.error ? [] : (clientsRes.data || []);
      const staff = staffRes.error ? [] : (staffRes.data || []);
      const products = productsRes.error ? [] : (productsRes.data || []);
      const comandaItems = comandaItemsRes.error ? [] : (comandaItemsRes.data || []);
      const comandas = comandasRes.error ? [] : (comandasRes.data || []);

      // Funções normais para filtrar (não useMemo dentro de useCallback)
      const filteredTransactions = transactions.filter((t: any) => {
        const d = new Date(t.date);
        return d >= from && d <= to;
      });

      const prevTransactions = transactions.filter((t: any) => {
        const d = new Date(t.date);
        return d >= prevFrom && d < prevTo;
      });

      const filteredAppointments = appointments.filter((a: any) => {
        const d = new Date(a.start_time);
        return d >= from && d <= to;
      });

      const prevAppointments = appointments.filter((a: any) => {
        const d = new Date(a.start_time);
        return d >= prevFrom && d < prevTo;
      });

      // Financial KPIs
      const income = filteredTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      const expenses = filteredTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      const prevIncome = prevTransactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
      const prevExpenses = prevTransactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

      const profit = income - expenses;
      const profitMargin = income > 0 ? (profit / income) * 100 : 0;
      const revenueGrowth = prevIncome > 0 ? ((income - prevIncome) / prevIncome) * 100 : 0;

      const incomeCount = filteredTransactions.filter((t: any) => t.type === 'income').length;
      const avgTicket = incomeCount > 0 ? income / incomeCount : 0;
      const prevIncomeCount = prevTransactions.filter((t: any) => t.type === 'income').length;
      const prevAvgTicket = prevIncomeCount > 0 ? prevIncome / prevIncomeCount : 0;
      const avgTicketGrowth = prevAvgTicket > 0 ? ((avgTicket - prevAvgTicket) / prevAvgTicket) * 100 : 0;

      const financial: FinancialKPIs = {
        revenue: income,
        revenuePrevious: prevIncome,
        revenueGrowth,
        expenses,
        profit,
        profitMargin,
        avgTicket,
        avgTicketPrevious: prevAvgTicket,
        avgTicketGrowth,
      };

      // Client KPIs
      const newClients = clients.filter((c: any) => {
        const d = new Date(c.created_at);
        return d >= from && d <= to;
      }).length;

      const prevNewClients = clients.filter((c: any) => {
        const d = new Date(c.created_at);
        return d >= prevFrom && d < prevTo;
      }).length;

      const prevVisitorIds = new Set(
        prevAppointments
          .filter((a: any) => a.status !== 'cancelled' && !a.hidden_from_schedule)
          .map((a: any) => a.client_id)
          .filter(Boolean)
      );

      const currentVisitorIds = new Set(
        filteredAppointments
          .filter((a: any) => a.status !== 'cancelled' && !a.hidden_from_schedule)
          .map((a: any) => a.client_id)
          .filter(Boolean)
      );

      let returning = 0;
      prevVisitorIds.forEach((id) => {
        if (currentVisitorIds.has(id)) returning++;
      });

      const retentionRate = prevVisitorIds.size > 0 ? (returning / prevVisitorIds.size) * 100 : 0;
      const newClientsGrowth = prevNewClients > 0 ? ((newClients - prevNewClients) / prevNewClients) * 100 : 0;

      const inactiveClients60Days = clients.filter((c: any) => {
        if (!c.last_visit) return true;
        return diffDays(to, new Date(c.last_visit)) > 60;
      }).length;

      const clientVisits: Record<string, Date[]> = {};
      appointments
        .filter((a: any) => a.status !== 'cancelled' && !a.hidden_from_schedule && a.client_id)
        .forEach((a: any) => {
          if (!clientVisits[a.client_id]) clientVisits[a.client_id] = [];
          clientVisits[a.client_id].push(new Date(a.start_time));
        });

      let totalGaps = 0;
      let gapCount = 0;
      Object.values(clientVisits).forEach((visits) => {
        visits.sort((a, b) => a.getTime() - b.getTime());
        for (let i = 1; i < visits.length; i++) {
          totalGaps += diffDays(visits[i], visits[i - 1]);
          gapCount++;
        }
      });
      const avgFrequencyDays = gapCount > 0 ? totalGaps / gapCount : 0;

      const clientsKPIs: ClientKPIs = {
        newClients,
        newClientsPrevious: prevNewClients,
        newClientsGrowth,
        returningClients: returning,
        retentionRate,
        avgFrequencyDays,
        inactiveClients: clients.length - currentVisitorIds.size,
        inactiveClients60Days,
      };

      // Operational KPIs
      const totalAppts = filteredAppointments.length;
      const completedAppts = filteredAppointments.filter((a: any) => a.status === 'completed').length;
      const cancelledAppts = filteredAppointments.filter((a: any) => a.status === 'cancelled').length;
      const noShowAppts = filteredAppointments.filter((a: any) => a.status === 'no_show' || a.status === 'no-show').length;

      const operations: OperationalKPIs = {
        totalAppointments: totalAppts,
        completedAppointments: completedAppts,
        cancelledAppointments: cancelledAppts,
        noShowAppointments: noShowAppts,
        completedRate: totalAppts > 0 ? (completedAppts / totalAppts) * 100 : 0,
        cancelledRate: totalAppts > 0 ? (cancelledAppts / totalAppts) * 100 : 0,
        noShowRate: totalAppts > 0 ? (noShowAppts / totalAppts) * 100 : 0,
      };

      // Analytics
      const serviceMap: Record<string, TopService> = {};
      filteredAppointments
        .filter((a: any) => a.service_name && a.status !== 'cancelled' && !a.hidden_from_schedule)
        .forEach((a: any) => {
          if (!serviceMap[a.service_name]) {
            serviceMap[a.service_name] = { name: a.service_name, count: 0, revenue: 0 };
          }
          serviceMap[a.service_name].count++;
        });

      const topServices = Object.values(serviceMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      const staffMap: Record<string, TopProfessional> = {};
      staff.forEach((s: any) => {
        staffMap[s.id] = { id: s.id, name: s.name, revenue: 0, appointments: 0, avgTicket: 0 };
      });

      const staffAppointments: Record<string, number> = {};
      filteredAppointments
        .filter((a: any) => a.status === 'completed' && a.staff_id)
        .forEach((a: any) => {
          if (!staffAppointments[a.staff_id]) staffAppointments[a.staff_id] = 0;
          staffAppointments[a.staff_id]++;
        });

      comandas
        .filter((cmd: any) => {
          const d = new Date(cmd.created_at);
          return d >= from && d <= to;
        })
        .forEach((cmd: any) => {
          if (staffMap[cmd.staff_id]) {
            staffMap[cmd.staff_id].revenue += Number(cmd.total) || 0;
          }
        });

      Object.keys(staffMap).forEach((id) => {
        const s = staffMap[id];
        s.appointments = staffAppointments[id] || 0;
        s.avgTicket = s.appointments > 0 ? s.revenue / s.appointments : 0;
      });

      const topProfessionals = Object.values(staffMap)
        .filter(s => s.appointments > 0)
        .sort((a, b) => b.revenue - a.revenue);

      const spendMap: Record<string, number> = {};
      const visitCountMap: Record<string, number> = {};
      comandas.forEach((cmd: any) => {
        if (cmd.client_id) {
          spendMap[cmd.client_id] = (spendMap[cmd.client_id] || 0) + (Number(cmd.total) || 0);
          visitCountMap[cmd.client_id] = (visitCountMap[cmd.client_id] || 0) + 1;
        }
      });

      const topClients = clients
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          ltv: spendMap[c.id] || Number(c.total_spent) || 0,
          totalVisits: visitCountMap[c.id] || 0,
        }))
        .sort((a, b) => b.ltv - a.ltv)
        .slice(0, 5);

      const methodMap: Record<string, number> = {};
      filteredTransactions
        .filter((t: any) => t.type === 'income')
        .forEach((t: any) => {
          const m = t.payment_method || 'Outros';
          methodMap[m] = (methodMap[m] || 0) + (Number(t.amount) || 0);
        });
      const revenueByMethod: RevenueByMethod[] = Object.entries(methodMap).map(([method, value]) => ({
        method,
        value,
      }));

      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const now = new Date();
      const revenueEvolutionMap: Record<string, { income: number; expense: number }> = {};
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        revenueEvolutionMap[months[d.getMonth()]] = { income: 0, expense: 0 };
      }

      transactions.forEach((t: any) => {
        const d = new Date(t.date);
        const key = months[d.getMonth()];
        if (revenueEvolutionMap[key]) {
          if (t.type === 'income') revenueEvolutionMap[key].income += Number(t.amount) || 0;
          else revenueEvolutionMap[key].expense += Number(t.amount) || 0;
        }
      });

      const revenueEvolution: RevenueEvolutionPoint[] = Object.entries(revenueEvolutionMap).map(
        ([month, data]) => ({
          month,
          income: data.income,
          expense: data.expense,
        })
      );

      const lowStockProducts = products.filter((p: any) =>
        p.minimum_stock && p.stock_quantity <= p.minimum_stock
      );

      const insights: string[] = [];
      if (revenueGrowth > 0) insights.push(`Faturamento cresceu ${revenueGrowth.toFixed(1)}% vs período anterior`);
      else if (revenueGrowth < 0) insights.push(`Faturamento caiu ${Math.abs(revenueGrowth).toFixed(1)}% vs período anterior`);
      if (inactiveClients60Days > 0) insights.push(`${inactiveClients60Days} cliente(s) inativo(s) há +60 dias`);
      if (topServices[0]) insights.push(`Serviço mais popular: "${topServices[0].name}" (${topServices[0].count} atendimentos)`);
      if (operations.noShowRate > 10) insights.push(`Taxa de falta (${operations.noShowRate.toFixed(1)}%) acima do recomendado (10%)`);
      if (operations.cancelledRate > 15) insights.push(`Taxa de cancelamento alta (${operations.cancelledRate.toFixed(1)}%)`);
      if (retentionRate > 0 && retentionRate < 40) insights.push(`Retenção em ${retentionRate.toFixed(0)}%. Promoções podem ajudar!`);
      if (lowStockProducts.length > 0) insights.push(`${lowStockProducts.length} produto(s) com estoque crítico`);
      if (profitMargin < 30 && income > 0) insights.push(`Margem de lucro ${profitMargin.toFixed(1)}% abaixo do ideal (30%+)`);

      setData({
        loading: false,
        error: null,
        period: filters.period,
        financial,
        clients: clientsKPIs,
        operations,
        analytics: {
          topServices,
          topProfessionals,
          topClients,
          revenueByMethod,
          revenueEvolution,
        },
        insights,
      });
    } catch (error: any) {
      console.error('Erro ao buscar dados do BI:', error);
      setData(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }, [tenantId, filters.period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, reload: fetchData };
};