/**
 * [SMG][APPLICATION][CHEF_CLUB] receivables
 *
 * Geração, consulta e baixa de recebíveis do Club dos Chefes.
 * Orquestra RPCs e repositórios — regras de negócio puras em domain/.
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import { receivableRepository } from '../../domain/receivable/repository';
import { clientRepository } from '../../domain/client/repository';
import { chefClubPlanRepository } from '../../domain/chefClub/plan-repository';
import { chefClubSubscriptionRepository } from '../../domain/chefClub/subscription-repository';
import { createSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../../domain/shared/database-client';
import type { ReceivableStatus } from '../../domain/chefClub';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type { SubscriptionCancelledEvent } from '../../domain/events/types';
import { ChefClubError } from './types';
import type { PayReceivableParams } from './types';

// ─── Types ───────────────────────────────────────────────────────

export interface SubscriptionSummaryRecord {
    id: string;
    status: string;
}

export interface ReceivablePageData {
    receivables: ReceivableRecord[];
    clients: Record<string, ClientRecord>;
    plans: Record<string, PlanRecord>;
    subscriptions?: Record<string, SubscriptionSummaryRecord>;
}

export interface ReceivableRecord {
    id: string;
    tenant_id: string;
    customer_id: string;
    subscription_id: string;
    plan_id: string;
    billing_cycle_start: string;
    billing_cycle_end: string;
    due_date: string;
    amount: number | string;
    status: ReceivableStatus;
    payment_method: string | null;
    paid_at: string | null;
    transaction_id: string | null;
    notes: string | null;
    cancel_reason?: string | null;
    cancel_observation?: string | null;
    cancelled_at?: string | null;
    created_at: string;
}

export interface ClientRecord {
    id: string;
    name: string;
    phone: string | null;
}

export interface PlanRecord {
    id: string;
    name: string;
    monthly_price: number | string | null;
}

export interface ReceivableTotals {
    total: number;
    paid: number;
    pending: number;
    overdue: number;
    cancelled: number;
    count: number;
    statusCounts: Record<ReceivableStatus | 'all', number>;
}

// ─── Pure Helpers ────────────────────────────────────────────────

const toDateInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const toPaidAtIso = (date: string): string => {
    if (!date) return new Date().toISOString();
    return new Date(`${date}T12:00:00`).toISOString();
};

export const getDisplayStatus = (receivable: ReceivableRecord): ReceivableStatus => {
    const today = toDateInput(new Date());
    return receivable.status === 'pending' && receivable.due_date < today ? 'overdue' : receivable.status;
};

export const canPayReceivable = (receivable: ReceivableRecord): boolean => {
    const status = getDisplayStatus(receivable);
    return status === 'pending' || status === 'overdue';
};

export const canCancelReceivable = (receivable: ReceivableRecord): boolean => {
    const status = getDisplayStatus(receivable);
    return status === 'pending' || status === 'overdue';
};

export const filterReceivables = (
    receivables: ReceivableRecord[],
    clients: Record<string, ClientRecord>,
    plans: Record<string, PlanRecord>,
    search: string,
): ReceivableRecord[] => {
    const term = search.trim().toLowerCase();
    if (!term) return receivables;

    return receivables.filter((receivable) => {
        const client = clients[receivable.customer_id];
        const plan = plans[receivable.plan_id];
        return [
            client?.name,
            client?.phone,
            plan?.name,
            receivable.id,
        ].some((value) => `${value || ''}`.toLowerCase().includes(term));
    });
};

export const computeReceivableTotals = (receivables: ReceivableRecord[]): ReceivableTotals => {
    return receivables.reduce(
        (acc, receivable) => {
            const amount = Number(receivable.amount || 0);
            const displayStatus = getDisplayStatus(receivable);
            acc.statusCounts[displayStatus] += 1;
            acc.statusCounts.all += 1;

            if (displayStatus === 'cancelled' || displayStatus === 'refunded') {
                acc.cancelled += amount;
                return acc;
            }

            acc.total += amount;
            acc.count += 1;
            if (receivable.status === 'paid') acc.paid += amount;
            if (displayStatus === 'pending') acc.pending += amount;
            if (displayStatus === 'overdue') acc.overdue += amount;
            return acc;
        },
        {
            total: 0,
            paid: 0,
            pending: 0,
            overdue: 0,
            cancelled: 0,
            count: 0,
            statusCounts: { all: 0, pending: 0, paid: 0, overdue: 0, cancelled: 0, refunded: 0 } as Record<ReceivableStatus | 'all', number>,
        },
    );
};

// ─── Page Data Loader ────────────────────────────────────────────

export const loadReceivablePage = async (
    tenantId: string,
    options?: { status?: ReceivableStatus | 'all'; dateFrom?: string; dateTo?: string },
): Promise<ReceivablePageData> => {
    // 1. Generate receivables (idempotent RPC)
    await generateReceivables(tenantId);

    // 2. Load receivables with filters
    const receivables = await receivableRepository.list(tenantId, {
        status: options?.status && options.status !== 'all' ? options.status : undefined,
        dateFrom: options?.dateFrom,
        dateTo: options?.dateTo,
    });

    // 3. Load reference data (clients + plans + subscriptions)
    const customerIds = Array.from(new Set(receivables.map((r) => r.customer_id).filter(Boolean)));
    const planIds = Array.from(new Set(receivables.map((r) => r.plan_id).filter(Boolean)));

    const [clientsMap, plansMap, subscriptionsMap] = await Promise.all([
        loadClientsMap(tenantId, customerIds),
        loadPlansMap(tenantId, planIds),
        loadSubscriptionsMap(tenantId),
    ]);

    return {
        receivables: receivables as unknown as ReceivableRecord[],
        clients: clientsMap,
        plans: plansMap,
        subscriptions: subscriptionsMap,
    };
};

// ─── Reference Data Loaders ──────────────────────────────────────

const loadSubscriptionsMap = async (
    tenantId: string,
): Promise<Record<string, SubscriptionSummaryRecord>> => {
    try {
        const rows = await chefClubSubscriptionRepository.list(tenantId);
        if (!Array.isArray(rows)) return {};
        return rows.reduce<Record<string, SubscriptionSummaryRecord>>((acc, row) => {
            acc[row.id] = { id: row.id, status: row.status };
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const loadClientsMap = async (
    tenantId: string,
    clientIds: string[],
): Promise<Record<string, ClientRecord>> => {
    if (clientIds.length === 0) return {};
    return clientRepository.getByIds(clientIds, tenantId) as Promise<Record<string, ClientRecord>>;
};

const loadPlansMap = async (
    tenantId: string,
    planIds: string[],
): Promise<Record<string, PlanRecord>> => {
    if (planIds.length === 0) return {};
    const plans = await chefClubPlanRepository.getByIds(planIds, tenantId);
    return plans.reduce<Record<string, PlanRecord>>((acc, plan) => {
        acc[plan.id] = plan as unknown as PlanRecord;
        return acc;
    }, {});
};

// ─── Generate Receivables ────────────────────────────────────────

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('customer_subscriptions', 'barber');
    }
    return rpcClient;
}

export const generateReceivables = async (tenantId: string): Promise<void> => {
    const { error } = await getRpcClient().rpc('generate_club_receivables', {
        p_tenant_id: tenantId,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao gerar recebíveis:', error);
        throw new ChefClubError(
            `Falha ao gerar recebíveis: ${error.message}`,
            'GENERATE_ERROR',
            error,
        );
    }
};

// ─── Pay Receivable ──────────────────────────────────────────────

export const payReceivable = async (params: PayReceivableParams): Promise<void> => {
    const { receivableId, paymentMethod } = params;

    const { error } = await getRpcClient().rpc('pay_club_receivable', {
        p_receivable_id: receivableId,
        p_payment_method: paymentMethod,
        p_paid_at: new Date().toISOString(),
        p_notes: null,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao pagar recebível:', error);
        throw new ChefClubError(
            `Falha ao pagar recebível: ${error.message}`,
            'PAY_ERROR',
            error,
        );
    }
};

export const settleReceivableWithDetails = async (params: {
    receivableId: string;
    paymentMethod: string;
    paidAt: string;
    notes: string | null;
}): Promise<void> => {
    const { error } = await getRpcClient().rpc('pay_club_receivable', {
        p_receivable_id: params.receivableId,
        p_payment_method: params.paymentMethod,
        p_paid_at: toPaidAtIso(params.paidAt),
        p_notes: params.notes?.trim() || null,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao pagar recebível:', error);
        throw new ChefClubError(
            `Falha ao pagar recebível: ${error.message}`,
            'PAY_ERROR',
            error,
        );
    }
};

// ─── Refresh Statuses ────────────────────────────────────────────

export const refreshReceivableStatuses = async (tenantId: string): Promise<void> => {
    const { error } = await getRpcClient().rpc('refresh_club_receivable_statuses', {
        p_tenant_id: tenantId,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao atualizar status dos recebíveis:', error);
        throw new ChefClubError(
            `Falha ao atualizar status: ${error.message}`,
            'REFRESH_ERROR',
            error,
        );
    }
};

// ─── Cancel Receivables ──────────────────────────────────────────

export interface CancelReceivablesParams {
    subscriptionId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
}

export const cancelReceivablesBySubscription = async (
    params: CancelReceivablesParams,
): Promise<number> => {
    const { subscriptionId, tenantId, cancelReason, cancelObservation } = params;

    const { data, error } = await getRpcClient().rpc('cancel_club_receivables', {
        p_subscription_id: subscriptionId,
        p_tenant_id: tenantId,
        p_cancel_reason: cancelReason,
        p_cancel_observation: cancelObservation ?? null,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao cancelar recebíveis:', error);
        throw new ChefClubError(
            `Falha ao cancelar recebíveis: ${error.message}`,
            'CANCEL_RECEIVABLE_ERROR',
            error,
        );
    }

    return Number(data ?? 0);
};

export interface CancelSingleReceivableParams {
    receivableId: string;
    tenantId: string;
    cancelReason: string;
    cancelObservation?: string | null;
    cancelSubscription?: boolean;
}

export interface CancelSingleReceivableResult {
    receivableCancelled: boolean;
    subscriptionCancelled: boolean;
    subscriptionId: string;
    receivablesCancelled: number;
}

export const cancelSingleReceivable = async (
    params: CancelSingleReceivableParams,
): Promise<CancelSingleReceivableResult> => {
    const {
        receivableId,
        tenantId,
        cancelReason,
        cancelObservation,
        cancelSubscription = false,
    } = params;

    const { data, error } = await getRpcClient().rpc('cancel_single_club_receivable', {
        p_receivable_id: receivableId,
        p_tenant_id: tenantId,
        p_cancel_reason: cancelReason,
        p_cancel_observation: cancelObservation?.trim() || null,
        p_cancel_subscription: cancelSubscription,
    });

    if (error) {
        console.error('[SMG][CHEF_CLUB] Erro ao cancelar recebível avulso:', error);
        throw new ChefClubError(
            `Falha ao cancelar recebível: ${error.message}`,
            'CANCEL_RECEIVABLE_ERROR',
            error,
        );
    }

    const raw = (data || {}) as {
        receivable_cancelled?: boolean;
        subscription_cancelled?: boolean;
        subscription_id?: string;
        receivables_cancelled?: number;
    };

    const subscriptionCancelled = Boolean(raw.subscription_cancelled);
    const subscriptionId = raw.subscription_id || '';

    if (subscriptionCancelled && subscriptionId) {
        await appEventBus.publish(createEvent<SubscriptionCancelledEvent>({
            eventType: 'SubscriptionCancelled',
            aggregateId: subscriptionId,
            aggregateType: 'subscription',
            payload: {
                subscriptionId,
                reason: cancelReason || 'user_cancelled',
            },
            metadata: {
                tenantId,
                source: 'ChefClubApplicationService',
            },
        }));
    }

    return {
        receivableCancelled: Boolean(raw.receivable_cancelled ?? true),
        subscriptionCancelled,
        subscriptionId,
        receivablesCancelled: Number(raw.receivables_cancelled ?? 1),
    };
};
