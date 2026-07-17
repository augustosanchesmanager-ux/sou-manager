import type { EnrichedCashFlowEntry } from './types';

export interface CashCloseFilters {
    operatorId: string | null;
    showOnlyOpenComandas: boolean;
    onlyClubMembers: boolean;
}

export interface SangriaSuprimento {
    id: string;
    type: 'sangria' | 'suprimento';
    value: number;
    description: string;
    createdAt: string;
}

export interface PaymentMethodRow {
    method: string;
    launched: number;
    expected: number;
}

export interface CashCloseValidation {
    totalExpected: number;
    totalReceived: number;
    difference: number;
    isValid: boolean;
}

export interface CashClosingEntryExtended extends EnrichedCashFlowEntry {
    sourceType: string | null;
    sourceId: string | null;
    isReversalTransaction: boolean;
    reversalSource: {
        originalTransactionId: string | null;
        reversalType: string;
        reasonType: string;
        amount: number;
        createdAt: string | null;
    } | null;
    operatorId?: string | null;
    comandaStatus?: string | null;
    isClubMember?: boolean;
}

export const formatCurrency = (value: number): string =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const generateId = (): string =>
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const validateCashClose = (
    totalExpected: number,
    totalReceived: number,
): CashCloseValidation => {
    const difference = totalReceived - totalExpected;
    const isValid = Math.abs(difference) <= 0.01;
    return { totalExpected, totalReceived, difference, isValid };
};

export const buildPaymentMethodRows = (
    entries: CashClosingEntryExtended[],
    extras: SangriaSuprimento[],
): PaymentMethodRow[] => {
    const incomeByMethod: Record<string, number> = {};
    entries
        .filter(e => e.type === 'entrada')
        .forEach(e => {
            const method = e.paymentMethod || 'Nao informado';
            incomeByMethod[method] = (incomeByMethod[method] || 0) + e.value;
        });

    const extraAdjustments = extras.reduce((acc, ext) => {
        if (ext.type === 'suprimento') acc['Suprimento'] = (acc['Suprimento'] || 0) + ext.value;
        if (ext.type === 'sangria') acc['Sangria'] = (acc['Sangria'] || 0) + ext.value;
        return acc;
    }, {} as Record<string, number>);

    const allMethods = new Set([...Object.keys(incomeByMethod), ...Object.keys(extraAdjustments)]);

    return Array.from(allMethods)
        .filter(m => m !== 'Suprimento' && m !== 'Sangria')
        .map(method => ({
            method,
            launched: incomeByMethod[method] || 0,
            expected: incomeByMethod[method] || 0,
        }));
};

export const filterEntries = (
    entries: CashClosingEntryExtended[],
    filters: CashCloseFilters,
    openComandaIds: Set<string>,
): CashClosingEntryExtended[] => {
    let filtered = [...entries];

    if (filters.operatorId) {
        filtered = filtered.filter(e => e.operatorId === filters.operatorId);
    }

    if (filters.showOnlyOpenComandas) {
        filtered = filtered.filter(e => {
            if (e.sourceType === 'comanda' && e.sourceId) {
                return openComandaIds.has(e.sourceId);
            }
            return true;
        });
    }

    if (filters.onlyClubMembers) {
        filtered = filtered.filter(e => e.isClubMember === true);
    }

    return filtered;
};

