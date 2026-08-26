import { logSupabaseError } from '../supabase/errors';

const SETTLEMENT_ERROR_MESSAGE =
  'Não foi possível registrar a baixa financeira. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';
const SETTLEMENT_TIMEOUT_MS = 30000;

export interface CheckoutSettlementInput {
  comandaId: string;
  tenantId: string;
  supabase: any;
  paymentMethod: string;
  paidAmount: number;
  paymentDateReal?: string;
  source?: string;
  notes?: string | null;
  idempotencyKey?: string | null;
  client?: any;
  appointmentId?: string | null;
  clientDb?: any;
  incomeCategory?: string;
  description?: string;
  shouldApplyFinancialEffects?: boolean;
  closure?: {
    mode: string;
    note?: string | null;
    financialEffect: boolean;
    membershipCreditEffect: boolean;
    legacyReferenceMonth?: string | null;
  };
  clientStats?: {
    lastService?: string;
  };
}

export interface CheckoutSettlementResult {
  success: boolean;
  idempotent: boolean;
  comandaId: string;
  transactionId: string;
  status: string;
  message: string;
}

const createSettlementKey = (comandaId: string) => {
  const randomId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `finance-settle-${comandaId}-${randomId}`;
};

const withSettlementTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao registrar a baixa financeira.')), SETTLEMENT_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── D7: Composite RPC — settlement + outbox enqueue (atomic) ──

export interface OutboxEnqueueData {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  targets?: Array<{ provider: string; config: Record<string, unknown> }>;
}

export const settleCheckoutComandaAndEnqueue = async ({
  comandaId,
  tenantId,
  supabase,
  paymentMethod,
  paidAmount,
  paymentDateReal,
  source = 'checkout',
  notes,
  idempotencyKey,
  outbox,
}: CheckoutSettlementInput & { outbox: OutboxEnqueueData }): Promise<CheckoutSettlementResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para baixa financeira.');
  if (!comandaId) throw new Error('comanda_id obrigatório para baixa financeira.');
  if (!paymentMethod) throw new Error('Forma de pagamento obrigatória para baixa financeira.');
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw new Error('Valor pago deve ser maior que zero para baixa financeira.');
  }

  const key = idempotencyKey || createSettlementKey(comandaId);
  const { data, error } = await withSettlementTimeout<any>(
    supabase.rpc('finance_settle_comanda_and_enqueue', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_payment_method: paymentMethod,
      p_paid_amount: paidAmount,
      p_payment_date_real: paymentDateReal || new Date().toISOString(),
      p_source: source,
      p_notes: notes || null,
      p_idempotency_key: key,
      p_outbox_event_id: outbox.eventId,
      p_outbox_event_type: outbox.eventType,
      p_outbox_payload: outbox.payload,
      p_outbox_metadata: outbox.metadata,
      p_outbox_targets: outbox.targets || null,
    }),
  );

  if (error) {
    logSupabaseError('[settlement] finance_settle_comanda_and_enqueue failed', error, {
      comandaId,
      tenantId,
      paymentMethod,
      paidAmount,
    });
    throw new Error(SETTLEMENT_ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[settlement] finance_settle_comanda_and_enqueue returned an invalid result:', {
      result,
      comandaId,
      tenantId,
    });
    throw new Error(SETTLEMENT_ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    comandaId: result.comanda_id || comandaId,
    transactionId: result.transaction_id,
    status: result.status || 'paid',
    message: result.message || 'Baixa financeira registrada com sucesso.',
  };
};

// ─── Original settlement (preserved for non-checkout callers) ──

export const settleCheckoutComanda = async ({
  comandaId,
  tenantId,
  supabase,
  paymentMethod,
  paidAmount,
  paymentDateReal,
  source = 'checkout',
  notes,
  idempotencyKey,
}: CheckoutSettlementInput): Promise<CheckoutSettlementResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para baixa financeira.');
  if (!comandaId) throw new Error('comanda_id obrigatório para baixa financeira.');
  if (!paymentMethod) throw new Error('Forma de pagamento obrigatória para baixa financeira.');
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw new Error('Valor pago deve ser maior que zero para baixa financeira.');
  }

  const key = idempotencyKey || createSettlementKey(comandaId);
  const { data, error } = await withSettlementTimeout<any>(
    supabase.rpc('finance_settle_comanda', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_payment_method: paymentMethod,
      p_paid_amount: paidAmount,
      p_payment_date_real: paymentDateReal || new Date().toISOString(),
      p_source: source,
      p_notes: notes || null,
      p_idempotency_key: key,
    }),
  );

  if (error) {
    logSupabaseError('[settlement] finance_settle_comanda failed', error, {
      comandaId,
      tenantId,
      paymentMethod,
      paidAmount,
    });
    throw new Error(SETTLEMENT_ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[settlement] finance_settle_comanda returned an invalid result:', {
      result,
      comandaId,
      tenantId,
    });
    throw new Error(SETTLEMENT_ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    comandaId: result.comanda_id || comandaId,
    transactionId: result.transaction_id,
    status: result.status || 'paid',
    message: result.message || 'Baixa financeira registrada com sucesso.',
  };
};
