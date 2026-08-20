import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../components/ui/Modal';
import Toast from '../components/Toast';
import Button from '../components/ui/Button';
import DateRangeFilter from '../components/ui/DateRangeFilter';
import { AuditAdjustmentButton } from '../components/audit';
import { useAuth } from '../context/AuthContext';
import { getScopedClient } from '../services/supabaseClient';
import { getEffectiveCommissionRate } from '../src/lib/staff/roles';
import { normalizePercentage } from '../shared/numbers/normalize';
import { calculateParticipantBaseValue, resolveCommissionBase, resolveFinancialBase, isCommissionEligible } from '../domain/commission/calculate';
import { formatParticipantPayout } from '../domain/commission/format';
import type { ParticipantRow as DomainParticipantRow, CommissionBaseChoice as DomainCommissionBaseChoice, ZeroCommissionReason } from '../domain/commission/types';
import {
  commissionStatusLabels,
  getCommissionStatus,
  getCommissionPaymentLabel,
  isCommissionStatusFilter,
} from '../shared/status/commission';
import type { CommissionStatusFilter } from '../shared/status/commission';
import type { SupabaseClient } from '@supabase/supabase-js';

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
    appointment_id?: string | null;
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

interface AppointmentRow {
    id: string;
    start_time?: string | null;
}

// ParticipantRow from domain/commission/types.ts
// Local alias for backward compatibility with existing code
type ParticipantRow = DomainParticipantRow;
type CommissionBaseChoice = DomainCommissionBaseChoice;

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

type ProductionDateSource = 'appointment_start' | 'comanda_closed_at' | 'comanda_created_at';
type CommissionTypeFilter = 'all' | 'solo' | 'shared';

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
    dateSource: ProductionDateSource;
    discountAmount: number;
    zeroReason: ZeroCommissionReason | null;
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

const normalizeRate = normalizePercentage;

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
    return formatParticipantPayout(participant, staffName);
};

const getParticipantBaseValue = (itemValue: number, participant: ParticipantRow) => {
    return calculateParticipantBaseValue(itemValue, participant);
};

const getQuantity = (item: any) => {
    const quantity = toNumber(item.quantity, 1);
    return quantity > 0 ? quantity : 1;
};

const getCommissionBaseChoice = (item: any): CommissionBaseChoice => {
    return resolveCommissionBase(item);
};

const getComandaItemValue = (item: any) => {
    return getCommissionBaseChoice(item).value;
};

const getProductionDate = (comanda: ComandaRow, appointmentById: Record<string, AppointmentRow>) => {
    const appointmentStartTime = comanda.appointment_id ? appointmentById[comanda.appointment_id]?.start_time : null;
    return appointmentStartTime || comanda.closed_at || comanda.created_at;
};

const getProductionDateSource = (comanda: ComandaRow, appointmentById: Record<string, AppointmentRow>): ProductionDateSource => {
    const appointmentStartTime = comanda.appointment_id ? appointmentById[comanda.appointment_id]?.start_time : null;
    if (appointmentStartTime) return 'appointment_start';
    if (comanda.closed_at) return 'comanda_closed_at';
    return 'comanda_created_at';
};

const getProductionDateSourceLabel = (source: ProductionDateSource) => {
    if (source === 'appointment_start') return 'Data do atendimento';
    if (source === 'comanda_closed_at') return 'Dados legados: fechamento';
    return 'Dados legados: abertura';
};

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const getShortComandaRef = (id: string) => `#${String(id || '').slice(0, 8) || 'sem-id'}`;

const isServiceItem = (item: any) => {
    const type = String(item.type || item.item_type || '').toLowerCase();
    return Boolean(item.service_id) || type === 'service' || type === 'servico' || type === 'serviço';
};

const COMMISSIONS_IN_BATCH_SIZE = 120;
const COMMISSIONS_PAGE_SIZE = 1000;

const fetchAllPages = async <T,>(
    queryBuilder: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: any }>,
    pageSize: number,
): Promise<{ data: T[] | null; error: any }> => {
    const allData: T[] = [];
    let from = 0;
    let pageError: any = null;
    while (true) {
        const to = from + pageSize - 1;
        const pageResult = await queryBuilder(from, to);
        if (pageResult.error) {
            pageError = pageResult.error;
            break;
        }
        const pageData = (pageResult.data || []) as T[];
        allData.push(...pageData);
        if (pageData.length < pageSize) break;
        from = to + 1;
    }
    return { data: allData, error: pageError };
};

