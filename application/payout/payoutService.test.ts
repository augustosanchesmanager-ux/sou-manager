import { describe, it, expect, vi } from 'vitest';
import { PayoutService } from './payoutService';
import { roundCents } from '../../domain/payout/money';
import type {
    BarberPayoutSettlement,
    SettlementComputation,
    SettlementStatus,
    StaffProfile,
} from '../../domain/payout/types';

const makeSettlement = (
    status: SettlementStatus,
    overrides: Partial<BarberPayoutSettlement> = {},
): BarberPayoutSettlement => ({
    id: 'st1',
    tenantId: 't1',
    staffId: 'staff1',
    periodStart: '2026-09-29',
    periodEnd: '2026-10-05',
    grossCommission: 400,
    advancesDeducted: 350,
    bonusesAdded: 0,
    netPayout: 50,
    status,
    paidAt: null,
    paymentMethod: null,
    cancelReason: null,
    createdAt: '2026-10-06T10:00:00Z',
    ...overrides,
});

const EMPTY_COMPUTATION: SettlementComputation = {
    grossCommission: 0,
    advancesDeducted: 0,
    bonusesAdded: 0,
    netPayout: 0,
    paymentCount: 0,
    consumedAdvanceIds: [],
    remainingAdvanceIds: [],
};

const makeRepository = (over: Record<string, unknown> = {}) => ({
    listActiveProfessionals: vi.fn().mockResolvedValue([] as StaffProfile[]),
    listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([]),
    listPendingAdvances: vi.fn().mockResolvedValue([]),
    listAdvancesBySettlement: vi.fn().mockResolvedValue([]),
    getConfigByStaff: vi.fn().mockResolvedValue(null),
    upsertConfig: vi.fn(),
    getSettlementByPeriod: vi.fn().mockResolvedValue(null),
    getSettlementById: vi.fn().mockResolvedValue(null),
    createSettlementDraft: vi.fn(),
    updateSettlementStatus: vi.fn(),
    registerAdvance: vi.fn(),
    linkAdvanceToSettlement: vi.fn(),
    reverseAdvance: vi.fn(),
    cancelSettlement: vi.fn(),
    ...over,
});

describe('PayoutService.listEligibleProfessionals', () => {
    it('injects_resolved_rate_and_filters_out_zero_rate', async () => {
        const staff: StaffProfile[] = [
            { id: 'a', name: 'Ana', role: 'Barber', avatar: '', commissionRate: 0 },
            { id: 'b', name: 'Bia', role: 'Barber', avatar: '', commissionRate: 0 },
            { id: 'c', name: 'Cid', role: 'Manager', avatar: '', commissionRate: 0 },
        ];
        const service = new PayoutService(
            makeRepository({ listActiveProfessionals: vi.fn().mockResolvedValue(staff) }) as never,
        );

        // FIX-001: gestor com taxa > 0 e comissionado. A elegibilidade vem do
        // helper, nunca de um filtro por role dentro do repositorio.
        const resolveRate = (s: StaffProfile) => (s.role === 'Manager' ? 0.5 : 0);

        const result = await service.listEligibleProfessionals('t1', resolveRate);

        expect(result.map((r) => r.id)).toEqual(['c']);
        expect(result[0].commissionRate).toBe(0.5);
    });

    it('returns_empty_when_tenant_has_no_active_staff', async () => {
        const service = new PayoutService(makeRepository() as never);
        expect(await service.listEligibleProfessionals('t1', () => 0.4)).toEqual([]);
    });
});

describe('PayoutService.getSettlementForPeriod', () => {
    it('returns_null_when_no_settlement_persisted', async () => {
        const service = new PayoutService(makeRepository() as never);
        expect(
            await service.getSettlementForPeriod('t1', 'staff1', '2026-09-29', '2026-10-05'),
        ).toBeNull();
    });

    it('returns_persisted_settlement_when_present', async () => {
        const stored = makeSettlement('approved');
        const service = new PayoutService(
            makeRepository({ getSettlementByPeriod: vi.fn().mockResolvedValue(stored) }) as never,
        );
        const found = await service.getSettlementForPeriod(
            't1',
            'staff1',
            '2026-09-29',
            '2026-10-05',
        );
        expect(found?.status).toBe('approved');
    });
});

