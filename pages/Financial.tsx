import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import Toast from '../components/Toast';

const data = [
    { name: 'Jan', receita: 4000, despesa: 2400 },
    { name: 'Fev', receita: 3000, despesa: 1398 },
    { name: 'Mar', receita: 2000, despesa: 9800 },
    { name: 'Abr', receita: 2780, despesa: 3908 },
    { name: 'Mai', receita: 1890, despesa: 4800 },
    { name: 'Jun', receita: 2390, despesa: 3800 },
    { name: 'Jul', receita: 3490, despesa: 4300 },
];

interface Transaction {
    id: number;
    desc: string;
    date: string;
    val: number;
    type: 'in' | 'out';
    method: string;
}

const initialTransactions: Transaction[] = [
    { id: 1, desc: 'Corte + Barba (Roberto)', date: 'Hoje, 14:30', val: 85.00, type: 'in', method: 'PIX' },
    { id: 2, desc: 'Conta de Luz', date: 'Hoje, 09:00', val: 450.00, type: 'out', method: 'Boleto' },
    { id: 3, desc: 'Venda de Produto', date: 'Ontem, 18:15', val: 120.00, type: 'in', method: 'Cartão' },
    { id: 4, desc: 'Compra de Toalhas', date: 'Ontem, 11:20', val: 230.00, type: 'out', method: 'Dinheiro' },
    { id: 5, desc: 'Corte Social', date: '12 Out, 10:00', val: 45.00, type: 'in', method: 'PIX' },
    { id: 6, desc: 'Corte Social', date: '12 Out, 09:00', val: 45.00, type: 'in', method: 'Dinheiro' },
];

const Financial: React.FC = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modals
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);
    const [showAllTransactions, setShowAllTransactions] = useState(false);

    // Form
    const [entradaForm, setEntradaForm] = useState({
        desc: '',
        val: '',
        method: 'PIX',
        date: new Date().toISOString().split('T')[0],
    });

    const handleSaveEntrada = (e: React.FormEvent) => {
        e.preventDefault();
        if (!entradaForm.desc || !entradaForm.val) return;
        const newTx: Transaction = {
            id: Date.now(),
            desc: entradaForm.desc,
            date: 'Hoje',
            val: parseFloat(entradaForm.val),
            type: 'in',
            method: entradaForm.method,
        };
        setTransactions([newTx, ...transactions]);
        setIsEntradaModalOpen(false);
        setEntradaForm({ desc: '', val: '', method: 'PIX', date: new Date().toISOString().split('T')[0] });
        setToast({ message: `Entrada de R$ ${newTx.val.toFixed(2)} registrada!`, type: 'success' });
    };

    const displayedTransactions = showAllTransactions ? transactions : transactions.slice(0, 6);

    return (
        <div className="space-y-6 animate-fade-in">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Painel Financeiro</h2>
                    <p className="text-slate-500 mt-1">Visão completa do fluxo de caixa e saúde financeira.</p>
                </div>
                <div className="flex gap-3">
                    <Link to="/expenses" className="px-4 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined">payments</span>
                        Gerir Despesas
                    </Link>
                    <button onClick={() => navigate('/expenses')} className="px-4 py-2.5 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 shadow-lg shadow-red-500/20 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined">remove_circle</span>
                        + Nova Saída
                    </button>
                    <button onClick={() => setIsEntradaModalOpen(true)} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined">add</span>
                        Nova Entrada
                    </button>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                            <span className="material-symbols-outlined">account_balance</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500 uppercase">Saldo Atual</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 124.590</h3>
                    <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> +12% vs mês anterior
                    </span>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                            <span className="material-symbols-outlined">arrow_downward</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500 uppercase">Receitas (Mês)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 45.200</h3>
                    <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> 92 transações
                    </span>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                            <span className="material-symbols-outlined">arrow_upward</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500 uppercase">Despesas (Mês)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 12.850</h3>
                    <span className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> +5% vs mês anterior
                    </span>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                            <span className="material-symbols-outlined">savings</span>
                        </div>
                        <span className="text-sm font-bold text-slate-500 uppercase">Lucro Líquido</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ 32.350</h3>
                    <span className="text-xs text-slate-400 font-bold mt-1">
                        Margem atual: 71%
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Fluxo de Caixa (Semestral)</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#333' : '#e2e8f0'} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: theme === 'dark' ? '#1F1F1F' : '#fff',
                                        borderColor: theme === 'dark' ? '#333' : '#e2e8f0',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Legend />
                                <Bar dataKey="receita" name="Receita" fill="#3c83f6" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Transações Recentes</h3>
                        <button onClick={() => setShowAllTransactions(!showAllTransactions)} className="text-primary text-xs font-bold uppercase hover:underline">
                            {showAllTransactions ? 'Mostrar Menos' : 'Ver Todas'}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                        {displayedTransactions.map((t) => (
                            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`size-10 rounded-full flex items-center justify-center ${t.type === 'in' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                        <span className="material-symbols-outlined text-lg">{t.type === 'in' ? 'arrow_downward' : 'arrow_upward'}</span>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{t.desc}</p>
                                        <p className="text-xs text-slate-500">{t.date} • {t.method}</p>
                                    </div>
                                </div>
                                <span className={`text-sm font-bold ${t.type === 'in' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                    {t.type === 'in' ? '+' : '-'} R$ {t.val.toFixed(2)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* === NOVA ENTRADA MODAL === */}
            {isEntradaModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-xl shadow-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-border-dark flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/10">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">add_circle</span>
                                Nova Entrada
                            </h3>
                            <button onClick={() => setIsEntradaModalOpen(false)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>
                        <form onSubmit={handleSaveEntrada} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Descrição</label>
                                <input required type="text" placeholder="Ex: Corte + Barba"
                                    value={entradaForm.desc} onChange={(e) => setEntradaForm({ ...entradaForm, desc: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Valor (R$)</label>
                                    <input required type="number" step="0.01" placeholder="0.00"
                                        value={entradaForm.val} onChange={(e) => setEntradaForm({ ...entradaForm, val: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data</label>
                                    <input required type="date" value={entradaForm.date}
                                        onChange={(e) => setEntradaForm({ ...entradaForm, date: e.target.value })}
                                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Método de Pagamento</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['PIX', 'Dinheiro', 'Crédito', 'Débito'].map(m => (
                                        <button key={m} type="button" onClick={() => setEntradaForm({ ...entradaForm, method: m })}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${entradaForm.method === m ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                                            {m}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsEntradaModalOpen(false)} className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                    Cancelar
                                </button>
                                <button type="submit" className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">check_circle</span>
                                    Registrar Entrada
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Financial;