const fetchInChunks = async <T,>(
    client: SupabaseClient,
    table: string,
    column: string,
    ids: string[],
    options: { select?: string; tenantId?: string } = {},
): Promise<T[]> => {
    const allData: T[] = [];
    for (let i = 0; i < ids.length; i += COMMISSIONS_IN_BATCH_SIZE) {
        const batch = ids.slice(i, i + COMMISSIONS_IN_BATCH_SIZE);
        let query = client.from(table).select(options.select || '*').in(column, batch);
        if (options.tenantId) query = query.eq('tenant_id', options.tenantId);
        const { data, error } = await query;
        if (error) throw error;
        allData.push(...((data || []) as T[]));
    }
    return allData;
};

const fetchComandasInPeriod = async (
    client: SupabaseClient,
    tenantId: string,
    statuses: string[],
    rangeStartIso: string,
    rangeEndIso: string,
    appointmentIds: string[],
): Promise<ComandaRow[]> => {
    const collected: ComandaRow[] = [];
    const seen = new Set<string>();

    const runQuery = async (dateOr: string) => {
        const res = await fetchAllPages(
            (from, to) =>
                client
                    .from('comandas')
                    .select('*')
                    .eq('tenant_id', tenantId)
                    .in('status', statuses)
                    .or('hidden_from_financial.is.null,hidden_from_financial.eq.false')
                    .or(dateOr)
                    .range(from, to),
            COMMISSIONS_PAGE_SIZE,
        );
        if (res.error) throw res.error;
        for (const comanda of (res.data || []) as ComandaRow[]) {
            if (comanda.id && !seen.has(comanda.id)) {
                seen.add(comanda.id);
                collected.push(comanda);
            }
        }
    };

    await runQuery(
        `and(created_at.gte.${rangeStartIso},created_at.lte.${rangeEndIso}),and(closed_at.gte.${rangeStartIso},closed_at.lte.${rangeEndIso})`,
    );

    for (let i = 0; i < appointmentIds.length; i += COMMISSIONS_IN_BATCH_SIZE) {
        const batch = appointmentIds.slice(i, i + COMMISSIONS_IN_BATCH_SIZE);
        await runQuery(`and(appointment_id.in.(${batch.join(',')}))`);
    }

    return collected;
};

const getPaymentMethodLabel = (comanda: ComandaRow) => {
    if (comanda.closure_mode === 'legacy_membership' || comanda.financial_effect === false) {
        return 'Club dos Chefes';
    }
    const method = String(comanda.payment_method || '').toLowerCase();
    if (method === 'credit') return 'Crédito';
    if (method === 'debit') return 'Débito';
    if (method === 'cash') return 'Dinheiro';
    if (method === 'pix') return 'Pix';
    if (method === 'other') return 'Outro';
    return comanda.payment_method || 'Não informado';
};

const formatParticipationRole = (role?: string | null) => {
    if (role === 'primary') return 'Principal';
    if (role === 'assistant') return 'Apoio';
    if (role === 'co_executor') return 'Coexecutor';
    return role || 'Principal';
};

const getParticipantStaffId = (participant: ParticipantRow) => participant.staff_id || '';

const buildSoloParticipant = (comandaItemId: string, staffId?: string | null): ParticipantRow => ({
    id: `solo-${comandaItemId}`,
    comanda_item_id: comandaItemId,
    staff_id: staffId || null,
    professional_id: staffId || null,
    role: 'primary',
    payout_type: 'percentage',
    payout_value: 100,
    affects_commission: true,
});

const buildInferredPrimaryParticipant = (
    comandaItemId: string,
    staffId: string,
    participant: ParticipantRow,
    itemValue: number,
): ParticipantRow | null => {
    if (participant.payout_type === 'fixed') {
        const remainingValue = Math.max(0, itemValue - toNumber(participant.payout_value));
        if (remainingValue <= 0) return null;
        return {
            ...buildSoloParticipant(comandaItemId, staffId),
            payout_type: 'fixed',
            payout_value: remainingValue,
        };
    }

    const participantRate = normalizePercentage(participant.payout_value);
    const remainingRate = Math.max(0, 1 - participantRate);
    if (remainingRate <= 0) return null;
    return {
        ...buildSoloParticipant(comandaItemId, staffId),
        payout_value: remainingRate * 100,
    };
};