describe('PayoutService.computeSettlement (leitura pura)', () => {
    it('computes_gross_from_cash_basis_payments_only', async () => {
        const service = new PayoutService(
            makeRepository({
                listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([
                    { comanda_id: 'c1', staff_id: 'staff1', amount: 100, created_at: '2026-10-01T12:00:00Z' },
                    { comanda_id: 'c2', staff_id: 'staff1', amount: 100, created_at: '2026-10-03T12:00:00Z' },
                ]),
            }) as never,
        );

        const result = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
        });

        expect(result.grossCommission).toBe(100);
        expect(result.paymentCount).toBe(2);
    });

    it('computes_gross_using_ledger_commission_value_when_available', async () => {
        const service = new PayoutService(
            makeRepository({
                listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([
                    // Ledger reconciled rows already have exact commission_value
                    { comanda_id: 'c1', staff_id: 'staff1', amount: 100, commission_value: 35, created_at: '2026-10-01T12:00:00Z' },
                    { comanda_id: 'c2', staff_id: 'staff1', amount: 100, commission_value: 45, created_at: '2026-10-03T12:00:00Z' },
                ]),
            }) as never,
        );

        const result = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5, // Even though rate is 50%, ledger value (35 + 45 = 80) takes precedence
        });

        expect(result.grossCommission).toBe(80);
        expect(result.paymentCount).toBe(2);
    });

    it('supports_multiple_items_for_same_staff_in_comanda_C2', async () => {
        const service = new PayoutService(
            makeRepository({
                listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([
                    // Two items in the same comanda c1
                    { comanda_id: 'c1', comanda_item_id: 'i1', staff_id: 'staff1', amount: 60, commission_value: 30, created_at: '2026-10-01T12:00:00Z' },
                    { comanda_id: 'c1', comanda_item_id: 'i2', staff_id: 'staff1', amount: 40, commission_value: 20, created_at: '2026-10-01T12:00:00Z' },
                ]),
            }) as never,
        );

        const result = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
        });

        expect(result.grossCommission).toBe(50);
        expect(result.paymentCount).toBe(2);
    });

    it('returns_zeroed_computation_when_no_payments_in_period', async () => {
        const service = new PayoutService(makeRepository() as never);
        const result = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
        });
        expect(result).toEqual(EMPTY_COMPUTATION);
    });

    it('never_persists_when_computing', async () => {
        // computeSettlement e leitura pura: a UI chama ao selecionar o
        // periodo, e criar draft ali violaria uq_barber_payout_period.
        const repo = makeRepository();
        const service = new PayoutService(repo as never);
        await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
        });
        expect(repo.createSettlementDraft).not.toHaveBeenCalled();
    });

    it('applies_fifo_cutoff_on_advances', async () => {
        const service = new PayoutService(
            makeRepository({
                listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([
                    { comanda_id: 'c1', staff_id: 'staff1', amount: 400, created_at: '2026-10-01T12:00:00Z' },
                ]),
                listPendingAdvances: vi.fn().mockResolvedValue([
                    {
                        id: 'adv1', tenantId: 't1', staffId: 'staff1', amount: 100,
                        transactionId: null, settlementId: null, reversedAt: null,
                        reversalMotivo: null, issuedAt: '2026-10-01T09:00:00Z', notes: null,
                        createdBy: 'u1', createdAt: '2026-10-01T09:00:00Z',
                    },
                ]),
            }) as never,
        );

        const result = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
        });

        // 50% de 400 = 200 de comissao, e o vale de 100 abate integral.
        expect(result.grossCommission).toBe(200);
        expect(result.advancesDeducted).toBe(100);
        expect(result.netPayout).toBe(100);
        expect(result.consumedAdvanceIds).toEqual(['adv1']);
    });
});

