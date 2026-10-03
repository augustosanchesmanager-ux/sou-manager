/**
 * [SMG][APPLICATION][PAYOUT] payoutService
 *
 * RESPONSABILIDADE: motor de cÃ¡lculo do acerto periÃ³dico. Consolida a base
 * liquidada do profissional no perÃ­odo, abate os vales pendentes e emite o
 * draft da liquidaÃ§Ã£o (ADR-030).
 *
 * REGIME DE CAIXA PURO (ADR-030 DecisÃ£o C): a comissÃ£o Ã© derivada
 * exclusivamente de `comanda_payments.created_at` dentro do perÃ­odo. NÃ£o hÃ¡
 * dependÃªncia de `attended_at` â€” que sÃ³ existe em `public.appointments` e
 * nÃ£o Ã© espelhado em `comandas`.
 *
 * ARITMÃ‰TICA: todo valor persistido passa por `roundCents`. O banco valida
 * `net_payout = gross_commission - advances_deducted + bonuses_added`
 * centavo por centavo; resÃ­duo de ponto flutuante violaria o CHECK.
 *
 * GARANTIAS:
 *   - NÃ£o conhece React, UI, toast ou navigate.
 *   - Todo acesso a dados passa pelo PayoutRepository.
 */

import { roundCents, sumCents } from '../../domain/payout/money';
import { consumeAdvancesFifo } from '../../domain/payout/advanceDeduction';
import { PayoutRepository } from '../../domain/payout/payoutRepository';
import type {
    BarberAdvance,
    BarberPayoutSettlement,
    SettlementComputation,
} from '../../domain/payout/types';

export interface ComputeSettlementParams {
    tenantId: string;
    staffId: string;
    /** ISO date (YYYY-MM-DD). InÃ­cio do ciclo, inclusive. */
    periodStart: string;
    /** ISO date (YYYY-MM-DD). Fim do ciclo, inclusive. */
    periodEnd: string;
    /** ComissÃ£o percentual do profissional (0.5 = 50%). */
    commissionRate: number;
    /** BÃ´nus/diÃ¡rias do perÃ­odo. Entra na fÃ³rmula, nÃ£o na base. */
    bonusesAdded?: number;
}

export class PayoutService {
    constructor(private readonly repository: PayoutRepository) {}

    /**
     * Calcula o acerto sem persistir. Separado da emissÃ£o para que o
     * cÃ¡lculo seja testÃ¡vel isoladamente e o gestor possa revisar antes de
     * gravar.
     */
    async computeSettlement(params: ComputeSettlementParams): Promise<SettlementComputation> {
        const periodStartIso = startOfDayIso(params.periodStart);
        const periodEndIso = endOfDayIso(params.periodEnd);

        const [payments, advances] = await Promise.all([
            this.repository.listSettledPaymentsInPeriod(
                params.tenantId,
                params.staffId,
                periodStartIso,
                periodEndIso,
            ),
            this.repository.listPendingAdvances(params.tenantId, params.staffId),
        ]);

        const rate = normalizeRate(params.commissionRate);

        // Cada parcela Ã© arredondada antes de ser somada. Somar primeiro e
        // arredondar depois deixaria divergÃªncia entre a soma das parcelas e
        // o total, que Ã© exatamente o que o CHECK do banco proÃ­be.
        const grossCommission = sumCents(
            payments.map((payment) => roundCents(Number(payment.amount) * rate)),
        );

        const bonusesAdded = roundCents(params.bonusesAdded ?? 0);

        // FIFO com corte estrito: um vale que nÃ£o couber inteiro na margem
        // permanece pendente, junto com os subsequentes.
        const deduction = consumeAdvancesFifo(
            advances,
            roundCents(grossCommission + bonusesAdded),
        );

        return {
            grossCommission,
            advancesDeducted: deduction.advancesDeducted,
            bonusesAdded,
            netPayout: roundCents(grossCommission - deduction.advancesDeducted + bonusesAdded),
            paymentCount: payments.length,
            consumedAdvanceIds: deduction.consumedAdvanceIds,
            remainingAdvanceIds: deduction.remainingAdvanceIds,
        };
    }

    /**
     * Calcula e grava o draft. Os vales sÃ³ sÃ£o vinculados depois que o
     * settlement existe â€” a RPC `link_advance_to_settlement` valida tenant,
     * pendÃªncia e status, e falha se o acerto jÃ¡ estiver pago.
     */
    async generateDraft(params: ComputeSettlementParams): Promise<{
        settlement: BarberPayoutSettlement;
        computation: SettlementComputation;
    }> {
        const computation = await this.computeSettlement(params);

        const settlement = await this.repository.createSettlementDraft({
            tenantId: params.tenantId,
            staffId: params.staffId,
            periodStart: params.periodStart,
            periodEnd: params.periodEnd,
            grossCommission: computation.grossCommission,
            advancesDeducted: computation.advancesDeducted,
            bonusesAdded: computation.bonusesAdded,
        });

        for (const advanceId of computation.consumedAdvanceIds) {
            await this.repository.linkAdvanceToSettlement(
                params.tenantId,
                advanceId,
                settlement.id,
            );
        }

        return { settlement, computation };
    }

    async registerAdvance(input: {
        tenantId: string;
        staffId: string;
        amount: number;
        paymentMethod?: string | null;
        notes?: string | null;
        idempotencyKey?: string | null;
    }) {
        return this.repository.registerAdvance({ ...input, amount: roundCents(input.amount) });
    }

    async reverseAdvance(tenantId: string, advanceId: string, motivo: string) {
        if (!motivo || motivo.trim() === '') {
            throw new Error('Motivo obrigatorio para estorno de vale');
        }
        return this.repository.reverseAdvance(tenantId, advanceId, motivo.trim());
    }

    async listPendingAdvances(tenantId: string, staffId: string): Promise<BarberAdvance[]> {
        return this.repository.listPendingAdvances(tenantId, staffId);
    }
}

function normalizeRate(rate: number): number {
    if (!Number.isFinite(rate) || rate <= 0) return 0;
    return Math.min(rate, 1);
}


/**
 * O perÃ­odo Ã© um intervalo de DATEs, mas `comanda_payments.created_at` Ã©
 * TIMESTAMPTZ. Sem estender o intervalo, um pagamento feito Ã s 18h do dia
 * final cairia fora do perÃ­odo por comparaÃ§Ã£o de timestamp.
 *
 * Fuso: `America/Sao_Paulo` Ã© UTC-03:00 fixo â€” o Brasil aboliu horÃ¡rio de
 * verÃ£o em 2019, entÃ£o nÃ£o hÃ¡ transiÃ§Ã£o a considerar por ano. O offset Ã© fixo
 * justamente por isso; usar IANA exigiria resolver o offset a cada chamada.
 */
const BARBEARIA_UTC_OFFSET = '-03:00';

function startOfDayIso(date: string): string {
    return `${date}T00:00:00.000${BARBEARIA_UTC_OFFSET}`;
}

function endOfDayIso(date: string): string {
    return `${date}T23:59:59.999${BARBEARIA_UTC_OFFSET}`;
}