const hasPartialSavedPayout = (participant: ParticipantRow, itemValue: number) => {
    if (participant.payout_type === 'fixed') {
        const payoutValue = toNumber(participant.payout_value);
        return payoutValue > 0 && payoutValue < itemValue;
    }

    const payoutRate = normalizePercentage(participant.payout_value);
    return payoutRate > 0 && payoutRate < 1;
};

const normalizeCommissionParticipants = (
    item: { id: string; staff_id?: string | null },
    comanda: { staff_id?: string | null },
    participants: ParticipantRow[],
    itemValue: number,
    staffById: Record<string, StaffMember>,
) => {
    const mainStaffId = item.staff_id || comanda.staff_id || null;
    const mainStaffReceivesCommission = mainStaffId ? isCommissionEligible(staffById[mainStaffId]) : false;
    const commissionableByStaffId = participants.reduce((acc, participant) => {
        const staffId = getParticipantStaffId(participant);
        if (!staffId || !isCommissionEligible(staffById[staffId])) {
            return acc;
        }
        if (!acc.has(staffId)) acc.set(staffId, participant);
        return acc;
    }, new Map<string, ParticipantRow>());

    if (commissionableByStaffId.size === 0) {
        return {
            participants: mainStaffReceivesCommission ? [buildSoloParticipant(item.id, mainStaffId)] : [],
            participantStaffIds: mainStaffReceivesCommission && mainStaffId ? [mainStaffId] : [],
            sharedStaffIds: mainStaffReceivesCommission && mainStaffId ? [mainStaffId] : [],
            isShared: false,
        };
    }

    if (commissionableByStaffId.size === 1) {
        const [onlyParticipant] = Array.from(commissionableByStaffId.values());
        const onlyStaffId = getParticipantStaffId(onlyParticipant);

        if (onlyStaffId === mainStaffId) {
            return {
                participants: [buildSoloParticipant(item.id, onlyStaffId)],
                participantStaffIds: [onlyStaffId],
                sharedStaffIds: [onlyStaffId],
                isShared: false,
            };
        }

        if (!mainStaffId) {
            return {
                participants: [buildSoloParticipant(item.id, onlyStaffId)],
                participantStaffIds: [onlyStaffId],
                sharedStaffIds: [onlyStaffId],
                isShared: false,
            };
        }

        // Legacy splits may save only the supporting barber; the primary professional can live on the item/comanda.
        const inferredPrimary = hasPartialSavedPayout(onlyParticipant, itemValue)
            ? buildInferredPrimaryParticipant(item.id, mainStaffId, onlyParticipant, itemValue)
            : null;

        const sharedStaffIds = [mainStaffId, onlyStaffId].filter(Boolean) as string[];

        if (inferredPrimary) {
            return {
                participants: [inferredPrimary, onlyParticipant],
                participantStaffIds: [mainStaffId, onlyStaffId].filter(Boolean) as string[],
                sharedStaffIds,
                isShared: true,
            };
        }

        return {
            participants: [onlyParticipant],
            participantStaffIds: [onlyStaffId],
            sharedStaffIds,
            isShared: true,
        };
    }

    const uniqueParticipants = Array.from(commissionableByStaffId.values());
    const uniqueStaffIds = uniqueParticipants.map(getParticipantStaffId).filter(Boolean);
    const sharedStaffIds = mainStaffId && !uniqueStaffIds.includes(mainStaffId)
        ? [mainStaffId, ...uniqueStaffIds]
        : uniqueStaffIds;
    return {
        participants: uniqueParticipants,
        participantStaffIds: uniqueStaffIds,
        sharedStaffIds,
        isShared: uniqueStaffIds.length > 1,
    };
};

const getLineStatusBucket = (line: CommissionLine) => {
    return getCommissionStatus(line.comandaStatus);
};

