import { useState, useEffect, useCallback } from 'react';
import { getScopedClient, supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

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
  revenueByDay: { day: string; value: number }[];
  
  // Rankings
  topProfessionals: { id: string; name: string; revenue: number; appointments: number; avatar?: string }[];
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
  const barberSupabase = getScopedClient('barber');
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
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0];
      
      // Fetch all data in parallel
      const [
        currentTransactions,
        previousTransactions,
        currentAppointments,
        clientsRes,
        staffRes,
        productsRes,
        clubSubsRes,
        clubPlansRes,
      ] = await Promise.all([
        // Current period transactions
        supabase
          .from('transactions')
          .select('id, amount, date')
          .eq('tenant_id', tenantId)
          .eq('type', 'income')
          .gte('date', currentStart.split('T')[0])
          .lte('date', currentEnd.split('T')[0]),
        
        // Previous period transactions
        supabase
          .from('transactions')
          .select('id, amount, date')
          .eq('tenant_id', tenantId)
          .eq('type', 'income')
          .gte('date', previousStart.split('T')[0])
          .lt('date', previousEnd.split('T')[0]),
        
        // Current appointments
        supabase
          .from('appointments')
          .select('id, status, start_time, staff_id, staff_name')
          .eq('tenant_id', tenantId)
          .gte('start_time', currentStart)
          .lte('start_time', currentEnd),
        
        // Clients
        supabase
          .from('clients')
          .select('id, created_at, last_visit')
          .eq('tenant_id', tenantId),
        
        // Staff
        supabase
          .from('staff')
          .select('id, name, avatar')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        
        // Products for alerts
        supabase
          .from('products')
          .select('id, name, stock_quantity, minimum_stock')
          .eq('tenant_id', tenantId),
        
        // Club subscriptions
        barberSupabase
          .from('customer_subscriptions')
          .select('id, status, next_billing_date, plan_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        
        // Club plans
        barberSupabase
          .from('customer_plans')
          .select('id, name, monthly_price')
          .eq('tenant_id', tenantId),
      ]);

      // Calculate revenue
      const currentRevenue = (currentTransactions.data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const previousRevenue = (previousTransactions.data || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      const revenueGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
      
      // Calculate ticket average
      const currentTxCount = (currentTransactions.data || []).length;
      const previousTxCount = (previousTransactions.data || []).length;
      const currentAvgTicket = currentTxCount > 0 ? currentRevenue / currentTxCount : 0;
      const previousAvgTicket = previousTxCount > 0 ? previousRevenue / previousTxCount : 0;
      const avgTicketGrowth = previousAvgTicket > 0 ? ((currentAvgTicket - previousAvgTicket) / previousAvgTicket) * 100 : 0;
      
      // Calculate clients
      const allClients = clientsRes.data || [];
      const totalClients = allClients.length;
      const newClients = allClients.filter(c => {
        const created = new Date(c.created_at);
        return created >= new Date(currentStart);
      }).length;
      const returningClients = allClients.filter(c => c.last_visit && new Date(c.last_visit) >= new Date(currentStart)).length;
      
      // Calculate appointments
      const allAppointments = currentAppointments.data || [];
      const appointmentCount = allAppointments.filter(a => a.status !== 'canceled').length;
      const staffCount = (staffRes.data || []).length;
      const appointmentSlots = staffCount * 12 * 30; // Estimate: 12 hours * 30 days
      const occupationRate = appointmentSlots > 0 ? (appointmentCount / appointmentSlots) * 100 : 0;
      
      // Revenue evolution chart
      const revenueByDayMap: Record<string, number> = {};
      (currentTransactions.data || []).forEach(t => {
        const date = t.date.split('T')[0];
        revenueByDayMap[date] = (revenueByDayMap[date] || 0) + Number(t.amount || 0);
      });
      const revenueEvolution = Object.entries(revenueByDayMap)
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      // Top professionals (estimate based on appointments)
      const staffStats: Record<string, { name: string; revenue: number; appointments: number; avatar?: string }> = {};
      allAppointments.filter(a => a.status === 'completed').forEach(a => {
        if (!staffStats[a.staff_id]) {
          const staff = (staffRes.data || []).find(s => s.id === a.staff_id);
          staffStats[a.staff_id] = { 
            name: a.staff_name || 'Sem profissional', 
            revenue: 0, 
            appointments: 0,
            avatar: staff?.avatar,
          };
        }
        staffStats[a.staff_id].appointments++;
        staffStats[a.staff_id].revenue += currentAvgTicket / 2; // Estimate
      });
      const topProfessionals = Object.entries(staffStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      // Club metrics
      const planMap = new Map((clubPlansRes.data || []).map(p => [p.id, Number(p.monthly_price) || 0]));
      const todayStr = now.toISOString().split('T')[0];
      let clubMrr = 0;
      let clubOverdue = 0;
      let clubPending = 0;
      
      (clubSubsRes.data || []).forEach(sub => {
        const price = planMap.get(sub.plan_id) || 0;
        clubMrr += price;
        if (sub.next_billing_date < todayStr) {
          clubOverdue += price;
        } else {
          clubPending += price;
        }
      });
      
      // Generate alerts
      const alerts: StrategicDashboardData['alerts'] = [];
      
      // Stock alert
      const lowStockProducts = (productsRes.data || []).filter(p => 
        p.minimum_stock && p.stock_quantity <= p.minimum_stock
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
        clubActiveSubscriptions: (clubSubsRes.data || []).length,
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