import { logSupabaseError } from '../supabase/errors';

const SETTLEMENT_ERROR_MESSAGE =
  'Não foi possível registrar a baixa financeira. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';
const SETTLEMENT_TIMEOUT_MS = 30000;

const KNOWN_SETTLEMENT_BUSINESS_ERRORS = [
  'PIN de autorizacao invalido',
  'Lancamento retroativo em caixa fechado exige PIN de gerente',
  'Data de competencia nao pode ser futura',
  'Barbeiro so pode liquidar comandas proprias',
  'Lancamento retroativo permitido apenas para gestores',
  'Caixa do dia ja esta confirmado',
];

const resolveSafeSettlementErrorMessage = (error: unknown): string => {
  const msg = String((error as { message?: string } | null)?.message || '');
  const matched = KNOWN_SETTLEMENT_BUSINESS_ERRORS.find((pattern) =>
    msg.toLowerCase().includes(pattern.toLowerCase()),
  );
  return matched ? msg : SETTLEMENT_ERROR_MESSAGE;
};

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
  auditPin?: string | null;
    /**
     * ADR-018: quando true, a baixa também grava em `comanda_payments`,
     * tornando o regime de caixa verificável.
     *
     * Default FALSE por decisão de negócio: baixa administrativa, liquidação
     * de clube e rotina de inventário não são quitação em dinheiro no
     * balcão, e não devem alimentar o `payoutService`. Só o fechamento
     * normal de comanda pelo checkout envia `true`.
     */
    recordComandaPayment?: boolean;
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

export interface SplitPaymentEntry {
  amount: number;
  paymentMethod: string;
  description?: string | null;
  terminalId?: string | null;
  feePercentage?: number | null;
  feeAmount?: number | null;
  netAmount?: number | null;
  estimatedSettlementDate?: string | null;
}

export interface SplitSettlementInput {
  comandaId: string;
  tenantId: string;
  supabase: any;
  payments: SplitPaymentEntry[];
  paymentDateReal?: string;
  source?: string;
  notes?: string | null;
  idempotencyKey?: string | null;
}

export interface SplitSettlementResult extends CheckoutSettlementResult {
  transactionIds: string[];
  comandaPaymentIds: string[];
  totalPaid: number;
  remaining: number;
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
  recordComandaPayment,
  auditPin,
  outbox,
}: CheckoutSettlementInput & { outbox: OutboxEnqueueData }): Promise<CheckoutSettlementResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para baixa financeira.');
  if (!comandaId) throw new Error('comanda_id obrigatório para baixa financeira.');
  if (!paymentMethod) throw new Error('Forma de pagamento obrigatória para baixa financeira.');
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw new Error('Valor pago deve ser maior que zero para baixa financeira.');
  }

  const key = idempotencyKey || createSettlementKey(comandaId);
  const normalizedAuditPin = auditPin ? String(auditPin).trim() : '';
  const baseParams: Record<string, unknown> = {
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
  };

  const rpcPayload: Record<string, unknown> = {
    ...baseParams,
    p_record_comanda_payment: recordComandaPayment === true,
    ...(normalizedAuditPin ? { p_audit_pin: normalizedAuditPin } : {}),
  };

  let rpcResult = await withSettlementTimeout<any>(
    supabase.rpc('finance_settle_comanda_and_enqueue', rpcPayload),
  );

  // Se foi enviado PIN retroativo e o banco ainda não tem a assinatura ADR-059 (p_audit_pin),
  // nunca remover o PIN silenciosamente.
  if (
    normalizedAuditPin &&
    rpcResult.error &&
    (rpcResult.error.code === 'PGRST202' || String(rpcResult.error.message || '').includes('p_audit_pin'))
  ) {
    throw new Error(
      'O banco de dados ainda não foi atualizado com a migration ADR-059 para validação de PIN retroativo na baixa.',
    );
  }

  // Fallback 1: se o backend tiver a assinatura de 13 parâmetros (sem p_record_comanda_payment)
  if (rpcResult.error && (rpcResult.error.code === 'PGRST202' || String(rpcResult.error.message || '').includes('p_record_comanda_payment'))) {
    rpcResult = await withSettlementTimeout<any>(
      supabase.rpc('finance_settle_comanda_and_enqueue', baseParams),
    );
  }

  // Fallback 2: se finance_settle_comanda_and_enqueue não existir no backend, degrada para settleCheckoutComanda
  if (rpcResult.error && (rpcResult.error.code === 'PGRST202' || String(rpcResult.error.message || '').includes('does not exist'))) {
    console.warn('[settlement] finance_settle_comanda_and_enqueue indisponível, executando fallback via finance_settle_comanda');
    return settleCheckoutComanda({
      comandaId,
      tenantId,
      supabase,
      paymentMethod,
      paidAmount,
      paymentDateReal,
      source,
      notes,
      idempotencyKey: key,
      recordComandaPayment,
      auditPin: normalizedAuditPin || undefined,
    });
  }

  const { data, error } = rpcResult;

  if (error) {
    logSupabaseError('[settlement] finance_settle_comanda_and_enqueue failed', error, {
      comandaId,
      tenantId,
      paymentMethod,
      paidAmount,
    });
    throw new Error(resolveSafeSettlementErrorMessage(error));
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
  recordComandaPayment,
  auditPin,
}: CheckoutSettlementInput): Promise<CheckoutSettlementResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para baixa financeira.');
  if (!comandaId) throw new Error('comanda_id obrigatório para baixa financeira.');
  if (!paymentMethod) throw new Error('Forma de pagamento obrigatória para baixa financeira.');
  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw new Error('Valor pago deve ser maior que zero para baixa financeira.');
  }

  const key = idempotencyKey || createSettlementKey(comandaId);
  const normalizedAuditPin = auditPin ? String(auditPin).trim() : '';
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
      ...(normalizedAuditPin
        ? {
            p_record_comanda_payment: recordComandaPayment === true,
            p_audit_pin: normalizedAuditPin,
          }
        : {}),
    }),
  );

  if (error) {
    logSupabaseError('[settlement] finance_settle_comanda failed', error, {
      comandaId,
      tenantId,
      paymentMethod,
      paidAmount,
    });
    throw new Error(resolveSafeSettlementErrorMessage(error));
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

export interface MarkComandaAsFiadoInput {
  comandaId: string;
  tenantId: string;
  supabase: any;
  dueDate?: string | null;
  note?: string | null;
}

/**
 * Marks an open comanda as fiado (ADR-045) without settling or emitting
 * cash/commission events until actual payment receipt in Accounts Receivable.
 */
export const markComandaAsFiado = async ({
  comandaId,
  tenantId,
  supabase,
  dueDate,
  note,
}: MarkComandaAsFiadoInput): Promise<void> => {
  if (!comandaId || !tenantId || !supabase) {
    throw new Error('Dados obrigatórios ausentes para marcar comanda como fiado.');
  }

  const { error } = await withSettlementTimeout<any>(
    supabase.rpc('mark_comanda_as_fiado', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_due_date: dueDate ?? null,
      p_note: note ?? null,
    }),
  );

  if (error) {
    logSupabaseError('[settlement] mark_comanda_as_fiado failed', error, {
      comandaId,
      tenantId,
    });
    throw new Error(error.message || 'Não foi possível definir a comanda como fiado.');
  }
};

