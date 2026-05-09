import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../components/ui/Modal';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import { getScopedClient } from '../services/supabaseClient';

interface StaffMember {
    id: string;
    name: string;
    role: string;
    avatar: string;
    commission_rate: number | null;
}

interface CommissionItem {
    id: string;
    staff_id: string | null;
    comanda_id?: string;
    client_name?: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    created_at: string;
}

interface CommissionRow {
    id: string;
    professionalName: string;
    role: string;
    avatar: string;
    commissionRate: number;
    servicesCount: number;
    grossSales: number;
    commissionValue: number;
    lastServiceDate: string | null;
    items: CommissionItem[];
}

interface ComandaExportRow {
    id: string;
    created_at: string;
    closed_at?: string | null;
    status: 'open' | 'paid' | 'blocked' | 'cancelled';
    staff_id?: string | null;
    client_id?: string | null;
    payment_method?: string | null;
}

interface ParticipantExportRow {
    comanda_item_id: string;
    professional_id: string | null;
    role: string | null;
    payout_type: 'percentage' | 'fixed' | string | null;
    payout_value: number | null;
    affects_commission?: boolean | null;
}

const normalizeRate = (value: number | null | undefined) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 1 ? numeric / 100 : numeric;
};

const normalizePercentage = (value: number | null | undefined) => {
    const numeric = Number(value || 0);
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 1 ? numeric / 100 : numeric;
};

const escapeCSV = (value: string | number | null | undefined) => {
    const normalized = value == null ? '' : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
};

const formatMoneyForExport = (value: number) => Number(value || 0).toFixed(2).replace('.', ',');

const getCommissionStatus = (status: ComandaExportRow['status']) => {
    if (status === 'paid') return 'Confirmada';
    if (status === 'cancelled') return 'Cancelada';
    return 'Pendente';
};

const getPaymentStatus = (status: ComandaExportRow['status']) => {
    if (status === 'paid') return 'Pago';
    if (status === 'cancelled') return 'Cancelado';
    return 'Pendente';
};

const formatParticipationRole = (role?: string | null) => {
    if (role === 'primary') return 'Principal';
    if (role === 'assistant') return 'Apoio';
    if (role === 'co_executor') return 'Coexecutor';
    return role || 'Principal';
};

const isSharedCommissionItem = (
    item: { staff_id?: string | null },
    comanda: { staff_id?: string | null },
    participants: ParticipantExportRow[],
) => {
    if (participants.length === 0) return false;
    if (participants.length > 1) return true;
    const [participant] = participants;
    const mainProfessionalId = item.staff_id || comanda.staff_id || null;
    return participant.role !== 'primary' || participant.professional_id !== mainProfessionalId;
};

