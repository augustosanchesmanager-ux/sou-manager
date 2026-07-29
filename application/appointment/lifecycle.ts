/**
 * [SMG][APPLICATION][APPOINTMENT] lifecycle
 *
 * Operações de ciclo de vida: create, update, cancel.
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import { appointmentRepository } from '../../domain/appointment/repository';
import { comandaRepository } from '../../domain/comanda/repository';
import { serviceRepository } from '../../domain/service/repository';
import { createSupabaseClient } from '../../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../../domain/shared/database-client';
import { appEventBus } from '../../domain/events/app-bus';
import { createEvent } from '../../domain/events/types';
import type { AppointmentCreatedEvent, AppointmentCancelledEvent } from '../../domain/events/types';
import type {
    CreateAppointmentParams,
    CreateAppointmentResult,
    UpdateAppointmentParams,
    CancelAppointmentParams,
    ResolveFinalPriceParams,
} from './types';
import { AppointmentError } from './types';

// ─── RPC Client (for appointment creation RPCs) ──────────────────

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('appointments', 'barber');
    }
    return rpcClient;
}

export async function createAppointment(params: CreateAppointmentParams): Promise<CreateAppointmentResult> {
    const {
        tenantId, clientId, clientName, clientPhone, staffId,
        serviceIds, totalPrice,
        startTime, endTime, notes, idempotencyKey, isOverbooked,
    } = params;

    if (!clientName.trim()) {
        throw new AppointmentError('Nome do cliente é obrigatório.', 'VALIDATION_ERROR');
    }
    if (serviceIds.length === 0) {
        throw new AppointmentError('Pelo menos um serviço é obrigatório.', 'VALIDATION_ERROR');
    }

    const isMultiService = serviceIds.length > 1;
    const rpcName = isMultiService
        ? 'create_appointment_with_services'
        : 'create_appointment_with_comanda';

    const rpcParams: Record<string, unknown> = {
        p_tenant_id: tenantId,
        p_client_id: clientId || null,
        p_client_name: clientName.trim(),
        p_client_phone: clientPhone || null,
        p_staff_id: staffId,
        p_start_time: startTime,
        p_notes: notes || null,
        p_idempotency_key: idempotencyKey,
    };

    if (isMultiService) {
        rpcParams.p_services = serviceIds.map((id) => ({ service_id: id }));
    } else {
        rpcParams.p_service_id = serviceIds[0] || null;
        rpcParams.p_price = totalPrice;
        rpcParams.p_is_overbooked = isOverbooked || false;
    }

    const { data, error } = await getRpcClient().rpc(rpcName, rpcParams);

    if (error) {
        console.error('[SMG][APPOINTMENT][CREATE] RPC failed:', error);
        throw new AppointmentError(
            `Falha ao criar agendamento: ${error.message}`,
            'RPC_ERROR',
            error,
        );
    }

    const result = data as any;

    const appointmentId = result?.appointment_id || result?.id || '';
    const comandaId = result?.comanda_id || null;

    // Publish domain event
    await appEventBus.publish(createEvent<AppointmentCreatedEvent>({
        eventType: 'AppointmentCreated',
        aggregateId: appointmentId,
        aggregateType: 'appointment',
        payload: {
            appointmentId,
            clientId: clientId || undefined,
            staffId,
            serviceIds,
            startTime,
            endTime,
            price: totalPrice,
            hasComanda: Boolean(comandaId),
            comandaId: comandaId || undefined,
        },
        metadata: {
            tenantId,
            correlationId: idempotencyKey,
            source: 'AppointmentApplicationService',
        },
    }));

    return {
        appointmentId,
        comandaId,
        totalPrice: result?.total_price || totalPrice,
    };
}

export async function updateAppointment(params: UpdateAppointmentParams): Promise<void> {
    const { tenantId, appointmentId, updates, syncComandaStaff } = params;

    if (!appointmentId) {
        throw new AppointmentError('ID do agendamento é obrigatório.', 'VALIDATION_ERROR');
    }

    await appointmentRepository.update(appointmentId, updates, tenantId);

    if (syncComandaStaff && updates.staff_id) {
        const comandas = await comandaRepository.list(tenantId, {
            appointmentId,
            status: 'open',
        });

        for (const comanda of comandas) {
            try {
                await comandaRepository.update(comanda.id, {
                    staff_id: updates.staff_id,
                }, tenantId);
            } catch (err) {
                console.warn('[SMG][APPOINTMENT][UPDATE] Falha ao sync comanda:', {
                    comandaId: comanda.id,
                    appointmentId,
                    error: err,
                });
            }
        }
    }
}

export async function resolveFinalPrice(params: ResolveFinalPriceParams): Promise<number> {
    const { tenantId, serviceId, basePrice, promotions } = params;

    const servicePrice = await serviceRepository.getPrice(serviceId);
    let finalPrice = servicePrice || basePrice || 0;

    const promo = promotions.find(p =>
        (p.target_type === 'all') ||
        (p.target_type === 'service' && p.target_id === serviceId)
    );

    if (promo) {
        if (promo.discount_type === 'fixed') {
            finalPrice = Math.max(0, finalPrice - promo.discount_value);
        } else {
            finalPrice = finalPrice * (1 - (promo.discount_value / 100));
        }
    }

    return finalPrice;
}

export async function cancelAppointment(params: CancelAppointmentParams): Promise<void> {
    const { tenantId, appointmentId, cancellationType, cancellationReason, userId } = params;

    if (!appointmentId) {
        throw new AppointmentError('ID do agendamento é obrigatório.', 'VALIDATION_ERROR');
    }

    const status = cancellationType === 'no_show' ? 'no_show' : 'cancelled';
    const hiddenFromSchedule = cancellationType === 'registration_error' || cancellationType === 'test';

    await appointmentRepository.cancel(appointmentId, {
        status,
        cancellation_reason: cancellationReason || null,
        cancellation_type: cancellationType,
        hidden_from_schedule: hiddenFromSchedule,
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: userId,
    }, tenantId);

    const comandas = await comandaRepository.list(tenantId, {
        appointmentId,
        status: 'open',
    });

    for (const comanda of comandas) {
        try {
            await comandaRepository.update(comanda.id, {
                status: 'cancelled',
            }, tenantId);
        } catch (err) {
            console.warn('[SMG][APPOINTMENT][CANCEL] Falha ao cancelar comanda vinculada:', {
                comandaId: comanda.id,
                appointmentId,
                error: err,
            });
        }
    }

    // Publish domain event
    await appEventBus.publish(createEvent<AppointmentCancelledEvent>({
        eventType: 'AppointmentCancelled',
        aggregateId: appointmentId,
        aggregateType: 'appointment',
        payload: {
            appointmentId,
            staffId: '',
            cancelledBy: userId,
            reason: cancellationReason,
            hadComanda: comandas.length > 0,
            comandaId: comandas[0]?.id,
        },
        metadata: {
            tenantId,
            source: 'AppointmentApplicationService',
        },
    }));
}
