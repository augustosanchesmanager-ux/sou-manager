import type { ZeroCloseOrigin } from '../../src/lib/finance/zeroClose';

export type ARSource = 'comanda' | 'clube' | 'recibo';
export type ARStatus = 'pending' | 'overdue' | 'open';

export type SortKey = 'client_az' | 'client_za' | 'amount_asc' | 'amount_desc' | 'date_asc' | 'date_desc';
export type SourceFilter = 'todos' | ARSource;
export type StatusFilter = 'todos' | 'open' | 'pending' | 'overdue' | 'settled' | 'reversed';
export type ViewMode = 'list' | 'grouped';
export type PaymentMethod = 'pix' | 'cash' | 'credit' | 'debit' | 'other';
export type SettlementMode = 'payment' | ZeroCloseOrigin;
export type ReversalStatus = 'none' | 'partial' | 'full';

export interface AREntry {
    id: string;
    source: ARSource;
    clientId?: string | null;
    clientName: string;
    clientPhone?: string | null;
    description: string;
    dateValue: string;
    amount: number;
    status: ARStatus | string;
    originPath: string;
}

export interface ComandaItemDetail {
    id: string;
    serviceId?: string | null;
    productId?: string | null;
    name: string;
    typeLabel: string;
    quantity: number;
    unitPrice: number;
    total: number;
    staffName: string;
    participants: {
        id: string;
        staffName: string;
        payoutType: string;
        payoutValue: number;
        role: string;
    }[];
}

export interface OpenComandaDetail {
    id: string;
    shortId: string;
    clientName: string;
    clientPhone: string | null;
    status: string;
    createdAt: string;
    mainStaffName: string;
    grossSubtotal: number;
    discount: number;
    netTotal: number;
    items: ComandaItemDetail[];
}

export type CancelReasonType = 'duplicate' | 'test' | 'operational_error' | 'client_gave_up' | 'other';

export const CANCEL_REASON_OPTIONS: { value: CancelReasonType; label: string; requiresNote?: boolean }[] = [
    { value: 'duplicate', label: 'Comanda duplicada' },
    { value: 'test', label: 'Lançamento de teste' },
    { value: 'operational_error', label: 'Erro operacional' },
    { value: 'client_gave_up', label: 'Cliente desistiu' },
    { value: 'other', label: 'Outro', requiresNote: true },
];

export type ReversalReason =
    | 'baixa_indevida'
    | 'cobranca_duplicada'
    | 'devolucao_ao_cliente'
    | 'erro_forma_pagamento'
    | 'erro_operacional'
    | 'cancelamento_administrativo'
    | 'cliente_duplicado'
    | 'outro';

export interface ReversalSummary {
    reversalTransactionId: string | null;
    reversalType: string;
    amount: number;
    reasonType: string;
    createdAt: string | null;
}

export interface PaidComandaSettlement {
    id: string;
    tenantId: string | null;
    sourceId: string | null;
    clientName: string;
    clientPhone?: string | null;
    description: string;
    dateValue: string;
    amount: number;
    paymentMethod: PaymentMethod;
    transactionStatus: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: ReversalStatus;
    reversals: ReversalSummary[];
}

export interface ARFilters {
    source: SourceFilter;
    status: StatusFilter;
    dateFrom: string;
    dateTo: string;
    amountMin: string;
    amountMax: string;
    search: string;
    viewMode: ViewMode;
}

export const DEFAULT_AR_FILTERS: ARFilters = {
    source: 'todos',
    status: 'todos',
    dateFrom: '',
    dateTo: '',
    amountMin: '',
    amountMax: '',
    search: '',
    viewMode: 'list',
};

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'client_az', label: 'Cliente A-Z' },
    { key: 'client_za', label: 'Cliente Z-A' },
    { key: 'amount_asc', label: 'Menor valor' },
    { key: 'amount_desc', label: 'Maior valor' },
    { key: 'date_asc', label: 'Data antiga' },
    { key: 'date_desc', label: 'Data recente' },
];

export const SOURCE_FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'comanda', label: 'Comandas' },
    { value: 'clube', label: 'Club dos Chefes' },
    { value: 'recibo', label: 'Recibos' },
];

export const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'open', label: 'Em aberto' },
    { value: 'pending', label: 'Pendente' },
    { value: 'overdue', label: 'Atrasado' },
    { value: 'settled', label: 'Baixada' },
    { value: 'reversed', label: 'Estornada' },
];

export interface AccountsReceivableTotals {
    open: number;
    comandas: { count: number; total: number };
    clube: { count: number; total: number };
    recibos: { count: number; total: number };
}

export const getShortId = (id?: string | null) => (id ? id.slice(0, 8) : 'sem-id');
