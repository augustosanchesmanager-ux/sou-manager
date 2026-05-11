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

type ComandaStatus = 'open' | 'paid' | 'blocked' | 'cancelled';

interface ComandaRow {
    id: string;
    created_at: string;
    closed_at?: string | null;
    status: ComandaStatus;
    staff_id?: string | null;
    client_id?: string | null;
    payment_method?: string | null;
    total?: number | null;
    discount?: number | null;
    paid_amount?: number | null;
    amount_paid?: number | null;
    closure_mode?: string | null;
    financial_effect?: boolean | null;
    membership_credit_effect?: boolean | null;
}

interface ParticipantRow {
    comanda_item_id: string;
    staff_id?: string | null;
    professional_id?: string | null;
    role: string | null;
    payout_type: 'percentage' | 'fixed' | string | null;
    payout_value: number | null;
    affects_commission?: boolean | null;
}

interface CommissionBaseChoice {
    value: number;
    field: string;
    reason: string;
}

interface CommissionAuditLine {
    comanda_id: string;
    client_name: string;
    comanda_status: string;
    payment_status: string;
    payment_method: string;
    comanda_total: number;
    comanda_paid_amount: number | '';
    comanda_item_id: string;
    service_id: string;
    service_name: string;
    item_type: string;
    staff_id: string;
    staff_name: string;
    commission_rate_raw: number | '';
    commission_rate_normalized: number;
    quantity: number;
    unit_price: number | '';
    price: number | '';
    amount: number | '';
    total: number | '';
    total_price: number | '';
    line_total: number | '';
    subtotal: number | '';
    discount: number | '';
    final_price: number | '';
    base_value_escolhido: number;
    campo_usado_como_base: string;
    motivo_da_escolha: string;
    credit_applied_detected: string;
    payout_type: string;
    payout_value: number | '';
    payout_value_normalizado: number | '';
    valor_servico: number;
    valor_compartilhado: number;
    base_participante: number;
    commission_rate: number | '';
    commission_rate_normalizado: number;
    participants_count: number;
    participants_staff_ids: string;
    is_shared_real: string;
    commission_value: number;
}

interface CommissionLine {
    id: string;
    comandaId: string;
    comandaItemId: string;
    createdAt: string;
    clientName: string;
    serviceName: string;
    quantity: number;
    unitPrice: number;
    itemValue: number;
    professionalId: string;
    professionalName: string;
    professionalRole: string;
    professionalAvatar: string;
    participationRole: string;
    payoutType: string;
    payoutValue: number | null;
    payoutValueNormalized: number | null;
    participationRate: number | null;
    commissionBase: number;
    commissionRate: number;
    commissionValue: number;
    sharedValue: number;
    divisionLaunched: string;
    baseByParticipant: string;
    isShared: boolean;
    participantNames: string;
    comandaStatus: ComandaStatus;
    paymentStatus: string;
    commissionStatus: string;
    paymentMethod: string;
    audit: CommissionAuditLine;
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
    confirmedSales: number;
    pendingSales: number;
    cancelledSales: number;
    confirmedCommission: number;
    pendingCommission: number;
    cancelledCommission: number;
    lastServiceDate: string | null;
    items: CommissionLine[];
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

const toNumber = (value: unknown, fallback = 0) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
};

const nullableNumber = (value: unknown): number | '' => {
    if (value === null || value === undefined || value === '') return '';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : '';
};

const escapeCSV = (value: string | number | null | undefined) => {
    const normalized = value == null ? '' : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
};

const formatMoneyForExport = (value: number) => Number(value || 0).toFixed(2).replace('.', ',');

const formatMoneyLabel = (value: number) =>
    Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIENT_NAME_FALLBACK = 'Cliente não informado';

const normalizeClientName = (value?: string | null) => {
    const normalized = String(value || '').trim();
    return normalized || CLIENT_NAME_FALLBACK;
};

