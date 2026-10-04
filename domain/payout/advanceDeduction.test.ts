import { describe, it, expect } from 'vitest';
import { consumeAdvancesFifo } from './advanceDeduction';

const advance = (id: string, amount: number, issuedAt: string) => ({
    id,
    amount,
    issuedAt,
});

describe('consumeAdvancesFifo', () => {
    it('consumes_nothing_when_base_is_zero', () => {
        const result = consumeAdvancesFifo([advance('a', 100, '2026-10-01T10:00:00Z')], 0);
        expect(result.consumedAdvanceIds).toEqual([]);
        expect(result.advancesDeducted).toBe(0);
        expect(result.remainingAdvanceIds).toEqual(['a']);
    });

    it('consumes_all_when_base_covers_total', () => {
        const result = consumeAdvancesFifo(
            [
                advance('a', 200, '2026-10-01T10:00:00Z'),
                advance('b', 150, '2026-10-04T10:00:00Z'),
                advance('c', 100, '2026-10-06T10:00:00Z'),
            ],
            1000,
        );
        expect(result.consumedAdvanceIds).toEqual(['a', 'b', 'c']);
        expect(result.advancesDeducted).toBe(450);
        expect(result.remainingAdvanceIds).toEqual([]);
    });

    it('stops_at_first_advance_that_does_not_fit_when_base_capped', () => {
        // Cenário homologado pelo PO: base R$400, vales 200 + 150 + 100.
        // A (200) e B (150) cabem; sobra R$50 que não comporta C (100).
        const result = consumeAdvancesFifo(
            [
                advance('A', 200, '2026-10-01T10:00:00Z'),
                advance('B', 150, '2026-10-04T10:00:00Z'),
                advance('C', 100, '2026-10-06T10:00:00Z'),
            ],
            400,
        );
        expect(result.consumedAdvanceIds).toEqual(['A', 'B']);
        expect(result.advancesDeducted).toBe(350);
        expect(result.remainingAdvanceIds).toEqual(['C']);
    });

    it('never_partially_deducts_when_advance_exceeds_remaining_margin', () => {
        // Vale de R$300 com base R$100: dedução zero, não R$100.
        const result = consumeAdvancesFifo([advance('big', 300, '2026-10-01T10:00:00Z')], 100);
        expect(result.consumedAdvanceIds).toEqual([]);
        expect(result.advancesDeducted).toBe(0);
        expect(result.remainingAdvanceIds).toEqual(['big']);
    });

    it('skips_all_subsequent_when_one_does_not_fit', () => {
        // C não cabe, então D também não pode ser consumido — FIFO estrito.
        const result = consumeAdvancesFifo(
            [
                advance('A', 100, '2026-10-01T10:00:00Z'),
                advance('C', 300, '2026-10-02T10:00:00Z'),
                advance('D', 50, '2026-10-03T10:00:00Z'),
            ],
            150,
        );
        expect(result.consumedAdvanceIds).toEqual(['A']);
        expect(result.remainingAdvanceIds).toEqual(['C', 'D']);
    });

    it('orders_by_issued_at_when_input_is_unsorted', () => {
        const result = consumeAdvancesFifo(
            [
                advance('late', 100, '2026-10-06T10:00:00Z'),
                advance('early', 100, '2026-10-01T10:00:00Z'),
            ],
            100,
        );
        // FIFO sem ordenação determinística não é FIFO.
        expect(result.consumedAdvanceIds).toEqual(['early']);
        expect(result.remainingAdvanceIds).toEqual(['late']);
    });

    it('ignores_non_positive_amount_without_blocking_others', () => {
        const result = consumeAdvancesFifo(
            [
                advance('invalid', 0, '2026-10-01T10:00:00Z'),
                advance('valid', 50, '2026-10-02T10:00:00Z'),
            ],
            100,
        );
        expect(result.consumedAdvanceIds).toEqual(['valid']);
        expect(result.advancesDeducted).toBe(50);
    });

    it('never_deducts_more_than_base_when_sum_would_exceed', () => {
        // Invariante do chk_advances_not_over_gross.
        const base = 400;
        const result = consumeAdvancesFifo(
            [
                advance('a', 250, '2026-10-01T10:00:00Z'),
                advance('b', 250, '2026-10-02T10:00:00Z'),
            ],
            base,
        );
        expect(result.advancesDeducted).toBeLessThanOrEqual(base);
    });
});