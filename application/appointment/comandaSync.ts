import { appointmentRepository } from '../../domain/appointment/repository';
import { comandaRepository } from '../../domain/comanda/repository';
import { comandaItemRepository } from '../../domain/comanda/item-repository';
import { comandaPaymentRepository } from '../../domain/comanda/comandaPaymentRepository';
import type { Comanda } from '../../domain/comanda/types';
import type { ComandaSyncResult } from './types';

export interface SyncComandaInput {
    tenantId: string;
    appointmentId: string;
    staffId?: string | null;
    serviceId?: string | null;
    serviceName?: string;
    unitPrice?: number;
    startTime?: string | null;
    now?: Date;
    previousAppointment?: {
        service_id?: string | null;
        staff_id?: string | null;
        start_time?: string | null;
    } | null;
    comandas?: Comanda[];
}

const SYNCABLE_STATUSES = new Set(['open', 'blocked']);
const FINALIZED_STATUSES = new Set(['paid', 'closed', 'billed']);
const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

const toNumber = (value: unknown): number => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
};

export function isSyncableComandaStatus(status: string): boolean {
    return SYNCABLE_STATUSES.has(status);
}

export function toSaoPauloDateKey(dateInput: string | Date): string | null {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: SAO_PAULO_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}

export function resolveExpectedComandaStatus(startTime: string, now: Date = new Date()): 'open' | 'blocked' | null {
    const appointmentDateKey = toSaoPauloDateKey(startTime);
    const todayDateKey = toSaoPauloDateKey(now);
    if (!appointmentDateKey || !todayDateKey) {
        return null;
    }
    return appointmentDateKey > todayDateKey ? 'blocked' : 'open';
}

