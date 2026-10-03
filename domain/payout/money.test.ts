import { describe, it, expect } from 'vitest';
import { roundCents, sumCents } from './money';
import { deriveAdvanceState } from './types';

describe('roundCents', () => {
    it('returns zero_when_amount_not_finite', () => {
        expect(roundCents(Number.NaN)).toBe(0);
        expect(roundCents(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('keeps_two_decimals_when_value_already_cented', () => {
        expect(roundCents(50)).toBe(50);
        expect(roundCents(1234.56)).toBe(1234.56);
    });

    it('removes_binary_residue_when_summing_decimals', () => {
        // 0.1 + 0.2 = 0.30000000000000004 em IEEE 754.
        expect(roundCents(0.1 + 0.2)).toBe(0.3);
    });

    it('rounds_half_up_when_third_decimal_present', () => {
        expect(roundCents(10.005 + Number.EPSILON)).toBe(10.01);
        expect(roundCents(2.675)).toBe(2.68);
    });
});

describe('sumCents', () => {
    it('returns_zero_when_list_empty', () => {
        expect(sumCents([])).toBe(0);
    });

    it('matches_sum_of_rounded_parts_when_values_repeat', () => {
        // 0.1 repetido 10x sem arredondar por parcela acumularia 0.9999.
        expect(sumCents(Array(10).fill(0.1))).toBe(1);
    });

    it('stays_cent_exact_when_many_thirds', () => {
        expect(sumCents([0.33, 0.33, 0.33])).toBe(0.99);
    });
});

describe('deriveAdvanceState', () => {
    it('reports_pending_when_no_settlement_and_not_reversed', () => {
        expect(deriveAdvanceState({ settlementId: null, reversedAt: null })).toBe('pending');
    });

    it('reports_settled_when_settlement_present', () => {
        expect(deriveAdvanceState({ settlementId: 's1', reversedAt: null })).toBe('settled');
    });

    it('reports_reversed_when_reversal_takes_precedence', () => {
        // Um vale estornado nunca volta a ser pendente, mesmo se tiver
        // settlement_id por dado inconsistente.
        expect(deriveAdvanceState({ settlementId: 's1', reversedAt: '2026-10-03T10:00:00Z' }))
            .toBe('reversed');
    });
});