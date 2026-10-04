import { describe, it, expect } from 'vitest';
import {
    ALLOWED_TRANSITIONS,
    SettlementTransitionError,
    assertTransition,
    canTransition,
    isTerminal,
    nextStatus,
    requiresUnlink,
} from './settlementStateMachine';

describe('settlementStateMachine', () => {
    it('allows_approve_from_draft_only', () => {
        expect(canTransition('draft', 'approve')).toBe(true);
        expect(canTransition('approved', 'approve')).toBe(false);
        expect(canTransition('paid', 'approve')).toBe(false);
        expect(canTransition('cancelled', 'approve')).toBe(false);
    });

    it('allows_markAsPaid_from_draft_and_approved', () => {
        // Aprovação e liquidação imediatas no balcão é operação normal.
        expect(canTransition('draft', 'markAsPaid')).toBe(true);
        expect(canTransition('approved', 'markAsPaid')).toBe(true);
    });

    it('allows_cancel_from_draft_and_approved', () => {
        expect(canTransition('draft', 'cancel')).toBe(true);
        expect(canTransition('approved', 'cancel')).toBe(true);
    });

    it('blocks_every_transition_from_paid', () => {
        // paid e terminal (decisao de PO).
        expect(ALLOWED_TRANSITIONS.paid).toHaveLength(0);
        expect(canTransition('paid', 'cancel')).toBe(false);
        expect(canTransition('paid', 'markAsPaid')).toBe(false);
        expect(canTransition('paid', 'approve')).toBe(false);
    });

    it('blocks_every_transition_from_cancelled', () => {
        expect(canTransition('cancelled', 'cancel')).toBe(false);
        expect(canTransition('cancelled', 'approve')).toBe(false);
        expect(canTransition('cancelled', 'markAsPaid')).toBe(false);
    });

    it('throws_on_cancel_of_paid_settlement', () => {
        expect(() => assertTransition('paid', 'cancel')).toThrow(SettlementTransitionError);
        expect(() => assertTransition('paid', 'cancel')).toThrow(/imutavel/i);
    });

    it('does_not_require_unlink_for_paid_even_if_cancel_were_possible', () => {
        // Defesa contra subpagamento: um acerto liquidado nunca devolve
        // vales a pending, porque seriam descontados duas vezes.
        expect(requiresUnlink('paid', 'cancel')).toBe(false);
    });

    it('requires_unlink_when_cancelling_open_settlement', () => {
        expect(requiresUnlink('draft', 'cancel')).toBe(true);
        expect(requiresUnlink('approved', 'cancel')).toBe(true);
    });

    it('does_not_require_unlink_for_non_cancel_transitions', () => {
        expect(requiresUnlink('draft', 'approve')).toBe(false);
        expect(requiresUnlink('approved', 'markAsPaid')).toBe(false);
    });

    it('maps_transition_to_next_status', () => {
        expect(nextStatus('draft', 'approve')).toBe('approved');
        expect(nextStatus('draft', 'markAsPaid')).toBe('paid');
        expect(nextStatus('approved', 'markAsPaid')).toBe('paid');
        expect(nextStatus('approved', 'cancel')).toBe('cancelled');
    });

    it('returns_null_next_status_when_transition_invalid', () => {
        expect(nextStatus('paid', 'cancel')).toBeNull();
        expect(nextStatus('cancelled', 'approve')).toBeNull();
    });

    it('identifies_terminal_statuses', () => {
        expect(isTerminal('paid')).toBe(true);
        expect(isTerminal('cancelled')).toBe(true);
        expect(isTerminal('draft')).toBe(false);
        expect(isTerminal('approved')).toBe(false);
    });

    it('freezes_transition_table_against_runtime_mutation', () => {
        expect(Object.isFrozen(ALLOWED_TRANSITIONS)).toBe(true);
        expect(Object.isFrozen(ALLOWED_TRANSITIONS.paid)).toBe(true);
    });
});