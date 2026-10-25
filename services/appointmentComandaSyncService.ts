/**
 * appointmentComandaSyncService.ts
 * Service de infraestrutura para sincronização atômica transacional Agenda ➔ Comanda Aberta via RPC PostgreSQL.
 * Camada de serviço/infraestrutura (isenta de violação de Repository Guard).
 * Frente 13.1 (Item 13.1 do Backlog do SMG)
 */

import { getScopedClient } from './supabaseClient';

export interface ServicePayloadItem {
    serviceId: string;
    price: number;
    duration: number;
    name?: string;
    quantity?: number;
    unitPrice?: number;
    durationMinutes?: number;
}

export interface SyncAppointmentInput {
    tenantId: string;
    appointmentId: string;
    newStaffId: string;
    newStartTime: string; // ISO 8601
    newEndTime: string;   // ISO 8601
    services: ServicePayloadItem[];
    notes?: string;
    syncComanda?: boolean;
}

export interface SyncAppointmentResult {
    success: boolean;
    appointmentId: string;
    comandaId?: string | null;
    comandaUpdated: boolean;
    preservedProductsCount: number;
    newTotal?: number | null;
    appointmentStatus?: string;
}

export type SyncErrorCode =
    | 'APPOINTMENT_NOT_FOUND'
    | 'COMANDA_ALREADY_SETTLED'
    | 'COMANDA_HAS_CLUB_CREDITS'
    | 'INVALID_TENANT'
    | 'UNKNOWN_ERROR';

export class AppointmentComandaSyncError extends Error {
    readonly code: SyncErrorCode;
    readonly rawError?: unknown;

    constructor(code: SyncErrorCode, message: string, rawError?: unknown) {
        super(message);
        this.name = 'AppointmentComandaSyncError';
        this.code = code;
        this.rawError = rawError;
    }
}

export function parseSyncRpcError(error: any): AppointmentComandaSyncError {
    const rawMessage = typeof error === 'string' ? error : error?.message || '';
    const code = error?.code || '';

    if (code === 'P0003' || rawMessage.includes('COMANDA_ALREADY_SETTLED') || rawMessage.includes('ja liquidada') || rawMessage.includes('pagamentos registrados')) {
        return new AppointmentComandaSyncError(
            'COMANDA_ALREADY_SETTLED',
            'Não é possível alterar profissional/serviço: a comanda correspondente já foi fechada, paga ou possui pagamentos registrados.',
            error
        );
    }

    if (code === 'P0004' || rawMessage.includes('COMANDA_HAS_CLUB_CREDITS') || rawMessage.includes('creditos de assinatura')) {
        return new AppointmentComandaSyncError(
            'COMANDA_HAS_CLUB_CREDITS',
            'A comanda vinculada possui créditos de clube ou assinatura aplicados e não pode sofrer alteração direta.',
            error
        );
    }

    if (code === 'P0002' || rawMessage.includes('APPOINTMENT_NOT_FOUND') || rawMessage.includes('Agendamento nao encontrado')) {
        return new AppointmentComandaSyncError(
            'APPOINTMENT_NOT_FOUND',
            'Agendamento não encontrado para este estabelecimento.',
            error
        );
    }

    if (code === 'P0001' || rawMessage.includes('Tenant invalido') || rawMessage.includes('Profissional nao encontrado')) {
        return new AppointmentComandaSyncError(
            'INVALID_TENANT',
            'Dados inválidos ou profissional/tenant não autorizado para esta operação.',
            error
        );
    }

    return new AppointmentComandaSyncError(
        'UNKNOWN_ERROR',
        rawMessage || 'Erro ao sincronizar agendamento com a comanda.',
        error
    );
}

export const appointmentComandaSyncService = {
    /**
     * Sincroniza atomicamente o agendamento e sua comanda vinculada em uma única transação no Postgres.
     * Preserva produtos avulsos de consumo e bloqueia comanda já liquidada ou com créditos de clube.
     */
    async syncAppointmentWithComanda(input: SyncAppointmentInput): Promise<SyncAppointmentResult> {
        const {
            tenantId,
            appointmentId,
            newStaffId,
            newStartTime,
            newEndTime,
            services = [],
            notes,
            syncComanda = true,
        } = input;

        if (!tenantId || !appointmentId || !newStaffId || !newStartTime || !newEndTime) {
            throw new AppointmentComandaSyncError(
                'INVALID_TENANT',
                'Parâmetros obrigatórios ausentes para sincronização do agendamento.'
            );
        }

        const client = getScopedClient('barber');

        const formattedServices = services.map((s) => {
            const rawPrice = s.unitPrice !== undefined ? s.unitPrice : s.price;
            const rawDuration = s.durationMinutes !== undefined ? s.durationMinutes : s.duration;
            return {
                service_id: s.serviceId,
                price: Number(rawPrice) || 0,
                duration: Number(rawDuration) || 30,
                name: s.name || '',
                ...(s.quantity !== undefined ? { quantity: Number(s.quantity) } : {}),
            };
        });

        const rpcPayload = {
            p_tenant_id: tenantId,
            p_appointment_id: appointmentId,
            p_new_staff_id: newStaffId,
            p_new_start_time: newStartTime,
            p_new_end_time: newEndTime,
            p_services: formattedServices,
            p_notes: notes ?? null,
            p_sync_comanda: syncComanda,
        };

        const { data, error } = await client.rpc('sync_comanda_from_appointment', rpcPayload);

        if (error) {
            console.error('[appointmentComandaSyncService] Erro na RPC sync_comanda_from_appointment:', error);
            throw parseSyncRpcError(error);
        }

        const response = (typeof data === 'string' ? JSON.parse(data) : data) as Record<string, unknown> | null;

        if (!response || !response.success) {
            throw new AppointmentComandaSyncError(
                'UNKNOWN_ERROR',
                'Resposta inválida da sincronização atômica.'
            );
        }

        return {
            success: Boolean(response.success),
            appointmentId: (response.appointment_id as string) || appointmentId,
            comandaId: (response.comanda_id as string) || null,
            comandaUpdated: Boolean(response.comanda_updated),
            preservedProductsCount: Number(response.preserved_products_count) || 0,
            newTotal: response.new_total !== null && response.new_total !== undefined ? Number(response.new_total) : null,
            appointmentStatus: (response.appointment_status as string) || undefined,
        };
    },
};
