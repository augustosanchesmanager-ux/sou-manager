/**
 * [SMG][DOMAIN][PAYOUT] payoutRepository
 *
 * RESPONSABILIDADE: acesso a `barber_payout_configs`, `barber_advances` e
 * `barber_payout_settlements` (ADR-030), além das três RPCs atômicas.
 *
 * GARANTIAS:
 *   - Toda operação filtra por tenant_id. A RLS não é delegated: o filtro
 *     é explícito porque `public.staff` tem RLS permissiva (USING (true))
 *     e não isola tenant.
 *   - Lança RepositoryError em falhas; nunca retorna { data, error }.
 *   - Zero conhecimento de React, UI, navigate, toast.
 *
 * MUTAÇÃO: `barber_advances` é append-only no cliente REST. INSERT é
 * direto; `settlement_id` e `reversed_at` só mudam via RPC SECURITY
 * DEFINER. Não há UPDATE nem DELETE exposto aqui de propósito.
 */

import { RepositoryError } from '../shared/errors';
import type { DatabaseClient } from '../shared/database-client';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { AppSlug } from '../shared/app';
import type {
    AdvanceRegistrationResult,
    BarberAdvance,
    BarberPayoutConfig,
    BarberPayoutSettlement,
    CancelSettlementResult,
    CreateSettlementDraftInput,
    PayoutFrequency,
} from './types';

interface ConfigRow {
    id: string;
    tenant_id: string;
    staff_id: string;
    frequency: PayoutFrequency;
    payout_weekday: number | null;
    payout_month_day: number | null;
    allow_advances: boolean;
    created_at: string;
    updated_at: string;
}

interface AdvanceRow {
    id: string;
    tenant_id: string;
    staff_id: string;
    amount: number | string;
    transaction_id: string | null;
    settlement_id: string | null;
    reversed_at: string | null;
    reversal_motivo: string | null;
    issued_at: string;
    notes: string | null;
    created_by: string;
    created_at: string;
}

interface SettlementRow {
    id: string;
    tenant_id: string;
    staff_id: string;
    period_start: string;
    period_end: string;
    gross_commission: number | string;
    advances_deducted: number | string;
    bonuses_added: number | string;
    net_payout: number | string;
    status: BarberPayoutSettlement['status'];
    paid_at: string | null;
    payment_method: string | null;
    cancel_reason: string | null;
    created_at: string;
}

const CONFIG_COLUMNS =
    'id, tenant_id, staff_id, frequency, payout_weekday, payout_month_day, allow_advances, created_at, updated_at';

const ADVANCE_COLUMNS =
    'id, tenant_id, staff_id, amount, transaction_id, settlement_id, reversed_at, reversal_motivo, issued_at, notes, created_by, created_at';

const SETTLEMENT_COLUMNS =
    'id, tenant_id, staff_id, period_start, period_end, gross_commission, advances_deducted, bonuses_added, net_payout, status, paid_at, payment_method, cancel_reason, created_at';

export interface ComandaPaymentPeriodRow {
    comanda_id: string;
    staff_id: string | null;
    amount: number | string;
    created_at: string;
}

export class PayoutRepository {
    private readonly db: DatabaseClient;
    private readonly tableName = 'barber_payout';

    constructor(db?: DatabaseClient, appSlug: AppSlug = 'barber') {
        this.db = db ?? createSupabaseClient('barber_payout_configs', appSlug);
    }

    private fail(error: unknown, context: string): never {
        if (error instanceof RepositoryError) throw error;
        const err = error as { message?: string; code?: string } | null;
        throw new RepositoryError(
            `${context}: ${err?.message || 'Erro desconhecido'}`,
            err?.code,
            this.tableName,
            error,
        );
    }

    private data<T>(result: { data: T | null; error: unknown }, context: string): T {
        if (result.error) this.fail(result.error, context);
        if (result.data === null) {
            throw new RepositoryError(
                `${context}: sem dados retornados`,
                undefined,
                this.tableName,
            );
        }
        return result.data;
    }

    // ── Configurações ───────────────────────────────────────────────

    async getConfigByStaff(
        tenantId: string,
        staffId: string,
    ): Promise<BarberPayoutConfig | null> {
        const result = await this.db.from('barber_payout_configs')
            .select(CONFIG_COLUMNS)
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffId)
            .maybeSingle();

        if (result.error) this.fail(result.error, 'getConfigByStaff');
        if (!result.data) return null;

