/**
 * Business Events Catalog — Fase 3.5 Observabilidade
 *
 * Defines all business events that should be tracked.
 * Each event specifies its category, required data, and severity.
 */

export interface BusinessEvent {
  name: string;
  category: 'transaction' | 'lifecycle' | 'financial' | 'subscription' | 'auth';
  description: string;
  requiredFields: string[];
  optionalFields: string[];
}

/**
 * All trackable business events
 */
export const BUSINESS_EVENTS = {
  // ─── Transaction Events ──────────────────────────────────────
  CHECKOUT_STARTED: {
    name: 'checkout_started',
    category: 'transaction',
    description: 'User initiated checkout process',
    requiredFields: ['tenantId', 'userId', 'comandaId'],
    optionalFields: ['clientId', 'totalAmount', 'itemCount'],
  },
  CHECKOUT_COMPLETED: {
    name: 'checkout_completed',
    category: 'transaction',
    description: 'Checkout successfully completed',
    requiredFields: ['tenantId', 'userId', 'comandaId', 'amount', 'paymentMethod'],
    optionalFields: ['clientId', 'discount', 'tip', 'transactionId'],
  },
  CHECKOUT_FAILED: {
    name: 'checkout_failed',
    category: 'transaction',
    description: 'Checkout process failed',
    requiredFields: ['tenantId', 'userId', 'comandaId', 'error'],
    optionalFields: ['clientId', 'attemptedAmount'],
  },
  PAYMENT_PROCESSED: {
    name: 'payment_processed',
    category: 'financial',
    description: 'Payment transaction recorded',
    requiredFields: ['tenantId', 'userId', 'transactionId', 'amount', 'type'],
    optionalFields: ['paymentMethod', 'sourceType', 'sourceId'],
  },
  TRANSACTION_REVERSED: {
    name: 'transaction_reversed',
    category: 'financial',
    description: 'Financial transaction reversed',
    requiredFields: ['tenantId', 'userId', 'originalTransactionId', 'amount', 'reasonType'],
    optionalFields: ['reversalTransactionId', 'reversalType', 'refundMethod'],
  },

  // ─── Appointment Events ──────────────────────────────────────
  APPOINTMENT_CREATED: {
    name: 'appointment_created',
    category: 'lifecycle',
    description: 'New appointment scheduled',
    requiredFields: ['tenantId', 'userId', 'appointmentId', 'clientId', 'serviceId', 'staffId'],
    optionalFields: ['startTime', 'isOverbooked', 'source'],
  },
  APPOINTMENT_CANCELLED: {
    name: 'appointment_cancelled',
    category: 'lifecycle',
    description: 'Appointment cancelled',
    requiredFields: ['tenantId', 'userId', 'appointmentId'],
    optionalFields: ['reason', 'cancelledBy'],
  },
  APPOINTMENT_COMPLETED: {
    name: 'appointment_completed',
    category: 'lifecycle',
    description: 'Appointment marked as completed',
    requiredFields: ['tenantId', 'userId', 'appointmentId'],
    optionalFields: ['duration', 'rating'],
  },
  NO_SHOW_DETECTED: {
    name: 'no_show_detected',
    category: 'lifecycle',
    description: 'Client did not show up for appointment',
    requiredFields: ['tenantId', 'appointmentId', 'clientId'],
    optionalFields: ['staffId', 'scheduledTime'],
  },

  // ─── Cash Closing Events ─────────────────────────────────────
  CASH_CLOSING_OPENED: {
    name: 'cash_closing_opened',
    category: 'financial',
    description: 'Cash register opened for the day',
    requiredFields: ['tenantId', 'userId', 'date'],
    optionalFields: ['openingBalance'],
  },
  CASH_CLOSING_SAVED: {
    name: 'cash_closing_saved',
    category: 'financial',
    description: 'Cash closing data saved (draft)',
    requiredFields: ['tenantId', 'userId', 'date'],
    optionalFields: ['totalIn', 'totalOut', 'netTotal'],
  },
  CASH_CLOSING_FINALIZED: {
    name: 'cash_closing_finalized',
    category: 'financial',
    description: 'Cash closing finalized and locked',
    requiredFields: ['tenantId', 'userId', 'date', 'closingId'],
    optionalFields: ['totalIn', 'totalOut', 'netTotal', 'physicalCount'],
  },
  CASH_CLOSING_REOPENED: {
    name: 'cash_closing_reopened',
    category: 'financial',
    description: 'Cash closing reopened for corrections',
    requiredFields: ['tenantId', 'userId', 'closingId'],
    optionalFields: ['reason'],
  },

  // ─── Commission Events ───────────────────────────────────────
  COMMISSION_CALCULATED: {
    name: 'commission_calculated',
    category: 'financial',
    description: 'Commission calculated for a professional',
    requiredFields: ['tenantId', 'staffId', 'period', 'totalAmount'],
    optionalFields: ['commissionRate', 'commissionAmount', 'serviceCount'],
  },
  COMMISSION_SETTLED: {
    name: 'commission_settled',
    category: 'financial',
    description: 'Commission payout processed',
    requiredFields: ['tenantId', 'staffId', 'amount'],
    optionalFields: ['paymentMethod', 'transactionId'],
  },

  // ─── ChefClub Events ─────────────────────────────────────────
  CLUB_SUBSCRIPTION_CREATED: {
    name: 'club_subscription_created',
    category: 'subscription',
    description: 'New Club dos Chefes subscription activated',
    requiredFields: ['tenantId', 'userId', 'clientId', 'planId'],
    optionalFields: ['subscriptionId', 'credits', 'amount'],
  },
  CLUB_CREDIT_USED: {
    name: 'club_credit_used',
    category: 'subscription',
    description: 'Club dos Chefes credit used for a service',
    requiredFields: ['tenantId', 'clientId', 'subscriptionId'],
    optionalFields: ['serviceId', 'remainingCredits'],
  },
  CLUB_CREDIT_EXPIRED: {
    name: 'club_credit_expired',
    category: 'subscription',
    description: 'Club dos Chefes credit expired without use',
    requiredFields: ['tenantId', 'clientId', 'creditId'],
    optionalFields: ['expirationDate', 'planId'],
  },
  CLUB_RECEIVABLE_PAID: {
    name: 'club_receivable_paid',
    category: 'subscription',
    description: 'Club dos Chefes receivable payment received',
    requiredFields: ['tenantId', 'receivableId', 'amount'],
    optionalFields: ['paymentMethod', 'transactionId'],
  },
  CLUB_SUBSCRIPTION_CANCELLED: {
    name: 'club_subscription_cancelled',
    category: 'subscription',
    description: 'Club dos Chefes subscription deactivated',
    requiredFields: ['tenantId', 'userId', 'subscriptionId'],
    optionalFields: ['reason', 'cancelDate'],
  },

  // ─── Auth Events ─────────────────────────────────────────────
  USER_LOGIN: {
    name: 'user_login',
    category: 'auth',
    description: 'User successfully logged in',
    requiredFields: ['tenantId', 'userId'],
    optionalFields: ['method', 'ipAddress', 'userAgent'],
  },
  USER_LOGIN_FAILED: {
    name: 'user_login_failed',
    category: 'auth',
    description: 'Login attempt failed',
    requiredFields: ['email'],
    optionalFields: ['error', 'ipAddress', 'userAgent'],
  },
  USER_LOGOUT: {
    name: 'user_logout',
    category: 'auth',
    description: 'User logged out',
    requiredFields: ['tenantId', 'userId'],
    optionalFields: ['sessionDuration'],
  },
  PERMISSION_DENIED: {
    name: 'permission_denied',
    category: 'auth',
    description: 'User attempted unauthorized action',
    requiredFields: ['tenantId', 'userId', 'action'],
    optionalFields: ['resource', 'requiredRole'],
  },
} as const;

export type BusinessEventName = keyof typeof BUSINESS_EVENTS;

/**
 * Get event definition by name
 */
export function getEventDef(name: BusinessEventName): BusinessEvent {
  return BUSINESS_EVENTS[name];
}

/**
 * Validate that all required fields are present in data
 */
export function validateEventData(
  eventName: BusinessEventName,
  data: Record<string, unknown>,
): { valid: boolean; missing: string[] } {
  const event = BUSINESS_EVENTS[eventName];
  const missing = event.requiredFields.filter((field) => !(field in data) || data[field] === undefined);

  return {
    valid: missing.length === 0,
    missing,
  };
}
