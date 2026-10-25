/**
 * comandaScheduleSyncService.ts
 * Service de infraestrutura para sincronização reativa Agenda ↔ Comanda e auditoria de cancelamento em cascata.
 * Camada de serviço/infraestrutura (isenta de violação de Repository Guard).
 * Frente 1.H (Fase 7.1 UX Review)
 */

import { getScopedClient } from './supabaseClient';
import {
    canModifyLinkedComanda,
    calculateSyncedComandaItems,
    evaluateCascadingCancel,
    type SyncedComandaItemInput,
    type CascadingCancelEvaluation,
} from '@/src/utils/comandaScheduleSync';

export interface LinkedComandaDetails {
    comanda: {
        id: string;
        tenant_id: string;
        status: string;
        total: number;
        staff_id?: string | null;
        client_id?: string | null;
        appointment_id?: string | null;
        created_at?: string;
    } | null;
    items: SyncedComandaItemInput[];
    hasPayments: boolean;
}

export interface SyncComandaUpdateInput {
    tenantId: string;
    appointmentId: string;
    serviceId?: string | null;
    serviceName?: string;
    price?: number;
    staffId?: string | null;
    staffName?: string;
}

export interface SyncComandaUpdateResult {
    success: boolean;
    blocked?: boolean;
    noComanda?: boolean;
    comandaId?: string;
    message?: string;
    preservedProductsCount?: number;
    nextTotal?: number;
}

