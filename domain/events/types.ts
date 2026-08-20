/**
 * [SMG][DOMAIN][EVENTS] types
 *
 * Definições de eventos de domínio do sistema.
 * Cada evento representa uma ocorrência significativa no negócio.
 *
 * GARANTIAS:
 *   - Sem dependência de React, Supabase, ou qualquer infraestrutura
 *   - Tipagem discriminated union para type-safe handling
 *   - Separação payload (dados do domínio) / metadata (cross-cutting)
 *   - Versionamento desde o primeiro dia para evolution control
 *
 * DESIGN DECISIONS:
 *   - metadata.userId é opcional: nem todo publisher tem contexto de auth
 *   - metadata.source identifica o Application Service que publicou
 *   - eventTypeVersion: per-event-type schema version (independent of other events)
 *   - correlationId agrupa eventos de uma mesma operação de negócio
 *   - causationId encadeia evento→evento (causa→efeito)
 */

// ─── Metadata ─────────────────────────────────────────────────────

export interface EventMetadata {
  readonly tenantId: string;
  readonly userId?: string;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly source?: string;
}

// ─── Base ────────────────────────────────────────────────────────

export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventTypeVersion: number;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly payload: Record<string, unknown>;
  readonly metadata: EventMetadata;
  readonly occurredAt: string;
}

// ─── Checkout Events ─────────────────────────────────────────────

export interface CheckoutCompletedEvent extends DomainEvent {
  readonly eventType: 'CheckoutCompleted';
  readonly aggregateType: 'comanda';
  readonly payload: {
    comandaId: string;
    clientId?: string;
    staffId?: string;
    total: number;
    paymentMethod?: string;
    paymentStatus: 'paid' | 'pending';
    closureMode: string;
    itemCount: number;
    hasClubCredit: boolean;
    financialEffect: boolean;
  };
}

export interface CheckoutRevertedEvent extends DomainEvent {
  readonly eventType: 'CheckoutReverted';
  readonly aggregateType: 'comanda';
  readonly payload: {
    comandaId: string;
    reason: string;
    reversedBy: string;
    originalTotal: number;
  };
}

// ─── Appointment Events ──────────────────────────────────────────

export interface AppointmentCreatedEvent extends DomainEvent {
  readonly eventType: 'AppointmentCreated';
  readonly aggregateType: 'appointment';
  readonly payload: {
    appointmentId: string;
    clientId?: string;
    staffId: string;
    serviceIds: string[];
    startTime: string;
    endTime?: string;
    price: number;
    hasComanda: boolean;
    comandaId?: string;
  };
}

export interface AppointmentCancelledEvent extends DomainEvent {
  readonly eventType: 'AppointmentCancelled';
  readonly aggregateType: 'appointment';
  readonly payload: {
    appointmentId: string;
    staffId: string;
    cancelledBy: string;
    reason?: string;
    hadComanda: boolean;
    comandaId?: string;
    comandaCancelFailed?: boolean;
    failedComandaIds?: string[];
  };
}

export interface AppointmentCompletedEvent extends DomainEvent {
  readonly eventType: 'AppointmentCompleted';
  readonly aggregateType: 'appointment';
  readonly payload: {
    appointmentId: string;
    clientId?: string;
    staffId: string;
    serviceIds: string[];
    total: number;
    duration: number;
  };
}

// ─── Cash Closing Events ─────────────────────────────────────────

export interface CashClosingCompletedEvent extends DomainEvent {
  readonly eventType: 'CashClosingCompleted';
  readonly aggregateType: 'cash_closing';
  readonly payload: {
    closingId: string;
    businessDate: string;
    closedBy: string;
    expectedBalance: number;
    countedBalance: number;
    difference: number;
    extrasCount: number;
    hasDiscrepancy: boolean;
  };
}

// ─── ChefClub Events ─────────────────────────────────────────────

export interface SubscriptionCreatedEvent extends DomainEvent {
  readonly eventType: 'SubscriptionCreated';
  readonly aggregateType: 'subscription';
  readonly payload: {
    subscriptionId: string;
    clientId: string;
    planId: string;
    billingDay: number;
  };
}

export interface SubscriptionCancelledEvent extends DomainEvent {
  readonly eventType: 'SubscriptionCancelled';
  readonly aggregateType: 'subscription';
  readonly payload: {
    subscriptionId: string;
    reason?: string;
  };
}

export interface CreditsDeductedEvent extends DomainEvent {
  readonly eventType: 'CreditsDeducted';
  readonly aggregateType: 'subscription';
  readonly payload: {
    subscriptionId: string;
    serviceId: string;
    amount: number;
    reference: string;
  };
}

