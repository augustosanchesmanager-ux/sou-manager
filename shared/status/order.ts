/**
 * [SMG][SHARED][STATUS] order
 *
 * Status de pedidos de compra: labels, cores.
 * Substitui definições em Orders.tsx.
 */

export type OrderStatus = 'pending' | 'approved' | 'ordered' | 'received' | 'cancelled';

/**
 * Labels de status de pedido.
 */
export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Aguardando Aprovação',
  approved: 'Aprovado',
  ordered: 'Pedido Enviado',
  received: 'Mercadoria Recebida',
  cancelled: 'Cancelado',
};

/**
 * Cores de badge para status de pedido.
 */
export const orderStatusColors: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  approved: 'bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-300',
  ordered: 'bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-300',
  received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
};

/**
 * Verifica se um valor é um OrderStatus válido.
 */
export const isOrderStatus = (value: string): value is OrderStatus =>
  value in orderStatusLabels;
