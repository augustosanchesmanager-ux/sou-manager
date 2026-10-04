/**
 * [SMG][DOMAIN][PAYOUT] types
 *
 * Contratos do bounded context de repasse (ADR-030).
 *
 * IDENTIDADE: o profissional é `staff_id` (public.staff), nunca
 * `profiles.id`. `profiles.id` é identidade de login (auth.users) e não
 * tem vínculo direto com `staff` — usá-la quebraria o cruzamento com as
 * comissões apuradas, que ancoram em `comandas.staff_id`.
 */

export type PayoutFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export type SettlementStatus = 'draft' | 'approved' | 'paid' | 'cancelled';

export interface BarberPayoutConfig {
    id: string;
    tenantId: string;
    staffId: string;
    frequency: PayoutFrequency;
    /** ISO 8601: 1 = Segunda ... 7 = Domingo. Exigido para weekly e biweekly. */
    payoutWeekday: number | null;
    /** Exigido para monthly. Clamp em meses curtos: MIN(dia, último dia do mês). */
    payoutMonthDay: number | null;
    allowAdvances: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface BarberAdvance {
    id: string;
    tenantId: string;
    staffId: string;
    amount: number;
    transactionId: string | null;
    settlementId: string | null;
    reversedAt: string | null;
    reversalMotivo: string | null;
    issuedAt: string;
    notes: string | null;
    createdBy: string;
    createdAt: string;
}

/**
 * Estado do vale é DERIVADO no banco (append-only, sem coluna status):
 *   pendente  = settlementId === null && reversedAt === null
 *   liquidado = settlementId !== null && reversedAt === null
 *   estornado = reversedAt !== null
 */
export type AdvanceState = 'pending' | 'settled' | 'reversed';

export function deriveAdvanceState(advance: Pick<BarberAdvance, 'settlementId' | 'reversedAt'>): AdvanceState {
    if (advance.reversedAt !== null) return 'reversed';
    if (advance.settlementId !== null) return 'settled';
    return 'pending';
}

export interface BarberPayoutSettlement {
    id: string;
    tenantId: string;
    staffId: string;
    periodStart: string;
    periodEnd: string;
    grossCommission: number;
    advancesDeducted: number;
    bonusesAdded: number;
    netPayout: number;
    status: SettlementStatus;
    paidAt: string | null;
    paymentMethod: string | null;
    /** Preenchido pela RPC `cancel_payout_settlement` ao cancelar. */
    cancelReason: string | null;
    createdAt: string;
}

export interface CancelSettlementResult {
    success: boolean;
    /** Vales efetivamente devolvidos a `pending`. */
    unlinkedAdvances: number;
    /** Verdadeiro quando o acerto já estava cancelado (retentativa). */
    idempotent: boolean;
    message: string;
}

export interface CreateSettlementDraftInput {
    tenantId: string;
    staffId: string;
    periodStart: string;
    periodEnd: string;
    grossCommission: number;
    advancesDeducted: number;
    bonusesAdded: number;
}

export interface RegisterAdvanceInput {
    tenantId: string;
    staffId: string;
    amount: number;
    paymentMethod?: string | null;
    notes?: string | null;
    idempotencyKey?: string | null;
}

export interface AdvanceRegistrationResult {
    success: boolean;
    idempotent: boolean;
    advanceId: string;
    transactionId: string | null;
    amount: number;
    message: string;
}

/**
 * Parcelas de comissão apuradas para um profissional no período, derivadas
 * de `comanda_payments` em regime de caixa puro (ADR-030 Decisão C).
 */
export interface SettlementComputation {
    grossCommission: number;
    advancesDeducted: number;
    bonusesAdded: number;
    netPayout: number;
    /** Pagamentos não estornados que compuseram a base. */
    paymentCount: number;
    /**
     * SOMENTE estes vales podem ser vinculados à liquidação. Um vale listado
     * aqui teve seu valor efetivamente deduzido do repasse.
     */
    consumedAdvanceIds: string[];
    /** Vales que seguem pendentes para o próximo ciclo. */
    remainingAdvanceIds: string[];
}