// ─── Financial Events ────────────────────────────────────────────

export interface TransactionCreatedEvent extends DomainEvent {
  readonly eventType: 'TransactionCreated';
  readonly aggregateType: 'transaction';
  readonly payload: {
    transactionId: string;
    type: 'income' | 'expense';
    amount: number;
    category: string;
    description?: string;
    comandaId?: string;
  };
}

export interface CommissionCalculatedEvent extends DomainEvent {
  readonly eventType: 'CommissionCalculated';
  readonly aggregateType: 'commission';
  readonly payload: {
    staffId: string;
    period: string;
    totalSales: number;
    totalCommission: number;
    lineCount: number;
  };
}

// ─── Tenant Lifecycle Events ─────────────────────────────────────

export interface TenantCreatedEvent extends DomainEvent {
  readonly eventType: 'TenantCreated';
  readonly aggregateType: 'tenant';
  readonly payload: {
    tenantId: string;
    slug: string;
    name: string;
    appSlug: string;
  };
}

export interface TenantOnboardingCompletedEvent extends DomainEvent {
  readonly eventType: 'TenantOnboardingCompleted';
  readonly aggregateType: 'tenant';
  readonly payload: {
    tenantId: string;
    slug: string;
    hasChairCount: boolean;
    hasBusinessHours: boolean;
    hasAddress: boolean;
  };
}

export interface TenantFirstAppointmentReachedEvent extends DomainEvent {
  readonly eventType: 'TenantFirstAppointmentReached';
  readonly aggregateType: 'tenant';
  readonly payload: {
    tenantId: string;
    appointmentId: string;
    ttfaMs: number;
  };
}

// ─── Team Invitation Events (Fase 6.0.3) ────────────────────────

export interface StaffInvitedEvent extends DomainEvent {
  readonly eventType: 'StaffInvited';
  readonly aggregateType: 'invitation';
  readonly payload: {
    invitationId: string;
    tenantId: string;
    email: string;
    role: 'barber' | 'receptionist';
  };
}

export interface StaffAcceptedEvent extends DomainEvent {
  readonly eventType: 'StaffAccepted';
  readonly aggregateType: 'invitation';
  readonly payload: {
    invitationId: string;
    tenantId: string;
    staffId: string;
    role: 'barber' | 'receptionist';
    email: string;
  };
}

// ─── Billing Events (Fase 6.0.4) ────────────────────────────────
// Convenção aprovada pelo PO (2026-08-06): prefixo TenantSubscription* para
// o estado do contrato e TenantTrial* / Invoice* / Payment* para o processo
// de cobrança — mantém separação do domínio ChefClub (customer_subscriptions).
// Aggregate types: 'tenant_subscription' | 'invoice' | 'payment'.

export interface TenantSubscriptionCreatedEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionCreated';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    plan: 'free' | 'pro' | 'premium';
    status: 'trialing' | 'active' | 'past_due' | 'cancelled';
    trialStartedAt: string | null;
    trialEndsAt: string | null;
  };
}

export interface TenantSubscriptionUpdatedEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionUpdated';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    plan: 'free' | 'pro' | 'premium';
    status: 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
    /** Pedido de cancelamento (D-A): fim do período; null quando não há pedido. */
    cancelAtPeriodEnd?: string | null;
  };
}

export interface TenantSubscriptionRenewedEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionRenewed';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
  };
}

export interface TenantSubscriptionCancelledEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionCancelled';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    reason?: string;
    canceledAt: string;
  };
}

export interface TenantSubscriptionSuspendedEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionSuspended';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
  };
}

export interface TenantSubscriptionReactivatedEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionReactivated';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
  };
}

export interface TenantSubscriptionExpiredEvent extends DomainEvent {
  readonly eventType: 'TenantSubscriptionExpired';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
  };
}

export interface TenantTrialStartedEvent extends DomainEvent {
  readonly eventType: 'TenantTrialStarted';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    trialStartedAt: string;
    trialEndsAt: string;
  };
}

export interface TenantTrialEndingEvent extends DomainEvent {
  readonly eventType: 'TenantTrialEnding';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
    trialEndsAt: string;
    daysRemaining: number;
  };
}

export interface TenantTrialEndedEvent extends DomainEvent {
  readonly eventType: 'TenantTrialEnded';
  readonly aggregateType: 'tenant_subscription';
  readonly payload: {
    subscriptionId: string;
    tenantId: string;
  };
}

