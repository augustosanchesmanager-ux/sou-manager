import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getBusinessLabels } from '../../src/lib/apps/businessLabels';

interface QuickActionsBarProps {
  appSlug?: string | null;
}

const ACTION_CONFIG = [
  {
    key: 'newAppointment',
    label: 'Novo Agendamento',
    icon: 'calendar_add_on',
    path: '/schedule',
    state: { openNewAppointment: true },
    primary: true,
  },
  {
    key: 'newComanda',
    label: 'Nova Comanda',
    icon: 'point_of_sale',
    path: '/checkout?mode=comanda',
    state: undefined,
    primary: false,
  },
  {
    key: 'newClient',
    label: 'Novo Cliente',
    icon: 'person_add',
    path: '/clients',
    state: { openNewClient: true },
    primary: false,
  },
  {
    key: 'newService',
    label: 'Serviços',
    icon: 'content_cut',
    path: '/services',
    state: { openNewService: true },
    primary: false,
  },
] as const;

export const QuickActionsBar: React.FC<QuickActionsBarProps> = ({ appSlug }) => {
  const navigate = useNavigate();
  const labels = getBusinessLabels(appSlug);
  const isEsteticaApp = appSlug === 'estetica';

  const handleNavigate = (path: string, state?: Record<string, unknown>) => {
    navigate(path, state ? { state } : undefined);
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {ACTION_CONFIG.map((action) => {
        const isPrimary = action.primary;
        const label = isEsteticaApp && action.key === 'newClient'
          ? `Novo ${labels.client.toLowerCase()}`
          : isEsteticaApp && action.key === 'newService'
            ? `Novo ${labels.service.toLowerCase()}`
            : action.label;

        const cardClassName = isPrimary
          ? 'group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 text-left transition-all duration-200 active:scale-[0.98] touch-manipulation hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-smg-glow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
          : 'group rounded-2xl border border-line bg-card p-4 text-left transition-all duration-200 active:scale-[0.98] touch-manipulation hover:-translate-y-0.5 hover:border-primary-light hover:bg-gold-pale hover:shadow-smg-shell focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30';

        const iconClassName = isPrimary
          ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary/80 to-primary-dark text-night shadow-smg-glow transition-transform duration-200 group-hover:scale-105'
          : 'flex h-10 w-10 items-center justify-center rounded-xl bg-gold-soft text-primary-dark transition-transform duration-200 group-hover:scale-105';

        const labelClassName = isPrimary
          ? 'text-xs font-bold text-ink'
          : 'text-xs font-bold text-ink';

        return (
          <button
            key={action.key}
            type="button"
            onClick={() => handleNavigate(action.path, action.state)}
            aria-label={`Ação rápida: ${label}`}
            className={cardClassName}
          >
            <div className={iconClassName}>
              <span className="material-symbols-outlined text-xl">{action.icon}</span>
            </div>
            <p className={`mt-3 ${labelClassName}`}>{label}</p>
            {isPrimary && (
              <div className="pointer-events-none absolute -top-2 -right-2 h-16 w-16 rounded-full bg-primary/20 blur-2xl" />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default QuickActionsBar;