export type AuditAdjustmentSourceType =
    | 'comanda'
    | 'commission'
    | 'accounts_receivable'
    | 'cashflow'
    | 'receipt'
    | 'cash_closing'
    | 'chef_club';

export type AuditAdjustmentType =
    | 'commission_correction'
    | 'service_participation_correction'
    | 'payment_date_correction'
    | 'payment_method_correction'
    | 'settlement_reversal'
    | 'wrong_charge_cancellation'
    | 'duplicate_client_mark'
    | 'transaction_reclassification'
    | 'hide_from_financial_with_reason'
    | 'cash_difference_correction'
    | 'receipt_review'
    | 'chef_club_charge_review'
    | 'mark_for_review';

export type AuditAdjustmentReasonType =
    | 'operational_error'
    | 'wrong_settlement'
    | 'duplicate_charge'
    | 'duplicate_client'
    | 'wrong_payment_method'
    | 'wrong_payment_date'
    | 'wrong_commission_or_participation'
    | 'administrative_adjustment'
    | 'cash_difference'
    | 'other';

export type AuditAdjustmentAccessRole =
    | 'owner'
    | 'admin'
    | 'manager'
    | 'superadmin'
    | 'barber'
    | 'receptionist'
    | 'unknown'
    | string;

export interface AuditAdjustmentContext {
    tenantId?: string | null;
    sourceType: AuditAdjustmentSourceType;
    sourceId?: string | null;
    sourceLabel: string;
    beforeSnapshot?: Record<string, unknown> | null;
    proposedAfterSnapshot?: Record<string, unknown> | null;
    financialImpactLabel?: string;
    allowedAdjustmentTypes?: AuditAdjustmentType[];
}

export interface AuditAdjustmentDraft {
    context: AuditAdjustmentContext;
    adjustmentType: AuditAdjustmentType;
    reasonType: AuditAdjustmentReasonType;
    reasonNote: string;
    requestedAt: string;
    requestedByUserId?: string | null;
}

export const AUDIT_ADJUSTMENT_RPC_NOTICE =
    'A aplicação financeira definitiva dependerá de validação e processamento auditado em uma RPC transacional futura.';

export const AUDIT_ADJUSTMENT_PHASE_NOTICE =
    'Esta ação prepara uma solicitação de correção auditada. Nesta etapa, nenhum dado financeiro será alterado diretamente.';

export const AUDIT_ADJUSTMENT_TYPE_LABELS: Record<AuditAdjustmentType, string> = {
    commission_correction: 'Corrigir comissão',
    service_participation_correction: 'Corrigir participação de serviço',
    payment_date_correction: 'Corrigir data real de pagamento',
    payment_method_correction: 'Corrigir forma de pagamento',
    settlement_reversal: 'Estornar baixa',
    wrong_charge_cancellation: 'Cancelar cobrança indevida',
    duplicate_client_mark: 'Marcar cliente duplicado',
    transaction_reclassification: 'Reclassificar lançamento',
    hide_from_financial_with_reason: 'Ocultar do financeiro com motivo',
    cash_difference_correction: 'Corrigir divergência de caixa',
    receipt_review: 'Revisar recibo',
    chef_club_charge_review: 'Revisar cobrança do Clube',
    mark_for_review: 'Marcar item para revisão',
};

export const AUDIT_ADJUSTMENT_REASON_LABELS: Record<AuditAdjustmentReasonType, string> = {
    operational_error: 'Erro operacional',
    wrong_settlement: 'Baixa indevida',
    duplicate_charge: 'Cobrança duplicada',
    duplicate_client: 'Cliente duplicado',
    wrong_payment_method: 'Forma de pagamento incorreta',
    wrong_payment_date: 'Data de pagamento incorreta',
    wrong_commission_or_participation: 'Participação/comissão incorreta',
    administrative_adjustment: 'Dados legados inconsistentes',
    cash_difference: 'Divergência de caixa',
    other: 'Outro',
};

export const DEFAULT_AUDIT_ADJUSTMENT_TYPES: AuditAdjustmentType[] = [
    'mark_for_review',
    'commission_correction',
    'service_participation_correction',
    'payment_date_correction',
    'payment_method_correction',
    'settlement_reversal',
    'wrong_charge_cancellation',
    'duplicate_client_mark',
    'transaction_reclassification',
    'hide_from_financial_with_reason',
    'cash_difference_correction',
    'receipt_review',
];

export const canRequestAuditAdjustment = (
    accessRole?: AuditAdjustmentAccessRole | null,
    canAccessSuperAdmin?: boolean,
) => {
    if (canAccessSuperAdmin || accessRole === 'superadmin') return true;
    return accessRole === 'owner' || accessRole === 'admin' || accessRole === 'manager';
};
