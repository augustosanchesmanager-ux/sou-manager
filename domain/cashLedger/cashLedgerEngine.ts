/**
 * [SMG][DOMAIN][CASH_LEDGER] cashLedgerEngine
 *
 * Motor puro de cálculos e regras de negócio para a Central Financeira Unificada.
 * Isento de dependências de banco de dados, React e efeitos colaterais.
 */

import type {
    LedgerEntry,
    LedgerSummary,
    LedgerTab,
    ReceivableSubTab,
    FiadoReceivableSummary,
} from './types';

export function roundToCurrency(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function isDateInRange(dateStr: string, startDate?: string, endDate?: string): boolean {
    if (!dateStr) return false;
    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    if (startDate && cleanDate < startDate) return false;
    if (endDate && cleanDate > endDate) return false;
    return true;
}

/**
 * Calcula os resumos e KPIs do livro razão financeiro.
 * - Saldo a pagar no período vs. Saldo total a pagar (acumulado).
 * - Saldo a receber no período vs. Saldo total a receber (acumulado).
 * - Total de fiados (débitos de clientes na carteira).
 */
export function calculateLedgerSummary(
    entries: LedgerEntry[],
    periodStart: string,
    periodEnd: string,
    fiadosList: FiadoReceivableSummary[] = []
): LedgerSummary {
    let totalIncomePeriod = 0;
    let totalExpensePeriod = 0;
    let totalPayablePeriod = 0;
    let totalPayableAll = 0;
    let totalReceivablePeriod = 0;
    let totalReceivableAll = 0;

    for (const entry of entries) {
        if (entry.status === 'cancelled') continue;

        const effectiveDate = entry.payment_date || entry.due_date;
        const inPeriod = isDateInRange(effectiveDate, periodStart, periodEnd);
        const amount = Number(entry.amount) || 0;

        // Entradas e saídas efetivadas no período
        if (entry.status === 'paid' && inPeriod) {
            if (entry.type === 'income') {
                totalIncomePeriod += amount;
            } else if (entry.type === 'expense') {
                totalExpensePeriod += amount;
            }
        }

        // Contas a Pagar (despesas pendentes)
        if (entry.type === 'expense' && entry.status === 'pending') {
            totalPayableAll += amount;
            if (isDateInRange(entry.due_date, periodStart, periodEnd)) {
                totalPayablePeriod += amount;
            }
        }

        // Contas a Receber (receitas pendentes)
        if (entry.type === 'income' && entry.status === 'pending') {
            totalReceivableAll += amount;
            if (isDateInRange(entry.due_date, periodStart, periodEnd)) {
                totalReceivablePeriod += amount;
            }
        }
    }

    // Total de fiados a receber (soma das dívidas ativas dos clientes)
    const totalFiadosDebt = fiadosList.reduce((acc, f) => acc + (f.debt_amount || 0), 0);

    return {
        totalIncomePeriod: roundToCurrency(totalIncomePeriod),
        totalExpensePeriod: roundToCurrency(totalExpensePeriod),
        netPeriod: roundToCurrency(totalIncomePeriod - totalExpensePeriod),
        totalPayablePeriod: roundToCurrency(totalPayablePeriod),
        totalPayableAll: roundToCurrency(totalPayableAll),
        totalReceivablePeriod: roundToCurrency(totalReceivablePeriod),
        totalReceivableAll: roundToCurrency(totalReceivableAll),
        totalFiadosDebt: roundToCurrency(totalFiadosDebt),
    };
}

/**
 * Filtra as entradas do livro razão com base na aba ativa, sub-abas e filtros de pesquisa.
 */
export function filterLedgerEntries(
    entries: LedgerEntry[],
    filters: {
        tab: LedgerTab;
        receivableSubTab?: ReceivableSubTab;
        startDate?: string;
        endDate?: string;
        search?: string;
        status?: 'all' | 'pending' | 'paid';
    }
): LedgerEntry[] {
    const { tab, startDate, endDate, search, status } = filters;
    const cleanSearch = (search || '').trim().toLowerCase();

    return entries.filter((entry) => {
        if (entry.status === 'cancelled') return false;

        // 1. Filtro por Aba Principal
        if (tab === 'payable' && entry.type !== 'expense') return false;
        if (tab === 'receivable' && entry.type !== 'income') return false;

        // 2. Filtro por Status
        if (status && status !== 'all' && entry.status !== status) {
            return false;
        }

        // 3. Filtro por Período
        const dateToCheck = (tab === 'payable' || tab === 'receivable')
            ? entry.due_date
            : (entry.payment_date || entry.due_date);

        if (startDate || endDate) {
            if (!isDateInRange(dateToCheck, startDate, endDate)) {
                return false;
            }
        }

        // 4. Filtro por Busca Textual
        if (cleanSearch) {
            const descMatch = (entry.description || '').toLowerCase().includes(cleanSearch);
            const catMatch = (entry.category || '').toLowerCase().includes(cleanSearch);
            const recMatch = (entry.recipient_or_payer || '').toLowerCase().includes(cleanSearch);
            const notesMatch = (entry.notes || '').toLowerCase().includes(cleanSearch);

            if (!descMatch && !catMatch && !recMatch && !notesMatch) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Validação prévia de baixa em lote.
 */
export function validateBatchSettle(entryIds: string[], paymentMethod: string): { valid: boolean; error?: string } {
    if (!entryIds || entryIds.length === 0) {
        return { valid: false, error: 'Nenhum lançamento foi selecionado para baixa.' };
    }
    if (!paymentMethod || paymentMethod.trim() === '') {
        return { valid: false, error: 'Selecione a forma de pagamento para a baixa.' };
    }
    return { valid: true };
}

/**
 * Validação prévia de lançamento de vale para profissional.
 */
export function validateCreateVale(staffId: string, amount: number): { valid: boolean; error?: string } {
    if (!staffId || staffId.trim() === '') {
        return { valid: false, error: 'Selecione o profissional que receberá o vale.' };
    }
    if (!amount || amount <= 0) {
        return { valid: false, error: 'O valor do vale deve ser maior que zero.' };
    }
    return { valid: true };
}
