/**
 * [SMG][DOMAIN][BILLING] contracts
 *
 * Contratos puros do domínio de billing: interfaces e DTOs de persistência.
 * Zero imports de arquivos irmãos — este módulo é a única fonte de verdade
 * dos contratos, e tanto a implementação in-memory quanto a implementação
 * Supabase dependem APENAS dele (ADR-027).
 *
 * `BillingSubscription` vem de `./types` (que ja existia com os tipos de
 * dominio). Nao ha dependencia de `./repository` nem de
 * `./supabaseBillingRepository` — e essa separacao que elimina o ciclo.
 */

import type { BillingSubscription, InvoiceDraft } from './types';
import { RepositoryError } from '../shared/errors';

export type { InvoiceDraft } from './types';
export { RepositoryError };

export interface ApplyTransitionInput {
  subscriptionId: string;
  status: BillingSubscription['status'];
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  canceledAt?: string | null;
  clearCancelRequest?: boolean;
  /** D-6.0.5.4-5: fim da janela de grace — null limpa ao sair de past_due/suspended. */
  graceEndsAt?: string | null;
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
