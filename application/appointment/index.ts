/**
 * [SMG][APPLICATION][APPOINTMENT] AppointmentApplicationService
 *
 * RESPONSABILIDADE: Orquestra o ciclo de vida de agendamentos.
 *   - Criação via RPC (create_appointment_with_comanda / create_appointment_with_services)
 *   - Atualização de dados com sync de comandas
 *   - Cancelamento com cascade para comandas
 *   - Mudança de status com validação
 *   - Reschedule via drag-and-drop
 *   - Resolução de preço final com promoções
 *
 * ESTRUTURA INTERNA:
 *   - types.ts     — interfaces compartilhadas + AppointmentError
 *   - lifecycle.ts — create, update, cancel, resolveFinalPrice
 *   - movement.ts  — reschedule, changeStatus, checkTimeConflict
 *
 * NÃO FAZ:
 *   - Renderização de UI (pertence a Schedule.tsx)
 *   - Gerenciamento de estado React (pertence ao componente)
 *   - Detecção de conflitos de horário (pertence ao componente com UI)
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança AppointmentError em falhas de negócio
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import type {
    CreateAppointmentParams,
    CreateAppointmentResult,
    UpdateAppointmentParams,
    CancelAppointmentParams,
    RescheduleAppointmentParams,
    ChangeStatusParams,
    ResolveFinalPriceParams,
} from './types';
import { AppointmentError } from './types';
import { createAppointment, updateAppointment, cancelAppointment, resolveFinalPrice } from './lifecycle';
import { changeStatus, rescheduleAppointment, checkTimeConflict } from './movement';

// ─── Service ─────────────────────────────────────────────────────

class AppointmentApplicationServiceImpl {
    async createAppointment(params: CreateAppointmentParams): Promise<CreateAppointmentResult> {
        return createAppointment(params);
    }

    async updateAppointment(params: UpdateAppointmentParams): Promise<void> {
        return updateAppointment(params);
    }

    async cancelAppointment(params: CancelAppointmentParams): Promise<void> {
        return cancelAppointment(params);
    }

    async changeStatus(params: ChangeStatusParams): Promise<void> {
        return changeStatus(params);
    }

    async rescheduleAppointment(params: RescheduleAppointmentParams): Promise<void> {
        return rescheduleAppointment(params);
    }

    async checkTimeConflict(
        tenantId: string,
        staffId: string,
        startTime: string,
        endTime: string,
        excludeAppointmentId?: string,
    ): Promise<boolean> {
        return checkTimeConflict(tenantId, staffId, startTime, endTime, excludeAppointmentId);
    }

    async resolveFinalPrice(params: ResolveFinalPriceParams): Promise<number> {
        return resolveFinalPrice(params);
    }
}

export const appointmentApplicationService = new AppointmentApplicationServiceImpl();

// Re-export types for consumers
export type {
    CreateAppointmentParams,
    CreateAppointmentResult,
    UpdateAppointmentParams,
    CancelAppointmentParams,
    RescheduleAppointmentParams,
    ChangeStatusParams,
    ResolveFinalPriceParams,
};
export { AppointmentError };
