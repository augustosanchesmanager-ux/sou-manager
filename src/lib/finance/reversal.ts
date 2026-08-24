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

      // TD-001 B3.4-H: only REAL schema columns here. The previous version
      // selected the phantom column `comandas.payment_amount`, which made
      // PostgREST fail and silently skip the event publish.
      const { data: comandaData } = await supabase
        .from('comandas')
        .select('id, discount')
        .eq('id', comandaId)
        .eq('tenant_id', tenantId)
        .single();

      if (comandaData) {
        const { data: items } = await supabase
          .from('comanda_items')
          .select('id, unit_price, quantity, discount, staff_id')
          .eq('comanda_id', comandaId)
          .eq('tenant_id', tenantId);

        let originalCommission = 0;
        let originalReceivedValue = originalTotal;

        if (items && items.length > 0) {
          const { resolveFinancialBase, calculateCommissionValue } =
            await import('../../../domain/commission/calculate');
          const { receivesCommission, getEffectiveCommissionRate } =
            await import('../staff/roles');

          const totalGross = items.reduce(
            (sum: number, item: any) =>
              sum + Number(item.unit_price || 0) * Number(item.quantity || 1),
            0
          );
          const discountAmount = Number(comandaData.discount || 0);
          originalReceivedValue = Math.max(0, totalGross - discountAmount);

          // TD-001 B3.4-H: real table is service_execution_participants
          // (keyed by comanda_item_id). The phantom `commission_participants`
          // table never existed and silently killed the publish chain.
          const itemIds = items.map((i: any) => i.id).filter(Boolean);
          const { data: participants } = itemIds.length > 0
            ? await supabase
                .from('service_execution_participants')
                .select('comanda_item_id, staff_id, affects_commission, payout_type, payout_value')
                .eq('tenant_id', tenantId)
                .in('comanda_item_id', itemIds)
            : { data: [] };

          const staffIds = [
            ...new Set((participants || []).map((p: any) => p.staff_id).filter(Boolean)),
          ];
          const staffById = new Map<string, any>();
          if (staffIds.length > 0) {
            const { data: staffRows } = await supabase
              .from('staff')
              .select('id, role, status, commission_rate')
              .eq('tenant_id', tenantId)
              .in('id', staffIds);
            (staffRows || []).forEach((s: any) => staffById.set(s.id, s));
          }

          // Reproduce EXACTLY what createCommissionRecordHandler persisted:
          // per item/participant, canonical base × share × staff rate.
          for (const item of items) {
            const itemParticipants = (participants || []).filter(
              (p: any) => p.comanda_item_id === item.id,
            );
            for (const participant of itemParticipants) {
              if (!participant.affects_commission) continue;

              const staff = staffById.get(participant.staff_id);
              if (staff && !receivesCommission(staff)) continue;

              const financialBase = resolveFinancialBase({
                item: {
                  unit_price: Number(item.unit_price || 0),
                  quantity: Number(item.quantity || 1),
                  discount: Number(item.discount || 0),
                },
                discount: discountAmount,
                paidAmount: originalReceivedValue,
                quantity: Number(item.quantity || 1),
              });

              const rate = getEffectiveCommissionRate(staff);
              originalCommission += calculateCommissionValue(
                financialBase.receivedValue,
                participant,
                rate,
              );
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
    // Event publishing failure should not block the reversal itself, but it
    // MUST be observable: this exact catch previously hid two schema-drift
    // failures behind a console.warn that no monitor filtered.
    console.error('[REVERSAL][EVENT-PUBLISH-FAILED] CheckoutReverted was NOT published:', eventError);
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
