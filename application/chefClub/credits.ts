/**
 * [SMG][APPLICATION][CHEF_CLUB] credits
 *
 * Consumo, validação e dedução de créditos do Club dos Chefes.
 * Orquestra RPCs — não contém regras de normalização (estas em domain/chefClub/credits.ts).
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import {
    getAvailableCreditsForService,
    getTotalAvailableCredits,
    normalizeCreditBalances,
    type ServiceBalanceEntry,
} from '../../domain/chefClub';
import { isCycleDateValid } from '../../domain/chefClub';
import { chefClubSubscriptionRepository } from '../../domain/chefClub/subscription-repository';
import { chefClubCreditRepository } from '../../domain/chefClub/credit-repository';
import { receivableRepository } from '../../domain/receivable/repository';
import { createSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../../domain/shared/database-client';
import { ChefClubError } from './types';
import type { DeductCreditsParams } from './types';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type { CreditsDeductedEvent } from '../../domain/events/types';

// ─── RPC Helper ─────────────────────────────────────────────────

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('customer_subscriptions', 'barber');
    }
    return rpcClient;
}

// ─── Resolve Subscription (read-only) ────────────────────────────

export interface ResolvedSubscription {
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

export const resolveSubscription = async (
    tenantId: string,
    clientId: string,
): Promise<ResolvedSubscription | null> => {
    // 1. Fetch latest active subscription
    const subscription = await chefClubSubscriptionRepository.getActiveByClient(clientId, tenantId);
    if (!subscription) return null;

    // 2. Validate cycle is not expired
    const cycleEnd = subscription.cycle_end || subscription.next_billing_date;
    if (!isCycleDateValid(cycleEnd)) return null;

    // 3. Check that a paid receivable exists for current cycle
    const receivables = await receivableRepository.list(tenantId, {
        statuses: ['paid'],
        subscriptionId: subscription.id,
    });

    if (!receivables || receivables.length === 0) return null;

    // 4. Fetch credit balances
    const credits = await chefClubCreditRepository.getBySubscription(subscription.id, tenantId);

    // 5. Normalize service balance map
    const serviceBalanceMap = normalizeCreditBalances(
        subscription.service_balance_map || credits || [],
    );

    const totalAvailableCredits = getTotalAvailableCredits(serviceBalanceMap);

    return {
        id: subscription.id,
        client_id: subscription.client_id,
        plan_id: subscription.plan_id,
        status: subscription.status,
        started_at: subscription.started_at || null,
        cycle_start: subscription.cycle_start,
        cycle_end: subscription.cycle_end,
        next_billing_date: subscription.next_billing_date,
        canceled_at: subscription.canceled_at || null,
        created_at: subscription.created_at || null,
        service_balance_map: serviceBalanceMap,
        totalAvailableCredits,
    };
};

// ─── Credit Queries ──────────────────────────────────────────────

export const getAvailableCredits = (
    serviceBalances: ServiceBalanceEntry[],
    serviceId: string,
): number => {
    return getAvailableCreditsForService(serviceBalances, serviceId);
};

export const hasAvailableCredits = (serviceBalances: ServiceBalanceEntry[]): boolean => {
    return getTotalAvailableCredits(serviceBalances) > 0;
};

// ─── Deduction ───────────────────────────────────────────────────

export const deductCredits = async (params: DeductCreditsParams): Promise<void> => {
    const { tenantId, subscriptionId, serviceId, amount, reference } = params;

    const { error } = await getRpcClient().rpc('deduct_chef_club_credits', {
        p_subscription_id: subscriptionId,
        p_service_id: serviceId,
        p_amount: amount,
        p_reference: reference,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao deduzir créditos:', error);
        throw new ChefClubError(
            `Falha ao deduzir créditos: ${error.message}`,
            'DEDUCTION_ERROR',
            error,
        );
    }

    // Publish domain event
    await appEventBus.publish(createEvent<CreditsDeductedEvent>({
        eventType: 'CreditsDeducted',
        aggregateId: subscriptionId,
        aggregateType: 'subscription',
        payload: {
            subscriptionId,
            serviceId,
            amount,
            reference,
        },
        metadata: {
            tenantId,
            source: 'ChefClubApplicationService',
        },
    }));
};

export const deductCreditsBatch = async (
    params: DeductCreditsParams[],
): Promise<{ success: number; failed: number }> => {
    let success = 0;
    let failed = 0;

    for (const param of params) {
        try {
            await deductCredits(param);
            success++;
        } catch {
            failed++;
        }
    }

    return { success, failed };
};