export const comandaScheduleSyncService = {
    /**
     * Busca os detalhes da comanda vinculada ao agendamento (dados cadastrais, itens e status de pagamento).
     */
    async getLinkedComandaDetails(tenantId: string, appointmentId: string): Promise<LinkedComandaDetails> {
        if (!tenantId || !appointmentId) {
            return { comanda: null, items: [], hasPayments: false };
        }

        const client = getScopedClient('barber');

        // Busca comanda vinculada pelo appointment_id (ordem desc para pegar a mais recente se houver múltiplas)
        const { data: comandaData, error: comandaErr } = await client
            .from('comandas')
            .select('id, tenant_id, status, total, staff_id, client_id, appointment_id, created_at')
            .eq('tenant_id', tenantId)
            .eq('appointment_id', appointmentId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (comandaErr || !comandaData) {
            return { comanda: null, items: [], hasPayments: false };
        }

        // Busca itens da comanda
        const { data: itemsData } = await client
            .from('comanda_items')
            .select('id, service_id, product_id, product_name, quantity, unit_price, staff_id')
            .eq('tenant_id', tenantId)
            .eq('comanda_id', comandaData.id);

        const items: SyncedComandaItemInput[] = (itemsData || []).map((row: any) => ({
            id: row.id,
            service_id: row.service_id,
            product_id: row.product_id,
            product_name: row.product_name,
            quantity: Number(row.quantity) || 1,
            unit_price: Number(row.unit_price) || 0,
            staff_id: row.staff_id,
        }));

        // Checa se há pagamentos ativos (não estornados)
        let hasPayments = false;
        try {
            const { data: paymentsData } = await client
                .from('comanda_payments')
                .select('id')
                .eq('tenant_id', tenantId)
                .eq('comanda_id', comandaData.id)
                .is('reversed_at', null)
                .limit(1);

            hasPayments = Boolean(paymentsData && paymentsData.length > 0);
        } catch {
            hasPayments = false;
        }

        return {
            comanda: comandaData,
            items,
            hasPayments,
        };
    },

    /**
     * Avalia o cancelamento em cascata da comanda vinculada.
     */
    async evaluateCancel(tenantId: string, appointmentId: string): Promise<CascadingCancelEvaluation> {
        const details = await this.getLinkedComandaDetails(tenantId, appointmentId);
        return evaluateCascadingCancel({
            comanda: details.comanda,
            comandaItems: details.items,
            hasPayments: details.hasPayments,
        });
    },

    /**
     * Sincroniza a comanda vinculada com as alterações feitas no agendamento.
     * Guardrail: se a comanda já estiver 'paid', 'closed' ou 'billed', a mutação é bloqueada.
     */
    async syncComandaOnAppointmentUpdate(input: SyncComandaUpdateInput): Promise<SyncComandaUpdateResult> {
        const { tenantId, appointmentId, serviceId, serviceName, price, staffId } = input;
        const client = getScopedClient('barber');

        const details = await this.getLinkedComandaDetails(tenantId, appointmentId);
        if (!details.comanda) {
            return { success: true, noComanda: true };
        }

        const modifyCheck = canModifyLinkedComanda(details.comanda);
        if (!modifyCheck.canModify) {
            return {
                success: false,
                blocked: true,
                message: modifyCheck.message,
                comandaId: details.comanda.id,
            };
        }

        if (details.hasPayments) {
            return {
                success: false,
                blocked: true,
                message: 'A comanda possui pagamentos registrados. Não é possível alterar valores pela agenda.',
                comandaId: details.comanda.id,
            };
        }

        const newService = serviceId && serviceName && price !== undefined
            ? { id: serviceId, name: serviceName, price }
            : null;

        const calc = calculateSyncedComandaItems({
            currentItems: details.items,
            newService,
            newProfessionalId: staffId,
        });

        // 1. Atualiza itens alterados no banco
        for (const item of calc.updatedItems) {
            if (!item.id) continue;
            await client
                .from('comanda_items')
                .update({
                    service_id: item.service_id || null,
                    product_name: item.product_name,
                    unit_price: item.unit_price,
                    staff_id: item.staff_id || null,
                })
                .eq('tenant_id', tenantId)
                .eq('id', item.id);
        }

        // 2. Se houver troca de profissional, atualiza service_execution_participants
        if (staffId && calc.modifiedServiceItem?.id) {
            try {
                await client
                    .from('service_execution_participants')
                    .update({ staff_id: staffId })
                    .eq('tenant_id', tenantId)
                    .eq('comanda_item_id', calc.modifiedServiceItem.id);
            } catch (pErr) {
                console.warn('[comandaScheduleSyncService] Aviso ao atualizar participantes:', pErr);
            }
        }

        // 3. Atualiza total e profissional na tabela comandas
        const comandaPatch: Record<string, unknown> = {
            total: calc.nextTotal,
        };
        if (staffId) {
            comandaPatch.staff_id = staffId;
        }

        await client
            .from('comandas')
            .update(comandaPatch)
            .eq('tenant_id', tenantId)
            .eq('id', details.comanda.id);

        return {
            success: true,
            comandaId: details.comanda.id,
            preservedProductsCount: calc.preservedProductsCount,
            nextTotal: calc.nextTotal,
        };
    },

    /**
     * Cancela atomicamente a comanda vinculada com nota de auditoria padronizada.
     */
    async cancelLinkedComandaWithAudit(
        tenantId: string,
        comandaId: string,
        reason: string,
        actorId?: string,
    ): Promise<boolean> {
        const client = getScopedClient('barber');
        const nowIso = new Date().toISOString();

        const { error } = await client
            .from('comandas')
            .update({
                status: 'cancelled',
                cancellation_type: 'appointment_cancelled',
                closure_note: reason,
                cancelled_at: nowIso,
                cancelled_by_user_id: actorId || null,
            })
            .eq('tenant_id', tenantId)
            .eq('id', comandaId);

        if (error) {
            console.error('[comandaScheduleSyncService] Erro ao cancelar comanda:', error);
            throw error;
        }

        return true;
    },

    /**
     * Desvincula o agendamento da comanda e remove o item de serviço agendado,
     * mantendo os produtos avulsos ativos no balcão.
     */
    async retainRetailComandaOnCancel(
        tenantId: string,
        comandaId: string,
        serviceItemId?: string,
    ): Promise<boolean> {
        const client = getScopedClient('barber');

        // Remove o item de serviço agendado
        if (serviceItemId) {
            await client
                .from('comanda_items')
                .delete()
                .eq('tenant_id', tenantId)
                .eq('id', serviceItemId);
        }

        // Recalcula o total restante dos produtos
        const { data: remainingItems } = await client
            .from('comanda_items')
            .select('quantity, unit_price')
            .eq('tenant_id', tenantId)
            .eq('comanda_id', comandaId);

        const newTotal = (remainingItems || []).reduce((acc: number, curr: any) => {
            const qty = Number(curr.quantity) || 1;
            const price = Number(curr.unit_price) || 0;
            return acc + qty * price;
        }, 0);

        // Desvincula appointment_id e atualiza total
        await client
            .from('comandas')
            .update({
                appointment_id: null,
                total: Math.round(newTotal * 100) / 100,
                notes: 'Desvinculada de agendamento cancelado. Mantida para cobrança avulsa de balcão.',
            })
            .eq('tenant_id', tenantId)
            .eq('id', comandaId);

        return true;
    },

    /**
     * Cancela o agendamento preservando a comanda com produtos avulsos ativa no balcão.
     */
    async cancelAppointmentAndRetainRetailComanda(params: {
        tenantId: string;
        appointmentId: string;
        comandaId: string;
        serviceItemId?: string;
        cancellationType?: string;
        cancellationReason?: string;
        userId?: string;
    }): Promise<void> {
        const { tenantId, appointmentId, comandaId, serviceItemId, cancellationType, cancellationReason, userId } = params;
        const client = getScopedClient('barber');

        // 1. Retém os produtos na comanda de balcão e desvincula do agendamento
        await this.retainRetailComandaOnCancel(tenantId, comandaId, serviceItemId);

        // 2. Cancela o agendamento no banco
        const status = cancellationType === 'no_show' ? 'no_show' : 'cancelled';
        const hiddenFromSchedule = cancellationType === 'registration_error' || cancellationType === 'test';

        const { error } = await client
            .from('appointments')
            .update({
                status,
                cancellation_reason: cancellationReason || null,
                cancellation_type: cancellationType || 'client_request',
                hidden_from_schedule: hiddenFromSchedule,
                cancelled_at: new Date().toISOString(),
                cancelled_by_user_id: userId || null,
            })
            .eq('tenant_id', tenantId)
            .eq('id', appointmentId);

        if (error) {
            console.error('[comandaScheduleSyncService] Erro ao cancelar agendamento:', error);
            throw error;
        }
    },
};
