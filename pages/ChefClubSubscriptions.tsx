import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMembershipOverview } from '../src/hooks/useMembershipOverview';
import { normalizeCreditBalances, normalizePlanServiceCredits } from '../src/utils/chefClubCredits';
import { getScopedClient } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Toast from '../components/Toast';
import type { SubscriptionStatus } from '../src/types/membership';

const statusLabels: Record<string, string> = {
  all: 'Todos',
  active: 'Ativo',
  past_due: 'Atrasado',
  canceled: 'Cancelado',
  paused: 'Pausado',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const ChefClubSubscriptions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  const initialStatus = (searchParams.get('status') as SubscriptionStatus | 'all') || 'all';
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>(initialStatus);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const { data, reload } = useMembershipOverview({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  React.useEffect(() => {
    const stateToast = (location.state as any)?.toast;
    if (stateToast?.message) {
      setToast(stateToast);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-500';
      case 'past_due':
        return 'bg-amber-500/10 text-amber-500';
      case 'canceled':
        return 'bg-red-500/10 text-red-500';
      case 'paused':
        return 'bg-slate-500/10 text-slate-500';
      default:
        return 'bg-slate-500/10 text-slate-500';
    }
  };

  const translateStatus = (status: string) => {
    return statusLabels[status] || status;
  };

  const handleWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá ${name}! vim te lembrar que sua assinatura do Clube dos Chefs está com pagamento pendente. Para manter seus benefícios, é só acessar o link de pagamento.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const handleStatusChange = async (subscriptionId: string, newStatus: 'paused' | 'canceled' | 'active') => {
    const barberSupabase = getScopedClient('barber');
    try {
      const { error } = await barberSupabase
        .from('customer_subscriptions')
        .update({ status: newStatus })
        .eq('id', subscriptionId);

      if (error) throw error;

      setToast({ message: `Assinatura ${newStatus === 'active' ? 'reativada' : newStatus === 'paused' ? 'pausada' : 'cancelada'} com sucesso!`, type: 'success' });
      reload();
    } catch (err: any) {
      setToast({ message: `Erro ao atualizar assinatura: ${err.message}`, type: 'error' });
    }
  };

  const handleViewDetails = (subscriptionId: string) => {
    navigate(`/chef-club-subscriptions/${subscriptionId}`);
  };

  if (data.error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg">
          <p className="font-bold">Erro ao carregar dados</p>
          <p className="text-sm">{data.error}</p>
          <button onClick={reload} className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in p-4 md:p-6">
      {/* Header com Métricas */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
            <span className="material-symbols-outlined text-primary text-3xl">group</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Clube dos Chefs</h2>
            <p className="text-slate-500 text-sm font-medium">Gestão de Assinaturas e Cobranças</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/chef-club-subscriptions/new?from=subscriptions')}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-blue-600 shadow-xl shadow-primary/20 transition-all"
        >
          <span className="material-symbols-outlined">person_add</span>
          Novo Assinante
        </button>
      </div>

      {/* KPIs do Clube */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-white/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold">MRR</p>
          <p className="text-xl font-black text-emerald-500">{formatCurrency(data.metrics.mrr)}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-white/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Ativos</p>
          <p className="text-xl font-black text-slate-900 dark:text-white">{data.metrics.activeSubscribers}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-white/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Atrasados</p>
          <p className="text-xl font-black text-red-500">{data.metrics.totalOverdue > 0 ? formatCurrency(data.metrics.totalOverdue) : '—'}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-white/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold">A Vencer</p>
          <p className="text-xl font-black text-amber-500">{formatCurrency(data.metrics.pendingAmount)}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-white/10">
          <p className="text-[10px] text-slate-500 uppercase font-bold">Churn</p>
          <p className={`text-xl font-black ${data.metrics.churnRate > 10 ? 'text-red-500' : 'text-emerald-500'}`}>
            {data.metrics.churnRate.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Fila de Cobrança */}
      {data.collectionQueue.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>
              Cobranças Pendentes ({data.collectionQueue.length})
            </h3>
          </div>
          <div className="space-y-2">
            {data.collectionQueue.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between bg-white dark:bg-card-dark p-3 rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 dark:text-white truncate">{item.clientName}</p>
                  <p className="text-xs text-slate-500">
                    {item.priority === 'high' ? `${item.daysOverdue} dias atrasado` : `Vence ${new Date(item.dueDate).toLocaleDateString('pt-BR')}`}
                    {' • '}{item.planName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`font-bold ${item.priority === 'high' ? 'text-red-500' : 'text-amber-500'}`}>
                    {formatCurrency(item.amount)}
                  </p>
                  <button
                    onClick={() => handleWhatsApp(item.clientPhone, item.clientName)}
                    className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                    title="Cobrar por WhatsApp"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            title="Buscar Assinante"
            className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-10 pr-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'past_due', 'canceled'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === status ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-200 dark:border-white/10'}`}
            >
              {translateStatus(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Assinaturas */}
      <div className="bg-white dark:bg-card-dark rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Cliente</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Plano</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Créditos</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest">Próx. Cobrança</th>
                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {data.subscriptions.map((subscription) => {
                const planServices = normalizePlanServiceCredits(
                  subscription.plan.serviceCreditMap,
                  subscription.plan.serviceCredits,
                );

                return (
                  <tr key={subscription.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{subscription.client.name}</span>
                        <span className="text-[10px] text-slate-500 font-bold">{subscription.client.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-bold text-primary">{subscription.plan.name}</span>
                      <div className="mt-1 text-[10px] text-slate-500 font-bold">
                        {formatCurrency(subscription.plan.monthlyPrice)}/mês
                      </div>
                      {planServices.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {planServices.slice(0, 2).map((entry) => (
                            <div key={`${subscription.id}-${entry.serviceId}`} className="text-[10px] font-bold text-slate-500">
                              {entry.serviceName}: {entry.available}/ciclo
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-full">
                        <span className="material-symbols-outlined text-sm">workspace_premium</span>
                        <span className="text-sm font-black">{subscription.availableCredits}</span>
                      </div>
                      {subscription.serviceBalances.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {subscription.serviceBalances.slice(0, 2).map((balance) => (
                            <div key={`${subscription.id}-${balance.serviceId}`} className="text-[10px] font-bold text-slate-500">
                              {balance.serviceName}: {balance.available}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getStatusStyle(subscription.status)}`}>
                        {translateStatus(subscription.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-500 font-bold">
                        {subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString('pt-BR') : '—'}
                      </span>
                    </td>
<td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {subscription.status === 'past_due' && (
                          <button 
                            onClick={() => handleWhatsApp(subscription.client.phone, subscription.client.name)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                            title="Cobrar por WhatsApp"
                          >
                            <span className="material-symbols-outlined text-sm">chat</span>
                          </button>
                        )}
                        <div className="relative group">
                          <button 
                            className="p-2 text-slate-400 hover:text-primary transition-colors"
                            title="Ações"
                          >
                            <span className="material-symbols-outlined text-sm">more_vert</span>
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-card-dark border border-slate-200 dark:border-white/10 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                            <button 
                              onClick={() => handleViewDetails(subscription.id)}
                              className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              Ver Detalhes
                            </button>
                            {subscription.status === 'active' && (
                              <button 
                                onClick={() => handleStatusChange(subscription.id, 'paused')}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-sm">pause</span>
                                Pausar
                              </button>
                            )}
                            {subscription.status === 'paused' && (
                              <button 
                                onClick={() => handleStatusChange(subscription.id, 'active')}
                                className="w-full px-4 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-sm">play_arrow</span>
                                Reativar
                              </button>
                            )}
                            {(subscription.status === 'active' || subscription.status === 'paused') && (
                              <button 
                                onClick={() => handleStatusChange(subscription.id, 'canceled')}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.subscriptions.length === 0 && !data.loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Nenhum assinante encontrado</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data.loading && (
        <div className="fixed inset-0 bg-black/20 dark:bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Carregando...</p>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ChefClubSubscriptions;