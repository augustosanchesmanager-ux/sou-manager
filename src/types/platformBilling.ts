/**
 * Tipos de Faturamento da Plataforma SMG (Platform Billing) e Métricas de SaaS (Subfase 8.6)
 * Referência: ADR-041 (ACCEPTED)
 */

export type PlatformBillingInterval = 'monthly' | 'yearly';

export type PlatformSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';

export type PlatformInvoiceStatus = 'pending' | 'paid' | 'overdue' | 'void';

export type PlatformPaymentMethod = 'pix' | 'credit_card' | 'boleto';

export interface PlatformPlanFeatures {
  public_api?: boolean;
  webhooks?: boolean;
  multi_unit?: boolean;
  financial_erp_sync?: boolean;
  advanced_reports?: boolean;
  dedicated_sla?: boolean;
  [key: string]: unknown;
}

export interface PlatformPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  billing_interval: PlatformBillingInterval;
  max_staff: number;
  max_api_rpm: number;
  features: PlatformPlanFeatures;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlatformSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: PlatformSubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  canceled_at?: string | null;
  trial_ends_at?: string | null;
  created_at: string;
  updated_at: string;
  plan?: PlatformPlan | null;
}

export interface PlatformInvoice {
  id: string;
  subscription_id: string;
  tenant_id: string;
  invoice_number: string;
  amount_cents: number;
  status: PlatformInvoiceStatus;
  due_date: string;
  paid_at?: string | null;
  payment_method?: PlatformPaymentMethod | null;
  payment_link?: string | null;
  pdf_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaaSPlanMetric {
  plan_id: string;
  slug: string;
  name: string;
  subscribers_count: number;
  mrr_cents: number;
}

export interface SaaSExecutiveMetrics {
  mrr_cents: number;
  arr_cents: number;
  active_subscribers: number;
  past_due_subscribers: number;
  trialing_subscribers: number;
  canceled_subscribers: number;
  overdue_invoices_amount_cents: number;
  by_plan: SaaSPlanMetric[];
  calculated_at: string;
}

export interface CreateOrUpdateSubscriptionInput {
  tenantId: string;
  planId: string;
  status?: PlatformSubscriptionStatus;
  currentPeriodDays?: number;
  trialDays?: number;
}

export interface CreatePlatformInvoiceInput {
  subscriptionId: string;
  tenantId: string;
  amountCents: number;
  dueDate: string;
  invoiceNumber?: string;
  paymentMethod?: PlatformPaymentMethod;
  paymentLink?: string;
  pdfUrl?: string;
}

export interface SettleInvoiceResult {
  success: boolean;
  idempotent?: boolean;
  invoice_id: string;
  status: string;
  paid_at: string;
}
