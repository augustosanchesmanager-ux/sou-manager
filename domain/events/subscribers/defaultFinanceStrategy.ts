/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] defaultFinanceStrategy
 *
 * Pure FinanceStrategy implementation that maps domain events to finance operations.
 * Respects the financial contract documented in TD001_B3_1_FINANCIAL_CONTRACT.md.
 *
 * RULES:
 *   - Pure function: no side effects, no Supabase, no DB
 *   - Deterministic: same input → same output
 *   - Commission uses effectively received value (FIX-001)
 *   - Reversals are proportional (FIX-001 R7)
 *   - No fake success: operations reflect real financial intent
 *   - No execution: only produces FinanceOperation[], never writes
 *
 * CONTRACT (B3.1):
 *   total = max(0, Σ(item.price × qty) − manualDiscount)
 *   commission = receivedValue × participantShare × commissionRate
 *   receivedValue = min(netValue, paidAmount)
 *   reversal = originalCommission × min(reversedAmount / originalReceivedValue, 1.0)
 */

import type {
  CheckoutCompletedEvent,
  CheckoutRevertedEvent,
  SubscriptionCancelledEvent,
  CreditsDeductedEvent,
  CashClosingCompletedEvent,
} from '../types';
import type { FinanceStrategy, FinanceOperation } from './financeSubscriber';
import { calculateCommissionReversal } from '../../commission/calculate';

// ─── Helpers ──────────────────────────────────────────────────

const asNum = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const asStr = (v: unknown, fallback = ''): string =>
  typeof v === 'string' ? v : fallback;

// ─── DefaultFinanceStrategy ───────────────────────────────────

/**
 * Maps domain events to FinanceOperation[].
 *
 * Each method is a pure function that transforms event payload
 * into a list of finance operations. The operations are then
 * enqueued by the FinanceSubscriber and executed by the FinanceProvider.
 */
export const createDefaultFinanceStrategy = (): FinanceStrategy => ({
  mapCheckoutCompleted(event: CheckoutCompletedEvent): FinanceOperation[] {
    const { comandaId, clientId, staffId, total, paymentMethod, financialEffect, hasClubCredit } = event.payload;
    const tenantId = event.metadata.tenantId;

    if (!financialEffect) {
      return [];
    }

    const operations: FinanceOperation[] = [];

    // Operation 1: create_transaction (income)
    // Contract: type='income', category='Receita de Comanda', amount=total
    if (total > 0) {
      operations.push({
        type: 'create_transaction',
        data: {
          tenantId,
          type: 'income',
          category: 'Receita de Comanda',
          amount: total,
          paymentMethod: paymentMethod || 'unknown',
          sourceType: 'comanda',
          sourceId: comandaId,
          status: 'paid',
          comandaId,
          clientId,
        },
      });
    }

    // Operation 2: create_commission_record
    // Contract: commission based on receivedValue (total), not gross
    // The FinanceProvider will resolve staff, participants, and rate at execution time.
    // Here we pass the data needed for commission calculation.
    if (staffId && total > 0) {
      operations.push({
        type: 'create_commission_record',
        data: {
          tenantId,
          comandaId,
          clientId,
          staffId,
          receivedValue: total,  // net value effectively received
          paymentMethod: paymentMethod || 'unknown',
          hasClubCredit,
        },
      });
    }

    return operations;
  },

  mapCheckoutReverted(event: CheckoutRevertedEvent): FinanceOperation[] {
    const { comandaId, reversedAmount, originalCommission, originalReceivedValue } = event.payload;
    const tenantId = event.metadata.tenantId;

    const operations: FinanceOperation[] = [];

    // Operation 1: reverse_commission (proportional)
    // Contract: proportion = reversedAmount / originalReceivedValue
    //           commissionReversal = originalCommission × min(proportion, 1.0)
    const commissionReversal = calculateCommissionReversal(
      originalCommission,
      reversedAmount,
      originalReceivedValue,
    );

    if (commissionReversal > 0) {
      operations.push({
        type: 'reverse_commission',
        data: {
          tenantId,
          comandaId,
          originalCommission,
          reversedAmount,
          originalReceivedValue,
          commissionReversal,
        },
      });
    }

    return operations;
  },

  mapSubscriptionCancelled(event: SubscriptionCancelledEvent): FinanceOperation[] {
    const { subscriptionId, reason } = event.payload;
    const tenantId = event.metadata.tenantId;

    return [
      {
        type: 'reverse_revenue',
        data: {
          tenantId,
          subscriptionId,
          reason: reason || 'Subscription cancelled',
        },
      },
    ];
  },

  mapCreditsDeducted(event: CreditsDeductedEvent): FinanceOperation[] {
    const { subscriptionId, serviceId, amount, reference } = event.payload;
    const tenantId = event.metadata.tenantId;

    return [
      {
        type: 'deduct_credits',
        data: {
          tenantId,
          subscriptionId,
          serviceId,
          amount,
          reference,
        },
      },
    ];
  },

  mapCashClosingCompleted(event: CashClosingCompletedEvent): FinanceOperation[] {
    const { closingId, businessDate, closedBy, expectedBalance, countedBalance, difference, hasDiscrepancy } = event.payload;
    const tenantId = event.metadata.tenantId;

    return [
      {
        type: 'close_daily_cash',
        data: {
          tenantId,
          closingId,
          businessDate,
          closedBy,
          expectedBalance,
          countedBalance,
          difference,
          hasDiscrepancy,
        },
      },
    ];
  },
});
