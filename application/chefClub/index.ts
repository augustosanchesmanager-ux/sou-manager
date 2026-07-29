/**
 * [SMG][APPLICATION][CHEF_CLUB] index
 *
 * Compositor + re-exports do módulo ChefClub.
 * Mantém a API pública idêntica ao application/chefClub.ts monolítico.
 */

// Types
export {
    type ChefClubSubscription,
    type ChefClubPlan,
    type ChefClubCredit,
    type ChefClubReceivable,
    type SubscriptionDetailData,
    type SubscriptionDetailClient,
    type MembershipContext,
    type ResolveSubscriptionParams,
    type DeductCreditsParams,
    type CreateSubscriptionParams,
    type PayReceivableParams,
    type UpdateSubscriptionParams,
    ChefClubError,
} from './types';

// Loaders
export {
    loadActivePlans,
    loadAllPlans,
    loadSubscriptions,
    loadSubscription,
    loadSubscriptionWithDetails,
    loadSubscriptionDetail,
    loadActiveSubscriptionForClient,
    loadCredits,
    loadAllCredits,
    loadReceivables,
    loadClientsByIds,
    loadAllClients,
    loadMembershipMetrics,
    loadServices,
    loadPlansPage,
    loadCreditTransactions,
    resolveMembershipContext,
    savePlan,
    deletePlan,
    togglePlanStatus,
    computePlanSummary,
} from './loaders';
export type {
    ServiceOption,
    PlanPageData,
    PlanSummary,
    CreditTransactionEntry,
} from './loaders';

// Subscriptions
export {
    createSubscription,
    updateSubscriptionStatus,
    changePlan,
    updateBillingDate,
    updateCreditMap,
} from './subscriptions';

// Credits
export {
    resolveSubscription,
    getAvailableCredits,
    hasAvailableCredits,
    deductCredits,
    deductCreditsBatch,
} from './credits';

// Domain re-exports (pure functions)
export {
    canApplyCredit,
    getAvailableCreditsForService,
    getTotalAvailableCredits,
    getTotalUsedCredits,
    normalizeCreditBalances,
} from '../../domain/chefClub/credits';

// Receivables
export {
    generateReceivables,
    payReceivable,
    settleReceivableWithDetails,
    refreshReceivableStatuses,
    loadReceivablePage,
    canPayReceivable,
    getDisplayStatus,
    filterReceivables,
    computeReceivableTotals,
} from './receivables';
export type {
    ReceivablePageData,
    ReceivableRecord,
    ClientRecord,
    PlanRecord,
    ReceivableTotals,
} from './receivables';

// Operations
export {
    activatePlan,
    settleReceivable,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
} from './operations';

/**
 * Compositor de classe (backward compatibility).
 * Mantém a interface `chefClubApplicationService` para consumers existentes.
 */
import { resolveSubscription, getAvailableCredits, hasAvailableCredits, deductCredits, deductCreditsBatch } from './credits';
import type { ResolveSubscriptionParams, DeductCreditsParams } from './types';
import type { ServiceBalanceEntry } from '../../domain/chefClub';
import type { ChefClubSubscription } from './types';

class ChefClubApplicationServiceImpl {
    async resolveSubscription(params: ResolveSubscriptionParams): Promise<ChefClubSubscription | null> {
        return resolveSubscription(params.tenantId, params.clientId);
    }

    getAvailableCredits(serviceBalances: ServiceBalanceEntry[], serviceId: string): number {
        return getAvailableCredits(serviceBalances, serviceId);
    }

    hasAvailableCredits(serviceBalances: ServiceBalanceEntry[]): boolean {
        return hasAvailableCredits(serviceBalances);
    }

    async deductCredits(params: DeductCreditsParams): Promise<void> {
        return deductCredits(params);
    }

    async deductCreditsBatch(params: DeductCreditsParams[]): Promise<{ success: number; failed: number }> {
        return deductCreditsBatch(params);
    }
}

export const chefClubApplicationService = new ChefClubApplicationServiceImpl();
