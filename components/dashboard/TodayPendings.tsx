import React from 'react';
import { Link } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';

interface TodayPendingsProps {
  appSlug?: string | null;
  openComandasCount: number;
  pendingAppointmentsCount: number;
  returningClientsCount: number;
  loading?: boolean;
  status?: 'idle' | 'loading' | 'success' | 'error';
  error?: string | null;
}

const buildPendingItems = (appSlug?: string | null) => {
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  return [
  {
    key: 'comandas',
    label: isEsteticaApp ? `${labels.orderPlural} abertos` : 'Comandas abertas',
    icon: 'receipt_long',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary-dark',
    link: '/comandas',
  },
  {
    key: 'pending',
    label: isEsteticaApp ? 'Atendimentos pendentes' : 'Agendamentos pendentes',
    icon: 'pending_actions',
    iconBg: 'bg-primary/10',
    iconColor: 'text-primary-dark',
    link: '/schedule',
  },
  {
    key: 'returns',
    label: isEsteticaApp ? 'Clientes para retorno' : 'Retornos sugeridos',
    icon: 'person_search',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    link: '/smart-return',
  },
  ];
};

export const TodayPendings: React.FC<TodayPendingsProps> = ({
  appSlug,
  openComandasCount,
  pendingAppointmentsCount,
  returningClientsCount,
  loading,
  status,
  error,
}) => {
  const pendingItems = buildPendingItems(appSlug);
  const counts: Record<string, number> = {
    comandas: openComandasCount,
    pending: pendingAppointmentsCount,
    returns: returningClientsCount,
  };
  const total = openComandasCount + pendingAppointmentsCount + returningClientsCount;
  const effectiveStatus = status || (loading ? 'loading' : error ? 'error' : 'success');

  if (effectiveStatus === 'loading') {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">warning</span>
          <h3 className="font-bold text-ink">Pendências de hoje</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-gold-pale p-3">
              <div className="h-4 w-2/3 rounded bg-gold-soft" />
              <div className="h-4 w-8 rounded bg-gold-soft" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (effectiveStatus === 'error') {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-danger">error</span>
          <h3 className="font-bold text-ink">Pendências de hoje</h3>
        </div>
        <p className="text-xs text-danger">
          {error || 'Não foi possível carregar as pendências do dia.'}
        </p>
      </div>
    );
  }

  if (effectiveStatus === 'success' && total === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="flex items-center gap-2 border-b border-line p-5">
          <span className="material-symbols-outlined text-success">verified</span>
          <h3 className="font-bold text-ink">Pendências de hoje</h3>
        </div>
        <div className="p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success border border-success/20">
            <span className="material-symbols-outlined text-2xl">task_alt</span>
          </div>
          <p className="mt-3 text-sm font-bold text-ink">Tudo em dia na unidade</p>
          <p className="mt-1 text-xs text-ink-soft max-w-xs mx-auto">
            Nenhuma comanda aberta, agendamento pendente ou retorno urgente neste momento.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line p-5">
        <span className="material-symbols-outlined text-primary-dark">warning</span>
        <h3 className="font-bold text-ink">Pendências de hoje</h3>
      </div>

      <div className="divide-y divide-line">
        {pendingItems.map((item) => {
          const count = counts[item.key] || 0;
          return (
            <div
              key={item.key}
              className="flex items-center justify-between p-4 transition-colors hover:bg-gold-pale"
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                  <span className={`material-symbols-outlined text-base ${item.iconColor}`}>
                    {item.icon}
                  </span>
                </div>
                <span className="text-sm text-ink-soft">
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-bold tabular-nums tracking-tight whitespace-nowrap text-ink">
                  {count}
                </span>
                <Link
                  to={item.link}
                  aria-label={`Ver detalhes de ${item.label.toLowerCase()}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-colors touch-manipulation hover:text-primary-dark focus:outline-none focus-visible:underline"
                >
                  Ver
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TodayPendings;