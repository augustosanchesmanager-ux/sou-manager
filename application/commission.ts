/**
 * [SMG][APPLICATION][COMMISSION] CommissionApplicationService
 *
 * RESPONSABILIDADE: Orquestra o carregamento, cálculo e exportação de comissões.
 *   - Carrega linhas de comissão (4-fases: staff → comandas → itens → participants)
 *   - Agrupa por profissional
 *   - Calcula estatísticas resumo
 *   - Exporta para CSV
 *
 * NÃO FAZ:
 *   - Renderização de UI (pertence a Commissions.tsx)
 *   - Chamadas diretas ao Supabase (usa repositórios)
 *   - Gerenciamento de estado React (pertence ao componente)
 *
 * DEPENDÊNCIAS: domain/commission/, shared/
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas de dados
 *   - Zero conhecimento de React, UI, navigate, toast
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import { normalizePercentage } from '../shared/numbers/normalize';
import { receivesCommission, getEffectiveCommissionRate } from '../src/lib/staff/roles';
import {
    getCommissionStatus,
    getCommissionPaymentLabel,
} from '../shared/status/commission';
import {
    resolveCommissionBase,
    resolveFinancialBase,
    calculateCommissionValue,
} from '../domain/commission/calculate';
import type { ZeroCommissionReason } from '../domain/commission/types';
import {
    normalizeCommissionParticipants,
} from '../domain/commission/participants';
import { getPaymentMethodLabel, isServiceItem } from '../domain/comanda/labels';
import { staffRepository } from '../domain/staff/repository';
import { comandaRepository } from '../domain/comanda/repository';
import { appointmentRepository } from '../domain/appointment/repository';
import { comandaItemRepository } from '../domain/comanda/item-repository';
import { clientRepository } from '../domain/client/repository';
import { serviceExecutionParticipantRepository } from '../domain/comanda/participant-repository';

const getParticipantStaffId = (participant: ParticipantRow): string | null =>
    participant.staff_id || participant.professional_id;

// ─── Types ───────────────────────────────────────────────────────

export interface CommissionLineParams {
    tenantId: string;
    startDate: string;
    endDate: string;
}

export interface StaffMember {
    id: string;
    name: string;
    role?: string;
    avatar?: string;
    commission_rate?: number | null;
}

export interface ComandaRow {
    id: string;
    client_id?: string;
    appointment_id?: string;
    staff_id?: string;
    status: string;
    total?: number;
    discount?: number;
    paid_amount?: number | null;
    amount_paid?: number | null;
    payment_method?: string;
    closure_mode?: string;
    financial_effect?: boolean;
    membership_credit_effect?: boolean;
    created_at?: string;
    closed_at?: string;
    hidden_from_financial?: boolean;
}

export interface AppointmentRow {
    id: string;
    start_time: string;
}

export interface ServiceItem {
    id: string;
    comanda_id: string;
    service_id?: string;
    product_name?: string;
    item_type?: string;
    type?: string;
    staff_id?: string;
    unit_price?: number;
    price?: number;
    amount?: number;
    quantity?: number;
    discount?: number;
}

export interface ParticipantRow {
    id: string;
    comanda_item_id: string;
    staff_id: string | null;
    professional_id?: string | null;
    role: string;
    payout_type: string;
    payout_value: number;
    affects_commission: boolean;
}

export interface CommissionLine {
    id: string;
    comandaId: string;
    comandaItemId: string;
    createdAt: string;
    clientName: string;
    serviceName: string;
    quantity: number;
    itemValue: number;
    commissionBase: number;
    commissionRate: number;
    commissionValue: number;
    sharedValue: number;
    isShared: boolean;
    participantNames: string;
    comandaStatus: string;
    paymentStatus: string;
    commissionStatus: string;
    paymentMethod: string;
    professionalId: string;
    professionalName: string;
    professionalRole: string;
    professionalAvatar: string;
    participationRole: string;
    discountAmount: number;
    zeroReason: ZeroCommissionReason | null;
}

export interface CommissionRow {
    id: string;
    staffId: string;
    staffName: string;
    staffRole: string;
    staffAvatar: string;
    commissionRate: number;
    confirmedSales: number;
    confirmedCommission: number;
    pendingSales: number;
    pendingCommission: number;
    cancelledSales: number;
    cancelledCommission: number;
    grossSales: number;
    totalCommission: number;
    lines: CommissionLine[];
}

export interface CommissionSummary {
    totalCommissions: number;
    totalSales: number;
    averageRate: number;
    topPerformer: CommissionRow | null;
    confirmedCount: number;
    pendingCount: number;
    cancelledCount: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

const toNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

const normalizeClientName = (name: string | null | undefined): string => {
    if (!name) return 'Cliente não identificado';
    return name.trim() || 'Cliente não identificado';
};

const getComandaItemValue = (item: ServiceItem): number => {
    return toNumber(item.unit_price) || toNumber(item.price) || toNumber(item.amount) || 0;
};

const getQuantity = (item: ServiceItem): number => {
    return toNumber(item.quantity) || 1;
};

const getProductionDate = (comanda: ComandaRow, appointmentById: Record<string, AppointmentRow>): string => {
    if (comanda.appointment_id && appointmentById[comanda.appointment_id]) {
        return appointmentById[comanda.appointment_id].start_time;
    }
    return comanda.closed_at || comanda.created_at || '';
};

const getProductionDateSource = (comanda: ComandaRow, appointmentById: Record<string, AppointmentRow>): string => {
    if (comanda.appointment_id && appointmentById[comanda.appointment_id]) return 'appointment_start';
    if (comanda.closed_at) return 'comanda_closed_at';
    return 'comanda_created_at';
};

const formatParticipationRole = (role: string): string => {
    switch (role) {
        case 'primary': return 'Principal';
        case 'assistant': return 'Assistente';
        case 'co_executor': return 'Co-executor';
        default: return role || 'Principal';
    }
};

const commissionStatusLabels: Record<string, string> = {
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
};

// ─── Service ─────────────────────────────────────────────────────

class CommissionApplicationServiceImpl {

    /**
     * Carrega linhas de comissão para o período especificado.
     * Pipeline de 4 fases: staff → comandas → itens → participants.
     */
    async loadCommissionLines(params: CommissionLineParams): Promise<CommissionLine[]> {
        const { tenantId, startDate, endDate } = params;
        if (!tenantId || !startDate || !endDate) return [];

        const startOfRange = new Date(startDate);
        startOfRange.setHours(0, 0, 0, 0);
        const endOfRange = new Date(endDate);
        endOfRange.setHours(23, 59, 59, 999);

        // Phase 1: Parallel fetch staff + comandas
        const [staffList, comandas] = await Promise.all([
            staffRepository.listForCommission(tenantId) as Promise<StaffMember[]>,
            comandaRepository.listForCommission(tenantId, {
                statuses: ['open', 'paid', 'blocked', 'cancelled'],
                excludeHidden: true,
            }) as unknown as Promise<ComandaRow[]>,
        ]);

        const staffById: Record<string, StaffMember> = {};
        staffList.forEach(s => { staffById[s.id] = s; });

        // Fetch appointments
        const appointmentIds = Array.from(
            new Set(comandas.map(c => c.appointment_id).filter((id): id is string => Boolean(id)))
        );

        const appointments = appointmentIds.length > 0
            ? await appointmentRepository.listByIds(appointmentIds, tenantId)
            : [];

        const appointmentById: Record<string, AppointmentRow> = {};
        (appointments || []).forEach(a => { appointmentById[a.id] = a; });

        // Phase 2: Date-range filtering
        const comandasInProductionRange = comandas.filter(comanda => {
            const productionDate = new Date(getProductionDate(comanda, appointmentById));
            if (Number.isNaN(productionDate.getTime())) return false;
            return productionDate >= startOfRange && productionDate <= endOfRange;
        });

        const comandaIds = comandasInProductionRange.map(c => c.id);
        const clientIds = Array.from(
            new Set(comandasInProductionRange.map(c => c.client_id).filter((id): id is string => Boolean(id)))
        );

        // Phase 3: Dependent fetch items + clients + participants
        const [rawServiceItems, clientNameMap] = await Promise.all([
            comandaIds.length > 0
                ? comandaItemRepository.listForCommission(comandaIds, tenantId)
                : Promise.resolve([] as any[]),
            clientIds.length > 0
                ? clientRepository.getNameMap(clientIds, tenantId)
                : Promise.resolve({} as Record<string, string>),
        ]);

        // Deduplicate service items
        const serviceItems = Array.from(
            (rawServiceItems as any[]).filter(isServiceItem).reduce((acc, item) => {
                if (item.id && !acc.has(item.id)) acc.set(item.id, item);
                return acc;
            }, new Map<string, any>()).values(),
        ) as ServiceItem[];

        const itemIds = serviceItems.map(item => item.id).filter(Boolean);

        const participants = itemIds.length > 0
            ? await serviceExecutionParticipantRepository.listByComandaItemIds(itemIds, tenantId)
            : [];

        // Build lookup maps
        const comandaById: Record<string, ComandaRow> = {};
        comandasInProductionRange.forEach(c => { comandaById[c.id] = c; });

        const participantsByItem: Record<string, ParticipantRow[]> = {};
        (participants || []).forEach(p => {
            if (!participantsByItem[p.comanda_item_id]) participantsByItem[p.comanda_item_id] = [];
            participantsByItem[p.comanda_item_id].push(p as ParticipantRow);
        });

        // Phase 4: Build commission lines
        return serviceItems.flatMap((item): CommissionLine[] => {
            const comanda = comandaById[item.comanda_id];
            if (!comanda) return [];

            const itemValue = getComandaItemValue(item);
            const quantity = getQuantity(item);
            const normalizedParticipants = normalizeCommissionParticipants(
                { id: item.id, staff_id: item.staff_id },
                comanda as any,
                participantsByItem[item.id] || [],
                itemValue,
                staffById as any,
            );

            const isShared = normalizedParticipants.isShared;
            const participantsForCommission = normalizedParticipants.participants;
            const sharedStaffIds = [...new Set(
                participantsForCommission
                    .filter(p => p.affects_commission)
                    .map(p => getParticipantStaffId(p))
                    .filter((id): id is string => id !== null),
            )];
            const productionDate = getProductionDate(comanda, appointmentById);

            const sharedParticipantNamesByStaffId: Record<string, string> = {};
            sharedStaffIds.forEach(staffId => {
                sharedParticipantNamesByStaffId[staffId] = staffById[staffId]?.name || staffId;
            });

            return participantsForCommission
                .filter(participant => getParticipantStaffId(participant))
                .flatMap((participant): CommissionLine[] => {
                    const staffId = getParticipantStaffId(participant);
                    const staff = staffById[staffId];
                    if (!receivesCommission(staff)) return [];

                    const participationRate = participant.payout_type === 'percentage'
                        ? normalizePercentage(participant.payout_value)
                        : null;

                    const clientName = normalizeClientName(
                        comanda.client_id ? clientNameMap[comanda.client_id] : null
                    );

                    const discountAmount = toNumber(item.discount ?? comanda.discount);

                    const financialBase = resolveFinancialBase({
                        item: item as unknown as Record<string, unknown>,
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

                    const participantNames = isShared
                        ? Object.entries(sharedParticipantNamesByStaffId)
                            .filter(([id]) => id !== staffId)
                            .map(([, name]) => name)
                            .filter(Boolean)
                            .join(' / ')
                        : '';

                    return [{
                        id: `${item.id}:${staffId}:${participant.role || 'primary'}`,
                        comandaId: comanda.id,
                        comandaItemId: item.id,
                        createdAt: productionDate,
                        clientName,
                        serviceName: item.product_name || 'Serviço',
                        quantity,
                        itemValue,
                        commissionBase,
                        commissionRate,
                        commissionValue,
                        sharedValue,
                        isShared,
                        participantNames,
                        comandaStatus: comanda.status,
                        paymentStatus: getCommissionPaymentLabel(comanda.status),
                        commissionStatus: commissionStatusLabels[getCommissionStatus(comanda.status)] || getCommissionStatus(comanda.status),
                        paymentMethod: getPaymentMethodLabel(comanda),
                        professionalId: staffId,
                        professionalName: staff?.name || staffId || 'Profissional',
                        professionalRole: staff?.role || 'Profissional',
                        professionalAvatar: staff?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(staff?.name || 'Profissional')}`,
                        participationRole: formatParticipationRole(participant.role),
                        discountAmount,
                        zeroReason,
                    }];
                });
        });
    }

    /**
     * Agrupa linhas de comissão por profissional.
     */
    groupByProfessional(lines: CommissionLine[]): CommissionRow[] {
        const rowsByStaff = new Map<string, CommissionRow>();

        for (const line of lines) {
            const key = line.professionalId;

            if (!rowsByStaff.has(key)) {
                rowsByStaff.set(key, {
                    id: key,
                    staffId: key,
                    staffName: line.professionalName,
                    staffRole: line.professionalRole,
                    staffAvatar: line.professionalAvatar,
                    commissionRate: line.commissionRate,
                    confirmedSales: 0,
                    confirmedCommission: 0,
                    pendingSales: 0,
                    pendingCommission: 0,
                    cancelledSales: 0,
                    cancelledCommission: 0,
                    grossSales: 0,
                    totalCommission: 0,
                    lines: [],
                });
            }

            const row = rowsByStaff.get(key)!;
            row.lines.push(line);

            // Determine status bucket
            if (line.comandaStatus === 'paid') {
                row.confirmedSales += line.itemValue;
                row.confirmedCommission += line.commissionValue;
            } else if (line.comandaStatus === 'cancelled') {
                row.cancelledSales += line.itemValue;
                row.cancelledCommission += line.commissionValue;
            } else {
                // open, blocked
                row.pendingSales += line.itemValue;
                row.pendingCommission += line.commissionValue;
            }
        }

        // Calculate derived fields
        const rows = Array.from(rowsByStaff.values());
        for (const row of rows) {
            row.grossSales = row.confirmedSales + row.pendingSales;
            row.totalCommission = row.confirmedCommission + row.pendingCommission;
        }

        // Sort by totalCommission descending
        rows.sort((a, b) => b.totalCommission - a.totalCommission);

        return rows;
    }

    /**
     * Calcula estatísticas resumo a partir das rows agrupadas.
     */
    summarize(rows: CommissionRow[]): CommissionSummary {
        const totalCommissions = rows.reduce((sum, r) => sum + r.totalCommission, 0);
        const totalSales = rows.reduce((sum, r) => sum + r.grossSales, 0);

        const averageRate = rows.length > 0
            ? rows.reduce((sum, r) => sum + r.commissionRate, 0) / rows.length
            : 0;

        const topPerformer = rows.length > 0 ? rows[0] : null;

        const confirmedCount = rows.reduce((sum, r) => sum + r.lines.filter(l => l.comandaStatus === 'paid').length, 0);
        const pendingCount = rows.reduce((sum, r) => sum + r.lines.filter(l => l.comandaStatus !== 'paid' && l.comandaStatus !== 'cancelled').length, 0);
        const cancelledCount = rows.reduce((sum, r) => sum + r.lines.filter(l => l.comandaStatus === 'cancelled').length, 0);

        return {
            totalCommissions,
            totalSales,
            averageRate,
            topPerformer,
            confirmedCount,
            pendingCount,
            cancelledCount,
        };
    }

    /**
     * Exporta linhas de comissão para CSV (22 colunas).
     */
    exportToCsv(lines: CommissionLine[], startDate: string, endDate: string): string {
        if (lines.length === 0) return '';

        const BOM = '\uFEFF';
        const headers = [
            'ID Comanda',
            'Data',
            'Cliente',
            'Serviço',
            'Qtd',
            'Valor Unitário',
            'Valor Item',
            'Profissional',
            'Função',
            'Papel',
            'Base Comissão',
            'Taxa Comissão',
            'Valor Comissão',
            'Valor Compartilhado',
            'Compartilhado',
            'Nomes Participantes',
            'Status Comanda',
            'Status Pagamento',
            'Status Comissão',
            'Forma Pagamento',
            'Tipo',
            'Desconto',
        ];

        const rows = lines.map(line => [
            line.comandaId.slice(0, 8),
            new Date(line.createdAt).toLocaleDateString('pt-BR'),
            line.clientName,
            line.serviceName,
            String(line.quantity),
            line.itemValue.toFixed(2).replace('.', ','),
            line.itemValue.toFixed(2).replace('.', ','),
            line.professionalName,
            line.professionalRole,
            line.participationRole,
            line.commissionBase.toFixed(2).replace('.', ','),
            (line.commissionRate * 100).toFixed(1).replace('.', ',') + '%',
            line.commissionValue.toFixed(2).replace('.', ','),
            line.isShared ? line.sharedValue.toFixed(2).replace('.', ',') : '-',
            line.isShared ? 'Compartilhado' : 'Solo',
            line.isShared ? line.participantNames : '-',
            line.comandaStatus,
            line.paymentStatus,
            line.commissionStatus,
            line.paymentMethod,
            line.comandaStatus === 'paid' ? 'Confirmado' : line.comandaStatus === 'cancelled' ? 'Cancelado' : 'Pendente',
            line.discountAmount > 0 ? line.discountAmount.toFixed(2).replace('.', ',') : '-',
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(';'))
            .join('\n');

        return BOM + csvContent;
    }

    /**
     * Dispara download do CSV.
     */
    downloadCsv(csvContent: string, filename: string): void {
        if (!csvContent) return;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

export const commissionApplicationService = new CommissionApplicationServiceImpl();
