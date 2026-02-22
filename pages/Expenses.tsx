import React, { useState } from 'react';
import Toast from '../components/Toast';

interface Expense {
    id: number;
    description: string;
    category: string;
    amount: number;
    date: string;
    status: 'paid' | 'pending';
    receiptUrl?: string;
}

const initialExpenses: Expense[] = [
    { id: 1, description: 'Aluguel Sala Comercial', category: 'Infraestrutura', amount: 2500.00, date: '2023-10-05', status: 'paid' },
    { id: 2, description: 'Conta de Energia (Enel)', category: 'Utilidades', amount: 450.20, date: '2023-10-10', status: 'pending' },
    { id: 3, description: 'Compra de Shampoos', category: 'Estoque', amount: 890.50, date: '2023-10-12', status: 'paid' },
    { id: 4, description: 'Internet Fibra', category: 'Utilidades', amount: 129.90, date: '2023-10-15', status: 'paid' },
    { id: 5, description: 'Manutenção Cadeiras', category: 'Manutenção', amount: 350.00, date: '2023-10-20', status: 'pending' },
];

const Expenses: React.FC = () => {
    const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<'all' | 'paid' | 'pending'>('all');
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        description: '',
        category: 'Outros',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
    });

    const openEditModal = (expense: Expense) => {
        setEditingExpense(expense);
        setFormData({
            description: expense.description,
            category: expense.category,
            amount: expense.amount.toString(),
            date: expense.date,
            status: expense.status,
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingExpense(null);
        setFormData({ description: '', category: 'Outros', amount: '', date: new Date().toISOString().split('T')[0], status: 'pending' });
        setIsModalOpen(true);
    };

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingExpense) {
            // Update existing
            setExpenses(prev => prev.map(exp => exp.id === editingExpense.id ? {
                ...exp,
                description: formData.description,
                category: formData.category,
                amount: parseFloat(formData.amount),
                date: formData.date,
                status: formData.status as 'paid' | 'pending',
            } : exp));
            setToast({ message: 'Despesa atualizada!', type: 'success' });
        } else {
            // Create new
            const newExpense: Expense = {
                id: Date.now(),
                description: formData.description,
                category: formData.category,
                amount: parseFloat(formData.amount),
                date: formData.date,
                status: formData.status as 'paid' | 'pending'
            };
            setExpenses([newExpense, ...expenses]);
            setToast({ message: 'Despesa adicionada!', type: 'success' });
        }
        setIsModalOpen(false);
        setEditingExpense(null);
        setFormData({ description: '', category: 'Outros', amount: '', date: new Date().toISOString().split('T')[0], status: 'pending' });
    };

    const handleDelete = (id: number) => {
        setExpenses(prev => prev.filter(exp => exp.id !== id));
        setToast({ message: 'Despesa removida.', type: 'info' });
    };

    const filteredExpenses = expenses.filter(exp => {
        const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exp.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || exp.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    // KPIs
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const paidTotal = expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0);
    const pendingTotal = expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + e.amount, 0);

    return (
        <div className="space-y-8 animate-fade-in relative">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Gestão de Saídas</h2>
                    <p className="text-slate-500 mt-1">Controle detalhado de todas as despesas da barbearia.</p>
                </div>
                <button
                    onClick={openNewModal}
                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-500/20 transition-all"
                >
                    <span className="material-symbols-outlined">add_circle</span>
                    + NOVA SAÍDA
                </button>
            </div>

            {/* KPI summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-red-500">payments</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total de Saídas</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {totalExpenses.toFixed(2).replace('.', ',')}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pagas</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {paidTotal.toFixed(2).replace('.', ',')}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-amber-500">schedule</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendentes</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {pendingTotal.toFixed(2).replace('.', ',')}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        placeholder="Buscar despesa..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
                    {(['all', 'paid', 'pending'] as const).map(st => {
                        const labels: Record<string, string> = { all: 'Todas', paid: 'Pagas', pending: 'Pendentes' };
                        return (
                            <button
                                key={st}
                                onClick={() => setFilterStatus(st)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === st
                                    ? 'bg-primary text-white shadow-md'
                                    : 'bg-white dark:bg-transparent border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                    }`}
                            >
                                {labels[st]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Expenses Table */}
            <div className="bg-white dark:bg-surface-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Categoria</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{expense.description}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">
                                        R$ {expense.amount.toFixed(2)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${expense.status === 'paid'
                                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                            }`}>
                                            <span className={`size-1.5 rounded-full ${expense.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                            {expense.status === 'paid' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button onClick={() => openEditModal(expense)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-2" title="Editar">
                                            <span className="material-symbols-outlined">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Excluir">
                                            <span className="material-symbols-outlined">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Nenhuma despesa encontrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-6 py-4 border-t border-slate-200 dark:border-border-dark">
                    <p className="text-xs text-slate-500">Mostrando {filteredExpenses.length} de {expenses.length} despesas</p>
                </div>
            </div>

            {/* Add/Edit Expense Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm overflow-y-auto animate-fade-in">
                    <div className="my-auto bg-white dark:bg-card-dark w-full max-w-lg rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden flex flex-col max-h-[90vh] sm:max-h-[85vh]">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-slate-50 dark:bg-white/5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-500">remove_circle</span>
                                {editingExpense ? 'Editar Despesa' : 'Nova Saída'}
                            </h3>
                            <button onClick={() => { setIsModalOpen(false); setEditingExpense(null); }} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 min-h-0">
                            <form onSubmit={handleSave} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Descrição</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="Ex: Compra de Toalhas"
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Valor (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            placeholder="0.00"
                                            value={formData.amount}
                                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data</label>
                                        <input
                                            type="date"
                                            required
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Categoria</label>
                                    <select
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-[#1A1A1A] border border-slate-200 dark:border-white/10 rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none [color-scheme:light] dark:[color-scheme:dark]"
                                    >
                                        <option value="Infraestrutura" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Infraestrutura</option>
                                        <option value="Utilidades" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Utilidades (Luz/Água/Net)</option>
                                        <option value="Estoque" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Estoque / Produtos</option>
                                        <option value="Manutenção" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Manutenção</option>
                                        <option value="Marketing" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Marketing</option>
                                        <option value="Pessoal" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Pessoal / Salários</option>
                                        <option value="Impostos" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Impostos</option>
                                        <option value="Outros" className="bg-white dark:bg-[#1A1A1A] text-slate-900 dark:text-white">Outros</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Status</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="paid"
                                                checked={formData.status === 'paid'}
                                                onChange={() => setFormData({ ...formData, status: 'paid' })}
                                                className="text-emerald-500 focus:ring-emerald-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pago</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="status"
                                                value="pending"
                                                checked={formData.status === 'pending'}
                                                onChange={() => setFormData({ ...formData, status: 'pending' })}
                                                className="text-amber-500 focus:ring-amber-500"
                                            />
                                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Pendente</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => { setIsModalOpen(false); setEditingExpense(null); }}
                                        className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                                    >
                                        {editingExpense ? 'Atualizar' : 'Salvar Despesa'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Expenses;