/**
 * [SMG][DOMAIN][PAYOUT] advanceDeduction
 *
 * RESPONSABILIDADE: regra de consumo de vales pendentes no acerto —
 * FIFO com corte estrito (ADR-030).
 *
 * POR QUE EXISTE: o banco impõe `chk_advances_not_over_gross`
 * (advances_deducted <= gross_commission + bonuses_added). Consumir vales
 * além da base faria o INSERT da liquidação falhar. Consumir parcialmente
 * um vale exigiria schema de parcelamento que não existe.
 *
 * REGRA (decisão de PO):
 *   - Os vales são consumidos em ordem cronológica de emissão.
 *   - A dedução é integral: se o próximo vale não couber inteiro na
 *     margem restante, ele e todos os subsequentes permanecem `pending`
 *     (settlement_id = NULL) para o próximo ciclo.
 *   - A margem restante é deixada sem uso. Isso é deliberado — preferimos
 *     subabatar a liquidar um registro pela metade sem schema de suporte.
 *   - SOMENTE `consumedAdvanceIds` podem ser vinculados a uma liquidação.
 *     Vincular um vale não consumido o liquidaria contabilmente sem que seu
 *     valor tivesse sido subtraído do repasse (perda financeira direta).
 */

import { roundCents } from './money';
import type { BarberAdvance } from './types';

export interface AdvanceDeductionResult {
    /** Vales integralmente deduzidos neste acerto. Único conjunto passível a `link_advance_to_settlement`. */
    consumedAdvanceIds: string[];
    /** Total efetivamente deduzido, em centavos. */
    advancesDeducted: number;
    /** Vales que seguem pendentes — total ou parcialmente — para o próximo ciclo. */
    remainingAdvanceIds: string[];
}

type MinimalAdvance = Pick<BarberAdvance, 'id' | 'amount' | 'issuedAt'>;

export function consumeAdvancesFifo(
    advances: readonly MinimalAdvance[],
    base: number,
): AdvanceDeductionResult {
    const consumedAdvanceIds: string[] = [];
    const remainingAdvanceIds: string[] = [];
    let deducted = 0;
    let margin = roundCents(base);
    let stopped = false;

    // FIFO determinístico: a ordenação é feita aqui e não delegada ao banco.
    // Sem ORDER BY, o Postgres não garante ordem, e FIFO sem ordem é FIFO
    // só por acaso.
    const ordered = [...advances].sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

    for (const advance of ordered) {
        if (stopped) {
            remainingAdvanceIds.push(advance.id);
            continue;
        }

        const amount = roundCents(advance.amount);
        if (amount <= 0) {
            // Registro inválido não pode ser consumido nem bloquear os
            // seguintes; ignora e segue.
            continue;
        }

        if (amount <= margin) {
            margin = roundCents(margin - amount);
            deducted = roundCents(deducted + amount);
            consumedAdvanceIds.push(advance.id);
        } else {
            stopped = true;
            remainingAdvanceIds.push(advance.id);
        }
    }

    return { consumedAdvanceIds, advancesDeducted: deducted, remainingAdvanceIds };
}