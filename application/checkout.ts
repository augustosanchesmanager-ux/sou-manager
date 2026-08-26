/**
 * [SMG][APPLICATION][CHECKOUT] CheckoutApplicationService
 *
 * RESPONSABILIDADE: Orquestra o fluxo completo de finalização de checkout.
 *   - Validação de regras de negócio
 *   - Sincronização de comanda (create/update)
 *   - Sincronização de itens com compensação
 *   - Sincronização de participants
 *   - Settlement financeiro
 *   - Dedução de créditos Club dos Chefes
 *
 * NÃO FAZ:
 *   - Renderização de UI (pertence a Checkout.tsx)
 *   - Chamadas diretas ao Supabase (usa repositórios)
 *   - Gerenciamento de estado React (pertence ao componente)
 *
 * DEPENDÊNCIAS: Repositórios (ComandaRepository, etc.), finance utils
 *
 * GARANTIAS:
 *   - Todas as operações filtram por tenant_id
 *   - Lança RepositoryError em falhas de dados
 *   - Lança CheckoutError em falhas de negócio
 *   - Zero conhecimento de React, UI, navigate, toast
 *
 * 4.7.4: Refactored to use domain repositories instead of direct Supabase calls.
 */

import { comandaRepository } from '../domain/comanda/repository';
import { comandaItemRepository } from '../domain/comanda/item-repository';
import { serviceExecutionParticipantRepository } from '../domain/comanda/participant-repository';
import { createSupabaseClient } from '../domain/shared/supabase-client-factory';
import type { DatabaseClient } from '../domain/shared/database-client';
import { settleCheckoutComandaAndEnqueue } from '../src/lib/finance/settlement';
import type { OutboxEnqueueData } from '../src/lib/finance/settlement';
import {
    closeZeroAmountComanda,
    buildZeroCloseAuditNote,
    type ZeroCloseOrigin,
} from '../src/lib/finance/zeroClose';
import { appEventBus } from '../domain/events/app-bus';
import { createEvent } from '../domain/events/types';
import type { CheckoutCompletedEvent } from '../domain/events/types';

// ─── RPC Client (for legacy functions not yet in repositories) ──

let rpcClient: DatabaseClient | null = null;

function getRpcClient(): DatabaseClient {
    if (!rpcClient) {
        rpcClient = createSupabaseClient('comandas', 'barber');
    }
    return rpcClient;
}

// ─── Types ───────────────────────────────────────────────────────

export type CheckoutMode = 'pdv' | 'open_comanda' | 'edit_comanda';
export type PaymentStatus = 'paid' | 'pending';
export type ClosureMode = 'standard' | 'legacy_membership';

export interface CheckoutCartItem {
    id: string;
    dbId?: string;
    type: 'service' | 'product';
    name: string;
    price: number;
    quantity: number;
    service_id?: string;
    product_id?: string;
    staff_id?: string;
    usedCredit?: boolean;
    execution_participants?: CheckoutParticipant[];
}

export interface CheckoutParticipant {
    id: string;
    professional_id: string;
    professional_name?: string;
    role: 'primary' | 'assistant' | 'co_executor';
    payout_type: 'percentage' | 'fixed';
    payout_value: number;
    affects_revenue: boolean;
    affects_commission: boolean;
}

export interface CheckoutClient {
    id: string;
    name: string;
    phone?: string;
}

export interface DiscountAuditDraft {
    amount: number;
    type: string;
    reasonType: string;
    reasonNote: string;
    responsibleStaffId: string | null;
    responsibleStaffName: string | null;
    commissionImpact: string;
}

export interface FinishRequest {
    tenantId: string;
    appSlug: string;
    schema: string;
    userId: string | null;

    // Comanda state
    comandaId?: string;
    cart: CheckoutCartItem[];
    client: CheckoutClient;
    total: number;
    discountValue: number;

    // Payment
    paymentStatus: PaymentStatus;
    paymentMethod: string;
    paymentDescription?: string;
    closureMode: ClosureMode;
    closureNote: string;

    // Related entities
    relatedAppointmentId?: string;

    // Financial flags
    shouldApplyFinancialEffects: boolean;
    shouldDeductMembershipCredits: boolean;

    // Legacy club
    isLegacyClubSettlement: boolean;
    legacyReferenceMonth?: string;
    canCloseWithAdministrativeOrigin: boolean;

