/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] reverseCommissionHandler
 *
 * FIX-001 G2: OperationHandler for 'reverse_commission' operations.
 *
 * Executes proportional commission reversal when a CheckoutReverted event occurs.
 * Uses calculateCommissionReversal from domain/commission/calculate.ts.
 *
 * DATA CONTRACT (from FinanceOperation.data):
 *   - comandaId: string — the comanda being reversed
 *   - reversedAmount: number — financial amount reversed
 *   - originalCommission: number — original commission value
 *   - originalReceivedValue: number — original received value
 *
 * FLOW:
 *   CheckoutReverted event
 *     → FinanceSubscriber.mapCheckoutReverted()
 *     → Outbox.enqueue({ operationType: 'reverse_commission', ... })
 *     → Dispatcher.process()
 *     → FinanceProvider.deliver()
 *     → reverseCommissionHandler.execute()
 *     → calculateCommissionReversal()
 *     → reversal repository (future: persist to financial_reversals table)
 */

import { calculateCommissionReversal } from '../../../commission/calculate';
import type { OperationHandler, OperationContext } from './financeProvider';

export interface ReverseCommissionData {
  comandaId: string;
  reversedAmount: number;
  originalCommission: number;
  originalReceivedValue: number;
}

export interface CommissionReversalResult {
  reversalAmount: number;
  proportion: number;
}

export interface ReverseCommissionRepository {
  /**
   * Persist the commission reversal record.
   * For now, returns the computed result.
   * Future: write to financial_reversals table.
   */
  persistReversal(
    data: ReverseCommissionData,
    result: CommissionReversalResult,
    context: OperationContext,
  ): Promise<void>;
}

/**
 * Creates an OperationHandler for 'reverse_commission' operations.
 *
 * The handler:
 * 1. Validates input data
 * 2. Calculates proportional reversal via calculateCommissionReversal
 * 3. Delegates persistence to the repository
 * 4. Returns success/failure
 *
 * @param repository - Persistence layer for reversal records
 */
export const createReverseCommissionHandler = (
  repository: ReverseCommissionRepository,
): OperationHandler => ({
  execute: async (data, context) => {
    const {
      comandaId,
      reversedAmount,
      originalCommission,
      originalReceivedValue,
    } = data as unknown as ReverseCommissionData;

    // Validate required fields
    if (!comandaId) {
      return { success: false, error: 'Missing required field: comandaId' };
    }
    if (typeof reversedAmount !== 'number' || reversedAmount < 0) {
      return { success: false, error: `Invalid reversedAmount: ${reversedAmount}` };
    }
    if (typeof originalCommission !== 'number' || originalCommission < 0) {
      return { success: false, error: `Invalid originalCommission: ${originalCommission}` };
    }
    if (typeof originalReceivedValue !== 'number' || originalReceivedValue < 0) {
      return { success: false, error: `Invalid originalReceivedValue: ${originalReceivedValue}` };
    }

    // Calculate proportional reversal
    const reversalAmount = calculateCommissionReversal(
      originalCommission,
      reversedAmount,
      originalReceivedValue,
    );

    const proportion = originalReceivedValue > 0
      ? Math.min(1, reversedAmount / originalReceivedValue)
      : 0;

    // Persist reversal record
    try {
      await repository.persistReversal(
        { comandaId, reversedAmount, originalCommission, originalReceivedValue },
        { reversalAmount, proportion },
        context,
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to persist reversal: ${errorMsg}` };
    }

    console.log(
      `[REVERSE_COMMISSION] Comanda ${comandaId}: reversal=${reversalAmount} (proportion=${proportion.toFixed(4)})`,
    );

    return { success: true };
  },
});
