import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    ArrowDownUp,
    ArrowUpRight,
    ArrowDownLeft,
    Plus,
    CheckSquare,
    Coins,
    Calendar,
    Search,
    Filter,
    Download,
    CheckCircle2,
    Clock,
    AlertCircle,
    User,
    Wallet,
    MessageCircle,
    Building2,
    DollarSign,
    RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTenantOptional } from '../src/context/TenantContext';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import DatePickerInput from '../components/ui/DatePickerInput';
import { formatCurrency } from '../shared/format/currency';
import { staffRepository } from '../domain/staff/repository';
import type { StaffMember } from '../domain/staff/types';
import {
    cashLedgerRepository,
} from '../domain/cashLedger/cashLedgerRepository';
import {
    calculateLedgerSummary,
    filterLedgerEntries,
    validateBatchSettle,
    validateCreateVale,
} from '../domain/cashLedger/cashLedgerEngine';
import type {
    LedgerEntry,
    LedgerTab,
    ReceivableSubTab,
    FiadoReceivableSummary,
} from '../domain/cashLedger/types';
import { generateWhatsAppDebtMessage } from '../domain/clientWallet/walletEngine';

const getTodayIso = () => new Date().toISOString().split('T')[0];

const getPeriodDefaults = (preset: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (preset === 'today') {
        return { start: today, end: today };
    }
    if (preset === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay()); // Domingo
        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Sábado
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    }
    if (preset === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    }
    return { start: '', end: '' };
};

