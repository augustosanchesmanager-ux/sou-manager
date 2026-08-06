/**
 * [SMG][DOMAIN][BILLING] billingEngine
 *
 * Motor de regras de faturamento/ciclo de assinatura (Lifecycle Billing 6.0.4.4).
 *
 * DESIGN (aprovado PO 2026-08-06):
 *   - TS PURO: nenhuma I/O, nenhuma dependência de Supabase/React
 *   - ÚNICA fonte da verdade das transições de ciclo
 *   - runCycle(asOf) determinístico — permite simular vencimentos futuros
 *     em testes/E2E sem depender de relógio real
 *   - O banco NÃO contém regra de ciclo (apenas persistência fina via RPCs)
 *
 * TRANSIÇÕES (tabela aprovada):
 *
 * | Estado   | Condição                              | Ação                     |
 * |----------|---------------------------------------|--------------------------|
 * | trialing | trial_ends_at <= asOf && plano free   | activate_free            |
 * | trialing | trial_ends_at <= asOf && plano pago   | start_past_due           |
 * | active   | cancel_at_period_end set && <= asOf   | finalize_cancellation    |
 * | active   | current_period_end <= asOf            | renew (+ invoice p/ pago)|
 * | past_due | cancel_at_period_end set && <= asOf   | finalize_cancellation    |
 * | past_due | (demais)                              | none (grace; suspensão 6.0.5) |
 * | cancelled| (qualquer)                            | none                     |
 *
 * FORA DO ESCOPO (6.0.5+): suspensão, reativação, cron, gateway, dunning.
 */

import {
  BILLING_PERIOD_DAYS,
  GRACE_PERIOD_DAYS,
  PAID_PLANS,
  type BillingAction,
  type BillingSubscription,
} from './types';

/** Converte data ISO em epoch ms. Retorna -Infinity para null/indefinido. */
const toEpoch = (iso: string | null): number =>
  iso ? new Date(iso).getTime() : Number.NEGATIVE_INFINITY;

const addDays = (iso: string, days: number): string => {
  const d = new Date(new Date(iso).getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
};

const isPaidPlan = (plan: BillingSubscription['plan']): boolean => PAID_PLANS.includes(plan);

/**
 * Decide a próxima ação de ciclo de uma assinatura em um instante `asOf`.
 * Função pura e determinística — sem efeitos colaterais.
 */
export function processSubscription(
  sub: BillingSubscription,
  asOfIso: string,
  periodDays: number = BILLING_PERIOD_DAYS,
  _graceDays: number = GRACE_PERIOD_DAYS,
): BillingAction {
  const asOf = toEpoch(asOfIso);

  // Encerrado — nada a fazer.
  if (sub.status === 'cancelled') return { type: 'none' };

  // Pedido de cancelamento efetivado (fim do período alcançado) — D-A.
  if (sub.cancelAtPeriodEnd && toEpoch(sub.cancelAtPeriodEnd) <= asOf) {
    return { type: 'finalize_cancellation' };
  }

  switch (sub.status) {
    case 'trialing': {
      const trialEnd = toEpoch(sub.trialEndsAt);
      if (trialEnd > asOf || trialEnd === Number.NEGATIVE_INFINITY) {
        return { type: 'none' };
      }
      if (isPaidPlan(sub.plan)) {
        // Sem gateway/ativação manual → entra em tolerância (grace 5d, D3).
        return { type: 'start_past_due' };
      }
      // Plano free: trial termina e o tenant segue ativo sem cobrança.
      return {
        type: 'activate_free',
        newPeriodStart: asOfIso,
        newPeriodEnd: addDays(asOfIso, periodDays),
      };
    }

    case 'active': {
      // Pedido de cancelamento ativo (D-A): NUNCA renova — acesso mantido até
      // o fim do período e efetivação no vencimento.
      if (sub.cancelAtPeriodEnd) {
        return toEpoch(sub.cancelAtPeriodEnd) <= asOf
          ? { type: 'finalize_cancellation' }
          : { type: 'none' };
      }
      const periodEnd = toEpoch(sub.currentPeriodEnd);
      if (periodEnd <= asOf) {
        // Renovação: novo período começa onde o anterior terminou.
        const start = sub.currentPeriodEnd ?? asOfIso;
        return {
          type: 'renew',
          newPeriodStart: start,
          newPeriodEnd: addDays(start, periodDays),
          // D-C: invoice apenas para planos pagos.
          issueInvoice: isPaidPlan(sub.plan),
        };
      }
      return { type: 'none' };
    }

    case 'past_due':
      // Tolerância sem gateway: permanece até decisão de suspensão (6.0.5).
      return { type: 'none' };

    default:
      return { type: 'none' };
  }
}
