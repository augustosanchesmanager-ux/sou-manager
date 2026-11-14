/**
 * [SMG][SHARED][STATUS] commission
 *
 * Status de comissões: labels, derivação a partir do status da comanda.
 * Substitui definições em Commissions.tsx.
 */

export type CommissionStatusFilter = 'all' | 'confirmed' | 'pending' | 'fiado' | 'cancelled';

/**
 * Labels de filtro de comissão.
 */
export const commissionStatusLabels: Record<CommissionStatusFilter, string> = {
  all: 'Todos',
  confirmed: 'Confirmada / Liberada',
  pending: 'Pendente',
  fiado: 'Aguardando Pagamento (Fiado)',
  cancelled: 'Cancelada',
};

/**
 * Deriva o status de comissão a partir do status da comanda e flag de fiado.
 */
export const getCommissionStatus = (comandaStatus: string, isFiado?: boolean): string => {
  if (comandaStatus === 'paid') return 'confirmed';
  if (comandaStatus === 'cancelled') return 'cancelled';
  if (isFiado) return 'fiado';
  return 'pending';
};

/**
 * Deriva o label de pagamento a partir do status da comanda e flag de fiado.
 */
export const getCommissionPaymentLabel = (comandaStatus: string, isFiado?: boolean): string => {
  if (comandaStatus === 'paid') return 'Pago';
  if (comandaStatus === 'cancelled') return 'Cancelado';
  if (isFiado) return 'Fiado Pendente';
  return 'Pendente';
};

/**
 * Verifica se um valor é um CommissionStatusFilter válido.
 */
export const isCommissionStatusFilter = (
  value: string,
): value is CommissionStatusFilter =>
  value in commissionStatusLabels;
