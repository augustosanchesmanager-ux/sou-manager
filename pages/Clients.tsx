import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { getScopedClient, getClientForTable, supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { LoadingBlock } from '../components/ui/Loading';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { fetchActiveChefClubPlanMap, fetchChefClubSummaryByClient, fetchChefClubPlanStatus, fetchChefClubCreditUsageHistory } from '../src/lib/supabase/chefClub';
import { cancelSubscription, pauseSubscription, reactivateSubscription, renewSubscription, createSubscription } from '../src/lib/supabase/subscriptionActions';
import type { ChefClubPlanStatus, ChefClubCreditUsage } from '../src/types/membership';

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

interface ParsedClient {
    name: string;
    phone: string;
    email: string;
    birthday: string;
}

type SortKey = 'name' | 'last_visit' | 'total_spent';
type SortDir = 'asc' | 'desc';

const Clients: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { showLoading, hideLoading } = useLoading();
    const { tenantId } = useAuth();
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
    const [parsedData, setParsedData] = useState<ParsedClient[]>([]);

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
    const [chefClubMap, setChefClubMap] = useState<Record<string, string>>({});

    // Expanded CC section in detail modal
    const [ccPlanStatus, setCcPlanStatus] = useState<ChefClubPlanStatus | null>(null);
    const [ccCreditHistory, setCcCreditHistory] = useState<ChefClubCreditUsage[]>([]);
    const [ccLoading, setCcLoading] = useState(false);
    const [ccActionLoading, setCcActionLoading] = useState(false);
    const [ccActionModal, setCcActionModal] = useState<'cancel' | 'pause' | 'reactivate' | 'renew' | 'create' | null>(null);
    const [ccCreatePlans, setCcCreatePlans] = useState<{ id: string; name: string; monthly_price: number }[]>([]);
    const [ccSelectedPlanId, setCcSelectedPlanId] = useState('');

    const openClientDetails = useCallback(async (client: Client) => {
        setDetailClient(client);
        setDetailChefClub(null);
        setCcPlanStatus(null);
        setCcCreditHistory([]);

        try {
            const summary = await fetchChefClubSummaryByClient(client.id, tenantId);
            setDetailChefClub(summary);
        } catch (error) {
            console.error('Erro ao carregar resumo do Clube do Chefe:', error);
            setDetailChefClub(null);
        }
    }, [tenantId]);

    const loadCCFullData = useCallback(async (clientId: string) => {
        if (!tenantId || !clientId) return;
        setCcLoading(true);
        try {
            const [statusRes, historyRes] = await Promise.all([
                fetchChefClubPlanStatus(tenantId, clientId),
                fetchChefClubCreditUsageHistory(tenantId, clientId, undefined, 20),
            ]);
            setCcPlanStatus(statusRes);
            setCcCreditHistory(historyRes || []);
        } catch (err) {
            console.warn('Erro ao carregar dados do Clube:', err);
        } finally {
            setCcLoading(false);
        }
    }, [tenantId]);

    const loadCCPlans = useCallback(async () => {
        if (!tenantId) return;
        const { data } = await supabase
            .from('customer_plans')
            .select('id, name, monthly_price')
            .eq('tenant_id', tenantId)
            .eq('active', true)
            .order('monthly_price', { ascending: true });
        if (data) setCcCreatePlans(data as { id: string; name: string; monthly_price: number }[]);
    }, [tenantId]);

    const handleCCAction = async (action: 'cancel' | 'pause' | 'reactivate' | 'renew') => {
        if (!ccPlanStatus?.subscription_id || !tenantId) return;
        setCcActionLoading(true);
        let result: { success: boolean; message: string };
        if (action === 'cancel') result = await cancelSubscription(tenantId, ccPlanStatus.subscription_id);
        else if (action === 'pause') result = await pauseSubscription(tenantId, ccPlanStatus.subscription_id);
        else if (action === 'reactivate') result = await reactivateSubscription(tenantId, ccPlanStatus.subscription_id);
        else result = await renewSubscription(tenantId, ccPlanStatus.subscription_id);
        setCcActionLoading(false);
        setCcActionModal(null);
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success && detailClient) {
            await loadCCFullData(detailClient.id);
            const summary = await fetchChefClubSummaryByClient(detailClient.id, tenantId);
            setDetailChefClub(summary);
        }
    };

    const handleCCCreate = async () => {
        if (!tenantId || !detailClient || !ccSelectedPlanId) {
            setToast({ message: 'Selecione um plano.', type: 'error' });
            return;
        }
        setCcActionLoading(true);
        const result = await createSubscription({ tenantId, clientId: detailClient.id, planId: ccSelectedPlanId });
        setCcActionLoading(false);
        setCcActionModal(null);
        setCcSelectedPlanId('');
        setToast({ message: result.message, type: result.success ? 'success' : 'error' });
        if (result.success) {
            await loadCCFullData(detailClient.id);
            const summary = await fetchChefClubSummaryByClient(detailClient.id, tenantId);
            setDetailChefClub(summary);
        }
    };

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
            const clientsClient = getClientForTable('clients', 'barber');
            const { data, error } = await clientsClient
                .from('clients')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name');
            if (data) {
                setClients(data);

                if (data.length === 0) {
                    setChefClubMap({});
                } else {
                    const planMap = await fetchActiveChefClubPlanMap(tenantId);
                    setChefClubMap(planMap);
                }
            }
            if (error) setToast({ message: 'Erro ao carregar clientes.', type: 'error' });
        } catch (error) {
            console.error('Erro ao carregar clientes:', error);
            setToast({ message: 'Erro ao carregar clientes.', type: 'error' });
        } finally {
            setLoading(false);
            hideLoading(loadingId);
        }
    }, [tenantId, showLoading, hideLoading]);

    useEffect(() => { fetchClients(); }, [fetchClients]);

    // Load full CC data when detail modal opens
    useEffect(() => {
        if (detailClient) {
            void loadCCFullData(detailClient.id);
        }
    }, [detailClient, loadCCFullData]);

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
            setToast({ message: 'Tenant invalido para cadastro de cliente.', type: 'error' });
            return;
        }
        const clientsClient = getClientForTable('clients', 'barber');
        const { error } = await clientsClient.from('clients').insert({
            name: newForm.name,
            email: newForm.email,
            phone: newForm.phone,
            birthday: newForm.birthday,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newForm.name)}&background=random`,
            tenant_id: tenantId,
        });
        if (error) {
            console.error('Erro ao salvar cliente:', error);
            setToast({ message: `Erro ao salvar: ${error.message}`, type: 'error' });
            return;
        }
        setShowModal(false);
        setNewForm({ name: '', email: '', phone: '', birthday: '' });
        setToast({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
        fetchClients();
    };

    const handleEditClick = (client: Client) => {
        setEditingId(client.id);
        setEditForm({ name: client.name, email: client.email, phone: client.phone, status: client.status, birthday: client.birthday });
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId || !tenantId) return;
        const clientsClient = getClientForTable('clients', 'barber');
        const { error } = await clientsClient
            .from('clients')
            .update(editForm)
            .eq('id', editingId)
            .eq('tenant_id', tenantId);
        if (error) { setToast({ message: 'Erro ao atualizar.', type: 'error' }); return; }
        setEditingId(null);
        setEditForm({});
        setToast({ message: 'Cliente atualizado!', type: 'success' });
        fetchClients();
    };

    const handleDelete = async () => {
        if (!deleteTarget || !tenantId) return;
        setDeleting(true);

        const clientId = deleteTarget.id;
        const ignoredCleanupErrorCodes = new Set(['42P01', '42703', '42501', 'PGRST116']);

        const cleanupByClientId = async (table: string) => {
            const targetClient = table === 'customer_credits' || table === 'customer_subscriptions'
                ? barberSupabase
                : supabase;
            const { error } = await targetClient.from(table).delete().eq('client_id', clientId);
            if (error && !ignoredCleanupErrorCodes.has(String(error.code || ''))) {
                console.warn(`Falha ao limpar dependencias em ${table}:`, error);
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
                    console.warn('Falha ao limpar comanda_items:', itemsError);
                }
            }

            await cleanupByClientId('appointments');
            await cleanupByClientId('portal_sessions');
            await cleanupByClientId('feedback_barber');
            await cleanupByClientId('feedback_shop');
            await cleanupByClientId('kiosk_sessions');
            await cleanupByClientId('customer_credits');
            await cleanupByClientId('customer_subscriptions');
            await cleanupByClientId('comandas');

            const clientsClient = getClientForTable('clients', 'barber');
            const { error } = await clientsClient
                .from('clients')
                .delete()
                .eq('id', clientId)
                .eq('tenant_id', tenantId);

            if (error) {
                console.error('DELETE CLIENT ERROR:', JSON.stringify(error));
                setToast({ message: `Erro ao excluir: ${error.message} (${error.code || 'sem-codigo'})`, type: 'error' });
                return;
            }

            setDeleteTarget(null);
            setToast({ message: 'Cliente excluído.', type: 'info' });
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

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                const data = results.data as any[];
                const mapped: ParsedClient[] = [];

                data.forEach(row => {
                    const nameStr = row.Nome || row.nome || row.Name || row.name || row.Cliente;
                    const phoneStr = row.Telefone || row.telefone || row.Phone || row.phone || row.Celular || '';
                    const emailStr = row.Email || row.email || row['E-mail'] || '';
                    const bdayStr = row.Aniversário || row.aniversário || row.Aniversario || row.nascimento || row.Birthday || '';

                    if (nameStr) {
                        // parse pt-BR date
                        let isoDate = '';
                        if (bdayStr.includes('/')) {
                            const parts = bdayStr.split('/');
                            if (parts.length === 3) isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                        } else if (bdayStr.includes('-')) {
                            isoDate = bdayStr;
                        }

                        mapped.push({
                            name: nameStr,
                            phone: String(phoneStr).trim(),
                            email: String(emailStr).trim(),
                            birthday: isoDate,
                        });
                    }
                });

                if (mapped.length > 0) {
                    setParsedData(mapped);
                    setIsImportModalOpen(true);
                } else {
                    setToast({ message: 'Nenhum cliente válido encontrado no CSV.', type: 'error' });
                }
                if (fileInputRef.current) fileInputRef.current.value = '';
            },
            error: (error) => {
                setToast({ message: `Erro ao ler CSV: ${error.message}`, type: 'error' });
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        });
    };

    const handleConfirmImport = async () => {
        if (!tenantId) {
            setToast({ message: 'Tenant invalido para importar clientes.', type: 'error' });
            return;
        }
        setLoading(true);
        const toInsert = parsedData.map(c => ({
            name: c.name,
            phone: c.phone,
            email: c.email,
            birthday: c.birthday ? c.birthday : null,
            status: 'active',
            tenant_id: tenantId,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=random`
        }));

        const clientsClient = getClientForTable('clients', 'barber');
        const { error } = await clientsClient.from('clients').insert(toInsert);

        if (error) {
            setToast({ message: `Erro ao importar: ${error.message}`, type: 'error' });
        } else {
            setToast({ message: `${toInsert.length} clientes importados com sucesso!`, type: 'success' });
            setIsImportModalOpen(false);
            setParsedData([]);
            fetchClients();
        }
        setLoading(false);
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
                                            Última Visita <span className="material-symbols-outlined text-sm">{sortIcon('last_visit')}</span>
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
                                        <td colSpan={6} className="text-center py-10 text-slate-500 text-sm">Nenhum cliente encontrado.</td>
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
                                                        {chefClubMap[client.id] && (
                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500/10 text-amber-600 rounded text-[9px] font-black uppercase tracking-tighter" title={`Clube do Chefe: ${chefClubMap[client.id]}`}>
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
                                                <button
                                                    onClick={() => navigate(`/chef-club-subscriptions/new?from=clients&clientId=${client.id}`)}
                                                    className="p-2.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                                    title="Virar Assinante"
                                                >
                                                    <span className="material-symbols-outlined text-lg">workspace_premium</span>
                                                </button>
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
                maxWidth="md"
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
                            {ccLoading ? (
                                <div className="col-span-2 py-4 text-center">
                                    <div className="inline-block animate-spin rounded-full size-5 border-2 border-amber-500 border-t-transparent" />
                                    <p className="text-xs text-slate-400 mt-1">Carregando Clube dos Chefes...</p>
                                </div>
                            ) : ccPlanStatus ? (
                                <div className="col-span-2">
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl overflow-hidden">
                                        <div className="p-4 flex items-center justify-between border-b border-amber-500/10">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 bg-amber-500 text-white rounded-lg flex items-center justify-center">
                                                    <span className="material-symbols-outlined">workspace_premium</span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-bold text-slate-900 dark:text-white">{ccPlanStatus.plan_name || 'Plano'}</p>
                                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${ccPlanStatus.status === 'active' ? 'bg-emerald-100 text-emerald-600' : ccPlanStatus.status === 'canceled' ? 'bg-red-100 text-red-500' : ccPlanStatus.status === 'paused' ? 'bg-yellow-100 text-yellow-600' : 'bg-orange-100 text-orange-500'}`}>
                                                            {ccPlanStatus.status === 'active' ? 'Plano ativo' : ccPlanStatus.status === 'canceled' ? 'Cancelado' : ccPlanStatus.status === 'paused' ? 'Pausado' : 'Vencido'}
                                                        </span>
                                                    </div>
                                                    {ccPlanStatus.plan_monthly_price != null && (
                                                        <p className="text-[10px] text-slate-500 font-bold">R$ {ccPlanStatus.plan_monthly_price.toFixed(2)}/mês · Ciclo: {ccPlanStatus.cycle_start ? new Date(ccPlanStatus.cycle_start).toLocaleDateString('pt-BR') : '-'} a {ccPlanStatus.cycle_end ? new Date(ccPlanStatus.cycle_end).toLocaleDateString('pt-BR') : '-'}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xl font-black text-amber-600 leading-none">{ccPlanStatus.available_credits}</p>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Disponíveis</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">{ccPlanStatus.used_credits} usado(s)</p>
                                            </div>
                                        </div>
                                        {ccPlanStatus.service_credits && Array.isArray(ccPlanStatus.service_credits) && ccPlanStatus.service_credits.length > 0 ? (
                                            <div className="px-4 py-3 border-b border-amber-500/10">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase mb-2">Créditos por Serviço</p>
                                                <div className="grid grid-cols-2 gap-1">
                                                    {(ccPlanStatus.service_credits as any[]).map((sc, i) => (
                                                        <div key={i} className="flex justify-between text-xs">
                                                            <span className="text-slate-600 dark:text-slate-300">{sc.service_name || 'Serviço'}</span>
                                                            <span className="font-bold text-amber-600">{sc.credits} disponivel(is)</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-4 py-3 border-b border-amber-500/10">
                                                <p className="text-xs text-slate-400">Créditos totais: {ccPlanStatus.total_credits} · Usados: {ccPlanStatus.used_credits}</p>
                                            </div>
                                        )}
                                        <div className="px-4 py-3">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase mb-2">Histórico de Uso</p>
                                            {ccCreditHistory.length === 0 ? (
                                                <p className="text-xs text-slate-400 italic py-2">Nenhum crédito usado neste ciclo.</p>
                                            ) : (
                                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                                    {ccCreditHistory.slice(0, 10).map(u => (
                                                        <div key={u.id} className="flex justify-between items-center text-xs py-1 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                                            <div>
                                                                <p className="font-semibold text-slate-700 dark:text-slate-200">{u.service_name || 'Serviço'}</p>
                                                                <p className="text-[10px] text-slate-400">{u.used_at ? new Date(u.used_at).toLocaleDateString('pt-BR') : ''}{u.professional_name ? ` · ${u.professional_name}` : ''}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="font-bold text-amber-600">-{u.quantity_used} crédito(s)</p>
                                                                {u.original_price != null && <p className="text-[9px] text-slate-400">R$ {u.original_price.toFixed(2)}</p>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="px-4 py-3 bg-slate-50 dark:bg-black/10 flex gap-2 flex-wrap">
                                            {ccPlanStatus.status === 'active' && (
                                                <>
                                                    <button onClick={() => setCcActionModal('pause')} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg text-xs font-bold hover:bg-yellow-200 transition-colors">Pausar</button>
                                                    <button onClick={() => setCcActionModal('cancel')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Cancelar</button>
                                                </>
                                            )}
                                            {ccPlanStatus.status === 'canceled' && (
                                                <button onClick={() => setCcActionModal('reactivate')} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">Reativar</button>
                                            )}
                                            {(ccPlanStatus.status === 'past_due' || ccPlanStatus.status === 'paused') && (
                                                <button onClick={() => setCcActionModal('reactivate')} className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-200 transition-colors">Reativar</button>
                                            )}
                                            {ccPlanStatus.status !== 'active' && (
                                                <button onClick={() => setCcActionModal('renew')} className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold hover:bg-emerald-200 transition-colors">Renovar Ciclo</button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : !detailChefClub && !ccLoading && (
                                <div className="col-span-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-5 text-center">
                                    <div className="size-12 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-3">
                                        <span className="material-symbols-outlined text-2xl">workspace_premium</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Cliente ainda não possui assinatura ativa.</p>
                                    <button
                                        onClick={() => { void loadCCPlans(); setCcActionModal('create'); }}
                                        className="mt-3 px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors"
                                    >
                                        Adicionar ao Clube
                                    </button>
                                </div>
                            )}
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Última Visita</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{formatDate(detailClient.last_visit)}</p>
                            </div>
                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg">
                                <p className="text-[10px] text-slate-500 uppercase font-bold">Último Serviço</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{detailClient.last_service || '-'}</p>
                            </div>
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
                onClose={() => { setIsImportModalOpen(false); setParsedData([]); }}
                title="Conciliação de Base de Clientes"
                maxWidth="3xl"
            >
                <div className="space-y-4">
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase mb-1">Revisão de Dados</p>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Encontramos <strong>{parsedData.length} clientes</strong> prontos para cadastro. Modifique os detalhes listados caso precise de algum ajuste fino, ou descarte para abortar a inserção no banco de dados.</p>
                    </div>

                    <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-border-dark overflow-hidden">
                        <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10 border-b border-slate-200 dark:border-border-dark">
                                    <tr>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nome Completo</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Telefone</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Email</th>
                                        <th className="px-4 py-3 text-xs uppercase font-bold text-slate-500 tracking-wider">Nascimento</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-border-dark text-sm">
                                    {parsedData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-white/5">
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="text"
                                                    value={row.name}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].name = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[150px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="text"
                                                    value={row.phone}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].phone = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[130px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <input
                                                    type="email"
                                                    value={row.email}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].email = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-transparent border-b border-transparent focus:border-primary focus:outline-none w-full min-w-[160px]"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-slate-900 dark:text-slate-300">
                                                <DatePickerInput
                                                    value={row.birthday}
                                                    onChange={e => {
                                                        const copy = [...parsedData];
                                                        copy[i].birthday = e.target.value;
                                                        setParsedData(copy);
                                                    }}
                                                    className="bg-slate-50 dark:bg-[#1A1A1A] text-xs font-bold rounded p-1 outline-none text-slate-700 dark:text-slate-300"
                                                    style={{ colorScheme: 'dark' }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex gap-3 justify-end pt-4 border-t border-slate-200 dark:border-border-dark mt-6">
                        <button type="button" onClick={() => { setIsImportModalOpen(false); setParsedData([]); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors">
                            Descartar Arquivo
                        </button>
                        <button type="button" onClick={handleConfirmImport} disabled={loading} className="px-8 py-2.5 rounded-lg text-sm font-bold text-white bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                            {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Salvar ${parsedData.length} Clientes`}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* CC Action Confirmation Modal */}
            <Modal
                isOpen={!!ccActionModal && ccActionModal !== 'create'}
                onClose={() => setCcActionModal(null)}
                title={
                    ccActionModal === 'cancel' ? 'Cancelar Assinatura' :
                    ccActionModal === 'pause' ? 'Pausar Assinatura' :
                    ccActionModal === 'reactivate' ? 'Reativar Assinatura' :
                    'Renovar Ciclo'
                }
                maxWidth="sm"
            >
                <div className="text-center space-y-4">
                    <div className={`size-14 rounded-full flex items-center justify-center mx-auto ${ccActionModal === 'cancel' ? 'bg-red-100 text-red-500' : ccActionModal === 'pause' ? 'bg-yellow-100 text-yellow-600' : 'bg-amber-100 text-amber-600'}`}>
                        <span className="material-symbols-outlined text-2xl">
                            {ccActionModal === 'cancel' ? 'cancel' : ccActionModal === 'pause' ? 'pause_circle' : ccActionModal === 'reactivate' ? 'refresh' : 'autorenew'}
                        </span>
                    </div>
                    <p className="text-sm text-slate-500">
                        {ccActionModal === 'cancel' ? 'Tem certeza que deseja cancelar a assinatura? O histórico de uso será preservado.' :
                         ccActionModal === 'pause' ? 'A assinatura será pausada. Os créditos atuais não serão perdidos.' :
                         ccActionModal === 'reactivate' ? 'A assinatura será reativada.' :
                         'Um novo ciclo será iniciado com novos créditos.'}
                    </p>
                    <div className="flex gap-3">
                        <button onClick={() => setCcActionModal(null)} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Voltar</button>
                        <button
                            onClick={() => void handleCCAction(ccActionModal as 'cancel' | 'pause' | 'reactivate' | 'renew')}
                            disabled={ccActionLoading}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold text-white transition-colors disabled:opacity-60 ${ccActionModal === 'cancel' ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'}`}
                        >
                            {ccActionLoading ? 'Aguarde...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* CC Create Plan Selection Modal */}
            <Modal
                isOpen={ccActionModal === 'create'}
                onClose={() => { setCcActionModal(null); setCcSelectedPlanId(''); }}
                title="Adicionar ao Clube dos Chefes"
                maxWidth="sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-500">Selecione o plano para este cliente:</p>
                    {ccCreatePlans.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Nenhum plano ativo encontrado.</p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            {ccCreatePlans.map(plan => (
                                <button
                                    key={plan.id}
                                    onClick={() => setCcSelectedPlanId(plan.id)}
                                    className={`w-full text-left p-3 rounded-lg border transition-all ${ccSelectedPlanId === plan.id ? 'border-amber-500 bg-amber-500/5' : 'border-slate-200 dark:border-slate-700 hover:border-amber-300'}`}
                                >
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{plan.name}</p>
                                    <p className="text-xs text-slate-500">R$ {plan.monthly_price.toFixed(2)}/mês</p>
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-3 pt-2">
                        <button onClick={() => { setCcActionModal(null); setCcSelectedPlanId(''); }} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors">Cancelar</button>
                        <button
                            onClick={() => void handleCCCreate()}
                            disabled={!ccSelectedPlanId || ccActionLoading}
                            className="flex-1 py-2.5 rounded-lg text-sm font-bold text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-60"
                        >
                            {ccActionLoading ? 'Criando...' : 'Criar Assinatura'}
                        </button>
                    </div>
                </div>
            </Modal>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Clients;
