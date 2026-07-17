export type CustomerVoucherStatus = 'available' | 'used' | 'expired' | 'cancelled';

export type CustomerVoucherBenefitType =
  | 'free_service'
  | 'discount_fixed'
  | 'discount_percentage'
  | 'custom_benefit';

export interface CustomerVoucher {
  id: string;
  tenant_id: string;
  customer_id: string;
  promotion_id: string | null;
  voucher_code: string | null;
  title: string;
  description: string | null;
  benefit_type: CustomerVoucherBenefitType;
  service_id: string | null;
  discount_amount: number | null;
  discount_percentage: number | null;
  status: CustomerVoucherStatus;
  issued_at: string;
  expires_at: string | null;
  used_at: string | null;
  used_comanda_id: string | null;
  issued_by_user_id: string | null;
  used_by_user_id: string | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomerVoucherInput {
  tenantId: string;
  customerId: string;
  title: string;
  description?: string | null;
  benefitType: CustomerVoucherBenefitType;
  voucherCode?: string | null;
  promotionId?: string | null;
  serviceId?: string | null;
  discountAmount?: number | null;
  discountPercentage?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
  issuedByUserId?: string | null;
}

export const CUSTOMER_VOUCHER_STATUS_LABELS: Record<CustomerVoucherStatus, string> = {
  available: 'Disponível',
  used: 'Usado',
  expired: 'Vencido',
  cancelled: 'Cancelado',
};

export const CUSTOMER_VOUCHER_BENEFIT_LABELS: Record<CustomerVoucherBenefitType, string> = {
  free_service: 'Serviço gratuito',
  discount_fixed: 'Desconto fixo',
  discount_percentage: 'Desconto percentual',
  custom_benefit: 'Benefício personalizado',
};
