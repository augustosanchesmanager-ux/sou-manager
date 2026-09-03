/**
 * [SMG][APPLICATION][CHEF_CLUB] subscriptions
 *
 * Ciclo de vida de assinaturas: criar, pausar, retomar, cancelar, mudar plano.
 * Orquestra repositórios e RPCs — não contém regras de negócio puras.
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import {
  validateStatusTransition,
  getTotalAvailableCredits,
  getTotalUsedCredits,
  type SubscriptionStatus as ChefClubSubscriptionStatus,
} from '../../domain/chefClub';
import { chefClubSubscriptionRepository } from '../../domain/chefClub/subscription-repository';
import { chefClubCreditRepository } from '../../domain/chefClub/credit-repository';
import { createSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../../domain/shared/database-client';
import { ChefClubError } from './types';
import type { CreateSubscriptionParams } from './types';

// ─── RPC Helper ─────────────────────────────────────────────────

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('customer_subscriptions', 'barber');
    }
    return rpcClient;
}

// ─── Create ──────────────────────────────────────────────────────

export const createSubscription = async (params: CreateSubscriptionParams): Promise<string> => {
    const { tenantId, clientId, planId, billingDay, replaceExisting } = params;

    const { data, error } = await getRpcClient().rpc('create_chef_club_subscription', {
        p_tenant_id: tenantId,
        p_client_id: clientId,
        p_plan_id: planId,
        p_billing_day: billingDay,
        p_replace_existing: replaceExisting || false,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao criar assinatura:', error);
        throw new ChefClubError(
            `Falha ao criar assinatura: ${error.message}`,
            'CREATE_ERROR',
            error,
        );
    }

    return data;
};

// ─── Update Status ───────────────────────────────────────────────

export const updateSubscriptionStatus = async (
    tenantId: string,
    subscriptionId: string,
    newStatus: string,
): Promise<void> => {
    // Buscar status atual
    const current = await chefClubSubscriptionRepository.get(subscriptionId, tenantId);

    if (!current) {
        throw new ChefClubError(
            'Assinatura não encontrada',
            'NOT_FOUND',
        );
    }

    // Validar transição
    const validation = validateStatusTransition(
        current.status as ChefClubSubscriptionStatus,
        newStatus as 'active' | 'past_due' | 'canceled' | 'paused',
    );

    if (!validation.valid) {
        throw new ChefClubError(
            'reason' in validation ? validation.reason : 'Transição de status inválida',
            'INVALID_TRANSITION',
        );
    }

    const updateData: Record<string, unknown> = { status: newStatus };

    if (newStatus === 'canceled') {
        updateData.canceled_at = new Date().toISOString();
    }

    try {
        await chefClubSubscriptionRepository.updateStatus(subscriptionId, tenantId, updateData);
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao atualizar status:', error);
        throw new ChefClubError(
            `Falha ao atualizar status: ${(error as Error).message}`,
            'UPDATE_ERROR',
            error,
        );
    }
};

// ─── Change Plan ─────────────────────────────────────────────────

export const changePlan = async (
    tenantId: string,
    subscriptionId: string,
    newPlanId: string,
): Promise<void> => {
    try {
        await chefClubSubscriptionRepository.updatePlan(subscriptionId, tenantId, newPlanId);
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao mudar plano:', error);
        throw new ChefClubError(
            `Falha ao mudar plano: ${(error as Error).message}`,
            'PLAN_CHANGE_ERROR',
            error,
        );
    }
};

// ─── Update Billing Date ─────────────────────────────────────────

export const updateBillingDate = async (
    tenantId: string,
    subscriptionId: string,
    nextBillingDate: string,
): Promise<void> => {
    const cycleEnd = new Date(nextBillingDate);
    cycleEnd.setDate(cycleEnd.getDate() + 30);

    try {
        await chefClubSubscriptionRepository.updateBillingDate(subscriptionId, tenantId, {
            next_billing_date: nextBillingDate,
            cycle_end: cycleEnd.toISOString(),
        });
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao atualizar data de cobrança:', error);
        throw new ChefClubError(
            `Falha ao atualizar data de cobrança: ${(error as Error).message}`,
            'BILLING_DATE_ERROR',
            error,
        );
    }
};

// ─── Update Credit Map ───────────────────────────────────────────

export const updateCreditMap = async (
    tenantId: string,
    subscriptionId: string,
    serviceBalanceMap: unknown,
): Promise<void> => {
    const balances = Array.isArray(serviceBalanceMap) ? serviceBalanceMap : [];
    const availableCredits = getTotalAvailableCredits(balances);
    const usedCredits = getTotalUsedCredits(balances);

    try {
        await chefClubCreditRepository.updateBalance(subscriptionId, tenantId, {
            service_balance_map: serviceBalanceMap,
            available_credits: availableCredits,
            used_credits: usedCredits,
        });
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao atualizar mapa de créditos:', error);
        throw new ChefClubError(
            `Falha ao atualizar mapa de créditos: ${(error as Error).message}`,
            'CREDIT_MAP_ERROR',
            error,
        );
    }
};
