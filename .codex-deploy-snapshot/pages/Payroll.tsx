import React, { useState, useEffect, useCallback } from 'react';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';

interface PayrollRecord {
    id: string; // Staff id
    professionalName: string;
    role: string;
    avatar: string;
    fixedSalary: number;
    commissions: number;
    discounts: number;
    netPay: number;
    status: 'Pendente' | 'Pago';
    transactionId?: string;
}

const Payroll: React.FC = () => {
    const { user, tenantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);

    // Filtros
    const [filterMonth, setFilterMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchName, setSearchName] = useState('');

    // Modal de Pagamento
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
    const [generateReceipt, setGenerateReceipt] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const fetchData = useCallback(async () => {
        if (!tenantId || !filterMonth) return;
        setLoading(true);

        const [yearStr, monthStr] = filterMonth.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);

        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const endOfMonth = new Date(year, month, 0, 23, 59, 59).toISOString();

        try {
            // 1. Fetch Staff
            const { data: staffData } = await supabase
                .from('staff')
                .select('*')
                .eq('tenant_id', tenantId)
                .eq('status', 'active');

            if (!staffData || staffData.length === 0) {
                setPayrollRecords([]);
                setLoading(false);
                return;
            }

            // 2. Fetch paid items for the month and use comanda staff only as fallback
            const { data: commissionItemsData } = await supabase
                .from('comanda_items')
                .select(`
                    staff_id,
                    quantity,
                    unit_price,
                    comandas!inner(created_at, status, staff_id)
                `)
                .eq('tenant_id', tenantId)
                .eq('comandas.status', 'paid')
                .gte('comandas.created_at', startOfMonth)
                .lte('comandas.created_at', endOfMonth);

            // 3. Fetch specific payroll payments in transactions 
            const { data: transactionsData } = await supabase
                .from('transactions')
                .select('id, description, amount')
                .eq('tenant_id', tenantId)
                .eq('type', 'expense')
                .eq('category', 'Pessoal')
                .gte('date', startOfMonth)
                .lte('date', endOfMonth);

            // Map data
            const records: PayrollRecord[] = staffData.map((staff: any) => {
                // Calculate commissions
                let staffCommissions = 0;
                if (commissionItemsData) {
                    const staffSales = commissionItemsData.filter((item: any) => {
                        const effectiveStaffId = item.staff_id || item.comandas?.staff_id || null;
                        return effectiveStaffId === staff.id;
                    });
                    const totalSales = staffSales.reduce((acc: number, curr: any) => {
                        const quantity = Number(curr.quantity || 0);
                        const unitPrice = Number(curr.unit_price || 0);
                        return acc + (quantity * unitPrice);
                    }, 0);
                    // if commission_rate is 40%
                    const rate = Number(staff.commission_rate || 40) / 100;
                    staffCommissions = totalSales * rate;
                }

                // Temporary vales/discounts mock as 0 for now unless we add an 'expenses' loop
                const fixed = Number(staff.fixed_salary || 0);
                const discounts = 0;
                let netPay = fixed + staffCommissions - discounts;

                // Check if already paid
                // We use description "Folha - [StaffId] - [YYYY-MM]" to identify
                const payrollDesc = `Folha - ${staff.id} - ${filterMonth}`;
                const paymentTx = transactionsData?.find((tx: any) => tx.description === payrollDesc);

                if (paymentTx) {
                    // netPay = Number(paymentTx.amount); // use the exact paid amount if already paid?
                }

                return {
                    id: staff.id,
                    professionalName: staff.name,
                    role: staff.role || 'Profissional',
                    avatar: staff.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff.name)}`,
                    fixedSalary: fixed,
                    commissions: staffCommissions,
                    discounts: discounts,
                    netPay: netPay,
                    status: paymentTx ? 'Pago' : 'Pendente',
                    transactionId: paymentTx?.id
                };
            });

            setPayrollRecords(records);

        } catch (error) {
            console.error('Error computing payroll:', error);
            setToast({ message: 'Erro ao carregar dados da folha.', type: 'error' });
        }

        setLoading(false);
    }, [tenantId, filterMonth]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openPaymentModal = (record: PayrollRecord) => {
        if (record.status === 'Pago') return;
        setSelectedRecord(record);
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = async () => {
        if (!selectedRecord || !user || !tenantId) return;

        try {
            const payrollDesc = `Folha - ${selectedRecord.id} - ${filterMonth}`;

            // Insert into transactions to mark as Paid
            const { error: txError } = await supabase.from('transactions').insert({
                user_id: user.id,
                type: 'expense',
                category: 'Pessoal',
                amount: selectedRecord.netPay,
                description: payrollDesc,
                payment_method: 'Transferência', // Default
                date: new Date().toISOString(),
                tenant_id: tenantId
            });

            if (txError) throw txError;

            // Simple receipt alert since receipts table doesn't exist yet
            if (generateReceipt) {
                setToast({ message: 'Pagamento concluído e recibo simulado.', type: 'success' });
            } else {
                setToast({ message: 'Folha paga com sucesso!', type: 'success' });
            }

            setIsPaymentModalOpen(false);
            fetchData(); // Refresh list
        } catch (error: any) {
            console.error('Payment error:', error);
            setToast({ message: 'Erro ao processar pagamento.', type: 'error' });
        }
    };

    // Filter Logic
    const filteredRecords = payrollRecords.filter(record =>
        record.professionalName.toLowerCase().includes(searchName.toLowerCase())
    );

    // KPIs
    const totalToPay = filteredRecords.filter(r => r.status === 'Pendente').reduce((acc, curr) => acc + curr.netPay, 0);
    const totalPaid = filteredRecords.filter(r => r.status === 'Pago').reduce((acc, curr) => acc + curr.netPay, 0);
    const totalCommissions = filteredRecords.reduce((acc, curr) => acc + curr.commissions, 0);
    const totalDiscounts = filteredRecords.reduce((acc, curr) => acc + curr.discounts, 0);

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Folha de Pagamento</h2>
                    <p className="text-slate-500 mt-1">Gestão de salários, comissões de {filterMonth.split('-')[1]}/{filterMonth.split('-')[0]}.</p>
                </div>
                {/* No 'Criar Folha' button needed since we dynamically compute it */}
                <button onClick={fetchData} className="bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-white px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
                    <span className="material-symbols-outlined text-[20px]">refresh</span>
                    Atualizar Cálculo
                </button>
            </div>

            {/* Resumo Financeiro (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pendente (Para Pagar)</p>
                    <h3 className="text-2xl font-black text-amber-500">R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pago</p>
                    <h3 className="text-2xl font-black text-emerald-500">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissões Calculadas</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm border-l-4 border-l-red-500">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vales (Lançados manual)</p>
                    <h3 className="text-2xl font-black text-red-500">R$ {totalDiscounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
            </div>

            {/* Filtros */}
            <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-64">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Mês de Referência</label>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                </div>
                <div className="flex-1 relative">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar Colaborador</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Nome do colaborador..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* Tabela de Folha */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="sm:hidden px-4 py-2 border-b border-slate-100 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Deslize para ver toda a folha
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[940px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Profissional</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Cargo</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Salário Fixo</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Comissões</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Descontos</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Líquido a Pagar</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">Calculando folha...</td>
                                </tr>
                            ) : filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">Nenhum profissional encontrado.</td>
                                </tr>
                            ) : filteredRecords.map((record) => (
                                <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img src={record.avatar} alt={record.professionalName} className="w-10 h-10 rounded-full border border-slate-200 dark:border-slate-700 object-cover" />
                                            <span className="text-sm font-bold text-slate-800 dark:text-white">{record.professionalName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-xs font-bold text-slate-500 px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-md">{record.role}</span>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                        R$ {record.fixedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                        + R$ {record.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-red-500 whitespace-nowrap">
                                        - R$ {record.discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-base font-black text-slate-900 dark:text-white">
                                            R$ {record.netPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${record.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20' :
                                            'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20'
                                            }`}>
                                            <span className={`size-1.5 rounded-full ${record.status === 'Pago' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                            {record.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        {record.status === 'Pendente' ? (
                                            <button
                                                onClick={() => openPaymentModal(record)}
                                                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 text-xs font-bold rounded-lg transition-colors shadow-md"
                                            >
                                                <span className="sm:hidden">PAGAR</span>
                                                <span className="hidden sm:inline">PAGAR E RECIBO</span>
                                            </button>
                                        ) : (
                                            <button className="px-4 py-2 bg-slate-100 dark:bg-white/5 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed">
                                                PAGO
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Confirmação de Pagamento */}
            <Modal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                title="Confirmar Pagamento da Folha"
                maxWidth="md"
            >
                {selectedRecord && (
                    <div className="space-y-6">
                        {/* Resumo do Cálculo */}
                        <div className="bg-slate-50 dark:bg-white/[0.02] p-5 rounded-xl border border-slate-200 dark:border-border-dark space-y-3">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Salário Fixo:</span>
                                <span className="font-bold text-slate-900 dark:text-white">R$ {selectedRecord.fixedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Comissões (Ganhos):</span>
                                <span className="font-bold text-emerald-600">+ R$ {selectedRecord.commissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Descontos / Vales:</span>
                                <span className="font-bold text-red-500">- R$ {selectedRecord.discounts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="pt-3 mt-3 border-t border-slate-200 dark:border-border-dark flex justify-between items-center">
                                <span className="text-sm font-bold uppercase text-slate-900 dark:text-white tracking-wider">LÍQUIDO A PAGAR</span>
                                <span className="text-2xl font-black text-primary">R$ {selectedRecord.netPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Opções de Automação */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                            <label className="flex items-start gap-3 cursor-pointer opacity-50 cursor-not-allowed">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={true}
                                        disabled
                                        className="size-4 rounded text-primary focus:ring-primary border-slate-300"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Gerar Recibo Automaticamente</p>
                                    <p className="text-xs text-slate-500 mt-1">Ao marcar esta opção, um recibo oficial será criado assim que a funcionalidade avançada de recibos estiver publicada.</p>
                                </div>
                            </label>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setIsPaymentModalOpen(false)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                            >
                                Cancelar
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

        </div>
    );
};

export default Payroll;
