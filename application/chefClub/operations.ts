/**
 * [SMG][APPLICATION][CHEF_CLUB] operations
 *
 * Casos de uso de alto nível que orquestram múltiplos sub-services.
 * Cada operação representa uma intenção do usuário.
 */

import { createSubscription, updateSubscriptionStatus } from './subscriptions';
import { generateReceivables, payReceivable } from './receivables';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type { SubscriptionCreatedEvent, SubscriptionCancelledEvent } from '../../domain/events/types';
import { createSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../../domain/shared/database-client';
import { ChefClubError } from './types';

// ─── RPC Helper ─────────────────────────────────────────────────

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('customer_subscriptions', 'barber');
    }
    return rpcClient;
}

// ─── Activate Plan (create subscription + generate receivables) ──

export const activatePlan = async (params: {
    tenantId: string;
    clientId: string;
    planId: string;
    billingDay: number;
    replaceExisting?: boolean;
}): Promise<string> => {
    const subscriptionId = await createSubscription(params);
    await generateReceivables(params.tenantId);

    // Publish domain event
    await appEventBus.publish(createEvent<SubscriptionCreatedEvent>({
        eventType: 'SubscriptionCreated',
        aggregateId: subscriptionId,
        aggregateType: 'subscription',
        payload: {
            subscriptionId,
            clientId: params.clientId,
            planId: params.planId,
            billingDay: params.billingDay,
        },
        metadata: {
            tenantId: params.tenantId,
            source: 'ChefClubApplicationService',
        },
    }));

    return subscriptionId;
};

// ─── Settle Receivable (pay + refresh statuses) ─────────────────

export const settleReceivable = async (params: {
    tenantId: string;
    receivableId: string;
    paymentMethod: string;
}): Promise<void> => {
    await payReceivable(params);
    await generateReceivables(params.tenantId);
};

// ─── Pause Subscription ─────────────────────────────────────────

export const pauseSubscription = async (
    tenantId: string,
    subscriptionId: string,
): Promise<void> => {
    await updateSubscriptionStatus(tenantId, subscriptionId, 'paused');
};

// ─── Resume Subscription ────────────────────────────────────────

export const resumeSubscription = async (
    tenantId: string,
    subscriptionId: string,
): Promise<void> => {
    await updateSubscriptionStatus(tenantId, subscriptionId, 'active');
};

// ─── Cancel Subscription ────────────────────────────────────────

export const cancelSubscription = async (
    tenantId: string,
    subscriptionId: string,
): Promise<void> => {
    await updateSubscriptionStatus(tenantId, subscriptionId, 'canceled');

    // Publish domain event
    await appEventBus.publish(createEvent<SubscriptionCancelledEvent>({
        eventType: 'SubscriptionCancelled',
        aggregateId: subscriptionId,
        aggregateType: 'subscription',
        payload: {
            subscriptionId,
            reason: 'user_cancelled',
        },
        metadata: {
            tenantId,
            source: 'ChefClubApplicationService',
        },
    }));
};

// ─── Cancel Subscription With Receivables ────────────────────────

export interface CancelSubscriptionWithReceivablesParams {
    subscriptionId: string;
    tenantId: string;
    cancelReceivables: boolean;
    cancelReason?: string;
    cancelObservation?: string | null;
}

export const cancelSubscriptionWithReceivables = async (
    params: CancelSubscriptionWithReceivablesParams,
): Promise<{ subscriptionCancelled: boolean; receivablesCancelled: number }> => {
    const { subscriptionId, tenantId, cancelReceivables, cancelReason, cancelObservation } = params;

    const { data, error } = await getRpcClient().rpc('cancel_subscription_with_receivables', {
        p_subscription_id: subscriptionId,
        p_tenant_id: tenantId,
        p_cancel_receivables: cancelReceivables,
        p_cancel_reason: cancelReason ?? null,
        p_cancel_observation: cancelObservation ?? null,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao cancelar assinatura com recebíveis:', error);
        throw new ChefClubError(
            `Falha ao cancelar assinatura: ${error.message}`,
            'CANCEL_SUBSCRIPTION_ERROR',
            error,
        );
    }

    const result = data as { subscription_cancelled: boolean; receivables_cancelled: number };
    return {
        subscriptionCancelled: result.subscription_cancelled,
        receivablesCancelled: result.receivables_cancelled,
    };
};
