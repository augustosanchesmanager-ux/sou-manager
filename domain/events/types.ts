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
  | TenantFirstAppointmentReachedEvent;

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