const formatSavedPayout = (participant: ParticipantRow, staffName: string) => {
    if (participant.payout_type === 'fixed') {
        return `${staffName} ${formatMoneyLabel(toNumber(participant.payout_value))}`;
    }
    const percent = normalizePercentage(participant.payout_value) * 100;
    const formattedPercent = percent.toFixed(2).replace('.', ',').replace(/,00$/, '');
    return `${staffName} ${formattedPercent}%`;
};

const getParticipantBaseValue = (itemValue: number, participant: ParticipantRow) => {
    if (participant.payout_type === 'fixed') return toNumber(participant.payout_value);
    return itemValue * normalizePercentage(participant.payout_value);
};

const getQuantity = (item: any) => {
    const quantity = toNumber(item.quantity, 1);
    return quantity > 0 ? quantity : 1;
};

const getCommissionBaseChoice = (item: any): CommissionBaseChoice => {
    if (item.unit_price !== null && item.unit_price !== undefined && item.unit_price !== '') {
        return {
            value: toNumber(item.unit_price),
            field: 'unit_price',
            reason: 'Checkout salva comanda_items.unit_price = item.price, que e o preco final do servico no carrinho; servicos entram com quantity 1 nesse fluxo.',
        };
    }
    if (item.price !== null && item.price !== undefined && item.price !== '') {
        return {
            value: toNumber(item.price),
            field: 'price',
            reason: 'Fallback: campo unit_price ausente; usando price por representar preco salvo do item quando existir.',
        };
    }
    if (item.amount !== null && item.amount !== undefined && item.amount !== '') {
        return {
            value: toNumber(item.amount),
            field: 'amount',
            reason: 'Fallback: unit_price/price ausentes; usando amount persistido do item.',
        };
    }
    const quantity = getQuantity(item);
    return {
        value: toNumber(item.unit_price) * quantity,
        field: 'unit_price * quantity',
        reason: 'Fallback final: nenhum campo de preco final do item estava disponivel.',
    };
};

const getComandaItemValue = (item: any) => {
    return getCommissionBaseChoice(item).value;
};

const isServiceItem = (item: any) => {
    const type = String(item.type || item.item_type || '').toLowerCase();
    return Boolean(item.service_id) || type === 'service' || type === 'servico' || type === 'serviço';
};

const getCommissionStatus = (status: ComandaStatus) => {
    if (status === 'paid') return 'Confirmada';
    if (status === 'cancelled') return 'Cancelada';
    return 'Pendente';
};

const getPaymentStatus = (status: ComandaStatus) => {
    if (status === 'paid') return 'Pago';
    if (status === 'cancelled') return 'Cancelado';
    return 'Pendente';
};

const getPaymentMethodLabel = (comanda: ComandaRow) => {
    if (comanda.closure_mode === 'legacy_membership' || comanda.financial_effect === false) {
        return 'Clube do Chefe';
    }
    const method = String(comanda.payment_method || '').toLowerCase();
    if (method === 'credit') return 'Credito';
    if (method === 'debit') return 'Debito';
    if (method === 'cash') return 'Dinheiro';
    if (method === 'pix') return 'Pix';
    if (method === 'other') return 'Outro';
    return comanda.payment_method || 'Nao informado';
};

const formatParticipationRole = (role?: string | null) => {
    if (role === 'primary') return 'Principal';
    if (role === 'assistant') return 'Apoio';
    if (role === 'co_executor') return 'Coexecutor';
    return role || 'Principal';
};

const getParticipantStaffId = (participant: ParticipantRow) => participant.staff_id || participant.professional_id || '';

const isSharedCommissionItem = (
    item: { staff_id?: string | null },
    comanda: { staff_id?: string | null },
    participants: ParticipantRow[],
) => {
    if (participants.length === 0) return false;
    if (participants.length > 1) return true;
    const [participant] = participants;
    const mainProfessionalId = item.staff_id || comanda.staff_id || null;
    const isPrimaryMainProfessional = participant.role === 'primary' && getParticipantStaffId(participant) === mainProfessionalId;
    const isFullPercentagePayout = participant.payout_type === 'percentage' && normalizePercentage(participant.payout_value) === 1;
    return !isPrimaryMainProfessional || !isFullPercentagePayout;
};

