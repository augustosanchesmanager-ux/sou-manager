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

export interface ComandaDetail {
    comandaId: string;
    clientId: string | null;
    clientName: string;
    staffId: string | null;
    staffName: string;
    paymentMethod: string | null;
    total: number;
    status: string;
    items: ComandaItemDetail[];
}

export interface ComandaItemDetail {
    id: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    staffId: string | null;
    staffName: string;
}

export interface BarberSummary {
    staffId: string;
    staffName: string;
    role: string;
    totalReceived: number;
    comandaCount: number;
    comandas: ComandaDetail[];
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
    barberStaffId?: string | null;
    barberName?: string | null;
    comandaStatus?: string | null;
    isClubMember?: boolean;
    clientName?: string;
    comandaItems?: string;
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

    const allMethods = new Set(Object.keys(incomeByMethod));

    return Array.from(allMethods).map(method => ({
        method,
        launched: incomeByMethod[method] || 0,
        expected: incomeByMethod[method] || 0,
    }));
};

export const buildBarberSummaries = (
    comandas: ComandaDetail[],
    staffMap: Record<string, { name: string; role: string }>,
): BarberSummary[] => {
    const byBarber = new Map<string, BarberSummary>();

    comandas.forEach(cmd => {
        const staffId = cmd.staffId || 'sem-profissional';
        if (!byBarber.has(staffId)) {
            const info = staffMap[staffId];
            byBarber.set(staffId, {
                staffId,
                staffName: info?.name || (staffId === 'sem-profissional' ? 'Sem profissional' : 'Desconhecido'),
                role: info?.role || '',
                totalReceived: 0,
                comandaCount: 0,
                comandas: [],
            });
        }
        const summary = byBarber.get(staffId)!;
        summary.totalReceived += cmd.total;
        summary.comandaCount += 1;
        summary.comandas.push(cmd);
    });

    return Array.from(byBarber.values()).sort((a, b) => b.totalReceived - a.totalReceived);
};