/**
 * ADR-059 D-1/D-2: Liquidação ou pagamento parcial com 1 ou N formas de pagamento (Split Payment).
 * Grava comanda_payments + espelho atômico em transactions cobrando estritamente o saldo restante.
 */
export const settleComandaSplit = async ({
  comandaId,
  tenantId,
  supabase,
  payments,
  paymentDateReal,
  source = 'checkout',
  notes = null,
  idempotencyKey = null,
}: SplitSettlementInput): Promise<SplitSettlementResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para baixa financeira.');
  if (!comandaId) throw new Error('comanda_id obrigatório para baixa financeira.');
  if (!Array.isArray(payments)) throw new Error('Lista de parcelas inválida.');

  const serializedPayments = payments.map((p) => {
    if (!Number.isFinite(p.amount) || p.amount <= 0) {
      throw new Error('Cada parcela deve ter valor maior que zero.');
    }
    if (!p.paymentMethod || !p.paymentMethod.trim()) {
      throw new Error('Forma de pagamento obrigatória em cada parcela.');
    }
    return {
      amount: Math.round(p.amount * 100) / 100,
      payment_method: p.paymentMethod.trim(),
      description: p.description ?? null,
      terminal_id: p.terminalId ?? null,
      fee_percentage: p.feePercentage ?? null,
      fee_amount: p.feeAmount ?? null,
      net_amount: p.netAmount ?? null,
      estimated_settlement_date: p.estimatedSettlementDate ?? null,
    };
  });

  const key = idempotencyKey || createSettlementKey(comandaId);

  const { data, error } = await withSettlementTimeout<any>(
    supabase.rpc('finance_settle_comanda_split', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_payments: serializedPayments,
      p_payment_date_real: paymentDateReal || new Date().toISOString(),
      p_source: source,
      p_notes: notes,
      p_idempotency_key: key,
    }),
  );

  if (error) {
    logSupabaseError('[settlement] finance_settle_comanda_split failed', error, {
      comandaId,
      tenantId,
      splitCount: serializedPayments.length,
    });
    throw new Error(error.message || SETTLEMENT_ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    throw new Error(SETTLEMENT_ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    comandaId: result.comanda_id || comandaId,
    transactionId: result.transaction_id || '',
    transactionIds: Array.isArray(result.transaction_ids) ? result.transaction_ids : [],
    comandaPaymentIds: Array.isArray(result.comanda_payment_ids) ? result.comanda_payment_ids : [],
    status: result.status || 'paid',
    totalPaid: Number(result.total_paid || 0),
    remaining: Number(result.remaining || 0),
    message: result.message || 'Baixa financeira registrada com sucesso.',
  };
};
