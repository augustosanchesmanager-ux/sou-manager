import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { getScopedClient } from '../services/supabaseClient';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
const fmtDateTime = (d: string) => d ? new Date(d).toLocaleString('pt-BR') : '-';

interface FilterState {
  dateFrom: string;
  dateTo: string;
  quickRange: string;
}

interface SaleRecord {
  id: string;
  client_name: string;
  total: number;
  status: string;
  created_at: string;
  staff_names: string[];
}

const Reports: React.FC = () => {
  const { tenantId } = useAuth();
  const clubSupabase = getScopedClient('barber');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'chefclub' | 'sales'>('chefclub');

  const [filters, setFilters] = useState<FilterState>({
    dateFrom: '',
    dateTo: '',
    quickRange: 'this_month',
  });

  const [chefClubStats, setChefClubStats] = useState({
    activeSubscriptions: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    popularPlan: null as string | null,
  });

  const [sales, setSales] = useState<SaleRecord[]>([]);

  const [stats, setStats] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageTicket: 0,
  });

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    if (activeTab === 'chefclub') {
      fetchChefClubData();
    } else if (activeTab === 'sales') {
      fetchSales();
    }
  }, [tenantId, activeTab, filters.dateFrom, filters.dateTo]);

  const fetchChefClubData = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      const [subsRes, creditsRes, plansRes] = await Promise.all([
        clubSupabase
          .from('customer_subscriptions')
          .select('id, status, plan_id')
          .eq('tenant_id', tenantId)
          .eq('status', 'active'),
        clubSupabase
          .from('customer_credits')
          .select('available_credits, used_credits')
          .eq('tenant_id', tenantId),
        clubSupabase
          .from('customer_plans')
          .select('id, name')
          .eq('tenant_id', tenantId),
      ]);

      const activeCount = (subsRes.data || []).length;
      
      const planMap = new Map((plansRes.data || []).map((p: any) => [p.id, p.name]));
      
      const planCounts = new Map<string, number>();
      (subsRes.data || []).forEach((sub: any) => {
        const planName = planMap.get(sub.plan_id) || 'Standard';
        planCounts.set(planName, (planCounts.get(planName) || 0) + 1);
      });

      let popularPlan: string | null = null;
      let maxCount = 0;
      planCounts.forEach((count, plan) => {
        if (count > maxCount) {
          maxCount = count;
          popularPlan = plan;
        }
      });

      let totalAvailable = 0;
      let totalUsed = 0;
      (creditsRes.data || []).forEach((c: any) => {
        totalAvailable += Number(c.available_credits || 0);
        totalUsed += Number(c.used_credits || 0);
      });

      setChefClubStats({
        activeSubscriptions: activeCount,
        totalCreditsAvailable: totalAvailable,
        totalCreditsUsed: totalUsed,
        popularPlan,
      });
    } catch (err) {
      console.error('Erro ao buscar dados do Clube:', err);
      setToast({ msg: 'Erro ao carregar dados do Clube', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [tenantId, clubSupabase]);

  const fetchSales = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    try {
      setStats(s => ({ ...s, totalSales: 0, totalOrders: 0, averageTicket: 0 }));
      setSales([]);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao buscar vendas:', err);
      setToast({ msg: 'Erro ao carregar vendas', type: 'error' });
    }
  }, [tenantId]);

  const tabs = [
    { id: 'chefclub', label: 'Clube dos Chefs', icon: 'workspace_premium' },
    { id: 'sales', label: 'Vendas', icon: 'point_of_sale' },
  ];

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    switch (activeTab) {
      case 'chefclub':
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 text-2xl">workspace_premium</span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Clube dos Chefs</h3>
                  <p className="text-sm text-slate-500">Programa de fidelidade</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Assinantes Ativos</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.activeSubscriptions}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Usados</p>
                  <p className="text-3xl font-black text-amber-600">{chefClubStats.totalCreditsUsed}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Créditos Disponíveis</p>
                  <p className="text-3xl font-black text-emerald-600">{chefClubStats.totalCreditsAvailable}</p>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-lg p-4">
                  <p className="text-[10px] uppercase text-slate-500 font-bold mb-1">Plano Mais Popular</p>
                  <p className="text-xl font-black text-amber-600 truncate">{chefClubStats.popularPlan || 'N/A'}</p>
                </div>
              </div>

              {chefClubStats.activeSubscriptions > 0 && (
                <div className="mt-4 pt-4 border-t border-amber-500/20">
                  <a 
                    href="/chef-club-subscriptions" 
                    className="text-sm font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                  >
                    Ver todos os assinantes
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </a>
                </div>
              )}
            </div>
          </div>
        );

      case 'sales':
        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-slate-300 mb-4">point_of_sale</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Relatório de Vendas</h3>
              <p className="text-slate-500">Em breve</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-slate-500">Visão completa do seu negócio</p>
        </div>
        <DateRangeFilter
          startDate={filters.dateFrom}
          endDate={filters.dateTo}
          onStartDateChange={(v) => setFilters(f => ({ ...f, dateFrom: v }))}
          onEndDateChange={(v) => setFilters(f => ({ ...f, dateTo: v }))}
          showPresets={true}
        />
      </div>

      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'chefclub' | 'sales')}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <span className="material-symbols-outlined text-lg">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default Reports;