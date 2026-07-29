/**
 * [SMG][SHARED][STATUS] voucher
 *
 * Status de vouchers de cliente: labels, cores.
 * Substitui definições em vouchers.ts, CustomerVouchersSection.tsx.
 */

export type CustomerVoucherStatus = 'available' | 'used' | 'expired' | 'cancelled';

/**
 * Labels de status de voucher.
 */
export const customerVoucherStatusLabels: Record<
  CustomerVoucherStatus,
  string
> = {
  available: 'Disponível',
  used: 'Usado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

/**
 * Cores de badge para status de voucher.
 */
export const customerVoucherStatusStyles: Record<CustomerVoucherStatus, string> = {
  available:
    'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  used: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20',
  expired:
    'bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
  cancelled:
    'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
};
