import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';

interface Transaction {
    id: string;
    description: string;
    date: string;
    amount: number;
    type: 'income' | 'expense';
    method: string;
}

interface ParsedTransaction {
    date: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    method: 'PIX' | 'Dinheiro' | 'Crédito' | 'Débito' | 'Outros';
}

const Financial: React.FC = () => {
    const { theme } = useTheme();
    const navigate = useNavigate();
    const { tenantId } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [stats, setStats] = useState({ balance: 0, income: 0, expense: 0, count: 0 });
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Modals
    const [isEntradaModalOpen, setIsEntradaModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showAllTransactions, setShowAllTransactions] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [parsedData, setParsedData] = useState<ParsedTransaction[]>([]);

    // Form
    const [entradaForm, setEntradaForm] = useState({
        desc: '',
        val: '',
        method: 'PIX',
        date: new Date().toISOString().split('T')[0],
    });

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('date', { ascending: false });

        if (data) {
            const mapped: Transaction[] = data.map(t => ({
                id: t.id,
                description: t.description || t.desc,
                date: t.date,
                amount: Number(t.amount || t.val) || 0,
                type: t.type,
                method: t.method
            }));
            setTransactions(mapped);

            // Calculate Stats for current month
            const now = new Date();
            const currMonth = now.getMonth();
            const currYear = now.getFullYear();

            let bal = 0;
            let inc = 0;
            let exp = 0;
            let count = 0;

            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            const monthlyData: Record<string, { name: string; receita: number; despesa: number }> = {};

            // Initialize last 6 months
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const mName = months[d.getMonth()];
                monthlyData[mName] = { name: mName, receita: 0, despesa: 0 };
            }

            mapped.forEach(t => {
                const tDate = new Date(t.date);
                const isThisMonth = tDate.getMonth() === currMonth && tDate.getFullYear() === currYear;

                if (t.type === 'income') {
                    bal += t.amount;
                    if (isThisMonth) {
                        inc += t.amount;
                        count++;
                    }
                } else {
                    bal -= t.amount;
                    if (isThisMonth) exp += t.amount;
                }

                // Chart data
                const mName = months[tDate.getMonth()];
                if (monthlyData[mName]) {
                    if (t.type === 'income') monthlyData[mName].receita += t.amount;
                    else monthlyData[mName].despesa += t.amount;
                }
            });

            setStats({ balance: bal, income: inc, expense: exp, count });
            setChartData(Object.values(monthlyData));
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSaveEntrada = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!entradaForm.desc || !entradaForm.val) return;

        const { error } = await supabase.from('transactions').insert({
            description: entradaForm.desc,
            amount: parseFloat(entradaForm.val),
            type: 'income',
            method: entradaForm.method,
            date: entradaForm.date,
            tenant_id: tenantId
        });

        if (error) {
            console.error('Erro ao registrar entrada:', error);
            setToast({ message: `Erro ao registrar: ${error.message}`, type: 'error' });
            return;
        }

        setIsEntradaModalOpen(false);
        setEntradaForm({ desc: '', val: '', method: 'PIX', date: new Date().toISOString().split('T')[0] });
        setToast({ message: `Entrada de R$ ${parseFloat(entradaForm.val).toFixed(2)} registrada!`, type: 'success' });
        fetchData();
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const mapped: ParsedTransaction[] = [];

                data.forEach(row => {
                    // Adapt field names based on common bank CSV formats
                    const dateStr = row.Data || row.data || row.Date || row.date;
                    const descStr = row.Descricao || row.descricao || row.Historico || row.Detalhes || row.description || row.Description;
                    const valStr = row.Valor || row.valor || row.Amount || row.amount || row.Val || '0';

                    if (dateStr && descStr) {
                        // Very rough parsing for Brazilian float format (1.000,00) or standard (1000.00)
                        let num = 0;
                        if (typeof valStr === 'string') {
                            const cln = valStr.replace(/\s/g, '').replace('R$', '');
                            if (cln.includes(',') && cln.includes('.')) {
                                // likely 1.000,00
                                num = parseFloat(cln.replace(/\./g, '').replace(',', '.'));
                            } else if (cln.includes(',')) {
                                // likely 100,00
                                num = parseFloat(cln.replace(',', '.'));
                            } else {
                                // simple float
                                num = parseFloat(cln);
                            }
                        } else {
                            num = Number(valStr);
                        }

                        // Parse pt-BR date (DD/MM/YYYY)
                        let isoDate = new Date().toISOString().split('T')[0];
                        if (dateStr.includes('/')) {
                            const parts = dateStr.split('/');
                            if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        } else if (dateStr.includes('-')) {
                            isoDate = dateStr; // assume YYYY-MM-DD
                        }

                        if (!isNaN(num)) {
                            mapped.push({
                                date: isoDate,
                                description: descStr,
                                amount: Math.abs(num),
                                type: num >= 0 ? 'income' : 'expense',
                                method: 'Outros'
                            });
                        }
                    }
                });

                if (mapped.length > 0) {
                    setParsedData(mapped);
                    setIsImportModalOpen(true);
                } else {
                    setToast({ message: 'Nenhuma transação válida encontrada no CSV', type: 'error' });
                }

                if (fileInputRef.current) fileInputRef.current.value = ''; // reset
            },
            error: (error) => {
                setToast({ message: `Erro ao ler CSV: ${error.message}`, type: 'error' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        });
    };

    const handleConfirmImport = async () => {
        setLoading(true);
        const toInsert = parsedData.map(t => ({
            tenant_id: tenantId,
            description: t.description,
            amount: t.amount,
            type: t.type,
            method: t.method,
            date: t.date
        }));

        const { error } = await supabase.from('transactions').insert(toInsert);

        if (error) {
            setToast({ message: `Erro ao importar: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: `${toInsert.length} transações importadas com sucesso!`, type: 'success' });
            setIsImportModalOpen(false);
            setParsedData([]);
            fetchData();
        }
        setLoading(false);
    };

    const handleExportCSV = () => {
        if (transactions.length === 0) {
            setToast({ message: 'Nenhuma transação para exportar.', type: 'info' });
            return;
        }

        const dataToExport = transactions.map(t => ({
            Data: new Date(t.date).toLocaleDateString('pt-BR'),
            Descricao: t.description,
            Tipo: t.type === 'income' ? 'Receita' : 'Despesa',
            Categoria_Forma: t.method,
            Valor: t.amount.toFixed(2).replace('.', ',')
        }));

        const csvString = Papa.unparse(dataToExport);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `extrato_financeiro_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        <span className="material-symbols-outlined text-sm">payments</span>
                        Despesas
                    </Link>
                    <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Importar OFX/CSV
                    </button>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" onChange={handleFileUpload} />
                    <button onClick={handleExportCSV} className="px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">download</span>
                        Exportar
                    </button>
                    <button onClick={() => navigate('/expenses')} className="px-4 py-2.5 bg-red-500/10 text-red-500 dark:text-red-400 font-bold rounded-lg hover:bg-red-500 hover:text-white transition-all flex items-center gap-2 border border-red-500/20">
                        <span className="material-symbols-outlined text-sm">remove_circle</span>
                        Nova Saída
                    </button>
                    <button onClick={() => setIsEntradaModalOpen(true)} className="px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">add</span>
                        Nova Entrada
                    </button>
                </div>
            </div>

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                            <span className="material-symbols-outlined text-sm">account_balance</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saldo Total Acumulado</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {stats.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Histórico total do sistema</p>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                            <span className="material-symbols-outlined text-sm">arrow_downward</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Receitas (Mês Atual)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {stats.income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <span className="text-xs text-emerald-500 font-bold flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">check</span> {stats.count} transações
                    </span>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-red-500/10 text-red-500 rounded-lg">
                            <span className="material-symbols-outlined text-sm">arrow_upward</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Despesas (Mês Atual)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {stats.expense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <span className="text-xs text-red-500 font-bold flex items-center gap-1 mt-1">
                        <span className="material-symbols-outlined text-sm">trending_up</span> Dinâmico
                    </span>
                </div>

                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                            <span className="material-symbols-outlined text-sm">savings</span>
                        </div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lucro Líquido (Mês)</span>
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">R$ {(stats.income - stats.expense).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
                    <span className="text-xs text-purple-500 font-bold mt-1">
                        Margem: {stats.income > 0 ? (((stats.income - stats.expense) / stats.income) * 100).toFixed(1) : 0}%
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart Section */}
                <div className="lg:col-span-2 bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Fluxo de Caixa (Últimos meses)</h3>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Valores Reais</span>
                    </div>
                    <div className="h-[300px] w-full">
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">Carregando dados...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                                    <Legend iconType="circle" />
                                    <Bar dataKey="receita" name="Receitas" fill="#3c83f6" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="despesa" name="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm flex flex-col h-[420px]">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Histórico</h3>
                        <button onClick={() => setShowAllTransactions(!showAllTransactions)} className="text-primary text-[10px] font-bold uppercase hover:underline">
                            {showAllTransactions ? 'Menos' : 'Ver Tudo'}
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                        {loading ? (
                            <p className="text-center text-xs text-slate-500 py-10">Buscando...</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-center text-xs text-slate-500 py-10">Nenhuma transação encontrada.</p>
                        ) : (
                            displayedTransactions.map((t) => (
                                <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`size-8 rounded flex items-center justify-center ${t.type === 'income' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                                            <span className="material-symbols-outlined text-sm">{t.type === 'income' ? 'south_east' : 'north_west'}</span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{t.description}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString('pt-BR')} • {t.method}</p>
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold shrink-0 ${t.type === 'income' ? 'text-emerald-500' : 'text-slate-900 dark:text-white'}`}>
                                        {t.type === 'income' ? '+' : '-'} R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* === NOVA ENTRADA MODAL === */}
            <Modal
                isOpen={isEntradaModalOpen}
                onClose={() => setIsEntradaModalOpen(false)}
                title="Novo Recebimento Direto"
                maxWidth="md"
            >
                <form onSubmit={handleSaveEntrada} className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Dica de Gestão</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Use este formulário para registrar entradas avulsas que não vieram de agendamentos (ex: consultoria, venda externa).</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">O que está sendo recebido?</label>
                        <input required type="text" placeholder="Ex: Venda de curso, Aluguel de cadeira..."
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
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Forma de Recebimento</label>
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
                            Ignorar
                        </button>
                        <button type="submit" className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-sm">save</span>
                            Registrar no Caixa
                        </button>
                    </div>
                </form>
            </Modal>

            {/* === IMPORT & CONCILIATION MODAL === */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => { setIsImportModalOpen(false); setParsedData([]); }}
                title="Pré-visualização e Conciliação"
                maxWidth="3xl"
            >
                <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Revisão de Dados</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Nós encontramos <strong>{parsedData.length} transações</strong> prontas para serem importadas. Revise, altere o "Tipo de Movimentação" ou a "Forma" e clique em Aprovar no rodapé.</p>
                    </div>

                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-200 dark:border-border-dark">
                                    <tr>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Data</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Histórico / Descrição</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Valor (R$)</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Tipo</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Forma</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm">
                                    {parsedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-4 py-3 whitespace-nowrap text-slate-900 dark:text-slate-300">{row.date}</td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="text"
                                                    value={row.description}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].description = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full max-w-[200px] truncate"
                                                />
                                            </td>
                                            <td className={`px-4 py-3 font-bold whitespace-nowrap ${row.type === 'income' ? 'text-emerald-500' : 'text-red-500'}`}>
                                                {row.amount.toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    value={row.type}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].type = e.target.value as any;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-slate-100 dark:bg-[#1A1A1A] text-xs font-bold rounded p-1 outline-none text-slate-700 dark:text-slate-300"
                                                >
                                                    <option value="income">Receita (+)</option>
                                                    <option value="expense">Despesa (-)</option>
                                                </select>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <select
                                                    value={row.method}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].method = e.target.value as any;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-slate-100 dark:bg-[#1A1A1A] text-xs font-bold rounded p-1 outline-none text-slate-700 dark:text-slate-300"
                                                >
                                                    <option value="PIX">PIX</option>
                                                    <option value="Dinheiro">Dinheiro</option>
                                                    <option value="Crédito">Crédito</option>
                                                    <option value="Débito">Débito</option>
                                                    <option value="Outros">Outros</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark mt-6">
                        <button type="button" onClick={() => { setIsImportModalOpen(false); setParsedData([]); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                            Cancelar e Descartar
                        </button>
                        <button type="button" onClick={handleConfirmImport} disabled={loading} className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                            {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Aprovar e Importar (Em Lote)'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default Financial;