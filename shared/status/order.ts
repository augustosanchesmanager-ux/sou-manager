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
  approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ordered: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  received: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
};

/**
 * Verifica se um valor é um OrderStatus válido.
 */
export const isOrderStatus = (value: string): value is OrderStatus =>
  value in orderStatusLabels;
