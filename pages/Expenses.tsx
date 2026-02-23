import React, { useState, useEffect, useCallback } from 'react';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    status: 'paid' | 'pending';
    receipt_url?: string;
}

const Expenses: React.FC = () => {
    const { user, tenantId } = useAuth();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
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

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('type', 'expense')
            .order('date', { ascending: false });

        if (error) {
            console.error('Error fetching expenses:', error);
        } else if (data) {
            // Map table columns to interface columns if necessary
            // Assuming table has description, category, amount, date, status, type
            setExpenses(data.map((item: any) => ({
                id: item.id,
                description: item.description || item.desc || '',
                category: item.category || 'Outros',
                amount: Number(item.amount || item.val || 0),
                date: item.date,
                status: item.status || 'paid', // Default to paid if not specified
            })));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = {
            description: formData.description,
            category: formData.category,
            amount: parseFloat(formData.amount),
            date: formData.date,
            status: formData.status,
            type: 'expense',
            method: 'Dinheiro', // Default for expenses if not specified
            tenant_id: tenantId
        };

        if (editingExpense) {
            const { error } = await supabase
                .from('transactions')
                .update(payload)
                .eq('id', editingExpense.id);

            if (error) {
                setToast({ message: 'Erro ao atualizar despesa.', type: 'error' });
            } else {
                setToast({ message: 'Despesa atualizada!', type: 'success' });
                fetchExpenses();
                setIsModalOpen(false);
            }
        } else {
            const { error } = await supabase
                .from('transactions')
                .insert(payload);

            if (error) {
                setToast({ message: 'Erro ao cadastrar despesa.', type: 'error' });
            } else {
                setToast({ message: 'Despesa cadastrada!', type: 'success' });
                fetchExpenses();
                setIsModalOpen(false);
            }
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) {
            setToast({ message: 'Erro ao remover despesa.', type: 'error' });
        } else {
            setToast({ message: 'Despesa removida.', type: 'info' });
            fetchExpenses();
        }
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
        <div className="space-y-8 animate-fade-in relative pb-10">
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
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-emerald-500">check_circle</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pagas</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {paidTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-amber-500">schedule</span>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendentes</p>
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">R$ {pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4 items-center justify-between">
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
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
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
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">Carregando despesas...</td>
                                </tr>
                            ) : filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-sm font-bold">{expense.description}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold">
                                        R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
                                            <span className="material-symbols-outlined text-lg">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-500 transition-colors p-2" title="Excluir">
                                            <span className="material-symbols-outlined text-lg">delete</span>
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
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
                title={editingExpense ? 'Editar Despesa' : 'Nova Saída'}
                maxWidth="lg"
            >
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
                            <option value="Infraestrutura">Infraestrutura</option>
                            <option value="Utilidades">Utilidades (Luz/Água/Net)</option>
                            <option value="Estoque">Estoque / Produtos</option>
                            <option value="Manutenção">Manutenção</option>
                            <option value="Marketing">Marketing</option>
                            <option value="Pessoal">Pessoal / Salários</option>
                            <option value="Impostos">Impostos</option>
                            <option value="Outros">Outros</option>
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
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-display"
                        >
                            {editingExpense ? 'Atualizar' : 'Salvar Despesa'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default Expenses;