        const row = result.data as ConfigRow;
        return {
            id: row.id,
            tenantId: row.tenant_id,
            staffId: row.staff_id,
            frequency: row.frequency,
            payoutWeekday: row.payout_weekday,
            payoutMonthDay: row.payout_month_day,
            allowAdvances: row.allow_advances,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    async upsertConfig(
        tenantId: string,
        staffId: string,
        input: {
            frequency: PayoutFrequency;
            payoutWeekday: number | null;
            payoutMonthDay: number | null;
            allowAdvances: boolean;
        },
    ): Promise<BarberPayoutConfig> {
        const result = await this.db.from('barber_payout_configs')
            .upsert(
                {
                    tenant_id: tenantId,
                    staff_id: staffId,
                    frequency: input.frequency,
                    payout_weekday: input.payoutWeekday,
                    payout_month_day: input.payoutMonthDay,
                    allow_advances: input.allowAdvances,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'tenant_id,staff_id' },
            )
            .select(CONFIG_COLUMNS)
            .single();

        const row = this.data(result, 'upsertConfig') as ConfigRow;
        return {
            id: row.id,
            tenantId: row.tenant_id,
            staffId: row.staff_id,
            frequency: row.frequency,
            payoutWeekday: row.payout_weekday,
            payoutMonthDay: row.payout_month_day,
            allowAdvances: row.allow_advances,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };
    }

    // ── Vales ────────────────────────────────────────────────────────

    async listPendingAdvances(tenantId: string, staffId: string): Promise<BarberAdvance[]> {
        const result = await this.db.from('barber_advances')
            .select(ADVANCE_COLUMNS)
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffId)
            .is('settlement_id', null)
            .is('reversed_at', null)
            .order('issued_at', { ascending: true });

        const rows = this.data(result, 'listPendingAdvances') as AdvanceRow[];
        return rows.map(mapAdvance);
    }

    async listAdvancesBySettlement(tenantId: string, settlementId: string): Promise<BarberAdvance[]> {
        const result = await this.db.from('barber_advances')
            .select(ADVANCE_COLUMNS)
            .eq('tenant_id', tenantId)
            .eq('settlement_id', settlementId);

        const rows = this.data(result, 'listAdvancesBySettlement') as AdvanceRow[];
        return rows.map(mapAdvance);
    }

/**
     * Delegado à RPC `register_barber_advance`, que insere o vale e
     * espelha a saída no caixa na mesma transação. INSERT direto quebraria
     * a atomicidade do espelho.
     */
    async registerAdvance(input: {
        tenantId: string;
        staffId: string;
        amount: number;
        paymentMethod?: string | null;
        notes?: string | null;
        idempotencyKey?: string | null;
    }): Promise<AdvanceRegistrationResult> {
        const { data, error } = await this.db.rpc('register_barber_advance', {
            p_tenant_id: input.tenantId,
            p_staff_id: input.staffId,
            p_amount: input.amount,
            p_payment_method: input.paymentMethod ?? null,
            p_notes: input.notes ?? null,
            p_idempotency_key: input.idempotencyKey ?? null,
        });

        if (error) this.fail(error, 'registerAdvance');
        const payload = (data ?? {}) as Partial<AdvanceRegistrationResult>;
        return {
            success: payload.success ?? true,
            idempotent: payload.idempotent ?? false,
            advanceId: payload.advanceId ?? '',
            transactionId: payload.transactionId ?? null,
            amount: input.amount,
            message: payload.message ?? '',
        };
    }

    async linkAdvanceToSettlement(
        tenantId: string,
        advanceId: string,
        settlementId: string,
    ): Promise<{ success: boolean; message: string }> {
        const { data, error } = await this.db.rpc('link_advance_to_settlement', {
            p_tenant_id: tenantId,
            p_advance_id: advanceId,
            p_settlement_id: settlementId,
        });

        if (error) this.fail(error, 'linkAdvanceToSettlement');
        const payload = (data ?? {}) as { success?: boolean; message?: string };
        return { success: payload.success ?? true, message: payload.message ?? '' };
    }

    async reverseAdvance(
        tenantId: string,
        advanceId: string,
        motivo: string,
    ): Promise<{ success: boolean; message: string }> {
        const { data, error } = await this.db.rpc('reverse_barber_advance', {
            p_tenant_id: tenantId,
            p_advance_id: advanceId,
            p_motivo: motivo,
        });

        if (error) this.fail(error, 'reverseAdvance');
        const payload = (data ?? {}) as { success?: boolean; message?: string };
        return { success: payload.success ?? true, message: payload.message ?? '' };
    }

    // ── Liquidações ─────────────────────────────────────────────────

    async createSettlementDraft(
        input: CreateSettlementDraftInput,
    ): Promise<BarberPayoutSettlement> {
        const result = await this.db.from('barber_payout_settlements')
            .insert({
                tenant_id: input.tenantId,
                staff_id: input.staffId,
                period_start: input.periodStart,
                period_end: input.periodEnd,
                gross_commission: input.grossCommission,
                advances_deducted: input.advancesDeducted,
                bonuses_added: input.bonusesAdded,
                net_payout:
                    input.grossCommission - input.advancesDeducted + input.bonusesAdded,
                status: 'draft',
            })
            .select(SETTLEMENT_COLUMNS)
            .single();

        return mapSettlement(this.data(result, 'createSettlementDraft') as SettlementRow);
    }

    async listSettlementsByStaff(
        tenantId: string,
        staffId: string,
    ): Promise<BarberPayoutSettlement[]> {
        const result = await this.db.from('barber_payout_settlements')
            .select(SETTLEMENT_COLUMNS)
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffId)
            .order('period_start', { ascending: false });

