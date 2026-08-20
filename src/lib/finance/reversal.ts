import { logSupabaseError } from '../supabase/errors';
import { appEventBus } from '../../../domain/events/app-bus';
import { createEvent } from '../../../domain/events/types';
import type { CheckoutRevertedEvent } from '../../../domain/events/types';

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
    logSupabaseError('[reversal] finance_reverse_transaction failed', error, {
      originalTransactionId,
      tenantId,
      amount,
      reasonType,
    });
    const details = error.message ? ` Detalhe técnico: ${error.message}` : '';
    throw new Error(`${REVERSAL_ERROR_MESSAGE}${details}`);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[reversal] finance_reverse_transaction returned an invalid result:', {
      result,
      originalTransactionId,
      tenantId,
      amount,
    });
    throw new Error(REVERSAL_ERROR_MESSAGE);
  }

  // FIX-001 G3: Publish CheckoutReverted event for commission reversal
  try {
    const { data: originalTx } = await supabase
      .from('transactions')
      .select('source_id, amount, source_type')
      .eq('id', originalTransactionId)
      .eq('tenant_id', tenantId)
      .single();

    if (originalTx?.source_type === 'comanda' && originalTx?.source_id) {
      const comandaId = originalTx.source_id;
      const originalTotal = Number(originalTx.amount || 0);

      const { data: comandaData } = await supabase
        .from('comandas')
        .select('id, discount, payment_method, payment_amount, status')
        .eq('id', comandaId)
        .eq('tenant_id', tenantId)
        .single();

      if (comandaData) {
        const { data: items } = await supabase
          .from('comanda_items')
          .select('unit_price, quantity, discount, staff_id')
          .eq('comanda_id', comandaId)
          .eq('tenant_id', tenantId);

        let originalCommission = 0;
        let originalReceivedValue = originalTotal;

        if (items && items.length > 0) {
          const { resolveFinancialBase } = await import('../../../domain/commission/calculate');

          const totalGross = items.reduce(
            (sum: number, item: any) => sum + Number(item.unit_price || 0) * Number(item.quantity || 1),
            0
          );
          const discountAmount = Number(comandaData.discount || 0);
          originalReceivedValue = Math.max(0, totalGross - discountAmount);

          const staffIds = [...new Set(items.map((i: any) => i.staff_id).filter(Boolean))];
          if (staffIds.length > 0) {
            const { data: participants } = await supabase
              .from('commission_participants')
              .select('staff_id, affects_commission, payout_type, payout_value')
              .eq('tenant_id', tenantId)
              .in('staff_id', staffIds);

            if (participants && participants.length > 0) {
              for (const item of items) {
                const participant = participants.find((p: any) => p.staff_id === item.staff_id);
                if (!participant?.affects_commission) continue;

                const financialBase = resolveFinancialBase({
                  item: {
                    unit_price: Number(item.unit_price || 0),
                    quantity: Number(item.quantity || 1),
                    discount: Number(item.discount || 0),
                  },
                  discount: 0,
                  paidAmount: Number(comandaData.payment_amount || 0),
                });

                if (financialBase.receivedValue > 0) {
                  const rate = Number(participant.payout_value || 0) / 100;
                  originalCommission += financialBase.receivedValue * rate;
                }
              }
            }
          }
        }

        await appEventBus.publish(createEvent<CheckoutRevertedEvent>({
          eventType: 'CheckoutReverted',
          aggregateId: comandaId,
          aggregateType: 'comanda',
          payload: {
            comandaId,
            reason: reasonType,
            reversedBy: 'system',
            originalTotal,
            reversedAmount: amount,
            originalCommission,
            originalReceivedValue,
          },
          metadata: {
            tenantId,
            source: 'reverseFinancialTransaction',
            correlationId: key,
          },
        }));

        console.info('[reversal] CheckoutReverted event published for comanda:', comandaId, {
          originalCommission,
          originalReceivedValue,
        });
      }
    }
  } catch (eventError) {
    // Event publishing failure should not block the reversal
    console.warn('[reversal] Failed to publish CheckoutReverted event:', eventError);
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
