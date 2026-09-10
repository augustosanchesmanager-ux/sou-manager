import { logSupabaseError } from '../supabase/errors';

const RPC_TIMEOUT_MS = 30000;

const withRpcTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao carregar configuração de reembolso.')), RPC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── P8: refund_method por tenant ──────────────────────────────
// settings JSONB em public.tenants. Default: internal_credit.
// Upsert: gate de gestão.

export const REFUND_METHODS = [
  { value: 'internal_credit', label: 'Crédito interno' },
  { value: 'pix', label: 'PIX' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'card_reversal', label: 'Estorno no cartão' },
  { value: 'store_credit', label: 'Crédito na loja' },
] as const;

export type RefundMethod = (typeof REFUND_METHODS)[number]['value'];
export const DEFAULT_REFUND_METHOD: RefundMethod = 'internal_credit';

// ─── get_tenant_refund_method ──────────────────────────────────

export interface GetTenantRefundMethodInput {
  tenantId: string;
  supabase: any;
}

export interface GetTenantRefundMethodResult {
  tenantId: string;
  refundMethod: RefundMethod;
  settings: Record<string, unknown>;
}

export const getTenantRefundMethod = async ({
  tenantId,
  supabase,
}: GetTenantRefundMethodInput): Promise<GetTenantRefundMethodResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para carregar configuração de reembolso.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('get_tenant_refund_method', {
      p_tenant_id: tenantId,
    }),
  );

  if (error) {
    logSupabaseError('[refundConfig] get_tenant_refund_method failed', error, { tenantId });
    throw new Error(error.message || 'Não foi possível carregar a configuração de reembolso.');
  }

  const result = data || {};
  const method = result.refund_method || DEFAULT_REFUND_METHOD;
  return {
    tenantId: result.tenant_id || tenantId,
    refundMethod: (REFUND_METHODS.some((r) => r.value === method) ? method : DEFAULT_REFUND_METHOD) as RefundMethod,
    settings: result.settings || {},
  };
};

// ─── upsert_tenant_refund_method ───────────────────────────────

export interface UpsertTenantRefundMethodInput {
  tenantId: string;
  refundMethod: RefundMethod;
  supabase: any;
}

export interface UpsertTenantRefundMethodResult {
  success: boolean;
  tenantId: string;
  refundMethod: RefundMethod;
  message: string;
}

export const upsertTenantRefundMethod = async ({
  tenantId,
  refundMethod,
  supabase,
}: UpsertTenantRefundMethodInput): Promise<UpsertTenantRefundMethodResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para salvar configuração de reembolso.');
  if (!REFUND_METHODS.some((r) => r.value === refundMethod)) {
    throw new Error('Método de reembolso inválido.');
  }

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('upsert_tenant_refund_method', {
      p_tenant_id: tenantId,
      p_refund_method: refundMethod,
    }),
  );

  if (error) {
    logSupabaseError('[refundConfig] upsert_tenant_refund_method failed', error, { tenantId, refundMethod });
    throw new Error(error.message || 'Não foi possível salvar a configuração de reembolso.');
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[refundConfig] upsert_tenant_refund_method returned an invalid result:', {
      result,
      tenantId,
      refundMethod,
    });
    throw new Error('Não foi possível salvar a configuração de reembolso.');
  }

  return {
    success: true,
    tenantId: result.tenant_id || tenantId,
    refundMethod: result.refund_method || refundMethod,
    message: result.message || 'Configuração de reembolso atualizada com sucesso.',
  };
};