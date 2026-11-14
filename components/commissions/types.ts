import type { ParticipantRow as DomainParticipantRow, CommissionBaseChoice as DomainCommissionBaseChoice, ZeroCommissionReason } from '../../domain/commission/types';

export interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string;
    commission_rate: number | null;
    product_commission_rate?: number | null;
}

export type ComandaStatus = 'open' | 'paid' | 'blocked' | 'cancelled';

export interface ComandaRow {
    id: string;
    created_at: string;
    closed_at?: string | null;
    status: ComandaStatus;
    appointment_id?: string | null;
    staff_id?: string | null;
    client_id?: string | null;
    payment_method?: string | null;
    total?: number | null;
    discount?: number | null;
    paid_amount?: number | null;
    amount_paid?: number | null;
    closure_mode?: string | null;
    financial_effect?: boolean | null;
    membership_credit_effect?: boolean | null;
    is_fiado?: boolean | null;
    payment_date_real?: string | null;
}

export interface AppointmentRow {
    id: string;
    start_time?: string | null;
}

export type ParticipantRow = DomainParticipantRow;
export type CommissionBaseChoice = DomainCommissionBaseChoice;

export interface CommissionAuditLine {
    comanda_id: string;
    client_name: string;
    comanda_status: string;
    payment_status: string;
    payment_method: string;
    comanda_total: number;
    comanda_paid_amount: number | '';
    comanda_item_id: string;
    service_id: string;
    service_name: string;
    item_type: string;
    staff_id: string;
    staff_name: string;
    commission_rate_raw: number | '';
    commission_rate_normalized: number;
    quantity: number;
    unit_price: number | '';
    price: number | '';
    amount: number | '';
    total: number | '';
    total_price: number | '';
    line_total: number | '';
    subtotal: number | '';
    discount: number | '';
    final_price: number | '';
    base_value_escolhido: number;
    campo_usado_como_base: string;
    motivo_da_escolha: string;
    credit_applied_detected: string;
    payout_type: string;
    payout_value: number | '';
    payout_value_normalizado: number | '';
    valor_servico: number;
    valor_compartilhado: number;
    base_participante: number;
    commission_rate: number | '';
    commission_rate_normalizado: number;
    participants_count: number;
    participants_staff_ids: string;
    is_shared_real: string;
    commission_value: number;
}

export type ProductionDateSource = 'appointment_start' | 'comanda_closed_at' | 'comanda_created_at';
export type CommissionTypeFilter = 'all' | 'solo' | 'shared';
export type ViewMode = 'production' | 'settlement';

export interface CommissionLine {
    id: string;
    comandaId: string;
    comandaItemId: string;
    createdAt: string;
    clientName: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    itemValue: number;
    professionalId: string;
    professionalName: string;
    professionalRole: string;
    professionalAvatar: string;
    participationRole: string;
    payoutType: string;
    payoutValue: number | null;
    payoutValueNormalized: number | null;
    participationRate: number | null;
    commissionBase: number;
    commissionRate: number;
    commissionValue: number;
    sharedValue: number;
    divisionLaunched: string;
    baseByParticipant: string;
    isShared: boolean;
    participantNames: string;
    comandaStatus: ComandaStatus;
    paymentStatus: string;
    commissionStatus: string;
    isFiado: boolean;
    paymentDateReal: string | null;
    availableForPayout: boolean;
    paymentMethod: string;
    audit: CommissionAuditLine;
    dateSource: ProductionDateSource;
    discountAmount: number;
    zeroReason: ZeroCommissionReason | null;
}

export interface CommissionRow {
    id: string;
    professionalName: string;
    role: string;
    avatar: string;
    commissionRate: number;
    servicesCount: number;
    grossSales: number;
    commissionValue: number;
    confirmedSales: number;
    pendingSales: number;
    cancelledSales: number;
    confirmedCommission: number;
    pendingCommission: number;
    cancelledCommission: number;
    lastServiceDate: string | null;
    items: CommissionLine[];
}
