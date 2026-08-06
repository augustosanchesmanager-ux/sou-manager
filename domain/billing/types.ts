/**
 * [SMG][DOMAIN][BILLING] types
 *
 * Tipos do domínio de billing (Lifecycle Billing 6.0.4.4).
 * Domínio puro — zero dependência de Supabase/React.
 *
 * DESCRIÇÃO DOS ESTADOS (D2, aprovado PO 2026-08-06):
 *   - trialing: trial em andamento (14 dias do provisionamento, D3)
 *   - active:   contrato ativo (pago ou free)
 *   - past_due: período de tolerância (grace de 5 dias, D3) — sem gateway,
 *               permanece aqui até decisão de suspensão (6.0.5)
 *   - cancelled: encerrado (via engine, após cancel_at_period_end)
 *
 * CICLO DE FATURAMENTO:
 *   - Invoice somente para planos pagos (pro/premium) em renovação (D-C)
 *   - free e trial NUNCA emitem invoice
 *   - amount é PLACEHOLDER 0 — preços reais só com gateway (futuro)
 */

export type TenantPlan = 'free' | 'pro' | 'premium';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

/** Duração do período de renovação (1 mês). */
export const BILLING_PERIOD_DAYS = 30;

/** Grace period após trial/past_due antes de qualquer suspensão (D3: 5 dias). */
export const GRACE_PERIOD_DAYS = 5;

/** Plano free não fatura (D-C). */
export const PAID_PLANS: readonly TenantPlan[] = ['pro', 'premium'];

/** Entidade de assinatura de tenant (espelha a tabela subscriptions). */
export interface BillingSubscription {
  id: string;
  tenantId: string;
  plan: TenantPlan;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  /** Pedido de cancelamento: encerrar no fim do período (D-A). */
  cancelAtPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
}

/** Invoice a ser persistida (idempotente por idempotencyKey). */
export interface InvoiceDraft {
  subscriptionId: string;
  tenantId: string;
  amount: number;
  dueDate: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  idempotencyKey: string;
}

/** Transição computada pelo engine (fonte da verdade — sem I/O). */
export type BillingAction =
  | { type: 'none' }
  | { type: 'activate_free'; newPeriodStart: string; newPeriodEnd: string }
  | { type: 'start_past_due' }
  | { type: 'renew'; newPeriodStart: string; newPeriodEnd: string; issueInvoice: boolean }
  | { type: 'finalize_cancellation' };

/** Resultado de uma execução de ciclo. */
export interface BillingCycleReport {
  asOf: string;
  scanned: number;
  transitions: Array<{
    subscriptionId: string;
    tenantId: string;
    action: BillingAction['type'];
  }>;
}