export const CashLedger: React.FC = () => {
    const { tenantId: authTenantId } = useAuth();
    const tenantCtx = useTenantOptional();
    const activeTenantId = authTenantId || tenantCtx?.tenant?.id || 'demo-tenant';

    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') as LedgerTab) || 'all';

    // Estado principal
    const [activeTab, setActiveTab] = useState<LedgerTab>(initialTab);
    const [receivableSubTab, setReceivableSubTab] = useState<ReceivableSubTab>('all');
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [fiados, setFiados] = useState<FiadoReceivableSummary[]>([]);
    const [staffList, setStaffList] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Filtros
    const [datePreset, setDatePreset] = useState<'today' | 'week' | 'month' | 'all'>('month');
    const [startDate, setStartDate] = useState(getPeriodDefaults('month').start);
    const [endDate, setEndDate] = useState(getPeriodDefaults('month').end);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');

    // Seleção múltipla para baixa em lote
    const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());

    // Modais
    const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isValeModalOpen, setIsValeModalOpen] = useState(false);

    // Formulário Nova Movimentação
    const [movementForm, setMovementForm] = useState({
        type: 'expense' as 'income' | 'expense',
        category: 'Despesa Operacional',
        description: '',
        amount: '',
        due_date: getTodayIso(),
        payment_date: '',
        status: 'pending' as 'pending' | 'paid',
        recipient_or_payer: '',
        payment_method: 'money',
        notes: '',
    });

    // Formulário Baixa em Lote
    const [batchForm, setBatchForm] = useState({
        paymentMethod: 'pix',
        paymentDate: getTodayIso(),
        notes: '',
    });

    // Formulário de Vale
    const [valeForm, setValeForm] = useState({
        staffId: '',
        amount: '',
        paymentMethod: 'money',
        notes: '',
        issuedAt: getTodayIso(),
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Sincroniza aba com URL
    useEffect(() => {
        const tabFromUrl = searchParams.get('tab') as LedgerTab;
        if (tabFromUrl && tabFromUrl !== activeTab) {
            setActiveTab(tabFromUrl);
        }
    }, [searchParams, activeTab]);

    const handleTabChange = (newTab: LedgerTab) => {
        setActiveTab(newTab);
        setSearchParams({ tab: newTab });
        setSelectedEntryIds(new Set());
    };

    const handlePresetChange = (preset: 'today' | 'week' | 'month' | 'all') => {
        setDatePreset(preset);
        const { start, end } = getPeriodDefaults(preset);
        setStartDate(start);
        setEndDate(end);
    };

    // Carregamento de dados
    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [entriesData, fiadosData, staffData] = await Promise.all([
                cashLedgerRepository.listLedgerEntries(activeTenantId),
                cashLedgerRepository.listFiadosForReceivables(activeTenantId),
                staffRepository.list(activeTenantId).catch(() => []),
            ]);
            setEntries(entriesData);
            setFiados(fiadosData);
            setStaffList(staffData);
        } catch {
            setToast({ message: 'Erro ao carregar livro razão.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [activeTenantId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Resumos e Métricas Financeiras
    const summary = useMemo(() => {
        return calculateLedgerSummary(entries, startDate, endDate, fiados);
    }, [entries, startDate, endDate, fiados]);

    // Entradas filtradas
    const filteredEntries = useMemo(() => {
        return filterLedgerEntries(entries, {
            tab: activeTab,
            receivableSubTab,
            startDate,
            endDate,
            search: searchTerm,
            status: statusFilter,
        });
    }, [entries, activeTab, receivableSubTab, startDate, endDate, searchTerm, statusFilter]);

    // Fiados filtrados
    const filteredFiados = useMemo(() => {
        if (!searchTerm) return fiados;
        const q = searchTerm.toLowerCase();
        return fiados.filter(
            (f) => f.client_name.toLowerCase().includes(q) || f.phone.includes(q)
        );
    }, [fiados, searchTerm]);

    // Controle de Seleção
    const handleToggleSelectAll = () => {
        if (selectedEntryIds.size === filteredEntries.length) {
            setSelectedEntryIds(new Set());
        } else {
            const allIds = new Set(filteredEntries.map((e) => e.id));
            setSelectedEntryIds(allIds);
        }
    };

    const handleToggleSelectEntry = (id: string) => {
        setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Valor total dos itens selecionados
    const selectedTotalAmount = useMemo(() => {
        return entries
            .filter((e) => selectedEntryIds.has(e.id))
            .reduce((sum, e) => sum + e.amount, 0);
    }, [entries, selectedEntryIds]);

    // Ações: Criar Movimentação
    const handleCreateMovement = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(movementForm.amount.replace(',', '.'));
        if (isNaN(amt) || amt <= 0) {
            setToast({ message: 'Informe um valor numérico válido maior que zero.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            await cashLedgerRepository.createLedgerEntry(activeTenantId, {
                type: movementForm.type,
                category: movementForm.category,
                description: movementForm.description || 'Movimentação sem descrição',
                amount: amt,
                due_date: movementForm.due_date,
                payment_date: movementForm.status === 'paid' ? (movementForm.payment_date || movementForm.due_date) : null,
                status: movementForm.status,
                recipient_or_payer: movementForm.recipient_or_payer || null,
                payment_method: movementForm.payment_method,
                notes: movementForm.notes,
            });

            setToast({ message: 'Movimentação cadastrada com sucesso!', type: 'success' });
            setIsMovementModalOpen(false);
            setMovementForm({
                type: 'expense',
                category: 'Despesa Operacional',
                description: '',
                amount: '',
                due_date: getTodayIso(),
                payment_date: '',
                status: 'pending',
                recipient_or_payer: '',
                payment_method: 'money',
                notes: '',
            });
            await loadData();
        } catch {
            setToast({ message: 'Falha ao salvar movimentação.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ações: Baixa em Lote
    const handleExecuteBatchSettle = async (e: React.FormEvent) => {
        e.preventDefault();
        const ids: string[] = Array.from(selectedEntryIds);
        const validation = validateBatchSettle(ids, batchForm.paymentMethod);
        if (!validation.valid) {
            setToast({ message: validation.error || 'Dados inválidos.', type: 'error' });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await cashLedgerRepository.batchSettleEntries({
                tenantId: activeTenantId,
                entryIds: ids,
                paymentMethod: batchForm.paymentMethod,
                paymentDate: batchForm.paymentDate,
                notes: batchForm.notes,
            });

            if (res.success) {
                setToast({ message: `${res.settledCount} lançamentos baixados com sucesso!`, type: 'success' });
                setIsBatchModalOpen(false);
                setSelectedEntryIds(new Set());
                await loadData();
            } else {
                setToast({ message: res.message || 'Erro ao processar baixa.', type: 'error' });
            }
        } catch {
            setToast({ message: 'Falha na liquidação em lote.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Ações: Lançar Vale
    const handleRegisterVale = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(valeForm.amount.replace(',', '.'));
        const validation = validateCreateVale(valeForm.staffId, amt);
        if (!validation.valid) {
            setToast({ message: validation.error || 'Dados inválidos.', type: 'error' });
            return;
        }

        const staff = staffList.find((s) => s.id === valeForm.staffId);
        const staffName = staff?.name || 'Profissional';

        setIsSubmitting(true);
        try {
            const res = await cashLedgerRepository.registerVale({
                tenantId: activeTenantId,
                staffId: valeForm.staffId,
                staffName,
                amount: amt,
                paymentMethod: valeForm.paymentMethod,
                notes: valeForm.notes,
                issuedAt: valeForm.issuedAt,
            });

            if (res.success) {
                setToast({ message: res.message, type: 'success' });
                setIsValeModalOpen(false);
                setValeForm({
                    staffId: '',
                    amount: '',
                    paymentMethod: 'money',
                    notes: '',
                    issuedAt: getTodayIso(),
                });
                await loadData();
            } else {
                setToast({ message: res.message || 'Erro ao registrar vale.', type: 'error' });
            }
        } catch {
            setToast({ message: 'Falha ao lançar vale.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Cobrança WhatsApp Fiado
    const handleSendWhatsAppDebt = (fiado: FiadoReceivableSummary) => {
        const msg = generateWhatsAppDebtMessage({
            clientName: fiado.client_name,
            debtAmount: fiado.debt_amount,
            pixKey: 'financeiro@soumanager.com',
            shopName: tenantCtx?.tenant?.name || 'SOU MANA.GER Barber',
        });
        const cleanPhone = fiado.phone.replace(/\D/g, '');
        const targetPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
        const url = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(msg)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="space-y-6 pb-12">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            {/* Cabeçalho Operacional */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <ArrowDownUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                Entrada / Saída
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Central Financeira Unificada: Fluxo Operacional, Contas a Pagar, Receber e Vales
                            </p>
                        </div>
                    </div>
                </div>

                {/* Ações Rápidas no Topo */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsMovementModalOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 shadow-sm transition-all"
                    >
                        <Plus className="w-4 h-4" />
                        <span>+ Movimentação</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsBatchModalOpen(true)}
                        disabled={selectedEntryIds.size === 0}
                        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm ${
                            selectedEntryIds.size > 0
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ring-2 ring-emerald-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        }`}
                        title={selectedEntryIds.size === 0 ? 'Selecione lançamentos para baixar em lote' : ''}
                    >
                        <CheckSquare className="w-4 h-4" />
                        <span>Baixar Selecionados</span>
                        {selectedEntryIds.size > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold bg-white/20">
                                {selectedEntryIds.size} ({formatCurrency(selectedTotalAmount)})
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsValeModalOpen(true)}
                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-all shadow-sm"
                    >
                        <Coins className="w-4 h-4" />
                        <span>Vale (Adiantamento)</span>
                    </button>

                    <button
                        type="button"
                        onClick={loadData}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                        title="Atualizar dados"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Abas Principais (Estilo AppBarber) */}
            <div className="border-b border-slate-200 dark:border-slate-800">
                <nav className="flex space-x-6" aria-label="Abas Financeiras">
                    <button
                        type="button"
                        onClick={() => handleTabChange('all')}
                        className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'all'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <ArrowDownUp className="w-4 h-4" />
                        <span>Entrada / Saída</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange('payable')}
                        className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'payable'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <ArrowDownLeft className="w-4 h-4 text-rose-500" />
                        <span>Contas a Pagar</span>
                        {summary.totalPayablePeriod > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                {formatCurrency(summary.totalPayablePeriod)}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => handleTabChange('receivable')}
                        className={`pb-3 px-1 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                            activeTab === 'receivable'
                                ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                        }`}
                    >
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        <span>Contas a Receber</span>
                        {summary.totalReceivablePeriod > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                {formatCurrency(summary.totalReceivablePeriod)}
                            </span>
                        )}
                    </button>
                </nav>
            </div>

            {/* Sub-abas específicas de Contas a Receber (Recebíveis vs Fiados) */}
            {activeTab === 'receivable' && (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
                    <button
                        type="button"
                        onClick={() => setReceivableSubTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            receivableSubTab === 'all'
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                        }`}
                    >
                        Todos os Recebíveis
                    </button>
                    <button
                        type="button"
                        onClick={() => setReceivableSubTab('standard')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            receivableSubTab === 'standard'
                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800'
                        }`}
                    >
                        Recebíveis Gerais
                    </button>
                    <button
                        type="button"
                        onClick={() => setReceivableSubTab('fiados')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            receivableSubTab === 'fiados'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'text-amber-600 dark:text-amber-400 hover:text-amber-700'
                        }`}
                    >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>Fiados / Conta do Cliente ({fiados.length})</span>
                    </button>
                </div>
            )}

            {/* Barra de Filtros e Pesquisa */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Atalhos Rápidos de Data */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">Período:</span>
                        {(['today', 'week', 'month', 'all'] as const).map((preset) => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => handlePresetChange(preset)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    datePreset === preset
                                        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold'
                                        : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                }`}
                            >
                                {preset === 'today' && 'Hoje'}
                                {preset === 'week' && 'Esta Semana'}
                                {preset === 'month' && 'Este Mês'}
                                {preset === 'all' && 'Todos'}
                            </button>
                        ))}
                    </div>

                    {/* Inputs de Data Início e Fim */}
                    <div className="flex items-center gap-2">
                        <div className="w-36">
                            <DatePickerInput
                                label="Início"
                                value={startDate}
                                onChange={setStartDate}
                            />
                        </div>
                        <span className="text-slate-400 text-xs mt-4">até</span>
                        <div className="w-36">
                            <DatePickerInput
                                label="Fim"
                                value={endDate}
                                onChange={setEndDate}
                            />
                        </div>
                    </div>
                </div>

                {/* Segunda Linha: Busca Textual e Filtro de Status */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Pesquisar por descrição, categoria, cliente ou fornecedor..."
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'paid')}
                            aria-label="Filtrar por status"
                            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-700 dark:text-slate-300"
                        >
                            <option value="all">Status: Todos</option>
                            <option value="pending">Apenas Pendentes</option>
                            <option value="paid">Apenas Pagos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Visualização de Fiados quando selecionada a sub-aba */}
            {activeTab === 'receivable' && receivableSubTab === 'fiados' ? (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-amber-500" />
                            <h3 className="font-bold text-slate-900 dark:text-white">
                                Clientes com Débitos em Aberto (Fiado)
                            </h3>
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                            Total: {filteredFiados.length} cliente(s) em débito
                        </span>
                    </div>

                    {filteredFiados.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            Nenhum cliente com débitos em aberto encontrado.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Cliente</th>
                                        <th className="py-3 px-4">Telefone</th>
                                        <th className="py-3 px-4 text-right">Valor em Débito</th>
                                        <th className="py-3 px-4 text-right">Limite Permitido</th>
                                        <th className="py-3 px-4 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {filteredFiados.map((fiado) => (
                                        <tr key={fiado.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                                                {fiado.client_name}
                                            </td>
                                            <td className="py-3 px-4 text-slate-500">{fiado.phone || 'Sem telefone'}</td>
                                            <td className="py-3 px-4 text-right font-bold text-rose-600 dark:text-rose-400">
                                                {formatCurrency(fiado.debt_amount)}
                                            </td>
                                            <td className="py-3 px-4 text-right text-slate-500">
                                                {formatCurrency(fiado.credit_limit)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSendWhatsAppDebt(fiado)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" />
                                                    <span>Cobrar WhatsApp</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            ) : (
                /* Tabela Geral de Lançamentos com Checkbox */
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
                    {loading ? (
                        <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
                            <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
                            <span>Carregando dados financeiros...</span>
                        </div>
                    ) : filteredEntries.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            Nenhum lançamento encontrado para os filtros selecionados.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4 w-10">
                                            <input
                                                type="checkbox"
                                                aria-label="Selecionar todos os lançamentos"
                                                checked={selectedEntryIds.size > 0 && selectedEntryIds.size === filteredEntries.length}
                                                onChange={handleToggleSelectAll}
                                                className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                            />
                                        </th>
                                        <th className="py-3 px-4">Descrição</th>
                                        <th className="py-3 px-4">Categoria</th>
                                        <th className="py-3 px-4">Origem / Destino</th>
                                        <th className="py-3 px-4">Vencimento</th>
                                        <th className="py-3 px-4 text-right">Valor</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                    {filteredEntries.map((entry) => {
                                        const isSelected = selectedEntryIds.has(entry.id);
                                        const isExpense = entry.type === 'expense';
                                        return (
                                            <tr
                                                key={entry.id}
                                                className={`transition-colors ${
                                                    isSelected
                                                        ? 'bg-amber-500/10 dark:bg-amber-500/15'
                                                        : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                                                }`}
                                            >
                                                <td className="py-3.5 px-4">
                                                    <input
                                                        type="checkbox"
                                                        aria-label={`Selecionar lançamento ${entry.description}`}
                                                        checked={isSelected}
                                                        onChange={() => handleToggleSelectEntry(entry.id)}
                                                        className="w-4 h-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                                                    />
                                                </td>
                                                <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                                                    <div className="flex items-center gap-2">
                                                        {isExpense ? (
                                                            <ArrowDownLeft className="w-4 h-4 text-rose-500 shrink-0" />
                                                        ) : (
                                                            <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
                                                        )}
                                                        <span>{entry.description}</span>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-500">
                                                    <span className="px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                        {entry.category}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-500">
                                                    {entry.recipient_or_payer || '—'}
                                                </td>
                                                <td className="py-3.5 px-4 text-slate-500">
                                                    {entry.due_date}
                                                </td>
                                                <td
                                                    className={`py-3.5 px-4 text-right font-bold ${
                                                        isExpense
                                                            ? 'text-rose-600 dark:text-rose-400'
                                                            : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}
                                                >
                                                    {isExpense ? '-' : '+'} {formatCurrency(entry.amount)}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    {entry.status === 'paid' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            <span>Pago</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <Clock className="w-3 h-3" />
                                                            <span>Pendente</span>
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Painel Inferior de Totais e Saldos (Idêntico ao AppBarber) */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {activeTab === 'payable' ? (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Previsibilidade de Saídas
                            </span>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                Saldo a Pagar no período:{' '}
                                <span className="text-rose-600 dark:text-rose-400">
                                    {formatCurrency(summary.totalPayablePeriod)}
                                </span>
                            </div>
                        </div>

                        <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-800 pt-3 sm:pt-0 sm:pl-6 w-full sm:w-auto">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Total Acumulado a Pagar
                            </span>
                            <div className="text-xl font-black text-rose-600 dark:text-rose-400">
                                {formatCurrency(summary.totalPayableAll)}
                            </div>
                        </div>
                    </div>
                ) : activeTab === 'receivable' ? (
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Previsibilidade de Entradas
                            </span>
                            <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                Saldo a Receber no período:{' '}
                                <span className="text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(summary.totalReceivablePeriod)}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-6">
                            <div>
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Total Geral a Receber
                                </span>
                                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(summary.totalReceivableAll)}
                                </div>
                            </div>

                            <div className="border-l border-slate-200 dark:border-slate-800 pl-6">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                    Total em Fiados (Clientes)
                                </span>
                                <div className="text-lg font-black text-amber-500">
                                    {formatCurrency(summary.totalFiadosDebt)}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center sm:text-left">
                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Entradas Efetivadas (Período)
                            </span>
                            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                {formatCurrency(summary.totalIncomePeriod)}
                            </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Saídas Efetivadas (Período)
                            </span>
                            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                                {formatCurrency(summary.totalExpensePeriod)}
                            </div>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-850 rounded-xl border border-slate-200/80 dark:border-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Resultado Líquido Operacional
                            </span>
                            <div
                                className={`text-xl font-black mt-1 ${
                                    summary.netPeriod >= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-rose-600 dark:text-rose-400'
                                }`}
                            >
                                {formatCurrency(summary.netPeriod)}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL: Nova Movimentação */}
            {isMovementModalOpen && (
                <Modal
                    isOpen={isMovementModalOpen}
                    onClose={() => setIsMovementModalOpen(false)}
                    title="Nova Movimentação Financeira"
                >
                    <form onSubmit={handleCreateMovement} className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => setMovementForm((p) => ({ ...p, type: 'expense' }))}
                                className={`py-2 text-sm font-bold rounded-xl border transition-all ${
                                    movementForm.type === 'expense'
                                        ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/20'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                                }`}
                            >
                                Saída / Despesa
                            </button>
                            <button
                                type="button"
                                onClick={() => setMovementForm((p) => ({ ...p, type: 'income' }))}
                                className={`py-2 text-sm font-bold rounded-xl border transition-all ${
                                    movementForm.type === 'income'
                                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20'
                                        : 'border-slate-200 dark:border-slate-800 text-slate-500'
                                }`}
                            >
                                Entrada / Receita
                            </button>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Descrição
                            </label>
                            <input
                                type="text"
                                required
                                value={movementForm.description}
                                onChange={(e) => setMovementForm((p) => ({ ...p, description: e.target.value }))}
                                placeholder="Ex: Pagamento de Fornecedor, Internet, Venda Balcão"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Categoria
                                </label>
                                <select
                                    value={movementForm.category}
                                    onChange={(e) => setMovementForm((p) => ({ ...p, category: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                                >
                                    <option value="Despesa Operacional">Despesa Operacional</option>
                                    <option value="Insumos">Insumos e Produtos</option>
                                    <option value="Aluguel">Aluguel e Condomínio</option>
                                    <option value="Energia / Água">Energia / Água / Internet</option>
                                    <option value="Marketing">Marketing / Tráfego</option>
                                    <option value="Serviços">Receita de Serviços</option>
                                    <option value="Assinaturas">Club dos Chefes</option>
                                    <option value="Outros">Outros</option>
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Valor (R$)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={movementForm.amount}
                                    onChange={(e) => setMovementForm((p) => ({ ...p, amount: e.target.value }))}
                                    placeholder="0,00"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Data de Vencimento
                                </label>
                                <DatePickerInput
                                    value={movementForm.due_date}
                                    onChange={(val) => setMovementForm((p) => ({ ...p, due_date: val }))}
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Status Inicial
                                </label>
                                <select
                                    value={movementForm.status}
                                    onChange={(e) => setMovementForm((p) => ({ ...p, status: e.target.value as 'pending' | 'paid' }))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                                >
                                    <option value="pending">Pendente (Agendado)</option>
                                    <option value="paid">Pago / Liquidado Imediato</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                {movementForm.type === 'expense' ? 'Fornecedor / Beneficiário' : 'Cliente / Pagador'}
                            </label>
                            <input
                                type="text"
                                value={movementForm.recipient_or_payer}
                                onChange={(e) => setMovementForm((p) => ({ ...p, recipient_or_payer: e.target.value }))}
                                placeholder="Nome da pessoa, empresa ou cliente"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={() => setIsMovementModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Salvando...' : 'Salvar Movimentação'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* MODAL: Baixa em Lote */}
            {isBatchModalOpen && (
                <Modal
                    isOpen={isBatchModalOpen}
                    onClose={() => setIsBatchModalOpen(false)}
                    title="Baixa de Lançamentos em Lote"
                >
                    <form onSubmit={handleExecuteBatchSettle} className="space-y-4">
                        <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-slate-800 dark:text-slate-200 text-sm">
                            Você está liquidando{' '}
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                                {selectedEntryIds.size} lançamento(s)
                            </span>{' '}
                            no valor somado de{' '}
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(selectedTotalAmount)}
                            </span>
                            .
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Forma / Conta de Liquidação
                            </label>
                            <select
                                value={batchForm.paymentMethod}
                                onChange={(e) => setBatchForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                            >
                                <option value="pix">PIX (Conta Bancária)</option>
                                <option value="money">Dinheiro (Caixa Físico do Balcão)</option>
                                <option value="debit_card">Cartão de Débito</option>
                                <option value="credit_card">Cartão de Crédito</option>
                                <option value="bank_transfer">Transferência Bancária / TED</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Data Efetiva da Baixa
                            </label>
                            <DatePickerInput
                                value={batchForm.paymentDate}
                                onChange={(val) => setBatchForm((p) => ({ ...p, paymentDate: val }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Observações da Liquidação (Opcional)
                            </label>
                            <input
                                type="text"
                                value={batchForm.notes}
                                onChange={(e) => setBatchForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Ex: Pagamento lote semanal via banco Itaú"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={() => setIsBatchModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Processando...' : `Confirmar Baixa de ${selectedEntryIds.size} Itens`}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* MODAL: Lançar Vale (Adiantamento) */}
            {isValeModalOpen && (
                <Modal
                    isOpen={isValeModalOpen}
                    onClose={() => setIsValeModalOpen(false)}
                    title="Lançamento de Vale para Colaborador"
                >
                    <form onSubmit={handleRegisterVale} className="space-y-4">
                        <div className="p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300">
                            <strong>Aviso de Governança:</strong> O valor concedido será lançado como saída no caixa da barbearia e registrado como adiantamento na folha do profissional, para abatimento automático no fechamento de comissão da respectiva semana.
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Selecionar Profissional / Barbeiro
                            </label>
                            <select
                                required
                                value={valeForm.staffId}
                                onChange={(e) => setValeForm((p) => ({ ...p, staffId: e.target.value }))}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                            >
                                <option value="">Selecione um profissional...</option>
                                {staffList.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} ({s.role})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Valor do Vale (R$)
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={valeForm.amount}
                                    onChange={(e) => setValeForm((p) => ({ ...p, amount: e.target.value }))}
                                    placeholder="0,00"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-amber-600 dark:text-amber-400"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                    Origem do Pagamento
                                </label>
                                <select
                                    value={valeForm.paymentMethod}
                                    onChange={(e) => setValeForm((p) => ({ ...p, paymentMethod: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
                                >
                                    <option value="money">Dinheiro (Caixa Balcão)</option>
                                    <option value="pix">PIX da Barbearia</option>
                                    <option value="bank_transfer">Transferência Bancária</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Data do Lançamento
                            </label>
                            <DatePickerInput
                                value={valeForm.issuedAt}
                                onChange={(val) => setValeForm((p) => ({ ...p, issuedAt: val }))}
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">
                                Motivo / Observações
                            </label>
                            <input
                                type="text"
                                value={valeForm.notes}
                                onChange={(e) => setValeForm((p) => ({ ...p, notes: e.target.value }))}
                                placeholder="Ex: Adiantamento para compra de lâminas, almoço, despesa pessoal"
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm"
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <Button type="button" variant="outline" onClick={() => setIsValeModalOpen(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? 'Registrando...' : 'Confirmar Vale'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CashLedger;