export interface InvoiceCreatedEvent extends DomainEvent {
  readonly eventType: 'InvoiceCreated';
  readonly aggregateType: 'invoice';
  readonly payload: {
    invoiceId: string;
    tenantId: string;
    subscriptionId: string | null;
    amount: number;
    dueDate: string;
    billingPeriodStart: string;
    billingPeriodEnd: string;
  };
}

export interface InvoicePaidEvent extends DomainEvent {
  readonly eventType: 'InvoicePaid';
  readonly aggregateType: 'invoice';
  readonly payload: {
    invoiceId: string;
    tenantId: string;
    amount: number;
    paidAt: string;
  };
}

export interface InvoiceOverdueEvent extends DomainEvent {
  readonly eventType: 'InvoiceOverdue';
  readonly aggregateType: 'invoice';
  readonly payload: {
    invoiceId: string;
    tenantId: string;
    amount: number;
    dueDate: string;
  };
}

export interface InvoiceCancelledEvent extends DomainEvent {
  readonly eventType: 'InvoiceCancelled';
  readonly aggregateType: 'invoice';
  readonly payload: {
    invoiceId: string;
    tenantId: string;
    reason?: string;
  };
}

export interface PaymentSucceededEvent extends DomainEvent {
  readonly eventType: 'PaymentSucceeded';
  readonly aggregateType: 'payment';
  readonly payload: {
    attemptId: string;
    invoiceId: string;
    tenantId: string;
    provider: string | null;
  };
}

export interface PaymentFailedEvent extends DomainEvent {
  readonly eventType: 'PaymentFailed';
  readonly aggregateType: 'payment';
  readonly payload: {
    attemptId: string;
    invoiceId: string;
    tenantId: string;
    provider: string | null;
    error: string | null;
  };
}

export interface PaymentRefundedEvent extends DomainEvent {
  readonly eventType: 'PaymentRefunded';
  readonly aggregateType: 'payment';
  readonly payload: {
    attemptId: string;
    invoiceId: string;
    tenantId: string;
    provider: string | null;
  };
}

// ─── Union Type ──────────────────────────────────────────────────

export type SystemEvent =
  | CheckoutCompletedEvent
  | CheckoutRevertedEvent
  | AppointmentCreatedEvent
  | AppointmentCancelledEvent
  | AppointmentCompletedEvent
  | CashClosingCompletedEvent
  | SubscriptionCreatedEvent
  | SubscriptionCancelledEvent
  | CreditsDeductedEvent
  | TransactionCreatedEvent
  | CommissionCalculatedEvent
  | TenantCreatedEvent
  | TenantOnboardingCompletedEvent
  | TenantFirstAppointmentReachedEvent
  | StaffInvitedEvent
  | StaffAcceptedEvent
  | TenantSubscriptionCreatedEvent
  | TenantSubscriptionUpdatedEvent
  | TenantSubscriptionRenewedEvent
  | TenantSubscriptionCancelledEvent
  | TenantSubscriptionSuspendedEvent
  | TenantSubscriptionReactivatedEvent
  | TenantSubscriptionExpiredEvent
  | TenantTrialStartedEvent
  | TenantTrialEndingEvent
  | TenantTrialEndedEvent
  | InvoiceCreatedEvent
  | InvoicePaidEvent
  | InvoiceOverdueEvent
  | InvoiceCancelledEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentRefundedEvent;

export type EventType = SystemEvent['eventType'];

// ─── Event Factory ───────────────────────────────────────────────

let eventCounter = 0;

const generateEventId = (): string => {
  eventCounter += 1;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `evt_${timestamp}_${random}_${eventCounter}`;
};

/**
 * Creates a domain event with auto-generated eventId, occurredAt, and eventTypeVersion.
 *
 * Usage:
 *   createEvent<CheckoutCompletedEvent>({
 *     eventType: 'CheckoutCompleted',
 *     aggregateId: comandaId,
 *     aggregateType: 'comanda',
 *     payload: { comandaId, total: 100, ... },
 *     metadata: { tenantId, correlationId: idempotencyKey, source: 'CheckoutApplicationService' },
 *   });
 */
export const createEvent = <T extends SystemEvent>(
  base: Omit<T, 'eventId' | 'occurredAt' | 'eventTypeVersion'> & {
    metadata: EventMetadata;
  },
): T => ({
  ...base,
  eventId: generateEventId(),
  occurredAt: new Date().toISOString(),
  eventTypeVersion: (base as Record<string, unknown>).eventTypeVersion as number ?? 1,
} as T);
