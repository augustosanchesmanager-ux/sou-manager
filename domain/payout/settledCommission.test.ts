import { describe, it, expect } from 'vitest';
import {
    reconcileSettledCommissionsToPeriodRows,
    type RawCommissionRecord,
    type FallbackComandaItem,
} from './settledCommission';

describe('settledCommission.reconcileSettledCommissionsToPeriodRows', () => {
    it('should_sum_active_commission_records', () => {
        const records: RawCommissionRecord[] = [
            {
                id: 'rec-1',
                comanda_id: 'c-1',
                comanda_item_id: 'item-1',
                staff_id: 'staff-1',
                gross_value: 100,
                commission_value: 50,
                status: 'active',
                record_type: 'commission',
            },
            {
                id: 'rec-2',
                comanda_id: 'c-2',
                comanda_item_id: 'item-2',
                staff_id: 'staff-1',
                gross_value: 60,
                commission_value: 30,
                status: 'active',
                record_type: 'commission',
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records });
        expect(rows).toHaveLength(2);
        expect(rows[0].commission_value).toBe(50);
        expect(rows[1].commission_value).toBe(30);
    });

    it('should_expurge_records_with_status_reversed_C1', () => {
        const records: RawCommissionRecord[] = [
            {
                id: 'rec-active',
                comanda_id: 'c-1',
                comanda_item_id: 'item-1',
                staff_id: 'staff-1',
                gross_value: 100,
                commission_value: 50,
                status: 'active',
                record_type: 'commission',
            },
            {
                id: 'rec-reversed',
                comanda_id: 'c-2',
                comanda_item_id: 'item-2',
                staff_id: 'staff-1',
                gross_value: 100,
                commission_value: 50,
                status: 'reversed', // C1 reversal status
                record_type: 'commission',
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records });
        expect(rows).toHaveLength(1);
        expect(rows[0].comanda_id).toBe('c-1');
        expect(rows[0].commission_value).toBe(50);
    });

    it('should_expurge_records_when_counterpart_reversal_record_exists_C1', () => {
        const records: RawCommissionRecord[] = [
            {
                id: 'rec-orig',
                comanda_id: 'c-1',
                comanda_item_id: 'item-1',
                staff_id: 'staff-1',
                gross_value: 100,
                commission_value: 50,
                status: 'active',
                record_type: 'commission',
            },
            {
                id: 'rec-rev',
                comanda_id: 'c-1',
                comanda_item_id: 'item-1',
                staff_id: 'staff-1',
                gross_value: 0,
                commission_value: -50,
                status: 'active',
                record_type: 'reversal',
                original_record_id: 'rec-orig',
            },
            {
                id: 'rec-other',
                comanda_id: 'c-2',
                comanda_item_id: 'item-2',
                staff_id: 'staff-1',
                gross_value: 80,
                commission_value: 40,
                status: 'active',
                record_type: 'commission',
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records });
        // rec-orig and rec-rev should both be expurged, leaving only rec-other
        expect(rows).toHaveLength(1);
        expect(rows[0].comanda_id).toBe('c-2');
        expect(rows[0].commission_value).toBe(40);
    });

    it('should_aggregate_multiple_items_for_same_professional_in_same_comanda_C2', () => {
        const records: RawCommissionRecord[] = [
            {
                id: 'rec-item-1',
                comanda_id: 'c-1',
                comanda_item_id: 'item-corte',
                staff_id: 'staff-1',
                gross_value: 60,
                commission_value: 30,
                status: 'active',
                record_type: 'commission',
            },
            {
                id: 'rec-item-2',
                comanda_id: 'c-1',
                comanda_item_id: 'item-barba',
                staff_id: 'staff-1',
                gross_value: 40,
                commission_value: 20,
                status: 'active',
                record_type: 'commission',
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records });
        expect(rows).toHaveLength(2);
        expect(rows.map((r) => r.commission_value)).toEqual([30, 20]);
    });

    it('should_discount_orphan_reversal_when_original_is_not_in_period', () => {
        const records: RawCommissionRecord[] = [
            {
                id: 'rec-valid',
                comanda_id: 'c-1',
                comanda_item_id: 'item-1',
                staff_id: 'staff-1',
                gross_value: 100,
                commission_value: 50,
                status: 'active',
                record_type: 'commission',
            },
            {
                id: 'rec-orphan-reversal',
                comanda_id: 'c-old',
                comanda_item_id: null,
                staff_id: 'staff-1',
                gross_value: 0,
                commission_value: 15, // positive or negative, should discount
                status: 'active',
                record_type: 'reversal',
                original_record_id: null,
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records });
        expect(rows).toHaveLength(2);
        expect(rows[0].commission_value).toBe(50);
        expect(rows[1].commission_value).toBe(-15);
    });

    it('should_fallback_to_comanda_items_when_ledger_record_is_absent', () => {
        const fallbackItems: FallbackComandaItem[] = [
            {
                id: 'item-fb-1',
                comanda_id: 'c-legacy',
                staff_id: 'staff-1',
                unit_price: 70,
                quantity: 1,
            },
            {
                id: 'item-fb-2',
                comanda_id: 'c-legacy',
                staff_id: 'staff-1',
                unit_price: 30,
                quantity: 2,
            },
        ];

        const rows = reconcileSettledCommissionsToPeriodRows({ records: [], fallbackItems });
        expect(rows).toHaveLength(2);
        expect(rows[0].amount).toBe(70);
        expect(rows[0].commission_value).toBeUndefined();
        expect(rows[1].amount).toBe(60);
        expect(rows[1].commission_value).toBeUndefined();
    });
});
