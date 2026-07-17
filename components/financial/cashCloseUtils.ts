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
    openComandaCount: number;
    openTotal: number;
    openComandas: ComandaDetail[];
}

export interface BarberAttendanceSummary {
    staffId: string;
    staffName: string;
    role: string;
    comandaCount: number;
    totalValue: number;
    averageValue: number;
}

export interface AgendaSummary {
    scheduled: { count: number; total: number };
    completed: { count: number; total: number };
    received: { count: number; total: number };
    cancelled: { count: number; total: number };
    pending: { count: number; total: number };
    no_show: { count: number; total: number };
}

export interface OpenComandaSummary {
    comandaId: string;
    clientName: string;
    staffName: string;
    total: number;
    status: string;
    paymentMethod: string | null;
}

export interface TimelineEvent {
    time: string;
    label: string;
    type: 'service' | 'sangria' | 'suprimento' | 'reversal' | 'opening' | 'closing' | 'audit';
    detail?: string;
}

export interface DailyAuditData {
    totalComandas: number;
    openComandas: number;
    cancelledComandas: number;
    reversedComandas: number;
    pendingPayments: number;
    pendingPaymentsTotal: number;
    reaberturas: number;
    manualReceivables: number;
    manualExpenses: number;
    totalIncome: number;
    totalExpenses: number;
    totalReversals: number;
    totalTransactions: number;
}

export interface IndicatorsData {
    ticketMedio: number;
    clientesAtendidos: number;
    novosClientes: number;
    produtosVendidos: number;
    servicosVendidos: number;
    tempoMedioAtendimento: number;
    comissaoTotal: number;
    metaDoDia: number;
    percentualMeta: number;
}

export interface BarberClosingDetail {
    staffId: string;
    staffName: string;
    role: string;
    status: 'open' | 'closed';
    totalProduced: number;
    totalReceived: number;
    commission: number;
    repasse: number;
    discounts: number;
    advances: number;
    balance: number;
    paymentMethods: Record<string, number>;
    clientsServed: {
        clientName: string;
        serviceName: string;
        time: string;
        value: number;
        paymentMethod: string;
        status: string;
    }[];
    productsSold: {
        name: string;
        quantity: number;
        value: number;
    }[];
    commissions: {
        services: number;
        products: number;
        bonus: number;
        discounts: number;
        finalValue: number;
    };
    conference: {
        countedCash: number;
        expectedCash: number;
        difference: number;
        justification: string;
    };
    checklist: {
        allCommandsClosed: boolean;
        allPaymentsCompleted: boolean;
        noPendingReversals: boolean;
        noOpenCommands: boolean;
        noInconsistentCommissions: boolean;
        conferenceDone: boolean;
    };
    timeline: TimelineEvent[];
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

export const isFrontlineRole = (role: string | null | undefined): boolean => {
    const r = (role || '').toLowerCase().trim();
    if (!r) return false;
    const excluded = ['receptionist', 'recepcionista', 'unknown', ''];
    return !excluded.includes(r);
};

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
    const byBarber = new Map<string, {
        totalReceived: number;
        openTotal: number;
        paidComandas: ComandaDetail[];
        openComandas: ComandaDetail[];
    }>();

    const getOrCreate = (staffId: string) => {
        if (!byBarber.has(staffId)) {
            byBarber.set(staffId, {
                totalReceived: 0,
                openTotal: 0,
                paidComandas: [],
                openComandas: [],
            });
        }
        return byBarber.get(staffId)!;
    };

    comandas.forEach(cmd => {
        const isOpen = cmd.status === 'open';

        const itemStaffIds = new Set(
            cmd.items.map(i => i.staffId).filter(id => id && id !== cmd.staffId)
        );
        const isShared = itemStaffIds.size > 0;

        if (isShared && cmd.items.length > 0) {
            cmd.items.forEach(item => {
                const staffId = item.staffId || cmd.staffId || 'sem-profissional';
                const data = getOrCreate(staffId);
                const itemValue = item.unitPrice * item.quantity;

                const partialCmd: ComandaDetail = {
                    ...cmd,
                    staffId: item.staffId || cmd.staffId,
                    staffName: staffMap[item.staffId || '']?.name || cmd.staffName,
                    total: itemValue,
                    items: [item],
                };

                if (isOpen) {
                    data.openTotal += itemValue;
                    data.openComandas.push(partialCmd);
                } else {
                    data.totalReceived += itemValue;
                    data.paidComandas.push(partialCmd);
                }
            });
        } else {
            const staffId = cmd.staffId || 'sem-profissional';
            const data = getOrCreate(staffId);

            if (isOpen) {
                data.openTotal += cmd.total;
                data.openComandas.push(cmd);
            } else {
                data.totalReceived += cmd.total;
                data.paidComandas.push(cmd);
            }
        }
    });

    return Array.from(byBarber.entries()).map(([staffId, data]) => {
        const info = staffMap[staffId];
        return {
            staffId,
            staffName: info?.name || (staffId === 'sem-profissional' ? 'Sem profissional' : 'Desconhecido'),
            role: info?.role || '',
            totalReceived: data.totalReceived,
            comandaCount: data.paidComandas.length,
            comandas: data.paidComandas,
            openComandaCount: data.openComandas.length,
            openTotal: data.openTotal,
            openComandas: data.openComandas,
        };
    }).sort((a, b) => b.totalReceived - a.totalReceived);
};

