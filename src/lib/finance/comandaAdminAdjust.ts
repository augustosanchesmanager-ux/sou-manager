import { logSupabaseError } from '../supabase/errors';
import {
  competenceDateToIso,
  isAuditPinFormatValid,
  isValidCompetenceDate,
  toLocalDateInput,
} from '../audit/competence';

const RPC_TIMEOUT_MS = 30000;
const FALLBACK_ERROR_MESSAGE =
  'Não foi possível registrar o ajuste gerencial da comanda. Nenhuma alteração foi aplicada.';

export type AdjustableComandaStatus = 'open' | 'blocked';

export interface RpcClientLike {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
}

export interface ComandaAdminAdjustmentSnapshot {
  status?: string | null;
  created_at?: string | null;
  payment_date_real?: string | null;
  settled_at?: string | null;
  closed_at?: string | null;
}

export interface AdminAdjustComandaInput {
  tenantId: string;
  comandaId: string;
  reason: string;
  newStatus?: AdjustableComandaStatus | null;
  newCreatedAt?: string | null;
  newPaymentDate?: string | null;
  auditPin?: string | null;
  supabase: RpcClientLike;
}

export interface AdminAdjustComandaResult {
  success: boolean;
  changed: boolean;
  adjustmentId: string | null;
  comandaId: string;
  adjustedFields: string[];
  beforeSnapshot: ComandaAdminAdjustmentSnapshot | null;
  afterSnapshot: ComandaAdminAdjustmentSnapshot | null;
  pinAuthorized: boolean;
  retroactiveAdjustment: boolean;
  message: string;
}

const withRpcTimeout = async <T,>(promise: PromiseLike<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error('Tempo limite excedido ao ajustar comanda.')),
      RPC_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

/**
 * Converte uma data YYYY-MM-DD selecionada pelo gerente para ISO mantendo
 * meio-dia local (evita troca de dia em qualquer fuso), ou valida ISO completo.
 */
export function normalizeAdminAdjustDateToIso(
  dateValue?: string | null,
  now: Date = new Date(),
): string | null {
  const trimmed = dateValue?.trim() || '';
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    if (!isValidCompetenceDate(trimmed, now)) {
      throw new Error('Data informada é inválida ou futura.');
    }
    return competenceDateToIso(trimmed);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Data informada é inválida.');
  }

  const localKey = toLocalDateInput(parsed);
  if (!isValidCompetenceDate(localKey, now)) {
    throw new Error('Data informada não pode ser futura.');
  }

  return parsed.toISOString();
}

export const adminAdjustComandaAudit = async ({
  tenantId,
  comandaId,
  reason,
  newStatus = null,
  newCreatedAt = null,
  newPaymentDate = null,
  auditPin = null,
  supabase,
}: AdminAdjustComandaInput): Promise<AdminAdjustComandaResult> => {
  if (!tenantId) {
    throw new Error('tenant_id obrigatório para ajuste gerencial.');
  }
  if (!comandaId) {
    throw new Error('comanda_id obrigatório para ajuste gerencial.');
  }

  const trimmedReason = reason?.trim() || '';
  if (!trimmedReason) {
    throw new Error('Informe o motivo obrigatório para o ajuste gerencial.');
  }

  if (newStatus !== null && newStatus !== 'open' && newStatus !== 'blocked') {
    throw new Error('Status permitido apenas entre open e blocked.');
  }

  const normalizedCreatedAt = normalizeAdminAdjustDateToIso(newCreatedAt);
  const normalizedPaymentDate = normalizeAdminAdjustDateToIso(newPaymentDate);

  if (!newStatus && !normalizedCreatedAt && !normalizedPaymentDate) {
    throw new Error('Informe ao menos um campo para ajustar.');
  }

  const trimmedPin = auditPin?.trim() || '';
  if (normalizedPaymentDate && !trimmedPin) {
    throw new Error('PIN de gerente obrigatório para alterar data de pagamento.');
  }
  if (trimmedPin && !isAuditPinFormatValid(trimmedPin)) {
    throw new Error('O PIN gerencial deve ter de 6 a 8 dígitos numéricos.');
  }

  const { data, error } = await withRpcTimeout(
    supabase.rpc('admin_adjust_comanda_audit', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_reason: trimmedReason,
      p_new_status: newStatus,
      p_new_created_at: normalizedCreatedAt,
      p_new_payment_date: normalizedPaymentDate,
      p_audit_pin: trimmedPin || null,
    }),
  );

  if (error) {
    logSupabaseError('[comandaAdminAdjust] admin_adjust_comanda_audit failed', error, {
      tenantId,
      comandaId,
      newStatus,
      hasCreatedAt: Boolean(normalizedCreatedAt),
      hasPaymentDate: Boolean(normalizedPaymentDate),
    });
    throw new Error(error.message || FALLBACK_ERROR_MESSAGE);
  }

  const result = (data || {}) as {
    success?: boolean;
    changed?: boolean;
    adjustment_id?: string | null;
    comanda_id?: string;
    adjusted_fields?: string[];
    before_snapshot?: ComandaAdminAdjustmentSnapshot | null;
    after_snapshot?: ComandaAdminAdjustmentSnapshot | null;
    pin_authorized?: boolean;
    retroactive_adjustment?: boolean;
    message?: string;
  };

  if (result.success !== true) {
    throw new Error(FALLBACK_ERROR_MESSAGE);
  }

  return {
    success: true,
    changed: result.changed !== false,
    adjustmentId: result.adjustment_id || null,
    comandaId: result.comanda_id || comandaId,
    adjustedFields: Array.isArray(result.adjusted_fields) ? result.adjusted_fields : [],
    beforeSnapshot: result.before_snapshot || null,
    afterSnapshot: result.after_snapshot || null,
    pinAuthorized: Boolean(result.pin_authorized),
    retroactiveAdjustment: Boolean(result.retroactive_adjustment),
    message: result.message || 'Ajuste gerencial registrado com sucesso.',
  };
};
