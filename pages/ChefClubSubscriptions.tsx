import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { getScopedClient } from '../services/supabaseClient';
import { useMembershipOverview } from '../src/hooks/useMembershipOverview';
import { normalizePlanServiceCredits } from '../src/utils/chefClubCredits';
import type { SubscriptionStatus } from '../src/types/membership';

const statusLabels: Record<SubscriptionStatus | 'all', string> = {
  all: 'Todos',
  active: 'Ativos',
  past_due: 'Em atraso',
  paused: 'Pausados',
  canceled: 'Cancelados',
};

const statusMeta: Record<SubscriptionStatus, { icon: string; className: string }> = {
  active: {
    icon: 'check_circle',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  past_due: {
    icon: 'error',
    className: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  },
  paused: {
    icon: 'pause_circle',
    className: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
  },
  canceled: {
    icon: 'cancel',
    className: 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(value);

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data';
  return new Date(value).toLocaleDateString('pt-BR');
};

const ChefClubSubscriptions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { tenantId } = useAuth();

  const initialStatus = (searchParams.get('status') as SubscriptionStatus | 'all') || 'all';
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | 'all'>(initialStatus);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const { data, reload } = useMembershipOverview({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  useEffect(() => {
    const stateToast = (location.state as { toast?: { message?: string; type?: 'success' | 'error' | 'info' } } | null)?.toast;
    if (stateToast?.message) {
      setToast({
        message: stateToast.message,
        type: stateToast.type || 'info',
      });
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  const statusCounts = useMemo(() => {
    return data.subscriptions.reduce<Record<SubscriptionStatus | 'all', number>>(
      (acc, subscription) => {
        acc.all += 1;
        acc[subscription.status] += 1;
        return acc;
      },
      { all: 0, active: 0, past_due: 0, paused: 0, canceled: 0 },
    );
  }, [data.subscriptions]);

  const metricCards = useMemo(
    () => [
      {
        label: 'Receita mensal ativa',
        value: formatCurrency(data.metrics.mrr),
        helper: `${data.metrics.activeSubscribers} clientes com assinatura ativa`,
        icon: 'workspace_premium',
        tone: 'text-emerald-700 dark:text-emerald-300',
      },
      {
        label: 'Fila de cobrança',
        value: data.metrics.totalOverdue > 0 ? formatCurrency(data.metrics.totalOverdue) : 'Em dia',
        helper: `${data.collectionQueue.length} clientes pedem atenção`,
        icon: 'notifications_active',
        tone: data.metrics.totalOverdue > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300',
      },
      {
        label: 'Próximos 7 dias',
        value: formatCurrency(data.metrics.pendingAmount),
        helper: `${data.metrics.expiringNext30Days} ciclos entram na agenda do mês`,
        icon: 'event_upcoming',
        tone: 'text-[#003366] dark:text-[#00D2FF]',
      },
      {
        label: 'Cancelamentos',
        value: `${data.metrics.churnRate.toFixed(1)}%`,
        helper: `${data.metrics.churnCount} assinaturas canceladas no histórico`,
        icon: 'trending_down',
        tone: data.metrics.churnRate > 10 ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100',
      },
    ],
    [data.collectionQueue.length, data.metrics],
  );

  const translateStatus = (status: SubscriptionStatus | 'all') => statusLabels[status] || status;

  const handleWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanPhone) {
      setToast({ message: 'Este cliente ainda não tem telefone cadastrado.', type: 'info' });
      return;
    }

    const message = encodeURIComponent(
      `Olá ${name}! Passando para lembrar da sua assinatura do Clube do Chefe. Para manter seus créditos e benefícios ativos, podemos regularizar por aqui.`,
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  const handleStatusChange = async (subscriptionId: string, newStatus: 'paused' | 'canceled' | 'active') => {
    if (!tenantId) {
      setToast({ message: 'Não foi possível identificar a barbearia desta sessão.', type: 'error' });
      return;
    }

    const barberSupabase = getScopedClient('barber');
    setUpdatingId(subscriptionId);

    try {
      const { error } = await barberSupabase
        .from('customer_subscriptions')
        .update({ status: newStatus })
        .eq('tenant_id', tenantId)
        .eq('id', subscriptionId);

      if (error) throw error;

      const actionLabel = newStatus === 'active' ? 'reativada' : newStatus === 'paused' ? 'pausada' : 'cancelada';
      setToast({ message: `Assinatura ${actionLabel} com sucesso.`, type: 'success' });
      reload();
    } catch (err: any) {
      setToast({ message: `Erro ao atualizar assinatura: ${err.message}`, type: 'error' });
    } finally {
      setUpdatingId(null);
    }
  };

  if (data.error) {
    return (
      <div className="mx-auto w-full max-w-7xl p-4 md:p-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5">error</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">Não foi possível carregar as assinaturas</p>
              <p className="mt-1 text-sm opacity-80">{data.error}</p>
              <button
                onClick={reload}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
              >
                <span className="material-symbols-outlined text-base">refresh</span>
                Tentar novamente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border border-[#D8E8F3] bg-[#003366] text-white shadow-sm dark:border-[#14304A]">
        <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-end md:p-6">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#BFEFFF]">
              <span className="material-symbols-outlined text-sm">workspace_premium</span>
              Clube do Chefe, recorrência da barbearia
            </div>
            <h1 className="mt-4 text-2xl font-black leading-tight md:text-3xl">Assinaturas do Clube</h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-200">
              Acompanhe clientes ativos, créditos por serviço e cobranças pendentes sem sair do fluxo da loja.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => navigate('/chef-club-receivables')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-[#00D2FF]/40"
            >
              <span className="material-symbols-outlined text-base">payments</span>
              Recebimentos
            </button>
            <button
              onClick={() => navigate('/chef-club-subscriptions/new?from=subscriptions')}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E5A158] px-4 py-3 text-sm font-bold text-[#171717] transition-colors hover:bg-[#D97706] focus:outline-none focus:ring-2 focus:ring-[#E5A158]/40"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              Novo assinante
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{metric.label}</p>
                <p className={`mt-2 text-xl font-black ${metric.tone}`}>{metric.value}</p>
              </div>
              <span className="material-symbols-outlined rounded-xl border border-[#D8E8F3] bg-[#F1F8FC] p-2 text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                {metric.icon}
              </span>
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-slate-500 dark:text-slate-400">{metric.helper}</p>
          </div>
        ))}
      </section>

      {data.collectionQueue.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-500/10">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-black text-amber-900 dark:text-amber-100">
                <span className="material-symbols-outlined">notifications_active</span>
                Clientes para cobrar hoje
              </h2>
              <p className="mt-1 text-sm font-medium text-amber-800/80 dark:text-amber-100/70">
                Prioridade para manter créditos e benefícios ativos antes da próxima visita.
              </p>
            </div>
            <span className="w-fit rounded-full border border-amber-300 bg-white/70 px-3 py-1 text-xs font-bold text-amber-900 dark:border-amber-500/30 dark:bg-black/10 dark:text-amber-100">
              {data.collectionQueue.length} na fila
            </span>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {data.collectionQueue.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-white p-3 dark:border-amber-500/10 dark:bg-[#14100A] sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-900 dark:text-white">{item.clientName}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                    {item.priority === 'high' ? `${item.daysOverdue} dias em atraso` : `Vence em ${formatDate(item.dueDate)}`} · {item.planName}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className="text-sm font-black text-amber-800 dark:text-amber-200">{formatCurrency(item.amount)}</span>
                  <button
                    onClick={() => handleWhatsApp(item.clientPhone, item.clientName)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  >
                    <span className="material-symbols-outlined text-sm">chat</span>
                    WhatsApp
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-card-dark">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
            <input
              type="text"
              placeholder="Buscar assinante por nome ou telefone"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              title="Buscar assinante"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#007BFF] focus:ring-2 focus:ring-[#007BFF]/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['all', 'active', 'past_due', 'paused', 'canceled'] as const).map((status) => {
              const isSelected = statusFilter === status;
              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 ${
                    isSelected
                      ? 'border-[#003366] bg-[#003366] text-white dark:border-[#00D2FF] dark:bg-[#00D2FF] dark:text-[#06111F]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-[#007BFF]/40 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                  }`}
                >
                  {translateStatus(status)}
                  <span className="ml-2 text-[11px] opacity-70">{statusCounts[status]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-card-dark">
        <div className="border-b border-slate-200 px-4 py-4 dark:border-white/10 md:px-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white">Base de assinantes</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Cliente, plano, créditos e próxima cobrança em uma visão de operação.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{data.subscriptions.length} registros</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5">
              <tr>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">Cliente</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">Plano</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">Créditos</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-slate-400">Próxima cobrança</th>
                <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {data.subscriptions.map((subscription) => {
                const planServices = normalizePlanServiceCredits(
                  subscription.plan.serviceCreditMap,
                  subscription.plan.serviceCredits,
                );
                const status = statusMeta[subscription.status];
                const isUpdating = updatingId === subscription.id;

                return (
                  <tr key={subscription.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/5">
                    <td className="px-5 py-4 align-top">
                      <div className="min-w-0">
                        <p className="max-w-[220px] truncate text-sm font-black text-slate-900 dark:text-white">{subscription.client.name}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {subscription.client.phone || 'Telefone não cadastrado'}
                        </p>
                      </div>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-black text-[#003366] dark:text-[#00D2FF]">{subscription.plan.name}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formatCurrency(subscription.plan.monthlyPrice)} por mês
                      </p>
                      {planServices.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {planServices.slice(0, 2).map((entry) => (
                            <p key={`${subscription.id}-${entry.service_id}`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {entry.service_name}: {entry.credits} por ciclo
                            </p>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                        <span className="material-symbols-outlined text-sm">workspace_premium</span>
                        {subscription.availableCredits}
                      </div>
                      {subscription.serviceBalances.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {subscription.serviceBalances.slice(0, 2).map((balance) => (
                            <p key={`${subscription.id}-${balance.service_id}`} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              {balance.service_name}: {balance.available} disponíveis
                            </p>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${status.className}`}>
                        <span className="material-symbols-outlined text-sm">{status.icon}</span>
                        {translateStatus(subscription.status)}
                      </span>
                    </td>

                    <td className="px-5 py-4 align-top">
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatDate(subscription.nextBillingDate)}</p>
                      {subscription.cycleEnd && (
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          Ciclo até {formatDate(subscription.cycleEnd)}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4 align-top">
                      <div className="flex items-center justify-end gap-2">
                        {subscription.status === 'past_due' && (
                          <button
                            onClick={() => handleWhatsApp(subscription.client.phone, subscription.client.name)}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                            title="Cobrar por WhatsApp"
                          >
                            <span className="material-symbols-outlined text-base">chat</span>
                          </button>
                        )}

                        <button
                          onClick={() => navigate(`/chef-club-subscriptions/${subscription.id}`)}
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-[#007BFF]/40 hover:text-[#003366] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/20 dark:border-white/10 dark:text-slate-300 dark:hover:text-[#00D2FF]"
                          title="Ver detalhes"
                        >
                          <span className="material-symbols-outlined text-base">visibility</span>
                        </button>

                        {subscription.status === 'active' && (
                          <button
                            onClick={() => handleStatusChange(subscription.id, 'paused')}
                            disabled={isUpdating}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5"
                            title="Pausar assinatura"
                          >
                            <span className="material-symbols-outlined text-base">{isUpdating ? 'progress_activity' : 'pause'}</span>
                          </button>
                        )}

                        {subscription.status === 'paused' && (
                          <button
                            onClick={() => handleStatusChange(subscription.id, 'active')}
                            disabled={isUpdating}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                            title="Reativar assinatura"
                          >
                            <span className="material-symbols-outlined text-base">{isUpdating ? 'progress_activity' : 'play_arrow'}</span>
                          </button>
                        )}

                        {(subscription.status === 'active' || subscription.status === 'paused') && (
                          <button
                            onClick={() => handleStatusChange(subscription.id, 'canceled')}
                            disabled={isUpdating}
                            className="inline-flex size-9 items-center justify-center rounded-lg border border-red-200 text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-500/20 dark:text-red-300 dark:hover:bg-red-500/10"
                            title="Cancelar assinatura"
                          >
                            <span className="material-symbols-outlined text-base">{isUpdating ? 'progress_activity' : 'cancel'}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {data.subscriptions.length === 0 && !data.loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center">
                      <span className="material-symbols-outlined rounded-2xl border border-[#D8E8F3] bg-[#F1F8FC] p-3 text-3xl text-[#003366] dark:border-[#14304A] dark:bg-[#071426] dark:text-[#00D2FF]">
                        groups
                      </span>
                      <p className="mt-4 text-base font-black text-slate-900 dark:text-white">Nenhuma assinatura encontrada</p>
                      <p className="mt-2 text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                        Ajuste os filtros ou cadastre um cliente recorrente para acompanhar créditos, ciclos e cobrança por aqui.
                      </p>
                      <button
                        onClick={() => navigate('/chef-club-subscriptions/new?from=subscriptions')}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#007BFF] focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30"
                      >
                        <span className="material-symbols-outlined text-base">person_add</span>
                        Novo assinante
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {data.loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-sm dark:bg-black/50">
          <div className="flex w-full max-w-xs flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-white/10 dark:bg-card-dark">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-b-[#007BFF] dark:border-white/10 dark:border-b-[#00D2FF]" />
            <p className="text-sm font-bold text-slate-900 dark:text-white">Carregando assinaturas</p>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ChefClubSubscriptions;
