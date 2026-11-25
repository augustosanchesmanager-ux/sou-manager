import { normalizePercentage } from '../../shared/numbers/normalize';
import { isSharedExecution as domainIsSharedExecution } from '../../domain/commission/participants';
import { formatParticipantPayout as domainFormatParticipantPayout } from '../../domain/commission/format';
import type { ParticipantRow } from '../../domain/commission/types';

export type ExecutionRole = 'primary' | 'assistant' | 'co_executor';
export type PayoutType = 'percentage' | 'fixed';
export type ClosureMode = 'standard' | 'legacy_membership';

export interface CartParticipant {
    id: string;
    professional_id: string;
    professional_name?: string;
    role: ExecutionRole;
    payout_type: PayoutType;
    payout_value: number;
    affects_revenue: boolean;
    affects_commission: boolean;
}

export interface CartItem {
    id: string;
    dbId?: string;
    type: 'service' | 'product';
    name: string;
    internal_name?: string;
    display_name?: string;
    description?: string;
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
    usedCredit?: boolean;
    execution_participants?: CartParticipant[];
}

export interface PendingCreditItem {
    item: any;
    type: 'service' | 'product';
    finalPrice: number;
}

export interface Client {
    id: string;
    name: string;
    avatar: string;
    phone?: string;
}

export interface QuickOpenComanda {
    id: string;
    client_id?: string | null;
    created_at: string;
    status: string;
    total?: number | string | null;
    clients?: { name?: string | null; phone?: string | null } | { name?: string | null; phone?: string | null }[] | null;
}

export interface Promotion {
    id: string;
    title: string;
    target_type: 'service' | 'product' | 'all';
    target_id: string | null;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
    start_date: string;
    end_date: string;
    active: boolean;
}

export interface Staff {
    id: string;
    name: string;
    role?: string | null;
    commission_rate?: number | string | null;
}

export interface QuickProductForm {
    name: string;
    commercial_name: string;
    description: string;
    cost_price: string;
    sale_price: string;
    stock_quantity: string;
    minimum_stock: string;
    auto_generate_purchase_order: boolean;
}

export interface QuickServiceForm {
    name: string;
    commercial_name: string;
    description: string;
    category: string;
    price: string;
    duration: string;
    active: boolean;
}

export interface CheckoutLocationState {
    fromAppointment?: boolean;
    appointmentId?: string;
    clientId?: string;
    clientName?: string;
    serviceName?: string;
    staffId?: string;
    price?: number;
}

export type CheckoutEntryMode = 'edit_comanda' | 'open_comanda' | 'pdv';

export const generateIdempotencyKey = (prefix = 'req') => {
    const randomPart = (typeof window !== 'undefined' && window.crypto?.randomUUID?.())
        || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${randomPart}`;
};

export const createInitialQuickProductForm = (): QuickProductForm => ({
    name: '',
    commercial_name: '',
    description: '',
    cost_price: '0',
    sale_price: '0',
    stock_quantity: '0',
    minimum_stock: '0',
    auto_generate_purchase_order: false,
});

export const createInitialQuickServiceForm = (serviceName = ''): QuickServiceForm => ({
    name: serviceName,
    commercial_name: '',
    description: '',
    category: 'Cabelo',
    price: '0',
    duration: '30',
    active: true,
});

export const toMonthInputValue = (value?: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

export const normalizePercentageValue = normalizePercentage;

export const formatPayoutValue = (participant: Pick<CartParticipant, 'payout_type' | 'payout_value'>) => {
    return domainFormatParticipantPayout(participant as ParticipantRow, '');
};

export const isSharedExecution = (item: Pick<CartItem, 'staff_id' | 'execution_participants'>) => {
    const participants = (item.execution_participants || []) as unknown as ParticipantRow[];
    return domainIsSharedExecution(
        { service_id: undefined },
        participants.filter((p) => p.affects_commission),
    );
};

export const getParticipantStaffId = (participant: { staff_id?: string | null; professional_id?: string | null } | null | undefined) =>
    participant?.staff_id || participant?.professional_id || '';

export const getDirectSettlementBlockMessage = (orderLabelLower: string, isMasculineOrder: boolean) =>
    `${isMasculineOrder ? 'Este' : 'Esta'} ${orderLabelLower} pertence a um atendimento anterior ou foi ${isMasculineOrder ? 'cadastrado' : 'cadastrada'} fora da data do agendamento. Para proteger o caixa e os relatórios, a baixa deve ser feita pelo financeiro.`;

export const getQuickComandaClient = (comanda: QuickOpenComanda) => {
    const client = Array.isArray(comanda.clients) ? comanda.clients[0] : comanda.clients;
    return {
        name: client?.name || 'Cliente não identificado',
        phone: client?.phone || null,
    };
};

export const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const isBeforeTodayLocal = (value?: string | null) => {
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return startOfLocalDay(parsed).getTime() < startOfLocalDay(new Date()).getTime();
};

export const isCreatedAfterAppointmentDay = (createdAt?: string | null, appointmentStartTime?: string | null) => {
    if (!createdAt || !appointmentStartTime) return false;
    const created = new Date(createdAt);
    const appointment = new Date(appointmentStartTime);
    if (Number.isNaN(created.getTime()) || Number.isNaN(appointment.getTime())) return false;
    return startOfLocalDay(created).getTime() > startOfLocalDay(appointment).getTime();
};

export const serviceCategories = ['Cabelo', 'Barba', 'Combo', 'Quimica', 'Acabamento', 'Outros'];
export const esteticaServiceCategoryDisplay: Record<string, string> = {
    Cabelo: 'Facial',
    Barba: 'Sobrancelhas',
    Combo: 'Protocolos',
    Quimica: 'Peelings',
    Acabamento: 'Finalização',
    Outros: 'Outros',
};

export const getServiceCategoryDisplay = (category: string, isEsteticaApp: boolean) =>
    isEsteticaApp ? esteticaServiceCategoryDisplay[category] || category : category;
