import React, { useState } from 'react';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface PayrollRecord {
    id: string;
    professionalName: string;
    role: string;
    avatar: string;
    fixedSalary: number;
    commissions: number;
    discounts: number;
    netPay: number;
    status: 'Pendente' | 'Pago';
}

const mockPayroll: PayrollRecord[] = [
    {
        id: '1',
        professionalName: 'Marcus Vinícius',
        role: 'Barbeiro Sênior',
        avatar: 'https://i.pravatar.cc/150?u=marcus',
        fixedSalary: 0,
        commissions: 3500.00,
        discounts: 150.00, // Vale 
        netPay: 3350.00,
        status: 'Pendente'
    },
    {
        id: '2',
        professionalName: 'Ana Souza',
        role: 'Recepcionista',
        avatar: 'https://i.pravatar.cc/150?u=ana',
        fixedSalary: 2500.00,
        commissions: 150.00,
        discounts: 0,
        netPay: 2650.00,
        status: 'Pago'
    },
    {
        id: '3',
        professionalName: 'Carlos Silva',
        role: 'Barbeiro',
        avatar: 'https://i.pravatar.cc/150?u=carlos',
        fixedSalary: 0,
        commissions: 2800.00,
        discounts: 300.00, // Materiais/Adiantamento
        netPay: 2500.00,
        status: 'Pendente'
    }
];

const Payroll: React.FC = () => {
    const { user } = useAuth();

    // Filtros
    const [filterMonth, setFilterMonth] = useState('2026-02');
    const [searchName, setSearchName] = useState('');

    // Modal de Pagamento
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<PayrollRecord | null>(null);
    const [generateReceipt, setGenerateReceipt] = useState(true);

    // Filter Logic
    const filteredRecords = mockPayroll.filter(record =>
        record.professionalName.toLowerCase().includes(searchName.toLowerCase())
    );

    // KPIs
    const totalToPay = filteredRecords.filter(r => r.status === 'Pendente').reduce((acc, curr) => acc + curr.netPay, 0);
    const totalPaid = filteredRecords.filter(r => r.status === 'Pago').reduce((acc, curr) => acc + curr.netPay, 0);
    const totalCommissions = filteredRecords.reduce((acc, curr) => acc + curr.commissions, 0);
    const totalDiscounts = filteredRecords.reduce((acc, curr) => acc + curr.discounts, 0);

    const openPaymentModal = (record: PayrollRecord) => {
        setSelectedRecord(record);
        setIsPaymentModalOpen(true);
    };

    const handleConfirmPayment = () => {
        // Lógica de Integração aqui:
        // 1. Atualizar status na tabela "payroll" ou "transactions"
        // 2. Se `generateReceipt` for true -> Inserir na tabela "receipts"

        setIsPaymentModalOpen(false);
        // Toast("Pagamento confirmado!")
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Folha de Pagamento</h2>
                    <p className="text-slate-500 mt-1">Gestão de salários, comissões e emissão de recibos automáticos.</p>
                </div>
            </div>

            {/* Resumo Financeiro (KPIs) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pendente (APagar)</p>
                    <h3 className="text-2xl font-black text-amber-500">R$ {totalToPay.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total Pago (Mês)</p>
                    <h3 className="text-2xl font-black text-emerald-500">R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissões Geradas</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm border-l-4 border-l-red-500">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Total de Descontos/Vales</p>
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
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar Profissional</label>
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
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
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
                            {filteredRecords.map((record) => (
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
                                                PAGAR E RECIBO
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
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={generateReceipt}
                                        onChange={(e) => setGenerateReceipt(e.target.checked)}
                                        className="size-4 rounded text-primary focus:ring-primary border-slate-300"
                                    />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">Gerar Recibo Automaticamente</p>
                                    <p className="text-xs text-slate-500 mt-1">Ao marcar esta opção, um recibo oficial será criado na tela de "Gestão de Recibos" constando este pagamento, com assinatura digital vinculada.</p>
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
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20 transition-all"
                            >
                                {generateReceipt ? 'Confirmar e Gerar Recibo' : ' Confirmar Pagamento'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
};

export default Payroll;
