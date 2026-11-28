import { logSupabaseError } from '../supabase/errors';
import { DEFAULT_REFUND_METHOD, REFUND_METHODS, type RefundMethod } from './refundConfig';

// ─── ADR-059 D-5: Central de Regras de Negócio por Tenant ──────

export type PartialPaymentCommissionPolicy = 'proportional_cash' | 'only_on_full_settlement';
export type DiscountCommissionBase = 'net_after_discount' | 'respect_discount_bearer';
export type PartialPaymentRoleGate = 'reception_and_management' | 'management_only' | 'disabled';
export type OverdueOpenComandaPolicy = 'auto_pending_payment' | 'manual';
export type OverdueClientNewFiadoPolicy = 'warn' | 'block_with_pin' | 'off';

export interface ManagerPinRules {
  refund: boolean;
  zero_close: boolean;
  discount_above_pct: number;
}

export interface TenantBusinessRules {
  // 1. Comissões
  partial_payment_commission_policy: PartialPaymentCommissionPolicy;
  discount_commission_base: DiscountCommissionBase;
  default_product_commission_rate: number;
  // 2. PDV & Pagamentos
  allow_split_payment: boolean;
  partial_payment_role_gate: PartialPaymentRoleGate;
  require_client_for_partial_or_fiado: boolean;
  // 3. Virada do Dia & Pendências
  overdue_open_comanda_policy: OverdueOpenComandaPolicy;
  default_fiado_due_days: number;
  overdue_client_new_fiado_policy: OverdueClientNewFiadoPolicy;
  // 4. Caixa & Segurança
  refund_method: RefundMethod;
  require_manager_pin_rules: ManagerPinRules;
}

export const DEFAULT_TENANT_BUSINESS_RULES: TenantBusinessRules = {
  partial_payment_commission_policy: 'proportional_cash',
  discount_commission_base: 'net_after_discount',
  default_product_commission_rate: 0,
  allow_split_payment: true,
  partial_payment_role_gate: 'reception_and_management',
  require_client_for_partial_or_fiado: true,
  overdue_open_comanda_policy: 'auto_pending_payment',
  default_fiado_due_days: 15,
  overdue_client_new_fiado_policy: 'warn',
  refund_method: DEFAULT_REFUND_METHOD,
  require_manager_pin_rules: {
    refund: true,
    zero_close: true,
    discount_above_pct: 20,
  },
};

const VALID_PARTIAL_COMMISSION: PartialPaymentCommissionPolicy[] = [
  'proportional_cash',
  'only_on_full_settlement',
];
const VALID_DISCOUNT_BASE: DiscountCommissionBase[] = [
  'net_after_discount',
  'respect_discount_bearer',
];
const VALID_PARTIAL_ROLE_GATE: PartialPaymentRoleGate[] = [
  'reception_and_management',
  'management_only',
  'disabled',
];
const VALID_OVERDUE_POLICY: OverdueOpenComandaPolicy[] = [
  'auto_pending_payment',
  'manual',
];
const VALID_NEW_FIADO_POLICY: OverdueClientNewFiadoPolicy[] = [
  'warn',
  'block_with_pin',
  'off',
];

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

/**
 * Resolve e sanitiza regras de negócio do tenant com defaults canônicos seguros.
 */
export const resolveTenantBusinessRules = (
  raw?: Record<string, unknown> | null,
  fallbackRefundMethod?: string | null,
): TenantBusinessRules => {
  const input = raw || {};
  const rawPin = (input.require_manager_pin_rules || {}) as Record<string, unknown>;
  const candidateRefund = String(input.refund_method || fallbackRefundMethod || DEFAULT_REFUND_METHOD);
  const refundMethod: RefundMethod = REFUND_METHODS.some((m) => m.value === candidateRefund)
    ? (candidateRefund as RefundMethod)
    : DEFAULT_REFUND_METHOD;

  return {
    partial_payment_commission_policy: VALID_PARTIAL_COMMISSION.includes(
      input.partial_payment_commission_policy as PartialPaymentCommissionPolicy,
    )
      ? (input.partial_payment_commission_policy as PartialPaymentCommissionPolicy)
      : DEFAULT_TENANT_BUSINESS_RULES.partial_payment_commission_policy,
    discount_commission_base: VALID_DISCOUNT_BASE.includes(
      input.discount_commission_base as DiscountCommissionBase,
    )
      ? (input.discount_commission_base as DiscountCommissionBase)
      : DEFAULT_TENANT_BUSINESS_RULES.discount_commission_base,
    default_product_commission_rate: clampNumber(
      input.default_product_commission_rate,
      0,
      100,
      DEFAULT_TENANT_BUSINESS_RULES.default_product_commission_rate,
    ),
    allow_split_payment:
      typeof input.allow_split_payment === 'boolean'
        ? input.allow_split_payment
        : DEFAULT_TENANT_BUSINESS_RULES.allow_split_payment,
    partial_payment_role_gate: VALID_PARTIAL_ROLE_GATE.includes(
      input.partial_payment_role_gate as PartialPaymentRoleGate,
    )
      ? (input.partial_payment_role_gate as PartialPaymentRoleGate)
      : DEFAULT_TENANT_BUSINESS_RULES.partial_payment_role_gate,
    require_client_for_partial_or_fiado:
      typeof input.require_client_for_partial_or_fiado === 'boolean'
        ? input.require_client_for_partial_or_fiado
        : DEFAULT_TENANT_BUSINESS_RULES.require_client_for_partial_or_fiado,
    overdue_open_comanda_policy: VALID_OVERDUE_POLICY.includes(
      input.overdue_open_comanda_policy as OverdueOpenComandaPolicy,
    )
      ? (input.overdue_open_comanda_policy as OverdueOpenComandaPolicy)
      : DEFAULT_TENANT_BUSINESS_RULES.overdue_open_comanda_policy,
    default_fiado_due_days: Math.round(
      clampNumber(
        input.default_fiado_due_days,
        1,
        365,
        DEFAULT_TENANT_BUSINESS_RULES.default_fiado_due_days,
      ),
    ),
    overdue_client_new_fiado_policy: VALID_NEW_FIADO_POLICY.includes(
      input.overdue_client_new_fiado_policy as OverdueClientNewFiadoPolicy,
    )
      ? (input.overdue_client_new_fiado_policy as OverdueClientNewFiadoPolicy)
      : DEFAULT_TENANT_BUSINESS_RULES.overdue_client_new_fiado_policy,
    refund_method: refundMethod,
    require_manager_pin_rules: {
      refund:
        typeof rawPin.refund === 'boolean'
          ? rawPin.refund
          : DEFAULT_TENANT_BUSINESS_RULES.require_manager_pin_rules.refund,
      zero_close:
        typeof rawPin.zero_close === 'boolean'
          ? rawPin.zero_close
          : DEFAULT_TENANT_BUSINESS_RULES.require_manager_pin_rules.zero_close,
      discount_above_pct: clampNumber(
        rawPin.discount_above_pct,
        0,
        100,
        DEFAULT_TENANT_BUSINESS_RULES.require_manager_pin_rules.discount_above_pct,
      ),
    },
  };
};