    // Zero-close
    shouldSettleZeroWithAudit: boolean;
    zeroCloseOrigin?: ZeroCloseOrigin;
    zeroCloseReason: string;
    creditItems: CheckoutCartItem[];
    chefClubInfo?: { id: string } | null;

    // Discount audit
    shouldCollectDiscountAudit: boolean;
    discountAuditDraft?: DiscountAuditDraft | null;

    // Labels
    internalSettlementTitle: string;
    incomeCategory?: string;
}

export interface FinishResult {
    comandaId: string;
    paymentStatus: PaymentStatus;
    isLegacyClubSettlement: boolean;
}

// ─── Errors ──────────────────────────────────────────────────────

export class CheckoutError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'CheckoutError';
    }
}

// ─── Service ─────────────────────────────────────────────────────

class CheckoutApplicationServiceImpl {

    /**
     * Valida as regras de negócio antes de finalizar o checkout.
     * Retorna null se válido, ou lista de mensagens de erro.
     */
    validateFinishRequest(req: FinishRequest): string[] {
        const errors: string[] = [];

        if (!req.client) {
            errors.push('Cliente é obrigatório.');
        }
        if (req.cart.length === 0) {
            errors.push('Pelo menos um item é obrigatório.');
        }

        // Legacy club settlement
        if (req.isLegacyClubSettlement) {
            if (!req.canCloseWithAdministrativeOrigin) {
                errors.push('Baixa administrativa exige permissão de gerente, admin ou superadmin.');
            }
            if (!req.legacyReferenceMonth) {
                errors.push('Informe o mês de referência para a baixa administrativa.');
            }
            if (!req.closureNote.trim()) {
                errors.push('Informe o motivo obrigatório para a baixa administrativa.');
            }
        }

        // Zero-paid checkout
        if (req.paymentStatus === 'paid' && req.total <= 0) {
            if (req.zeroCloseOrigin === 'club_credit' && !req.chefClubInfo) {
                errors.push('Crédito do Clube consumido no checkout: há crédito aplicado e disponível.');
            }
            if (req.zeroCloseOrigin === 'administrative_adjustment' && !req.canCloseWithAdministrativeOrigin) {
                errors.push('Baixa administrativa zero exige permissão de gerente, admin ou superadmin.');
            }
            if (
                (req.zeroCloseOrigin === 'house_courtesy' || req.zeroCloseOrigin === 'administrative_adjustment') &&
                !req.zeroCloseReason.trim()
            ) {
                errors.push('Informe o motivo obrigatório para finalizar comanda zero.');
            }
        }

        // Discount audit
        if (req.shouldCollectDiscountAudit && req.discountAuditDraft) {
            const draft = req.discountAuditDraft;
            if (draft.type === 'barber_discount' && !draft.responsibleStaffId) {
                errors.push('Selecione o profissional responsável pelo desconto.');
            }
            if (!draft.reasonNote.trim()) {
                errors.push('Informe uma observação para auditar o desconto.');
            }
        }

        // Tenant
        if (!req.tenantId) {
            errors.push('Tenant inválido para finalizar operação.');
        }

        return errors;
    }

    /**
     * Monta o payload da comanda para create/update.
     */
    prepareComandaData(req: FinishRequest): Record<string, unknown> {
        const assignedStaffIds = Array.from(
            new Set(req.cart.map(item => item.staff_id).filter(Boolean))
        ) as string[];
        const comandaStaffId = assignedStaffIds.length === 1 ? assignedStaffIds[0] : null;

        const shouldSettleViaRpc = req.paymentStatus === 'paid' && !req.isLegacyClubSettlement && !req.shouldSettleZeroWithAudit;
        const shouldCloseAfterComandaSync = shouldSettleViaRpc || req.shouldSettleZeroWithAudit;
        const paymentDateReal = new Date().toISOString();

        const legacyClosureAuditNote = req.isLegacyClubSettlement
            ? buildZeroCloseAuditNote({
                origin: 'administrative_adjustment',
                source: 'checkout',
                authorizedBy: req.userId,
                userId: req.userId,
                reason: req.closureNote.trim(),
            })
            : null;

        return {
            client_id: req.client.id,
            staff_id: comandaStaffId,
            appointment_id: req.relatedAppointmentId || null,
            status: shouldCloseAfterComandaSync ? 'open' : (req.paymentStatus === 'paid' ? 'paid' : 'open'),
            total: req.total,
            discount: req.discountValue,
            payment_method: shouldCloseAfterComandaSync ? null : (req.paymentStatus === 'paid' ? req.paymentMethod : null),
            closure_mode: req.paymentStatus === 'paid' ? req.closureMode : 'standard',
            closure_note: req.paymentStatus === 'paid' && req.isLegacyClubSettlement ? legacyClosureAuditNote : null,
            financial_effect: req.paymentStatus === 'paid' ? req.shouldApplyFinancialEffects : true,
            membership_credit_effect: req.paymentStatus === 'paid' ? req.shouldDeductMembershipCredits : true,
            legacy_reference_month: req.paymentStatus === 'paid' && req.isLegacyClubSettlement
                ? `${req.legacyReferenceMonth}-01`
                : null,
            closed_at: shouldCloseAfterComandaSync ? null : (req.paymentStatus === 'paid' ? paymentDateReal : null),
            tenant_id: req.tenantId,
        };
    }