export const generateCSVContent = (
    date: string,
    filters: CashCloseFilters,
    validation: CashCloseValidation,
    extras: SangriaSuprimento[],
    paymentRows: PaymentMethodRow[],
    observations: string,
    operatorName: string,
    agendaSummary?: Record<string, { count: number; total: number }>,
): string => {
    const lines: string[] = [
        'Campo,Valor',
        `Data,${date}`,
        `Operador,${operatorName || 'Todos'}`,
        `Filtro Comandas Abertas,${filters.showOnlyOpenComandas ? 'Sim' : 'Nao'}`,
        `Filtro Somente Clube do Chefe,${filters.onlyClubMembers ? 'Sim' : 'Nao'}`,
        '',
        '--- Resumo ---',
        `Total Esperado,${formatCurrency(validation.totalExpected)}`,
        `Total Recebido,${formatCurrency(validation.totalReceived)}`,
        `Diferenca,${formatCurrency(validation.difference)}`,
        `Status,${validation.isValid ? 'Conferido' : 'Divergente'}`,
        '',
        '--- Por Forma de Pagamento ---',
        'Forma,Valor Lançado,Valor Esperado,Diferenca',
    ];

    paymentRows.forEach(r => {
        lines.push(`${r.method},${formatCurrency(r.launched)},${formatCurrency(r.expected)},${formatCurrency(r.launched - r.expected)}`);
    });

    if (extras.length > 0) {
        lines.push('', '--- Sangrias e Suprimentos ---', 'Tipo,Valor,Descricao,Data/Hora');
        extras.forEach(ext => {
            lines.push(
                `${ext.type === 'sangria' ? 'Sangria' : 'Suprimento'},${formatCurrency(ext.value)},"${ext.description || '-'}",${new Date(ext.createdAt).toLocaleString('pt-BR')}`
            );
        });
    }

    if (agendaSummary) {
        lines.push('', '--- Agenda do Dia ---', 'Status,Quantidade,Total');
        Object.entries(agendaSummary).forEach(([key, val]) => {
            lines.push(`${key},${val.count},${formatCurrency(val.total)}`);
        });
    }

    if (observations.trim()) {
        lines.push('', '--- Observacoes ---', `"${observations.replace(/"/g, '""')}"`);
    }

    lines.push('', `Gerado em,${new Date().toLocaleString('pt-BR')}`);

    return lines.join('\n');
};

export const downloadCSV = (content: string, filename: string) => {
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const generatePreviewText = (
    date: string,
    validation: CashCloseValidation,
    extras: SangriaSuprimento[],
    paymentRows: PaymentMethodRow[],
    observations: string,
    userName: string,
    agendaSummary?: Record<string, { count: number; total: number }>,
): string => {
    const lines: string[] = [
        '═══════════════════════════════════════',
        '       COMPROVANTE DE FECHAMENTO       ',
        '═══════════════════════════════════════',
        '',
        `Data: ${date}`,
        `Responsavel: ${userName || 'Nao informado'}`,
        `Hora: ${new Date().toLocaleString('pt-BR')}`,
        '',
        '───────────────────────────────────────',
        '               RESUMO                  ',
        '───────────────────────────────────────',
        `Total Esperado:  ${formatCurrency(validation.totalExpected)}`,
        `Total Recebido:  ${formatCurrency(validation.totalReceived)}`,
        `Diferenca:       ${formatCurrency(validation.difference)}`,
        `Situacao:        ${validation.isValid ? 'CONFERIDO' : 'DIVERGENTE'}`,
        '',
        '───────────────────────────────────────',
        '       POR FORMA DE PAGAMENTO          ',
        '───────────────────────────────────────',
    ];

    paymentRows.forEach(r => {
        lines.push(
            `  ${r.method.padEnd(20)} ${formatCurrency(r.launched).padStart(14)}`
        );
    });

    if (extras.length > 0) {
        lines.push(
            '',
            '───────────────────────────────────────',
            '       SANGRIAS E SUPRIMENTOS          ',
            '───────────────────────────────────────',
        );
        extras.forEach(ext => {
            const label = ext.type === 'sangria' ? 'Sangria' : 'Suprimento';
            lines.push(
                `  ${label.padEnd(14)} ${formatCurrency(ext.value).padStart(14)}  ${ext.description || ''}`
            );
        });
    }

    if (agendaSummary) {
        lines.push(
            '',
            '───────────────────────────────────────',
            '            AGENDA DO DIA              ',
            '───────────────────────────────────────',
        );
        Object.entries(agendaSummary).forEach(([key, val]) => {
            lines.push(`  ${key.padEnd(20)} ${String(val.count).padStart(4)}  ${formatCurrency(val.total)}`);
        });
    }

    if (observations.trim()) {
        lines.push(
            '',
            '───────────────────────────────────────',
            '            OBSERVACOES                ',
            '───────────────────────────────────────',
            `  ${observations}`,
        );
    }

    lines.push(
        '',
        '═══════════════════════════════════════',
        `  Assinatura: ${userName || 'Nao informado'}`,
        `  Data/Hora:  ${new Date().toLocaleString('pt-BR')}`,
        '═══════════════════════════════════════',
    );

    return lines.join('\n');
};
