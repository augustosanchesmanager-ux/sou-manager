import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getScopedClient } from '../../services/supabaseClient';

interface ReceivableItem {
  id: string;
  client_name: string;
  client_phone: string;
  plan_name: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'overdue' | 'paid';
  days_overdue: number;
}

interface ClubMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  churnRate: number;
  totalPending: number;
  totalOverdue: number;
  countPending: number;
  countOverdue: number;
  items: ReceivableItem[];
}

export const ClubReceivablesWidget: React.FC = () => {
  const { tenantId } = useAuth();
  const barberSupabase = getScopedClient('barber');
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<ClubMetrics>({
    mrr: 0,
    arr: 0,
    activeSubscribers: 0,
    churnRate: 0,
    totalPending: 0,
    totalOverdue: 0,
    countPending: 0,
    countOverdue: 0,
    items: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;

    const fetchMetrics = async () => {
      setLoading(true);
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Fetch subscriptions, plans, and credits
        const [subsRes, plansRes, creditsRes] = await Promise.all([
          barberSupabase
            .from('customer_subscriptions')
            .select('id, client_id, plan_id, status, next_billing_date, created_at, canceled_at')
            .eq('tenant_id', tenantId),
          barberSupabase
            .from('customer_plans')
            .select('id, name, monthly_price')
            .eq('tenant_id', tenantId)
            .eq('active', true),
          barberSupabase
            .from('customer_credits')
            .select('subscription_id, available_credits, used_credits')
            .eq('tenant_id', tenantId),
        ]);

        const activeSubs = (subsRes.data || []).filter(s => s.status === 'active');
        const planMap = new Map((plansRes.data || []).map(p => [p.id, { name: p.name, price: Number(p.monthly_price) || 0 }]));
        
        // Calculate MRR
        let mrr = 0;
        activeSubs.forEach(sub => {
          const plan = planMap.get(sub.plan_id);
          if (plan) mrr += plan.price;
        });

        // Calculate overdue and pending
        let totalOverdue = 0;
        let totalPending = 0;
        let countOverdue = 0;
        let countPending = 0;
        
        const items: ReceivableItem[] = [];
        
        activeSubs.forEach(sub => {
          const plan = planMap.get(sub.plan_id);
          if (!plan) return;
          
          const dueDate = sub.next_billing_date;
          const isOverdue = dueDate < today;
          
          if (isOverdue) {
            totalOverdue += plan.price;
            countOverdue++;
          } else {
            totalPending += plan.price;
            countPending++;
          }
          
          const dueDateObj = new Date(dueDate);
          const todayObj = new Date(today);
          const daysOverdue = Math.floor((todayObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
          
          items.push({
            id: sub.id,
            client_name: 'Cliente', // Will be enriched
            client_phone: '',
            plan_name: plan.name,
            amount: plan.price,
            due_date: dueDate,
            status: isOverdue ? 'overdue' : 'pending',
            days_overdue: daysOverdue > 0 ? daysOverdue : 0,
          });
        });

        // Calculate churn rate (simplified)
        const allSubs = subsRes.data || [];
        const canceledSubs = allSubs.filter(s => s.status === 'canceled').length;
        const totalSubs = allSubs.length;
        const churnRate = totalSubs > 0 ? (canceledSubs / totalSubs) * 100 : 0;

        setMetrics({
          mrr,
          arr: mrr * 12,
          activeSubscribers: activeSubs.length,
          churnRate,
          totalPending,
          totalOverdue,
          countPending,
          countOverdue,
          items: items.slice(0, 5),
        });
      } catch (error) {
        console.error('Erro ao buscar métricas do Clube:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [tenantId]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  if (loading) {
    return (
      <div className="card-boutique p-6">
        <div className="animate-pulse flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          <div>
            <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
            <div className="h-6 w-20 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const hasData = metrics.activeSubscribers > 0;

  return (
    <div className="card-boutique p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            hasData ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'
          }`}>
            <span className={`material-symbols-outlined ${hasData ? 'text-amber-600' : 'text-emerald-600'}`}>
              workspace_premium
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">Clube dos Chefs</h3>
            <p className="text-xs text-slate-500">Receita Recorrente</p>
          </div>
        </div>
        <button 
          onClick={() => navigate('/chef-club-subscriptions')}
          className="text-xs font-bold text-primary hover:text-primary/80"
        >
          Ver todos →
        </button>
      </div>

      {!hasData ? (
        <div className="text-center py-6">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">group_add</span>
          <p className="text-slate-600 dark:text-slate-400 font-bold text-sm">Nenhum assinante ainda</p>
          <p className="text-slate-500 text-xs mt-1">Crie planos para começar</p>
          <button 
            onClick={() => navigate('/chef-club-plans')}
            className="mt-3 px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
          >
            Criar Plano
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800/30">
              <p className="text-[10px] uppercase text-emerald-600 dark:text-emerald-400 font-bold">MRR</p>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                {formatCurrency(metrics.mrr)}
              </p>
            </div>
            
            <div className={`rounded-lg p-3 border ${
              metrics.countOverdue > 0 
                ? 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/30' 
                : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
            }`}>
              <p className={`text-[10px] uppercase font-bold ${metrics.countOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
                {metrics.countOverdue > 0 ? 'Atrasado' : 'Em Dia'}
              </p>
              <p className={`text-lg font-black ${metrics.countOverdue > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                {formatCurrency(metrics.totalOverdue)}
              </p>
            </div>
          </div>

          <div className="flex justify-between text-xs mb-4">
            <div className="text-center">
              <p className="text-slate-500">Assinantes</p>
              <p className="font-black text-slate-900 dark:text-white">{metrics.activeSubscribers}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">A Receber</p>
              <p className="font-black text-amber-600">{formatCurrency(metrics.totalPending)}</p>
            </div>
            <div className="text-center">
              <p className="text-slate-500">Churn</p>
              <p className={`font-black ${metrics.churnRate > 10 ? 'text-red-500' : 'text-emerald-500'}`}>
                {formatPercent(metrics.churnRate)}
              </p>
            </div>
          </div>

          {metrics.items.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <p className="text-[10px] uppercase text-slate-500 font-bold">Próximas cobranças</p>
              {metrics.items.map((item) => (
                <div 
                  key={item.id}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs ${
                    item.status === 'overdue' 
                      ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/20' 
                      : 'bg-slate-50 dark:bg-white/5'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{item.plan_name}</p>
                    <p className="text-slate-500 text-[10px]">
                      {item.status === 'overdue' 
                        ? `${item.days_overdue}d atrasado` 
                        : `Vence ${new Date(item.due_date).toLocaleDateString('pt-BR')}`
                      }
                    </p>
                  </div>
                  <p className={`font-black ${item.status === 'overdue' ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                    {formatCurrency(item.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};