    /**
     * Verifica se a comanda ainda está aberta (concurrency guard).
     */
    async verifyComandaOpenStatus(comandaId: string, tenantId: string): Promise<void> {
        const status = await comandaRepository.getStatus(comandaId, tenantId);

        if (status && status !== 'open') {
            console.error('[SMG][CHECKOUT][CONCURRENCY] Comanda mudou de estado antes do sync', {
                comandaId,
                currentStatus: status,
                expectedStatus: 'open',
                tenantId,
            });
            throw new CheckoutError(
                `Comanda #${comandaId} não está mais aberta (status: ${status}). Operação cancelada para evitar perda de dados.`
            );
        }
    }

    /**
     * Sincroniza a comanda: create ou update com concurrency guard.
     * Retorna o comandaId resultante.
     */
    async syncComanda(
        req: FinishRequest,
        comandaData: Record<string, unknown>,
        idempotencyKey: string,
    ): Promise<string> {
        let currentComandaId = req.comandaId;

        if (currentComandaId) {
            // Update path
            await this.verifyComandaOpenStatus(currentComandaId, req.tenantId);
            await comandaRepository.update(currentComandaId, comandaData as any, req.tenantId);
        } else {
            // Try to find existing comanda
            let existingComanda: { id: string } | null = null;

            if (req.relatedAppointmentId) {
                const comandas = await comandaRepository.list(req.tenantId, {
                    appointmentId: req.relatedAppointmentId,
                });
                existingComanda = comandas.length > 0 ? { id: comandas[0].id } : null;
            }

            if (!existingComanda && req.paymentStatus === 'pending') {
                const comandas = await comandaRepository.list(req.tenantId, {
                    clientId: req.client.id,
                    status: 'open',
                });
                existingComanda = comandas.length > 0 ? { id: comandas[0].id } : null;
            }

            if (existingComanda) {
                currentComandaId = existingComanda.id;
                await this.verifyComandaOpenStatus(currentComandaId, req.tenantId);
                await comandaRepository.update(currentComandaId, comandaData as any, req.tenantId);
            } else {
                // Create new comanda with idempotency
                currentComandaId = await comandaRepository.insertWithIdempotency(
                    comandaData,
                    idempotencyKey,
                    req.tenantId,
                );
            }
        }

        if (!currentComandaId) {
            throw new CheckoutError('Falha ao resolver comandaId após sincronização.');
        }

        return currentComandaId;
    }