describe('PayoutService.registerAdvance', () => {
    it('rounds_amount_before_persisting', async () => {
        const repo = makeRepository({ registerAdvance: vi.fn().mockResolvedValue({}) });
        const service = new PayoutService(repo as never);

        await service.registerAdvance({ tenantId: 't1', staffId: 'staff1', amount: 10.005 });

        expect(repo.registerAdvance).toHaveBeenCalledWith(
            expect.objectContaining({ amount: roundCents(10.005) }),
        );
    });

    it('should_reject_when_amount_is_zero_or_negative', async () => {
        const repo = makeRepository();
        const service = new PayoutService(repo as never);

        await expect(
            service.registerAdvance({ tenantId: 't1', staffId: 'staff1', amount: 0 }),
        ).rejects.toThrow(/maior que zero/i);
        expect(repo.registerAdvance).not.toHaveBeenCalled();
    });

    it('should_reject_when_staff_config_disallows_advances', async () => {
        const repo = makeRepository({
            getConfigByStaff: vi.fn().mockResolvedValue({
                id: 'cfg1',
                tenantId: 't1',
                staffId: 'staff1',
                frequency: 'weekly',
                payoutWeekday: 2,
                payoutMonthDay: null,
                allowAdvances: false,
                createdAt: '2026-10-01T00:00:00Z',
                updatedAt: '2026-10-01T00:00:00Z',
            }),
        });
        const service = new PayoutService(repo as never);

        await expect(
            service.registerAdvance({ tenantId: 't1', staffId: 'staff1', amount: 50 }),
        ).rejects.toThrow(/nao esta habilitado para receber vales/i);
        expect(repo.registerAdvance).not.toHaveBeenCalled();
    });
});

describe('PayoutService.reverseAdvance', () => {
    it('rejects_blank_reason', async () => {
        const repo = makeRepository();
        const service = new PayoutService(repo as never);
        await expect(service.reverseAdvance('t1', 'adv1', '   ')).rejects.toThrow(
            /Motivo obrigatorio/i,
        );
        expect(repo.reverseAdvance).not.toHaveBeenCalled();
    });
});

describe('PayoutService.computeSettlement & generateDraft with bonusesAdded', () => {
    it('should_expand_fifo_advance_deduction_margin_when_bonuses_added_is_positive', async () => {
        const service = new PayoutService(
            makeRepository({
                listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([
                    { comanda_id: 'c1', staff_id: 'staff1', amount: 200, commission_value: 100, created_at: '2026-10-01T12:00:00Z' },
                ]),
                listPendingAdvances: vi.fn().mockResolvedValue([
                    {
                        id: 'adv1',
                        tenantId: 't1',
                        staffId: 'staff1',
                        amount: 150,
                        transactionId: null,
                        settlementId: null,
                        reversedAt: null,
                        reversalMotivo: null,
                        issuedAt: '2026-10-01T09:00:00Z',
                        notes: null,
                        createdBy: 'u1',
                        createdAt: '2026-10-01T09:00:00Z',
                    },
                ]),
            }) as never,
        );

        // Sem bonus, o vale de 150 nao cabe na comissao de 100
        const withoutBonus = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
            bonusesAdded: 0,
        });
        expect(withoutBonus.advancesDeducted).toBe(0);
        expect(withoutBonus.remainingAdvanceIds).toEqual(['adv1']);

        // Com bonus de 60, a margem passa a 160 (100 + 60), absorvendo o vale de 150
        const withBonus = await service.computeSettlement({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
            bonusesAdded: 60,
        });
        expect(withBonus.grossCommission).toBe(100);
        expect(withBonus.bonusesAdded).toBe(60);
        expect(withBonus.advancesDeducted).toBe(150);
        expect(withBonus.netPayout).toBe(10);
        expect(withBonus.consumedAdvanceIds).toEqual(['adv1']);
        expect(withBonus.remainingAdvanceIds).toEqual([]);
    });

    it('should_allow_generate_draft_when_gross_is_zero_but_bonuses_added_is_positive', async () => {
        const draftSettlement = makeSettlement('draft', {
            grossCommission: 0,
            advancesDeducted: 50,
            bonusesAdded: 120,
            netPayout: 70,
        });
        const repo = makeRepository({
            listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([]),
            listPendingAdvances: vi.fn().mockResolvedValue([
                {
                    id: 'adv1',
                    tenantId: 't1',
                    staffId: 'staff1',
                    amount: 50,
                    transactionId: null,
                    settlementId: null,
                    reversedAt: null,
                    reversalMotivo: null,
                    issuedAt: '2026-10-01T09:00:00Z',
                    notes: null,
                    createdBy: 'u1',
                    createdAt: '2026-10-01T09:00:00Z',
                },
            ]),
            createSettlementDraft: vi.fn().mockResolvedValue(draftSettlement),
            linkAdvanceToSettlement: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
        });
        const service = new PayoutService(repo as never);

        const result = await service.generateDraft({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            commissionRate: 0.5,
            bonusesAdded: 120,
        });

        expect(repo.createSettlementDraft).toHaveBeenCalledWith({
            tenantId: 't1',
            staffId: 'staff1',
            periodStart: '2026-09-29',
            periodEnd: '2026-10-05',
            grossCommission: 0,
            advancesDeducted: 50,
            bonusesAdded: 120,
        });
        expect(repo.linkAdvanceToSettlement).toHaveBeenCalledWith('t1', 'adv1', 'st1');
        expect(result.computation.netPayout).toBe(70);
    });

    it('should_reject_generate_draft_when_both_gross_and_bonuses_are_zero', async () => {
        const repo = makeRepository({
            listSettledPaymentsInPeriod: vi.fn().mockResolvedValue([]),
        });
        const service = new PayoutService(repo as never);

        await expect(
            service.generateDraft({
                tenantId: 't1',
                staffId: 'staff1',
                periodStart: '2026-09-29',
                periodEnd: '2026-10-05',
                commissionRate: 0.5,
                bonusesAdded: 0,
            }),
        ).rejects.toThrow(/comissao bruta e bonus zerados/i);
        expect(repo.createSettlementDraft).not.toHaveBeenCalled();
    });
});

