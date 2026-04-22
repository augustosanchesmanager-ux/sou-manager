import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getScopedClient } from '../../services/supabaseClient';

interface ChefClubStats {
  activeSubscriptions: number;
  totalCreditsAvailable: number;
  totalCreditsUsed: number;
  revenue: number;
  popularPlan: string | null;
}

const ChefClubSummaryWidget: React.FC = () => {
  const { tenantId } = useAuth();
  const barberSupabase = getScopedClient('barber');
  const [stats, setStats] = useState<ChefClubStats>({
    activeSubscriptions: 0,
    totalCreditsAvailable: 0,
    totalCreditsUsed: 0,
    revenue: 0,
    popularPlan: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const [subsRes, creditsRes, plansRes] = await Promise.all([
          barberSupabase
            .from('customer_subscriptions')
            .select('id, status, plan_id')
            .eq('tenant_id', tenantId)
            .eq('status', 'active'),
          barberSupabase
            .from('customer_credits')
            .select('available_credits, used_credits')
            .eq('tenant_id', tenantId),
          barberSupabase
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

        setStats({
          activeSubscriptions: activeCount,
          totalCreditsAvailable: totalAvailable,
          totalCreditsUsed: totalUsed,
          revenue: 0,
          popularPlan,
        });
      } catch (error) {
        console.error('Erro ao buscar estatísticas do Clube:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark p-4">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div>
            <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-6 w-16 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400">workspace_premium</span>
        </div>
        <div>
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">Clube dos Chefs</h3>
          <p className="text-xs text-slate-500">Resumo do programa</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Assinantes Ativos</p>
          <p className="text-xl font-black text-amber-600">{stats.activeSubscriptions}</p>
        </div>
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Créditos Usados</p>
          <p className="text-xl font-black text-amber-600">
            {stats.totalCreditsUsed} <span className="text-xs font-normal">/ {stats.totalCreditsAvailable}</span>
          </p>
        </div>
        <div className="bg-white/50 dark:bg-black/20 rounded-lg p-3 col-span-2">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Plano Mais Popular</p>
          <p className="text-lg font-black text-amber-600">{stats.popularPlan || 'N/A'}</p>
        </div>
      </div>

      {stats.activeSubscriptions > 0 && (
        <div className="mt-3 pt-3 border-t border-amber-500/20">
          <a 
            href="/chef-club-subscriptions" 
            className="text-xs font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            Ver todos os assinantes
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
      )}
    </div>
  );
};

export default ChefClubSummaryWidget;