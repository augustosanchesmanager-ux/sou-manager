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
import {
    assertTransition,
} from '../../domain/payout/settlementStateMachine';
import { PayoutRepository } from '../../domain/payout/payoutRepository';
import type {
    BarberAdvance,
    BarberPayoutConfig,
    BarberPayoutSettlement,
    CancelSettlementResult,
    PayoutFrequency,
    PayoutReceiptItem,
    SettlementComputation,
    StaffProfile,
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

export interface UpsertBarberPayoutConfigParams {
    tenantId: string;
    staffId: string;
    frequency: PayoutFrequency;
    payoutWeekday: number | null;
    payoutMonthDay: number | null;
    allowAdvances: boolean;
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

        // Cada parcela é arredondada antes de ser somada. Somar primeiro e
        // arredondar depois deixaria divergência entre a soma das parcelas e
        // o total, que é exatamente o que o CHECK do banco proíbe.
        // Se a linha já traz commission_value reconciliado do livro-razão (D7/D8/C1/C2),
        // usamos o valor do ledger diretamente. Se não (fallback legado ou mock de teste),
        // aplicamos rate sobre amount.
        const computedGross = sumCents(
            payments.map((payment) => {
                if (payment.commission_value !== undefined && payment.commission_value !== null) {
                    return roundCents(Number(payment.commission_value));
                }
                return roundCents(Number(payment.amount) * rate);
            }),
        );
        const grossCommission = Math.max(0, computedGross);

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

        if (computation.grossCommission <= 0 && computation.bonusesAdded <= 0) {
            throw new Error('Nao e possivel gerar acerto com comissao bruta e bonus zerados');
        }

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

    // ── Configuração de Ciclo (ADR-030) ─────────────────────────────

    async getConfigByStaff(
        tenantId: string,
        staffId: string,
    ): Promise<BarberPayoutConfig | null> {
        return this.repository.getConfigByStaff(tenantId, staffId);
    }

    async upsertConfig(
        config: UpsertBarberPayoutConfigParams,
    ): Promise<BarberPayoutConfig> {
        let normalizedWeekday: number | null = null;
        let normalizedMonthDay: number | null = null;

        if (config.frequency === 'weekly' || config.frequency === 'biweekly') {
            const wd = Number(config.payoutWeekday);
            if (!Number.isInteger(wd) || wd < 1 || wd > 7) {
                throw new Error('Dia da semana (1-7) obrigatorio para frequencia semanal ou quinzenal');
            }
            normalizedWeekday = wd;
            normalizedMonthDay = null;
        } else if (config.frequency === 'monthly') {
            const md = Number(config.payoutMonthDay);
            if (!Number.isInteger(md) || md < 1 || md > 31) {
                throw new Error('Dia do mes (1-31) obrigatorio para frequencia mensal');
            }
            normalizedWeekday = null;
            normalizedMonthDay = md;
        } else {
            // daily
            normalizedWeekday = null;
            normalizedMonthDay = null;
        }

        return this.repository.upsertConfig(config.tenantId, config.staffId, {
            frequency: config.frequency,
            payoutWeekday: normalizedWeekday,
            payoutMonthDay: normalizedMonthDay,
            allowAdvances: Boolean(config.allowAdvances),
        });
    }

    // ── Vales / Adiantamentos ───────────────────────────────────────

    async registerAdvance(input: {
        tenantId: string;
        staffId: string;
        amount: number;
        paymentMethod?: string | null;
        notes?: string | null;
        idempotencyKey?: string | null;
    }) {
        const roundedAmount = roundCents(input.amount);
        if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
            throw new Error('Valor do vale deve ser maior que zero');
        }

        const config = await this.repository.getConfigByStaff(input.tenantId, input.staffId);
        if (config && config.allowAdvances === false) {
            throw new Error('Este profissional nao esta habilitado para receber vales/adiantamentos');
        }

        return this.repository.registerAdvance({ ...input, amount: roundedAmount });
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

    async listAdvancesBySettlement(
        tenantId: string,
        settlementId: string,
    ): Promise<BarberAdvance[]> {
        return this.repository.listAdvancesBySettlement(tenantId, settlementId);
    }

    // ── FSM de liquidação ────────────────────────────────────────────

    /**
     * draft → approved. Trava os valores para conferência do gestor.
     */
    async approveSettlement(tenantId: string, settlementId: string): Promise<BarberPayoutSettlement> {
        const current = await this.requireSettlement(tenantId, settlementId);
        assertTransition(current.status, 'approve');
        return this.repository.updateSettlementStatus(tenantId, settlementId, 'approved');
    }

    /**
     * approved (ou draft) → paid. `paymentMethod` é obrigatório e
     * `paidAt` é carimbado aqui; o banco reforça via `chk_paid_has_timestamp`.
     *
     * Concorrência: `uq_settlement_paid_period` é índice parcial único sobre
     * `status = 'paid'`, então um segundo pagamento do mesmo período falha
     * no banco, não aqui.
     */
    async markSettlementAsPaid(
        tenantId: string,
        settlementId: string,
        payload: { paymentMethod: string; paidAt?: string },
    ): Promise<BarberPayoutSettlement> {
        if (!payload.paymentMethod || payload.paymentMethod.trim() === '') {
            throw new Error('Metodo de pagamento obrigatorio para liquidar acerto');
        }

        const current = await this.requireSettlement(tenantId, settlementId);
        assertTransition(current.status, 'markAsPaid');

        return this.repository.updateSettlementStatus(tenantId, settlementId, 'paid', {
            paidAt: payload.paidAt ?? new Date().toISOString(),
            paymentMethod: payload.paymentMethod.trim(),
        });
    }

    /**
     * draft | approved → cancelled.
     *
     * Uma única chamada: a RPC `cancel_payout_settlement` executa
     * desvinculação e mudança de status na mesma transação. Duas chamadas
     * separadas deixariam uma janela em que os vales voltam a `pending`
     * enquanto o acerto segue aberto com `advances_deducted` já persistido.
     *
     * `paid` é terminal e não chega ao repositório: `assertTransition`
     * recusa, e a RPC recusa de novo — defesa em profundidade para uma
     * chamada direta a SQL.
     */
    async cancelSettlement(
        tenantId: string,
        settlementId: string,
        reason: string,
    ): Promise<{ settlement: BarberPayoutSettlement; result: CancelSettlementResult }> {
        if (!reason || reason.trim() === '') {
            throw new Error('Motivo obrigatorio para cancelar liquidacao');
        }

        const current = await this.requireSettlement(tenantId, settlementId);

        // Idempotencia de retentativa ANTES da FSM: `cancelled` e terminal e
        // `assertTransition` lancaria, o que anularia a idempotencia por
        // desenho da RPC. Um retry apos falha de rede e o cenario mais
        // provavel, entao e resolvido aqui sem chamar a RPC — nao ha nada a
        // desvincular.
        if (current.status === 'cancelled') {
            return {
                settlement: current,
                result: {
                    success: true,
                    unlinkedAdvances: 0,
                    idempotent: true,
                    message: 'Liquidacao ja cancelada.',
                },
            };
        }

        assertTransition(current.status, 'cancel');

        const result = await this.repository.cancelSettlement(
            tenantId,
            settlementId,
            reason.trim(),
        );

        const settlement = await this.requireSettlement(tenantId, settlementId);
        return { settlement, result };
    }

    /**
 * Acerto persistido para o par (profissional, período), ou null se ainda
 * não foi gerado. É o que a UI usa para decidir entre mostrar a
 * pré-visualização ou os valores efetivos.
 */
async getSettlementForPeriod(
    tenantId: string,
    staffId: string,
    periodStart: string,
    periodEnd: string,
): Promise<BarberPayoutSettlement | null> {
    return this.repository.getSettlementByPeriod(tenantId, staffId, periodStart, periodEnd);
}

/**
 * Profissionais elegíveis a repasse no tenant.
 *
 * A taxa chega ao repositório já normalizada em fração pela camada de
 * apresentação, via `getEffectiveCommissionRate` — que é o helper canônico
 * e concentra a regra FIX-001 (gestor com `commission_rate > 0` é
 * comissionado). Reimplementar essa conversão aqui criaria duas fontes de
 * verdade para a taxa, e divergência nisso é money.
 */
async listEligibleProfessionals(
    tenantId: string,
    resolveRate: (staff: StaffProfile) => number,
): Promise<StaffProfile[]> {
    const staff = await this.repository.listActiveProfessionals(tenantId);
    return staff
        .map((s) => ({ ...s, commissionRate: resolveRate(s) }))
        .filter((s) => s.commissionRate > 0);
}

/**
 * Retorna os itens discriminados de serviços liquidados para o recibo de comissões.
 */
async getSettledPaymentItems(params: {
    tenantId: string;
    staffId: string;
    periodStart: string;
    periodEnd: string;
    commissionRate: number;
}): Promise<PayoutReceiptItem[]> {
    const periodStartIso = startOfDayIso(params.periodStart);
    const periodEndIso = endOfDayIso(params.periodEnd);
    return this.repository.listSettledPaymentItems(
        params.tenantId,
        params.staffId,
        periodStartIso,
        periodEndIso,
        params.commissionRate,
    );
}

private async requireSettlement(
        tenantId: string,
        settlementId: string,
    ): Promise<BarberPayoutSettlement> {
        const found = await this.repository.getSettlementById(tenantId, settlementId);
        if (!found) {
            throw new Error(`Liquidacao ${settlementId} nao encontrada para este tenant`);
        }
        return found;
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
