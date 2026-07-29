/**
 * [SMG][APPLICATION][CHEF_CLUB] re-export
 *
 * Re-export barrel para backward compatibility.
 * Código canônico agora está em application/chefClub/ directory.
 */
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
    chefClubApplicationService,
} from './chefClub/index';

export {
    resolveSubscription,
    getAvailableCredits,
    hasAvailableCredits,
    deductCredits,
    deductCreditsBatch,
} from './chefClub/credits';

export {
    canApplyCredit,
    getAvailableCreditsForService,
    getTotalAvailableCredits,
    getTotalUsedCredits,
    normalizeCreditBalances,
} from '../domain/chefClub/credits';

export {
    createSubscription,
    updateSubscriptionStatus,
    changePlan,
    updateBillingDate,
    updateCreditMap,
} from './chefClub/subscriptions';

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
} from './chefClub/receivables';

export type {
    ReceivablePageData,
    ReceivableRecord,
    ClientRecord,
    PlanRecord,
    ReceivableTotals,
} from './chefClub/receivables';

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
} from './chefClub/loaders';

export type {
    ServiceOption,
    PlanPageData,
    PlanSummary,
    CreditTransactionEntry,
} from './chefClub/loaders';

export {
    activatePlan,
    settleReceivable,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
} from './chefClub/operations';
