import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PayoutRepository } from './payoutRepository';
import type { DatabaseClient } from '../shared/database-client';

describe('PayoutRepository.listSettledPaymentsInPeriod', () => {
    let mockFrom: ReturnType<typeof vi.fn>;
    let repo: PayoutRepository;

    beforeEach(() => {
        mockFrom = vi.fn();
        const mockDb = {
            from: mockFrom,
            rpc: vi.fn(),
        } as unknown as DatabaseClient;
        repo = new PayoutRepository(mockDb);
    });

    it('should_return_empty_when_no_valid_comanda_payments_in_period', async () => {
        const chainable = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
        mockFrom.mockReturnValue(chainable);

        const result = await repo.listSettledPaymentsInPeriod(
            't1',
            'staff1',
            '2026-10-01T00:00:00Z',
            '2026-10-07T23:59:59Z',
        );

        expect(result).toEqual([]);
        expect(mockFrom).toHaveBeenCalledWith('comanda_payments');
        expect(chainable.is).toHaveBeenCalledWith('reversed_at', null);
    });

    it('should_filter_out_comandas_that_are_not_paid', async () => {
        // Step 1: comanda_payments has payments for c1 and c2
        const paymentsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [
                    { comanda_id: 'c1', amount: 100, created_at: '2026-10-02T10:00:00Z' },
                    { comanda_id: 'c2', amount: 50, created_at: '2026-10-03T10:00:00Z' },
                ],
                error: null,
            }),
        };

        // Step 2: only c1 is paid; c2 is open/cancelled
        const comandasChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [{ id: 'c1', status: 'paid' }],
                    error: null,
                }),
        };

        // Step 3: commission_records for c1
        const recordsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [
                        {
                            id: 'rec-1',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-1',
                            staff_id: 'staff1',
                            gross_value: 100,
                            commission_value: 40,
                            status: 'active',
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                    ],
                    error: null,
                }),
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'comanda_payments') return paymentsChain;
            if (table === 'comandas') return comandasChain;
            if (table === 'commission_records') return recordsChain;
            return {};
        });

        const result = await repo.listSettledPaymentsInPeriod(
            't1',
            'staff1',
            '2026-10-01T00:00:00Z',
            '2026-10-07T23:59:59Z',
        );

        expect(result).toHaveLength(1);
        expect(result[0].comanda_id).toBe('c1');
        expect(result[0].commission_value).toBe(40);
    });

    it('should_aggregate_multiple_items_and_exclude_reversed_records', async () => {
        const paymentsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ comanda_id: 'c1', amount: 120, created_at: '2026-10-02T10:00:00Z' }],
                error: null,
            }),
        };

        const comandasChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [{ id: 'c1', status: 'paid' }],
                    error: null,
                }),
        };

        const recordsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [
                        {
                            id: 'rec-corte',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-corte',
                            staff_id: 'staff1',
                            gross_value: 60,
                            commission_value: 30,
                            status: 'active',
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                        {
                            id: 'rec-barba',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-barba',
                            staff_id: 'staff1',
                            gross_value: 40,
                            commission_value: 20,
                            status: 'active',
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                        {
                            id: 'rec-estornado',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-estorno',
                            staff_id: 'staff1',
                            gross_value: 20,
                            commission_value: 10,
                            status: 'reversed', // C1 reversal
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                    ],
                    error: null,
                }),
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'comanda_payments') return paymentsChain;
            if (table === 'comandas') return comandasChain;
            if (table === 'commission_records') return recordsChain;
            return {};
        });

        const result = await repo.listSettledPaymentsInPeriod(
            't1',
            'staff1',
            '2026-10-01T00:00:00Z',
            '2026-10-07T23:59:59Z',
        );

        // 2 items active (corte + barba), 1 reversed excluded
        expect(result).toHaveLength(2);
        expect(result.map((r) => r.commission_value)).toEqual([30, 20]);
    });
});

