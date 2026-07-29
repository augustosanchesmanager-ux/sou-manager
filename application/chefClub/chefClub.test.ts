/**
 * [TEST][APPLICATION][CHEF_CLUB] ChefClubApplicationService
 *
 * Behavioral tests for the ChefClub application layer:
 * - credits.ts: resolveSubscription (4-phase pipeline), getAvailableCredits, hasAvailableCredits, deductCredits, deductCreditsBatch
 * - subscriptions.ts: createSubscription, updateSubscriptionStatus, changePlan, updateBillingDate, updateCreditMap
 * - receivables.ts: generateReceivables, payReceivable, settleReceivableWithDetails, refreshReceivableStatuses, getDisplayStatus, canPayReceivable, filterReceivables, computeReceivableTotals
 * - operations.ts: activatePlan, settleReceivable, pauseSubscription, resumeSubscription, cancelSubscription
 * - loaders.ts: loadActivePlans, loadSubscriptionDetail, resolveMembershipContext, computePlanSummary
 *
 * Convention: should_<result>_when_<condition>
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ─── Mock getScopedClient + getSharedClient ──────────────────────

const mockScopedClient = vi.hoisted(() => vi.fn());
const mockSharedClient = vi.hoisted(() => vi.fn());

const mockReceivableList = vi.hoisted(() => vi.fn().mockResolvedValue([]));

const dynamicClient = vi.hoisted(() => ({
    from: (table: string) => {
        const client = mockScopedClient();
        return client?.from?.(table);
    },
    rpc: (fn: string, params?: Record<string, unknown>) => {
        const client = mockScopedClient();
        return client?.rpc?.(fn, params);
    },
}));

vi.mock('../../services/supabaseClient', () => ({
    getScopedClient: (...args: unknown[]) => mockScopedClient(...args),
    getSharedClient: (...args: unknown[]) => mockSharedClient(...args),
    getClientForTable: () => dynamicClient,
}));

vi.mock('../../domain/receivable/repository', () => ({
    receivableRepository: {
        list: (...args: unknown[]) => mockReceivableList(...args),
    },
}));

// ─── Helpers ─────────────────────────────────────────────────────

type ChainResult = { data: unknown; error: unknown };

const makeChainable = (finalResult: ChainResult = { data: null, error: null }) => {
    const chain: Record<string, Mock> = {};

    const builderMethods = [
        'select', 'eq', 'neq', 'in', 'not', 'order', 'limit',
        'lte', 'gte',
    ];

    const terminalMethods = ['maybeSingle', 'single'];
    const mutatorMethods = ['insert', 'update', 'delete'];

    for (const m of builderMethods) {
        chain[m] = vi.fn().mockReturnValue(chain);
    }

    for (const m of terminalMethods) {
        chain[m] = vi.fn().mockResolvedValue(finalResult);
    }

    for (const m of mutatorMethods) {
        chain[m] = vi.fn().mockReturnValue(chain);
    }

    // Make the chain thenable — also a mock so tests can override the resolved value
    chain.then = vi.fn().mockImplementation((resolve: (v: ChainResult) => void) => {
        resolve(finalResult);
    });

    return chain;
};

const makeClient = (finalResult: ChainResult = { data: null, error: null }) => ({
    rpc: vi.fn().mockResolvedValue(finalResult),
    from: vi.fn().mockImplementation(() => makeChainable(finalResult)),
});

const buildSub = (overrides: Record<string, unknown> = {}) => ({
    id: 'sub-1',
    client_id: 'client-1',
    plan_id: 'plan-1',
    status: 'active',
    started_at: '2026-01-01T00:00:00Z',
    cycle_start: '2026-07-01T00:00:00Z',
    cycle_end: '2026-08-01T00:00:00Z',
    next_billing_date: '2026-08-01T00:00:00Z',
    canceled_at: null,
    created_at: '2026-01-01T00:00:00Z',
    service_balance_map: null,
    plan_id_plan_id: undefined,
    ...overrides,
});

const buildPlan = (overrides: Record<string, unknown> = {}) => ({
    id: 'plan-1',
    name: 'Plano Básico',
    monthly_price: 99.90,
    service_credits: null,
    service_credit_map: [{ service_id: 'svc-1', service_name: 'Corte', credits: 4 }],
    description: 'Plano mensal',
    priority_booking: false,
    product_discount: 0,
    active: true,
    ...overrides,
});

const buildCredit = (overrides: Record<string, unknown> = {}) => ({
    id: 'credit-1',
    subscription_id: 'sub-1',
    client_id: 'client-1',
    available_credits: 8,
    used_credits: 2,
    service_balance_map: [
        { service_id: 'svc-1', service_name: 'Corte', available: 3, used: 1 },
        { service_id: 'svc-2', service_name: 'Barba', available: 5, used: 1 },
    ],
    period_start: '2026-07-01T00:00:00Z',
    period_end: '2026-12-31T23:59:59Z',
    ...overrides,
});

const buildReceivable = (overrides: Record<string, unknown> = {}) => ({
    id: 'rec-1',
    tenant_id: 'tenant-1',
    customer_id: 'client-1',
    subscription_id: 'sub-1',
    plan_id: 'plan-1',
    billing_cycle_start: '2026-07-01T00:00:00Z',
    billing_cycle_end: '2026-07-31T23:59:59Z',
    due_date: '2026-07-05T00:00:00Z',
    amount: 99.90,
    status: 'paid',
    payment_method: 'pix',
    paid_at: '2026-07-02T10:00:00Z',
    transaction_id: 'txn-1',
    notes: null,
    created_at: '2026-07-01T00:00:00Z',
    ...overrides,
});

// ─── Import after mocks ─────────────────────────────────────────

import {
    resolveSubscription,
    getAvailableCredits,
    hasAvailableCredits,
    deductCredits,
    deductCreditsBatch,
} from './credits';
import {
    createSubscription,
    updateSubscriptionStatus,
    changePlan,
    updateBillingDate,
    updateCreditMap,
} from './subscriptions';
import {
    generateReceivables,
    payReceivable,
    settleReceivableWithDetails,
    refreshReceivableStatuses,
    getDisplayStatus,
    canPayReceivable,
    filterReceivables,
    computeReceivableTotals,
    type ReceivableRecord,
} from './receivables';
import {
    activatePlan,
    settleReceivable,
    pauseSubscription,
    resumeSubscription,
    cancelSubscription,
} from './operations';
import {
    loadActivePlans,
    loadSubscriptionDetail,
    resolveMembershipContext,
    computePlanSummary,
    type ServiceOption,
} from './loaders';
import { ChefClubError } from './types';

// ─── Tests ───────────────────────────────────────────────────────

describe('ChefClubApplicationService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP A — Validation & Error Handling
    // ════════════════════════════════════════════════════════════════

    describe('Grupo A — Validation', () => {
        it('should_return_null_when_subscription_not_found', async () => {
            const chain = makeChainable({ data: null, error: null });
            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const result = await resolveSubscription('tenant-1', 'client-999');
            expect(result).toBeNull();
        });

        it('should_return_null_when_cycle_expired', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({
                data: buildSub({ cycle_end: '2025-01-01T00:00:00Z', next_billing_date: '2025-01-01T00:00:00Z' }),
                error: null,
            });
            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const result = await resolveSubscription('tenant-1', 'client-1');
            expect(result).toBeNull();
        });

        it('should_return_null_when_no_paid_receivable', async () => {
            // Phase 1 (subscription found), Phase 2 (cycle valid), Phase 3 (no paid receivable)
            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle
                .mockReturnValueOnce({
                    data: buildSub({ cycle_end: new Date(Date.now() + 86400000 * 30).toISOString() }),
                    error: null,
                })
                .mockReturnValueOnce({ data: null, error: null }); // receivable query

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(subChain) });

            const result = await resolveSubscription('tenant-1', 'client-1');
            expect(result).toBeNull();
        });

        it('should_throw_ChefClubError_when_rpc_fails', async () => {
            mockScopedClient.mockReturnValue({
                rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC failed' } }),
                from: vi.fn().mockReturnValue(makeChainable({ data: null, error: null })),
            });

            await expect(deductCredits({
                tenantId: 'tenant-1',
                subscriptionId: 'sub-1',
                serviceId: 'svc-1',
                amount: 1,
                reference: 'test',
            })).rejects.toThrow(ChefClubError);
        });

        it('should_have_correct_error_code_when_rpc_fails', async () => {
            mockScopedClient.mockReturnValue({
                rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC failed' } }),
                from: vi.fn().mockReturnValue(makeChainable({ data: null, error: null })),
            });

            try {
                await deductCredits({
                    tenantId: 'tenant-1',
                    subscriptionId: 'sub-1',
                    serviceId: 'svc-1',
                    amount: 1,
                    reference: 'test',
                });
                expect.fail('should have thrown');
            } catch (e) {
                expect(e).toBeInstanceOf(ChefClubError);
                expect((e as ChefClubError).code).toBe('DEDUCTION_ERROR');
            }
        });
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP B — Credits (resolveSubscription pipeline)
    // ════════════════════════════════════════════════════════════════

    describe('Grupo B — Credits', () => {
        it('should_resolve_full_subscription_when_all_phases_pass', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: buildSub({ cycle_end: futureDate, next_billing_date: futureDate }),
                error: null,
            });

            const creditsChain = makeChainable({ data: null, error: null });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(creditsChain),
            });

            mockReceivableList.mockResolvedValueOnce([buildReceivable()]);

            const result = await resolveSubscription('tenant-1', 'client-1');

            expect(result).not.toBeNull();
            expect(result!.id).toBe('sub-1');
            expect(result!.client_id).toBe('client-1');
            expect(result!.plan_id).toBe('plan-1');
            expect(result!.status).toBe('active');
        });

        it('should_normalize_service_balance_map_on_resolve', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: buildSub({
                    cycle_end: futureDate,
                    service_balance_map: [
                        { service_id: 'svc-1', service_name: 'Corte', available: 3, used: 1 },
                    ],
                }),
                error: null,
            });

            const creditsChain = makeChainable({ data: null, error: null });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(creditsChain),
            });

            mockReceivableList.mockResolvedValueOnce([buildReceivable()]);

            const result = await resolveSubscription('tenant-1', 'client-1');

            expect(result!.service_balance_map).toHaveLength(1);
            expect(result!.service_balance_map[0].available).toBe(3);
            expect(result!.totalAvailableCredits).toBe(3);
        });

        it('should_fallback_to_credits_table_when_service_balance_map_null', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: buildSub({ cycle_end: futureDate, service_balance_map: null }),
                error: null,
            });

            const creditsChain = makeChainable({
                data: [{ service_id: 'svc-1', service_name: 'Barba', available: 2, used: 0 }],
                error: null,
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(creditsChain),
            });

            mockReceivableList.mockResolvedValueOnce([buildReceivable()]);

            const result = await resolveSubscription('tenant-1', 'client-1');

            expect(result!.service_balance_map).toHaveLength(1);
            expect(result!.service_balance_map[0].service_name).toBe('Barba');
            expect(result!.totalAvailableCredits).toBe(2);
        });

        it('should_return_available_credits_for_specific_service', () => {
            const balances = [
                { service_id: 'svc-1', service_name: 'Corte', available: 3, used: 1 },
                { service_id: 'svc-2', service_name: 'Barba', available: 5, used: 0 },
            ];
            expect(getAvailableCredits(balances, 'svc-1')).toBe(3);
            expect(getAvailableCredits(balances, 'svc-2')).toBe(5);
            expect(getAvailableCredits(balances, 'svc-999')).toBe(0);
        });

        it('should_fallback_to_generic_credit_when_service_not_found', () => {
            const balances = [
                { service_id: '', service_name: 'Credito geral', available: 10, used: 2 },
            ];
            expect(getAvailableCredits(balances, 'svc-1')).toBe(10);
        });

        it('should_has_available_credits_return_true_when_any_positive', () => {
            expect(hasAvailableCredits([
                { service_id: 'svc-1', service_name: 'A', available: 0, used: 0 },
                { service_id: 'svc-2', service_name: 'B', available: 5, used: 0 },
            ])).toBe(true);
        });

        it('should_has_available_credits_return_false_when_all_zero', () => {
            expect(hasAvailableCredits([
                { service_id: 'svc-1', service_name: 'A', available: 0, used: 0 },
            ])).toBe(false);
        });

        it('should_deduct_credits_successfully_when_rpc_ok', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            await expect(deductCredits({
                tenantId: 'tenant-1',
                subscriptionId: 'sub-1',
                serviceId: 'svc-1',
                amount: 2,
                reference: 'checkout-123',
            })).resolves.toBeUndefined();

            expect(mockScopedClient).toHaveBeenCalled();
        });

        it('should_deduct_credits_batch_return_success_count', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            const result = await deductCreditsBatch([
                { tenantId: 't1', subscriptionId: 's1', serviceId: 'svc-1', amount: 1, reference: 'r1' },
                { tenantId: 't1', subscriptionId: 's1', serviceId: 'svc-2', amount: 2, reference: 'r2' },
            ]);

            expect(result.success).toBe(2);
            expect(result.failed).toBe(0);
        });

        it('should_deduct_credits_batch_count_failures', async () => {
            let callCount = 0;
            mockScopedClient.mockReturnValue({
                rpc: vi.fn().mockImplementation(async () => {
                    callCount++;
                    if (callCount === 2) {
                        return { data: null, error: { message: 'deduction failed' } };
                    }
                    return { data: null, error: null };
                }),
            });

            const result = await deductCreditsBatch([
                { tenantId: 't1', subscriptionId: 's1', serviceId: 'svc-1', amount: 1, reference: 'r1' },
                { tenantId: 't1', subscriptionId: 's1', serviceId: 'svc-2', amount: 1, reference: 'r2' },
            ]);

            expect(result.success).toBe(1);
            expect(result.failed).toBe(1);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP C — Subscriptions
    // ════════════════════════════════════════════════════════════════

    describe('Grupo C — Subscriptions', () => {
        it('should_create_subscription_and_return_id', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: 'new-sub-id', error: null }));

            const id = await createSubscription({
                tenantId: 'tenant-1',
                clientId: 'client-1',
                planId: 'plan-1',
                billingDay: 1,
            });

            expect(id).toBe('new-sub-id');
        });

        it('should_throw_when_create_subscription_rpc_fails', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: { message: 'rpc error' } }));

            await expect(createSubscription({
                tenantId: 'tenant-1',
                clientId: 'client-1',
                planId: 'plan-1',
                billingDay: 1,
            })).rejects.toThrow(ChefClubError);
        });

        it('should_update_status_to_canceled_and_set_canceled_at', async () => {
            const fetchChain = makeChainable({ data: null, error: null });
            fetchChain.maybeSingle.mockResolvedValue({
                data: { status: 'active' },
                error: null,
            });

            let updatePayload: Record<string, unknown> = {};
            const updateChain = makeChainable({ data: null, error: null });
            const originalUpdate = updateChain.update;
            updateChain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
                updatePayload = payload;
                return updateChain;
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(fetchChain)
                    .mockReturnValueOnce(updateChain),
            });

            await updateSubscriptionStatus('tenant-1', 'sub-1', 'canceled');

            expect(updatePayload.status).toBe('canceled');
            expect(updatePayload.canceled_at).toBeDefined();
        });

        it('should_throw_NOT_FOUND_when_subscription_missing', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({ data: null, error: null });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            await expect(updateSubscriptionStatus('tenant-1', 'sub-999', 'paused')).rejects.toThrow('Assinatura não encontrada');
        });

        it('should_throw_INVALID_TRANSITION_when_invalid_status_change', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({
                data: { status: 'canceled' },
                error: null,
            });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            await expect(updateSubscriptionStatus('tenant-1', 'sub-1', 'active')).rejects.toThrow(ChefClubError);
        });

        it('should_change_plan_successfully', async () => {
            let capturedPayload: Record<string, unknown> = {};
            const chain = makeChainable({ data: null, error: null });
            chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
                capturedPayload = payload;
                return chain;
            });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            await expect(changePlan('tenant-1', 'sub-1', 'plan-2')).resolves.toBeUndefined();
            expect(capturedPayload).toEqual({ plan_id: 'plan-2' });
        });

        it('should_update_billing_date_and_compute_cycle_end', async () => {
            let capturedPayload: Record<string, unknown> = {};
            const chain = makeChainable({ data: null, error: null });
            chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
                capturedPayload = payload;
                return chain;
            });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            await updateBillingDate('tenant-1', 'sub-1', '2026-08-01');

            expect(capturedPayload.next_billing_date).toBe('2026-08-01');
            expect(capturedPayload.cycle_end).toBeDefined();
            const cycleEnd = new Date(capturedPayload.cycle_end as string);
            const billing = new Date('2026-08-01');
            const diffDays = Math.round((cycleEnd.getTime() - billing.getTime()) / 86400000);
            expect(diffDays).toBe(30);
        });

        it('should_update_credit_map_and_compute_totals', async () => {
            let capturedPayload: Record<string, unknown> = {};
            const chain = makeChainable({ data: null, error: null });
            chain.update = vi.fn().mockImplementation((payload: Record<string, unknown>) => {
                capturedPayload = payload;
                return chain;
            });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const balanceMap = [
                { service_id: 'svc-1', service_name: 'Corte', available: 3, used: 1 },
                { service_id: 'svc-2', service_name: 'Barba', available: 5, used: 0 },
            ];

            await updateCreditMap('tenant-1', 'sub-1', balanceMap);

            expect(capturedPayload.service_balance_map).toEqual(balanceMap);
            expect(capturedPayload.available_credits).toBe(8);
            expect(capturedPayload.used_credits).toBe(1);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP D — Receivables
    // ════════════════════════════════════════════════════════════════

    describe('Grupo D — Receivables', () => {
        it('should_generate_receivables_successfully', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            await expect(generateReceivables('tenant-1')).resolves.toBeUndefined();
        });

        it('should_throw_when_generate_receivables_rpc_fails', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: { message: 'rpc error' } }));

            await expect(generateReceivables('tenant-1')).rejects.toThrow(ChefClubError);
        });

        it('should_pay_receivable_successfully', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            await expect(payReceivable({
                tenantId: 'tenant-1',
                receivableId: 'rec-1',
                paymentMethod: 'pix',
            })).resolves.toBeUndefined();
        });

        it('should_settle_receivable_with_custom_details', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            await expect(settleReceivableWithDetails({
                receivableId: 'rec-1',
                paymentMethod: 'credit_card',
                paidAt: '2026-07-15',
                notes: 'Pago com cartão de crédito',
            })).resolves.toBeUndefined();
        });

        it('should_refresh_receivable_statuses_successfully', async () => {
            mockScopedClient.mockReturnValue(makeClient({ data: null, error: null }));

            await expect(refreshReceivableStatuses('tenant-1')).resolves.toBeUndefined();
        });

        it('should_getDisplayStatus_return_overdue_when_pending_and_past_due', () => {
            const receivable = buildReceivable({
                status: 'pending',
                due_date: '2025-01-01T00:00:00Z', // past
            }) as unknown as ReceivableRecord;

            expect(getDisplayStatus(receivable)).toBe('overdue');
        });

        it('should_getDisplayStatus_return_original_status_when_not_pending', () => {
            const receivable = buildReceivable({
                status: 'paid',
                due_date: '2025-01-01T00:00:00Z',
            }) as unknown as ReceivableRecord;

            expect(getDisplayStatus(receivable)).toBe('paid');
        });

        it('should_getDisplayStatus_return_pending_when_future_due_date', () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
            const receivable = buildReceivable({
                status: 'pending',
                due_date: futureDate,
            }) as unknown as ReceivableRecord;

            expect(getDisplayStatus(receivable)).toBe('pending');
        });

        it('should_canPayReceivable_return_true_when_pending', () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
            const receivable = buildReceivable({
                status: 'pending',
                due_date: futureDate,
            }) as unknown as ReceivableRecord;

            expect(canPayReceivable(receivable)).toBe(true);
        });

        it('should_canPayReceivable_return_false_when_paid', () => {
            const receivable = buildReceivable({ status: 'paid' }) as unknown as ReceivableRecord;
            expect(canPayReceivable(receivable)).toBe(false);
        });

        it('should_canPayReceivable_return_true_when_overdue', () => {
            const receivable = buildReceivable({
                status: 'pending',
                due_date: '2025-01-01T00:00:00Z',
            }) as unknown as ReceivableRecord;

            expect(canPayReceivable(receivable)).toBe(true);
        });

        it('should_filter_receivables_by_client_name', () => {
            const receivables = [
                buildReceivable({ id: 'r1', customer_id: 'c1' }),
                buildReceivable({ id: 'r2', customer_id: 'c2' }),
            ] as unknown as ReceivableRecord[];

            const clients = {
                c1: { id: 'c1', name: 'João Silva', phone: '1199999' },
                c2: { id: 'c2', name: 'Maria Santos', phone: '1188888' },
            };
            const plans = {};

            const result = filterReceivables(receivables, clients, plans, 'João');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('r1');
        });

        it('should_filter_receivables_by_plan_name', () => {
            const receivables = [
                buildReceivable({ id: 'r1', plan_id: 'p1' }),
                buildReceivable({ id: 'r2', plan_id: 'p2' }),
            ] as unknown as ReceivableRecord[];

            const clients = {};
            const plans = {
                p1: { id: 'p1', name: 'Plano Gold', monthly_price: 199 },
                p2: { id: 'p2', name: 'Plano Basic', monthly_price: 99 },
            };

            const result = filterReceivables(receivables, clients, plans, 'Gold');
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('r1');
        });

        it('should_return_all_receivables_when_search_empty', () => {
            const receivables = [
                buildReceivable({ id: 'r1' }),
                buildReceivable({ id: 'r2' }),
            ] as unknown as ReceivableRecord[];

            expect(filterReceivables(receivables, {}, {}, '')).toHaveLength(2);
            expect(filterReceivables(receivables, {}, {}, '  ')).toHaveLength(2);
        });

        it('should_compute_receivable_totals_correctly', () => {
            const receivables = [
                buildReceivable({ id: 'r1', amount: 100, status: 'paid' }),
                buildReceivable({ id: 'r2', amount: 200, status: 'pending', due_date: new Date(Date.now() + 86400000 * 10).toISOString() }),
                buildReceivable({ id: 'r3', amount: 150, status: 'pending', due_date: '2025-01-01T00:00:00Z' }), // overdue
            ] as unknown as ReceivableRecord[];

            const totals = computeReceivableTotals(receivables);

            expect(totals.total).toBe(450);
            expect(totals.paid).toBe(100);
            expect(totals.pending).toBe(200);
            expect(totals.overdue).toBe(150);
            expect(totals.count).toBe(3);
        });

        it('should_compute_receivable_totals_return_zeros_for_empty', () => {
            const totals = computeReceivableTotals([]);
            expect(totals.total).toBe(0);
            expect(totals.count).toBe(0);
            expect(totals.paid).toBe(0);
            expect(totals.pending).toBe(0);
            expect(totals.overdue).toBe(0);
        });
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP E — Operations (orchestration)
    // ════════════════════════════════════════════════════════════════

    describe('Grupo E — Operations', () => {
        it('should_activate_plan_create_subscription_and_generate_receivables', async () => {
            let rpcCallCount = 0;
            mockScopedClient.mockReturnValue({
                rpc: vi.fn().mockImplementation(async (fnName: string) => {
                    rpcCallCount++;
                    if (fnName === 'create_chef_club_subscription') {
                        return { data: 'new-sub-id', error: null };
                    }
                    if (fnName === 'generate_club_receivables') {
                        return { data: null, error: null };
                    }
                    return { data: null, error: null };
                }),
                from: vi.fn().mockReturnValue(makeChainable({ data: null, error: null })),
            });

            const id = await activatePlan({
                tenantId: 'tenant-1',
                clientId: 'client-1',
                planId: 'plan-1',
                billingDay: 1,
            });

            expect(id).toBe('new-sub-id');
            expect(rpcCallCount).toBeGreaterThanOrEqual(2);
        });

        it('should_settle_receivable_pay_and_generate', async () => {
            let rpcCallCount = 0;
            mockScopedClient.mockReturnValue({
                rpc: vi.fn().mockImplementation(async (fnName: string) => {
                    rpcCallCount++;
                    return { data: null, error: null };
                }),
                from: vi.fn().mockReturnValue(makeChainable({ data: null, error: null })),
            });

            await expect(settleReceivable({
                tenantId: 'tenant-1',
                receivableId: 'rec-1',
                paymentMethod: 'pix',
            })).resolves.toBeUndefined();

            expect(rpcCallCount).toBeGreaterThanOrEqual(2);
        });

        it('should_pause_subscription_call_update_status', async () => {
            const fetchChain = makeChainable({ data: null, error: null });
            fetchChain.maybeSingle.mockResolvedValue({ data: { status: 'active' }, error: null });

            let capturedPayload: Record<string, unknown> = {};
            const updateChain = makeChainable({ data: null, error: null });
            updateChain.update = vi.fn().mockImplementation((p: Record<string, unknown>) => {
                capturedPayload = p;
                return updateChain;
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(fetchChain)
                    .mockReturnValueOnce(updateChain),
            });

            await pauseSubscription('tenant-1', 'sub-1');

            expect(capturedPayload.status).toBe('paused');
        });

        it('should_resume_subscription_call_update_status', async () => {
            const fetchChain = makeChainable({ data: null, error: null });
            fetchChain.maybeSingle.mockResolvedValue({ data: { status: 'paused' }, error: null });

            let capturedPayload: Record<string, unknown> = {};
            const updateChain = makeChainable({ data: null, error: null });
            updateChain.update = vi.fn().mockImplementation((p: Record<string, unknown>) => {
                capturedPayload = p;
                return updateChain;
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(fetchChain)
                    .mockReturnValueOnce(updateChain),
            });

            await resumeSubscription('tenant-1', 'sub-1');

            expect(capturedPayload.status).toBe('active');
        });

        it('should_cancel_subscription_call_update_status', async () => {
            const fetchChain = makeChainable({ data: null, error: null });
            fetchChain.maybeSingle.mockResolvedValue({ data: { status: 'active' }, error: null });

            let capturedPayload: Record<string, unknown> = {};
            const updateChain = makeChainable({ data: null, error: null });
            updateChain.update = vi.fn().mockImplementation((p: Record<string, unknown>) => {
                capturedPayload = p;
                return updateChain;
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(fetchChain)
                    .mockReturnValueOnce(updateChain),
            });

            await cancelSubscription('tenant-1', 'sub-1');

            expect(capturedPayload.status).toBe('canceled');
        });
    });

    // ════════════════════════════════════════════════════════════════
    // GROUP F — Loaders
    // ════════════════════════════════════════════════════════════════

    describe('Grupo F — Loaders', () => {
        it('should_load_active_plans_with_normalized_credits', async () => {
            mockScopedClient.mockReturnValue(makeClient({
                data: [
                    buildPlan({ id: 'p1', name: 'Gold', active: true }),
                    buildPlan({ id: 'p2', name: 'Basic', active: true }),
                ],
                error: null,
            }));

            const plans = await loadActivePlans('tenant-1');

            expect(plans).toHaveLength(2);
            expect(plans[0].name).toBe('Gold');
            expect(plans[0].service_credits).toHaveLength(1);
            expect(plans[0].service_credits[0].service_id).toBe('svc-1');
        });

        it('should_return_empty_when_load_active_plans_fails', async () => {
            const chain = makeChainable({ data: null, error: { message: 'db error' } });
            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            await expect(loadActivePlans('tenant-1')).rejects.toThrow();
        });

        it('should_load_subscription_detail_with_plan_and_credits', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: buildSub({ cycle_end: futureDate }),
                error: null,
            });

            const plansChain = makeChainable({
                data: [buildPlan()],
                error: null,
            });

            const creditsChain = makeChainable({ data: null, error: null });
            creditsChain.maybeSingle.mockResolvedValue({
                data: buildCredit(),
                error: null,
            });

            const clientChain = makeChainable({ data: null, error: null });
            clientChain.maybeSingle.mockResolvedValue({
                data: { id: 'client-1', name: 'João', phone: '1199999' },
                error: null,
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(plansChain)
                    .mockReturnValueOnce(creditsChain)
                    .mockReturnValueOnce(clientChain),
            });

            const detail = await loadSubscriptionDetail('tenant-1', 'sub-1');

            expect(detail).not.toBeNull();
            expect(detail!.subscription.id).toBe('sub-1');
            expect(detail!.plan).not.toBeNull();
            expect(detail!.plan!.name).toBe('Plano Básico');
            expect(detail!.client).not.toBeNull();
            expect(detail!.client!.name).toBe('João');
        });

        it('should_return_null_when_subscription_detail_not_found', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({ data: null, error: null });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const detail = await loadSubscriptionDetail('tenant-1', 'sub-999');
            expect(detail).toBeNull();
        });

        it('should_resolve_membership_context_when_active_and_paid', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
            const now = new Date().toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: {
                    id: 'sub-1', plan_id: 'plan-1',
                    cycle_start: now, cycle_end: futureDate,
                    next_billing_date: futureDate, created_at: now,
                },
                error: null,
            });

            const planChain = makeChainable({ data: null, error: null });
            planChain.maybeSingle.mockResolvedValue({
                data: { name: 'Plano Gold' },
                error: null,
            });

            const creditsChain = makeChainable({ data: null, error: null });
            creditsChain.maybeSingle.mockResolvedValue({
                data: {
                    available_credits: 8, used_credits: 2,
                    service_balance_map: [
                        { service_id: 'svc-1', service_name: 'Corte', available: 5, used: 1 },
                    ],
                    period_end: futureDate,
                },
                error: null,
            });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(planChain)
                    .mockReturnValueOnce(creditsChain),
            });

            mockReceivableList.mockResolvedValueOnce([buildReceivable()]);

            const ctx = await resolveMembershipContext('tenant-1', 'client-1');

            expect(ctx.hasMembership).toBe(true);
            expect(ctx.canUseCredits).toBe(true);
            expect(ctx.creditsRemaining).toBe(5);
            expect(ctx.planName).toBe('Plano Gold');
            expect(ctx.serviceBalances).toHaveLength(1);
        });

        it('should_resolve_membership_context_empty_when_no_subscription', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({ data: null, error: null });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const ctx = await resolveMembershipContext('tenant-1', 'client-999');

            expect(ctx.hasMembership).toBe(false);
            expect(ctx.canUseCredits).toBe(false);
            expect(ctx.creditsRemaining).toBe(0);
            expect(ctx.validationErrors).toEqual([]);
        });

        it('should_resolve_membership_context_error_when_cycle_expired', async () => {
            const chain = makeChainable({ data: null, error: null });
            chain.maybeSingle.mockReturnValue({
                data: {
                    id: 'sub-1', plan_id: 'plan-1',
                    cycle_start: null, cycle_end: '2025-01-01T00:00:00Z',
                    next_billing_date: '2025-01-01T00:00:00Z', created_at: null,
                },
                error: null,
            });

            mockScopedClient.mockReturnValue({ rpc: vi.fn(), from: vi.fn().mockReturnValue(chain) });

            const ctx = await resolveMembershipContext('tenant-1', 'client-1');

            expect(ctx.hasMembership).toBe(false);
            expect(ctx.validationErrors).toContain('Ciclo de cobrança expirado.');
        });

        it('should_resolve_membership_context_error_when_no_paid_receivable', async () => {
            const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();

            const subChain = makeChainable({ data: null, error: null });
            subChain.maybeSingle.mockResolvedValue({
                data: {
                    id: 'sub-1', plan_id: 'plan-1',
                    cycle_start: null, cycle_end: futureDate,
                    next_billing_date: futureDate, created_at: null,
                },
                error: null,
            });

            const recChain = makeChainable({ data: null, error: null });
            recChain.maybeSingle.mockResolvedValue({ data: null, error: null });

            mockScopedClient.mockReturnValue({
                rpc: vi.fn(),
                from: vi.fn()
                    .mockReturnValueOnce(subChain)
                    .mockReturnValueOnce(recChain),
            });

            const ctx = await resolveMembershipContext('tenant-1', 'client-1');

            expect(ctx.hasMembership).toBe(false);
            expect(ctx.validationErrors).toContain('Nenhum pagamento confirmado para o ciclo atual.');
        });

        it('should_compute_plan_summary_with_active_plans_only', () => {
            const plans = [
                { active: true, monthly_price: 99, service_credit_map: [{ service_id: 's1', credits: 4 }] },
                { active: false, monthly_price: 199, service_credit_map: [] },
                { active: true, monthly_price: 149, service_credit_map: [{ service_id: 's2', credits: 6 }] },
            ];

            const services: ServiceOption[] = [
                { id: 's1', name: 'Corte' },
                { id: 's2', name: 'Barba' },
                { id: 's3', name: 'Pigmentação' },
            ];

            const summary = computePlanSummary(plans, services);

            expect(summary.activePlans).toBe(2);
            expect(summary.potentialMonthlyRevenue).toBe(248); // 99 + 149
            expect(summary.plannedCredits).toBe(10); // 4 + 6
            expect(summary.serviceCatalog).toBe(3);
        });

        it('should_compute_plan_summary_return_zeros_for_empty', () => {
            const summary = computePlanSummary([], []);
            expect(summary.activePlans).toBe(0);
            expect(summary.potentialMonthlyRevenue).toBe(0);
            expect(summary.plannedCredits).toBe(0);
            expect(summary.serviceCatalog).toBe(0);
        });
    });
});
