/**
 * [SMG][DOMAIN][PAYOUT] settlementStateMachine
 *
 * RESPONSABILIDADE: máquina de estados finita da liquidação de repasse
 * (ADR-030). Define quais transições são possíveis e com que efeito.
 *
 * DECISÃO DE PO: `paid` é TERMINAL. Um acerto já liquidado financeiramente
 * não volta — a reversão de um Pix pago não tem schema de representação e
 * treatar "paid → cancelled" como unlink de vales causaria subpagamento
 * sistemático ao profissional. A dívida fica registrada no ADR-030.
 *
 *     draft ──approve──► approved ──markAsPaid──► paid (terminal)
 *       │                   │
 *       └──── cancel ────────┴──► cancelled  [desvincula vales]
 *
 * A função é pura e não conhece banco: a mesma regra é replicada na RPC
 * `unlink_advances_from_settlement` para que uma chamada direta a SQL não
 * consiga contornar a restrição.
 */

import type { SettlementStatus } from './types';

export type SettlementTransition = 'approve' | 'markAsPaid' | 'cancel';

/**
 * Transições de saída por status. `paid` e `cancelled` não têm nenhuma —
 * são estados terminais.
 */
export const ALLOWED_TRANSITIONS: Readonly<Record<SettlementStatus, readonly SettlementTransition[]>> =
    Object.freeze({
        draft: Object.freeze(['approve', 'markAsPaid', 'cancel'] as const),
        approved: Object.freeze(['markAsPaid', 'cancel'] as const),
        paid: Object.freeze([] as const),
        cancelled: Object.freeze([] as const),
    });

export const TERMINAL_STATUSES: readonly SettlementStatus[] = Object.freeze([
    'paid',
    'cancelled',
]);

export class SettlementTransitionError extends Error {
    constructor(
        readonly from: SettlementStatus,
        readonly transition: SettlementTransition,
    ) {
        super(
            from === 'paid'
                ? 'Acerto ja liquidado e imutavel: a reversao de um pagamento feito exige evento financeiro proprio, nao estao disponivel (ADR-030).'
                : `Transicao invalida: ${from} -> ${transition}`,
        );
        this.name = 'SettlementTransitionError';
    }
}

export function canTransition(from: SettlementStatus, transition: SettlementTransition): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(transition) ?? false;
}

export function assertTransition(from: SettlementStatus, transition: SettlementTransition): void {
    if (!canTransition(from, transition)) {
        throw new SettlementTransitionError(from, transition);
    }
}

export function isTerminal(status: SettlementStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
}

/**
 * O cancelamento exige desvinculação dos vales consumidos, para que voltem
 * a `pending` e possam ser abatidos no acerto seguinte.
 *
 * Só é verdadeiro a partir de `draft`/`approved`. Como `paid` não tem
 * transição de cancelamento, a resposta aqui é sempre falsa para acerto
 * liquidado — que é exatamente a proteção contra subpagamento.
 */
export function requiresUnlink(from: SettlementStatus, transition: SettlementTransition): boolean {
    return transition === 'cancel' && (from === 'draft' || from === 'approved');
}

/** Status resultante da transição, ou null se inválida. */
export function nextStatus(
    from: SettlementStatus,
    transition: SettlementTransition,
): SettlementStatus | null {
    if (!canTransition(from, transition)) return null;
    switch (transition) {
        case 'approve':
            return 'approved';
        case 'markAsPaid':
            return 'paid';
        case 'cancel':
            return 'cancelled';
    }
}

/**
 * Campos obrigatórios para concluir a transição. `paid_at` não entra na
 * lista porque é carimbado pelo próprio UPDATE; o banco o exige via
 * `chk_paid_has_timestamp`.
 */
export function requiredFieldsFor(transition: SettlementTransition): readonly string[] {
    switch (transition) {
        case 'approve':
            return [];
        case 'markAsPaid':
            return ['paymentMethod'];
        case 'cancel':
            return ['reason'];
    }
}