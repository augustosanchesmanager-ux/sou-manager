export type TransactionStatusBucket = 'realized' | 'pending' | 'cancelled' | 'unknown';

const normalizeStatus = (value: unknown): string => {
  if (value == null) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const REALIZED_STATUSES = new Set([
  'paid',
  'pago',
  'realizado',
  'settled',
  'liquidado',
  'completed',
  'complete',
  'closed',
  'fechado',
]);

const PENDING_STATUSES = new Set([
  'pending',
  'pendente',
  'previsto',
  'scheduled',
  'open',
  'aberto',
]);

const CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'cancelado',
  'void',
  'voided',
]);

export const getTransactionStatusBucket = (status: unknown): TransactionStatusBucket => {
  const normalized = normalizeStatus(status);

  if (!normalized) return 'unknown';
  if (REALIZED_STATUSES.has(normalized)) return 'realized';
  if (PENDING_STATUSES.has(normalized)) return 'pending';
  if (CANCELLED_STATUSES.has(normalized)) return 'cancelled';

  return 'unknown';
};

export const isRealizedTransactionStatus = (status: unknown): boolean =>
  getTransactionStatusBucket(status) === 'realized';

export const isCancelledTransactionStatus = (status: unknown): boolean =>
  getTransactionStatusBucket(status) === 'cancelled';
