import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Users } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import CashCloseFiltersBar from '../components/financial/CashCloseFilters';
import { AuditAdjustmentButton } from '../components/audit';
import { useCashClosing } from '../src/hooks/useCashClosing';
import {
    ClosingHeader,
    FinancialSummarySection,
    PaymentMethodBreakdown,
    PhysicalConference,
    SangriaSuprimentoSection,
    DailyAudit,
    Indicators,
    ClosingTimeline,
    ClosingNotes,
    ClosingActions,
    BarberClosingCard,
    ProfessionalPerformanceSection,
    SalesRanking,
} from '../components/financial/closing';
import {
    formatCurrency,
    generateCSVContent,
    downloadCSV,
    generatePreviewText,
} from '../components/financial/cashCloseUtils';
import { useAuth } from '../context/AuthContext';

const CashClosingPage: React.FC = () => {
    const { tenantId, user } = useAuth();
    const hasTenantContext = Boolean(tenantId);

    const closing = useCashClosing(tenantId, user);

    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    const formattedFilterDate = closing.filterDate
        ? new Date(`${closing.filterDate}T00:00:00`).toLocaleDateString('pt-BR')
        : 'Data nao informada';
    const lastSavedLabel = closing.lastSavedAt
        ? new Date(closing.lastSavedAt).toLocaleString('pt-BR')
        : 'Ainda nao salvo';

    const closingStatus = closing.loading
        ? 'Carregando'
        : closing.saving
            ? 'Salvando'
            : closing.loadError
                ? 'Erro'
                : closing.hasPendingAlerts
                    ? 'Pendencias'
                    : closing.hasDailyFinancialData
                        ? 'Conferido'
                        : 'Vazio';

    const closingStatusClasses = closing.loadError
        ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
        : closing.hasPendingAlerts
            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
            : closing.hasDailyFinancialData
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20'
                : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-border-dark';

    const getOperatorName = useCallback((operatorId?: string | null) => {
        if (!operatorId) return 'Todos';
        return closing.staffMap[operatorId]?.name || 'Desconhecido';
    }, [closing.staffMap]);

    const previewText = useMemo(() => generatePreviewText(
        formattedFilterDate, closing.validation, closing.extras, closing.paymentRows,
        closing.observations, user?.email || 'Nao informado', closing.barberSummaries,
        closing.filteredEntries, closing.openComandasSummary, closing.attendancesByBarber,
    ), [formattedFilterDate, closing.validation, closing.extras, closing.paymentRows,
        closing.observations, user, closing.barberSummaries, closing.filteredEntries,
        closing.openComandasSummary, closing.attendancesByBarber]);

    const handleExportCSV = useCallback(() => {
        const csv = generateCSVContent(
            formattedFilterDate, closing.filters, closing.validation, closing.extras,
            closing.paymentRows, closing.observations, getOperatorName(closing.filters.operatorId),
            closing.filteredEntries, closing.barberSummaries, closing.attendancesByBarber,
            closing.openComandasSummary,
            {
                responsible: user?.email || 'Nao informado',
                closingTime: new Date().toLocaleString('pt-BR'),
                grossSales: closing.totalEntradas,
                discounts: 0,
                surcharges: 0,
            }
        );
        downloadCSV(csv, `fechamento-caixa-${closing.filterDate.replace(/-/g, '')}.csv`);
        setToast({ message: 'CSV exportado com sucesso.', type: 'success' });
    }, [formattedFilterDate, closing.filters, closing.validation, closing.extras,
        closing.paymentRows, closing.observations, closing.filteredEntries,
        closing.barberSummaries, closing.attendancesByBarber, closing.openComandasSummary,
        user, closing.totalEntradas, closing.filterDate, getOperatorName]);

    const handleExportPDF = useCallback(() => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = margin;

        const addText = (text: string, options: { fontSize?: number; fontStyle?: string; color?: [number, number, number]; align?: 'left' | 'center' | 'right' } = {}) => {
            doc.setFontSize(options.fontSize || 10);
            doc.setFont('helvetica', options.fontStyle || 'normal');
            if (options.color) doc.setTextColor(...options.color);
            else doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
            doc.text(lines, margin, y, { align: options.align });
            y += lines.length * (options.fontSize || 10) * 0.5;
        };

        const addSection = (title: string) => {
            y += 4;
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.3);
            doc.line(margin, y, pageWidth - margin, y);
            y += 2;
            addText(title, { fontSize: 11, fontStyle: 'bold' });
            y += 2;
        };

        addText('COMPROVANTE DE FECHAMENTO DE CAIXA', { fontSize: 14, fontStyle: 'bold', align: 'center' });
        y += 4;
        addText(`Data: ${formattedFilterDate}`, { fontSize: 10 });
        addText(`Responsavel: ${user?.email || 'Nao informado'}`, { fontSize: 10 });
        addText(`Hora: ${new Date().toLocaleString('pt-BR')}`, { fontSize: 10 });
        y += 4;

        addSection('RESUMO GERAL');
        addText(`Total Esperado:    ${formatCurrency(closing.validation.totalExpected)}`);
        addText(`Total Recebido:    ${formatCurrency(closing.operatorValidation.totalReceived)}`);
        addText(`Diferenca:         ${formatCurrency(closing.operatorValidation.difference)}`);
        addText(`Situacao:          ${closing.operatorValidation.isValid ? 'CONFERIDO OK' : 'DIVERGENTE'}`, {
            color: closing.operatorValidation.isValid ? [0, 128, 0] : [255, 0, 0]
        });
        y += 2;

        if (closing.openComandasSummary.length > 0) {
            addSection('COMANDAS ABERTAS DO DIA');
            const tableBody = closing.openComandasSummary.map(cmd => [
                cmd.clientName, cmd.staffName, formatCurrency(cmd.total), cmd.status,
            ]);
            (doc as any).autoTable({
                startY: y,
                head: [['Cliente', 'Barbeiro', 'Valor', 'Status']],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin },
                didDrawPage: (data: any) => { y = data.cursor.y + 4; },
            });
        }

        if (closing.attendancesByBarber.length > 0) {
            addSection('ATENDIMENTOS POR BARBEIRO');
            const tableBody = closing.attendancesByBarber.map(att => [
                att.staffName, String(att.comandaCount), formatCurrency(att.totalValue), formatCurrency(att.averageValue),
            ]);
            (doc as any).autoTable({
                startY: y,
                head: [['Barbeiro', 'Qtd. Comandas', 'Valor Total', 'Media por Comanda']],
                body: tableBody,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin },
                didDrawPage: (data: any) => { y = data.cursor.y + 4; },
            });
        }

        addSection('POR FORMA DE PAGAMENTO');
        const paymentTableBody = closing.paymentRows.map(r => {
            const count = closing.filteredEntries.filter(e => e.paymentMethod === r.method && e.type === 'entrada').length;
            return [r.method, formatCurrency(r.launched), String(count)];
        });
        (doc as any).autoTable({
            startY: y,
            head: [['Forma', 'Valor', 'Quantidade']],
            body: paymentTableBody,
            theme: 'striped',
            headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
            bodyStyles: { fontSize: 8 },
            margin: { left: margin, right: margin },
            didDrawPage: (data: any) => { y = data.cursor.y + 4; },
        });

        if (closing.barberSummaries.length > 0) {
            addSection('RECEBIMENTO POR BARBEIRO');
            const barberTableBody = closing.barberSummaries.map(b => [
                b.staffName, b.role || '-', String(b.comandaCount), formatCurrency(b.totalReceived),
                String(b.openComandaCount), formatCurrency(b.openTotal),
            ]);
            (doc as any).autoTable({
                startY: y,
                head: [['Profissional', 'Funcao', 'Qtd Comandas', 'Total Recebido', 'Qtd Abertas', 'Total Pendente']],
                body: barberTableBody,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin },
                didDrawPage: (data: any) => { y = data.cursor.y + 4; },
            });
        }

        if (closing.extras.length > 0) {
            addSection('SANGRIAS E SUPRIMENTOS');
            const extrasTableBody = closing.extras.map(ext => [
                ext.type === 'sangria' ? 'Sangria' : 'Suprimento', formatCurrency(ext.value),
                ext.description || '-', new Date(ext.createdAt).toLocaleString('pt-BR'),
            ]);
            (doc as any).autoTable({
                startY: y,
                head: [['Tipo', 'Valor', 'Descricao', 'Data/Hora']],
                body: extrasTableBody,
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin },
                didDrawPage: (data: any) => { y = data.cursor.y + 4; },
            });
        }

        if (closing.observations.trim()) {
            addSection('OBSERVACOES');
            addText(closing.observations);
        }

        y += 6;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
        addText(`Assinatura: ${user?.email || 'Nao informado'}`, { fontSize: 9 });
        addText(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, { fontSize: 9 });

        doc.save(`fechamento-${closing.filterDate.replace(/-/g, '-')}.pdf`);
        setToast({ message: 'PDF exportado com sucesso.', type: 'success' });
    }, [formattedFilterDate, user, closing.validation, closing.openComandasSummary,
        closing.attendancesByBarber, closing.paymentRows, closing.filteredEntries,
        closing.barberSummaries, closing.extras, closing.observations, closing.filterDate]);

    const handlePrint = useCallback(() => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
            <html><head><title>Fechamento Caixa - ${formattedFilterDate}</title>
            <style>body{font-family:monospace;padding:20px;white-space:pre-wrap;font-size:12px;}</style>
            </head><body>${previewText.replace(/\n/g, '<br>')}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    }, [formattedFilterDate, previewText]);

    const handleSaveWithToast = useCallback(async () => {
        try {
            await closing.handleSaveConference();
            setToast({ message: 'Conferencia salva com sucesso.', type: 'success' });
            setShowSaveConfirm(false);
        } catch (error: any) {
            setToast({ message: error?.message || 'Erro ao salvar.', type: 'error' });
        }
    }, [closing.handleSaveConference]);

    const handleCloseWithToast = useCallback(async () => {
        try {
            await closing.handleCloseCash();
            setToast({ message: 'Caixa fechado com sucesso!', type: 'success' });
            setShowCloseConfirm(false);
        } catch (error: any) {
            setToast({ message: error?.message || 'Erro ao fechar caixa.', type: 'error' });
        }
    }, [closing.handleCloseCash]);

    const handleExportBarberPDF = useCallback((barber: { staffName: string; totalProduced: number; commission: number; clientsServed: { clientName: string; serviceName: string; value: number }[] }) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        let y = margin;

        const addText = (text: string, options: { fontSize?: number; fontStyle?: string; align?: 'left' | 'center' | 'right' } = {}) => {
            doc.setFontSize(options.fontSize || 10);
            doc.setFont('helvetica', options.fontStyle || 'normal');
            doc.setTextColor(0, 0, 0);
            const lines = doc.splitTextToSize(text, pageWidth - 2 * margin);
            doc.text(lines, margin, y, { align: options.align });
            y += lines.length * (options.fontSize || 10) * 0.5;
        };

        addText(`FECHAMENTO - ${barber.staffName}`, { fontSize: 12, fontStyle: 'bold', align: 'center' });
        y += 2;
        addText(`Data: ${formattedFilterDate}`);
        addText(`Producao: ${formatCurrency(barber.totalProduced)}`);
        addText(`Comissao: ${formatCurrency(barber.commission)}`);
        y += 4;

        if (barber.clientsServed.length > 0) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text('CLIENTES ATENDIDOS', margin, y);
            y += 6;
            (doc as any).autoTable({
                startY: y,
                head: [['Cliente', 'Servico', 'Valor']],
                body: barber.clientsServed.map(c => [c.clientName, c.serviceName, formatCurrency(c.value)]),
                theme: 'striped',
                headStyles: { fillColor: [30, 58, 138], fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                margin: { left: margin, right: margin },
            });
        }

        doc.save(`fechamento-${barber.staffName.replace(/\s+/g, '-').toLowerCase()}-${closing.filterDate.replace(/-/g, '')}.pdf`);
        setToast({ message: `PDF de ${barber.staffName} exportado.`, type: 'success' });
    }, [formattedFilterDate, closing.filterDate]);

    const handleSaveBarberCash = useCallback(async (barberStaffId: string) => {
        try {
            await closing.handleSaveConference();
            setToast({ message: 'Conferencia salva com sucesso.', type: 'success' });
        } catch (error: any) {
            setToast({ message: error?.message || 'Erro ao salvar.', type: 'error' });
        }
    }, [closing.handleSaveConference]);

    const allBarbersConferido = closing.barberClosingDetails.every(b =>
        Object.values(b.checklist).every(v => v)
    );
    const pendingBarberCount = closing.barberClosingDetails.filter(b =>
        !Object.values(b.checklist).every(v => v)
    ).length;

    return (
        <div className="space-y-4 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* ETAPA 1: Header */}
            <ClosingHeader
                filterDate={closing.filterDate}
                onDateChange={closing.setFilterDate}
                status={closingStatus}
                statusClasses={closingStatusClasses}
                lastSavedLabel={lastSavedLabel}
                formattedDate={formattedFilterDate}
                loading={closing.loading}
                saving={closing.saving}
                onRefresh={closing.fetchData}
                onSave={() => setShowSaveConfirm(true)}
                onPreview={() => setShowPreview(true)}
                hasTenantContext={hasTenantContext}
                openingTime={closing.openingTime}
                closingTime={closing.closingTime}
                isConfirmed={closing.isConfirmed}
                onOpenCash={closing.openCashRegister}
            />

            {/* Audit Button */}
            <div className="flex justify-end">
                <AuditAdjustmentButton
                    context={{
                        sourceType: 'cash_closing',
                        sourceLabel: 'Fechamento de Caixa',
                        beforeSnapshot: { data: closing.filterDate, entradas: closing.totalEntradas, saidas: closing.totalSaidas, saldo: closing.saldoAtual },
                        financialImpactLabel: 'Impacto em fechamento de caixa',
                        allowedAdjustmentTypes: ['cash_difference_correction', 'mark_for_review'],
                    }}
                    defaultAdjustmentType="mark_for_review"
                />
            </div>

            {/* Filters */}
            <CashCloseFiltersBar
                filters={closing.filters}
                onFiltersChange={(f) => closing.setFilters(prev => ({ ...prev, ...f }))}
                operators={closing.frontlineStaff}
                filteredCount={closing.filteredEntries.length}
                totalCount={closing.entries.length}
            />

            {/* Error */}
            {closing.loadError && (
                <div className="flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="size-5 text-rose-600 dark:text-rose-300 shrink-0" />
                        <div>
                            <p className="text-sm font-black text-rose-700 dark:text-rose-300">Erro ao carregar.</p>
                            <p className="text-xs text-rose-700/80 dark:text-rose-300/80">{closing.loadError}</p>
                        </div>
                    </div>
                    <button
                        onClick={closing.fetchData}
                        disabled={closing.loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50 transition-colors"
                    >
                        Tentar novamente
                    </button>
                </div>
            )}

            {/* ETAPA 2: Financial Summary */}
            <FinancialSummarySection
                loading={closing.loading}
                totalEntradas={closing.totalEntradas}
                totalSaidas={closing.totalSaidas}
                totalReversals={closing.totalReversals}
                reversalCount={closing.reversalCount}
                saldoAtual={closing.saldoAtual}
                entradasCount={closing.entradasCount}
                saidasCount={closing.saidasCount}
            />

            {/* ETAPA 2.1: Valor Realizado por Profissional */}
            <ProfessionalPerformanceSection
                barberSummaries={closing.barberSummaries}
                loading={closing.loading}
            />

            {/* ETAPA 2.2: Ranking de Vendas */}
            <SalesRanking
                barberSummaries={closing.barberSummaries}
                loading={closing.loading}
            />

            {/* Open Comandas Warning */}
            {!closing.loading && closing.openComandasSummary.length > 0 && (
                <div className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-4">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 dark:text-amber-300 mb-3">
                        Comandas Abertas do Dia ({closing.openComandasCount})
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-amber-200 dark:border-amber-500/20">
                                    <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Cliente</th>
                                    <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Barbeiro</th>
                                    <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-amber-600">Valor</th>
                                </tr>
                            </thead>
                            <tbody>
                                {closing.openComandasSummary.map(cmd => (
                                    <tr key={cmd.comandaId} className="border-b border-amber-100 dark:border-amber-500/10 last:border-0">
                                        <td className="py-2 font-semibold text-slate-900 dark:text-white text-xs">{cmd.clientName}</td>
                                        <td className="py-2 text-slate-700 dark:text-slate-300 text-xs">{cmd.staffName}</td>
                                        <td className="text-right py-2 font-bold text-amber-600 text-xs">{formatCurrency(cmd.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Conferencia de Caixa Individual por Barbeiro */}
            {!closing.loading && closing.barberClosingDetails.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-400" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                            Conferencia de Caixa do Barbeiro
                        </h3>
                        {pendingBarberCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:text-amber-300">
                                {pendingBarberCount} pendente{pendingBarberCount > 1 ? 's' : ''}
                            </span>
                        )}
                        {allBarbersConferido && closing.barberClosingDetails.length > 0 && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300">
                                Todos conferidos
                            </span>
                        )}
                    </div>
                    <div className="space-y-2">
                        {closing.barberClosingDetails.map(barber => (
                            <BarberClosingCard
                                key={barber.staffId}
                                barber={barber}
                                loading={closing.loading}
                                onCloseBarberCash={closing.closeBarberCash}
                                onSaveBarberCash={handleSaveBarberCash}
                                onExportBarberPDF={handleExportBarberPDF}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ETAPA 3: Payment Method Breakdown */}
            <PaymentMethodBreakdown
                paymentMethodBreakdown={closing.paymentMethodBreakdown}
                filteredEntries={closing.filteredEntries}
                loading={closing.loading}
            />

            {/* ETAPA 4: Physical Conference */}
            <PhysicalConference
                validation={closing.operatorValidation}
                totalExpected={closing.totalExpected}
                onCountedCashChange={closing.setCountedCash}
                loading={closing.loading}
            />

            {/* ETAPA 5: Sangrias e Suprimentos */}
            <SangriaSuprimentoSection
                extras={closing.extras}
                onAdd={closing.addExtra}
                onRemove={closing.removeExtra}
                loading={closing.loading}
            />

            {/* ETAPA 6: Daily Audit */}
            <DailyAudit
                audit={closing.dailyAudit}
                loading={closing.loading}
            />

            {/* ETAPA 7: Indicators */}
            <Indicators
                indicators={closing.indicators}
                loading={closing.loading}
            />

            {/* ETAPA 8: Timeline */}
            <ClosingTimeline
                events={closing.timeline}
                dbEvents={closing.closingEvents}
                loading={closing.loading}
            />

            {/* ETAPA 9: Notes */}
            <ClosingNotes
                observations={closing.observations}
                onChange={closing.setObservations}
                loading={closing.loading}
            />

            {/* Divergence Warning */}
            {!closing.loading && !closing.operatorValidation.isValid && closing.observations.trim() === '' && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
                    <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-black text-amber-700 dark:text-amber-300">Divergencia detectada</p>
                        <p className="text-xs text-amber-700/80 dark:text-amber-300/80">Ajuste os valores ou justifique nas observacoes para fechar o caixa.</p>
                    </div>
                </div>
            )}

            {/* ETAPA 10: Actions */}
            <ClosingActions
                loading={closing.loading}
                saving={closing.saving}
                closing={closing.closing}
                hasTenantContext={hasTenantContext}
                validationValid={closing.operatorValidation.isValid}
                hasObservations={closing.observations.trim() !== ''}
                onSave={() => setShowSaveConfirm(true)}
                onClose={() => setShowCloseConfirm(true)}
                onPreview={() => setShowPreview(true)}
                onExportPDF={handleExportPDF}
                onExportCSV={handleExportCSV}
                onPrint={handlePrint}
            />

            {/* Preview Modal */}
            <Modal isOpen={showPreview} onClose={() => setShowPreview(false)} title="Comprovante de Fechamento" maxWidth="lg">
                <div className="space-y-4">
                    <pre className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark rounded-lg p-4 text-xs font-mono whitespace-pre-wrap text-slate-700 dark:text-slate-200 max-h-[60vh] overflow-y-auto">
                        {previewText}
                    </pre>
                    <div className="flex gap-3">
                        <button onClick={handlePrint} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Imprimir
                        </button>
                        <button onClick={handleExportCSV} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-gold-hover transition-colors">
                            Exportar CSV
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Save Confirm Modal */}
            <Modal isOpen={showSaveConfirm} onClose={() => setShowSaveConfirm(false)} title="Salvar Conferencia" maxWidth="sm">
                <div className="space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Salvar conferencia do dia <strong>{formattedFilterDate}</strong>? Nenhum lancamento e alterado.
                    </p>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setShowSaveConfirm(false)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSaveWithToast} disabled={closing.saving} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white hover:bg-primary-gold-hover disabled:opacity-50 transition-colors">
                            {closing.saving ? 'Salvando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Close Confirm Modal */}
            <Modal isOpen={showCloseConfirm} onClose={() => setShowCloseConfirm(false)} title="Fechar Caixa" maxWidth="sm">
                <div className="space-y-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-border-dark dark:bg-white/5">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 mb-2">Resumo</p>
                        <div className="space-y-1 text-xs">
                            <p>Data: <strong>{formattedFilterDate}</strong></p>
                            <p>Esperado: <strong>{formatCurrency(closing.totalExpected)}</strong></p>
                            <p>Recebido: <strong>{formatCurrency(closing.countedCash ?? closing.totalExpected)}</strong></p>
                            <p>Diferenca: <strong className={closing.operatorValidation.isValid ? 'text-emerald-600' : 'text-rose-600'}>{formatCurrency(closing.operatorValidation.difference)}</strong></p>
                            <p>Sangrias: <strong className="text-rose-600">{closing.extras.filter(e => e.type === 'sangria').length} ({formatCurrency(closing.extras.filter(e => e.type === 'sangria').reduce((s, e) => s + e.value, 0))})</strong></p>
                            <p>Suprimentos: <strong className="text-emerald-600">{closing.extras.filter(e => e.type === 'suprimento').length} ({formatCurrency(closing.extras.filter(e => e.type === 'suprimento').reduce((s, e) => s + e.value, 0))})</strong></p>
                        </div>
                    </div>
                    {pendingBarberCount > 0 && (
                        <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3">
                            <div className="flex items-center gap-2">
                                <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-bold text-amber-700 dark:text-amber-300">
                                    Existem {pendingBarberCount} caixa(s) individual(is) pendente(s) de conferencia.
                                </span>
                            </div>
                        </div>
                    )}
                    <p className="text-[10px] text-slate-400">Sangrias e suprimentos serao registrados como transacoes.</p>
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => setShowCloseConfirm(false)} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleCloseWithToast} disabled={closing.closing} className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                            {closing.closing ? 'Fechando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default CashClosingPage;
