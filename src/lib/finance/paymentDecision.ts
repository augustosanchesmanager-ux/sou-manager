import { logSupabaseError } from '../supabase/errors';

const RPC_TIMEOUT_MS = 30000;
const ERROR_MESSAGE = 'Não foi possível processar a solicitação. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';

const withRpcTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao processar a solicitação.')), RPC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── P1: reverse_comanda_payment ────────────────────────────────
// Marca reversed_at em comanda_payments (append-only). Motivo obrigatório.
// Management gate. Não altera status da comanda (decisão do chamador).

export interface ReverseComandaPaymentInput {
  tenantId: string;
  comandaPaymentId: string;
  motivo: string;
  refundMethod?: string;
  actorId?: string | null;
  supabase: any;
}

export interface ReverseComandaPaymentResult {
  success: boolean;
  idempotent: boolean;
  comandaPaymentId: string;
  comandaId: string;
  amount: number;
  paymentType: string;
  reversedAt: string;
  message: string;
}

export const reverseComandaPayment = async ({
  tenantId,
  comandaPaymentId,
  motivo,
  refundMethod = 'internal_credit',
  actorId = null,
  supabase,
}: ReverseComandaPaymentInput): Promise<ReverseComandaPaymentResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para reversão de pagamento.');
  if (!comandaPaymentId) throw new Error('comanda_payment_id obrigatório para reversão de pagamento.');
  if (!motivo?.trim()) throw new Error('Motivo obrigatório para reversão de pagamento.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('reverse_comanda_payment', {
      p_tenant_id: tenantId,
      p_comanda_payment_id: comandaPaymentId,
      p_motivo: motivo.trim(),
      p_refund_method: refundMethod,
      p_actor_id: actorId,
    }),
  );

  if (error) {
    logSupabaseError('[payment] reverse_comanda_payment failed', error, {
      comandaPaymentId,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[payment] reverse_comanda_payment returned an invalid result:', {
      result,
      comandaPaymentId,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    comandaPaymentId: result.comanda_payment_id || comandaPaymentId,
    comandaId: result.comanda_id,
    amount: Number(result.amount || 0),
    paymentType: result.payment_type || '',
    reversedAt: result.reversed_at || new Date().toISOString(),
    message: result.message || 'Reversão de pagamento registrada com sucesso.',
  };
};

// ─── P1: check_comanda_has_valid_payments ──────────────────────
// Verifica se a comanda possui pagamentos válidos (sem reversed_at).
// Usada pelo frontend para decidir se mostra modal REMARCAR/ESTORNAR.

export interface CheckComandaHasValidPaymentsInput {
  tenantId: string;
  comandaId: string;
  supabase: any;
}

export interface CheckComandaHasValidPaymentsResult {
  hasValidPayments: boolean;
  paymentCount: number;
  totalPaid: number;
}

export const checkComandaHasValidPayments = async ({
  tenantId,
  comandaId,
  supabase,
}: CheckComandaHasValidPaymentsInput): Promise<CheckComandaHasValidPaymentsResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório.');
  if (!comandaId) throw new Error('comanda_id obrigatório.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('check_comanda_has_valid_payments', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
    }),
  );

  if (error) {
    logSupabaseError('[payment] check_comanda_has_valid_payments failed', error, {
      comandaId,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  return {
    hasValidPayments: Boolean(result.has_valid_payments),
    paymentCount: Number(result.payment_count || 0),
    totalPaid: Number(result.total_paid || 0),
  };
};