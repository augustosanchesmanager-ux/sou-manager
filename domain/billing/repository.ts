/**
 * [SMG][DOMAIN][BILLING] repository
 *
 * Porta de persistência do domínio de billing.
 *
 * DESIGN:
 *   - BillingEngine (TS puro) decide; o repositório apenas persiste
 *   - Em produção, todas as escritas passam por RPCs SECURITY DEFINER
 *     (apply_subscription_transition / create_invoice / mark_invoice_paid /
 *      record_payment_attempt) — as tabelas de billing têm RLS somente SELECT
 *   - applyTransition também espelha tenants.status (a RPC faz o mapeamento)
 *   - createInvoice é IDEMPOTENTE por (tenant_id, idempotency_key) — evita
 *     duplicação de invoice no runCycle (pedido D-C do PO)
 *   - In-memory factory para testes (mesma semântica da produção)
 */

import type { BillingSubscription, InvoiceDraft } from './types';

export { RepositoryError } from '../shared/errors';
export type { InvoiceDraft } from './types';
export { supabaseBillingRepository } from './supabaseBillingRepository';

export interface ApplyTransitionInput {
  subscriptionId: string;
  status: BillingSubscription['status'];
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  clearCancelRequest?: boolean;
}

export interface Invoice {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  status: 'issued' | 'paid';
  amount: number;
  dueDate: string;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  paidAt: string | null;
  idempotencyKey: string | null;
  createdAt: string;
}

export interface RecordAttemptInput {
  invoiceId: string;
  tenantId: string;
  status: 'success' | 'failed';
  provider?: string | null;
  error?: string | null;
}

export interface PaymentAttempt {
  id: string;
  invoiceId: string;
  tenantId: string;
  status: 'success' | 'failed';
  provider: string | null;
  error: string | null;
  attemptedAt: string;
}

export interface BillingRepository {
  /** Assinaturas ativas candidatas a processamento no instante asOf. */
  findDueSubscriptions(asOf: string): Promise<BillingSubscription[]>;
  /** Busca uma assinatura por id. */
  getSubscription(subscriptionId: string): Promise<BillingSubscription | null>;
  /** Persiste transição computada pelo engine (subscription + tenants.status). */
  applyTransition(input: ApplyTransitionInput): Promise<BillingSubscription>;
  /** Cria invoice (idempotente por tenantId+idempotencyKey). */
  createInvoice(draft: InvoiceDraft): Promise<Invoice>;
  getInvoice(invoiceId: string): Promise<Invoice | null>;
  /** Marca invoice paga (idempotente — não re-escreve paid_at). */
  markInvoicePaid(invoiceId: string): Promise<Invoice>;
  /** Append-only em payment_attempts. */
  recordPaymentAttempt(input: RecordAttemptInput): Promise<PaymentAttempt>;
}

// ─── In-memory (testes) ────────────────────────────────────────────

const addDays = (iso: string, days: number): string => {
  const d = new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
};

/**
 * Implementação in-memory com a MESMA semântica da produção (idempotência
 * por idempotencyKey, mirror de tenants.status, append-only em attempts).
 */
