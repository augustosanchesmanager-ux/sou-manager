/**
 * [SMG][APPLICATION][BILLING] BillingService
 *
 * RESPONSABILIDADE: Orquestra o Billing Engine (Lifecycle Billing 6.0.4.4).
 *   - runCycle(asOf): varre subscriptions vencidas, aplica transições do engine
 *     (fonte da verdade) e publica os eventos de domínio
 *   - issueInvoice: emissão de invoice (D-C: SOMENTE planos pagos, amount=0,
 *     idempotente por idempotencyKey)
 *   - markPaid: confirmação manual de pagamento (sem gateway) + resolve past_due
 *   - handleFailure: registro de tentativa falha (append-only)
 *
 * FLUXO (aprovado PO):
 *   BillingEngine (puro)
 *     ↓ processSubscription(asOf)
 *   BillingService.runCycle
 *     ↓
 *   BillingRepository (RPCs SECURITY DEFINER — banco só persiste)
 *     ↓
 *   EventBus (eventos de domínio → Outbox/FinanceProvider)
 *
 * D-A: cancel_at_period_end — efetivação do cancelamento acontece AQUI
 *      (finalize_cancellation), nunca na RPC cancel_subscription (pedido).
 *
 * FORA DO ESCOPO (6.0.5.5+): reativação no ciclo (D-6.0.5.4-2), cron,
 * gateway, dunning, upgrade/downgrade.
 *
 * GARANTIAS:
 *   - Engine decide; repositório apenas persiste (zero regra de negócio no banco)
 *   - runCycle é determinístico (asOf injetável) — sem relógio real
 *   - Eventos publicados apenas após sucesso transacional
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type {
  InvoiceCreatedEvent,
  InvoicePaidEvent,
  PaymentFailedEvent,
  PaymentSucceededEvent,
  TenantSubscriptionCancelledEvent,
  TenantSubscriptionReactivatedEvent,
  TenantSubscriptionRenewedEvent,
  TenantSubscriptionSuspendedEvent,
  TenantSubscriptionUpdatedEvent,
  TenantTrialEndedEvent,
} from '../domain/events/types';
import { processSubscription } from '../domain/billing/billingEngine';
import { PAID_PLANS, type BillingSubscription, type BillingCycleReport } from '../domain/billing/types';
import {
  supabaseBillingRepository,
  type BillingRepository,
  type Invoice,
  type RecordAttemptInput,
} from '../domain/billing/repository';

// ─── Service ─────────────────────────────────────────────────────

export interface BillingPeriod {
  start: string;
  end: string;
}

export class BillingService {
  constructor(
    private readonly repo: BillingRepository = supabaseBillingRepository,
    private readonly bus: typeof appEventBus = appEventBus,
  ) {}

  /**
   * Emite invoice para um ciclo (D-C): SOMENTE planos pagos (pro/premium).
   * free/trial NUNCA emitem invoice. amount é placeholder 0 (preços reais
   * só com gateway). Idempotente por idempotencyKey (UNIQUE tenant+key).
   */
  async issueInvoice(sub: BillingSubscription, period: BillingPeriod): Promise<Invoice> {
    if (!PAID_PLANS.includes(sub.plan)) {
      throw new Error(
        `Invoice não é emitida para o plano '${sub.plan}' (D-C: apenas planos pagos)`,
      );
    }
    if (sub.status !== 'active') {
      throw new Error(
        `Invoice só é emitida em renovação (status 'active'); atual: '${sub.status}' (D-C)`,
      );
    }

    const draft = {
      subscriptionId: sub.id,
      tenantId: sub.tenantId,
      amount: 0,
      dueDate: period.end,
      billingPeriodStart: period.start,
      billingPeriodEnd: period.end,
      idempotencyKey: `cycle_${sub.id}_${period.start}`,
    };

    const invoice = await this.repo.createInvoice(draft);

    await this.bus.publish(createEvent<InvoiceCreatedEvent>({
      eventType: 'InvoiceCreated',
      aggregateId: invoice.id,
      aggregateType: 'invoice',
      payload: {
        invoiceId: invoice.id,
        tenantId: invoice.tenantId,
        subscriptionId: invoice.subscriptionId,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        billingPeriodStart: invoice.billingPeriodStart ?? period.start,
        billingPeriodEnd: invoice.billingPeriodEnd ?? period.end,
      },
      metadata: {
        tenantId: invoice.tenantId,
        source: 'BillingService',
      },
    }));

    return invoice;
  }

  /**
   * Confirmação manual de pagamento (sem gateway). Marca invoice paga,
   * registra tentativa 'success', publica InvoicePaid + PaymentSucceeded.
   * Se a subscription estiver past_due ou suspended, resolve para active
   * (D-6.0.5.4-2; reativação NUNCA acontece via runCycle).
   */
  async markPaid(invoiceId: string): Promise<{ invoice: Invoice }> {
    const invoice = await this.repo.getInvoice(invoiceId);
    if (!invoice) throw new Error(`Invoice não encontrada: ${invoiceId}`);

    const attempt = await this.repo.recordPaymentAttempt({
      invoiceId,
      tenantId: invoice.tenantId,
      status: 'success',
      provider: null,
    } satisfies RecordAttemptInput);

    const paid = await this.repo.markInvoicePaid(invoiceId);

    await this.bus.publish(createEvent<InvoicePaidEvent>({
      eventType: 'InvoicePaid',
      aggregateId: paid.id,
      aggregateType: 'invoice',
      payload: {
        invoiceId: paid.id,
        tenantId: paid.tenantId,
        amount: paid.amount,
        paidAt: paid.paidAt ?? new Date().toISOString(),
      },
      metadata: {
        tenantId: paid.tenantId,
        source: 'BillingService',
      },
    }));

    await this.bus.publish(createEvent<PaymentSucceededEvent>({
      eventType: 'PaymentSucceeded',
      aggregateId: attempt.id,
      aggregateType: 'payment',
      payload: {
        attemptId: attempt.id,
        invoiceId: attempt.invoiceId,
        tenantId: attempt.tenantId,
        provider: attempt.provider,
      },
      metadata: {
        tenantId: attempt.tenantId,
        source: 'BillingService',
      },
    }));

    // Reativação de subscription ao confirmar pagamento (sem gateway).
    // D-6.0.5.4-2: past_due → active (Updated) e suspended → active (Reactivated).
    // cancelled NUNCA reativa (matriz congelada ADR-013 §5.2 — R1).
    if (invoice.subscriptionId) {
      const sub = await this.repo.getSubscription(invoice.subscriptionId);
      if (sub && (sub.status === 'past_due' || sub.status === 'suspended')) {
        await this.repo.applyTransition({
          subscriptionId: sub.id,
          status: 'active',
          graceEndsAt: null, // D-6.0.5.4-5: limpo ao sair de past_due/suspended
        });
        if (sub.status === 'suspended') {
          await this.bus.publish(createEvent<TenantSubscriptionReactivatedEvent>({
            eventType: 'TenantSubscriptionReactivated',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: {
              subscriptionId: sub.id,
              tenantId: sub.tenantId,
            },
            metadata: {
              tenantId: sub.tenantId,
              source: 'BillingService',
            },
          }));
        } else {
          await this.bus.publish(createEvent<TenantSubscriptionUpdatedEvent>({
            eventType: 'TenantSubscriptionUpdated',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: {
              subscriptionId: sub.id,
              tenantId: sub.tenantId,
              plan: sub.plan,
              status: 'active',
            },
            metadata: {
              tenantId: sub.tenantId,
              source: 'BillingService',
            },
          }));
        }
      }
    }

    return { invoice: paid };
  }

  /**
   * Registra tentativa de pagamento falha (append-only em payment_attempts)
   * e publica PaymentFailed. Sem retry automático — sem gateway (futuro).
   */
  async handleFailure(invoiceId: string, reason?: string): Promise<void> {
    const invoice = await this.repo.getInvoice(invoiceId);
    if (!invoice) throw new Error(`Invoice não encontrada: ${invoiceId}`);

    const attempt = await this.repo.recordPaymentAttempt({
      invoiceId,
      tenantId: invoice.tenantId,
      status: 'failed',
      error: reason ?? null,
    } satisfies RecordAttemptInput);

    await this.bus.publish(createEvent<PaymentFailedEvent>({
      eventType: 'PaymentFailed',
      aggregateId: attempt.id,
      aggregateType: 'payment',
      payload: {
        attemptId: attempt.id,
        invoiceId: attempt.invoiceId,
        tenantId: attempt.tenantId,
        provider: attempt.provider,
        error: attempt.error,
      },
      metadata: {
        tenantId: attempt.tenantId,
        source: 'BillingService',
      },
    }));
  }

  /**
   * Executa um ciclo de billing em um instante determinístico (sem cron).
   * Para cada subscription vencida, aplica a transição do engine e publica
   * os eventos correspondentes.
   */
  async runCycle(asOf: string): Promise<BillingCycleReport> {
    const subs = await this.repo.findDueSubscriptions(asOf);
    const transitions: BillingCycleReport['transitions'] = [];

    for (const sub of subs) {
      const action = processSubscription(sub, asOf);

      switch (action.type) {
        case 'none':
          break;

        case 'activate_free': {
          await this.repo.applyTransition({
            subscriptionId: sub.id,
            status: 'active',
            currentPeriodStart: action.newPeriodStart,
            currentPeriodEnd: action.newPeriodEnd,
            clearCancelRequest: true,
          });
          await this.bus.publish(createEvent<TenantTrialEndedEvent>({
            eventType: 'TenantTrialEnded',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: { subscriptionId: sub.id, tenantId: sub.tenantId },
            metadata: { tenantId: sub.tenantId, source: 'BillingService' },
          }));
          await this.publishUpdated(sub, 'active');
          transitions.push({ subscriptionId: sub.id, tenantId: sub.tenantId, action: 'activate_free' });
          break;
        }

        case 'start_past_due': {
          await this.repo.applyTransition({
            subscriptionId: sub.id,
            status: 'past_due',
            graceEndsAt: action.graceEndsAt, // D-6.0.5.4-5: janela persistida
          });
          await this.bus.publish(createEvent<TenantTrialEndedEvent>({
            eventType: 'TenantTrialEnded',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: { subscriptionId: sub.id, tenantId: sub.tenantId },
            metadata: { tenantId: sub.tenantId, source: 'BillingService' },
          }));
          await this.publishUpdated(sub, 'past_due');
          transitions.push({ subscriptionId: sub.id, tenantId: sub.tenantId, action: 'start_past_due' });
          break;
        }

        case 'suspend': {
          // D-6.0.5.4-1: grace expirado sem pagamento → retirada de acesso.
          await this.repo.applyTransition({
            subscriptionId: sub.id,
            status: 'suspended',
            graceEndsAt: null, // janela encerrada (D-6.0.5.4-5)
          });
          await this.bus.publish(createEvent<TenantSubscriptionSuspendedEvent>({
            eventType: 'TenantSubscriptionSuspended',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: { subscriptionId: sub.id, tenantId: sub.tenantId },
            metadata: { tenantId: sub.tenantId, source: 'BillingService' },
          }));
          transitions.push({ subscriptionId: sub.id, tenantId: sub.tenantId, action: 'suspend' });
          break;
        }

        case 'finalize_cancellation': {
          await this.repo.applyTransition({
            subscriptionId: sub.id,
            status: 'cancelled',
            canceledAt: asOf,
          });
          await this.bus.publish(createEvent<TenantSubscriptionCancelledEvent>({
            eventType: 'TenantSubscriptionCancelled',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: {
              subscriptionId: sub.id,
              tenantId: sub.tenantId,
              canceledAt: asOf,
            },
            metadata: { tenantId: sub.tenantId, source: 'BillingService' },
          }));
          transitions.push({ subscriptionId: sub.id, tenantId: sub.tenantId, action: 'finalize_cancellation' });
          break;
        }

        case 'renew': {
          await this.repo.applyTransition({
            subscriptionId: sub.id,
            status: 'active',
            currentPeriodStart: action.newPeriodStart,
            currentPeriodEnd: action.newPeriodEnd,
            clearCancelRequest: true,
          });
          await this.bus.publish(createEvent<TenantSubscriptionRenewedEvent>({
            eventType: 'TenantSubscriptionRenewed',
            aggregateId: sub.id,
            aggregateType: 'tenant_subscription',
            payload: {
              subscriptionId: sub.id,
              tenantId: sub.tenantId,
              currentPeriodStart: action.newPeriodStart,
              currentPeriodEnd: action.newPeriodEnd,
            },
            metadata: { tenantId: sub.tenantId, source: 'BillingService' },
          }));

          if (action.issueInvoice) {
            await this.issueInvoice(sub, {
              start: action.newPeriodStart,
              end: action.newPeriodEnd,
            });
          }
          transitions.push({ subscriptionId: sub.id, tenantId: sub.tenantId, action: 'renew' });
          break;
        }
      }
    }

    return { asOf, scanned: subs.length, transitions };
  }

  private async publishUpdated(
    sub: BillingSubscription,
    status: BillingSubscription['status'],
  ): Promise<void> {
    await this.bus.publish(createEvent<TenantSubscriptionUpdatedEvent>({
      eventType: 'TenantSubscriptionUpdated',
      aggregateId: sub.id,
      aggregateType: 'tenant_subscription',
      payload: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        plan: sub.plan,
        status,
      },
      metadata: {
        tenantId: sub.tenantId,
        source: 'BillingService',
      },
    }));
  }
}

export const billingService = new BillingService();