        const rows = this.data(result, 'listSettlementsByStaff') as SettlementRow[];
        return rows.map(mapSettlement);
    }

    async getSettlementById(tenantId: string, settlementId: string): Promise<BarberPayoutSettlement | null> {
        const result = await this.db.from('barber_payout_settlements')
            .select(SETTLEMENT_COLUMNS)
            .eq('tenant_id', tenantId)
            .eq('id', settlementId)
            .maybeSingle();

        if (result.error) this.fail(result.error, 'getSettlementById');
        if (!result.data) return null;
        return mapSettlement(result.data as SettlementRow);
    }

    /**
     * Transição de status. Autorizada pela policy `barber_payout_settlements_write`
     * (FOR ALL, gestor do tenant) — por isso não há RPC para approve/pay.
     *
     * As regras da FSM são validadas na camada de domínio
     * (`settlementStateMachine`) antes de chegar aqui. `paid_at` é carimbado
     * por este UPDATE; o banco exige via `chk_paid_has_timestamp`.
     */
    async updateSettlementStatus(
        tenantId: string,
        settlementId: string,
        status: BarberPayoutSettlement['status'],
        extra: { paidAt?: string | null; paymentMethod?: string | null } = {},
    ): Promise<BarberPayoutSettlement> {
        const payload: Record<string, unknown> = { status };
        if (extra.paidAt !== undefined) payload.paid_at = extra.paidAt;
        if (extra.paymentMethod !== undefined) payload.payment_method = extra.paymentMethod;

        const result = await this.db.from('barber_payout_settlements')
            .update(payload)
            .eq('id', settlementId)
            .eq('tenant_id', tenantId)
            .select(SETTLEMENT_COLUMNS)
            .single();

        return mapSettlement(this.data(result, 'updateSettlementStatus') as SettlementRow);
    }

    /**
     * Delegado à RPC `cancel_payout_settlement`, que executa desvinculação
     * e mudança de status numa única transação. O UPDATE direto em
     * `barber_advances` é impossível: não há policy de UPDATE (append-only).
     * A RPC substituiu `unlink_advances_from_settlement`, removida para não
     * deixar código morto com SECURITY DEFINER no schema.
     */
    async cancelSettlement(
        tenantId: string,
        settlementId: string,
        motivo: string,
    ): Promise<CancelSettlementResult> {
        const { data, error } = await this.db.rpc('cancel_payout_settlement', {
            p_tenant_id: tenantId,
            p_settlement_id: settlementId,
            p_motivo: motivo,
        });

        if (error) this.fail(error, 'cancelSettlement');
        const payload = (data ?? {}) as Partial<CancelSettlementResult>;
        return {
            success: payload.success ?? true,
            unlinkedAdvances: payload.unlinkedAdvances ?? 0,
            idempotent: payload.idempotent ?? false,
            message: payload.message ?? '',
        };
    }

    // ── Base liquidada (regime de caixa) ─────────────────────────────

    /**
     * Pagamentos NÃO estornados do profissional no período. Esta é a base
     * do regime de caixa (ADR-030 Decisão C): a competência do repasse é
     * a data de liquidação, não a data do atendimento.
     *
     * `reversed_at IS NULL` é filtrado aqui para que nenhum consumidor
     * precise repetir a regra — o estorno marca a linha, não a apaga.
     */
    async listSettledPaymentsInPeriod(
        tenantId: string,
        staffId: string,
        periodStartIso: string,
        periodEndIso: string,
    ): Promise<ComandaPaymentPeriodRow[]> {
        const result = await this.db.from('comanda_payments')
            .select('comanda_id, staff_id, amount, created_at')
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffId)
            .is('reversed_at', null)
            .gte('created_at', periodStartIso)
            .lte('created_at', periodEndIso)
            .order('created_at', { ascending: true });

        return this.data(result, 'listSettledPaymentsInPeriod') as ComandaPaymentPeriodRow[];
    }
}

function mapAdvance(row: AdvanceRow): BarberAdvance {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        staffId: row.staff_id,
        amount: Number(row.amount),
        transactionId: row.transaction_id,
        settlementId: row.settlement_id,
        reversedAt: row.reversed_at,
        reversalMotivo: row.reversal_motivo,
        issuedAt: row.issued_at,
        notes: row.notes,
        createdBy: row.created_by,
        createdAt: row.created_at,
    };
}

function mapSettlement(row: SettlementRow): BarberPayoutSettlement {
    return {
        id: row.id,
        tenantId: row.tenant_id,
        staffId: row.staff_id,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        grossCommission: Number(row.gross_commission),
        advancesDeducted: Number(row.advances_deducted),
        bonusesAdded: Number(row.bonuses_added),
        netPayout: Number(row.net_payout),
        status: row.status,
        paidAt: row.paid_at,
        paymentMethod: row.payment_method,
        cancelReason: row.cancel_reason,
        createdAt: row.created_at,
    };
}