/**
 * [SMG][SHARED][STATUS] commission
 *
 * Status de comissões: labels, derivação a partir do status da comanda.
 * Substitui definições em Commissions.tsx.
 */

export type CommissionStatusFilter = 'all' | 'confirmed' | 'pending' | 'cancelled';

/**
 * Labels de filtro de comissão.
 */
export const commissionStatusLabels: Record<CommissionStatusFilter, string> = {
  all: 'Todos',
  confirmed: 'Confirmada',
  pending: 'Pendente',
  cancelled: 'Cancelada',
};

/**
 * Deriva o status de comissão a partir do status da comanda.
 */
export const getCommissionStatus = (comandaStatus: string): string => {
  if (comandaStatus === 'paid') return 'confirmed';
  if (comandaStatus === 'cancelled') return 'cancelled';
  return 'pending';
};

/**
 * Deriva o label de pagamento a partir do status da comanda.
 */
export const getCommissionPaymentLabel = (comandaStatus: string): string => {
  if (comandaStatus === 'paid') return 'Pago';
  if (comandaStatus === 'cancelled') return 'Cancelado';
  return 'Pendente';
};

/**
 * Verifica se um valor é um CommissionStatusFilter válido.
 */
export const isCommissionStatusFilter = (
  value: string,
): value is CommissionStatusFilter =>
  value in commissionStatusLabels;