export function createInMemoryBillingRepository(initial: BillingSubscription[] = []) {
  let subscriptions: BillingSubscription[] = [...initial];
  let invoices: Invoice[] = [];
  let attempts: PaymentAttempt[] = [];
  const tenantStatuses = new Map<string, string>();

  const toEpoch = (iso: string | null): number =>
    iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;

  return {
    async findDueSubscriptions(asOf: string): Promise<BillingSubscription[]> {
      return subscriptions.filter(
        (s) =>
          s.status !== 'cancelled' &&
          Math.min(
            toEpoch(s.trialEndsAt),
            toEpoch(s.currentPeriodEnd),
            toEpoch(s.cancelAtPeriodEnd),
          ) <= new Date(asOf).getTime(),
      );
    },

    async getSubscription(subscriptionId: string): Promise<BillingSubscription | null> {
      return subscriptions.find((s) => s.id === subscriptionId) ?? null;
    },

    async applyTransition(input: ApplyTransitionInput): Promise<BillingSubscription> {
      const idx = subscriptions.findIndex((s) => s.id === input.subscriptionId);
      if (idx === -1) throw new Error(`Subscription not found: ${input.subscriptionId}`);

      const current = subscriptions[idx];
      const next: BillingSubscription = {
        ...current,
        status: input.status,
        currentPeriodStart:
          input.currentPeriodStart !== undefined ? input.currentPeriodStart : current.currentPeriodStart,
        currentPeriodEnd:
          input.currentPeriodEnd !== undefined ? input.currentPeriodEnd : current.currentPeriodEnd,
        canceledAt:
          input.canceledAt !== undefined ? input.canceledAt : current.canceledAt,
        cancelAtPeriodEnd:
          input.clearCancelRequest ? null : current.cancelAtPeriodEnd,
      };
      subscriptions = subscriptions.map((s) => (s.id === next.id ? next : s));

      const tenantStatus: Record<BillingSubscription['status'], string> = {
        trialing: 'trial',
        active: 'active',
        past_due: 'past_due',
        cancelled: 'cancelled',
      };
      tenantStatuses.set(next.tenantId, tenantStatus[next.status]);

      return next;
    },

    async createInvoice(draft: InvoiceDraft): Promise<Invoice> {
      const existing = invoices.find(
        (i) => i.tenantId === draft.tenantId && i.idempotencyKey === draft.idempotencyKey,
      );
      if (existing) return existing;

      const invoice: Invoice = {
        id: `inv_${invoices.length + 1}`,
        tenantId: draft.tenantId,
        subscriptionId: draft.subscriptionId,
        status: 'issued',
        amount: draft.amount,
        dueDate: draft.dueDate,
        billingPeriodStart: draft.billingPeriodStart,
        billingPeriodEnd: draft.billingPeriodEnd,
        paidAt: null,
        idempotencyKey: draft.idempotencyKey,
        createdAt: new Date().toISOString(),
      };
      invoices = [...invoices, invoice];
      return invoice;
    },

    async getInvoice(invoiceId: string): Promise<Invoice | null> {
      return invoices.find((i) => i.id === invoiceId) ?? null;
    },

    async markInvoicePaid(invoiceId: string): Promise<Invoice> {
      const invoice = invoices.find((i) => i.id === invoiceId);
      if (!invoice) throw new Error(`Invoice not found: ${invoiceId}`);
      if (invoice.status === 'paid') return invoice;
      const paidAt = new Date().toISOString();
      const updated: Invoice = { ...invoice, status: 'paid', paidAt };
      invoices = invoices.map((i) => (i.id === invoiceId ? updated : i));
      return updated;
    },

    async recordPaymentAttempt(input: RecordAttemptInput): Promise<PaymentAttempt> {
      const attempt: PaymentAttempt = {
        id: `att_${attempts.length + 1}`,
        invoiceId: input.invoiceId,
        tenantId: input.tenantId,
        status: input.status,
        provider: input.provider ?? null,
        error: input.error ?? null,
        attemptedAt: new Date().toISOString(),
      };
      attempts = [...attempts, attempt];
      return attempt;
    },

    // Helpers de inspeção (testes)
    __seedTenantStatus(tenantId: string, status: string): void {
      tenantStatuses.set(tenantId, status);
    },
    __getTenantStatus(tenantId: string): string | undefined {
      return tenantStatuses.get(tenantId);
    },
    __listInvoices(): Invoice[] {
      return invoices;
    },
    __listAttempts(): PaymentAttempt[] {
      return attempts;
    },
    __listSubscriptions(): BillingSubscription[] {
      return subscriptions;
    },
  };
}

export type InMemoryBillingRepository = ReturnType<typeof createInMemoryBillingRepository>;
