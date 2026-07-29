/**
 * [SMG][APPLICATION][CHEF_CLUB] types
 *
 * DTOs, interfaces e erros do domínio ChefClub.
 * Código canônico — substitui application/chefClub.ts.
 */

import type { ServiceBalanceEntry, ServiceCreditsEntry } from '../../domain/chefClub';

// ─── DTOs ────────────────────────────────────────────────────────

export interface ChefClubSubscription {
    id: string;
    client_id: string;
    plan_id: string;
    status: string;
    started_at: string | null;
    cycle_start: string | null;
    cycle_end: string | null;
    next_billing_date: string | null;
    canceled_at: string | null;
    created_at: string | null;
    service_balance_map: ServiceBalanceEntry[];
    totalAvailableCredits: number;
}

export interface ChefClubPlan {
    id: string;
    name: string;
    monthly_price: number;
    service_credits: ServiceCreditsEntry[];
    description: string | null;
    priority_booking: boolean;
    product_discount: number;
    active: boolean;
}

export interface ChefClubCredit {
    id: string;
    subscription_id: string;
    client_id: string;
    available_credits: number;
    used_credits: number;
    service_balance_map: ServiceBalanceEntry[];
    period_start: string | null;
    period_end: string | null;
}

export interface ChefClubReceivable {
    id: string;
    customer_id: string;
    subscription_id: string;
    plan_id: string;
    billing_cycle_start: string;
    billing_cycle_end: string;
    due_date: string;
    amount: number;
    status: string;
    payment_method: string | null;
    paid_at: string | null;
    transaction_id: string | null;
    notes: string | null;
}

// ─── Params ──────────────────────────────────────────────────────

export interface ResolveSubscriptionParams {
    tenantId: string;
    clientId: string;
}

export interface DeductCreditsParams {
    tenantId: string;
    subscriptionId: string;
    serviceId: string;
    amount: number;
    reference: string;
}

export interface CreateSubscriptionParams {
    tenantId: string;
    clientId: string;
    planId: string;
    billingDay: number;
    replaceExisting?: boolean;
}

export interface PayReceivableParams {
    tenantId: string;
    receivableId: string;
    paymentMethod: string;
}

export interface UpdateSubscriptionParams {
    tenantId: string;
    subscriptionId: string;
    updates: {
        plan_id?: string;
        status?: string;
        next_billing_date?: string;
    };
}

// ─── Subscription Detail DTO ─────────────────────────────────────

export interface SubscriptionDetailClient {
    id: string;
    name: string;
    phone: string;
}

export interface SubscriptionDetailData {
    subscription: ChefClubSubscription;
    plan: ChefClubPlan | null;
    credits: ChefClubCredit | null;
    client: SubscriptionDetailClient | null;
    availablePlans: ChefClubPlan[];
}

// ─── Membership Context ────────────────────────────────────────

export interface MembershipContext {
    subscriptionId: string;
    planName: string;
    hasMembership: boolean;
    canUseCredits: boolean;
    creditsRemaining: number;
    serviceBalances: import('../../domain/chefClub').ServiceBalanceEntry[];
    warnings: string[];
    validationErrors: string[];
}

// ─── Errors ──────────────────────────────────────────────────────

export class ChefClubError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'ChefClubError';
    }
}
