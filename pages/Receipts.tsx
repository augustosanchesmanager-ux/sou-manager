import React, { useState } from 'react';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface Receipt {
    id: string;
    number: string;
    date: string;
    type: 'Salário' | 'Fornecedor' | 'Compra' | 'Despesa';
    name: string;
    amount: number;
    paymentMethod: string;
    status: 'Pago' | 'Pendente' | 'Cancelado';
}

const mockReceipts: Receipt[] = [
    { id: '1', number: 'REC-2026-001', date: '2026-02-24', type: 'Salário', name: 'João Silva', amount: 2500, paymentMethod: 'PIX', status: 'Pago' },
    { id: '2', number: 'REC-2026-002', date: '2026-02-23', type: 'Fornecedor', name: 'Distribuidora XYZ', amount: 850, paymentMethod: 'Boleto', status: 'Pendente' },
    { id: '3', number: 'REC-2026-003', date: '2026-02-22', type: 'Despesa', name: 'Energia Elétrica', amount: 350.50, paymentMethod: 'Débito Automático', status: 'Pago' },
    { id: '4', number: 'REC-2026-004', date: '2026-02-21', type: 'Compra', name: 'Equipamentos', amount: 1200, paymentMethod: 'Cartão de Crédito', status: 'Cancelado' },
];

