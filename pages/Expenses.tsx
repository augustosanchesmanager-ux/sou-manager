import React, { useState, useEffect, useCallback } from 'react';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { transactionRepository } from '../domain/transaction';
import { useAuth } from '../context/AuthContext';
import AccountsPayableWidget from '../components/AccountsPayableWidget';

interface Expense {
    id: string;
    description: string;
    category: string;
    amount: number;
    date: string;
    status: 'paid' | 'pending';
    receipt_url?: string;
}

const getTodayIsoDate = () => new Date().toISOString().split('T')[0];

const normalizeDateForInput = (value?: string | null) => {
    if (!value) return getTodayIsoDate();
    return value.includes('T') ? value.split('T')[0] : value;
};

const normalizeDateForDb = (value: string) => {
    if (!value) return new Date().toISOString();
    return value.includes('T') ? value : new Date(`${value}T00:00:00`).toISOString();
};

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
        date: getTodayIsoDate(),
        status: 'pending'
    });

    const fetchExpenses = useCallback(async () => {
        if (!tenantId) {
            setExpenses([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const data = await transactionRepository.list(tenantId, { type: 'expense' });
            setExpenses(data.map((item) => ({
                id: item.id,
                description: item.description || '',
                category: item.category || 'Outros',
                amount: Number(item.amount || 0),
                date: item.date || item.created_at || new Date().toISOString(),
                status: (item.status as 'paid' | 'pending') || 'paid',
            })));
        } catch (err) {
            console.error('Error fetching expenses:', err);
        }
        setLoading(false);
    }, [tenantId]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    const openEditModal = (expense: Expense) => {
        setEditingExpense(expense);
        setFormData({
            description: expense.description,
            category: expense.category,
            amount: expense.amount.toString(),
            date: normalizeDateForInput(expense.date),
            status: expense.status,
        });
        setIsModalOpen(true);
    };

    const openNewModal = () => {
        setEditingExpense(null);
        setFormData({ description: '', category: 'Outros', amount: '', date: getTodayIsoDate(), status: 'pending' });
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!tenantId || !user) {
            setToast({ message: 'Sessao invalida para cadastrar despesa.', type: 'error' });
            return;
        }

        const amount = parseFloat(formData.amount);
        if (Number.isNaN(amount) || amount <= 0) {
            setToast({ message: 'Informe um valor valido para a despesa.', type: 'error' });
            return;
        }

        const input = {
            description: formData.description,
            category: formData.category,
            amount,
            date: normalizeDateForDb(formData.date),
            status: formData.status,
            type: 'expense',
            payment_method: 'Dinheiro',
        };

        try {
            if (editingExpense) {
                await transactionRepository.update(editingExpense.id, input, tenantId);
                setToast({ message: 'Despesa atualizada!', type: 'success' });
            } else {
                await transactionRepository.create(input, tenantId);
                setToast({ message: 'Despesa cadastrada!', type: 'success' });
            }
            fetchExpenses();
            setIsModalOpen(false);
        } catch (err) {
            console.error('Error saving expense:', err);
            setToast({ message: editingExpense ? 'Erro ao atualizar despesa.' : 'Erro ao cadastrar despesa.', type: 'error' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!tenantId) {
            setToast({ message: 'Sessao invalida para remover despesa.', type: 'error' });
            return;
        }

        try {
            await transactionRepository.delete(id, tenantId);
            setToast({ message: 'Despesa removida.', type: 'info' });
            fetchExpenses();
        } catch (err) {
            console.error('Error deleting expense:', err);
            setToast({ message: 'Erro ao remover despesa.', type: 'error' });
        }
    };

    const filteredExpenses = expenses.filter(exp => {
        const matchesSearch = exp.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            exp.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'all' || exp.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="space-y-6 animate-fade-in relative pb-10">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Cabeçalho Unificado Atelier Tech */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                        Contas a Pagar & Despesas
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
                        Gestão inteligente de contas fixas, custos operacionais e baixas financeiras da barbearia.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={openNewModal}
                        className="bg-white dark:bg-card-dark hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-border-dark px-4 py-2.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
                        title="Registrar lançamento avulso no livro-caixa"
                    >
                        <span className="material-symbols-outlined text-base">receipt_long</span>
                        + Saída no Caixa
                    </button>
                </div>
            </div>

            {/* Módulo Principal: Contas a Pagar com Competências e Recorrências */}
            <AccountsPayableWidget />

            {/* Seção Secundária: Histórico Consolidado do Livro-Caixa */}
            <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm mt-6">
                <div className="p-4 border-b border-slate-200 dark:border-border-dark flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-slate-500">menu_book</span>
                            Histórico do Livro-Caixa (Despesas Operacionais)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Lançamentos de saídas registrados no fluxo financeiro da barbearia.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full sm:w-64">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                            <input
                                type="text"
                                placeholder="Buscar no histórico..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg py-2 pl-9 pr-3 text-xs focus:ring-1 focus:ring-primary outline-none"
                            />
                        </div>
                        <div className="flex gap-1">
                            {(['all', 'paid', 'pending'] as const).map(st => {
                                const labels: Record<string, string> = { all: 'Todas', paid: 'Pagas', pending: 'Pendentes' };
                                return (
                                    <button
                                        key={st}
                                        onClick={() => setFilterStatus(st)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${filterStatus === st
                                            ? 'bg-primary text-night shadow-sm'
                                            : 'bg-white dark:bg-transparent border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                    >
                                        {labels[st]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Descrição</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Categoria</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-slate-900 dark:text-white">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500">Carregando despesas...</td>
                                </tr>
                            ) : filteredExpenses.length > 0 ? filteredExpenses.map((expense) => (
                                <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="px-5 py-3">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white">{expense.description}</p>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                                        {new Date(expense.date).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-5 py-3 text-xs font-bold">
                                        R$ {expense.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${expense.status === 'paid'
                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                            }`}>
                                            <span className={`size-1.5 rounded-full ${expense.status === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                            {expense.status === 'paid' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <button onClick={() => openEditModal(expense)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors p-1" title="Editar">
                                            <span className="material-symbols-outlined text-base">edit</span>
                                        </button>
                                        <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Excluir">
                                            <span className="material-symbols-outlined text-base">delete</span>
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500">Nenhum lançamento no livro-caixa para o filtro selecionado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="px-5 py-3 border-t border-slate-200 dark:border-border-dark flex justify-between items-center text-xs text-slate-500">
                    <span>Mostrando {filteredExpenses.length} de {expenses.length} lançamentos</span>
                </div>
            </div>

            {/* Add/Edit Expense Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingExpense(null); }}
                title={editingExpense ? 'Editar Lançamento no Caixa' : 'Nova Saída no Livro-Caixa'}
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
                              <DatePickerInput
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
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-display"
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
