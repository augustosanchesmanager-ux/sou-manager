import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Papa from 'papaparse';
import { getScopedClient, supabase } from '../services/supabaseClient';
import Toast from '../components/Toast';
import Modal from '../components/ui/Modal';
import DatePickerInput from '../components/ui/DatePickerInput';
import { getTodayDateKey } from '../src/utils/dateTimezone';
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
import { buildPublicBookingUrl } from '../src/lib/apps/publicUrl';
import { formatCurrency } from '../shared/format/currency';
import { clientRepository, RepositoryError, type Client } from '../domain/client';
import { staffRepository } from '../domain/staff/repository';
import { comandaRepository } from '../domain/comanda/repository';
import { appointmentRepository } from '../domain/appointment/repository';
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
import { sanitizeOptionalFields, sanitizeNullableString } from '../src/utils/sanitization';
import {
    enrichClientsWithFamilyContext,
    searchClientsWithDependents,
} from '../src/utils/clientFamilySearch';

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
    const bookingUrl = buildPublicBookingUrl(window.location.origin, tenantSlug);
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
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 25;

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [inactivityFilter, setInactivityFilter] = useState<'all' | InactivityTier>('all');
    const [sortKey, setSortKey] = useState<SortKey>('name');
    const [sortDir, setSortDir] = useState<SortDir>('asc');

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, inactivityFilter, sortKey, sortDir]);

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
        staffRepository
            .list(tenantId)
            .then((rows) => {
                setStaffList(
                    rows
                        .filter((s) => s.status === 'active')
                        .map((s) => ({ id: s.id, name: s.name, avatar: s.avatar || undefined }))
                );
            })
            .catch(() => {
                // Keep existing staffList on transient failure
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
            const nowIso = new Date().toISOString();
            const [clubSummary, openComandas, upcomingAppointments, pastAppointments] = await Promise.all([
                fetchChefClubSummaryByClient(client.id, tenantId).catch((error) => {
                    console.error('Erro ao carregar resumo do Club dos Chefes:', error);
                    return null;
                }),
                tenantId
                    ? comandaRepository.getByClient(client.id, tenantId, { status: 'open' }).catch((error) => {
                        console.error('Erro ao carregar comandas abertas do cliente:', error);
                        return null;
                    })
                    : Promise.resolve([]),
                tenantId
                    ? appointmentRepository.listByClient(client.id, tenantId, {
                        fromIso: nowIso,
                        ascending: true,
                        limit: 5,
                    }).catch((error) => {
                        console.error('Erro ao buscar agendamentos futuros:', error);
                        return null;
                    })
                    : Promise.resolve([]),
                tenantId
                    ? appointmentRepository.listByClient(client.id, tenantId, {
                        ascending: false,
                        limit: 50,
                    }).catch(() => [])
                    : Promise.resolve([]),
            ]);

            setDetailChefClub(clubSummary);

            if (!openComandas) {
                setDetailOpenComandas([]);
                setDetailOpenComandasCount(0);
            } else {
                setDetailOpenComandas(openComandas.slice(0, 3) as OpenComandaSummary[]);
                setDetailOpenComandasCount(openComandas.length);
            }

            if (!upcomingAppointments) {
                setDetailUpcomingAppointments([]);
            } else {
                setDetailUpcomingAppointments(upcomingAppointments as UpcomingAppointmentSummary[]);
            }

            const prefBarber = calculatePreferredBarber(
                (pastAppointments || []).map((a) => ({
                    staffId: a.staff_id || '',
                    staffName: a.staff_name || '',
                }))
            );
            setDetailPreferredBarber(prefBarber);

            const pastCount = (pastAppointments || []).length || (client.last_visit ? 1 : 0);
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

    const handleBookAppointment = useCallback((params?: {
        date?: string;
        time?: string;
        staffId?: string;
        clientId?: string;
        clientName?: string;
        clientPhone?: string;
    }) => {
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
                clientId: params?.clientId || detailClient.id,
                client: params?.clientName || detailClient.name,
                clientPhone: params?.clientPhone ?? detailClient.phone,
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
            const [data, planMap] = await Promise.all([
                clientRepository.list(tenantId),
                fetchActiveChefClubPlanMap(tenantId).catch((err) => {
                    console.warn('Aviso ao carregar mapa do Club dos Chefes:', err);
                    return {} as Record<string, string>;
                }),
            ]);
            setClients(data);
            setChefClubMap(planMap || {});
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

    // Filtering & Sorting (com busca familiar Pai <-> Filhos/Dependentes)
    const processed = React.useMemo(() => {
        const query = debouncedSearch.trim();
        const baseList = query
            ? searchClientsWithDependents(clients, query)
            : enrichClientsWithFamilyContext(clients);

        const filtered = baseList.filter((c) => {
            const matchStatus = statusFilter === 'all' || c.status === statusFilter;
            let matchInactivity = true;
            if (inactivityFilter !== 'all') {
                const inact = getClientInactivityStatus(c.last_visit);
                matchInactivity = inact.tier === inactivityFilter;
            }
            return matchStatus && matchInactivity;
        });

        if (query) {
            // Preserva agrupamento familiar (titular seguido imediatamente de seus filhos) durante busca ativa
            return filtered;
        }

        return [...filtered].sort((a, b) => {
            let cmp = 0;
            if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
            else if (sortKey === 'last_visit') cmp = new Date(a.last_visit).getTime() - new Date(b.last_visit).getTime();
            else if (sortKey === 'total_spent') cmp = (a.total_spent || 0) - (b.total_spent || 0);
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [clients, debouncedSearch, statusFilter, inactivityFilter, sortKey, sortDir]);

    const totalPages = Math.ceil(processed.length / itemsPerPage) || 1;
    const paginatedClients = React.useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return processed.slice(startIndex, startIndex + itemsPerPage);
    }, [processed, currentPage, itemsPerPage]);

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
            const sanitizedInput = sanitizeOptionalFields({
                name: newForm.name.trim(),
                email: newForm.email,
                phone: newForm.phone,
                birthday: newForm.birthday,
            });
            await clientRepository.create(sanitizedInput as any, tenantId);
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
            const sanitizedEdit = sanitizeOptionalFields(editForm);
            await clientRepository.update(editingId, sanitizedEdit, tenantId);
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

        try {
            const cleanupLog = await clientRepository.cleanupDependencies(clientId, tenantId);

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
            const todayIso = getTodayDateKey();
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
        <div className="min-h-screen bg-cream text-ink max-w-7xl mx-auto w-full animate-fade-in pb-20">
            {/* ===== TIER 1 — Identidade & Ações ===== */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-6">
                <div>
                    <h2 className="font-display text-2xl font-bold text-ink tracking-tight">Clientes</h2>
                    <p className="text-xs text-ink-soft mt-1">
                        {clients.length} cliente(s) cadastrado(s) · {labels.clientPlural.toLowerCase()} da base deste tenant
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-card text-ink-soft text-sm font-bold hover:border-primary/40 hover:text-ink transition-all">
                        <span className="material-symbols-outlined text-sm">upload_file</span>
                        Importar CSV
                    </button>
                    <input type="file" ref={fileInputRef} accept=".csv" className="hidden" title="Arquivo CSV" onChange={handleFileUpload} />
                    <button
                        onClick={handleExportCSV}
                        disabled={exportingExcel || processed.length === 0}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-line bg-card text-ink-soft text-sm font-bold hover:border-primary/40 hover:text-ink transition-all disabled:opacity-50 disabled:pointer-events-none"
                    >
                        <span className="material-symbols-outlined text-sm">
                            {exportingExcel ? 'progress_activity' : 'download'}
                        </span>
                        {exportingExcel ? 'Gerando Excel...' : 'Exportar Base (.xlsx)'}
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-dark text-night font-bold shadow-lg shadow-primary/20 hover:brightness-105 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">person_add</span>
                        Novo Cliente
                    </button>
                </div>
            </div>

            {/* ===== TIER 2 — Filtros (única fonte) ===== */}
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft text-lg">search</span>
                        <input
                            type="text"
                            placeholder="Buscar por nome, telefone ou e-mail..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-card border border-line rounded-xl py-2.5 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-primary focus:border-primary text-ink placeholder:text-ink-soft transition-all shadow-sm"
                        />
                    </div>
                    <div className="inline-flex self-start sm:self-auto items-center gap-1 p-1 rounded-xl border border-line bg-cream text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('active')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'active'
                                    ? 'bg-primary/15 text-primary-dark dark:text-primary-light border border-primary/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent'
                            }`}
                        >
                            Ativos ({clients.filter((c) => c.status === 'active').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('inactive')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'inactive'
                                    ? 'bg-primary/15 text-primary-dark dark:text-primary-light border border-primary/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent'
                            }`}
                        >
                            Inativos ({clients.filter((c) => c.status !== 'active').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-3 py-1.5 rounded-lg transition-all ${
                                statusFilter === 'all'
                                    ? 'bg-primary/15 text-primary-dark dark:text-primary-light border border-primary/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent'
                            }`}
                        >
                            Todos ({clients.length})
                        </button>
                    </div>
                </div>

                {/* Inactivity & Retention Tiers Filter */}
                <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-line bg-card shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5 shrink-0">
                        <span className="material-symbols-outlined text-base text-primary-dark dark:text-primary-light">schedule</span>
                        Última Visita:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5 flex-1">
                        <button
                            type="button"
                            onClick={() => setInactivityFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                                inactivityFilter === 'all'
                                    ? 'bg-primary text-night shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent border border-transparent'
                            }`}
                        >
                            Todas ({clients.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setInactivityFilter('active')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                inactivityFilter === 'active'
                                    ? 'bg-success/20 text-success border border-success/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent border border-transparent'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-success"></span>
                            Ativos &lt;30d ({clients.filter((c) => getClientInactivityStatus(c.last_visit).tier === 'active').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setInactivityFilter('absent')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                inactivityFilter === 'absent'
                                    ? 'bg-warning/20 text-warning border border-warning/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent border border-transparent'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-warning"></span>
                            Ausentes 30-60d ({clients.filter((c) => getClientInactivityStatus(c.last_visit).tier === 'absent').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setInactivityFilter('critical')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                inactivityFilter === 'critical'
                                    ? 'bg-danger/20 text-danger border border-danger/30 shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent border border-transparent'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-danger"></span>
                            Críticos +60d ({clients.filter((c) => getClientInactivityStatus(c.last_visit).tier === 'critical').length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setInactivityFilter('never')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 ${
                                inactivityFilter === 'never'
                                    ? 'bg-cream text-ink border border-line shadow-xs'
                                    : 'text-ink-soft hover:text-ink hover:bg-ink/5 border-transparent border border-transparent'
                            }`}
                        >
                            <span className="w-2 h-2 rounded-full bg-ink-soft"></span>
                            Sem Visitas ({clients.filter((c) => getClientInactivityStatus(c.last_visit).tier === 'never').length})
                        </button>
                    </div>
                </div>
            </div>
            {/* ===== TIER 3 — Tabela ===== */}
            <LoadingBlock loading={loading} message="Carregando clientes..." minHeight="min-h-[400px]">
                <div className="bg-card border border-line rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="sm:hidden px-4 py-2 border-b border-line bg-cream/60 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                            Deslize para ver mais colunas
                        </div>
                        <table className="w-full min-w-[760px]">
                            <thead className="bg-cream/60 border-b border-line">
                                <tr className="text-left text-xs font-bold text-ink-soft uppercase tracking-wider">
                                    <th className="px-5 py-3">
                                        <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-ink transition-colors">
                                            Cliente <span className="material-symbols-outlined text-sm">{sortIcon('name')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden md:table-cell">Telefone</th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('last_visit')} className="flex items-center gap-1 hover:text-ink transition-colors">
                                            {isEsteticaApp ? 'Último atendimento' : 'Última Visita'} <span className="material-symbols-outlined text-sm">{sortIcon('last_visit')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3 hidden lg:table-cell">
                                        <button onClick={() => handleSort('total_spent')} className="flex items-center gap-1 hover:text-ink transition-colors">
                                            Total Gasto <span className="material-symbols-outlined text-sm">{sortIcon('total_spent')}</span>
                                        </button>
                                    </th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {processed.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-12 text-ink-soft text-sm">
                                            {search || statusFilter !== 'all'
                                                ? 'Nenhum cliente encontrado com os filtros aplicados.'
                                                : isEsteticaApp
                                                    ? 'Cadastre clientes para acompanhar atendimentos, retornos e histórico.'
                                                    : 'Nenhum cliente encontrado.'}
                                        </td>
                                    </tr>
                                )}
                                {paginatedClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-cream/60 transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="size-9 rounded-xl bg-cream shrink-0 overflow-hidden border border-line">
                                                    {client.avatar ? (
                                                        <img src={client.avatar} alt={client.name} className="size-full object-cover" />
                                                    ) : (
                                                        <div className="size-full flex items-center justify-center">
                                                            <span className="material-symbols-outlined text-ink-soft text-sm">person</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <p className="text-sm font-bold text-ink">{client.name}</p>
                                                        {!isEsteticaApp && chefClubMap[client.id] && (
                                                            <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/10 text-primary-dark border border-primary/20 rounded text-[9px] font-black uppercase tracking-tighter" title={`Club dos Chefes: ${chefClubMap[client.id]}`}>
                                                                <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
                                                                Membro
                                                            </span>
                                                        )}
                                                        {client.isDependent && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success/10 text-success border border-success/20 rounded text-[10px] font-bold">
                                                                <span className="material-symbols-outlined text-[11px]">family_restroom</span>
                                                                Filho(a) de {client.parentName || 'Responsável'}
                                                            </span>
                                                        )}
                                                        {!client.isDependent && client.dependentsCount > 0 && (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 text-primary-dark border border-primary/20 rounded text-[10px] font-bold">
                                                                <span className="material-symbols-outlined text-[11px]">family_restroom</span>
                                                                {client.dependentsCount} {client.dependentsCount === 1 ? 'filho' : 'filhos'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-ink-soft hidden sm:block">
                                                        {client.isDependent && client.parentName
                                                            ? `Resp.: ${client.parentName} • ${client.effectivePhone || 'Sem telefone'}`
                                                            : client.email || 'Sem e-mail'}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 hidden md:table-cell">
                                            <span className="text-sm text-ink-soft">{client.effectivePhone || client.phone || '-'}</span>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-ink-soft hidden lg:table-cell">
                                            {(() => {
                                                const inact = getClientInactivityStatus(client.last_visit);
                                                return (
                                                    <div className="flex flex-col items-start gap-1">
                                                        <span className="text-xs font-semibold text-ink">
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
                                        <td className="px-5 py-4 text-sm font-bold text-ink tabular-nums whitespace-nowrap hidden lg:table-cell">
                                            {formatCurrency(client.total_spent)}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                client.status === 'active'
                                                    ? 'bg-success/20 text-success border border-success/30'
                                                    : 'bg-cream text-ink border border-line'
                                            }`}>
                                                {client.status === 'active' ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => void openClientDetails(client)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary/10 text-primary-dark border border-primary/20 hover:bg-primary hover:text-night transition-all shadow-sm"
                                                    title="Ver Perfil Completo (360°)"
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">visibility</span>
                                                    <span className="hidden sm:inline">Perfil</span>
                                                </button>
                                                {client.phone && (
                                                    <a
                                                        href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 text-success hover:text-white hover:bg-success/20 rounded-lg border border-transparent hover:border-success/30 transition-colors"
                                                        title={`Abrir WhatsApp (${client.phone})`}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">chat</span>
                                                    </a>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditClick(client)}
                                                    className="p-1.5 text-ink-soft hover:text-ink hover:bg-ink/5 rounded-lg transition-colors"
                                                    title="Editar Dados Básicos"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                {!isEsteticaApp && (
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/chef-club-subscriptions/new?from=clients&clientId=${client.id}`)}
                                                        className="p-1.5 text-ink-soft hover:text-primary-dark dark:hover:text-primary-light hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Assinatura Clube"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">workspace_premium</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteTarget(client)}
                                                    className="p-1.5 text-ink-soft hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                                                    title="Excluir"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {processed.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-line bg-cream/60 text-xs text-ink-soft">
                            <div>
                                Mostrando <span className="font-bold text-ink">{(currentPage - 1) * itemsPerPage + 1}</span> a{' '}
                                <span className="font-bold text-ink">{Math.min(currentPage * itemsPerPage, processed.length)}</span> de{' '}
                                <span className="font-bold text-ink">{processed.length}</span> clientes
                            </div>
                            {totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-cream font-bold text-ink-soft hover:border-primary/40 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                        Anterior
                                    </button>
                                    <span className="px-2 py-1 font-bold text-ink-soft">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={currentPage >= totalPages}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-line bg-cream font-bold text-ink-soft hover:border-primary/40 hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        Próxima
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
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
                allClients={clients}
                onClientsChanged={fetchClients}
                onSelectClient={(target) => void openClientDetails(target)}
            />

            {/* Modal de Edição */}
            <Modal
                isOpen={!!editingId}
                onClose={() => { setEditingId(null); setEditForm({}); }}
                title="Editar Cliente"
                maxWidth="md"
            >
                <form onSubmit={handleSaveEdit} className="space-y-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Nome Completo</label>
                        <input type="text" required value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            title="Nome Completo" placeholder="Ex: Carlos Oliveira"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Telefone</label>
                        <input type="tel" required value={editForm.phone || ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            title="Telefone" placeholder="(11) 99999-9999"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Email</label>
                        <input type="email" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            title="E-mail" placeholder="email@exemplo.com"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Data de Nascimento</label>
                        <DatePickerInput value={editForm.birthday || ''} onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                            title="Data de Nascimento" placeholder="Data de Nascimento"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Status</label>
                        <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                            title="Status do Cliente"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all [color-scheme:light] dark:[color-scheme:dark]">
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => { setEditingId(null); setEditForm({}); }}
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-ink-soft bg-cream border border-line hover:bg-ink/5 hover:text-ink transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-night bg-gradient-to-r from-primary to-primary-dark shadow-lg shadow-primary/20 hover:brightness-105 transition-all">Salvar Alterações</button>
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
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Nome Completo</label>
                        <input type="text" required value={newForm.name} onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                            title="Nome Completo"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" placeholder="Ex: Carlos Oliveira" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Telefone</label>
                        <input type="tel" required value={newForm.phone} onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                            title="Telefone"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" placeholder="(11) 99999-9999" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Email (Opcional)</label>
                        <input type="email" value={newForm.email} onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                            title="E-mail"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" placeholder="email@exemplo.com" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-ink-soft mb-1.5">Data de Nascimento</label>
                        <DatePickerInput value={newForm.birthday} onChange={(e) => setNewForm({ ...newForm, birthday: e.target.value })}
                            title="Data de Nascimento" placeholder="Data de Nascimento"
                            className="w-full bg-cream border border-line rounded-xl p-3 text-sm text-ink placeholder:text-ink-soft outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all" />
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={() => setShowModal(false)}
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-ink-soft bg-cream border border-line hover:bg-ink/5 hover:text-ink transition-colors">Cancelar</button>
                        <button type="submit"
                            className="flex-1 py-3 rounded-xl text-sm font-bold text-night bg-gradient-to-r from-primary to-primary-dark shadow-lg shadow-primary/20 hover:brightness-105 transition-all">Salvar</button>
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
                        <div className="w-16 h-16 bg-danger/20 text-danger rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>
                        <p className="text-sm text-ink-soft mb-6">Tem certeza que deseja excluir <strong className="text-ink">{deleteTarget.name}</strong>? Esta ação não pode ser desfeita.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-ink-soft bg-cream border border-line hover:bg-ink/5 hover:text-ink transition-colors disabled:opacity-60"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-danger hover:bg-danger/90 transition-colors disabled:opacity-60"
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
                        <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-primary-dark mb-1">Revisão de Dados</p>
                            <p className="text-xs text-ink-soft">
                                <strong className="text-ink">{importPreview.fileName}</strong> — {importPreview.totalRows} linha(s) lida(s).
                                Nada é gravado até a confirmação.
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs font-bold">
                                <span className="px-2 py-1 rounded-full bg-success/20 text-success border border-success/30">{importPreview.validRows.length} válida(s)</span>
                                <span className="px-2 py-1 rounded-full bg-warning/20 text-warning border border-warning/30">{importPreview.duplicateRows.length} duplicada(s)</span>
                                <span className="px-2 py-1 rounded-full bg-danger/20 text-danger border border-danger/30">{importPreview.invalidRows.length} inválida(s)</span>
                            </div>
                            {importPreview.warnings.length > 0 && (
                                <ul className="mt-2 text-[11px] text-warning list-disc list-inside space-y-0.5">
                                    {importPreview.warnings.slice(0, 5).map((w, i) => <li key={i}>{w}</li>)}
                                </ul>
                            )}
                        </div>

                        <div className="bg-card rounded-xl border border-line overflow-hidden">
                            <div className="overflow-x-auto max-h-[50vh] custom-scrollbar">
                                <table className="w-full text-left">
                                    <thead className="bg-cream/60 sticky top-0 z-10 border-b border-line">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">#</th>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">Nome Completo</th>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">Telefone</th>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">Email</th>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">Nascimento</th>
                                            <th className="px-4 py-3 text-[10px] uppercase font-bold text-ink-soft tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-line text-sm">
                                        {importPreview.rows.map((row) => (
                                            <tr key={row.rowNumber} className="hover:bg-cream/60">
                                                <td className="px-4 py-3 text-xs text-ink-soft">{row.rowNumber}</td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">{row.values.name || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">{row.values.phone || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">{row.values.email || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-ink-soft">{row.values.birthday || '—'}</td>
                                                <td className="px-4 py-3">
                                                    {row.status === 'valid' && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-success/20 text-success border border-success/30 text-[10px] font-bold uppercase">Válida</span>
                                                    )}
                                                    {row.status === 'duplicate' && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-warning/20 text-warning border border-warning/30 text-[10px] font-bold uppercase w-fit">Duplicada</span>
                                                            {row.duplicateOf && <span className="text-[11px] text-warning">{row.duplicateOf}</span>}
                                                        </div>
                                                    )}
                                                    {row.status === 'invalid' && (
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-danger/20 text-danger border border-danger/30 text-[10px] font-bold uppercase w-fit">Inválida</span>
                                                            {row.errors.map((e, i) => <span key={i} className="text-[11px] text-danger">{e}</span>)}
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
                            <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeDuplicates}
                                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                                    className="size-4 accent-primary"
                                />
                                Incluir as {importPreview.duplicateRows.length} duplicada(s) sinalizada(s) mesmo assim
                            </label>
                        )}

                        <div className="flex gap-3 justify-end pt-4 border-t border-line mt-6">
                            <button type="button" onClick={() => { setIsImportModalOpen(false); setImportPreview(null); }} className="px-6 py-2.5 rounded-lg text-sm font-bold text-ink-soft bg-cream border border-line hover:bg-ink/5 hover:text-ink transition-colors">
                                Descartar Arquivo
                            </button>
                            <button type="button" onClick={handleConfirmImport} disabled={loading || (importPreview.validRows.length + (includeDuplicates ? importPreview.duplicateRows.length : 0)) === 0} className="px-8 py-2.5 rounded-lg text-sm font-bold text-night bg-gradient-to-r from-primary to-primary-dark shadow-lg shadow-primary/20 hover:brightness-105 transition-all flex items-center justify-center gap-2">
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
