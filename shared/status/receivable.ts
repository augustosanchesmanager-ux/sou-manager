/**
 * [SMG][SHARED][STATUS] receivable
 *
 * Status de contas a receber (ChefClub): labels, ícones, cores.
 * Substitui definições em ChefClubReceivables.tsx.
 */

export type ReceivableStatus = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface ReceivableStatusMeta {
  icon: string;
  className: string;
}

/**
 * Labels de status de conta a receber.
 */
export const receivableStatusLabels: Record<
  ReceivableStatus | 'all',
  string
> = {
  all: 'Todos',
  pending: 'Pendente',
  paid: 'Pago',
  overdue: 'Atrasado',
  cancelled: 'Cancelado',
  refunded: 'Estornado',
};

/**
 * Metadados de status de conta a receber (ícone + cor).
 */
export const receivableStatusMeta: Record<
  ReceivableStatus,
  ReceivableStatusMeta
> = {
  pending: {
    icon: 'schedule',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  },
  paid: {
    icon: 'check_circle',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  overdue: {
    icon: 'priority_high',
    className:
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300',
  },
  cancelled: {
    icon: 'block',
    className:
      'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/10 dark:text-slate-300',
  },
  refunded: {
    icon: 'undo',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  },
};

/**
 * Verifica se um valor é um ReceivableStatus válido.
 */
export const isReceivableStatus = (
  value: string,
): value is ReceivableStatus => value in receivableStatusMeta;
