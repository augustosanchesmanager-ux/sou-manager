/**
 * [SMG][DOMAIN][EVENTS][OUTBOX][PROVIDERS] reverseCommissionHandler
 *
 * TD-001 B3.4-D: OperationHandler for 'reverse_commission' operations.
 *
 * Executes proportional commission reversal when a CheckoutReverted event occurs.
 * Uses CommissionRecordRepository to find original records and create reversals.
 *
 * DATA CONTRACT (from FinanceOperation.data):
 *   - comandaId: string — the comanda being reversed
 *   - reversedAmount: number — financial amount reversed
 *   - originalCommission: number — original total commission value
 *   - originalReceivedValue: number — original total received value
 *   - commissionReversal: number — pre-calculated reversal total
 *   - tenantId: string — tenant isolation
 *
 * FLOW:
 *   CheckoutReverted event
 *     → FinanceSubscriber.mapCheckoutReverted()
 *     → Outbox.enqueue({ operationType: 'reverse_commission', ... })
 *     → Dispatcher.process()
 *     → FinanceProvider.deliver()
 *     → reverseCommissionHandler.execute()
 *     → CommissionRecordRepository.list() — find original records
 *     → CommissionRecordRepository.createReversal() — via RPC
 *
 * REVERSAL LOGIC:
 *   - Lists all active commission records for the comanda
 *   - For each record, calculates proportional reversal:
 *       proportion = record.receivedValue / totalReceivedValue
 *       reversalAmount = record.commissionValue × min(proportion × reversalRatio, 1)
 *   - Creates one reversal record per original commission record
 */

import { calculateCommissionReversal } from '../../../commission/calculate';
import type { CommissionRecordRepository } from '../../../commission/commissionRecordRepository';
import type { OperationHandler, OperationContext } from './financeProvider';

// ─── Data Contract ─────────────────────────────────────────────

export interface ReverseCommissionData {
  comandaId: string;
  tenantId: string;
  reversedAmount: number;
  originalCommission: number;
  originalReceivedValue: number;
  commissionReversal: number;
}

// ─── Dependency Interface ──────────────────────────────────────

export interface ReverseCommissionHandlerDeps {
  commissionRecordRepository: CommissionRecordRepository;
}

// ─── Handler Factory ───────────────────────────────────────────

/**
 * Creates an OperationHandler for 'reverse_commission' operations.
 *
 * 1. Validates input data
 * 2. Lists all active commission records for the comanda
 * 3. For each record, calculates proportional reversal
 * 4. Creates reversal record via CommissionRecordRepository.createReversal()
 * 5. Returns success/failure
 *
 * @param deps - Injected repositories
 */
export const createReverseCommissionHandler = (
  deps: ReverseCommissionHandlerDeps,
): OperationHandler => ({
  execute: async (data, context) => {
    const {
      comandaId,
      tenantId,
      reversedAmount,
      originalCommission,
      originalReceivedValue,
    } = data as unknown as ReverseCommissionData;

    // Validate required fields
    if (!comandaId) {
      return { success: false, error: 'Missing required field: comandaId' };
    }
    if (!tenantId) {
      return { success: false, error: 'Missing required field: tenantId' };
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

    // No reversal needed
    if (reversedAmount <= 0 || originalCommission <= 0) {
      console.log(
        `[REVERSE_COMMISSION] Comanda ${comandaId}: nothing to reverse (reversedAmount=${reversedAmount}, originalCommission=${originalCommission})`,
      );
      return { success: true };
    }

    // ── Find all active commission records for this comanda ───
    let originalRecords;
    try {
      originalRecords = await deps.commissionRecordRepository.list(tenantId, {
        comanda_id: comandaId,
        record_type: 'commission',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return { success: false, error: `Failed to list commission records: ${errorMsg}` };
    }

    const activeRecords = (originalRecords || []).filter(
      (r) => r.status === 'active',
    );

    if (activeRecords.length === 0) {
      console.log(
        `[REVERSE_COMMISSION] Comanda ${comandaId}: no active commission records found — skipping`,
      );
      return { success: true };
    }

    // ── Calculate total receivedValue across all records ──────
    const totalRecordReceivedValue = activeRecords.reduce(
      (sum, r) => sum + Number(r.received_value || 0),
      0,
    );

    // Use event-level originalReceivedValue if available, else sum of records
    const effectiveTotalReceived = originalReceivedValue > 0
      ? originalReceivedValue
      : totalRecordReceivedValue;

    // ── Create reversal for each active record ────────────────
    let reversalsCreated = 0;

    for (const record of activeRecords) {
      const recordReceivedValue = Number(record.received_value || 0);
      const recordCommissionValue = Number(record.commission_value || 0);

      if (recordCommissionValue <= 0) continue;

      // Calculate proportional reversal for this specific record
      const reversalAmount = calculateCommissionReversal(
        recordCommissionValue,
        reversedAmount,
        effectiveTotalReceived,
      );

      if (reversalAmount <= 0) continue;

      // Check if reversal already exists for this record
      try {
        const existingReversals = await deps.commissionRecordRepository.list(
          tenantId,
          {
            comanda_id: comandaId,
            record_type: 'reversal',
          },
        );
        const alreadyReversed = (existingReversals || []).some(
          (r) => r.original_record_id === record.id && r.status === 'active',
        );
        if (alreadyReversed) {
          console.log(
            `[REVERSE_COMMISSION] Record ${record.id} already reversed — skipping`,
          );
          continue;
        }
      } catch {
        // If check fails, proceed with reversal attempt
      }

      // Create reversal record via RPC
      try {
        const result = await deps.commissionRecordRepository.createReversal({
          tenantId,
          originalRecordId: record.id,
          commissionValue: reversalAmount,
          idempotencyKey: `${context.idempotencyKey}_${record.id}`,
          eventId: context.eventId,
          eventType: context.sourceEvent,
        });

        if (result.success) {
          reversalsCreated++;
          console.log(
            `[REVERSE_COMMISSION] Created reversal for record ${record.id}: ${reversalAmount.toFixed(2)} (staff=${record.staff_id})`,
          );
        } else {
          console.error(
            `[REVERSE_COMMISSION] RPC failed for record ${record.id}:`,
            result.error,
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `[REVERSE_COMMISSION] Failed to create reversal for record ${record.id}:`,
          errorMsg,
        );
        // Continue processing other records
      }
    }

    console.log(
      `[REVERSE_COMMISSION] Comanda ${comandaId}: ${reversalsCreated}/${activeRecords.length} reversal(s) created`,
    );

    return { success: true };
  },
});