describe('PayoutService config & settlement advances delegation', () => {
    it('should_delegate_getConfigByStaff_and_upsertConfig_to_repository', async () => {
        const mockConfig = {
            id: 'cfg1',
            tenantId: 't1',
            staffId: 'staff1',
            frequency: 'weekly' as const,
            payoutWeekday: 2,
            payoutMonthDay: null,
            allowAdvances: true,
            createdAt: '2026-10-01T00:00:00Z',
            updatedAt: '2026-10-01T00:00:00Z',
        };
        const repo = makeRepository({
            getConfigByStaff: vi.fn().mockResolvedValue(mockConfig),
            upsertConfig: vi.fn().mockResolvedValue(mockConfig),
        });
        const service = new PayoutService(repo as never);

        const loaded = await service.getConfigByStaff('t1', 'staff1');
        expect(loaded).toEqual(mockConfig);
        expect(repo.getConfigByStaff).toHaveBeenCalledWith('t1', 'staff1');

        const saved = await service.upsertConfig({
            tenantId: 't1',
            staffId: 'staff1',
            frequency: 'weekly',
            payoutWeekday: 2,
            payoutMonthDay: null,
            allowAdvances: true,
        });
        expect(saved).toEqual(mockConfig);
        expect(repo.upsertConfig).toHaveBeenCalledWith('t1', 'staff1', {
            frequency: 'weekly',
            payoutWeekday: 2,
            payoutMonthDay: null,
            allowAdvances: true,
        });
    });

    it('should_delegate_listAdvancesBySettlement_to_repository', async () => {
        const mockAdvances = [
            {
                id: 'adv1',
                tenantId: 't1',
                staffId: 'staff1',
                amount: 80,
                transactionId: 'tx1',
                settlementId: 'st1',
                reversedAt: null,
                reversalMotivo: null,
                issuedAt: '2026-10-01T09:00:00Z',
                notes: 'Almoço',
                createdBy: 'u1',
                createdAt: '2026-10-01T09:00:00Z',
            },
        ];
        const repo = makeRepository({
            listAdvancesBySettlement: vi.fn().mockResolvedValue(mockAdvances),
        });
        const service = new PayoutService(repo as never);

        const list = await service.listAdvancesBySettlement('t1', 'st1');
        expect(list).toEqual(mockAdvances);
        expect(repo.listAdvancesBySettlement).toHaveBeenCalledWith('t1', 'st1');
    });
});