    /**
     * Sincroniza itens da comanda com compensação (rollback) em caso de falha.
     */
    async syncItemsWithCompensation(
        comandaId: string,
        tenantId: string,
        cart: CheckoutCartItem[],
    ): Promise<string[]> {
        // Backup existing items
        const existingItems = await comandaItemRepository.backupByComandaId(comandaId, tenantId);

        // Delete existing items
        await comandaItemRepository.deleteByComandaId(comandaId, tenantId);

        // Insert new items
        const itemsToInsert = cart.map(item => ({
            comanda_id: comandaId,
            service_id: item.service_id || null,
            product_id: item.product_id || null,
            product_name: item.name,
            quantity: item.quantity,
            unit_price: item.price,
            staff_id: item.staff_id || null,
            tenant_id: tenantId,
        }));

        const expectedItems = itemsToInsert.length;
        let insertedItems: Array<{ id: string }> = [];

        try {
            insertedItems = await comandaItemRepository.insertBatch(itemsToInsert);
        } catch (itemsError) {
            // Compensation: restore backed-up items
            console.error('[SMG][CHECKOUT][COMPENSATION] Falha no sync de itens — tentando rollback', {
                comandaId,
                tenantId,
                expectedItems,
                insertedCount: 0,
                failureDetail: (itemsError as Error).message,
            });

            if (existingItems && existingItems.length > 0) {
                const restoredItems = existingItems.map(({ id, created_at, ...rest }: any) => rest);
                try {
                    await comandaItemRepository.insertBatch(restoredItems);
                    console.warn('[SMG][CHECKOUT][COMPENSATION] Rollback bem-sucedido', {
                        comandaId,
                        restoredCount: restoredItems.length,
                    });
                } catch (restoreError) {
                    console.error('[SMG][CHECKOUT][COMPENSATION][FATAL] Rollback falhou', {
                        comandaId,
                        tenantId,
                        restoreError,
                    });
                    throw new CheckoutError(
                        `Falha crítica: comanda #${comandaId} — itens removidos e rollback falhou. Entre em contato com suporte.`
                    );
                }
            }

            throw itemsError;
        }

        // Compensation: if count mismatches, restore backed-up items
        if (!insertedItems || insertedItems.length !== expectedItems) {
            const failureDetail = `Esperado ${expectedItems}, inserido ${insertedItems?.length || 0}`;

            console.error('[SMG][CHECKOUT][COMPENSATION] Falha no sync de itens — tentando rollback', {
                comandaId,
                tenantId,
                expectedItems,
                insertedCount: insertedItems?.length || 0,
                failureDetail,
            });

            if (existingItems && existingItems.length > 0) {
                const restoredItems = existingItems.map(({ id, created_at, ...rest }: any) => rest);
                try {
                    await comandaItemRepository.insertBatch(restoredItems);
                    console.warn('[SMG][CHECKOUT][COMPENSATION] Rollback bem-sucedido', {
                        comandaId,
                        restoredCount: restoredItems.length,
                    });
                } catch (restoreError) {
                    console.error('[SMG][CHECKOUT][COMPENSATION][FATAL] Rollback falhou', {
                        comandaId,
                        tenantId,
                        restoreError,
                    });
                    throw new CheckoutError(
                        `Falha crítica: comanda #${comandaId} — itens removidos e rollback falhou. Entre em contato com suporte.`
                    );
                }
            }

            throw new CheckoutError(
                `Sync incompleto: ${expectedItems} itens esperados, ${insertedItems?.length || 0} inseridos.`
            );
        }

        // Checkpoint: verify persistence
        try {
            const count = await comandaItemRepository.countByComandaId(comandaId, tenantId);

            if (count !== expectedItems) {
                console.error('[SMG][CHECKOUT][CHECKPOINT][INCONSISTENCY] Contagem pós-insert divergente', {
                    comandaId,
                    tenantId,
                    expectedItems,
                    persistedCount: count,
                });
                throw new CheckoutError(
                    `Inconsistência pós-sync: ${expectedItems} itens esperados, ${count} persistidos. Comanda #${comandaId}.`
                );
            }
        } catch (countErr) {
            if (countErr instanceof CheckoutError) throw countErr;
            console.warn('[SMG][CHECKOUT][CHECKPOINT] Erro ao verificar persistência', {
                comandaId,
                countErr,
            });
        }

        return insertedItems.map(i => i.id);
    }

    /**
     * Sincroniza participants dos itens.
     */
    async syncParticipants(
        comandaId: string,
        tenantId: string,
        insertedItemIds: string[],
        cart: CheckoutCartItem[],
    ): Promise<void> {
        const allParticipantsToInsert: Record<string, unknown>[] = [];

        cart.forEach((item, index) => {
            const itemId = insertedItemIds[index];
            if (!itemId) return;

            const participants = item.execution_participants || [];

            if (participants.length > 0) {
                participants.forEach(p => {
                    allParticipantsToInsert.push({
                        comanda_item_id: itemId,
                        staff_id: p.professional_id,
                        role: p.role,
                        payout_type: p.payout_type,
                        payout_value: p.payout_value,
                        affects_revenue: p.affects_revenue,
                        affects_commission: p.affects_commission,
                        tenant_id: tenantId,
                    });
                });
            } else if (item.staff_id) {
                allParticipantsToInsert.push({
                    comanda_item_id: itemId,
                    staff_id: item.staff_id,
                    role: 'primary',
                    payout_type: 'percentage',
                    payout_value: 100,
                    affects_revenue: true,
                    affects_commission: true,
                    tenant_id: tenantId,
                });
            }
        });

        if (allParticipantsToInsert.length > 0) {
            try {
                await serviceExecutionParticipantRepository.insertBatch(allParticipantsToInsert);
            } catch (participantsError) {
                console.warn('[SMG][CHECKOUT][PARTICIPANTS][WARN] Falha ao inserir participants — itens foram salvos', {
                    comandaId,
                    tenantId,
                    participantsCount: allParticipantsToInsert.length,
                    error: participantsError,
                });
            }
        }
    }

