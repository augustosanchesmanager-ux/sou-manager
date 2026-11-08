/**
 * [SMG][DOMAIN][CASH_LEDGER] types
 *
 * Contratos do módulo unificado de Entrada / Saída, Contas a Pagar,
 * Contas a Receber, Baixa em Lote e Vales de Profissionais.
 * Inspirado nas melhores práticas e telas de referência operacional de barbearia.
 */

export type LedgerEntryType = 'income' | 'expense';
export type LedgerEntryStatus = 'pending' | 'paid' | 'cancelled';
export type LedgerTab = 'all' | 'payable' | 'receivable';
export type ReceivableSubTab = 'all' | 'standard' | 'fiados';

export interface LedgerEntry {
    id: string;
    tenant_id: string;
    type: LedgerEntryType;
    category: string;
    description: string;
    amount: number; // Em reais decimais (ex: 45.00)
    due_date: string; // ISO YYYY-MM-DD
    payment_date: string | null;
    status: LedgerEntryStatus;
    recipient_or_payer: string | null;
    payment_method: string | null;
    source_type?: string | null; // 'comanda' | 'barber_advance' | 'manual' | 'client_debt' | 'recurring_bill'
    source_id?: string | null;
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface LedgerSummary {
    totalIncomePeriod: number;
    totalExpensePeriod: number;
    netPeriod: number;
    totalPayablePeriod: number;
    totalPayableAll: number;
    totalReceivablePeriod: number;
    totalReceivableAll: number;
    totalFiadosDebt: number;
}

export interface BatchSettleInput {
    tenantId: string;
    entryIds: string[];
    paymentMethod: string;
    paymentDate: string; // YYYY-MM-DD
    notes?: string;
}

export interface BatchSettleResult {
    success: boolean;
    settledCount: number;
    totalSettledAmount: number;
    failedIds: string[];
    message: string;
}

export interface CreateValeInput {
    tenantId: string;
    staffId: string;
    staffName: string;
    amount: number;
    paymentMethod: string;
    notes?: string;
    issuedAt?: string; // YYYY-MM-DD
}

export interface CreateValeResult {
    success: boolean;
    advanceId: string;
    transactionId: string | null;
    amount: number;
    message: string;
}

export interface FiadoReceivableSummary {
    id: string;
    client_name: string;
    phone: string;
    balance: number; // Saldo (negativo = débito)
    debt_amount: number; // Valor absoluto da dívida
    credit_limit: number;
    last_movement: string;
}
