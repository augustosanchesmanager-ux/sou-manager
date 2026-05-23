import { getClientForTable } from '../../../services/supabaseClient';
import type { CreateCustomerVoucherInput, CustomerVoucher } from '../../types/vouchers';

const VOUCHERS_APP_SLUG = 'barber';
export const CUSTOMER_VOUCHERS_UNAVAILABLE_MESSAGE =
  'Vouchers de cliente ainda não estão configurados neste ambiente.';
const VOUCHERS_UNAVAILABLE_CODES = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);

export const isCustomerVouchersUnavailableError = (error: unknown) => {
  const candidate = error as { code?: string; message?: string } | null;
  const code = String(candidate?.code || '');
  const message = String(candidate?.message || '').toLowerCase();
  return VOUCHERS_UNAVAILABLE_CODES.has(code)
    || message.includes('vouchers de cliente ainda não estão configurados')
    || message.includes('customer_vouchers')
    || message.includes('could not find the table');
};

const createUnavailableError = () => new Error(CUSTOMER_VOUCHERS_UNAVAILABLE_MESSAGE);

const cleanText = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalNumber = (value?: number | null) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const listCustomerVouchers = async (
  tenantId: string,
  customerId: string,
): Promise<CustomerVoucher[]> => {
  if (!tenantId || !customerId) return [];

  const client = getClientForTable('customer_vouchers', VOUCHERS_APP_SLUG);
  const { data, error } = await client
    .from('customer_vouchers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    if (isCustomerVouchersUnavailableError(error)) throw createUnavailableError();
    throw error;
  }

  return (data || []) as CustomerVoucher[];
};

export const countAvailableCustomerVouchers = async (
  tenantId: string,
  customerId: string,
): Promise<number> => {
  if (!tenantId || !customerId) return 0;

  const nowIso = new Date().toISOString();
  const client = getClientForTable('customer_vouchers', VOUCHERS_APP_SLUG);
  const { count, error } = await client
    .from('customer_vouchers')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('customer_id', customerId)
    .eq('status', 'available')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

  if (error) {
    if (isCustomerVouchersUnavailableError(error)) throw createUnavailableError();
    throw error;
  }

  return count || 0;
};

export const createCustomerVoucher = async (
  input: CreateCustomerVoucherInput,
): Promise<CustomerVoucher> => {
  if (!input.tenantId || !input.customerId) {
    throw new Error('Tenant e cliente são obrigatórios para criar voucher.');
  }

  const title = cleanText(input.title);
  if (!title) {
    throw new Error('Informe um nome para o voucher.');
  }

  const client = getClientForTable('customer_vouchers', VOUCHERS_APP_SLUG);
  const payload = {
    tenant_id: input.tenantId,
    customer_id: input.customerId,
    title,
    description: cleanText(input.description),
    benefit_type: input.benefitType,
    voucher_code: cleanText(input.voucherCode),
    promotion_id: input.promotionId || null,
    service_id: input.serviceId || null,
    discount_amount: normalizeOptionalNumber(input.discountAmount),
    discount_percentage: normalizeOptionalNumber(input.discountPercentage),
    expires_at: input.expiresAt || null,
    notes: cleanText(input.notes),
    issued_by_user_id: input.issuedByUserId || null,
  };

  const { data, error } = await client
    .from('customer_vouchers')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    if (isCustomerVouchersUnavailableError(error)) throw createUnavailableError();
    throw error;
  }

  return data as CustomerVoucher;
};

export const cancelCustomerVoucher = async ({
  tenantId,
  voucherId,
  reason,
  cancelledByUserId,
}: {
  tenantId: string;
  voucherId: string;
  reason: string;
  cancelledByUserId?: string | null;
}): Promise<CustomerVoucher> => {
  const cancellationReason = cleanText(reason);
  if (!tenantId || !voucherId) {
    throw new Error('Tenant e voucher são obrigatórios para cancelamento.');
  }
  if (!cancellationReason) {
    throw new Error('Informe o motivo do cancelamento.');
  }

  const client = getClientForTable('customer_vouchers', VOUCHERS_APP_SLUG);
  const { data, error } = await client
    .from('customer_vouchers')
    .update({
      status: 'cancelled',
      cancellation_reason: cancellationReason,
      cancelled_by_user_id: cancelledByUserId || null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', voucherId)
    .eq('status', 'available')
    .select('*')
    .single();

  if (error) {
    if (isCustomerVouchersUnavailableError(error)) throw createUnavailableError();
    throw error;
  }

  return data as CustomerVoucher;
};

export const markCustomerVoucherUsed = async ({
  tenantId,
  voucherId,
  usedByUserId,
  usedComandaId = null,
}: {
  tenantId: string;
  voucherId: string;
  usedByUserId?: string | null;
  usedComandaId?: string | null;
}): Promise<CustomerVoucher> => {
  if (!tenantId || !voucherId) {
    throw new Error('Tenant e voucher são obrigatórios para marcar uso.');
  }

  const client = getClientForTable('customer_vouchers', VOUCHERS_APP_SLUG);
  const { data, error } = await client
    .from('customer_vouchers')
    .update({
      status: 'used',
      used_at: new Date().toISOString(),
      used_by_user_id: usedByUserId || null,
      used_comanda_id: usedComandaId || null,
    })
    .eq('tenant_id', tenantId)
    .eq('id', voucherId)
    .eq('status', 'available')
    .select('*')
    .single();

  if (error) {
    if (isCustomerVouchersUnavailableError(error)) throw createUnavailableError();
    throw error;
  }

  return data as CustomerVoucher;
};
