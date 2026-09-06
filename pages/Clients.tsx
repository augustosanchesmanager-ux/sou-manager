import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { getScopedClient, supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { LoadingBlock } from '../components/ui/Loading';
import CustomerVouchersSection from '../components/customers/CustomerVouchersSection';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { fetchActiveChefClubPlanMap, fetchChefClubSummaryByClient } from '../src/lib/supabase/chefClub';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { formatCurrency } from '../shared/format/currency';
import { clientRepository, RepositoryError } from '../domain/client';
import { buildImportPreview, clientImportDefinition, phoneDuplicateKey, toPersistableRow, type ImportPreview } from '../src/modules/import-engine';

interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
    last_visit: string;
    last_service: string;
    total_spent: number;
    status: string;
    avatar: string;
    birthday: string;
}

interface OpenComandaSummary {
    id: string;
    total: number;
    status: 'open';
    created_at: string;
}

type SortKey = 'name' | 'last_visit' | 'total_spent';
type SortDir = 'asc' | 'desc';

const getDisplayId = (id: string) => {
    const hexStr = id.replace(/-/g, '').slice(0, 8);
    const num = parseInt(hexStr, 16);
    return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};
const formatDateTime = (value: string) => new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

const Clients: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showLoading, hideLoading } = useLoading();
    const { tenantId, user, appSlug } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const isEsteticaApp = appSlug === 'estetica';
    const orderLabel = labels.order;
    const orderLabelLower = orderLabel.toLowerCase();
    const orderPluralLower = labels.orderPlural.toLowerCase();
    const serviceLabel = labels.service;
    const barberSupabase = getScopedClient('barber');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Editing
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Client>>({});

    // New Client Modal
    const [showModal, setShowModal] = useState(false);
    const [newForm, setNewForm] = useState({ name: '', email: '', phone: '', birthday: '' });

    // Import/Export states
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
    const [includeDuplicates, setIncludeDuplicates] = useState(false);

    useEffect(() => {
        const shouldOpenNew = Boolean((location.state as { openNewClient?: boolean } | null)?.openNewClient);
        if (!shouldOpenNew) return;
        setShowModal(true);
        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    // Delete Confirmation
    const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Detail View
    const [detailClient, setDetailClient] = useState<Client | null>(null);
    const [detailChefClub, setDetailChefClub] = useState<{ planName: string; credits: number; status: string } | null>(null);
    const [detailOpenComandas, setDetailOpenComandas] = useState<OpenComandaSummary[]>([]);
    const [detailOpenComandasCount, setDetailOpenComandasCount] = useState(0);
    const [detailOpenComandasLoading, setDetailOpenComandasLoading] = useState(false);
    const [chefClubMap, setChefClubMap] = useState<Record<string, string>>({});

    const openClientDetails = useCallback(async (client: Client) => {
        setDetailClient(client);
        setDetailChefClub(null);
        setDetailOpenComandas([]);
        setDetailOpenComandasCount(0);
        setDetailOpenComandasLoading(Boolean(tenantId));

        try {
            const [clubSummary, openComandasResult] = await Promise.all([
                fetchChefClubSummaryByClient(client.id, tenantId).catch((error) => {
                    console.error('Erro ao carregar resumo do Club dos Chefes:', error);
                    return null;
                }),
                tenantId
                    ? barberSupabase
                        .from('comandas')
                        .select('id, total, status, created_at', { count: 'exact' })
                        .eq('tenant_id', tenantId)
                        .eq('client_id', client.id)
                        .eq('status', 'open')
                        .order('created_at', { ascending: false })
                        .limit(3)
                    : Promise.resolve({ data: [], error: null, count: 0 }),
            ]);

            setDetailChefClub(clubSummary);

            if (openComandasResult.error) {
                console.error('Erro ao carregar comandas abertas do cliente:', openComandasResult.error);
                setDetailOpenComandas([]);
                setDetailOpenComandasCount(0);
            } else {
                setDetailOpenComandas((openComandasResult.data || []) as OpenComandaSummary[]);
                setDetailOpenComandasCount(openComandasResult.count || 0);
            }
        } catch (error) {
            console.error('Erro ao carregar detalhes do cliente:', error);
            setDetailChefClub(null);
            setDetailOpenComandas([]);
            setDetailOpenComandasCount(0);
        } finally {
            setDetailOpenComandasLoading(false);
        }
    }, [barberSupabase, tenantId]);

    const fetchClients = useCallback(async () => {
        let loadingId: string | undefined;

        if (!tenantId) {
            setClients([]);
            setChefClubMap({});
            setLoading(false);
            return;
        }

        setLoading(true);
        loadingId = showLoading('CLIENTS');
        
        try {
            const data = await clientRepository.list(tenantId);
            setClients(data);

            if (data.length === 0) {
                setChefClubMap({});
            } else {
                const planMap = await fetchActiveChefClubPlanMap(tenantId);
                setChefClubMap(planMap);
            }
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            setToast({ message: 'Erro ao carregar clientes.', type: 'error' });
        } finally {
            setLoading(false);
            hideLoading(loadingId);
        }
    }, [tenantId, showLoading, hideLoading]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    useEffect(() => {
        const state = location.state as { openClientId?: string; clientSearch?: string } | null;
        if (!state) return;

        if (state.clientSearch) {
            setSearch(state.clientSearch);
        }

        if (state.openClientId && clients.length > 0) {
            const targetClient = clients.find((client) => client.id === state.openClientId);
            if (targetClient) {
                void openClientDetails(targetClient);
                navigate(location.pathname, { replace: true, state: null });
            }
        }
    }, [clients, location.pathname, location.state, navigate, openClientDetails]);

    // Filtering & Sorting
    const processed = clients
        .filter(c => {
            const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search) || c.email.toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === 'all' || c.status === statusFilter;
            return matchSearch && matchStatus;
        })
        .sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'last_visit') cmp = new Date(a.last_visit).getTime() - new Date(b.last_visit).getTime();
            else if (sortKey === 'total_spent') cmp = (a.total_spent || 0) - (b.total_spent || 0);
            return sortDir === 'asc' ? cmp : -cmp;
        });

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const sortIcon = (key: SortKey) => {
        if (sortKey !== key) return 'sort';
        return sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward';
    };

    // CRUD
    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tenantId) {
            setToast({ message: 'Tenant inválido para cadastro de cliente.', type: 'error' });
            return;
        }
        try {
            await clientRepository.create({
                name: newForm.name,
                email: newForm.email,
                phone: newForm.phone,
                birthday: newForm.birthday,
            }, tenantId);
            setShowModal(false);
            setNewForm({ name: '', email: '', phone: '', birthday: '' });
            setToast({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            fetchClients();
        } catch (error) {
            const message = error instanceof RepositoryError ? error.message : 'Erro ao salvar cliente.';
            console.error('Erro ao salvar cliente:', error);
            setToast({ message, type: 'error' });
        }
    };

    const handleEditClick = (client: Client) => {
        setEditingId(client.id);
        setEditForm({ name: client.name, email: client.email, phone: client.phone, status: client.status, birthday: client.birthday });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !tenantId) return;
        try {
            await clientRepository.update(editingId, editForm, tenantId);
            setEditingId(null);
            setEditForm({});
            setToast({ message: 'Cliente atualizado!', type: 'success' });
            fetchClients();
        } catch (error) {
            const message = error instanceof RepositoryError ? error.message : 'Erro ao atualizar.';
            setToast({ message, type: 'error' });
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget || !tenantId) return;
        setDeleting(true);

        const clientId = deleteTarget.id;
        const ignoredCleanupErrorCodes = new Set(['42P01', '42703', '42501', 'PGRST116']);
        const cleanupLog: Array<{ table: string; status: 'success' | 'error'; detail?: string }> = [];

        const cleanupByClientId = async (table: string) => {
            const targetClient = table === 'customer_credits' || table === 'customer_subscriptions' || table === 'customer_vouchers'
                ? barberSupabase
                : supabase;
            const clientField = table === 'customer_vouchers' ? 'customer_id' : 'client_id';
            const { error } = await targetClient.from(table).delete().eq(clientField, clientId);
            if (error) {
                if (ignoredCleanupErrorCodes.has(String(error.code || ''))) {
                    cleanupLog.push({ table, status: 'success', detail: `Ignorado (código ${error.code})` });
                } else {
                    cleanupLog.push({ table, status: 'error', detail: `${error.message} (${error.code || 'sem-codigo'})` });
                    throw new Error(`Falha ao limpar ${table}: ${error.message}`);
                }
            } else {
                cleanupLog.push({ table, status: 'success' });
            }
        };

        try {
            const { data: clientComandas, error: comandasReadError } = await barberSupabase
                .from('comandas')
                .select('id')
                .eq('client_id', clientId);

            if (!comandasReadError && clientComandas && clientComandas.length > 0) {
                const comandaIds = clientComandas.map((c: { id: string }) => c.id);
                const { error: itemsError } = await barberSupabase
                    .from('comanda_items')
                    .delete()
                    .in('comanda_id', comandaIds);
                if (itemsError && !ignoredCleanupErrorCodes.has(String(itemsError.code || ''))) {
                    cleanupLog.push({ table: 'comanda_items', status: 'error', detail: itemsError.message });
                } else {
                    cleanupLog.push({ table: 'comanda_items', status: 'success' });
                }
            }

            // Limpeza paralela de todas as dependências independentes
            const cleanupTargets = [
                'appointments', 'portal_sessions', 'feedback_barber',
                'feedback_shop', 'kiosk_sessions', 'customer_credits',
                'customer_subscriptions', 'customer_vouchers', 'comandas',
            ];

            const results = await Promise.allSettled(
                cleanupTargets.map(table => cleanupByClientId(table))
            );

            // Consolidar falhas
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    const existing = cleanupLog.find(l => l.table === cleanupTargets[index]);
                    if (!existing) {
                        cleanupLog.push({
                            table: cleanupTargets[index],
                            status: 'error',
                            detail: result.reason?.message || 'Erro desconhecido',
                        });
                    }
                }
            });

            const failures = cleanupLog.filter(l => l.status === 'error');

            console.group(`[SMG][CLIENT][DELETE] clientId=${clientId} tenantId=${tenantId}`);
            console.log('Cleanup results:', cleanupLog);
            if (failures.length > 0) {
                console.warn('Failures:', failures);
            }
            console.groupEnd();

            // Delete final do cliente via repositório
            try {
                await clientRepository.delete(clientId, tenantId);
            } catch (deleteError) {
                console.error('[SMG][CLIENT][DELETE][ERROR]', deleteError);
                const failureReport = failures.length > 0
                    ? `\nDependências com falha: ${failures.map(f => f.table).join(', ')}`
                    : '';
                const message = deleteError instanceof RepositoryError
                    ? `${deleteError.message} (${deleteError.code || 'sem-codigo'})`
                    : 'Erro ao excluir cliente.';
                setToast({ message: `${message}${failureReport}`, type: 'error' });
                return;
            }

            if (failures.length > 0) {
                setToast({
                    message: `Cliente excluído, mas ${failures.length} dependência(s) não foram removidas: ${failures.map(f => f.table).join(', ')}. Verifique o console.`,
                    type: 'warning',
                });
            } else {
                setDeleteTarget(null);
                setToast({ message: 'Cliente excluído.', type: 'info' });
            }
            fetchClients();
        } finally {
            setDeleting(false);
        }
    };

    const formatDate = (d: string) => {
        if (!d) return '-';
        return new Date(d).toLocaleDateString('pt-BR');
    };

    const handleExportCSV = () => {
        if (processed.length === 0) {
            setToast({ message: 'Nenhum cliente para exportar.', type: 'info' });
            return;
        }

        const dataToExport = processed.map(c => ({
            Nome: c.name,
            Telefone: c.phone || '',
            Email: c.email || '',
            Aniversário: c.birthday ? formatDate(c.birthday) : '',
            Última_Visita: c.last_visit ? formatDate(c.last_visit) : '',
            Total_Gasto: c.total_spent ? c.total_spent.toFixed(2).replace('.', ',') : '0,00',
            Status: c.status === 'active' ? 'Ativo' : 'Inativo'
        }));

        const csvString = Papa.unparse(dataToExport);
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `base_clientes_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const csvText = await file.text();
            const existingKeys = new Set<string>(clients.filter((c) => c.phone.trim() !== '').map((c) => phoneDuplicateKey(c.phone)));

            const preview = buildImportPreview({
                definition: clientImportDefinition,
                csvText,
                fileBytes: file.size,
                fileName: file.name,
                existingKeys,
            });

            if (preview.fileErrors.length > 0) {
                setToast({ message: preview.fileErrors[0], type: 'error' });
            } else if (preview.validRows.length === 0 && preview.duplicateRows.length === 0) {
                setToast({ message: 'Nenhum cliente válido encontrado no CSV.', type: 'error' });
            } else {
                setIncludeDuplicates(false);
                setImportPreview(preview);
                setIsImportModalOpen(true);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Erro ao ler o arquivo.';
            setToast({ message: `Erro ao ler CSV: ${message}`, type: 'error' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleConfirmImport = async () => {
        if (!importPreview) return;

        const rowsToImport = includeDuplicates
            ? [...importPreview.validRows, ...importPreview.duplicateRows]
            : importPreview.validRows;

        if (rowsToImport.length === 0) {
            setToast({ message: 'Nenhum cliente válido para importar.', type: 'error' });
            return;
        }

        setIsImportModalOpen(false);
        setLoading(true);
        try {
            const jobId = crypto.randomUUID();
            const result = await clientRepository.importViaJob(jobId, rowsToImport.map(toPersistableRow));
            setImportPreview(null);
            setToast({ message: `${result.importedRows} de ${result.totalRows} clientes importados com sucesso!`, type: 'success' });
            fetchClients();
        } catch (error) {
            const message = error instanceof RepositoryError ? error.message : 'Erro ao importar clientes.';
            setToast({ message, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto w-full animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h2>
                    <p className="text-slate-500 text-sm">{clients.length} cliente(s) cadastrado(s)</p>
                </div>
                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 w-full md:w-auto">
                    <button onClick={() => fileInputRef.current?.click()} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Importar CSV
                    </button>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" title="Arquivo CSV" onChange={handleFileUpload} />
                    <button onClick={handleExportCSV} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all">
                        <span className="material-symbols-outlined text-sm">download</span>
                        Exportar Base
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-blue-600 shadow-lg shadow-primary/20 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, telefone ou e-mail..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white"
                    />
                </div>
                <div className="flex gap-2">
                    {(['all', 'active', 'inactive'] as const).map(s => (
                        <button key={s}
                            onClick={() => setStatusFilter(s)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${statusFilter === s ? 'bg-primary text-white shadow-md' : 'bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                        >
                            {s === 'all' ? 'Todos' : s === 'active' ? 'Ativos' : 'Inativos'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <LoadingBlock loading={loading} message="Carregando clientes..." minHeight="min-h-[400px]">
                <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <div className="sm:hidden px-4 py-2 border-b border-slate-100 dark:border-border-dark bg-slate-50/70 dark:bg-white/[0.02] text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Deslize para ver mais colunas
                        </div>
                        <table className="w-full min-w-[760px]">
                            <thead className="bg-slate-50 dark:bg-white/5">
                                <tr className="text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <th className="px-5 py-3">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            Cliente <span className="material-symbols-outlined text-sm">{sortIcon('name')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden md:table-cell">Telefone</th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('last_visit')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            {isEsteticaApp ? 'Último atendimento' : 'Última Visita'} <span className="material-symbols-outlined text-sm">{sortIcon('last_visit')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors">
                                            Total Gasto <span className="material-symbols-outlined text-sm">{sortIcon('total_spent')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                {processed.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-10 text-slate-500 text-sm">
                                            {isEsteticaApp ? 'Cadastre clientes para acompanhar atendimentos, retornos e histórico.' : 'Nenhum cliente encontrado.'}
                                        </td>
                                    </tr>
                                )}
                                {processed.map(client => (
                                    <tr key={client.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden border border-slate-200 dark:border-white/5">
                                                    {client.avatar ? (
                                                        <img src={client.avatar} alt={client.name} className="size-full object-cover" />
                                                    ) : (
                                                        <div className="size-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-slate-400 text-sm">person</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{client.name}</p>
                                                        {!isEsteticaApp && chefClubMap[client.id] && (
                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[9px] font-black uppercase tracking-tighter" title={`Club dos Chefes: ${chefClubMap[client.id]}`}>
                                                                <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
                                                                Membro
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 hidden sm:block">{client.email || 'Sem e-mail'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell">
                                            <span className="text-sm text-slate-700 dark:text-slate-300">{client.phone || '-'}</span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">{formatDate(client.last_visit)}</td>
                                        <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white hidden lg:table-cell">R$ {(client.total_spent || 0).toFixed(2)}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${client.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                {!isEsteticaApp && (
                                                    <button
                                                        onClick={() => navigate(`/chef-club-subscriptions/new?from=clients&clientId=${client.id}`)}
                                                        className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                        title="Virar Assinante"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">workspace_premium</span>
                                                    </button>
                                                )}
                                                <button onClick={() => void openClientDetails(client)} className="p-2.5 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors" title="Ver Detalhes">
                                                    <span className="material-symbols-outlined text-lg">visibility</span>
                                                </button>
                                                <button onClick={() => handleEditClick(client)} className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Editar">
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button onClick={() => setDeleteTarget(client)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Excluir">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </LoadingBlock>

            {/* Detail Modal */}
            <Modal
                isOpen={!!detailClient}
                onClose={() => setDetailClient(null)}
                title="Detalhes do Cliente"
                maxWidth="2xl"
            >
                {detailClient && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="size-16 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden border border-slate-200 dark:border-white/5">
                                {detailClient.avatar ? (
                                    <img src={detailClient.avatar} alt={detailClient.name} className="size-full object-cover" />
                                ) : (
                                    <div className="size-full flex items-center justify-center">
                                        <span className="material-symbols-outlined text-slate-400 text-2xl">person</span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="text-xl font-bold text-slate-900 dark:text-white">{detailClient.name}</h4>
                                <p className={`text-xs font-bold uppercase ${detailClient.status === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>{detailClient.status === 'active' ? 'Ativo' : 'Inativo'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Telefone</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.phone || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Email</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{detailClient.email || '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Aniversário</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.birthday ? formatDate(detailClient.birthday) : '-'}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Gasto</p>
                                <p className="text-sm font-bold text-emerald-500">R$ {(detailClient.total_spent || 0).toFixed(2)}</p>
                            </div>
                            {detailOpenComandasLoading && (
                                <div className="col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">Verificando {orderPluralLower} abertos...</p>
                                </div>
                            )}
                            {!detailOpenComandasLoading && detailOpenComandasCount > 0 && (
                                <div className="col-span-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                                                Este cliente possui {orderLabelLower} aberto
                                            </p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                                {detailOpenComandasCount === 1
                                                    ? `1 ${orderLabelLower} em aberto`
                                                    : `${detailOpenComandasCount} ${orderPluralLower} em aberto`}
                                            </p>
                                        </div>
                                        <span className="inline-flex w-fit items-center gap-1 rounded-full border border-amber-500/30 bg-white/70 px-2 py-1 text-[10px] font-black uppercase text-amber-700 dark:bg-white/5 dark:text-amber-300">
                                            <span className="material-symbols-outlined text-[12px]">receipt_long</span>
                                            Aberta
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {detailOpenComandas.map((comanda) => (
                                            <div key={comanda.id} className="flex flex-col gap-2 rounded-lg bg-white/80 p-3 dark:bg-white/5 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-black text-slate-900 dark:text-white">
                                                        {orderLabel} #{getDisplayId(comanda.id)}
                                                    </p>
                                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                                        {formatCurrency(comanda.total)} • {formatDateTime(comanda.created_at)} • Aberto
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDetailClient(null);
                                                        navigate(`/checkout/${comanda.id}`);
                                                    }}
                                                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-primary/90"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">visibility</span>
                                                    Ver {orderLabelLower}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!isEsteticaApp && detailChefClub && (
                                <div className="col-span-2 bg-amber-500/5 border border-amber-500/20 p-4 rounded-xl flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 bg-amber-500 text-white rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
                                            <span className="material-symbols-outlined">workspace_premium</span>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-amber-600 font-black uppercase">Club dos Chefes</p>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{detailChefClub.planName}</p>
                                            <p className="text-[10px] text-slate-500 font-bold">Status: {detailChefClub.status === 'active' ? 'Ativo' : 'Pendente'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-black text-amber-600 leading-none">{detailChefClub.credits}</p>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Créditos</p>
                                    </div>
                                </div>
                            )}
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">{isEsteticaApp ? 'Último atendimento' : 'Última Visita'}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{formatDate(detailClient.last_visit)}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Último {serviceLabel}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.last_service || '-'}</p>
                            </div>
                            <CustomerVouchersSection
                                tenantId={tenantId}
                                customerId={detailClient.id}
                                currentUserId={user?.id || null}
                                onToast={setToast}
                            />
                        </div>
                        <button onClick={() => { setDetailClient(null); navigate('/schedule'); }}
                            className="w-full py-3 bg-primary text-white rounded-lg text-sm font-bold hover:bg-blue-600 transition-colors mt-2">
                            Agendar para este Cliente
                        </button>
                    </div>
                )}
            </Modal>

            {/* Modal de Edição (Novo!) */}
            <Modal
                isOpen={!!editingId}
                onClose={() => { setEditingId(null); setEditForm({}); }}
                title="Editar Cliente"
                maxWidth="md"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                        <input type="text" required value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            title="Nome Completo" placeholder="Ex: Carlos Oliveira"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                        <input type="tel" required value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            title="Telefone" placeholder="(11) 99999-9999"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email</label>
                        <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            title="E-mail" placeholder="email@exemplo.com"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Nascimento</label>
                        <DatePickerInput value={editForm.birthday || ''} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                            title="Data de Nascimento" placeholder="Data de Nascimento"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Status</label>
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            title="Status do Cliente"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary [color-scheme:light] dark:[color-scheme:dark]">
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setEditingId(null); setEditForm({}); }}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">Salvar Alterações</button>
                    </div>
                </form>
            </Modal>

            {/* Modal de Criação */}
            <Modal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                title="Novo Cliente"
                maxWidth="md"
            >
                <form onSubmit={handleCreateClient} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Nome Completo</label>
                        <input type="text" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                            title="Nome Completo"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="Ex: Carlos Oliveira" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Telefone</label>
                        <input type="tel" required value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                            title="Telefone"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Email (Opcional)</label>
                        <input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                            title="E-mail"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" placeholder="email@exemplo.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Data de Nascimento</label>
                        <DatePickerInput value={newForm.birthday} onChange={(e) => setNewForm({ ...newForm, birthday: e.target.value })}
                            title="Data de Nascimento" placeholder="Data de Nascimento"
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-lg p-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowModal(false)}
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">Salvar</button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                title="Confirmar Exclusão"
                maxWidth="sm"
            >
                {deleteTarget && (
                    <div className="text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>
                        <p className="text-sm text-slate-500 mb-6">Tem certeza que deseja excluir <strong>{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-60"
                            >
                                {deleting ? 'Excluindo...' : 'Excluir'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* IMPORT PREVIEW MODAL */}
            <Modal
                isOpen={isImportModalOpen}
                onClose={() => { setIsImportModalOpen(false); setImportPreview(null); }}
                title="Conciliação de Base de Clientes"
                maxWidth="3xl"
            >
                {importPreview && (
                    <div className="space-y-4">
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Revisão de Dados</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>{importPreview.fileName}</strong> — {importPreview.totalRows} linha(s) lida(s).
                                Nada é gravado até a confirmação.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
                                <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{importPreview.validRows.length} válida(s)</span>
                                <span className="px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">{importPreview.duplicateRows.length} duplicada(s)</span>
                                <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400">{importPreview.invalidRows.length} inválida(s)</span>
                            </div>
                            {importPreview.warnings.length > 0 && (
                                <ul className="mt-2 text-[11px] text-amber-600 dark:text-amber-400 list-disc list-inside space-y-0.5">
                                    {importPreview.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            )}
                        </div>

                        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                            <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-200 dark:border-border-dark">
                                        <tr>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">#</th>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nome Completo</th>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Telefone</th>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Email</th>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nascimento</th>
                                            <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm">
                                        {importPreview.rows.map((row) => (
                                            <tr key={row.rowNumber} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                                <td className="px-4 py-3 text-xs text-slate-400">{row.rowNumber}</td>
                                                <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{row.values.name || '—'}</td>
                                                <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{row.values.phone || '—'}</td>
                                                <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{row.values.email || '—'}</td>
                                                <td className="px-4 py-3 text-slate-900 dark:text-slate-300">{row.values.birthday || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {row.status === 'valid' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase">Válida</span>
                                                    )}
                                                    {row.status === 'duplicate' && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase w-fit">Duplicada</span>
                                                            {row.duplicateOf && <span className="text-[11px] text-amber-600 dark:text-amber-400">{row.duplicateOf}</span>}
                                                        </div>
                                                    )}
                                                    {row.status === 'invalid' && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase w-fit">Inválida</span>
                                                            {row.errors.map((e, i) => <span key={i} className="text-[11px] text-red-600 dark:text-red-400">{e}</span>)}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {importPreview.duplicateRows.length > 0 && (
                            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeDuplicates}
                                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                                    className="size-4 accent-primary"
                                />
                                Incluir as {importPreview.duplicateRows.length} duplicada(s) sinalizada(s) mesmo assim
                            </label>
                        )}

                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark mt-6">
                            <button type="button" onClick={() => { setIsImportModalOpen(false); setImportPreview(null); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                                Descartar Arquivo
                            </button>
                            <button type="button" onClick={handleConfirmImport} disabled={loading || (importPreview.validRows.length + (includeDuplicates ? importPreview.duplicateRows.length : 0)) === 0} className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Salvar ${importPreview.validRows.length + (includeDuplicates ? importPreview.duplicateRows.length : 0)} Cliente(s)`}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Clients;