    /**
     * Executa o settlement financeiro via RPC composta (D7).
     *
     * finance_settle_comanda_and_enqueue garante atomicidade entre
     * o settlement e o INSERT em outbox_items na mesma transação.
     * O event_id é gerado aqui e preservado em todas as camadas.
     */
    async settleComanda(
        req: FinishRequest,
        comandaId: string,
        idempotencyKey: string,
    ): Promise<void> {
        const paymentDateReal = new Date().toISOString();

        const settlementNotes = [
            req.paymentMethod === 'other' && req.paymentDescription
                ? `Forma de pagamento: ${req.paymentDescription}`
                : null,
            req.discountAuditDraft
                ? req.discountAuditDraft.reasonNote
                : null,
        ].filter(Boolean).join('\n\n') || null;

        // D7: Generate event_id for outbox (same format as domain/events/types.ts)
        const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`;

        // D7: Build outbox payload (identical to FinanceSubscriber output)
        const outboxPayload: OutboxEnqueueData = {
            eventId,
            eventType: 'CheckoutCompleted',
            payload: {
                operationType: 'create_commission_record',
                operationData: {
                    tenantId: req.tenantId,
                    comandaId,
                    clientId: req.client.id,
                    staffId: req.cart[0]?.staff_id,
                    receivedValue: req.total,
                    paymentMethod: req.paymentMethod,
                    hasClubCredit: req.creditItems.length > 0,
                },
                sourceEvent: 'CheckoutCompleted',
                idempotencyKey: `${eventId}_create_commission_record`,
            },
            metadata: {
                tenantId: req.tenantId,
                userId: req.userId ?? undefined,
                correlationId: idempotencyKey,
                causationId: eventId,
                source: 'CheckoutApplicationService',
            },
        };

        try {
            await settleCheckoutComandaAndEnqueue({
                client: req.client,
                comandaId,
                appointmentId: req.relatedAppointmentId,
                tenantId: req.tenantId,
                supabase: getRpcClient() as any,
                clientDb: getRpcClient() as any,
                paymentMethod: req.paymentMethod,
                paidAmount: req.total,
                paymentDateReal,
                source: 'checkout',
                notes: settlementNotes,
                idempotencyKey: `finance-settle-${comandaId}-${idempotencyKey}`,
                incomeCategory: req.incomeCategory,
                description: req.paymentMethod === 'other' && req.paymentDescription
                    ? `${req.internalSettlementTitle} - Cliente: ${req.client.name} (${req.paymentDescription})`
                    : `${req.internalSettlementTitle} - Cliente: ${req.client.name}`,
                shouldApplyFinancialEffects: req.shouldApplyFinancialEffects,
                closure: {
                    mode: req.closureMode,
                    note: req.isLegacyClubSettlement ? (req.closureNote.trim() || null) : null,
                    financialEffect: req.shouldApplyFinancialEffects,
                    membershipCreditEffect: req.shouldDeductMembershipCredits,
                    legacyReferenceMonth: req.isLegacyClubSettlement ? `${req.legacyReferenceMonth}-01` : null,
                },
                clientStats: {
                    lastService: req.cart.length > 0 ? req.cart[0].name : '',
                },
                outbox: outboxPayload,
            });
        } catch (settleErr: any) {
            console.error('[SMG][CHECKOUT][SETTLE][ERROR] Falha no settlement — comanda pode ter status inconsistente', {
                comandaId,
                tenantId: req.tenantId,
                cartItems: req.cart.length,
                error: settleErr,
            });
            throw settleErr;
        }
    }

    /**
     * Fecha comanda de valor zero com auditoria.
     */
    async closeZeroAmount(
        comandaId: string,
        tenantId: string,
        req: FinishRequest,
    ): Promise<void> {
        await closeZeroAmountComanda({
            comandaId,
            tenantId,
            supabase: getRpcClient() as any,
            origin: req.zeroCloseOrigin || 'house_courtesy',
            source: 'checkout',
            authorizedBy: req.userId,
            userId: req.userId,
            reason: req.zeroCloseOrigin === 'club_credit'
                ? `Crédito do Club dos Chefes consumido no checkout: ${req.creditItems.length} serviço(s).`
                : req.zeroCloseReason.trim(),
            legacyReferenceMonth: req.zeroCloseOrigin === 'administrative_adjustment' && req.legacyReferenceMonth
                ? `${req.legacyReferenceMonth}-01`
                : null,
        });
    }

    /**
     * Deduz créditos Club dos Chefes após pagamento.
     */
    async deductChefClubCredits(
        comandaId: string,
        chefClubInfo: { id: string },
        creditItems: CheckoutCartItem[],
    ): Promise<void> {
        const results = await Promise.allSettled(
            creditItems.map(creditItem =>
                getRpcClient().rpc('deduct_chef_club_credits', {
                    p_subscription_id: chefClubInfo.id,
                    p_service_id: creditItem.service_id,
                    p_amount: 1,
                    p_reference: `Comanda #${comandaId} - ${creditItem.name}`,
                })
            )
        );

        const failures = results.filter(r => r.status === 'rejected');
        if (failures.length > 0) {
            console.error('[SMG][CHECKOUT][CREDITS] Erros ao deduzir créditos:', failures);
        }
    }

    /**
     * Master orchestration: finaliza o checkout completo.
     *
     * FLUXO:
     * 1. Validação
     * 2. Montagem do payload da comanda
     * 3. Sync da comanda (create/update)
     * 4. Sync dos itens (com compensação)
     * 5. Sync dos participants
     * 6. Settlement financeiro
     * 7. Dedução de créditos
     *
     * @returns FinishResult com o comandaId e status resultante
     */
    async finish(
        req: FinishRequest,
        idempotencyKey: string,
    ): Promise<FinishResult> {
        // 1. Validation
        const validationErrors = this.validateFinishRequest(req);
        if (validationErrors.length > 0) {
            throw new CheckoutError(validationErrors[0], 'VALIDATION_ERROR');
        }

        // 2. Prepare comanda data
        const comandaData = this.prepareComandaData(req);

        // 3. Sync comanda
        const comandaId = await this.syncComanda(req, comandaData, idempotencyKey);

        // 4. Sync items (with compensation)
        const insertedItemIds = await this.syncItemsWithCompensation(comandaId, req.tenantId, req.cart);

        // 5. Sync participants
        await this.syncParticipants(comandaId, req.tenantId, insertedItemIds, req.cart);

        // 6. Financial settlement
        const shouldSettleViaRpc = req.paymentStatus === 'paid' && !req.isLegacyClubSettlement && !req.shouldSettleZeroWithAudit;

        if (shouldSettleViaRpc) {
            await this.settleComanda(req, comandaId, idempotencyKey);
        }

        if (req.shouldSettleZeroWithAudit) {
            await this.closeZeroAmount(comandaId, req.tenantId, req);
        }

        // 7. Deduct Club dos Chefes credits
        if (req.shouldDeductMembershipCredits && req.creditItems.length > 0 && req.chefClubInfo) {
            await this.deductChefClubCredits(comandaId, req.chefClubInfo, req.creditItems);
        }

        // 8. Publish domain event
        await appEventBus.publish(createEvent<CheckoutCompletedEvent>({
            eventType: 'CheckoutCompleted',
            aggregateId: comandaId,
            aggregateType: 'comanda',
            payload: {
                comandaId,
                clientId: req.client.id,
                staffId: req.cart[0]?.staff_id,
                total: req.total,
                paymentMethod: req.paymentMethod,
                paymentStatus: req.paymentStatus,
                closureMode: req.closureMode,
                itemCount: req.cart.length,
                hasClubCredit: req.creditItems.length > 0,
                financialEffect: req.shouldApplyFinancialEffects,
            },
            metadata: {
                tenantId: req.tenantId,
                correlationId: idempotencyKey,
                source: 'CheckoutApplicationService',
            },
        }));

        return {
            comandaId,
            paymentStatus: req.paymentStatus,
            isLegacyClubSettlement: req.isLegacyClubSettlement,
        };
    }
}

export const checkoutApplicationService = new CheckoutApplicationServiceImpl();
