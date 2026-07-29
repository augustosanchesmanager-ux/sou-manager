/**
 * [SMG][APPLICATION][SCHEDULE_BLOCK] ScheduleBlockApplicationService
 *
 * RESPONSABILIDADE: Orquestra o CRUD de bloqueios de agenda.
 *   - Validação de payload
 *   - Detecção de conflitos
 *   - Criação/atualização/remoção
 *   - Cancelamento em cascata de agendamentos impactados
 *
 * NÃO FAZ:
 *   - Renderização de UI (pertence a Schedule.tsx)
 *   - Gerenciamento de estado React (pertence ao componente)
 *
 * DEPENDÊNCIAS: scheduleBlocksApi, appointmentRepository
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança ScheduleBlockError em falhas de negócio
 *   - Zero conhecimento de React, UI, navigate, toast
 */

import { scheduleBlocksApi, detectBlockConflicts, type ScheduleBlock, type ScheduleBlockInput } from '../services/scheduleBlocksApi';
import { appointmentRepository } from '../domain/appointment/repository';

// ─── Types ───────────────────────────────────────────────────────

export interface ValidateBlockParams {
    reason: string;
    startDate: string;
    endDate: string;
    startTime?: string | null;
    endTime?: string | null;
    blockType: 'full_day' | 'time_range';
    recurrenceType: 'none' | 'weekly';
    recurrenceUntil?: string | null;
    professionalId?: string | null;
}

export interface SaveBlockParams {
    tenantId: string;
    userId: string;
    editingBlockId?: string;
    payload: ScheduleBlockInput;
    existingAppointmentsAction: 'keep' | 'review' | 'cancel';
}

export interface DeleteBlockParams {
    tenantId: string;
    blockId: string;
    userId: string;
}

export interface ConflictCheckResult {
    hasConflicts: boolean;
    conflictingBlocks: ScheduleBlock[];
}

export interface ImpactedAppointmentsResult {
    count: number;
    appointments: Array<{ id: string; clientName: string; startTime: string }>;
}

// ─── Errors ──────────────────────────────────────────────────────

export class ScheduleBlockError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'ScheduleBlockError';
    }
}

// ─── Service ─────────────────────────────────────────────────────

class ScheduleBlockApplicationServiceImpl {

    /**
     * Valida o payload de um bloqueio.
     * Retorna null se válido, ou lista de mensagens de erro.
     */
    validateBlock(params: ValidateBlockParams): string[] {
        const errors: string[] = [];

        if (!params.reason.trim()) {
            errors.push('Motivo é obrigatório.');
        }
        if (!params.startDate) {
            errors.push('Data de início é obrigatória.');
        }
        if (!params.endDate) {
            errors.push('Data de fim é obrigatória.');
        }
        if (params.startDate && params.endDate && params.endDate < params.startDate) {
            errors.push('Data de fim não pode ser anterior à data de início.');
        }
        if (params.blockType === 'time_range') {
            if (!params.startTime || !params.endTime) {
                errors.push('Horário de início e fim são obrigatórios para bloqueio por horário.');
            }
            if (params.startTime && params.endTime && params.endTime <= params.startTime) {
                errors.push('Horário de fim deve ser posterior ao horário de início.');
            }
        }
        if (params.recurrenceType === 'weekly' && params.startDate !== params.endDate) {
            errors.push('Recorrência semanal requer bloqueio de apenas um dia.');
        }
        if (params.recurrenceType === 'weekly' && params.recurrenceUntil && params.recurrenceUntil < params.startDate) {
            errors.push('Data de fim da recorrência não pode ser anterior à data de início.');
        }

        return errors;
    }

    /**
     * Verifica conflitos com bloqueios existentes.
     */
    async checkConflicts(
        tenantId: string,
        draft: ScheduleBlockInput,
        excludeBlockId?: string,
    ): Promise<ConflictCheckResult> {
        const existing = await scheduleBlocksApi.listHistory(tenantId);
        const filtered = excludeBlockId
            ? existing.filter(b => b.id !== excludeBlockId)
            : existing;

        const conflicts = detectBlockConflicts(filtered, draft);

        return {
            hasConflicts: conflicts.length > 0,
            conflictingBlocks: conflicts,
        };
    }

    /**
     * Encontra agendamentos impactados por um bloqueio.
     */
    async findImpactedAppointments(
        tenantId: string,
        draft: ScheduleBlockInput,
    ): Promise<ImpactedAppointmentsResult> {
        const appointments = await appointmentRepository.list(tenantId, {
            startTimeFrom: draft.start_date,
            startTimeTo: draft.end_date,
        });

        const impacted = appointments.filter(apt => {
            if (apt.status === 'cancelled' || apt.status === 'no_show') return false;

            // Check professional match
            if (draft.professional_id && apt.staff_id !== draft.professional_id) return false;

            return true;
        });

        return {
            count: impacted.length,
            appointments: impacted.map(apt => ({
                id: apt.id,
                clientName: apt.client_name,
                startTime: apt.start_time,
            })),
        };
    }

    /**
     * Salva um bloqueio (create ou update).
     * Se existem agendamentos impactados e action é 'cancel', cancela em cascata.
     */
    async saveBlock(params: SaveBlockParams): Promise<ScheduleBlock> {
        const { tenantId, userId, editingBlockId, payload, existingAppointmentsAction } = params;

        const blockData: ScheduleBlockInput = {
            ...payload,
            existing_appointments_action: existingAppointmentsAction,
        };

        let block: ScheduleBlock;

        if (editingBlockId) {
            // Update existing block
            const updated = await scheduleBlocksApi.update(editingBlockId, blockData);
            block = updated;
        } else {
            // Create new block
            block = await scheduleBlocksApi.create(tenantId, userId, blockData);
        }

        // Handle impacted appointments
        if (existingAppointmentsAction === 'cancel') {
            const impacted = await this.findImpactedAppointments(tenantId, blockData);

            for (const apt of impacted.appointments) {
                try {
                    await appointmentRepository.cancel(apt.id, {
                        status: 'cancelled',
                        cancellation_reason: `Cancelado por bloqueio: ${blockData.reason}`,
                        cancellation_type: 'other',
                        hidden_from_schedule: false,
                        cancelled_at: new Date().toISOString(),
                        cancelled_by_user_id: userId,
                    }, tenantId);
                } catch (err) {
                    console.warn('[SMG][SCHEDULE_BLOCK] Falha ao cancelar agendamento impactado:', {
                        appointmentId: apt.id,
                        blockId: block.id,
                        error: err,
                    });
                }
            }
        }

        return block;
    }

    /**
     * Remove um bloqueio.
     */
    async deleteBlock(params: DeleteBlockParams): Promise<void> {
        const { blockId, userId } = params;

        await scheduleBlocksApi.remove(blockId, userId);
    }

    /**
     * Lista bloqueios para um período.
     */
    async listBlocks(
        tenantId: string,
        startDate: string,
        endDate: string,
    ): Promise<ScheduleBlock[]> {
        return scheduleBlocksApi.listByRange(tenantId, { startDate, endDate });
    }
}

export const scheduleBlockApplicationService = new ScheduleBlockApplicationServiceImpl();