export async function syncComandaForAppointmentUpdate(input: SyncComandaInput): Promise<ComandaSyncResult> {
    const {
        tenantId,
        appointmentId,
        staffId,
        serviceId,
        serviceName,
        unitPrice,
        startTime,
        now,
    } = input;

    const comandas = input.comandas ?? ((await comandaRepository.list(tenantId, { appointmentId })) || []);
    if (comandas.length === 0) {
        return { status: 'no_comanda' };
    }

    let previous = input.previousAppointment;
    if (previous === undefined) {
        try {
            previous = await appointmentRepository.get(appointmentId, tenantId);
        } catch {
            previous = null;
        }
    }
    const previousServiceId = previous?.service_id ?? null;

    let syncedCount = 0;
    let syncedComandaId: string | undefined;
    let syncedComandaStatus: 'open' | 'blocked' | undefined;
    let firstBlocked: ComandaSyncResult | null = null;

    for (const comanda of comandas) {
        const currentStatus = comanda.status || 'open';

        if (!isSyncableComandaStatus(currentStatus)) {
            const isFinalized = FINALIZED_STATUSES.has(currentStatus);
            if (!firstBlocked || isFinalized) {
                firstBlocked = {
                    status: 'blocked_closed',
                    comandaId: comanda.id,
                    message: isFinalized
                        ? 'Comanda vinculada já foi finalizada/liquidada. Ajustes de serviço, valor ou profissional exigem reabertura contábil prévia da comanda.'
                        : `Comanda vinculada está com status '${currentStatus}'. Ajuste o valor no balcão.`,
                };
            }
            continue;
        }

        let payments: Array<{ id: string }> = [];
        try {
            payments = (await comandaPaymentRepository.getPaymentsByComandaIds([comanda.id], tenantId)) || [];
        } catch (err) {
            console.warn('[SMG][APPOINTMENT][SYNC] Falha ao verificar pagamentos — sync abortado por segurança:', {
                comandaId: comanda.id,
                appointmentId,
                error: err,
            });
            if (!firstBlocked) {
                firstBlocked = {
                    status: 'blocked_payment',
                    comandaId: comanda.id,
                    message: 'Não foi possível verificar pagamentos da comanda. Nada foi alterado na comanda.',
                };
            }
            continue;
        }
        if (payments.length > 0) {
            if (!firstBlocked) {
                firstBlocked = {
                    status: 'blocked_payment',
                    comandaId: comanda.id,
                    message: 'Agendamento atualizado. A comanda possui pagamentos registrados e seus valores foram preservados.',
                };
            }
            continue;
        }

        const items = (await comandaItemRepository.list(comanda.id, tenantId)) || [];
        const linkedItem =
            (serviceId ? items.find((item) => item.service_id === serviceId) : undefined) ??
            (previousServiceId ? items.find((item) => item.service_id === previousServiceId) : undefined) ??
            items.find((item) => item.service_id !== null && item.service_id !== undefined) ??
            null;

        const itemPatch: Record<string, string | number | null> = {};
        if (staffId !== undefined && staffId !== null && linkedItem && linkedItem.staff_id !== staffId) {
            itemPatch.staff_id = staffId;
        }
        if (linkedItem && serviceId !== undefined && serviceId !== null && linkedItem.service_id !== serviceId) {
            itemPatch.service_id = serviceId;
        }
        if (linkedItem && serviceName !== undefined && serviceName !== '' && linkedItem.product_name !== serviceName) {
            itemPatch.product_name = serviceName;
        }
        if (linkedItem && unitPrice !== undefined && Number.isFinite(unitPrice) && toNumber(linkedItem.unit_price) !== unitPrice) {
            itemPatch.unit_price = unitPrice as number;
        }
        if (linkedItem && Object.keys(itemPatch).length > 0) {
            await comandaItemRepository.update(linkedItem.id, itemPatch, tenantId);
        }

        // Propagação de staff_id: afeta todos os itens de SERVIÇO da comanda vinculada,
        // garantindo que trocas de profissional atualizem todos os serviços do agendamento,
        // preservando estritamente produtos (onde service_id é nulo/indefinido).
        if (staffId !== undefined && staffId !== null) {
            for (const item of items) {
                if (linkedItem && item.id === linkedItem.id) continue;
                const isServiceItem = item.service_id !== null && item.service_id !== undefined;
                if (isServiceItem && item.staff_id !== staffId) {
                    await comandaItemRepository.update(item.id, { staff_id: staffId }, tenantId);
                }
            }
        }

        const headerPatch: Record<string, string | number | null> = {};
        if (staffId !== undefined && staffId !== null && comanda.staff_id !== staffId) {
            headerPatch.staff_id = staffId;
        }
        if (startTime && comanda.status) {
            const expectedStatus = resolveExpectedComandaStatus(startTime, now);
            if (expectedStatus && currentStatus !== expectedStatus) {
                headerPatch.status = expectedStatus;
            }
        }
        const nextTotal = items.reduce((sum, item) => {
            const matchesLinked = linkedItem !== null && item.id === linkedItem.id;
            const quantity = toNumber(item.quantity) || 1;
            const price = matchesLinked && itemPatch.unit_price !== undefined
                ? toNumber(itemPatch.unit_price)
                : toNumber(item.unit_price);
            return sum + quantity * price;
        }, 0);
        if (linkedItem && toNumber(comanda.total) !== nextTotal) {
            headerPatch.total = nextTotal;
        }
        if (Object.keys(headerPatch).length > 0) {
            await comandaRepository.update(comanda.id, headerPatch, tenantId);
        }

        if (!syncedComandaId) {
            syncedComandaId = comanda.id;
            syncedComandaStatus = (headerPatch.status as 'open' | 'blocked' | undefined) ?? (currentStatus as 'open' | 'blocked');
        }
        syncedCount += 1;
    }

    if (syncedCount > 0) {
        return {
            status: 'synced',
            comandaId: syncedComandaId ?? comandas[0]?.id,
            comandaStatus: syncedComandaStatus,
        };
    }
    return firstBlocked ?? { status: 'no_comanda' };
}
