/**
 * [SMG][SHARED][STATUS] subscription
 *
 * Status de assinaturas ChefClub: labels, ícones, cores.
 * Substitui definições em ChefClubSubscriptions.tsx, ChefClubSubscriptionDetail.tsx.
 */

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused';

export interface SubscriptionStatusMeta {
  icon: string;
  className: string;
}

/**
 * Labels de status de assinatura.
 */
export const subscriptionStatusLabels: Record<
  SubscriptionStatus | 'all',
  string
> = {
  all: 'Todos',
  active: 'Ativos',
  past_due: 'Em atraso',
  paused: 'Pausados',
  canceled: 'Cancelados',
};

/**
 * Metadados de status de assinatura (ícone + cor).
 */
export const subscriptionStatusMeta: Record<
  SubscriptionStatus,
  SubscriptionStatusMeta
> = {
  active: {
    icon: 'check_circle',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  past_due: {
    icon: 'error',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  },
  paused: {
    icon: 'pause_circle',
    className:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
  },
  canceled: {
    icon: 'cancel',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  },
};

/**
 * Labels de ação para toast (assinatura).
 */
export const subscriptionActionLabels: Record<string, string> = {
  active: 'reativada',
  paused: 'pausada',
  canceled: 'cancelada',
};

/**
 * Verifica se um valor é um SubscriptionStatus válido.
 */
export const isSubscriptionStatus = (
  value: string,
): value is SubscriptionStatus => value in subscriptionStatusMeta;
