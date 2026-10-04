import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../components/ui/Modal';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import Toast from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { usePayoutService } from '../src/hooks/usePayoutService';
import { getEffectiveCommissionRate } from '../src/lib/staff/roles';
import type {
    BarberPayoutSettlement,
    SettlementComputation,
    SettlementStatus,
} from '../domain/payout/types';
import { sumCents } from '../domain/payout/money';

type RowStatus = SettlementStatus | 'unsettled';

interface PayrollRow {
    staffId: string;
    professionalName: string;
    role: string;
    avatar: string;
    /** Taxa efetiva em fração (0.4 = 40%). */
    commissionRate: number;
    /**
     * Pré-visualização calculada por `computeSettlement`, que é leitura pura.
     * Não substitui os valores do acerto persistido quando existe.
     */
    preview: SettlementComputation;
    settlement: BarberPayoutSettlement | null;
    status: RowStatus;
}

const brl = (value: number): string =>
    `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const STATUS_LABEL: Record<RowStatus, string> = {
    unsettled: 'Não apurado',
    draft: 'Rascunho',
    approved: 'Aprovado',
    paid: 'Pago',
    cancelled: 'Cancelado',
};

const STATUS_STYLE: Record<RowStatus, string> = {
    unsettled: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-border-dark',
    draft: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    approved: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    paid: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    cancelled: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
};

const btnPrimary =
    'px-3 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors';
const btnGhost =
    'px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors';
const btnDanger =
    'px-3 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-xs font-bold rounded-lg transition-colors';

const Payroll: React.FC = () => {
    const { tenantId } = useAuth();
    const payout = usePayoutService();

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<PayrollRow[]>([]);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchName, setSearchName] = useState('');

    const [busyStaffId, setBusyStaffId] = useState<string | null>(null);

    const [payModalRow, setPayModalRow] = useState<PayrollRow | null>(null);
    const [paymentMethod, setPaymentMethod] = useState('pix');

    const [cancelModalRow, setCancelModalRow] = useState<PayrollRow | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const fetchData = useCallback(async () => {
        if (!tenantId || !payout || !startDate || !endDate) return;
        setLoading(true);

        try {
            const professionals = await payout.listEligibleProfessionals(
                tenantId,
                getEffectiveCommissionRate,
            );

            const next: PayrollRow[] = [];

            for (const professional of professionals) {
                // Leitura pura: nada é persistido na pré-visualização.
                const preview = await payout.computeSettlement({
                    tenantId,
                    staffId: professional.id,
                    periodStart: startDate,
                    periodEnd: endDate,
                    commissionRate: professional.commissionRate,
                });

                const existing = await payout.getSettlementForPeriod(
                    tenantId,
                    professional.id,
                    startDate,
                    endDate,
                );

                next.push({
                    staffId: professional.id,
                    professionalName: professional.name,
                    role: professional.role,
                    avatar: professional.avatar,
                    commissionRate: professional.commissionRate,
                    preview,
                    settlement: existing,
                    status: existing?.status ?? 'unsettled',
                });
            }

            setRows(next);
        } catch (error) {
            console.error('Erro ao apurar repasse:', error);
            setToast({ message: 'Erro ao apurar o repasse.', type: 'error' });
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [tenantId, payout, startDate, endDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const withBusy = async (staffId: string, fn: () => Promise<void>) => {
        setBusyStaffId(staffId);
        try {
            await fn();
        } finally {
            setBusyStaffId(null);
        }
    };

    const handleGenerateDraft = (row: PayrollRow) =>
        withBusy(row.staffId, async () => {
            if (!payout || !tenantId) return;
            try {
                await payout.generateDraft({
                    tenantId,
                    staffId: row.staffId,
                    periodStart: startDate,
                    periodEnd: endDate,
                    commissionRate: row.commissionRate,
                });
                setToast({ message: 'Acerto gerado.', type: 'success' });
                await fetchData();
            } catch (error) {
                console.error('Erro ao gerar acerto:', error);
                setToast({ message: 'Erro ao gerar o acerto.', type: 'error' });
            }
        });

    const handleApprove = (row: PayrollRow) =>
        withBusy(row.staffId, async () => {
            if (!payout || !tenantId || !row.settlement) return;
            try {
                await payout.approveSettlement(tenantId, row.settlement.id);
                setToast({ message: 'Acerto aprovado para pagamento.', type: 'success' });
                await fetchData();
            } catch (error) {
                console.error('Erro ao aprovar:', error);
                setToast({ message: 'Erro ao aprovar o acerto.', type: 'error' });
            }
        });

    const handleConfirmPayment = async () => {
        if (!payout || !tenantId || !payModalRow?.settlement) return;
        await withBusy(payModalRow.staffId, async () => {
            try {
                await payout.markSettlementAsPaid(tenantId, payModalRow.settlement!.id, {
                    paymentMethod,
                });
                setToast({ message: 'Pagamento registrado.', type: 'success' });
                setPayModalRow(null);
                await fetchData();
            } catch (error) {
                console.error('Erro ao pagar:', error);
                setToast({ message: 'Erro ao registrar o pagamento.', type: 'error' });
            }
        });
    };

    const handleCancel = async () => {
        if (!payout || !tenantId || !cancelModalRow?.settlement) return;
        if (!cancelReason.trim()) return;
        await withBusy(cancelModalRow.staffId, async () => {
            try {
                const { result } = await payout.cancelSettlement(
                    tenantId,
                    cancelModalRow.settlement!.id,
                    cancelReason,
                );
                const liberado = result.unlinkedAdvances;
                setToast({
                    message:
                        liberado > 0
                            ? `Acerto cancelado. ${liberado} vale(s) voltaram a pendente.`
                            : 'Acerto cancelado.',
                    type: 'info',
                });
                setCancelModalRow(null);
                setCancelReason('');
                await fetchData();
            } catch (error) {
                console.error('Erro ao cancelar:', error);
                setToast({ message: 'Erro ao cancelar o acerto.', type: 'error' });
            }
        });
    };

    const filteredRows = useMemo(
        () => rows.filter((r) => r.professionalName.toLowerCase().includes(searchName.toLowerCase())),
        [rows, searchName],
    );

    /**
     * KPIs somam o que está PERSISTIDO. Quando não há acerto, a
     * pré-visualização entra — mas nunca como se fosse valor já apurado,
     * porque o gestor ainda precisa aprovar.
     */
    const kpis = useMemo(() => {
        const gross: number[] = [];
        const advances: number[] = [];
        let payable = 0;
        let paid = 0;

        for (const row of filteredRows) {
            const base = row.settlement
                ? {
                      grossCommission: row.settlement.grossCommission,
                      advancesDeducted: row.settlement.advancesDeducted,
                      netPayout: row.settlement.netPayout,
                  }
                : row.preview;

            gross.push(base.grossCommission);
            advances.push(base.advancesDeducted);

            if (row.status === 'paid') paid += base.netPayout;
            else if (row.status !== 'cancelled') payable += base.netPayout;
        }

        return {
            totalGross: sumCents(gross),
            totalAdvances: sumCents(advances),
            totalToPay: sumCents([payable]),
            totalPaid: sumCents([paid]),
        };
    }, [filteredRows]);

    const renderActions = (row: PayrollRow) => {
        if (busyStaffId === row.staffId) {
            return <span className="text-xs text-slate-400">Processando...</span>;
        }

        switch (row.status) {
            case 'unsettled':
                return (
                    <button onClick={() => handleGenerateDraft(row)} className={btnPrimary}>
                        GERAR ACERTO
                    </button>
                );
            case 'draft':
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => handleApprove(row)} className={btnPrimary}>
                            APROVAR
                        </button>
                        <button
                            onClick={() => {
                                setCancelModalRow(row);
                                setCancelReason('');
                            }}
                            className={btnDanger}
                        >
                            CANCELAR
                        </button>
                    </div>
                );
            case 'approved':
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => setPayModalRow(row)} className={btnPrimary}>
                            REGISTRAR PAGAMENTO
                        </button>
                        <button
                            onClick={() => {
                                setCancelModalRow(row);
                                setCancelReason('');
                            }}
                            className={btnDanger}
                        >
                            CANCELAR
                        </button>
                    </div>
                );
            case 'paid':
            case 'cancelled':
                // `paid` e terminal (ADR-030): nenhuma ação de mutação.
                return (
                    <span className="text-xs text-slate-400 font-bold uppercase">
                        {STATUS_LABEL[row.status]}
                    </span>
                );
        }
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Repasse de Comissoes
                    </h2>
                    <p className="text-slate-500 mt-1">
                        Apuracao por regime de caixa de {startDate} ate {endDate}.
                    </p>
                </div>
                <button onClick={fetchData} className={btnGhost}>
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                    Atualizar
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Base Liquidada
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        {brl(kpis.totalGross)}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm border-l-4 border-l-red-500">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Vales Abatidos
                    </p>
                    <h3 className="text-2xl font-black text-red-500">{brl(kpis.totalAdvances)}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        A Pagar
                    </p>
                    <h3 className="text-2xl font-black text-amber-500">{brl(kpis.totalToPay)}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Pago
                    </p>
                    <h3 className="text-2xl font-black text-emerald-500">{brl(kpis.totalPaid)}</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-80">
                    <DateRangeFilter
                        startDate={startDate}
                        endDate={endDate}
                        onStartDateChange={setStartDate}
                        onEndDateChange={setEndDate}
                        showPresets={true}
                    />
                </div>
                <div className="flex-1 relative">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                        Buscar Profissional
                    </label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                            search
                        </span>
                        <input
                            type="text"
                            placeholder="Nome do profissional..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="sm:hidden px-4 py-2 border-b border-slate-100 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Deslize para ver todos os campos
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Profissional</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Taxa</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Base Liquidada</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Vales</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Liquido</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Acao</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                                        Apurando...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                                        Nenhum profissional elegivel encontrado.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => {
                                    const amounts = row.settlement
                                        ? {
                                              gross: row.settlement.grossCommission,
                                              advances: row.settlement.advancesDeducted,
                                              net: row.settlement.netPayout,
                                          }
                                        : {
                                              gross: row.preview.grossCommission,
                                              advances: row.preview.advancesDeducted,
                                              net: row.preview.netPayout,
                                          };

                                    return (
                                        <tr
                                            key={row.staffId}
                                            className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={
                                                            row.avatar ||
                                                            `https://ui-avatars.com/api/?name=${encodeURIComponent(row.professionalName)}`
                                                        }
                                                        alt={row.professionalName}
                                                        className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-800 dark:text-white block">
                                                            {row.professionalName}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">{row.role}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                                {(row.commissionRate * 100).toFixed(0)}%
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {brl(amounts.gross)}
                                            </td>
                                            <td
                                                className={`px-6 py-4 text-sm font-bold whitespace-nowrap ${
                                                    amounts.advances > 0 ? 'text-red-500' : 'text-slate-400'
                                                }`}
                                            >
                                                {amounts.advances > 0 ? `- ${brl(amounts.advances)}` : brl(0)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-base font-black text-slate-900 dark:text-white">
                                                    {brl(amounts.net)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${STATUS_STYLE[row.status]}`}
                                                >
                                                    {STATUS_LABEL[row.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {renderActions(row)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={payModalRow !== null}
                onClose={() => setPayModalRow(null)}
                title="Registrar Pagamento"
                maxWidth="md"
            >
                {payModalRow?.settlement && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-white/[0.02] p-5 rounded-xl border border-slate-200 dark:border-border-dark space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Base Liquidada:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                    {brl(payModalRow.settlement.grossCommission)}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Vales Abatidos:</span>
                                <span className="font-bold text-red-500">
                                    - {brl(payModalRow.settlement.advancesDeducted)}
                                </span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-border-dark flex justify-between items-center">
                                <span className="text-sm font-bold uppercase text-slate-900 dark:text-white tracking-wider">
                                    LIQUIDO A PAGAR
                                </span>
                                <span className="text-2xl font-black text-primary">
                                    {brl(payModalRow.settlement.netPayout)}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                                Metodo de Quitacao
                            </label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="pix">Pix</option>
                                <option value="dinheiro">Dinheiro</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setPayModalRow(null)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirmPayment}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all font-display"
                            >
                                Confirmar Pagamento
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={cancelModalRow !== null}
                onClose={() => setCancelModalRow(null)}
                title="Cancelar Acerto"
                maxWidth="md"
            >
                <div className="space-y-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Os vales vinculados a este acerto voltam a pendente e poderao ser abatidos
                        em um proximo ciclo. O motivo e obrigatorio e fica registrado no acerto.
                    </p>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">
                            Motivo
                        </label>
                        <textarea
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            rows={3}
                            placeholder="Ex.: acerto gerado em duplicidade"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-none"
                        />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={() => setCancelModalRow(null)}
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                        >
                            Voltar
                        </button>
                        <button
                            onClick={handleCancel}
                            disabled={!cancelReason.trim()}
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-lg shadow-rose-500/20 transition-all disabled:opacity-50 font-display"
                        >
                            Cancelar Acerto
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Payroll;