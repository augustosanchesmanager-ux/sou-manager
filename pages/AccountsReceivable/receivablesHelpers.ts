import type { OutboxEnqueueData } from '../../src/lib/finance/settlement';
import type {
    AREntry,
    ARSource,
    PaidComandaSettlement,
    PaymentMethod,
    ReversalStatus,
} from './index';

export interface ComandaRecord {
    id: string;
    client_id?: string | null;
    appointment_id?: string | null;
    status: string;
    total: number;
    discount?: number | null;
    created_at: string;
    staff_id?: string | null;
    payment_method?: string | null;
    clients?: { name: string; phone?: string | null } | { name: string; phone?: string | null }[] | null;
    appointments?: { start_time: string } | { start_time: string }[] | null;
}

export const getAppointmentStartTime = (appointments: ComandaRecord['appointments']): string | null => {
    if (!appointments) return null;
    if (Array.isArray(appointments)) {
        return appointments[0]?.start_time || null;
    }
    return appointments.start_time || null;
};

export interface ClientLookupRecord {
    id: string;
    name?: string | null;
    phone?: string | null;
}

export interface ComandaItemRecord {
    id: string;
    comanda_id: string;
    service_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    quantity?: number | string | null;
    unit_price?: number | string | null;
    staff_id?: string | null;
}

export interface ExecutionParticipantRecord {
    id: string;
    comanda_item_id: string;
    staff_id?: string | null;
    role?: string | null;
    payout_type?: string | null;
    payout_value?: number | string | null;
}

export interface ClubReceivableRecord {
    id: string;
    customer_id: string;
    subscription_id: string;
    plan_id: string;
    due_date: string;
    amount: number;
    status: string;
    transaction_id: string | null;
}

export interface ReceiptRecord {
    id: string;
    number: string;
    date: string;
    type: string;
    name: string;
    amount: number;
    paymentMethod: string;
    status: string;
}

export type ActiveTab = 'fiado' | 'creditos' | 'todos' | 'comandas' | 'clube' | 'recibos' | 'historico';

export interface ARListEntry extends AREntry {
    listId: string;
    reference: string;
    receivable?: AREntry;
    settlement?: PaidComandaSettlement;
    actionKind: 'settle' | 'reverse' | 'none';
    reversalStatus?: ReversalStatus;
}

export const CLIENT_FALLBACK_LABEL = 'Cliente não identificado';

export const SOURCE_LABELS: Record<ARSource, string> = {
    comanda: 'Comanda',
    clube: 'Club dos Chefes',
    recibo: 'Recibo',
};

export const EMPTY_STATE_COPY: Record<ActiveTab, { title: string; description: string }> = {
    fiado: {
        title: 'Nenhum fiado pendente',
        description: 'Não há clientes devedores ou comandas em fiado em aberto no momento.',
    },
    creditos: {
        title: 'Nenhum crédito positivo em carteira',
        description: 'Clientes com saldo pré-pago ou limite de crédito aparecerão nesta aba (separados dos devedores de fiado).',
    },
    todos: {
        title: 'Nenhuma conta a receber pendente',
        description: 'Não há comandas abertas, recebíveis do Clube ou recibos pendentes neste período.',
    },
    comandas: {
        title: 'Nenhuma comanda aberta',
        description: 'As comandas em aberto deste período aparecerão aqui para baixa financeira.',
    },
    clube: {
        title: 'Nenhum recebível do Clube pendente',
        description: 'Cobranças pendentes ou atrasadas do Club dos Chefes aparecerão nesta aba.',
    },
    recibos: {
        title: 'Nenhum recibo pendente',
        description: 'Recibos pendentes de pagamento aparecerão aqui quando existirem.',
    },
    historico: {
        title: 'Nenhum histórico de baixa',
        description: 'Não há baixas de comanda ou estornos registrados neste período.',
    },
};

export interface FinancialReversalRecord {
    original_transaction_id: string | null;
    reversal_transaction_id?: string | null;
    reversal_type?: string | null;
    amount: number | string | null;
    reason_type?: string | null;
    created_at?: string | null;
}

export const toDateTimeInputValue = (date: Date) => {
    const offsetMs = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

export const createSettlementKey = (comandaId: string) => {
    const randomId = (typeof window !== 'undefined' && window.crypto?.randomUUID?.())
        || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `finance-settle-${comandaId}-${randomId}`;
};

export const createFiadoOutboxData = (
    tenantId: string,
    comandaId: string,
    clientId: string | null | undefined,
    staffId: string | null | undefined,
    paidAmount: number,
    paymentMethod: string,
    origin: string,
): OutboxEnqueueData => {
    const eventId = `evt_fiado_settle_${comandaId}_${Date.now()}`;
    return {
        eventId,
        eventType: 'CheckoutCompleted',
        payload: {
            operationType: 'create_commission_record',
            operationData: {
                tenantId,
                comandaId,
                clientId: clientId || null,
                staffId: staffId || null,
                receivedValue: paidAmount,
                paymentMethod,
                hasClubCredit: false,
            },
            sourceEvent: 'CheckoutCompleted',
            idempotencyKey: `${eventId}_create_commission_record`,
        },
        metadata: {
            tenantId,
            source: 'accounts_receivable',
            origin,
        },
        targets: [{ provider: 'finance', config: {} }],
    };
};

export const normalizePaymentMethod = (value?: string | null): PaymentMethod => {
    const normalized = String(value || '').trim().toLowerCase();

    if (['pix', 'cash', 'credit', 'debit', 'other'].includes(normalized)) {
        return normalized as PaymentMethod;
    }
    if (normalized.includes('dinheiro') || normalized.includes('cash')) return 'cash';
    if (normalized.includes('credito') || normalized.includes('credit') || normalized.includes('cartao')) return 'credit';
    if (normalized.includes('debito') || normalized.includes('debit')) return 'debit';
    if (normalized.includes('pix')) return 'pix';

    return 'pix';
};

export const getClientData = (clients?: ComandaRecord['clients']) => {
    const client = Array.isArray(clients) ? clients[0] : clients;
    return {
        name: client?.name || CLIENT_FALLBACK_LABEL,
        phone: client?.phone || null,
    };
};

export const extractClientNameFromTransactionDescription = (description?: string | null) => {
    const rawDescription = String(description || '').trim();
    const clientMatch = rawDescription.match(/Cliente:\s*([^()\n|]+)/i);
    const clientName = clientMatch?.[1]?.trim();
    return clientName || CLIENT_FALLBACK_LABEL;
};