const Commissions: React.FC = () => {
    const { tenantId } = useAuth();
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [commissionLines, setCommissionLines] = useState<CommissionLine[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [professionalFilter, setProfessionalFilter] = useState('all');
    const [commissionTypeFilter, setCommissionTypeFilter] = useState<CommissionTypeFilter>('all');
    const [statusFilter, setStatusFilter] = useState<CommissionStatusFilter>('all');
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
        const rangeStartIso = startOfRange.toISOString();
        const rangeEndIso = endOfRange.toISOString();

        const staffRes = await client
            .from('staff')
            .select('id, name, role, avatar, commission_rate')
            .eq('tenant_id', tenantId);
        if (staffRes.error) throw staffRes.error;

        const appointmentsInRangeRes = await fetchAllPages(
            (from, to) =>
                client
                    .from('appointments')
                    .select('id, start_time')
                    .eq('tenant_id', tenantId)
                    .gte('start_time', rangeStartIso)
                    .lte('start_time', rangeEndIso)
                    .range(from, to),
            COMMISSIONS_PAGE_SIZE,
        );
        if (appointmentsInRangeRes.error) throw appointmentsInRangeRes.error;

        const appointmentIdsInRange = ((appointmentsInRangeRes.data || []) as AppointmentRow[]).map(
            (appointment) => appointment.id,
        );

        const comandas = await fetchComandasInPeriod(
            client,
            tenantId,
            ['open', 'paid', 'blocked', 'cancelled'],
            rangeStartIso,
            rangeEndIso,
            appointmentIdsInRange,
        );

        const staffList = (staffRes.data || []) as StaffMember[];
        const staffById = staffList.reduce((acc, staff) => {
            acc[staff.id] = staff;
            return acc;
        }, {} as Record<string, StaffMember>);
        const appointmentIds = Array.from(new Set(comandas.map((comanda) => comanda.appointment_id).filter((id): id is string => Boolean(id))));
        const appointments = appointmentIds.length > 0
            ? await fetchInChunks<AppointmentRow>(client, 'appointments', 'id', appointmentIds, { select: 'id, start_time', tenantId })
            : [];

        const appointmentById = appointments.reduce((acc, appointment) => {
            acc[appointment.id] = appointment;
            return acc;
        }, {} as Record<string, AppointmentRow>);
        const comandasInProductionRange = comandas.filter((comanda) => {
            const productionDate = new Date(getProductionDate(comanda, appointmentById));
            if (Number.isNaN(productionDate.getTime())) return false;
            return productionDate >= startOfRange && productionDate <= endOfRange;
        });
        const comandaIds = comandasInProductionRange.map((comanda) => comanda.id);
        const clientIds = Array.from(new Set(comandasInProductionRange.map((comanda) => comanda.client_id).filter((id): id is string => Boolean(id))));

        const [itemsData, clientsData] = await Promise.all([
            comandaIds.length > 0
                ? fetchInChunks<any>(client, 'comanda_items', 'comanda_id', comandaIds, { tenantId })
                : Promise.resolve([] as any[]),
            clientIds.length > 0
                ? fetchInChunks<any>(client, 'clients', 'id', clientIds, { select: 'id, name', tenantId })
                : Promise.resolve([] as any[]),
        ]);

        const rawServiceItems = (itemsData as any[]).filter(isServiceItem);
        const serviceItems = Array.from(
            rawServiceItems.reduce((acc, item) => {
                if (item.id && !acc.has(item.id)) acc.set(item.id, item);
                return acc;
            }, new Map<string, any>()).values(),
        ) as any[];
        const itemIds = serviceItems.map((item) => item.id).filter(Boolean);
        const participants = itemIds.length > 0
            ? await fetchInChunks<ParticipantRow>(client, 'service_execution_participants', 'comanda_item_id', itemIds, { tenantId })
            : [];

        const clientById = (clientsData as any[]).reduce((acc, currentClient) => {
            acc[currentClient.id] = currentClient.name;
            return acc;
        }, {} as Record<string, string>);
        const comandaById = comandasInProductionRange.reduce((acc, comanda) => {
            acc[comanda.id] = comanda;
            return acc;
        }, {} as Record<string, ComandaRow>);
        const participantsByItem = participants.reduce((acc, participant) => {
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
            const normalizedParticipants = normalizeCommissionParticipants(
                { id: item.id, staff_id: item.staff_id },
                comanda,
                participantsByItem[item.id] || [],
                itemValue,
                staffById,
            );
            const isShared = normalizedParticipants.isShared;
            const participantStaffIds = normalizedParticipants.participantStaffIds;
            const participantsForCommission = normalizedParticipants.participants;
            const sharedStaffIds = normalizedParticipants.sharedStaffIds;
            const productionDate = getProductionDate(comanda, appointmentById);
            const dateSource = getProductionDateSource(comanda, appointmentById);
            const getParticipantName = (participant: ParticipantRow) => {
                const staffId = getParticipantStaffId(participant);
                return staffId ? staffById[staffId]?.name || staffId : 'Profissional';
            };
            const sharedParticipantNamesByStaffId = sharedStaffIds.reduce((acc, staffId) => {
                acc[staffId] = staffById[staffId]?.name || staffId;
                return acc;
            }, {} as Record<string, string>);
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
                .flatMap((participant): CommissionLine[] => {
                    const staffId = getParticipantStaffId(participant);
                    const staff = staffById[staffId];
                    if (!isCommissionEligible(staff)) return [];
                    const participationRate = participant.payout_type === 'percentage'
                        ? normalizePercentage(participant.payout_value)
                        : null;
                    const payoutType = participant.payout_type || '';
                    const payoutValue = participant.payout_value == null ? null : toNumber(participant.payout_value);
                    const payoutValueNormalized = participant.payout_type === 'percentage' ? normalizePercentage(participant.payout_value) : null;
                    const participantNames = isShared
                        ? Object.entries(sharedParticipantNamesByStaffId)
                            .filter(([participantStaffId]) => participantStaffId !== staffId)
                            .map(([, name]) => name)
                            .filter(Boolean)
                            .join(' / ')
                        : '';
                    const creditAppliedDetected = itemValue === 0 && Boolean(item.service_id) && comanda.membership_credit_effect !== false;
                    const clientName = normalizeClientName(comanda.client_id ? clientById[comanda.client_id] : null);
                    const discountAmount = toNumber(item.discount ?? comanda.discount);

                    const financialBase = resolveFinancialBase({
                        item,
                        discount: discountAmount,
                        paidAmount: comanda.status === 'paid'
                            ? toNumber(comanda.paid_amount ?? comanda.amount_paid ?? comanda.total)
                            : 0,
                        quantity,
                    });
                    const receivedValue = financialBase.receivedValue;
                    const zeroReason = financialBase.zeroReason;

                    const commissionBase = participant.payout_type === 'fixed'
                        ? toNumber(participant.payout_value)
                        : receivedValue * Number(participationRate || 0);
                    const commissionRate = getEffectiveCommissionRate(staff);
                    const commissionValue = commissionBase * commissionRate;
                    const sharedValue = isShared ? commissionBase : 0;

                    return [{
                        id: `${item.id}:${staffId}:${participant.role || 'primary'}`,
                        comandaId: comanda.id,
                        comandaItemId: item.id,
                        createdAt: productionDate,
                        clientName,
                        serviceName: item.product_name || 'Serviço',
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
                        paymentStatus: getCommissionPaymentLabel(comanda.status),
                        commissionStatus: commissionStatusLabels[getCommissionStatus(comanda.status)],
                        paymentMethod: getPaymentMethodLabel(comanda),
                        dateSource,
                        discountAmount,
                        zeroReason,
                        audit: {
                            comanda_id: comanda.id,
                            client_name: clientName,
                            comanda_status: comanda.status,
                            payment_status: getCommissionPaymentLabel(comanda.status),
                            payment_method: getPaymentMethodLabel(comanda),
                            comanda_total: toNumber(comanda.total),
                            comanda_paid_amount: comanda.status === 'paid'
                                ? nullableNumber(comanda.paid_amount ?? comanda.amount_paid ?? comanda.total)
                                : '',
                            comanda_item_id: item.id,
                            service_id: item.service_id || '',
                            service_name: item.product_name || 'Serviço',
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
                            credit_applied_detected: creditAppliedDetected ? 'Sim' : 'Não',
                            payout_type: payoutType,
                            payout_value: payoutValue == null ? '' : payoutValue,
                            payout_value_normalizado: payoutValueNormalized == null ? '' : payoutValueNormalized,
                            valor_servico: itemValue,
                            valor_compartilhado: sharedValue,
                            base_participante: commissionBase,
                            commission_rate: nullableNumber(staff?.commission_rate),
                            commission_rate_normalizado: commissionRate,
                            participants_count: participantsForCommission.length,
                            participants_staff_ids: participantStaffIds.join(' / '),
                            is_shared_real: isShared ? 'Sim' : 'Não',
                            commission_value: commissionValue,
                        },
                    }];
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
            setCommissionLines([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setLoadError(null);
        try {
            const lines = await loadCommissionLines();
            setCommissionLines(lines);
        } catch (error) {
            console.error('Erro ao carregar comissões:', error);
            setCommissionLines([]);
            setLoadError('Não foi possível carregar as comissões. Nenhum dado financeiro foi alterado.');
            setToast({ message: 'Erro ao carregar dados de comissões.', type: 'error' });
        } finally {
            setLoading(false);
        }
    }, [endDate, loadCommissionLines, startDate, tenantId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const professionalOptions = useMemo(() => groupCommissionRows(commissionLines), [commissionLines, groupCommissionRows]);
    const filteredLines = useMemo(() => {
        const normalizedSearch = normalizeSearchText(searchTerm);
        return commissionLines.filter((line) => {
            if (professionalFilter !== 'all' && line.professionalId !== professionalFilter) return false;
            if (commissionTypeFilter === 'solo' && line.isShared) return false;
            if (commissionTypeFilter === 'shared' && !line.isShared) return false;
            if (statusFilter !== 'all' && getLineStatusBucket(line) !== statusFilter) return false;

            if (!normalizedSearch) return true;
            const searchable = [
                line.professionalName,
                line.professionalRole,
                line.clientName,
                line.serviceName,
                line.participantNames,
                line.comandaId,
                getShortComandaRef(line.comandaId),
                line.paymentMethod,
                line.commissionStatus,
            ].map(normalizeSearchText).join(' ');
            return searchable.includes(normalizedSearch);
        });
    }, [commissionLines, commissionTypeFilter, professionalFilter, searchTerm, statusFilter]);
    const filteredRows = useMemo(() => groupCommissionRows(filteredLines), [filteredLines, groupCommissionRows]);

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
    const sharedServicesCount = filteredLines.filter((line) => line.isShared).length;
    const legacyDateCount = filteredLines.filter((line) => line.dateSource !== 'appointment_start').length;
    const discountInfoCount = filteredLines.filter((line) => line.discountAmount > 0).length;
    const hasActiveFilters = Boolean(searchTerm.trim()) ||
        professionalFilter !== 'all' ||
        commissionTypeFilter !== 'all' ||
        statusFilter !== 'all';

    const exportCommissions = async () => {
        if (!tenantId || !startDate || !endDate) {
            setToast({ message: 'Informe um período válido para exportar comissões.', type: 'error' });
            return;
        }

        try {
            const lines = filteredLines;
            if (lines.length === 0) {
                setToast({ message: 'Nenhuma comissão visível para exportar com os filtros atuais.', type: 'info' });
                return;
            }
            const headers = [
                'Data',
                'Origem da data',
                'Cliente',
                'Comanda',
                'Serviço',
                'Valor do serviço',
                'Desconto informativo',
                'Valor compartilhado',
                'Profissional',
                'Tipo de participação',
                'Percentual de participação',
                'Valor base da comissão',
                'Divisão lançada',
                'Base por participante',
                'Percentual de comissão',
                'Valor da comissão',
                'Tipo',
                'Participantes do serviço',
                'Status da comanda',
                'Status de pagamento',
                'Status da comissão',
                'Forma de pagamento',
            ];

            const rowsForExport = lines.map((line) => [
                escapeCSV(new Date(line.createdAt).toLocaleDateString('pt-BR')),
                escapeCSV(getProductionDateSourceLabel(line.dateSource)),
                escapeCSV(normalizeClientName(line.clientName)),
                escapeCSV(getShortComandaRef(line.comandaId)),
                escapeCSV(line.serviceName),
                formatMoneyForExport(line.itemValue),
                formatMoneyForExport(line.discountAmount),
                line.isShared ? formatMoneyForExport(line.sharedValue) : '-',
                escapeCSV(line.professionalName),
                escapeCSV(line.participationRole),
                escapeCSV(line.participationRate == null ? '' : `${(line.participationRate * 100).toFixed(2).replace('.', ',')}%`),
                formatMoneyForExport(line.commissionBase),
                escapeCSV(line.divisionLaunched),
                escapeCSV(line.baseByParticipant),
                escapeCSV(`${(line.commissionRate * 100).toFixed(2).replace('.', ',')}%`),
                formatMoneyForExport(line.commissionValue),
                escapeCSV(line.isShared ? 'Compartilhado' : 'Solo'),
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
            setToast({ message: 'Relatório de comissões exportado com a lista filtrada visível.', type: 'success' });
        } catch (error) {
            console.error('Erro ao exportar comissões:', error);
            setToast({ message: 'Erro ao exportar relatório de comissões. Nenhum dado financeiro foi alterado.', type: 'error' });
        }
    };

    const exportCommissionAudit = async () => {
        if (!tenantId || !startDate || !endDate) {
            setToast({ message: 'Informe um período válido para auditar comissões.', type: 'error' });
            return;
        }

        try {
            const lines = filteredLines;
            if (lines.length === 0) {
                setToast({ message: 'Nenhuma comissão visível para auditar com os filtros atuais.', type: 'info' });
                return;
            }
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
            setToast({ message: 'Auditoria de comissões exportada com a lista filtrada visível.', type: 'success' });
        } catch (error) {
            console.error('Erro ao exportar auditoria de comissões:', error);
            setToast({ message: 'Erro ao exportar auditoria de comissões. Nenhum dado financeiro foi alterado.', type: 'error' });
        }
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Comissões</h2>
                    <p className="text-slate-500 mt-1">Acompanhe a produção variável por profissional e o valor previsto para repasse.</p>
                </div>
                <div className="flex gap-2">
                    <AuditAdjustmentButton
                        context={{
                            sourceType: 'commission',
                            sourceLabel: 'Relatório de Comissões',
                            beforeSnapshot: {
                                profissionais: filteredRows.length,
                                comissao_confirmada: confirmedCommission,
                                comissao_pendente: pendingCommission,
                                comissao_cancelada: cancelledCommission,
                                periodo_inicio: startDate,
                                periodo_fim: endDate,
                            },
                            financialImpactLabel: 'Impacto potencial em repasse de comissão',
                            allowedAdjustmentTypes: [
                                'commission_correction',
                                'service_participation_correction',
                                'mark_for_review',
                            ],
                        }}
                        defaultAdjustmentType="commission_correction"
                    />
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

            {loadError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-500/10 dark:border-rose-500/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-black text-rose-700 dark:text-rose-200">Falha ao carregar comissões</p>
                        <p className="text-sm text-rose-600 dark:text-rose-200/80">{loadError}</p>
                    </div>
                    <Button variant="secondary" leftIcon="refresh" onClick={fetchData}>
                        Tentar novamente
                    </Button>
                </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 p-4">
                <p className="text-sm font-black text-amber-800 dark:text-amber-200">Regra auditada nesta fase</p>
                <p className="text-sm text-amber-700 dark:text-amber-100/80 mt-1">
                    Barber pode receber comissão. Manager e Receptionist não recebem comissão. Descontos aparecem apenas como informação visual e não reduzem a comissão automaticamente nesta fase.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissão confirmada</p>
                    <h3 className="text-2xl font-black text-emerald-500">
                        {confirmedCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissão pendente</p>
                    <h3 className="text-2xl font-black text-amber-500">
                        {pendingCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Comissão cancelada</p>
                    <h3 className="text-2xl font-black text-rose-500">
                        {cancelledCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h3>
                </div>
                <div className="bg-white dark:bg-card-dark p-5 rounded-xl border border-slate-200 dark:border-border-dark shadow-sm">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Vendas válidas</p>
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
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Busca</label>
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Cliente, serviço, profissional ou comanda..."
                            className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                        />
                    </div>
                </div>
                <div className="min-w-[180px]">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Profissional</label>
                    <select
                        value={professionalFilter}
                        onChange={(event) => setProfessionalFilter(event.target.value)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                        <option value="all">Todos</option>
                        {professionalOptions.map((row) => (
                            <option key={row.id} value={row.id}>{row.professionalName}</option>
                        ))}
                    </select>
                </div>
                <div className="min-w-[160px]">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Tipo</label>
                    <select
                        value={commissionTypeFilter}
                        onChange={(event) => setCommissionTypeFilter(event.target.value as CommissionTypeFilter)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                        <option value="all">Solo e compartilhado</option>
                        <option value="solo">Solo</option>
                        <option value="shared">Compartilhado</option>
                    </select>
                </div>
                <div className="min-w-[150px]">
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Status</label>
                    <select
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value as CommissionStatusFilter)}
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                    >
                        <option value="all">Todos</option>
                        <option value="confirmed">Confirmada</option>
                        <option value="pending">Pendente</option>
                        <option value="cancelled">Cancelada</option>
                    </select>
                </div>
                <div className="w-full md:w-72 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark px-4 py-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Destaque do período</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">
                        {topPerformer ? topPerformer.professionalName : 'Sem dados'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                        {topPerformer
                            ? `${topPerformer.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em comissão prevista`
                            : 'Nenhuma comissão encontrada no período.'}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 font-bold">
                    {filteredLines.length} lançamentos visíveis
                </span>
                <span className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-200 font-bold">
                    {sharedServicesCount} compartilhados
                </span>
                <span className="px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200 font-bold">
                    {totalServices} serviços
                </span>
                <span className="px-3 py-1.5 rounded-full bg-violet-100 dark:bg-violet-500/10 text-violet-700 dark:text-violet-200 font-bold">
                    Taxa média {averageRate.toFixed(1)}%
                </span>
                {legacyDateCount > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold">
                        {legacyDateCount} com dados legados
                    </span>
                )}
                {discountInfoCount > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-200 font-bold">
                        {discountInfoCount} com desconto informativo
                    </span>
                )}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => {
                            setSearchTerm('');
                            setProfessionalFilter('all');
                            setCommissionTypeFilter('all');
                            setStatusFilter('all');
                        }}
                        className="px-3 py-1.5 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold"
                    >
                        Limpar filtros
                    </button>
                )}
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
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Vendas válidas</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Confirmada</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Pendente</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Cancelada</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest">Último lançamento</th>
                                <th className="px-6 py-4 text-[11px] font-black text-slate-500 uppercase tracking-widest text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                        <div className="animate-spin size-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">Carregando comissões...</p>
                                        <p className="text-xs text-slate-500 mt-1">Buscando produção, participantes e comandas do período selecionado.</p>
                                    </td>
                                </tr>
                            ) : filteredRows.length === 0 ? (
                                <tr>
                                    <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                                        <p className="font-bold text-slate-700 dark:text-slate-200">
                                            {hasActiveFilters ? 'Nenhuma comissão encontrada com os filtros atuais.' : 'Nenhum profissional com comissão neste período.'}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                            A tela não altera comissão. Ajuste período/filtros ou revise a origem dos atendimentos e comandas.
                                        </p>
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
                                                    <p className="text-xs text-slate-500">{row.items.length} lançamentos vinculados</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                                            <div className="font-semibold">{row.role}</div>
                                            <div className="text-xs text-emerald-600 dark:text-emerald-300">Comissionável</div>
                                        </td>
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
                title={selectedRow ? `Detalhes de comissão - ${selectedRow.professionalName}` : 'Detalhes de comissão'}
                maxWidth="xl"
            >
                {selectedRow && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 dark:border-border-dark bg-slate-50 dark:bg-white/5 p-4">
                            <p className="text-sm font-black text-slate-900 dark:text-white">Auditoria visual</p>
                            <p className="text-sm text-slate-500 mt-1">
                                Este detalhe mostra a base já calculada pela regra atual. Descontos e datas legadas são informativos nesta fase.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Taxa aplicada</p>
                                <p className="text-xl font-black text-primary mt-1">{selectedRow.commissionRate.toFixed(1)}%</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Vendas válidas</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                                    {selectedRow.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 dark:border-border-dark p-4">
                                <p className="text-xs font-bold uppercase text-slate-500">Comissão prevista</p>
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
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Serviço</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Qtd</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Valor vendido</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Divisão/Regra</th>
                                            <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Comissão</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                        {selectedRow.items.map((item) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    <div>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</div>
                                                    <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        item.dateSource === 'appointment_start'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                            : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                                                    }`}>
                                                        {getProductionDateSourceLabel(item.dateSource)}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{normalizeClientName(item.clientName)}</td>
                                                <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                                                    <div>{item.serviceName}</div>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                            item.isShared
                                                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                        }`}>
                                                            {item.isShared ? 'Compartilhado' : 'Solo'}
                                                        </span>
                                                        {item.discountAmount > 0 && (
                                                            <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-200">
                                                                Desconto informativo
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.isShared && item.participantNames && (
                                                        <div className="text-xs text-amber-600 dark:text-amber-300 mt-1">Participantes: {item.participantNames}</div>
                                                    )}
                                                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Comanda {getShortComandaRef(item.comandaId)}</div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    {item.itemValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                                    <div>{item.isShared ? item.divisionLaunched : 'Solo 100%'}</div>
                                                    {item.isShared && (
                                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                                            Compartilhado: {item.sharedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        </div>
                                                    )}
                                                    {item.discountAmount > 0 && (
                                                        <div className="text-xs text-orange-600 dark:text-orange-300">
                                                            Desconto da comanda: {item.discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (não altera comissão aqui)
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