describe('PayoutRepository resilience to missing ADR-030 tables', () => {
    let mockFrom: ReturnType<typeof vi.fn>;
    let repo: PayoutRepository;

    beforeEach(() => {
        mockFrom = vi.fn();
        const mockDb = {
            from: mockFrom,
            rpc: vi.fn(),
        } as unknown as DatabaseClient;
        repo = new PayoutRepository(mockDb);
    });

    it('should_return_empty_advances_when_barber_advances_table_does_not_exist', async () => {
        const errorChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '42P01', message: 'relation "barber_advances" does not exist' },
            }),
        };
        mockFrom.mockReturnValue(errorChain);

        const result = await repo.listPendingAdvances('t1', 'staff1');
        expect(result).toEqual([]);
    });

    it('should_return_null_config_when_barber_payout_configs_table_does_not_exist', async () => {
        const errorChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST204', message: 'relation "barber_payout_configs" not found in schema cache' },
            }),
        };
        mockFrom.mockReturnValue(errorChain);

        const result = await repo.getConfigByStaff('t1', 'staff1');
        expect(result).toBeNull();
    });

    it('should_return_null_settlement_when_barber_payout_settlements_table_does_not_exist', async () => {
        const errorChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { code: '42P01', message: 'relation "barber_payout_settlements" does not exist' },
            }),
        };
        mockFrom.mockReturnValue(errorChain);

        const result = await repo.getSettlementByPeriod('t1', 'staff1', '2026-10-01', '2026-10-07');
        expect(result).toBeNull();
    });
});

describe('PayoutRepository.listSettledPaymentItems', () => {
    let mockFrom: ReturnType<typeof vi.fn>;
    let repo: PayoutRepository;

    beforeEach(() => {
        mockFrom = vi.fn();
        const mockDb = {
            from: mockFrom,
            rpc: vi.fn(),
        } as unknown as DatabaseClient;
        repo = new PayoutRepository(mockDb);
    });

    it('should_return_itemized_receipt_items_with_descriptions_and_amounts', async () => {
        const paymentsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [{ comanda_id: 'c1', amount: 90, created_at: '2026-10-02T10:00:00Z' }],
                error: null,
            }),
        };

        const comandasChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({ data: [{ id: 'c1', status: 'paid' }], error: null }),
        };

        const itemsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [
                        {
                            id: 'item-corte',
                            comanda_id: 'c1',
                            product_name: 'Corte Degradê Navalhado',
                            quantity: 1,
                            unit_price: 50,
                            staff_id: 'staff1',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                        {
                            id: 'item-barba',
                            comanda_id: 'c1',
                            product_name: 'Barba Terapia com Toalha Quente',
                            quantity: 1,
                            unit_price: 40,
                            staff_id: 'staff1',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                    ],
                    error: null,
                }),
        };

        const recordsChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            then: (resolve: (v: unknown) => void) =>
                resolve({
                    data: [
                        {
                            id: 'rec-corte',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-corte',
                            staff_id: 'staff1',
                            gross_value: 50,
                            commission_value: 25,
                            status: 'active',
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                        {
                            id: 'rec-barba',
                            comanda_id: 'c1',
                            comanda_item_id: 'item-barba',
                            staff_id: 'staff1',
                            gross_value: 40,
                            commission_value: 20,
                            status: 'active',
                            record_type: 'commission',
                            created_at: '2026-10-02T10:00:00Z',
                        },
                    ],
                    error: null,
                }),
        };

        mockFrom.mockImplementation((table: string) => {
            if (table === 'comanda_payments') return paymentsChain;
            if (table === 'comandas') return comandasChain;
            if (table === 'comanda_items') return itemsChain;
            if (table === 'commission_records') return recordsChain;
            return {};
        });

        const items = await repo.listSettledPaymentItems(
            't1',
            'staff1',
            '2026-10-01T00:00:00Z',
            '2026-10-07T23:59:59Z',
            0.5,
        );

        expect(items).toHaveLength(2);
        expect(items[0]).toEqual({
            id: 'item-corte',
            comandaId: 'c1',
            description: 'Corte Degradê Navalhado',
            date: '2026-10-02T10:00:00Z',
            quantity: 1,
            unitPrice: 50,
            grossAmount: 50,
            commissionAmount: 25,
        });
        expect(items[1]).toEqual({
            id: 'item-barba',
            comandaId: 'c1',
            description: 'Barba Terapia com Toalha Quente',
            date: '2026-10-02T10:00:00Z',
            quantity: 1,
            unitPrice: 40,
            grossAmount: 40,
            commissionAmount: 20,
        });
    });
});
