import { useState, useEffect, useCallback } from 'react';
import { biService } from '../services/biService';
import { useAuth } from '../context/AuthContext';
import { getTodayDateKey, toLocalDateKey } from '../src/utils/dateTimezone';

export interface StrategicDashboardData {
  loading: boolean;
  error: string | null;
  
  // KPIs
  revenue: number;
  revenuePrevious: number;
  revenueGrowth: number;
  avgTicket: number;
  avgTicketPrevious: number;
  avgTicketGrowth: number;
  totalClients: number;
  newClients: number;
  returningClients: number;
  occupationRate: number;
  appointmentCount: number;
  appointmentSlots: number;
  
  // Charts
  revenueEvolution: { date: string; value: number }[];
  revenueByDay: { date: string; value: number }[];
  
  // Rankings
  topProfessionals: { id: string; name: string; appointments: number; avatar?: string }[];
  topServices: { id: string; name: string; revenue: number; count: number }[];
  
  // Club
  clubActiveSubscriptions: number;
  clubMrr: number;
  clubPending: number;
  clubOverdue: number;
  
  // Alerts
  alerts: { id: string; type: 'stock' | 'churn' | 'revenue' | 'inadimplence' | 'occupation'; message: string; priority: 'high' | 'medium' | 'low'; count?: number }[];
}

type Period = 'today' | 'week' | 'month';

const getPeriodDates = (period: Period) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (period) {
    case 'today':
      return {
        start: today.toISOString(),
        end: now.toISOString(),
        previousStart: new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        previousEnd: today.toISOString(),
      };
    case 'week': {
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      monday.setHours(0, 0, 0, 0);
      const weekDuration = 7 * 24 * 60 * 60 * 1000;
      return {
        start: monday.toISOString(),
        end: now.toISOString(),
        previousStart: new Date(monday.getTime() - weekDuration).toISOString(),
        previousEnd: monday.toISOString(),
      };
    }
    case 'month': {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthDuration = 30 * 24 * 60 * 60 * 1000;
      return {
        start: firstDay.toISOString(),
        end: now.toISOString(),
        previousStart: new Date(firstDay.getTime() - monthDuration).toISOString(),
        previousEnd: firstDay.toISOString(),
      };
    }
  }
};

