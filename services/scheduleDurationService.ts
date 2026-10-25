/**
 * scheduleDurationService.ts
 * Service de infraestrutura para persistência e validações de duração e conflito de agendamentos.
 * Camada de serviço/infraestrutura (isenta de violação de Repository Guard).
 * Frente 1.I (Fase 7.1 UX Review)
 */

import { getScopedClient } from './supabaseClient';
import type { ExistingAppointmentSlot } from '@/src/utils/scheduleDuration';

export interface UpdateAppointmentDurationParams {
    tenantId: string;
    appointmentId: string;
    durationMinutes: number;
    durationDecimal: number;
    endTime: string;
    isOverbooked?: boolean;
}

export const scheduleDurationService = {
    /**
     * Busca os agendamentos de um profissional em uma data específica para validação de conflitos.
     */
    async fetchStaffAppointmentsForDate(
        tenantId: string,
        staffId: string,
        dateKey: string,
    ): Promise<ExistingAppointmentSlot[]> {
        if (!tenantId || !staffId || !dateKey) return [];

        const client = getScopedClient('barber');
        const startOfDay = `${dateKey}T00:00:00`;
        const endOfDay = `${dateKey}T23:59:59`;

        const { data, error } = await client
            .from('appointments')
            .select('id, staff_id, start_time, duration, duration_minutes, status, client_name, service_name')
            .eq('tenant_id', tenantId)
            .eq('staff_id', staffId)
            .gte('start_time', startOfDay)
            .lte('start_time', endOfDay)
            .neq('status', 'cancelled');

        if (error || !data) {
            console.warn('[scheduleDurationService] Erro ao buscar agendamentos do dia:', error);
            return [];
        }

        return data.map((apt: any) => {
            const startD = new Date(apt.start_time);
            const startDecimal = startD.getHours() + startD.getMinutes() / 60;
            const durationDecimal = Number(apt.duration) || (Number(apt.duration_minutes) ? Number(apt.duration_minutes) / 60 : 0.5);

            return {
                id: apt.id,
                staffId: apt.staff_id,
                dateKey,
                startDecimal,
                durationDecimal,
                status: apt.status,
                client: apt.client_name,
                service: apt.service_name,
            };
        });
    },

    /**
     * Atualiza a duração e horário de término de um agendamento existente de forma atômica.
     */
    async updateAppointmentDuration(params: UpdateAppointmentDurationParams): Promise<boolean> {
        const { tenantId, appointmentId, durationMinutes, durationDecimal, endTime, isOverbooked } = params;
        const client = getScopedClient('barber');

        const patch: Record<string, unknown> = {
            duration: durationDecimal,
            duration_minutes: durationMinutes,
            end_time: endTime,
        };

        if (isOverbooked !== undefined) {
            patch.is_overbooked = isOverbooked;
        }

        const { error } = await client
            .from('appointments')
            .update(patch)
            .eq('tenant_id', tenantId)
            .eq('id', appointmentId);

        if (error) {
            console.error('[scheduleDurationService] Erro ao atualizar duração do agendamento:', error);
            throw error;
        }

        return true;
    },
};
