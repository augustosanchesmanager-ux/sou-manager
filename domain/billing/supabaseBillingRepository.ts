/**
 * [SMG][DOMAIN][BILLING] supabaseBillingRepository
 *
 * Implementação de produção do BillingRepository via RPCs SECURITY DEFINER.
 * As tabelas de billing (subscriptions/invoices/billing_events/payment_attempts)
 * têm RLS somente SELECT — TODAS as escritas passam por RPCs.
 *
 * RPCs usadas:
 *   - get_due_subscriptions(p_as_of)        — leitura de candidatas (superadmin: todas; gestor: próprio tenant)
 *   - apply_subscription_transition(...)    — transição computada pelo engine (+ espelha tenants.status)
 *   - create_invoice(...)                   — INSERT idempotente (UNIQUE tenant_id + idempotency_key)
 *   - mark_invoice_paid(...)                — pagamento manual confirmado (sem gateway)
 *   - record_payment_attempt(...)           — append-only em payment_attempts
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { SupabaseRepository } from '../shared/supabase-repository';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import {
  type ApplyTransitionInput,
  type BillingRepository,
  type Invoice,
  type PaymentAttempt,
  type RecordAttemptInput,
} from './repository';
import type { BillingSubscription } from './types';

const toSubscription = (row: Record<string, unknown>): BillingSubscription => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  plan: row.plan as BillingSubscription['plan'],
  status: row.status as BillingSubscription['status'],
  trialStartedAt: (row.trial_started_at as string) ?? null,
  trialEndsAt: (row.trial_ends_at as string) ?? null,
  currentPeriodStart: (row.current_period_start as string) ?? null,
  currentPeriodEnd: (row.current_period_end as string) ?? null,
  cancelAtPeriodEnd: (row.cancel_at_period_end as string) ?? null,
  canceledAt: (row.canceled_at as string) ?? null,
  graceEndsAt: (row.grace_ends_at as string) ?? null,
  createdAt: row.created_at as string,
});

const toInvoice = (row: Record<string, unknown>): Invoice => ({
  id: row.id as string,
  tenantId: row.tenant_id as string,
  subscriptionId: (row.subscription_id as string) ?? null,
  status: (row.status as Invoice['status']) ?? 'issued',
  amount: Number(row.amount ?? 0),
  dueDate: row.due_date as string,
  billingPeriodStart: (row.billing_period_start as string) ?? null,
  billingPeriodEnd: (row.billing_period_end as string) ?? null,
  paidAt: (row.paid_at as string) ?? null,
  idempotencyKey: null,
  createdAt: new Date().toISOString(),
});

const toPaymentAttempt = (row: Record<string, unknown>): PaymentAttempt => ({
  id: row.id as string,
  invoiceId: row.invoice_id as string,
  tenantId: row.tenant_id as string,
  status: row.status as PaymentAttempt['status'],
  provider: (row.provider as string) ?? null,
  error: (row.error as string) ?? null,
  attemptedAt: row.attempted_at as string,
});

/** Extrai a primeira linha de um resultado RPC (array ou objeto). */
const firstRow = (data: unknown): Record<string, unknown> | null => {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  return (data as Record<string, unknown>) ?? null;
};

class SupabaseBillingRepository extends SupabaseRepository implements BillingRepository {
  constructor(db?: DatabaseClient) {
    super('subscriptions', db ?? createSupabaseClient('subscriptions', 'barber'));
  }

  async findDueSubscriptions(asOf: string): Promise<BillingSubscription[]> {
    try {
      const result = await this.db.rpc('get_due_subscriptions', { p_as_of: asOf });
      const data = this.extractData<Record<string, unknown>[] | null>(
        result,
        'Erro ao buscar assinaturas vencidas',
      );
      return (data ?? []).map(toSubscription);
    } catch (err) {
      this.throwOnError(err, 'Erro ao buscar assinaturas vencidas');
    }
  }

  async getSubscription(subscriptionId: string): Promise<BillingSubscription | null> {
    try {
      const result = await this.db.rpc('get_subscription_by_id', {
        p_subscription_id: subscriptionId,
      });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown> | null>(
        result,
        'Erro ao buscar assinatura',
      );
      const row = firstRow(data);
      if (!row) return null;
      return toSubscription(row);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'PGRST116') {
        return null;
      }
      this.throwOnError(err, 'Erro ao buscar assinatura');
    }
  }

  async applyTransition(input: ApplyTransitionInput): Promise<BillingSubscription> {
    try {
      const result = await this.db.rpc('apply_subscription_transition', {
        p_subscription_id: input.subscriptionId,
        p_status: input.status,
        p_current_period_start: input.currentPeriodStart ?? null,
        p_current_period_end: input.currentPeriodEnd ?? null,
        p_canceled_at: input.canceledAt ?? null,
        p_clear_cancel_request: input.clearCancelRequest ?? false,
        p_grace_ends_at: input.graceEndsAt ?? null,
      });
      const row = firstRow(this.extractData(result, 'Erro ao aplicar transição'));
      if (!row) throw this.requireData(null as never, 'Erro ao aplicar transição');
      return toSubscription(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao aplicar transição');
    }
  }

  async createInvoice(draft: import('./repository').InvoiceDraft): Promise<Invoice> {
    try {
      const result = await this.db.rpc('create_invoice', {
        p_subscription_id: draft.subscriptionId,
        p_tenant_id: draft.tenantId,
        p_amount: draft.amount,
        p_due_date: draft.dueDate,
        p_billing_period_start: draft.billingPeriodStart,
        p_billing_period_end: draft.billingPeriodEnd,
        p_idempotency_key: draft.idempotencyKey,
      });
      const row = firstRow(this.extractData(result, 'Erro ao criar invoice'));
      if (!row) throw this.requireData(null as never, 'Erro ao criar invoice');
      return toInvoice(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao criar invoice');
    }
  }

  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const result = await this.db.rpc('get_invoice', { p_invoice_id: invoiceId });
      const data = this.extractData<Record<string, unknown>[] | Record<string, unknown> | null>(
        result,
        'Erro ao buscar invoice',
      );
      const row = firstRow(data);
      if (!row) return null;
      return toInvoice(row);
    } catch (err) {
      if (err instanceof Error && 'code' in err && (err as { code?: string }).code === 'PGRST116') {
        return null;
      }
      this.throwOnError(err, 'Erro ao buscar invoice');
    }
  }

  async markInvoicePaid(invoiceId: string): Promise<Invoice> {
    try {
      const result = await this.db.rpc('mark_invoice_paid', { p_invoice_id: invoiceId });
      const row = firstRow(this.extractData(result, 'Erro ao marcar invoice paga'));
      if (!row) throw this.requireData(null as never, 'Erro ao marcar invoice paga');
      return toInvoice(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao marcar invoice paga');
    }
  }

  async recordPaymentAttempt(input: RecordAttemptInput): Promise<PaymentAttempt> {
    try {
      const result = await this.db.rpc('record_payment_attempt', {
        p_invoice_id: input.invoiceId,
        p_tenant_id: input.tenantId,
        p_status: input.status,
        p_provider: input.provider ?? null,
        p_error: input.error ?? null,
      });
      const row = firstRow(this.extractData(result, 'Erro ao registrar tentativa de pagamento'));
      if (!row) throw this.requireData(null as never, 'Erro ao registrar tentativa de pagamento');
      return toPaymentAttempt(row);
    } catch (err) {
      this.throwOnError(err, 'Erro ao registrar tentativa de pagamento');
    }
  }
}

export const supabaseBillingRepository: BillingRepository = new SupabaseBillingRepository();