const Receipts: React.FC = () => {
    const { user } = useAuth();

    // Filters State
    const [filterType, setFilterType] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [filterPeriodStart, setFilterPeriodStart] = useState('');
    const [filterPeriodEnd, setFilterPeriodEnd] = useState('');
    const [searchName, setSearchName] = useState('');

    // Modal / View State
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);

    // Filter Logic
    const filteredReceipts = mockReceipts.filter(receipt => {
        const matchType = filterType === 'Todos' || receipt.type === filterType;
        const matchStatus = filterStatus === 'Todos' || receipt.status === filterStatus;
        const matchName = receipt.name.toLowerCase().includes(searchName.toLowerCase()) ||
            receipt.number.toLowerCase().includes(searchName.toLowerCase());

        let matchPeriod = true;
        if (filterPeriodStart) {
            matchPeriod = matchPeriod && new Date(receipt.date) >= new Date(filterPeriodStart);
        }
        if (filterPeriodEnd) {
            matchPeriod = matchPeriod && new Date(receipt.date) <= new Date(filterPeriodEnd);
        }

        return matchType && matchStatus && matchName && matchPeriod;
    });

    const openViewModal = (receipt: Receipt) => {
        setSelectedReceipt(receipt);
        setIsViewModalOpen(true);
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 animate-fade-in relative pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestão de Recibos</h2>
                    <p className="text-slate-500 mt-1">Emissão, controle e impressão de recibos da barbearia.</p>
                </div>
                <button
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/20 transition-all"
                >
                    <span className="material-symbols-outlined">receipt_long</span>
                    + EMITIR NOVO RECIBO
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-card-dark p-6 rounded-2xl border border-slate-200 dark:border-border-dark shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* Search */}
                    <div className="lg:col-span-2 relative">
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar (Nome / Nº)</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                            <input
                                type="text"
                                placeholder="Buscar recibo..."
                                value={searchName}
                                onChange={(e) => setSearchName(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Tipo</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="Todos">Todos os Tipos</option>
                            <option value="Salário">Salário</option>
                            <option value="Fornecedor">Fornecedor</option>
                            <option value="Compra">Compra</option>
                            <option value="Despesa">Despesa</option>
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none cursor-pointer"
                        >
                            <option value="Todos">Todos os Status</option>
                            <option value="Pago">Pago</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>
                    </div>

                    {/* Button */}
                    <div className="flex items-end">
                        <button className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-slate-900 font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-[18px]">filter_list</span>
                            Filtrar
                        </button>
                    </div>
                </div>

                {/* Period - optional second row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Data Inicial</label>
                        <input
                            type="date"
                            value={filterPeriodStart}
                            onChange={(e) => setFilterPeriodStart(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Data Final</label>
                        <input
                            type="date"
                            value={filterPeriodEnd}
                            onChange={(e) => setFilterPeriodEnd(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 px-4 text-sm focus:ring-1 focus:ring-primary outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Nº do Recibo</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Data</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Tipo</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Nome</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Forma de Pgto</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Valor</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                                <th className="px-6 py-5 text-[11px] font-black text-slate-500 uppercase tracking-widest whitespace-nowrap text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {filteredReceipts.length > 0 ? filteredReceipts.map((receipt) => (
                                <tr key={receipt.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="material-symbols-outlined text-slate-300 dark:text-slate-600">receipt</span>
                                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary transition-colors">{receipt.number}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                        {new Date(receipt.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2.5 py-1 rounded-md text-xs font-bold border ${receipt.type === 'Salário' ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' :
                                            receipt.type === 'Fornecedor' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20' :
                                                receipt.type === 'Compra' ? 'bg-fuchsia-50 text-fuchsia-600 border-fuchsia-100 dark:bg-fuchsia-500/10 dark:text-fuchsia-400 dark:border-fuchsia-500/20' :
                                                    'bg-slate-100 text-slate-600 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20'
                                            }`}>
                                            {receipt.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[150px]">{receipt.name}</p>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="material-symbols-outlined text-[16px] opacity-70">
                                                {receipt.paymentMethod.includes('Cartão') ? 'credit_card' :
                                                    receipt.paymentMethod === 'PIX' ? 'pix' : 'payments'}
                                            </span>
                                            {receipt.paymentMethod}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="text-[15px] font-black text-slate-900 dark:text-white">
                                            R$ {receipt.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${receipt.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-500 dark:border-emerald-500/20' :
                                            receipt.status === 'Pendente' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-500 dark:border-amber-500/20' :
                                                'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-500 dark:border-red-500/20'
                                            }`}>
                                            <span className={`size-1.5 rounded-full ${receipt.status === 'Pago' ? 'bg-emerald-500' :
                                                receipt.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'
                                                }`}></span>
                                            {receipt.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <button onClick={() => openViewModal(receipt)} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors" title="Visualizar">
                                                <span className="material-symbols-outlined text-[20px]">visibility</span>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors" title="Imprimir">
                                                <span className="material-symbols-outlined text-[20px]">print</span>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-400 rounded-lg transition-colors" title="Baixar PDF">
                                                <span className="material-symbols-outlined text-[20px]">picture_as_pdf</span>
                                            </button>
                                            <button className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 rounded-lg transition-colors" title="Reemitir">
                                                <span className="material-symbols-outlined text-[20px]">cached</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                                        <div className="flex flex-col items-center justify-center gap-3">
                                            <span className="material-symbols-outlined text-4xl text-slate-300 dark:text-slate-700">receipt_long</span>
                                            <p>Nenhum recibo encontrado com os filtros selecionados.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/[0.02]">
                    <p className="text-xs font-medium text-slate-500">Mostrando {filteredReceipts.length} de {mockReceipts.length} registros</p>
                </div>
            </div>

            {/* View Receipt Modal */}
            <Modal
                isOpen={isViewModalOpen}
                onClose={() => setIsViewModalOpen(false)}
                title="Visualização do Recibo"
                maxWidth="3xl"
            >
                {/* Visualização Realista do Recibo */}
                <div className="bg-white p-8 md:p-12 border border-slate-200 shadow-xl relative w-full mx-auto text-slate-800 font-sans print:shadow-none print:border-none">
                    {/* Top border decorativo */}
                    <div className="absolute top-0 left-0 w-full h-3 bg-slate-900 print:bg-black"></div>

                    {/* Watermark/Marca D'água */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] print:opacity-[0.05] z-0 overflow-hidden">
                        <span className="text-7xl font-black text-slate-900 -rotate-45 whitespace-nowrap select-none">
                            DOCUMENTO GERADO PELO SOU MANA.GER
                        </span>
                    </div>

                    {/* Conteúdo com position relative para ficar acima da marca d'água */}
                    <div className="relative z-10">
                        {/* Cabeçalho */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 pb-8 border-b-2 border-slate-100 gap-6">
                            <div className="flex items-center gap-4">
                                {user?.user_metadata?.logo_url ? (
                                    <img src={user.user_metadata.logo_url} alt="Logo" className="w-20 h-20 object-contain rounded-lg shadow-sm print:shadow-none bg-white" />
                                ) : (
                                    <div className="bg-slate-900 text-white w-16 h-16 flex items-center justify-center font-black text-2xl tracking-tighter shrink-0 print:border print:border-black print:text-black print:bg-transparent">
                                        SM
                                    </div>
                                )}
                                <div>
                                    <h2 className="text-2xl font-black uppercase tracking-wider text-slate-900">{user?.user_metadata?.company_name || 'Sou Mana.ger'}</h2>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Barbearia Premium</p>
                                    <div className="text-xs text-slate-500 mt-2 space-y-0.5 opacity-80">
                                        <p>CNPJ: {user?.user_metadata?.cnpj || '00.000.000/0001-00'}</p>
                                        <p>{user?.user_metadata?.address || 'Av. Principal, 1000 - Centro'}</p>
                                        <p>{user?.user_metadata?.city || 'Cidade - Estado'}, {user?.user_metadata?.zip_code || '00000-000'}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="sm:text-right w-full sm:w-auto p-4 sm:p-0 bg-slate-50 sm:bg-transparent rounded-lg sm:rounded-none border sm:border-none border-slate-100">
                                <h1 className="text-3xl font-light text-slate-300 tracking-widest uppercase mb-1 print:text-slate-400">Recibo</h1>
                                <p className="text-xl font-bold text-slate-900">{selectedReceipt?.number || 'REC-000000'}</p>
                                <p className="text-sm text-slate-500 mt-2"><b>Data:</b> {selectedReceipt ? new Date(selectedReceipt.date).toLocaleDateString('pt-BR') : '--/--/----'}</p>
                            </div>
                        </div>

                        {/* Área de Valor */}
                        <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl mb-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor do Recibo</span>
                                <span className="text-4xl font-black text-slate-900 tabular-nums">
                                    R$ {selectedReceipt?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="text-left sm:text-right max-w-xs">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Status</span>
                                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest border ${selectedReceipt?.status === 'Pago' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                    selectedReceipt?.status === 'Pendente' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                        'bg-red-50 text-red-600 border-red-200'
                                    }`}>
                                    <span className={`size-1.5 rounded-full ${selectedReceipt?.status === 'Pago' ? 'bg-emerald-500' :
                                        selectedReceipt?.status === 'Pendente' ? 'bg-amber-500' : 'bg-red-500'
                                        }`}></span>
                                    {selectedReceipt?.status}
                                </span>
                            </div>
                        </div>

                        {/* Corpo */}
                        <div className="space-y-6 text-[15px] leading-relaxed text-slate-700 bg-white">
                            <p className="text-lg">
                                Recebi(emos) de <span className="font-bold text-slate-900 text-lg uppercase px-1">Sou Mana.ger Barbearia Premium</span>, a quantia de <span className="font-bold text-slate-900 text-lg underline decoration-slate-200 underline-offset-4 px-1">R$ {selectedReceipt?.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (valor por extenso).
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Referente a (Tipo)</span>
                                    <span className="font-medium text-slate-900 text-lg">{selectedReceipt?.type}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome do Recebedor</span>
                                    <span className="font-medium text-slate-900 text-lg">{selectedReceipt?.name}</span>
                                </div>
                                <div className="sm:col-span-2">
                                    <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Forma de Pagamento</span>
                                    <div className="flex items-center gap-2 font-medium text-slate-900">
                                        <span className="material-symbols-outlined text-slate-400 text-[20px]">
                                            {selectedReceipt?.paymentMethod.includes('Cartão') ? 'credit_card' :
                                                selectedReceipt?.paymentMethod === 'PIX' ? 'pix' : 'payments'}
                                        </span>
                                        {selectedReceipt?.paymentMethod}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé / Assinatura */}
                        <div className="mt-24 pt-10 flex flex-col md:flex-row justify-between items-center gap-12">
                            <div className="text-center w-full max-w-xs relative">
                                {/* Assinatura Digital do Recebedor (Simulação) */}
                                {selectedReceipt?.status === 'Pago' && (
                                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                        <div className="font-[Sriracha] text-3xl text-slate-700 opacity-80 -rotate-3 select-none">
                                            {selectedReceipt?.name}
                                        </div>
                                        <div className="border border-emerald-500 text-emerald-600 bg-emerald-50 text-[8px] font-bold px-2 py-0.5 rounded-sm mt-2 uppercase tracking-widest shadow-sm rotate-2">
                                            ✔ Assinado Eletronicamente
                                        </div>
                                    </div>
                                )}
                                <div className="border-t border-slate-300 mb-3 relative z-10"></div>
                                <p className="font-bold text-slate-900 uppercase text-sm relative z-10">{selectedReceipt?.name}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 relative z-10">Assinatura do Recebedor</p>
                            </div>
                            <div className="text-center w-full max-w-xs relative">
                                {/* Assinatura Digital do Emissor (Simulação logada) */}
                                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center">
                                    <div className="border border-blue-500 text-blue-600 bg-blue-50 text-[8px] font-bold px-2 py-0.5 rounded-sm mt-2 uppercase tracking-widest shadow-sm -rotate-2">
                                        ✔ Autenticado: {user?.user_metadata?.company_name || 'Sou Mana.ger'}
                                        <br /> IP: 192.168.1.1
                                    </div>
                                </div>
                                <div className="border-t border-slate-300 mb-3 relative z-10"></div>
                                <p className="font-bold text-slate-900 uppercase text-sm relative z-10">{user?.user_metadata?.company_name || 'Sou Mana.ger'}</p>
                                <p className="text-xs text-slate-500 uppercase tracking-wider mt-1 relative z-10">Emissor</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="mt-6 flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark print:hidden">
                    <button
                        onClick={() => setIsViewModalOpen(false)}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                    >
                        Fechar
                    </button>
                    <button className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
                        Exportar PDF
                    </button>
                    <button
                        onClick={handlePrint}
                        className="px-6 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-[18px]">print</span>
                        Imprimir Recibo
                    </button>
                </div>
            </Modal>

        </div>
    );
};

export default Receipts;
