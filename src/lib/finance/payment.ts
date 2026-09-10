import { logSupabaseError } from '../supabase/errors';

const RPC_TIMEOUT_MS = 30000;
const ERROR_MESSAGE = 'Não foi possível registrar o pagamento. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';

const withRpcTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao registrar pagamento.')), RPC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── P7: register_comanda_payment ──────────────────────────────
// Registra pagamento parcial/antecipado em comanda_payments (M3).
// NÃO altera status da comanda, attended_at, nem comissão.
// Gate: recepção + gestão. Idempotente via idempotency_key.

export type ComandaPaymentType = 'anticipado' | 'parcial' | 'total';

export interface RegisterComandaPaymentInput {
  tenantId: string;
  comandaId: string;
  paymentType: ComandaPaymentType;
  amount: number;
  paymentMethod?: string | null;
  motivo?: string | null;
  idempotencyKey?: string | null;
  supabase: any;
}

export interface RegisterComandaPaymentResult {
  success: boolean;
  idempotent: boolean;
  comandaId: string;
  paymentType: string;
  amount: number;
  totalPaid: number;
  comandaTotal: number;
  remaining: number;
  message: string;
}

export const registerComandaPayment = async ({
  tenantId,
  comandaId,
  paymentType,
  amount,
  paymentMethod = null,
  motivo = null,
  idempotencyKey = null,
  supabase,
}: RegisterComandaPaymentInput): Promise<RegisterComandaPaymentResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para registro de pagamento.');
  if (!comandaId) throw new Error('comanda_id obrigatório para registro de pagamento.');
  if (!paymentType) throw new Error('Tipo de pagamento obrigatório (anticipado, parcial ou total).');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor do pagamento deve ser maior que zero.');
  }

  const key = idempotencyKey || `comanda-payment-${comandaId}-${globalThis.crypto?.randomUUID?.() || Date.now()}`;

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('register_comanda_payment', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_payment_type: paymentType,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_motivo: motivo,
      p_idempotency_key: key,
    }),
  );

  if (error) {
    logSupabaseError('[payment] register_comanda_payment failed', error, {
      comandaId,
      tenantId,
      paymentType,
      amount,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[payment] register_comanda_payment returned an invalid result:', {
      result,
      comandaId,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    idempotent: Boolean(result.idempotent),
    comandaId: result.comanda_id || comandaId,
    paymentType: result.payment_type || paymentType,
    amount: Number(result.amount || amount),
    totalPaid: Number(result.total_paid || 0),
    comandaTotal: Number(result.comanda_total || 0),
    remaining: Number(result.remaining || 0),
    message: result.message || 'Pagamento registrado com sucesso.',
  };
};

// ─── P7: get_comanda_payment_summary ───────────────────────────
// Resumo de pagamentos válidos de uma comanda (para UI e decisões).

export interface GetComandaPaymentSummaryInput {
  tenantId: string;
  comandaId: string;
  supabase: any;
}

export interface ComandaPaymentSummary {
  comandaId: string;
  comandaTotal: number;
  totalPaid: number;
  remaining: number;
  paymentCount: number;
  hasValidPayments: boolean;
  payments: Array<{
    id: string;
    paymentType: string;
    amount: number;
    paymentMethod: string | null;
    createdAt: string;
  }>;
}

export const getComandaPaymentSummary = async ({
  tenantId,
  comandaId,
  supabase,
}: GetComandaPaymentSummaryInput): Promise<ComandaPaymentSummary> => {
  if (!tenantId) throw new Error('tenant_id obrigatório.');
  if (!comandaId) throw new Error('comanda_id obrigatório.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('get_comanda_payment_summary', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
    }),
  );

  if (error) {
    logSupabaseError('[payment] get_comanda_payment_summary failed', error, {
      comandaId,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  const rawPayments: Array<Record<string, unknown>> = Array.isArray(result.payments) ? result.payments : [];
  return {
    comandaId: result.comanda_id || comandaId,
    comandaTotal: Number(result.comanda_total || 0),
    totalPaid: Number(result.total_paid || 0),
    remaining: Number(result.remaining || 0),
    paymentCount: Number(result.payment_count || 0),
    hasValidPayments: Boolean(result.has_valid_payments),
    payments: rawPayments.map((p) => ({
      id: String(p.id || ''),
      paymentType: String(p.payment_type || ''),
      amount: Number(p.amount || 0),
      paymentMethod: p.payment_method ? String(p.payment_method) : null,
      createdAt: String(p.created_at || ''),
    })),
  };
};