export const buildAttendancesByBarber = (
    comandas: ComandaDetail[],
): BarberAttendanceSummary[] => {
    const byBarber = new Map<string, { total: number; count: number }>();

    comandas.forEach(cmd => {
        const staffId = cmd.staffId || 'sem-profissional';
        const existing = byBarber.get(staffId) || { total: 0, count: 0 };
        existing.total += cmd.total;
        existing.count += 1;
        byBarber.set(staffId, existing);
    });

    return Array.from(byBarber.entries()).map(([staffId, data]) => ({
        staffId,
        staffName: '', // Will be filled by caller using staffMap
        role: '',
        comandaCount: data.count,
        totalValue: data.total,
        averageValue: data.count > 0 ? data.total / data.count : 0,
    })).sort((a, b) => b.totalValue - a.totalValue);
};

export const buildOpenComandasSummary = (
    comandas: ComandaDetail[],
): OpenComandaSummary[] => {
    return comandas
        .filter(c => c.status === 'open')
        .map(c => ({
            comandaId: c.comandaId,
            clientName: c.clientName,
            staffName: c.staffName,
            total: c.total,
            status: c.status,
            paymentMethod: c.paymentMethod,
        }))
        .sort((a, b) => b.total - a.total);
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
    attendancesByBarber: BarberAttendanceSummary[],
    openComandasSummary: OpenComandaSummary[],
    cashCloseData: {
        responsible: string;
        closingTime: string;
        grossSales: number;
        discounts: number;
        surcharges: number;
    },
): string => {
    const lines: string[] = [];

    lines.push('# FECHAMENTO DE CAIXA');
    lines.push(`Data,${date}`);
    lines.push(`Responsavel,${cashCloseData.responsible}`);
    lines.push(`Hora de Fechamento,${cashCloseData.closingTime}`);
    lines.push('');

    lines.push('# RESUMO GERAL');
    lines.push(`Total Esperado,${validation.totalExpected.toFixed(2)}`);
    lines.push(`Total Recebido,${validation.totalReceived.toFixed(2)}`);
    lines.push(`Diferenca,${validation.difference.toFixed(2)}`);
    lines.push(`Situacao,${validation.isValid ? 'CONFERIDO OK' : 'DIVERGENTE'}`);
    lines.push('');

    lines.push('# POR FORMA DE PAGAMENTO');
    lines.push('Forma,Valor,Quantidade');
    paymentRows.forEach(r => {
        const count = entries.filter(e => e.paymentMethod === r.method && e.type === 'entrada').length;
        lines.push(`${r.method},${r.launched.toFixed(2)},${count}`);
    });
    lines.push('');

    if (openComandasSummary.length > 0) {
        lines.push('# COMANDAS ABERTAS DO DIA');
        lines.push('Cliente,Barbeiro,Valor,Status');
        openComandasSummary.forEach(cmd => {
            lines.push(`"${cmd.clientName}","${cmd.staffName}",${cmd.total.toFixed(2)},${cmd.status}`);
        });
        lines.push('');
    }

    if (attendancesByBarber.length > 0) {
        lines.push('# ATENDIMENTOS POR BARBEIRO');
        lines.push('Barbeiro,Quantidade Comandas,Valor Total,Media por Comanda');
        attendancesByBarber.forEach(b => {
            lines.push(`${b.staffName},${b.comandaCount},${b.totalValue.toFixed(2)},${b.averageValue.toFixed(2)}`);
        });
        lines.push('');
    }

    lines.push('# DETALHAMENTO POR CLIENTE (ANALITICO)');
    lines.push('Data,Profissional,Cliente,Servicos,Qtd Itens,Total,Forma Pagamento,Status Comanda');
    entries
        .filter(e => e.type === 'entrada' && e.sourceType === 'comanda')
        .forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(
                `${dataHora},${e.barberName || '-'},${e.clientName || '-'},${e.comandaItems || '-'},1,${e.value.toFixed(2)},${e.paymentMethod || '-'},${e.comandaStatus || '-'}`
            );
        });
    lines.push('');

    const nonComandaEntries = entries.filter(e => e.sourceType !== 'comanda' && e.type === 'entrada');
    if (nonComandaEntries.length > 0) {
        lines.push('# OUTROS RECEBIMENTOS (SEM COMANDA)');
        lines.push('Data,Descricao,Categoria,Valor,Forma Pagamento');
        nonComandaEntries.forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(`${dataHora},${e.description},${e.category},${e.value.toFixed(2)},${e.paymentMethod || '-'}`);
        });
        lines.push('');
    }

    const saidas = entries.filter(e => e.type === 'saida');
    if (saidas.length > 0) {
        lines.push('# SAIDAS');
        lines.push('Data,Descricao,Categoria,Valor,Forma Pagamento');
        saidas.forEach(e => {
            const dataHora = new Date(e.date).toLocaleString('pt-BR');
            lines.push(`${dataHora},${e.description},${e.category},${e.value.toFixed(2)},${e.paymentMethod || '-'}`);
        });
        lines.push('');
    }

    if (extras.length > 0) {
        lines.push('# SANGRIAS E SUPRIMENTOS');
        lines.push('Tipo,Valor,Descricao,Data/Hora,Responsavel');
        extras.forEach(ext => {
            lines.push(
                `${ext.type === 'sangria' ? 'Sangria' : 'Suprimento'},${ext.value.toFixed(2)},"${ext.description || '-'}","${new Date(ext.createdAt).toLocaleString('pt-BR')}",${operatorName || '-'}`
            );
        });
        lines.push('');
    }

    if (observations.trim()) {
        lines.push('# OBSERVACOES');
        lines.push(`"${observations.replace(/"/g, '""')}"`);
        lines.push('');
    }

    lines.push(`GERADO EM,${new Date().toLocaleString('pt-BR')}`);

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
    openComandasSummary: OpenComandaSummary[],
    attendancesByBarber: BarberAttendanceSummary[],
): string => {
    const totalOpen = barberSummaries.reduce((s, b) => s + b.openTotal, 0);
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

    if (totalOpen > 0) {
        lines.push('---------------------------------------');
        lines.push('    VALORES NAO RECEBIDOS');
        lines.push('---------------------------------------');
        lines.push(`  Total Pendente (Comandas Abertas): ${formatCurrency(totalOpen)}`);
        lines.push('');
    }

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
            const pendingLabel = b.openTotal > 0 ? ` | Pendente: ${formatCurrency(b.openTotal)}` : '';
            lines.push(`  ${b.staffName.padEnd(22)} ${formatCurrency(b.totalReceived).padStart(14)}  (${b.comandaCount} comandas${pendingLabel})`);
        });
        lines.push('');
    }

    if (openComandasSummary.length > 0) {
        lines.push('---------------------------------------');
        lines.push('    COMANDAS ABERTAS DO DIA');
        lines.push('---------------------------------------');
        lines.push('  Cliente                | Barbeiro             | Valor        | Status');
        lines.push('  -----------------------|----------------------|--------------|-------');
        openComandasSummary.forEach(cmd => {
            const client = cmd.clientName.padEnd(24).slice(0, 24);
            const barber = cmd.staffName.padEnd(22).slice(0, 22);
            const valor = formatCurrency(cmd.total).padStart(12);
            const status = cmd.status.padEnd(7).slice(0, 7);
            lines.push(`  ${client} | ${barber} | ${valor} | ${status}`);
        });
        lines.push('');
    }

    if (attendancesByBarber.length > 0) {
        lines.push('---------------------------------------');
        lines.push('    ATENDIMENTOS POR BARBEIRO');
        lines.push('---------------------------------------');
        lines.push('  Barbeiro               | Qtd | Valor Total  | Media');
        lines.push('  -----------------------|-----|--------------|--------');
        attendancesByBarber.forEach(att => {
            const barber = att.staffName.padEnd(24).slice(0, 24);
            const qtd = String(att.comandaCount).padStart(3);
            const total = formatCurrency(att.totalValue).padStart(12);
            const media = formatCurrency(att.averageValue).padStart(8);
            lines.push(`  ${barber} | ${qtd} | ${total} | ${media}`);
        });
        lines.push('');
    }

    if (barberSummaries.length > 0) {
        lines.push('=======================================');
        lines.push('    FECHAMENTO DETALHADO POR BARBEIRO');
        lines.push('=======================================');
        barberSummaries.forEach(b => {
            lines.push('');
            lines.push(`  >> ${b.staffName} (${b.role || 'N/A'})`);
            lines.push(`  Recebido: ${formatCurrency(b.totalReceived)} | Pendente: ${formatCurrency(b.openTotal)}`);

            if (b.comandas.length > 0) {
                lines.push('  --- COMANDAS PAGAS ---');
                b.comandas.forEach(cmd => {
                    const itemNames = cmd.items.map(i => i.serviceName).join(', ') || '-';
                    const isPartial = cmd.items.length === 1 && cmd.total < (cmd.total || 0);
                    const partialTag = isPartial ? ' [servico compartilhado]' : '';
                    lines.push(`    Cliente: ${cmd.clientName}${partialTag}`);
                    lines.push(`    Servicos: ${itemNames}`);
                    lines.push(`    Total: ${formatCurrency(cmd.total)} | Forma: ${cmd.paymentMethod || '-'}`);
                    lines.push('');
                });
            }

            if (b.openComandas.length > 0) {
                lines.push('  --- COMANDAS ABERTAS (PENDENTES) ---');
                b.openComandas.forEach(cmd => {
                    const itemNames = cmd.items.map(i => i.serviceName).join(', ') || '-';
                    lines.push(`    Cliente: ${cmd.clientName}`);
                    lines.push(`    Servicos: ${itemNames}`);
                    lines.push(`    Total: ${formatCurrency(cmd.total)} | Forma: ${cmd.paymentMethod || '-'}`);
                    lines.push('');
                });
            }
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
