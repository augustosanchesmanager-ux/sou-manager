/**
 * [SMG][DOMAIN][EVENTS][SUBSCRIBERS] CommissionSubscriber
 *
 * Low-risk financial subscriber that listens to CheckoutCompleted events
 * and calculates theoretical commission from service execution.
 *
 * DESIGN:
 *   - Group A (baixo risco): read-only, no writes to business state
 *   - Delegates calculation to an injectable CommissionCalculator
 *   - Publishes CommissionCalculated event for downstream consumers
 *   - Idempotent: same checkout → same commission result
 *
 * FLOW:
 *   CheckoutCompleted
 *     ↓
 *   CommissionSubscriber.handle()
 *     ↓
 *   calculator.calculate(event)
 *     ↓
 *   Publish CommissionCalculated
 *
 * FUTURE:
 *   - FinanceSubscriber subscribes to CommissionCalculated
 *   - Outbox integration for reliable financial writes
 */

import type { DomainSubscriber } from '../subscriber';
import type { CheckoutCompletedEvent, CommissionCalculatedEvent } from '../types';
import type { EventBus } from '../bus';

// ─── Calculator Interface ──────────────────────────────────────

/**
 * Injectable commission calculator.
 * Decouples the subscriber from the actual calculation logic.
 * In production, wraps CommissionApplicationService.
 * In tests, easily mockable.
 */
export interface CommissionCalculator {
  /**
   * Calculate commission for a completed checkout.
   * Returns null if no commission is applicable (e.g., non-barber staff).
   */
  calculate(input: {
    comandaId: string;
    tenantId: string;
    total: number;
    staffId?: string;
  }): Promise<CommissionCalculationResult | null>;
}

export interface CommissionCalculationResult {
  staffId: string;
  period: string;
  totalSales: number;
  totalCommission: number;
  lineCount: number;
}

// ─── Subscriber ────────────────────────────────────────────────

/**
 * Creates a CommissionSubscriber that listens to CheckoutCompleted events.
 *
 * Usage:
 *   const subscriber = createCommissionSubscriber(bus, calculator);
 *   registry.register(subscriber);
 */
export const createCommissionSubscriber = (
  bus: EventBus,
  calculator: CommissionCalculator,
): DomainSubscriber<CheckoutCompletedEvent> => ({
  name: 'CommissionSubscriber',
  description: 'Calculates theoretical commission from completed checkouts',
  eventType: 'CheckoutCompleted',

  async handle(event) {
    const { payload, metadata } = event;

    // Skip if no financial effect (legacy club settlement)
    if (!payload.financialEffect) {
      console.log(
        `[COMMISSION_SUBSCRIBER] Skipping comanda ${payload.comandaId} — no financial effect`,
      );
      return;
    }

    // Skip if no staff assigned
    if (!payload.staffId) {
      console.log(
        `[COMMISSION_SUBSCRIBER] Skipping comanda ${payload.comandaId} — no staff assigned`,
      );
      return;
    }

    try {
      const result = await calculator.calculate({
        comandaId: payload.comandaId,
        tenantId: metadata.tenantId,
        total: payload.total,
        staffId: payload.staffId,
      });

      if (!result) {
        console.log(
          `[COMMISSION_SUBSCRIBER] No commission for comanda ${payload.comandaId} — not eligible`,
        );
        return;
      }

      // Publish CommissionCalculated event
      const commissionEvent = {
        eventType: 'CommissionCalculated' as const,
        aggregateId: `commission_${payload.comandaId}`,
        aggregateType: 'commission' as const,
        payload: {
          staffId: result.staffId,
          period: result.period,
          totalSales: result.totalSales,
          totalCommission: result.totalCommission,
          lineCount: result.lineCount,
        },
        metadata: {
          tenantId: metadata.tenantId,
          correlationId: event.eventId,
          causationId: event.eventId,
          source: 'CommissionSubscriber',
        },
      };

      await bus.publish(commissionEvent as any);

      console.log(
        `[COMMISSION_SUBSCRIBER] Commission calculated for comanda ${payload.comandaId}:`,
        {
          staffId: result.staffId,
          totalCommission: result.totalCommission,
          lineCount: result.lineCount,
        },
      );
    } catch (error) {
      console.error(
        `[COMMISSION_SUBSCRIBER] Failed to calculate commission for comanda ${payload.comandaId}:`,
        error,
      );
    }
  },
});
