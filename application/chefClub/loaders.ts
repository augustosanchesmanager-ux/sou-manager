/**
 * [SMG][APPLICATION][CHEF_CLUB] loaders
 *
 * Consultas e composição de dados do ChefClub.
 * Responsabilidade: apenas leitura — sem alterar estado.
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import {
    normalizeCreditBalances,
    normalizePlanServiceCredits,
    getTotalAvailableCredits,
    getTotalPlannedCredits,
    isFutureOrOpenDate,
    type ServiceBalanceEntry,
} from '../../domain/chefClub';
import { chefClubPlanRepository } from '../../domain/chefClub/plan-repository';
import { chefClubSubscriptionRepository } from '../../domain/chefClub/subscription-repository';
import { chefClubCreditRepository } from '../../domain/chefClub/credit-repository';
import { chefClubCreditTransactionRepository } from '../../domain/chefClub/credit-transaction-repository';
import { receivableRepository } from '../../domain/receivable/repository';
import { clientRepository } from '../../domain/client/repository';
import { serviceRepository } from '../../domain/service/repository';
import type { ChefClubPlan, SubscriptionDetailData, MembershipContext } from './types';
import { ChefClubError } from './types';

// ─── Plan Loaders ────────────────────────────────────────────────

export const loadActivePlans = async (tenantId: string): Promise<ChefClubPlan[]> => {
    const rows = await chefClubPlanRepository.listActive(tenantId);
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        monthly_price: Number(row.monthly_price || 0),
        service_credits: normalizePlanServiceCredits(row.service_credit_map || row.service_credits),
        description: row.description || null,
        priority_booking: row.priority_booking || false,
        product_discount: Number(row.product_discount || 0),
        active: row.active,
    }));
};

export const loadAllPlans = async (tenantId: string): Promise<ChefClubPlan[]> => {
    const rows = await chefClubPlanRepository.listAll(tenantId);
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        monthly_price: Number(row.monthly_price || 0),
        service_credits: normalizePlanServiceCredits(row.service_credit_map || row.service_credits),
        description: row.description || null,
        priority_booking: row.priority_booking || false,
        product_discount: Number(row.product_discount || 0),
        active: row.active,
    }));
};

// ─── Subscription Loaders ────────────────────────────────────────

export const loadSubscriptions = async (
    tenantId: string,
    options?: { status?: string; limit?: number },
): Promise<Record<string, unknown>[]> => {
    const rows = await chefClubSubscriptionRepository.list(tenantId, options);
    return rows.map((row) => ({ ...row }));
};

export const loadSubscription = async (
    tenantId: string,
    subscriptionId: string,
): Promise<Record<string, unknown> | null> => {
    const row = await chefClubSubscriptionRepository.get(subscriptionId, tenantId);
    return row ? { ...row } : null;
};

export const loadSubscriptionWithDetails = async (
    tenantId: string,
    subscriptionId: string,
): Promise<{
    subscription: Record<string, unknown> | null;
    plan: ChefClubPlan | null;
    credits: Record<string, unknown> | null;
} | null> => {
    const sub = await chefClubSubscriptionRepository.get(subscriptionId, tenantId);
    if (!sub) return null;

    const [planRow, creditRow] = await Promise.all([
        chefClubPlanRepository.get(sub.plan_id, tenantId),
        chefClubCreditRepository.getActiveBySubscription(subscriptionId, tenantId),
    ]);

    const plan: ChefClubPlan | null = planRow
        ? {
              id: planRow.id,
              name: planRow.name,
              monthly_price: Number(planRow.monthly_price || 0),
              service_credits: normalizePlanServiceCredits(planRow.service_credit_map || planRow.service_credits),
              description: planRow.description || null,
              priority_booking: planRow.priority_booking || false,
              product_discount: Number(planRow.product_discount || 0),
              active: planRow.active,
          }
        : null;

    return {
        subscription: { ...sub },
        plan,
        credits: creditRow ? { ...creditRow } : null,
    };
};

export const loadActiveSubscriptionForClient = async (
    tenantId: string,
    clientId: string,
): Promise<Record<string, unknown> | null> => {
    const row = await chefClubSubscriptionRepository.getActiveByClient(clientId, tenantId);
    return row ? { ...row } : null;
};

// ─── Credit Loaders ──────────────────────────────────────────────

export const loadCredits = async (
    tenantId: string,
    subscriptionId: string,
): Promise<ServiceBalanceEntry[]> => {
    const rows = await chefClubCreditRepository.getBySubscription(subscriptionId, tenantId);
    return normalizeCreditBalances(rows);
};

export const loadAllCredits = async (tenantId: string): Promise<Record<string, unknown>[]> => {
    const rows = await chefClubCreditRepository.listAll(tenantId);
    return rows.map((row) => ({ ...row }));
};

// ─── Receivable Loaders ──────────────────────────────────────────

export const loadReceivables = async (tenantId: string): Promise<Record<string, unknown>[]> => {
    const rows = await receivableRepository.list(tenantId);
    return rows.map((row) => ({ ...row }));
};

// ─── Reference Data Loaders ──────────────────────────────────────

export const loadClientsByIds = async (
    tenantId: string,
    clientIds: string[],
): Promise<Record<string, { id: string; name: string; phone: string }>> => {
    return clientRepository.getByIds(clientIds, tenantId);
};

export const loadAllClients = async (
    tenantId: string,
): Promise<{ id: string; name: string; phone: string }[]> => {
    const rows = await clientRepository.list(tenantId);
    return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone }));
};

// ─── Subscription Metrics ────────────────────────────────────────

export const loadMembershipMetrics = async (
    tenantId: string,
): Promise<{
    subscriptions: Record<string, unknown>[];
    plans: Record<string, unknown>[];
    credits: Record<string, unknown>[];
}> => {
    const [subs, plans, credits] = await Promise.all([
        chefClubSubscriptionRepository.list(tenantId),
        chefClubPlanRepository.listAll(tenantId),
        chefClubCreditRepository.listAll(tenantId),
    ]);

    return {
        subscriptions: subs.map((row) => ({ ...row })),
        plans: plans.map((row) => ({ ...row })),
        credits: credits.map((row) => ({ ...row })),
    };
};

// ─── Service Catalog Loader ──────────────────────────────────────

export interface ServiceOption {
    id: string;
    name: string;
    active?: boolean;
}

export const loadServices = async (tenantId: string): Promise<ServiceOption[]> => {
    const rows = await serviceRepository.listActive(tenantId);
    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        active: true,
    }));
};

// ─── Plan Page Loader ────────────────────────────────────────────

export interface PlanPageData {
    plans: Record<string, unknown>[];
    services: ServiceOption[];
}

export const loadPlansPage = async (tenantId: string): Promise<PlanPageData> => {
    const [plans, services] = await Promise.all([
        chefClubPlanRepository.listByPrice(tenantId, true),
        serviceRepository.listActive(tenantId),
    ]);

    return {
        plans: plans.map((row) => ({ ...row })),
        services: services.map((row) => ({
            id: row.id,
            name: row.name,
            active: true,
        })),
    };
};

// ─── Plan CRUD ───────────────────────────────────────────────────

export const savePlan = async (
    tenantId: string,
    planData: Record<string, unknown>,
    editingPlanId?: string,
): Promise<void> => {
    try {
        await chefClubPlanRepository.save(tenantId, planData, editingPlanId);
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao salvar plano:', error);
        throw new ChefClubError(
            `Falha ao salvar plano: ${(error as Error).message}`,
            'PLAN_SAVE_ERROR',
            error,
        );
    }
};

export const deletePlan = async (tenantId: string, planId: string): Promise<void> => {
    try {
        await chefClubPlanRepository.delete(planId, tenantId);
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao excluir plano:', error);
        throw new ChefClubError(
            `Falha ao excluir plano: ${(error as Error).message}`,
            'PLAN_DELETE_ERROR',
            error,
        );
    }
};

export const togglePlanStatus = async (tenantId: string, planId: string, active: boolean): Promise<void> => {
    try {
        await chefClubPlanRepository.toggleStatus(planId, active);
    } catch (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao alterar status do plano:', error);
        throw new ChefClubError(
            `Falha ao alterar status: ${(error as Error).message}`,
            'PLAN_TOGGLE_ERROR',
            error,
        );
    }
};

// ─── Plan Summary ────────────────────────────────────────────────

export interface PlanSummary {
    activePlans: number;
    potentialMonthlyRevenue: number;
    plannedCredits: number;
    serviceCatalog: number;
}

export const computePlanSummary = (
    plans: Record<string, unknown>[],
    services: ServiceOption[],
): PlanSummary => {
    const activePlans = plans.filter((p) => p.active);
    return {
        activePlans: activePlans.length,
        potentialMonthlyRevenue: activePlans.reduce(
            (sum, p) => sum + Number(p.monthly_price || 0),
            0,
        ),
        plannedCredits: activePlans.reduce((sum, p) => {
            const credits = normalizePlanServiceCredits(
                p.service_credit_map || p.service_credits,
            );
            return sum + getTotalPlannedCredits(credits);
        }, 0),
        serviceCatalog: services.length,
    };
};

// ─── Subscription Detail Loader ─────────────────────────────────

export const loadSubscriptionDetail = async (
    tenantId: string,
    subscriptionId: string,
): Promise<SubscriptionDetailData | null> => {
    const sub = await chefClubSubscriptionRepository.get(subscriptionId, tenantId);
    if (!sub) return null;

    const [plans, creditRow, clientInfo] = await Promise.all([
        chefClubPlanRepository.listByPrice(tenantId, true),
        chefClubCreditRepository.getActiveBySubscription(subscriptionId, tenantId),
        clientRepository.getOneById(sub.client_id, tenantId),
    ]);

    const mappedPlans = plans.map((row) => ({
        id: row.id,
        name: row.name,
        monthly_price: Number(row.monthly_price || 0),
        service_credits: normalizePlanServiceCredits(row.service_credit_map || row.service_credits),
        description: row.description || null,
        priority_booking: row.priority_booking || false,
        product_discount: Number(row.product_discount || 0),
        active: row.active,
    }));

    const currentPlan = mappedPlans.find((p) => p.id === sub.plan_id) || null;

    const creditData = creditRow
        ? {
              id: creditRow.id,
              subscription_id: creditRow.subscription_id,
              client_id: (creditRow as any).client_id || sub.client_id,
              available_credits: Number(creditRow.available_credits || 0),
              used_credits: Number(creditRow.used_credits || 0),
              service_balance_map: normalizeCreditBalances(
                  creditRow.service_balance_map,
                  Number(creditRow.available_credits || 0),
                  Number(creditRow.used_credits || 0),
              ),
              period_start: creditRow.period_start || null,
              period_end: creditRow.period_end || null,
          }
        : null;

    return {
        subscription: {
            id: sub.id,
            client_id: sub.client_id,
            plan_id: sub.plan_id,
            status: sub.status,
            started_at: sub.started_at,
            cycle_start: sub.cycle_start,
            cycle_end: sub.cycle_end,
            next_billing_date: sub.next_billing_date,
            canceled_at: sub.canceled_at,
            created_at: sub.created_at,
            service_balance_map: creditData?.service_balance_map || [],
            totalAvailableCredits: creditData?.available_credits || 0,
        },
        plan: currentPlan,
        credits: creditData,
        client: clientInfo,
        availablePlans: mappedPlans,
    };
};

// ─── Credit Transactions Loader ─────────────────────────────────

export interface CreditTransactionEntry {
    id: string;
    created_at: string;
    service_name: string;
    credits_used: number;
    appointment_id?: string;
    notes?: string;
}

export const loadCreditTransactions = async (
    tenantId: string,
    subscriptionId: string,
): Promise<CreditTransactionEntry[]> => {
    const rows = await chefClubCreditTransactionRepository.listBySubscription(subscriptionId, tenantId);
    return rows;
};

// ─── Membership Context Resolver ────────────────────────────────

/**
 * Resolve o contexto completo de associação de um cliente.
 * Usado por Checkout, Agendamento, App Mobile, Dashboard, etc.
 * Não conhece nenhum conceito de Checkout — apenas dados do Clube.
 */
