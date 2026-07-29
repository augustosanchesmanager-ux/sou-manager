/**
 * [SMG][SHARED][STATUS] comanda
 *
 * Status de comandas: labels, cores, normalização.
 * Substitui definições em Comandas.tsx, ComandaListItem.tsx, ComandaSidebar.tsx.
 */

export type ComandaStatus = 'blocked' | 'open' | 'paid' | 'cancelled';

export interface ComandaStatusMeta {
  label: string;
  labelEstetica: string;
  className: string;
  dotClassName: string;
}

/**
 * Labels de status de comanda (barber app).
 */
export const comandaStatusLabels: Record<'all' | ComandaStatus, string> = {
  all: 'Todas',
  blocked: 'Bloqueadas',
  open: 'Abertas',
  paid: 'Pagas',
  cancelled: 'Canceladas',
};

/**
 * Labels de status de comanda (estetica app).
 */
export const comandaStatusLabelsEstetica: Record<
  'all' | ComandaStatus,
  string
> = {
  all: 'Todos',
  blocked: 'Bloqueados',
  open: 'Abertos',
  paid: 'Finalizados',
  cancelled: 'Cancelados',
};

/**
 * Metadados completos de status de comanda (barber app).
 */
export const comandaStatusMeta: Record<ComandaStatus, ComandaStatusMeta> = {
  blocked: {
    label: 'Bloqueada',
    labelEstetica: 'Bloqueado',
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    dotClassName: 'bg-sky-500 dark:bg-sky-400',
  },
  open: {
    label: 'Aberta',
    labelEstetica: 'Aberto',
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    dotClassName: 'bg-amber-500 dark:bg-amber-400',
  },
  paid: {
    label: 'Paga',
    labelEstetica: 'Finalizado',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    dotClassName: 'bg-emerald-500 dark:bg-emerald-400',
  },
  cancelled: {
    label: 'Cancelada',
    labelEstetica: 'Cancelado',
    className:
      'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:border-slate-500/20',
    dotClassName: 'bg-slate-400',
  },
};

/**
 * Ordem de sort para status de comanda.
 */
export const comandaStatusSortOrder: Record<ComandaStatus, number> = {
  blocked: -1,
  open: 0,
  paid: 1,
  cancelled: 2,
};

/**
 * Retorna label de pagamento baseado no status.
 */
export const getPaymentStatusLabel = (status: string): string => {
  if (status === 'paid') return 'Pago';
  if (status === 'cancelled') return 'Cancelado';
  return 'Pendente';
};

/**
 * Verifica se um valor é um ComandaStatus válido.
 */
export const isComandaStatus = (value: string): value is ComandaStatus =>
  value in comandaStatusMeta;