const getLineStatusBucket = (line: CommissionLine) => {
    if (line.comandaStatus === 'paid') return 'confirmed';
    if (line.comandaStatus === 'cancelled') return 'cancelled';
    return 'pending';
};

const Commissions: React.FC = () => {
    const { tenantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [rows, setRows] = useState<CommissionRow[]>([]);
    const [commissionLines, setCommissionLines] = useState<CommissionLine[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRow, setSelectedRow] = useState<CommissionRow | null>(null);
    const [startDate, setStartDate] = useState(() => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        return start.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

    const loadCommissionLines = useCallback(async () => {
        if (!tenantId || !startDate || !endDate) return [];

        const client = getScopedClient('barber');
        const startOfRange = new Date(startDate);
        startOfRange.setHours(0, 0, 0, 0);
        const endOfRange = new Date(endDate);
        endOfRange.setHours(23, 59, 59, 999);

        const [staffRes, comandasRes] = await Promise.all([
            client
                .from('staff')
                .select('id, name, role, avatar, commission_rate')
                .eq('tenant_id', tenantId),
            client
                .from('comandas')
                .select('*')
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
        const comandas = (comandasRes.data || []) as ComandaRow[];
        const comandaIds = comandas.map((comanda) => comanda.id);
        const clientIds = Array.from(new Set(comandas.map((comanda) => comanda.client_id).filter((id): id is string => Boolean(id))));

        const [itemsRes, clientsRes] = await Promise.all([
            comandaIds.length > 0
                ? client
                    .from('comanda_items')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .in('comanda_id', comandaIds)
                : Promise.resolve({ data: [] as any[], error: null }),
            clientIds.length > 0
                ? client
                    .from('clients')
                    .select('id, name')
                    .eq('tenant_id', tenantId)
                    .in('id', clientIds)
                : Promise.resolve({ data: [] as any[], error: null }),
        ]);

        if (itemsRes.error) throw itemsRes.error;
        if (clientsRes.error) throw clientsRes.error;

        const rawServiceItems = ((itemsRes.data || []) as any[]).filter(isServiceItem);
        const serviceItems = Array.from(
            rawServiceItems.reduce((acc, item) => {
                if (item.id && !acc.has(item.id)) acc.set(item.id, item);
                return acc;
            }, new Map<string, any>()).values(),
        ) as any[];
        const itemIds = serviceItems.map((item) => item.id).filter(Boolean);
        const { data: participants, error: participantsError } = itemIds.length > 0
            ? await client
                .from('service_execution_participants')
                .select('*')
                .eq('tenant_id', tenantId)
                .in('comanda_item_id', itemIds)
            : { data: [] as ParticipantRow[], error: null };

        if (participantsError) throw participantsError;

        const clientById = ((clientsRes.data || []) as any[]).reduce((acc, currentClient) => {
            acc[currentClient.id] = currentClient.name;
            return acc;
        }, {} as Record<string, string>);
        const comandaById = comandas.reduce((acc, comanda) => {
            acc[comanda.id] = comanda;
            return acc;
        }, {} as Record<string, ComandaRow>);
        const participantsByItem = ((participants || []) as ParticipantRow[]).reduce((acc, participant) => {
            if (!acc[participant.comanda_item_id]) acc[participant.comanda_item_id] = [];
            acc[participant.comanda_item_id].push(participant);
            return acc;
        }, {} as Record<string, ParticipantRow[]>);

        return serviceItems.flatMap((item): CommissionLine[] => {
            const comanda = comandaById[item.comanda_id];
            if (!comanda) return [];

            const itemValue = getComandaItemValue(item);
            const baseChoice = getCommissionBaseChoice(item);
            const quantity = getQuantity(item);
            const savedParticipants = (participantsByItem[item.id] || [])
                .filter((participant) => getParticipantStaffId(participant))
                .filter((participant) => participant.affects_commission !== false);
            const isShared = isSharedCommissionItem(item, comanda, savedParticipants);
            const participantStaffIds = Array.from(new Set(savedParticipants.map(getParticipantStaffId).filter(Boolean)));
            const participantsForCommission = savedParticipants.length > 0
                ? savedParticipants
                : [{
                    comanda_item_id: item.id,
                    staff_id: item.staff_id || comanda.staff_id || null,
                    role: 'primary',
                    payout_type: 'percentage',
                    payout_value: 100,
                    affects_commission: true,
                } as ParticipantRow];
            const getParticipantName = (participant: ParticipantRow) => {
                const staffId = getParticipantStaffId(participant);
                return staffId ? staffById[staffId]?.name || staffId : 'Profissional';
            };
            const participantNames = isShared
                ? Array.from(new Set(
                    participantsForCommission
                        .map((participant) => getParticipantName(participant))
                        .filter(Boolean),
                )).join(' / ')
                : '';
            const divisionLaunched = isShared
                ? participantsForCommission.map((participant) => formatSavedPayout(participant, getParticipantName(participant))).join(' / ')
                : '';
            const baseByParticipant = isShared
                ? participantsForCommission
                    .map((participant) => `${getParticipantName(participant)} ${formatMoneyLabel(getParticipantBaseValue(itemValue, participant))}`)
                    .join(' / ')
                : '';

            return participantsForCommission
                .filter((participant) => getParticipantStaffId(participant))
                .map((participant) => {
                    const staffId = getParticipantStaffId(participant);
                    const staff = staffById[staffId];
                    const participationRate = participant.payout_type === 'percentage'
                        ? normalizePercentage(participant.payout_value)
                        : null;
                    const commissionBase = participant.payout_type === 'fixed'
                        ? toNumber(participant.payout_value)
                        : itemValue * Number(participationRate || 0);
                    const commissionRate = normalizeRate(staff?.commission_rate);
                    const commissionValue = commissionBase * commissionRate;
                    const payoutType = participant.payout_type || '';
                    const payoutValue = participant.payout_value == null ? null : toNumber(participant.payout_value);
                    const payoutValueNormalized = participant.payout_type === 'percentage' ? normalizePercentage(participant.payout_value) : null;
                    const sharedValue = isShared ? commissionBase : 0;
                    const creditAppliedDetected = itemValue === 0 && Boolean(item.service_id) && comanda.membership_credit_effect !== false;
                    const clientName = normalizeClientName(comanda.client_id ? clientById[comanda.client_id] : null);

                    return {
                        id: `${item.id}:${staffId}:${participant.role || 'primary'}`,
                        comandaId: comanda.id,
                        comandaItemId: item.id,
                        createdAt: comanda.created_at,
                        clientName,
                        serviceName: item.product_name || 'Servico',
                        quantity,
                        unitPrice: toNumber(item.unit_price),
                        itemValue,
                        professionalId: staffId,
                        professionalName: staff?.name || staffId || 'Profissional',
                        professionalRole: staff?.role || 'Profissional',
                        professionalAvatar: staff?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || 'Profissional')}`,
                        participationRole: formatParticipationRole(participant.role),
                        payoutType,
                        payoutValue,
                        payoutValueNormalized,
                        participationRate,
                        commissionBase,
                        commissionRate,
                        commissionValue,
                        sharedValue,
                        divisionLaunched,
                        baseByParticipant,
                        isShared,
                        participantNames,
                        comandaStatus: comanda.status,
                        paymentStatus: getPaymentStatus(comanda.status),
                        commissionStatus: getCommissionStatus(comanda.status),
                        paymentMethod: getPaymentMethodLabel(comanda),
                        audit: {
                            comanda_id: comanda.id,
                            client_name: clientName,
                            comanda_status: comanda.status,
                            payment_status: getPaymentStatus(comanda.status),
                            payment_method: getPaymentMethodLabel(comanda),
                            comanda_total: toNumber(comanda.total),
                            comanda_paid_amount: comanda.status === 'paid'
                                ? nullableNumber(comanda.paid_amount ?? comanda.amount_paid ?? comanda.total)
                                : '',
                            comanda_item_id: item.id,
                            service_id: item.service_id || '',
                            service_name: item.product_name || 'Servico',
                            item_type: item.item_type || item.type || (item.service_id ? 'service' : ''),
                            staff_id: staffId,
                            staff_name: staff?.name || staffId || 'Profissional',
                            commission_rate_raw: nullableNumber(staff?.commission_rate),
                            commission_rate_normalized: commissionRate,
                            quantity,
                            unit_price: nullableNumber(item.unit_price),
                            price: nullableNumber(item.price),
                            amount: nullableNumber(item.amount),
                            total: nullableNumber(item.total),
                            total_price: nullableNumber(item.total_price),
                            line_total: nullableNumber(item.line_total),
                            subtotal: nullableNumber(item.subtotal),
                            discount: nullableNumber(item.discount ?? comanda.discount),
                            final_price: nullableNumber(item.final_price),
                            base_value_escolhido: baseChoice.value,
                            campo_usado_como_base: baseChoice.field,
                            motivo_da_escolha: baseChoice.reason,
                            credit_applied_detected: creditAppliedDetected ? 'Sim' : 'Nao',
                            payout_type: payoutType,
                            payout_value: payoutValue == null ? '' : payoutValue,
                            payout_value_normalizado: payoutValueNormalized == null ? '' : payoutValueNormalized,
                            valor_servico: itemValue,
                            valor_compartilhado: sharedValue,
                            base_participante: commissionBase,
                            commission_rate: nullableNumber(staff?.commission_rate),
                            commission_rate_normalizado: commissionRate,
                            participants_count: savedParticipants.length,
                            participants_staff_ids: participantStaffIds.join(' / '),
                            is_shared_real: isShared ? 'Sim' : 'Nao',
                            commission_value: commissionValue,
                        },
                    };
                });
        });
    }, [endDate, startDate, tenantId]);

    const groupCommissionRows = useCallback((lines: CommissionLine[]): CommissionRow[] => {
        const grouped = lines.reduce((acc, line) => {
            if (!acc[line.professionalId]) {
                acc[line.professionalId] = {
                    id: line.professionalId,
                    professionalName: line.professionalName,
                    role: line.professionalRole,
                    avatar: line.professionalAvatar,
                    commissionRate: line.commissionRate * 100,
                    servicesCount: 0,
                    grossSales: 0,
                    commissionValue: 0,
                    confirmedSales: 0,
                    pendingSales: 0,
                    cancelledSales: 0,
                    confirmedCommission: 0,
                    pendingCommission: 0,
                    cancelledCommission: 0,
                    lastServiceDate: null,
                    items: [],
                };
            }

            const row = acc[line.professionalId];
            row.items.push(line);
            row.servicesCount += 1;
            const bucket = getLineStatusBucket(line);
            if (bucket === 'confirmed') {
                row.confirmedSales += line.commissionBase;
                row.confirmedCommission += line.commissionValue;
            } else if (bucket === 'pending') {
                row.pendingSales += line.commissionBase;
                row.pendingCommission += line.commissionValue;
            } else {
                row.cancelledSales += line.commissionBase;
                row.cancelledCommission += line.commissionValue;
            }
            row.grossSales = row.confirmedSales + row.pendingSales;
            row.commissionValue = row.confirmedCommission + row.pendingCommission;
            if (!row.lastServiceDate || line.createdAt > row.lastServiceDate) row.lastServiceDate = line.createdAt;
            return acc;
        }, {} as Record<string, CommissionRow>);

        return Object.values(grouped).sort((a, b) => b.commissionValue - a.commissionValue);
    }, []);

    const fetchData = useCallback(async () => {
        if (!tenantId || !startDate || !endDate) {
            setRows([]);
            setCommissionLines([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            const lines = await loadCommissionLines();
            setCommissionLines(lines);
            setRows(groupCommissionRows(lines));
        } catch (error) {
            console.error('Erro ao carregar comissoes:', error);
            setToast({ message: 'Erro ao carregar dados de comissoes.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [endDate, groupCommissionRows, loadCommissionLines, startDate, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredRows = useMemo(
        () =>
            rows.filter((row) =>
                row.professionalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                row.role.toLowerCase().includes(searchTerm.toLowerCase())
            ),
        [rows, searchTerm],
    );

    const visibleProfessionalIds = useMemo(() => new Set(filteredRows.map((row) => row.id)), [filteredRows]);
    const filteredLines = useMemo(
        () => commissionLines.filter((line) => visibleProfessionalIds.has(line.professionalId)),
        [commissionLines, visibleProfessionalIds],
    );

    const confirmedCommission = filteredRows.reduce((sum, row) => sum + row.confirmedCommission, 0);
    const pendingCommission = filteredRows.reduce((sum, row) => sum + row.pendingCommission, 0);
    const cancelledCommission = filteredRows.reduce((sum, row) => sum + row.cancelledCommission, 0);
    const totalCommissions = confirmedCommission + pendingCommission;
    const totalSales = filteredRows.reduce((sum, row) => sum + row.grossSales, 0);
    const totalServices = filteredRows.reduce((sum, row) => sum + row.servicesCount, 0);
    const averageRate = filteredRows.length > 0
        ? filteredRows.reduce((sum, row) => sum + row.commissionRate, 0) / filteredRows.length
        : 0;
    const topPerformer = filteredRows.reduce<CommissionRow | null>(
        (best, current) => (!best || current.commissionValue > best.commissionValue ? current : best),
        null,
    );

    const exportCommissions = async () => {
        if (!tenantId || !startDate || !endDate) {
            setToast({ message: 'Informe um periodo valido para exportar comissoes.', type: 'error' });
            return;
        }

        try {
            const lines = commissionLines.length > 0 ? commissionLines : await loadCommissionLines();
            const headers = [
                'Data',
                'Cliente',
                'ID da comanda',
                'Servico',
                'Valor do servico',
                'Valor compartilhado',
                'Profissional',
                'Tipo de participacao',
                'Percentual de participacao',
                'Valor base da comissao',
                'Divisao lancada',
                'Base por participante',
                'Percentual de comissao',
                'Valor da comissao',
                'Servico compartilhado',
                'Participantes do servico',
                'Status da comanda',
                'Status de pagamento',
                'Status da comissao',
                'Forma de pagamento',
            ];

            const rowsForExport = lines.map((line) => [
                escapeCSV(new Date(line.createdAt).toLocaleDateString('pt-BR')),
                escapeCSV(normalizeClientName(line.clientName)),
                escapeCSV(line.comandaId),
                escapeCSV(line.serviceName),
                formatMoneyForExport(line.itemValue),
                line.isShared ? formatMoneyForExport(line.sharedValue) : '-',
                escapeCSV(line.professionalName),
                escapeCSV(line.participationRole),
                escapeCSV(line.participationRate == null ? '' : `${(line.participationRate * 100).toFixed(2).replace('.', ',')}%`),
                formatMoneyForExport(line.commissionBase),
                escapeCSV(line.divisionLaunched),
                escapeCSV(line.baseByParticipant),
                escapeCSV(`${(line.commissionRate * 100).toFixed(2).replace('.', ',')}%`),
                formatMoneyForExport(line.commissionValue),
                escapeCSV(line.isShared ? 'Sim' : 'Nao'),
                escapeCSV(line.participantNames),
                escapeCSV(line.comandaStatus),
                escapeCSV(line.paymentStatus),
                escapeCSV(line.commissionStatus),
                escapeCSV(line.paymentMethod),
            ]);

            const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rowsForExport.map((row) => row.join(';'))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `comissoes_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setToast({ message: 'Relatorio de comissoes exportado com sucesso.', type: 'success' });
        } catch (error) {
            console.error('Erro ao exportar comissoes:', error);
            setToast({ message: 'Erro ao exportar relatorio de comissoes.', type: 'error' });
        }
    };

    const exportCommissionAudit = async () => {
        if (!tenantId || !startDate || !endDate) {
            setToast({ message: 'Informe um periodo valido para auditar comissoes.', type: 'error' });
            return;
        }

        try {
            const lines = commissionLines.length > 0 ? commissionLines : await loadCommissionLines();
            const headers: Array<keyof CommissionAuditLine> = [
                'comanda_id',
                'client_name',
                'comanda_status',
                'payment_status',
                'payment_method',
                'comanda_total',
                'comanda_paid_amount',
                'comanda_item_id',
                'service_id',
                'service_name',
                'item_type',
                'staff_id',
                'staff_name',
                'commission_rate_raw',
                'commission_rate_normalized',
                'quantity',
                'unit_price',
                'price',
                'amount',
                'total',
                'total_price',
                'line_total',
                'subtotal',
                'discount',
                'final_price',
                'base_value_escolhido',
                'campo_usado_como_base',
                'motivo_da_escolha',
                'credit_applied_detected',
                'payout_type',
                'payout_value',
                'payout_value_normalizado',
                'valor_servico',
                'valor_compartilhado',
                'base_participante',
                'commission_rate',
                'commission_rate_normalizado',
                'participants_count',
                'participants_staff_ids',
                'is_shared_real',
                'commission_value',
            ];
            const rowsForExport = lines.map((line) => headers.map((header) => escapeCSV(line.audit[header])));
            const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(';'), ...rowsForExport.map((row) => row.join(';'))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `auditoria_comissoes_${startDate}_${endDate}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            if (import.meta.env.DEV) {
                console.table(lines.map((line) => line.audit));
            }
            setToast({ message: 'Auditoria de comissoes exportada com sucesso.', type: 'success' });
        } catch (error) {
            console.error('Erro ao exportar auditoria de comissoes:', error);
            setToast({ message: 'Erro ao exportar auditoria de comissoes.', type: 'error' });
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
                    <Button variant="secondary" leftIcon="bug_report" onClick={exportCommissionAudit}>
                        Auditar
                    </Button>
                    <Button leftIcon="refresh" onClick={fetchData}>
                        Recalcular
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissao confirmada</p>
                    <h3 className="text-2xl font-black text-emerald-500">
                        {confirmedCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissao pendente</p>
                    <h3 className="text-2xl font-black text-amber-500">
                        {pendingCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissao cancelada</p>
                    <h3 className="text-2xl font-black text-rose-500">
                        {cancelledCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendas validas</p>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                        {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
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
                    <table className="w-full min-w-[1080px] text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Profissional</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cargo</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Taxa</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Itens</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Vendas validas</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Confirmada</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Pendente</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cancelada</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Ultimo lancamento</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Acao</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                        Carregando comissoes...
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
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
                                            {row.confirmedCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 font-black text-amber-500">
                                            {row.pendingCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-6 py-4 font-black text-rose-500">
                                            {row.cancelledCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                <p className="text-xs font-bold uppercase text-slate-500">Vendas validas</p>
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
                            <div className="overflow-x-auto max-h-[420px]">
                                <table className="w-full min-w-[1180px]">
                                    <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Data</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Cliente</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Servico</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Qtd</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Valor vendido</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Divisao/Regra</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Comissao</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                        {selectedRow.items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{new Date(item.createdAt).toLocaleDateString('pt-BR')}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{normalizeClientName(item.clientName)}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                                                    <div>{item.serviceName}</div>
                                                    {item.isShared && <div className="text-xs text-amber-600 dark:text-amber-300">Compartilhado: {item.participantNames}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {item.itemValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    <div>{item.isShared ? item.divisionLaunched : '-'}</div>
                                                    {item.isShared && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            Compartilhado: {item.sharedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </div>
                                                    )}
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                                        Base: {item.commissionBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">Status: {item.commissionStatus}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-bold text-emerald-500">
                                                    {item.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