// ─── ADR-059 D-4: Estado financeiro derivado da comanda ────────

export type DerivedComandaPaymentState =
  | 'open'
  | 'partially_paid'
  | 'pending_payment'
  | 'fiado'
  | 'paid'
  | 'cancelled'
  | 'blocked';

export interface DeriveComandaPaymentStateInput {
  status: string;
  isFiado?: boolean | null;
  total: number;
  totalPaid?: number;
  /** Data de competência (appointment.start_time ou comanda.created_at) em YYYY-MM-DD BRT ou ISO */
  serviceDate: string;
  /** Data atual em YYYY-MM-DD BRT */
  todayDateKeyBrt: string;
  paymentPendingSince?: string | null;
  overduePolicy?: OverdueOpenComandaPolicy;
}

const toBrtDateKey = (value: string): string => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(parsed);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
};

/**
 * Deriva o estado financeiro canônico da comanda sem alterar o enum de status operacional (ADR-017/ADR-059 D-4).
 */
export const deriveComandaPaymentState = (
  input: DeriveComandaPaymentStateInput,
): DerivedComandaPaymentState => {
  const status = String(input.status || '').toLowerCase();
  if (status === 'paid' || status === 'closed') return 'paid';
  if (status === 'cancelled') return 'cancelled';
  if (status === 'blocked') return 'blocked';

  if (input.isFiado) return 'fiado';

  const total = Math.max(0, Number(input.total || 0));
  const paid = Math.max(0, Number(input.totalPaid || 0));
  const balance = Math.max(0, total - paid);
  const policy = input.overduePolicy ?? 'auto_pending_payment';

  if (balance > 0.01) {
    const serviceDayKey = toBrtDateKey(input.serviceDate);
    if (
      Boolean(input.paymentPendingSince) ||
      (policy === 'auto_pending_payment' && serviceDayKey < input.todayDateKeyBrt)
    ) {
      return 'pending_payment';
    }
    if (paid > 0.01) return 'partially_paid';
  }

  return 'open';
};

// ─── RPC Wrappers ──────────────────────────────────────────────

const RPC_TIMEOUT_MS = 30000;

const withRpcTimeout = async <T,>(promise: Promise<T>, errorMsg: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), RPC_TIMEOUT_MS);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const getTenantBusinessRules = async ({
  tenantId,
  supabase,
}: {
  tenantId: string;
  supabase: any;
}): Promise<TenantBusinessRules> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para carregar regras de negócio.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('get_tenant_business_rules', { p_tenant_id: tenantId }),
    'Tempo limite excedido ao carregar regras de negócio.',
  );

  if (error) {
    // Fallback seguro se a migration ADR-059 ainda não tiver sido aplicada no ambiente
    if (error.code === 'PGRST202' || String(error.message || '').includes('does not exist')) {
      return { ...DEFAULT_TENANT_BUSINESS_RULES };
    }
    logSupabaseError('[businessRules] get_tenant_business_rules failed', error, { tenantId });
    throw new Error(error.message || 'Não foi possível carregar as regras de negócio.');
  }

  return resolveTenantBusinessRules(data?.business_rules, data?.refund_method);
};

export const upsertTenantBusinessRules = async ({
  tenantId,
  rules,
  supabase,
}: {
  tenantId: string;
  rules: Partial<TenantBusinessRules>;
  supabase: any;
}): Promise<{ success: boolean; rules: TenantBusinessRules; message: string }> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para salvar regras de negócio.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('upsert_tenant_business_rules', {
      p_tenant_id: tenantId,
      p_rules: rules,
    }),
    'Tempo limite excedido ao salvar regras de negócio.',
  );

  if (error) {
    logSupabaseError('[businessRules] upsert_tenant_business_rules failed', error, { tenantId });
    throw new Error(error.message || 'Não foi possível salvar as regras de negócio.');
  }

  if (data?.success !== true) {
    throw new Error('Resposta inválida ao salvar regras de negócio.');
  }

  return {
    success: true,
    rules: resolveTenantBusinessRules(data.business_rules, data.refund_method),
    message: data.message || 'Regras de negócio atualizadas com sucesso.',
  };
};
