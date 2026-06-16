const REVERSAL_ERROR_MESSAGE =
  'Não foi possível registrar a reversão financeira. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';
const REVERSAL_TIMEOUT_MS = 30000;

export type FinancialReversalType =
  | 'wrong_settlement'
  | 'full_refund'
  | 'partial_refund'
  | 'duplicate_charge'
  | 'administrative_cancellation'
  | 'financial_review';

export interface ReverseFinancialTransactionInput {
  tenantId: string;
  originalTransactionId: string;
  supabase: any;
  reversalType: FinancialReversalType;
  amount: number;
  reasonType: string;
  reasonNote: string;
  refundMethod?: string | null;
  reversalDate?: string;
  idempotencyKey?: string | null;
}

export interface ReverseFinancialTransactionResult {
  success: boolean;
  idempotent: boolean;
  financialReversalId: string;
  originalTransactionId: string;
  reversalTransactionId: string;
  message: string;
}

export const createReversalKey = (originalTransactionId: string) => {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `finance-reversal-${originalTransactionId}-${randomId}`;
};

const withReversalTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao registrar a reversão financeira.')), REVERSAL_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const reverseFinancialTransaction = async ({
  tenantId,
  originalTransactionId,
  supabase,
  reversalType,
  amount,
  reasonType,
  reasonNote,
  refundMethod,
  reversalDate,
  idempotencyKey,
}: ReverseFinancialTransactionInput): Promise<ReverseFinancialTransactionResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para reversão financeira.');
  if (!originalTransactionId) throw new Error('transaction original obrigatória para reversão financeira.');
  if (!reversalType) throw new Error('Tipo de reversão obrigatório.');
  if (!reasonType) throw new Error('Motivo obrigatório para reversão financeira.');
  if (!reasonNote?.trim()) throw new Error('Observação obrigatória para reversão financeira.');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor de reversão deve ser maior que zero.');
  }

  const key = idempotencyKey || createReversalKey(originalTransactionId);
  console.info('finance_reverse_transaction request:', {
    tenantId,
    originalTransactionId,
    reversalType,
    amount,
    reasonType,
    refundMethod: refundMethod || null,
    reversalDate: reversalDate || new Date().toISOString(),
    idempotencyKey: key,
  });
  const { data, error } = await withReversalTimeout<any>(
    supabase.rpc('finance_reverse_transaction', {
      p_tenant_id: tenantId,
      p_original_transaction_id: originalTransactionId,
      p_reversal_type: reversalType,
      p_amount: amount,
      p_reason_type: reasonType,
      p_reason_note: reasonNote.trim(),
      p_refund_method: refundMethod || null,
      p_reversal_date: reversalDate || new Date().toISOString(),
      p_idempotency_key: key,
    }),
  );

  if (error) {
    console.error('finance_reverse_transaction failed:', error);
    const details = error.message ? ` Detalhe técnico: ${error.message}` : '';
    throw new Error(`${REVERSAL_ERROR_MESSAGE}${details}`);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('finance_reverse_transaction returned an invalid result:', result);
    throw new Error(REVERSAL_ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    financialReversalId: result.financial_reversal_id,
    originalTransactionId: result.original_transaction_id || originalTransactionId,
    reversalTransactionId: result.reversal_transaction_id,
    message: result.message || 'Reversão financeira registrada com sucesso.',
  };
};