export const filterEntries = (
    entries: CashClosingEntryExtended[],
    filters: CashCloseFilters,
    openComandaIds: Set<string>,
): CashClosingEntryExtended[] => {
    let filtered = [...entries];

    if (filters.operatorId) {
        filtered = filtered.filter(e => e.barberStaffId === filters.operatorId);
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
    entries: CashClosingEntryExtended[],
    barberSummaries: BarberSummary[],
): string => {
    const lines: string[] = [];

    lines.push('RESUMO DO FECHAMENTO DE CAIXA');
    lines.push(`Data;${date}`);
    lines.push(`Operador Filtro;${operatorName || 'Todos'}`);
    lines.push(`Filtro Comandas Abertas;${filters.showOnlyOpenComandas ? 'Sim' : 'Nao'}`);
    lines.push(`Filtro Somente Clube do Chefe;${filters.onlyClubMembers ? 'Sim' : 'Nao'}`);
    lines.push('');

    lines.push('RESUMO FINANCEIRO');
    lines.push(`Total Esperado;${validation.totalExpected.toFixed(2)}`);
    lines.push(`Total Recebido;${validation.totalReceived.toFixed(2)}`);
    lines.push(`Diferenca;${validation.difference.toFixed(2)}`);
    lines.push(`Status;${validation.isValid ? 'Conferido' : 'Divergente'}`);
    lines.push('');

    lines.push('REcebIMENTO POR FORMA DE PAGAMENTO');
    lines.push('Forma;Valor Esperado;Valor Lanado;Diferenca');
    paymentRows.forEach(r => {
        lines.push(`${r.method};${r.expected.toFixed(2)};${r.launched.toFixed(2)};${(r.launched - r.expected).toFixed(2)}`);
    });
    lines.push('');

    if (barberSummaries.length > 0) {
        lines.push('RECEBIMENTO POR BARBEIRO/PROFISSIONAL');
        lines.push('Profissional;Funcao;Qtd Comandas;Total Recebido');
        barberSummaries.forEach(b => {
            lines.push(`${b.staffName};${b.role || '-'};${b.comandaCount};${b.totalReceived.toFixed(2)}`);
        });
        lines.push('');
    }

    lines.push('DETALHAMENTO POR CLIENTE (ANALITICO)');
    lines.push('Data;Profissional;Cliente;Servicos;Qtd Itens;Total;Forma Pagamento;Status Comanda');
    entries
        .filter(e => e.type === 'entrada' && e.sourceType === 'comanda')
        .forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(
                `${dataHora};${e.barberName || '-'};${e.clientName || '-'};${e.comandaItems || '-'};1;${e.value.toFixed(2)};${e.paymentMethod || '-'};${e.comandaStatus || '-'}`
            );
        });
    lines.push('');

    const nonComandaEntries = entries.filter(e => e.sourceType !== 'comanda' && e.type === 'entrada');
    if (nonComandaEntries.length > 0) {
        lines.push('OUTROS RECEBIMENTOS (SEM COMANDA)');
        lines.push('Data;Descricao;Categoria;Valor;Forma Pagamento');
        nonComandaEntries.forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(`${dataHora};${e.description};${e.category};${e.value.toFixed(2)};${e.paymentMethod || '-'}`);
        });
        lines.push('');
    }

    const saidas = entries.filter(e => e.type === 'saida');
    if (saidas.length > 0) {
        lines.push('SAIDAS');
        lines.push('Data;Descricao;Categoria;Valor;Forma Pagamento');
        saidas.forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(`${dataHora};${e.description};${e.category};${e.value.toFixed(2)};${e.paymentMethod || '-'}`);
        });
        lines.push('');
    }

    if (extras.length > 0) {
        lines.push('SANGRIAS E SUPRIMENTOS');
        lines.push('Tipo;Valor;Descricao;Data/Hora;Responsavel');
        extras.forEach(ext => {
            lines.push(
                `${ext.type === 'sangria' ? 'Sangria' : 'Suprimento'};${ext.value.toFixed(2)};"${ext.description || '-'}";${new Date(ext.createdAt).toLocaleString('pt-BR')};${operatorName || '-'}`
            );
        });
        lines.push('');
    }

    if (barberSummaries.length > 0) {
        lines.push('DETALHAMENTO POR BARBEIRO');
        barberSummaries.forEach(b => {
            lines.push('');
            lines.push(`BARBEIRO: ${b.staffName} (${b.role || 'N/A'}) - Total: ${b.totalReceived.toFixed(2)}`);
            lines.push('Data;Cliente;Servicos;Total;Forma Pagamento');
            b.comandas.forEach(cmd => {
                const itemNames = cmd.items.map(i => i.serviceName).join(', ') || '-';
                const cmdDate = cmd.items.length > 0 ? '' : '';
                lines.push(`-;${cmd.clientName};${itemNames};${cmd.total.toFixed(2)};${cmd.paymentMethod || '-'}`);
            });
        });
        lines.push('');
    }

    if (observations.trim()) {
        lines.push('OBSERVACOES');
        lines.push(`"${observations.replace(/"/g, '""')}"`);
        lines.push('');
    }

    lines.push(`GERADO EM;${new Date().toLocaleString('pt-BR')}`);

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
    barberSummaries: BarberSummary[],
    filteredEntries: CashClosingEntryExtended[],
): string => {
    const lines: string[] = [
        '=======================================',
        '    COMPROVANTE DE FECHAMENTO DE CAIXA',
        '=======================================',
        '',
        `Data: ${date}`,
        `Responsavel: ${userName || 'Nao informado'}`,
        `Hora: ${new Date().toLocaleString('pt-BR')}`,
        '',
        '---------------------------------------',
        '           RESUMO GERAL',
        '---------------------------------------',
        `Total Esperado:    ${formatCurrency(validation.totalExpected)}`,
        `Total Recebido:    ${formatCurrency(validation.totalReceived)}`,
        `Diferenca:         ${formatCurrency(validation.difference)}`,
        `Situacao:          ${validation.isValid ? 'CONFERIDO OK' : 'DIVERGENTE'}`,
        '',
    ];

    lines.push('---------------------------------------');
    lines.push('    POR FORMA DE PAGAMENTO');
    lines.push('---------------------------------------');
    paymentRows.forEach(r => {
        lines.push(`  ${r.method.padEnd(22)} ${formatCurrency(r.launched).padStart(14)}`);
    });
    lines.push('');

    if (barberSummaries.length > 0) {
        lines.push('---------------------------------------');
        lines.push('    RECEBIMENTO POR BARBEIRO');
        lines.push('---------------------------------------');
        barberSummaries.forEach(b => {
            lines.push(`  ${b.staffName.padEnd(22)} ${formatCurrency(b.totalReceived).padStart(14)}  (${b.comandaCount} comandas)`);
        });
        lines.push('');
    }

    if (barberSummaries.length > 0) {
        lines.push('=======================================');
        lines.push('    FECHAMENTO DETALHADO POR BARBEIRO');
        lines.push('=======================================');
        barberSummaries.forEach(b => {
            lines.push('');
            lines.push(`  >> ${b.staffName} (${b.role || 'N/A'}) - Total: ${formatCurrency(b.totalReceived)}`);
            lines.push('  -----------------------------------');
            b.comandas.forEach(cmd => {
                const itemNames = cmd.items.map(i => i.serviceName).join(', ') || '-';
                lines.push(`    Cliente: ${cmd.clientName}`);
                lines.push(`    Servicos: ${itemNames}`);
                lines.push(`    Total: ${formatCurrency(cmd.total)} | Forma: ${cmd.paymentMethod || '-'}`);
                lines.push('');
            });
        });
    }

    const comandaEntries = filteredEntries.filter(e => e.sourceType === 'comanda' && e.type === 'entrada');
    if (comandaEntries.length > 0 && barberSummaries.length === 0) {
        lines.push('---------------------------------------');
        lines.push('    LANCAMENTOS POR COMANDA');
        lines.push('---------------------------------------');
        comandaEntries.forEach(e => {
            lines.push(`  ${e.barberName || '-'} | ${e.clientName || '-'} | ${e.comandaItems || '-'} | ${formatCurrency(e.value)}`);
        });
        lines.push('');
    }

    if (extras.length > 0) {
        lines.push('---------------------------------------');
        lines.push('    SANGRIAS E SUPRIMENTOS');
        lines.push('---------------------------------------');
        extras.forEach(ext => {
            const label = ext.type === 'sangria' ? 'SANGRIA   ' : 'SUPRIMENTO';
            lines.push(`  ${label} ${formatCurrency(ext.value).padStart(12)}  ${ext.description || ''}`);
        });
        lines.push('');
    }

    if (observations.trim()) {
        lines.push('---------------------------------------');
        lines.push('    OBSERVACOES');
        lines.push('---------------------------------------');
        lines.push(`  ${observations}`);
        lines.push('');
    }

    lines.push('=======================================');
    lines.push(`  Assinatura: ${userName || 'Nao informado'}`);
    lines.push(`  Data/Hora:  ${new Date().toLocaleString('pt-BR')}`);
    lines.push('=======================================');

    return lines.join('\n');
};