const Commissions: React.FC = () => {
    const { tenantId } = useAuth();
    const barberSupabase = getScopedClient('barber');
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [rows, setRows] = useState<CommissionRow[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRow, setSelectedRow] = useState<CommissionRow | null>(null);
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const fetchData = useCallback(async () => {
        if (!tenantId || !startDate || !endDate) {
            setRows([]);
            setLoading(false);
            return;
        }

        setLoading(true);

        const startOfRange = new Date(startDate);
        startOfRange.setHours(0, 0, 0, 0);
        const startOfRangeStr = startOfRange.toISOString();
        const endOfRange = new Date(endDate);
        endOfRange.setHours(23, 59, 59, 999);
        const endOfRangeStr = endOfRange.toISOString();

try {
            const [staffRes, comandasRes, itemsRes] = await Promise.all([
                barberSupabase
                    .from('staff')
                    .select('id, name, role, avatar, commission_rate')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'active'),
                barberSupabase
                    .from('comandas')
                    .select('id, created_at, status, staff_id, hidden_from_financial')
                    .eq('tenant_id', tenantId)
                    .eq('status', 'paid')
                    .or('hidden_from_financial.is.null,hidden_from_financial.eq.false')
                    .gte('created_at', startOfRangeStr)
                    .lte('created_at', endOfRangeStr),
                barberSupabase
                    .from('comanda_items')
                    .select('id, staff_id, product_name, quantity, unit_price, comanda_id')
                    .eq('tenant_id', tenantId),
            ]);

            if (staffRes.error) throw staffRes.error;
            if (comandasRes.error) throw comandasRes.error;
            if (itemsRes.error) throw itemsRes.error;

            const staffList = (staffRes.data || []) as StaffMember[];
            const comandasMap = new Map((comandasRes.data || [] as any[]).map((c: any) => [c.id, c]));
            const items = (itemsRes.data || [] as any[]).map((item: any) => {
                const comanda = item.comanda_id ? comandasMap.get(item.comanda_id) : null;
                if (!comanda) return null;
                return {
                    id: item.id,
                    staff_id: item.staff_id || comanda?.staff_id || null,
                    product_name: item.product_name,
                    quantity: Number(item.quantity || 0),
                    unit_price: Number(item.unit_price || 0),
                    created_at: comanda?.created_at || '',
                };
            }).filter(Boolean) as CommissionItem[];

            const grouped = staffList.map((member) => {
                const memberItems = items.filter((item) => item.staff_id === member.id);
                const grossSales = memberItems.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
                const servicesCount = memberItems.reduce((sum, item) => sum + item.quantity, 0);
                const commissionRate = normalizeRate(member.commission_rate) * 100;
                const lastServiceDate = memberItems.length > 0
                    ? memberItems
                        .map((item) => item.created_at)
                        .sort()
                        .slice(-1)[0]
                    : null;

                return {
                    id: member.id,
                    professionalName: member.name,
                    role: member.role || 'Profissional',
                    avatar: member.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}`,
                    commissionRate,
                    servicesCount,
                    grossSales,
                    commissionValue: grossSales * normalizeRate(member.commission_rate),
                    lastServiceDate,
                    items: memberItems,
                };
            });

            setRows(grouped);
        } catch (error) {
            console.error('Erro ao carregar comissoes:', error);
            setToast({ message: 'Erro ao carregar dados de comissoes.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [barberSupabase, startDate, endDate, tenantId]);

    useEffect(() => {
        fetchData();
    }, [barberSupabase, startDate, endDate, tenantId]);

    const filteredRows = useMemo(
        () =>
            rows.filter((row) =>
                row.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.role.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [rows, searchTerm]
    );

    const totalCommissions = filteredRows.reduce((sum, row) => sum + row.commissionValue, 0);
    const totalSales = filteredRows.reduce((sum, row) => sum + row.grossSales, 0);
    const totalServices = filteredRows.reduce((sum, row) => sum + row.servicesCount, 0);
    const averageRate = filteredRows.length > 0
        ? filteredRows.reduce((sum, row) => sum + row.commissionRate, 0) / filteredRows.length
        : 0;
    const topPerformer = filteredRows.reduce<CommissionRow | null>(
        (best, current) => (!best || current.commissionValue > best.commissionValue ? current : best),
        null
    );

    const exportCommissions = async () => {
        if (!tenantId || !startDate || !endDate) {
            setToast({ message: 'Informe um período válido para exportar comissões.', type: 'error' });
            return;
        }

        const startOfRange = new Date(startDate);
        startOfRange.setHours(0, 0, 0, 0);
        const endOfRange = new Date(endDate);
        endOfRange.setHours(23, 59, 59, 999);

        try {
            const [staffRes, comandasRes] = await Promise.all([
                barberSupabase
                    .from('staff')
                    .select('id, name, role, avatar, commission_rate')
                    .eq('tenant_id', tenantId),
                barberSupabase
                    .from('comandas')
                    .select('id, created_at, closed_at, status, staff_id, client_id, payment_method, hidden_from_financial')
                    .eq('tenant_id', tenantId)
                    .in('status', ['open', 'paid', 'blocked', 'cancelled'])
                    .or('hidden_from_financial.is.null,hidden_from_financial.eq.false')
                    .gte('created_at', startOfRange.toISOString())
                    .lte('created_at', endOfRange.toISOString()),
            ]);

            if (staffRes.error) throw staffRes.error;
            if (comandasRes.error) throw comandasRes.error;

            const staffList = (staffRes.data || []) as StaffMember[];
            const staffById = staffList.reduce((acc, staff) => {
                acc[staff.id] = staff;
                return acc;
            }, {} as Record<string, StaffMember>);
            const comandas = (comandasRes.data || []) as ComandaExportRow[];
            const comandaIds = comandas.map((comanda) => comanda.id);
            const clientIds = Array.from(new Set(comandas.map((comanda) => comanda.client_id).filter((id): id is string => Boolean(id))));

            const [itemsRes, clientsRes] = await Promise.all([
                comandaIds.length > 0
                    ? barberSupabase
                        .from('comanda_items')
                        .select('id, comanda_id, staff_id, product_name, quantity, unit_price, service_id')
                        .eq('tenant_id', tenantId)
                        .in('comanda_id', comandaIds)
                    : Promise.resolve({ data: [] as any[], error: null }),
                clientIds.length > 0
                    ? barberSupabase
                        .from('clients')
                        .select('id, name')
                        .eq('tenant_id', tenantId)
                        .in('id', clientIds)
                    : Promise.resolve({ data: [] as any[], error: null }),
            ]);

            if (itemsRes.error) throw itemsRes.error;
            if (clientsRes.error) throw clientsRes.error;

            const serviceItems = ((itemsRes.data || []) as any[]).filter((item) => Boolean(item.service_id));
            const itemIds = serviceItems.map((item) => item.id);
            const { data: participants, error: participantsError } = itemIds.length > 0
                ? await barberSupabase
                    .from('service_execution_participants')
                    .select('comanda_item_id, professional_id, role, payout_type, payout_value, affects_commission')
                    .eq('tenant_id', tenantId)
                    .in('comanda_item_id', itemIds)
                : { data: [] as ParticipantExportRow[], error: null };

            if (participantsError) throw participantsError;

            const clientById = ((clientsRes.data || []) as any[]).reduce((acc, client) => {
                acc[client.id] = client.name;
                return acc;
            }, {} as Record<string, string>);
            const comandaById = comandas.reduce((acc, comanda) => {
                acc[comanda.id] = comanda;
                return acc;
            }, {} as Record<string, ComandaExportRow>);
            const participantsByItem = ((participants || []) as ParticipantExportRow[]).reduce((acc, participant) => {
                if (!acc[participant.comanda_item_id]) acc[participant.comanda_item_id] = [];
                acc[participant.comanda_item_id].push(participant);
                return acc;
            }, {} as Record<string, ParticipantExportRow[]>);

            const headers = [
                'Data',
                'Cliente',
                'ID da comanda',
                'Serviço',
                'Valor do serviço',
                'Profissional',
                'Tipo de participação',
                'Percentual de participação',
                'Valor base da comissão',
                'Percentual de comissão',
                'Valor da comissão',
                'Serviço compartilhado',
                'Participantes do serviço',
                'Status da comanda',
                'Status de pagamento',
                'Status da comissão',
                'Forma de pagamento',
            ];

            const rows = serviceItems.flatMap((item) => {
                const comanda = comandaById[item.comanda_id];
                if (!comanda) return [];

                const serviceValue = Number(item.unit_price || 0) * Number(item.quantity || 0);
                const savedParticipants = (participantsByItem[item.id] || []).filter((participant) => participant.affects_commission !== false);
                const isShared = isSharedCommissionItem(item, comanda, savedParticipants);
                const participantsForCommission = isShared
                    ? savedParticipants
                    : [{
                        comanda_item_id: item.id,
                        professional_id: item.staff_id || comanda.staff_id || null,
                        role: 'primary',
                        payout_type: 'percentage',
                        payout_value: 100,
                        affects_commission: true,
                    } as ParticipantExportRow];
                const participantNames = Array.from(new Set(
                    participantsForCommission
                        .map((participant) => participant.professional_id ? staffById[participant.professional_id]?.name || participant.professional_id : '')
                        .filter(Boolean),
                ));

                return participantsForCommission
                    .filter((participant) => Boolean(participant.professional_id))
                    .map((participant) => {
                        const staffMember = participant.professional_id ? staffById[participant.professional_id] : null;
                        const participationRate = participant.payout_type === 'percentage'
                            ? normalizePercentage(participant.payout_value)
                            : null;
                        const commissionBase = participant.payout_type === 'percentage'
                            ? serviceValue * Number(participationRate || 0)
                            : Number(participant.payout_value || 0);
                        const commissionRate = normalizeRate(staffMember?.commission_rate);
                        const commissionValue = commissionBase * commissionRate;

                        return [
                            escapeCSV(new Date(comanda.created_at).toLocaleDateString('pt-BR')),
                            escapeCSV(comanda.client_id ? clientById[comanda.client_id] || 'Cliente sem nome' : 'Cliente sem nome'),
                            escapeCSV(comanda.id),
                            escapeCSV(item.product_name),
                            formatMoneyForExport(serviceValue),
                            escapeCSV(staffMember?.name || participant.professional_id || 'Profissional'),
                            escapeCSV(formatParticipationRole(participant.role)),
                            escapeCSV(participationRate == null ? '' : `${(participationRate * 100).toFixed(2).replace('.', ',')}%`),
                            formatMoneyForExport(commissionBase),
                            escapeCSV(`${(commissionRate * 100).toFixed(2).replace('.', ',')}%`),
                            formatMoneyForExport(commissionValue),
                            escapeCSV(isShared ? 'Sim' : 'Não'),
                            escapeCSV(participantNames.join(' / ')),
                            escapeCSV(comanda.status),
                            escapeCSV(getPaymentStatus(comanda.status)),
                            escapeCSV(getCommissionStatus(comanda.status)),
                            escapeCSV(comanda.payment_method || 'Não informado'),
                        ];
                    });
            });

            const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rows.map((row) => row.join(';'))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `comissoes_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setToast({ message: 'Relatório de comissões exportado com sucesso.', type: 'success' });
        } catch (error) {
            console.error('Erro ao exportar comissoes:', error);
            setToast({ message: 'Erro ao exportar relatório de comissões.', type: 'error' });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Comissoes</h2>
                    <p className="text-slate-500 mt-1">Acompanhe a producao variavel por profissional e o valor previsto para repasse.</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" leftIcon="download" onClick={exportCommissions}>
                        Exportar
                    </Button>
                    <Button leftIcon="refresh" onClick={fetchData}>
                        Recalcular
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissao prevista</p>
                    <h3 className="text-2xl font-black text-emerald-500">
                        {totalCommissions.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendas vinculadas</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Itens comissionados</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalServices}</h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Taxa media</p>
                    <h3 className="text-2xl font-black text-primary">{averageRate.toFixed(1)}%</h3>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-wrap gap-4 items-end">
                <DateRangeFilter
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    showPresets={true}
                />
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Buscar profissional</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Nome ou cargo..."
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
                <div className="w-full md:w-72 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Destaque do periodo</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {topPerformer ? topPerformer.professionalName : 'Sem dados'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {topPerformer
                            ? `${topPerformer.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em comissao prevista`
                            : 'Nenhuma comissao encontrada no periodo.'}
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[980px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Profissional</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cargo</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Taxa</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Itens</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Vendas</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Comissao</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Ultimo lancamento</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Acao</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Carregando comissoes...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                                        Nenhum profissional com dados de comissao neste periodo.
                                    </td>
                                </tr>
                            ) : (
                                filteredRows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <img src={row.avatar} alt={row.professionalName} className="size-10 rounded-full border border-slate-200 dark:border-border-dark object-cover" />
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{row.professionalName}</p>
                                                    <p className="text-xs text-slate-500">{row.items.length} lancamentos vinculados</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">{row.role}</td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                                {row.commissionRate.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-900 dark:text-white">{row.servicesCount}</td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {row.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 font-black text-emerald-500">
                                            {row.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            {row.lastServiceDate ? new Date(row.lastServiceDate).toLocaleDateString('pt-BR') : 'Sem movimento'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => setSelectedRow(row)}
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-200 text-sm font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-base">visibility</span>
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Modal
                isOpen={!!selectedRow}
                onClose={() => setSelectedRow(null)}
                title={selectedRow ? `Detalhes de comissao - ${selectedRow.professionalName}` : 'Detalhes de comissao'}
                maxWidth="xl"
            >
                {selectedRow && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Taxa aplicada</p>
                                <p className="text-xl font-black text-primary mt-1">{selectedRow.commissionRate.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Total de vendas</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    {selectedRow.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Comissao prevista</p>
                                <p className="text-xl font-black text-emerald-500 mt-1">
                                    {selectedRow.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
                            <div className="overflow-x-auto max-h-[360px]">
                                <table className="w-full min-w-[720px]">
                                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Data</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Item</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Qtd</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Valor</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Base</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                        {selectedRow.items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{item.product_name}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">
                                                    {(item.unit_price * item.quantity).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Commissions;