export const resolveMembershipContext = async (
    tenantId: string,
    clientId: string,
): Promise<MembershipContext> => {
    const empty: MembershipContext = {
        subscriptionId: '',
        planName: '',
        hasMembership: false,
        canUseCredits: false,
        creditsRemaining: 0,
        serviceBalances: [],
        warnings: [],
        validationErrors: [],
    };

    // 1. Fetch latest active subscription
    const sub = await chefClubSubscriptionRepository.getActiveByClient(clientId, tenantId);
    if (!sub) return empty;

    // 2. Validate cycle is not expired
    if (!isFutureOrOpenDate(sub.cycle_end || sub.next_billing_date)) {
        return { ...empty, validationErrors: ['Ciclo de cobrança expirado.'] };
    }

    // 3. Check that a paid receivable exists for the current billing cycle
    const receivables = await receivableRepository.list(tenantId, {
        statuses: ['paid'],
        subscriptionId: sub.id,
    });

    const nowMs = Date.now();
    const paidForCurrentCycle = receivables.some((receivable) => {
        const cycleStart = new Date(receivable.billing_cycle_start).getTime();
        const cycleEnd = new Date(receivable.billing_cycle_end).getTime();
        return (
            !Number.isNaN(cycleStart) &&
            !Number.isNaN(cycleEnd) &&
            cycleStart <= nowMs &&
            cycleEnd >= nowMs
        );
    });

    if (!paidForCurrentCycle) {
        return { ...empty, validationErrors: ['Nenhum pagamento confirmado para o ciclo atual.'] };
    }

    // 4. Fetch plan + credits in parallel
    const [planRow, creditRow] = await Promise.all([
        chefClubPlanRepository.get(sub.plan_id, tenantId),
        chefClubCreditRepository.getForCycleValidation(sub.id, tenantId),
    ]);

    if (!creditRow || !isFutureOrOpenDate(creditRow.period_end)) {
        return { ...empty, validationErrors: ['Período de créditos expirado.'] };
    }

    // 5. Normalize balances
    const serviceBalances = normalizeCreditBalances(
        creditRow.service_balance_map,
        creditRow.available_credits || 0,
        creditRow.used_credits || 0,
    );

    const creditsRemaining = getTotalAvailableCredits(serviceBalances);

    return {
        subscriptionId: sub.id,
        planName: planRow?.name || 'Plano ativo',
        hasMembership: true,
        canUseCredits: creditsRemaining > 0,
        creditsRemaining,
        serviceBalances,
        warnings: [],
        validationErrors: [],
    };
};
