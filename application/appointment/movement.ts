/**
 * [SMG][APPLICATION][APPOINTMENT] movement
 *
 * Operações de movimentação: reschedule, changeStatus, checkTimeConflict.
 */

import { appointmentRepository } from '../../domain/appointment/repository';
import { comandaRepository } from '../../domain/comanda/repository';
import type {
    RescheduleAppointmentParams,
    ChangeStatusParams,
    ComandaSyncResult,
} from './types';
import { AppointmentError } from './types';
import { syncComandaForAppointmentUpdate } from './comandaSync';

export async function changeStatus(params: ChangeStatusParams): Promise<void> {
    const { tenantId, appointmentId, newStatus } = params;

    if (!appointmentId) {
        throw new AppointmentError('ID do agendamento é obrigatório.', 'VALIDATION_ERROR');
    }

    const appointment = await appointmentRepository.get(appointmentId, tenantId);
    if (!appointment) {
        throw new AppointmentError('Agendamento não encontrado.', 'NOT_FOUND');
    }

    if (appointment.status === 'cancelled' || appointment.status === 'no_show') {
        throw new AppointmentError(
            `Não é possível alterar status de um agendamento ${appointment.status}.`,
            'INVALID_TRANSITION',
        );
    }

    await appointmentRepository.updateStatus(appointmentId, newStatus, tenantId);
}

export async function rescheduleAppointment(params: RescheduleAppointmentParams): Promise<ComandaSyncResult> {
    const { tenantId, appointmentId, newStaffId, newStaffName, newStartTime, newEndTime } = params;

    if (!appointmentId) {
        throw new AppointmentError('ID do agendamento é obrigatório.', 'VALIDATION_ERROR');
    }

    let previous = null;
    try {
        previous = (await appointmentRepository.get(appointmentId, tenantId)) ?? null;
    } catch {
        previous = null;
    }

    let comandas: Awaited<ReturnType<typeof comandaRepository.list>> = [];
    try {
        comandas = (await comandaRepository.list(tenantId, { appointmentId })) || [];
    } catch (err) {
        console.warn('[SMG][APPOINTMENT][RESCHEDULE] Falha ao listar comandas vinculadas:', {
            appointmentId,
            error: err,
        });
    }

    const paidComanda = comandas.find((c) => c.status === 'paid');
    const isChangingStaff = !previous || previous.staff_id !== newStaffId;
    if (paidComanda && isChangingStaff) {
        return {
            status: 'blocked_closed',
            comandaId: paidComanda.id,
            message: 'Comanda vinculada já foi liquidada. Ajustes de serviço, valor ou profissional pós-pagamento devem ser feitos no módulo de Comandas/Caixa.',
        };
    }

    await appointmentRepository.update(appointmentId, {
        staff_id: newStaffId,
        staff_name: newStaffName,
        start_time: newStartTime,
        end_time: newEndTime,
    }, tenantId);

    try {
        return await syncComandaForAppointmentUpdate({
            tenantId,
            appointmentId,
            staffId: newStaffId,
            startTime: newStartTime,
            previousAppointment: previous,
            comandas,
        });
    } catch (err) {
        console.warn('[SMG][APPOINTMENT][RESCHEDULE] Falha ao sync comanda:', {
            appointmentId,
            error: err,
        });
        return { status: 'no_comanda' };
    }
}

export async function checkTimeConflict(
    tenantId: string,
    staffId: string,
    startTime: string,
    endTime: string,
    excludeAppointmentId?: string,
): Promise<boolean> {
    const appointments = await appointmentRepository.list(tenantId, {
        staffId,
        startTimeFrom: startTime,
        startTimeTo: endTime,
    });

    return appointments.some(
        a => a.id !== excludeAppointmentId &&
             a.status !== 'cancelled' &&
             a.status !== 'no_show',
    );
}
