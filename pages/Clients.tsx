import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { getScopedClient, supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { LoadingBlock } from '../components/ui/Loading';
import ClientProfile360Drawer, {
    type UpcomingAppointmentSummary,
    type StaffOption,
    type OpenComandaSummary,
} from '../components/customers/ClientProfile360Drawer';
import ClientReengagementModal from '../components/customers/ClientReengagementModal';
import { useLoading } from '../context/LoadingContext';
import { useAuth } from '../context/AuthContext';
import { fetchActiveChefClubPlanMap, fetchChefClubSummaryByClient } from '../src/lib/supabase/chefClub';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { formatCurrency } from '../shared/format/currency';
import { clientRepository, RepositoryError, type Client } from '../domain/client';
import {
    calculateAverageTicket,
    calculatePreferredBarber,
    type PreferredBarberSummary,
} from '../src/utils/clientProfile';
import {
    getClientInactivityStatus,
    type InactivityTier,
} from '../src/utils/clientReengagement';
import { buildImportPreview, clientImportDefinition, phoneDuplicateKey, toPersistableRow, type ImportPreview } from '../src/modules/import-engine';
import { requestAsyncExcelExport } from '../src/lib/export/excelExportService';

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
    const { tenantId, user, appSlug, tenant, tenantSlug } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const isEsteticaApp = appSlug === 'estetica';
    const shopName = tenant?.name || '';
    const bookingUrl = tenantSlug
        ? `${window.location.origin}/#/agendamento/${tenantSlug}`
        : `${window.location.origin}/#/agendamento`;
    const orderLabel = labels.order;
    const orderLabelLower = orderLabel.toLowerCase();
    const orderPluralLower = labels.orderPlural.toLowerCase();
    const serviceLabel = labels.service;
    const barberSupabase = getScopedClient('barber');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

    // Filters
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [inactivityFilter, setInactivityFilter] = useState<'all' | InactivityTier>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    // Reengajamento WhatsApp
    const [reengagementClient, setReengagementClient] = useState<Client | null>(null);
    const [isReengagementOpen, setIsReengagementOpen] = useState(false);

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
    const [detailUpcomingAppointments, setDetailUpcomingAppointments] = useState<UpcomingAppointmentSummary[]>([]);
    const [detailUpcomingLoading, setDetailUpcomingLoading] = useState(false);
    const [detailPreferredBarber, setDetailPreferredBarber] = useState<PreferredBarberSummary | null>(null);
    const [detailVisitsCount, setDetailVisitsCount] = useState(0);
    const [detailAverageTicket, setDetailAverageTicket] = useState(0);
    const [staffList, setStaffList] = useState<StaffOption[]>([]);
    const [chefClubMap, setChefClubMap] = useState<Record<string, string>>({});

    useEffect(() => {
        if (!tenantId) {
            setStaffList([]);
            return;
        }
        supabase
            .from('staff')
            .select('id, name, avatar')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .order('name')
            .then(({ data, error }) => {
                if (!error && data) {
                    setStaffList(data as StaffOption[]);
                }
            });
    }, [tenantId]);

    const openClientDetails = useCallback(async (client: Client) => {
        setDetailClient(client);
        setDetailChefClub(null);
        setDetailOpenComandas([]);
        setDetailOpenComandasCount(0);
        setDetailOpenComandasLoading(Boolean(tenantId));
        setDetailUpcomingAppointments([]);
        setDetailUpcomingLoading(Boolean(tenantId));
        setDetailPreferredBarber(null);
        setDetailVisitsCount(0);
        setDetailAverageTicket(0);

        try {
            const [clubSummary, openComandasResult, upcomingResult, pastResult] = await Promise.all([
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
                tenantId
                    ? barberSupabase
                        .from('appointments')
                        .select('id, start_time, duration, service_name, staff_name, staff_id, status')
                        .eq('tenant_id', tenantId)
                        .eq('client_id', client.id)
                        .gte('start_time', new Date().toISOString())
                        .not('status', 'in', '("cancelled","no_show")')
                        .order('start_time', { ascending: true })
                        .limit(5)
                    : Promise.resolve({ data: [], error: null }),
                tenantId
                    ? barberSupabase
                        .from('appointments')
                        .select('id, staff_id, staff_name, start_time, status')
                        .eq('tenant_id', tenantId)
                        .eq('client_id', client.id)
                        .not('status', 'in', '("cancelled","no_show")')
                        .order('start_time', { ascending: false })
                        .limit(50)
                    : Promise.resolve({ data: [], error: null }),
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

            if (upcomingResult.error) {
                console.error('Erro ao buscar agendamentos futuros:', upcomingResult.error);
                setDetailUpcomingAppointments([]);
            } else {
                setDetailUpcomingAppointments((upcomingResult.data || []) as UpcomingAppointmentSummary[]);
            }

            const pastAppointments = (pastResult.data || []) as { staff_id: string; staff_name: string }[];
            const prefBarber = calculatePreferredBarber(
                pastAppointments.map((a) => ({
                    staffId: a.staff_id,
                    staffName: a.staff_name,
                }))
            );
            setDetailPreferredBarber(prefBarber);

            const pastCount = pastAppointments.length || (client.last_visit ? 1 : 0);
            setDetailVisitsCount(pastCount);
            setDetailAverageTicket(calculateAverageTicket(client.total_spent || 0, pastCount));
        } catch (error) {
            console.error('Erro ao carregar detalhes do cliente:', error);
            setDetailChefClub(null);
            setDetailOpenComandas([]);
            setDetailOpenComandasCount(0);
            setDetailUpcomingAppointments([]);
        } finally {
            setDetailOpenComandasLoading(false);
            setDetailUpcomingLoading(false);
        }
    }, [barberSupabase, tenantId]);

    const handleBookAppointment = useCallback((params?: { date?: string; time?: string; staffId?: string }) => {
        if (!detailClient) return;
        let decimalStart: number | undefined;
        if (params?.time) {
            const [hours, minutes] = params.time.split(':').map(Number);
            if (Number.isFinite(hours)) {
                decimalStart = hours + (Number.isFinite(minutes) ? minutes / 60 : 0);
            }
        }
        setDetailClient(null);
        navigate('/schedule', {
            state: {
                openNewAppointment: true,
                client: detailClient.name,
                clientPhone: detailClient.phone,
                staffId: params?.staffId || detailClient.preferred_staff_id,
                date: params?.date,
                start: decimalStart,
            },
        });
    }, [detailClient, navigate]);

    const handleClientUpdated = useCallback((updated: Client) => {
        setDetailClient(updated);
        setClients((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
    }, []);

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
            const data = await clientRepository.listWithEffectiveLastVisit(tenantId);
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
            let matchInactivity = true;
            if (inactivityFilter !== 'all') {
                const inact = getClientInactivityStatus(c.last_visit);
                matchInactivity = inact.tier === inactivityFilter;
            }
            return matchSearch && matchStatus && matchInactivity;
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
                let message = 'Erro ao excluir cliente.';
                if (deleteError instanceof RepositoryError) {
                    if (deleteError.code === '23503' || deleteError.message.includes('foreign key constraint') || deleteError.message.includes('violates foreign key')) {
                        message = 'Não é possível excluir este cliente porque ele possui histórico de agendamentos, comandas ou transações financeiras. Para desativá-lo, altere o status para "Inativo" no botão Editar.';
                    } else {
                        const failureReport = failures.length > 0
                            ? `\nDependências com falha: ${failures.map(f => f.table).join(', ')}`
                            : '';
                        message = `${deleteError.message} (${deleteError.code || 'sem-codigo'})${failureReport}`;
                    }
                } else if (deleteError instanceof Error && (deleteError.message.includes('foreign key') || deleteError.message.includes('23503'))) {
                    message = 'Não é possível excluir este cliente porque ele possui histórico de agendamentos, comandas ou transações financeiras. Para desativá-lo, altere o status para "Inativo" no botão Editar.';
                }
                setToast({ message, type: 'error' });
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

    const [exportingExcel, setExportingExcel] = useState(false);

    const handleExportCSV = async () => {
        if (processed.length === 0) {
            setToast({ message: 'Nenhum cliente para exportar.', type: 'info' });
            return;
        }

        setExportingExcel(true);
        try {
            const todayIso = new Date().toISOString().split('T')[0];
            const result = await requestAsyncExcelExport({
                tenantId: tenantId || undefined,
                reportType: 'clients',
                title: 'Base de Clientes (CRM & LTV)',
                subtitle: `Total listado: ${processed.length} cliente(s)`,
                sheetName: 'Clientes',
                fileName: `base_clientes_${todayIso}.xlsx`,
                columns: [
                    { key: 'name', header: 'Nome', width: 32, type: 'string' },
                    { key: 'phone', header: 'Telefone', width: 20, type: 'string' },
                    { key: 'email', header: 'E-mail', width: 28, type: 'string' },
                    { key: 'birthday', header: 'Aniversário', width: 16, type: 'string' },
                    { key: 'last_visit', header: 'Última Visita', width: 16, type: 'string' },
                    { key: 'total_spent', header: 'Total Gasto / LTV (R$)', width: 22, type: 'currency' },
                    { key: 'status', header: 'Status', width: 14, type: 'string' },
                ],
                rows: processed.map((c) => ({
                    name: c.name,
                    phone: c.phone || '—',
                    email: c.email || '—',
                    birthday: c.birthday ? formatDate(c.birthday) : '—',
                    last_visit: c.last_visit ? formatDate(c.last_visit) : '—',
                    total_spent: Number(c.total_spent) || 0,
                    status: c.status === 'active' ? 'Ativo' : 'Inativo',
                })),
            });

            if (result.ok) {
                setToast({
                    message: result.fallbackUsed
                        ? `Base exportada em CSV (${result.rowCount} clientes).`
                        : `Excel (.xlsx) gerado via Edge Function + Presigned URL (${result.rowCount} clientes).`,
                    type: 'success',
                });
            } else {
                setToast({ message: result.error || 'Erro ao exportar base de clientes.', type: 'error' });
            }
        } finally {
            setExportingExcel(false);
        }
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
                    <button
                        onClick={handleExportCSV}
                        disabled={exportingExcel || processed.length === 0}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-all disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-sm">
                            {exportingExcel ? 'progress_activity' : 'download'}
                        </span>
                        {exportingExcel ? 'Gerando Excel...' : 'Exportar Base (.xlsx)'}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-primary text-night rounded-xl text-sm font-bold hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                    <input
                        type="text"
                        placeholder="Buscar por nome, telefone ou e-mail..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary text-slate-900 dark:text-white transition-all shadow-sm"
                    />
                </div>
                <div className="inline-flex self-start sm:self-auto items-center bg-slate-100 dark:bg-[#141414] border border-slate-200 dark:border-[#262626] p-1 rounded-xl text-xs font-bold">
                    <button
                        type="button"
                        onClick={() => setStatusFilter('active')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            statusFilter === 'active'
                                ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        Ativos ({clients.filter(c => c.status === 'active').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('inactive')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            statusFilter === 'inactive'
                                ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        Inativos ({clients.filter(c => c.status !== 'active').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className={`px-3 py-1.5 rounded-lg transition-all ${
                            statusFilter === 'all'
                                ? 'bg-white dark:bg-card-dark text-slate-900 dark:text-white shadow-sm'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        Todos ({clients.length})
                    </button>
                </div>
            </div>

            {/* Inactivity & Retention Tiers Filter */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-card-dark shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5 mr-1 shrink-0">
                    <span className="material-symbols-outlined text-base text-primary">schedule</span>
                    Última Visita:
                </span>
                <div className="flex flex-wrap items-center gap-1.5 flex-1">
                    <button
                        type="button"
                        onClick={() => setInactivityFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                            inactivityFilter === 'all'
                                ? 'bg-primary text-night shadow-sm'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Todas ({clients.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setInactivityFilter('active')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            inactivityFilter === 'active'
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        Ativos &lt;30d ({clients.filter(c => getClientInactivityStatus(c.last_visit).tier === 'active').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setInactivityFilter('absent')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            inactivityFilter === 'absent'
                                ? 'bg-amber-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        Ausentes 30-60d ({clients.filter(c => getClientInactivityStatus(c.last_visit).tier === 'absent').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setInactivityFilter('critical')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            inactivityFilter === 'critical'
                                ? 'bg-rose-600 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                        Críticos +60d ({clients.filter(c => getClientInactivityStatus(c.last_visit).tier === 'critical').length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setInactivityFilter('never')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            inactivityFilter === 'never'
                                ? 'bg-slate-700 text-white shadow-sm'
                                : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                    >
                        Sem Visitas ({clients.filter(c => getClientInactivityStatus(c.last_visit).tier === 'never').length})
                    </button>
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
                                            {search || statusFilter !== 'all'
                                                ? 'Nenhum cliente encontrado com os filtros aplicados.'
                                                : isEsteticaApp
                                                    ? 'Cadastre clientes para acompanhar atendimentos, retornos e histórico.'
                                                    : 'Nenhum cliente encontrado.'}
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
                                        <td className="px-5 py-4 text-sm text-slate-700 dark:text-slate-300 hidden lg:table-cell">
                                            {(() => {
                                                const inact = getClientInactivityStatus(client.last_visit);
                                                return (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                                                            {formatDate(client.last_visit)}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${inact.badgeClass}`}>
                                                            <span className="material-symbols-outlined text-[11px]">history</span>
                                                            {inact.label}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-4 text-sm font-bold text-slate-900 dark:text-white hidden lg:table-cell">{formatCurrency(client.total_spent)}</td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${client.status === 'active' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReengagementClient(client);
                                                        setIsReengagementOpen(true);
                                                    }}
                                                    className="p-2.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                                                    title="Reengajar via WhatsApp"
                                                >
                                                    <span className="material-symbols-outlined text-lg">chat</span>
                                                </button>
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

            {/* Perfil 360° do Cliente & Fidelização Drawer */}
            <ClientProfile360Drawer
                isOpen={!!detailClient}
                onClose={() => setDetailClient(null)}
                client={detailClient}
                onClientUpdated={handleClientUpdated}
                chefClub={detailChefClub}
                openComandas={detailOpenComandas}
                openComandasCount={detailOpenComandasCount}
                openComandasLoading={detailOpenComandasLoading}
                upcomingAppointments={detailUpcomingAppointments}
                upcomingLoading={detailUpcomingLoading}
                preferredBarber={detailPreferredBarber}
                visitsCount={detailVisitsCount}
                averageTicket={detailAverageTicket}
                staffOptions={staffList}
                tenantId={tenantId}
                currentUserId={user?.id || null}
                orderLabel={orderLabel}
                orderLabelLower={orderLabelLower}
                orderPluralLower={orderPluralLower}
                serviceLabel={serviceLabel}
                isEsteticaApp={isEsteticaApp}
                onToast={setToast}
                onOpenComanda={(comandaId) => {
                    setDetailClient(null);
                    navigate(`/checkout/${comandaId}`);
                }}
                onBookAppointment={handleBookAppointment}
            />

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
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">Salvar Alterações</button>
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
                            className="flex-1 py-3 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all">Salvar</button>
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
                        <div className="p-3 bg-teal-500/10 border border-teal-500/20 rounded-lg">
                            <p className="text-[10px] text-teal-700 dark:text-teal-300 font-bold uppercase mb-1">Revisão de Dados</p>
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
                            <button type="button" onClick={handleConfirmImport} disabled={loading || (importPreview.validRows.length + (includeDuplicates ? importPreview.duplicateRows.length : 0)) === 0} className="px-8 py-2.5 rounded-lg text-sm font-bold text-night bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                                {loading ? <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : `Salvar ${importPreview.validRows.length + (includeDuplicates ? importPreview.duplicateRows.length : 0)} Cliente(s)`}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Modal de Reengajamento WhatsApp */}
            <ClientReengagementModal
                isOpen={isReengagementOpen}
                onClose={() => {
                    setIsReengagementOpen(false);
                    setReengagementClient(null);
                }}
                client={reengagementClient}
                shopName={shopName}
                bookingUrl={bookingUrl}
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
};

export default Clients;
