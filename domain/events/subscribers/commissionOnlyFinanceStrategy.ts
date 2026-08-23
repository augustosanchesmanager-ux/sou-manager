/**
 * [SMG][DOMAIN][EVENTS][STRATEGY] commissionOnlyFinanceStrategy
 *
 * TD-001 B3.4-G Activation Gate wrapper.
 *
 * Gates which finance operations are ACTIVATED for execution by the
 * FinanceProvider. All calculation rules remain in DefaultFinanceStrategy
 * (single source of truth); this wrapper only filters what gets enqueued.
 *
 * ACTIVATION MATRIX (PO-approved B3.4-G):
 *   CheckoutCompleted      -> create_commission_record ONLY
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
    mapCheckoutCompleted(event) {
      return base
        .mapCheckoutCompleted(event)
        .filter((op) => op.type === 'create_commission_record');
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