export const useStrategicDashboard = (period: Period = 'month') => {
  const { tenantId } = useAuth();
  const [data, setData] = useState<StrategicDashboardData>({
    loading: true,
    error: null,
    revenue: 0,
    revenuePrevious: 0,
    revenueGrowth: 0,
    avgTicket: 0,
    avgTicketPrevious: 0,
    avgTicketGrowth: 0,
    totalClients: 0,
    newClients: 0,
    returningClients: 0,
    occupationRate: 0,
    appointmentCount: 0,
    appointmentSlots: 0,
    revenueEvolution: [],
    revenueByDay: [],
    topProfessionals: [],
    topServices: [],
    clubActiveSubscriptions: 0,
    clubMrr: 0,
    clubPending: 0,
    clubOverdue: 0,
    alerts: [],
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    
    setData(prev => ({ ...prev, loading: true }));
    
    try {
      const { start: currentStart, end: currentEnd, previousStart, previousEnd } = getPeriodDates(period);
      const now = new Date();
      const today = toLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
      
      // Fetch all data in parallel
      const {
        currentTransactions: currentTxList,
        previousTransactions: previousTxList,
        currentAppointments: allAppointments,
        clients: allClients,
        staff: activeStaff,
        products: productList,
        clubSubscriptions,
        clubPlans,
      } = await biService.fetchStrategicDashboardRaw(tenantId, {
        currentStart,
        currentEnd,
        previousStart,
        previousEnd,
      });

      // Calculate revenue
      const currentRevenue = currentTxList.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const previousRevenue = previousTxList.reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
      
      // Calculate ticket average
      const currentTxCount = currentTxList.length;
      const previousTxCount = previousTxList.length;
      const currentAvgTicket = currentTxCount > 0 ? currentRevenue / currentTxCount : 0;
      const previousAvgTicket = previousTxCount > 0 ? previousRevenue / previousTxCount : 0;
      const avgTicketGrowth = previousAvgTicket > 0 ? ((currentAvgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;
      
      // Calculate clients
      const totalClients = allClients.length;
      const newClients = allClients.filter(c => {
        const created = new Date(c.created_at);
        return created >= new Date(currentStart);
      }).length;
      const returningClients = allClients.filter(c => c.last_visit && new Date(c.last_visit) >= new Date(currentStart)).length;
      
      // Calculate appointments
      const appointmentCount = allAppointments.filter(a => !['canceled', 'cancelled'].includes(a.status)).length;
      const staffCount = activeStaff.length;
      const appointmentSlots = staffCount > 0 ? staffCount * 12 * 30 : 0;
      const occupationRate = appointmentSlots > 0 ? (appointmentCount / appointmentSlots) * 100 : 0;
      
      // Revenue evolution chart
      const revenueByDayMap: Record<string, number> = {};
      currentTxList.forEach(t => {
        const date = t.date.split('T')[0];
        revenueByDayMap[date] = (revenueByDayMap[date] || 0) + Number(t.amount || 0);
      });
      const revenueEvolution = Object.entries(revenueByDayMap)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Top professionals by completed appointments from the real agenda.
      const staffStats: Record<string, { name: string; appointments: number; avatar?: string }> = {};
      allAppointments.filter(a => a.status === 'completed').forEach(a => {
        if (!a.staff_id) return;
        if (!staffStats[a.staff_id]) {
          const staff = activeStaff.find(s => s.id === a.staff_id);
          staffStats[a.staff_id] = { 
            name: a.staff_name || 'Sem profissional', 
            appointments: 0,
            avatar: staff?.avatar ?? undefined,
          };
        }
        staffStats[a.staff_id].appointments++;
      });
      const topProfessionals = Object.entries(staffStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.appointments - a.appointments || a.name.localeCompare(b.name))
        .slice(0, 5);
      
      // Club metrics
      const planMap = new Map(clubPlans.map(p => [p.id, Number(p.monthly_price) || 0]));
      const todayStr = getTodayDateKey();
      let clubMrr = 0;
      let clubOverdue = 0;
      let clubPending = 0;
      
      clubSubscriptions.forEach(sub => {
        const price = (sub.plan_id ? planMap.get(sub.plan_id) : undefined) || 0;
        clubMrr += price;
        if (sub.next_billing_date && sub.next_billing_date < todayStr) {
          clubOverdue += price;
        } else {
          clubPending += price;
        }
      });
      
      // Generate alerts
      const alerts: StrategicDashboardData['alerts'] = [];
      
      // Stock alert
      const lowStockProducts = productList.filter(p =>
        p.minimum_stock && (p.stock_quantity ?? 0) <= p.minimum_stock
      );
      if (lowStockProducts.length > 0) {
        alerts.push({
          id: 'stock',
          type: 'stock',
          message: `${lowStockProducts.length} produto(s) com estoque baixo`,
          priority: 'medium',
          count: lowStockProducts.length,
        });
      }
      
      // Club overdue alert
      if (clubOverdue > 0) {
        alerts.push({
          id: 'inadimplence',
          type: 'inadimplence',
          message: `R$ ${clubOverdue.toFixed(2)} em mensualidades atrasadas`,
          priority: 'high',
        });
      }
      
      // Low occupation alert
      if (occupationRate < 30) {
        alerts.push({
          id: 'occupation',
          type: 'occupation',
          message: `Taxa de ocupação baixa: ${occupationRate.toFixed(0)}%`,
          priority: 'medium',
        });
      }
      
      setData({
        loading: false,
        error: null,
        revenue: currentRevenue,
        revenuePrevious: previousRevenue,
        revenueGrowth,
        avgTicket: currentAvgTicket,
        avgTicketPrevious: previousAvgTicket,
        avgTicketGrowth,
        totalClients,
        newClients,
        returningClients,
        occupationRate,
        appointmentCount,
        appointmentSlots,
        revenueEvolution,
        revenueByDay: revenueEvolution,
        topProfessionals,
        topServices: [],
        clubActiveSubscriptions: clubSubscriptions.length,
        clubMrr,
        clubPending,
        clubOverdue,
        alerts,
      });
    } catch (error: any) {
      console.error('Erro ao buscar dados do dashboard:', error);
      setData(prev => ({ ...prev, loading: false, error: error.message }));
    }
  }, [tenantId, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, reload: fetchData };
};
