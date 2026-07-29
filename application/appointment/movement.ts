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
} from './types';
import { AppointmentError } from './types';

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

export async function rescheduleAppointment(params: RescheduleAppointmentParams): Promise<void> {
    const { tenantId, appointmentId, newStaffId, newStaffName, newStartTime, newEndTime } = params;

    if (!appointmentId) {
        throw new AppointmentError('ID do agendamento é obrigatório.', 'VALIDATION_ERROR');
    }

    await appointmentRepository.update(appointmentId, {
        staff_id: newStaffId,
        staff_name: newStaffName,
        start_time: newStartTime,
        end_time: newEndTime,
    }, tenantId);

    const comandas = await comandaRepository.list(tenantId, {
        appointmentId,
        status: 'open',
    });

    for (const comanda of comandas) {
        try {
            await comandaRepository.update(comanda.id, {
                staff_id: newStaffId,
            }, tenantId);
        } catch (err) {
            console.warn('[SMG][APPOINTMENT][RESCHEDULE] Falha ao sync comanda:', {
                comandaId: comanda.id,
                appointmentId,
                error: err,
            });
        }
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
