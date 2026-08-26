/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] commissionOnlyFinanceStrategy
 *
 * TD-001 B3.4-G Activation Gate wrapper.
 * D7: CheckoutCompleted skipped — composite RPC handles outbox enqueue atomically.
 *
 * Gates which finance operations are ACTIVATED for execution by the
 * FinanceProvider. All calculation rules remain in DefaultFinanceStrategy
 * (single source of truth); this wrapper only filters what gets enqueued.
 *
 * ACTIVATION MATRIX (PO-approved B3.4-G + D7):
 *   CheckoutCompleted      -> NONE (handled by composite RPC atomically)
 *   CheckoutReverted       -> reverse_commission ONLY
 *   SubscriptionCancelled  -> none
 *   CreditsDeducted        -> none
 *   CashClosingCompleted   -> none
 *
 * create_transaction / reverse_revenue / deduct_credits / close_daily_cash
 * remain OUT OF SCOPE until explicitly activated by a future PO gate.
 *
 * DESIGN:
 *   - Pure: no side effects, no Supabase, no DB
 *   - Deterministic: same input -> same output
 *   - DefaultFinanceStrategy contract (B3.3) is left untouched
 */

import { createDefaultFinanceStrategy } from './defaultFinanceStrategy';
import type { FinanceStrategy } from './financeSubscriber';

export const createCommissionOnlyFinanceStrategy = (): FinanceStrategy => {
  const base = createDefaultFinanceStrategy();

  return {
    mapCheckoutCompleted(_event) {
      // D7: CheckoutCompleted is now handled atomically by the composite RPC
      // finance_settle_comanda_and_enqueue. The FinanceSubscriber should NOT
      // create a second outbox item for the same event.
      return [];
    },

    mapCheckoutReverted(event) {
      return base
        .mapCheckoutReverted(event)
        .filter((op) => op.type === 'reverse_commission');
    },

    mapSubscriptionCancelled() {
      return [];
    },

    mapCreditsDeducted() {
      return [];
    },

    mapCashClosingCompleted() {
      return [];
    },
  };
};
