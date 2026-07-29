/**
 * Service Instrumentation Config — Fase 3.5 Observabilidade
 *
 * Declarative configuration for all Application Services.
 * Services remain untouched; this file is the single source of truth
 * for what gets logged, measured, and tracked.
 *
 * Usage:
 *   import { initializeInstrumentation } from '@/src/lib/observability/config';
 *   initializeInstrumentation();
 *
 * Call once at app startup (in useObservability hook).
 */

import { instrumentService } from './instrumentation';
import { checkoutApplicationService } from '@/application/checkout';
import { appointmentApplicationService } from '@/application/appointment';
import { cashClosingApplicationService } from '@/application/cashClosing';
import { commissionApplicationService } from '@/application/commission';
import { chefClubApplicationService } from '@/application/chefClub';

// ─── Checkout ───────────────────────────────────────────────────

const CHECKOUT_CONFIG = {
  finish: {
    operation: 'Checkout.finish',
    businessEvent: 'CHECKOUT_COMPLETED' as const,
    metric: 'checkout_duration_ms',
  },
  validateFinishRequest: {
    operation: 'Checkout.validate',
    metric: 'checkout_validate_duration_ms',
  },
  syncComanda: {
    operation: 'Checkout.syncComanda',
    metric: 'checkout_sync_comanda_duration_ms',
  },
  syncItemsWithCompensation: {
    operation: 'Checkout.syncItems',
    metric: 'checkout_sync_items_duration_ms',
  },
  settleComanda: {
    operation: 'Checkout.settle',
    metric: 'checkout_settle_duration_ms',
  },
};

// ─── Appointment ────────────────────────────────────────────────

const APPOINTMENT_CONFIG = {
  createAppointment: {
    operation: 'Appointment.create',
    businessEvent: 'APPOINTMENT_CREATED' as const,
    metric: 'appointment_create_duration_ms',
  },
  cancelAppointment: {
    operation: 'Appointment.cancel',
    businessEvent: 'APPOINTMENT_CANCELLED' as const,
    metric: 'appointment_cancel_duration_ms',
  },
  updateAppointment: {
    operation: 'Appointment.update',
    metric: 'appointment_update_duration_ms',
  },
  changeStatus: {
    operation: 'Appointment.changeStatus',
    metric: 'appointment_status_duration_ms',
  },
  rescheduleAppointment: {
    operation: 'Appointment.reschedule',
    metric: 'appointment_reschedule_duration_ms',
  },
  resolveFinalPrice: {
    operation: 'Appointment.resolvePrice',
    metric: 'appointment_resolve_price_duration_ms',
  },
};

// ─── Cash Closing ───────────────────────────────────────────────

const CASH_CLOSING_CONFIG = {
  openCashRegister: {
    operation: 'CashClosing.open',
    businessEvent: 'CASH_CLOSING_OPENED' as const,
    metric: 'cash_closing_open_duration_ms',
  },
  closeCashRegister: {
    operation: 'CashClosing.close',
    businessEvent: 'CASH_CLOSING_FINALIZED' as const,
    metric: 'cash_closing_close_duration_ms',
  },
  closeBarberCash: {
    operation: 'CashClosing.closeBarber',
    metric: 'cash_closing_close_barber_duration_ms',
  },
  saveDraftConference: {
    operation: 'CashClosing.saveDraft',
    businessEvent: 'CASH_CLOSING_SAVED' as const,
    metric: 'cash_closing_save_draft_duration_ms',
  },
  loadDailySnapshot: {
    operation: 'CashClosing.loadSnapshot',
    metric: 'cash_closing_load_snapshot_duration_ms',
  },
};

// ─── Commission ─────────────────────────────────────────────────

const COMMISSION_CONFIG = {
  loadCommissionLines: {
    operation: 'Commission.loadLines',
    businessEvent: 'COMMISSION_CALCULATED' as const,
    metric: 'commission_load_lines_duration_ms',
  },
};

// ─── Club dos Chefes ──────────────────────────────────────────

const CHEF_CLUB_CONFIG = {
  resolveSubscription: {
    operation: 'ChefClub.resolveSubscription',
    metric: 'chefclub_resolve_subscription_duration_ms',
  },
  deductCredits: {
    operation: 'ChefClub.deductCredits',
    businessEvent: 'CLUB_CREDIT_USED' as const,
    metric: 'chefclub_deduct_credits_duration_ms',
  },
  deductCreditsBatch: {
    operation: 'ChefClub.deductCreditsBatch',
    businessEvent: 'CLUB_CREDIT_USED' as const,
    metric: 'chefclub_deduct_credits_batch_duration_ms',
  },
};

// ─── Initialization ─────────────────────────────────────────────

let initialized = false;

/**
 * Instrument all Application Services.
 * Safe to call multiple times (idempotent).
 */
export function initializeInstrumentation(): void {
  if (initialized) return;
  initialized = true;

  instrumentService(checkoutApplicationService as any, CHECKOUT_CONFIG as any);
  instrumentService(appointmentApplicationService as any, APPOINTMENT_CONFIG as any);
  instrumentService(cashClosingApplicationService as any, CASH_CLOSING_CONFIG as any);
  instrumentService(commissionApplicationService as any, COMMISSION_CONFIG as any);
  instrumentService(chefClubApplicationService as any, CHEF_CLUB_CONFIG as any);
}
