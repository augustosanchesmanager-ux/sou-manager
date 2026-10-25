/**
 * comandaScheduleSync.ts
 * Utilitário puro de regras de negócio para sincronização reativa Agenda ↔ Comanda.
 * Frente 1.H (Fase 7.1 UX Review)
 */

export interface SyncedComandaItemInput {
    id?: string;
    service_id?: string | null;
    product_id?: string | null;
    product_name?: string | null;
    quantity: number;
    unit_price: number;
    staff_id?: string | null;
}

export interface NewServiceInput {
    id: string;
    name: string;
    price: number;
}

export interface CanModifyResult {
    canModify: boolean;
    reason: 'ok' | 'closed_comanda' | 'paid_comanda' | 'no_comanda' | 'blocked_status';
    message?: string;
}

export interface CalculateSyncedComandaItemsParams {
    currentItems: SyncedComandaItemInput[];
    originalServiceId?: string | null;
    newService?: NewServiceInput | null;
    newProfessionalId?: string | null;
}

export interface CalculateSyncedComandaItemsResult {
    updatedItems: SyncedComandaItemInput[];
    preservedProductsCount: number;
    nextTotal: number;
    modifiedServiceItem: SyncedComandaItemInput | null;
}

export interface EvaluateCascadingCancelParams {
    comanda?: { id: string; status?: string | null; total?: number | null } | null;
    comandaItems?: SyncedComandaItemInput[];
    hasPayments?: boolean;
}

export interface CascadingCancelEvaluation {
    canDirectCancel: boolean;
    requiresConfirmation: boolean;
    reason: 'no_comanda' | 'clean_comanda' | 'has_products' | 'has_payments' | 'already_closed';
    productItems: SyncedComandaItemInput[];
    productsTotal: number;
    message: string;
}

/**
 * Avalia se uma comanda vinculada pode sofrer alterações de serviço, valores ou profissional.
 * Guardrail contábil: comandas já 'paid', 'closed' ou 'billed' não admitem mutação retroativa pela agenda.
 */
export function canModifyLinkedComanda(
    comanda?: { id?: string; status?: string | null } | null,
): CanModifyResult {
    if (!comanda || !comanda.status) {
        return { canModify: true, reason: 'no_comanda' };
    }

    const status = comanda.status.toLowerCase().trim();

    if (status === 'paid') {
        return {
            canModify: false,
            reason: 'paid_comanda',
            message: 'Não é possível alterar profissional/serviço: a comanda correspondente já foi paga/liquidada.',
        };
    }

    if (status === 'closed' || status === 'billed') {
        return {
            canModify: false,
            reason: 'closed_comanda',
            message: 'Não é possível alterar profissional/serviço: a comanda correspondente já foi fechada.',
        };
    }

    if (status === 'open' || status === 'blocked') {
        return { canModify: true, reason: 'ok' };
    }

    return {
        canModify: false,
        reason: 'blocked_status',
        message: `Comanda vinculada está com status '${comanda.status}' e não permite edições pela agenda.`,
    };
}

/**
 * Calcula a lista atualizada de itens da comanda quando o agendamento é editado.
 * - Localiza o item do serviço original do agendamento e o atualiza (id, nome, valor, profissional).
 * - Se houver troca de profissional, transfere a titularidade de todos os serviços da comanda.
 * - Preserva estritamente e intactos todos os produtos físicos/avulsos adicionados no balcão.
 * - Recalcula o subtotal / total geral da comanda.
 */
export function calculateSyncedComandaItems(
    params: CalculateSyncedComandaItemsParams,
): CalculateSyncedComandaItemsResult {
    const { currentItems, originalServiceId, newService, newProfessionalId } = params;

    // Localiza o item de serviço agendado
    const serviceIndex = currentItems.findIndex((item) => {
        if (originalServiceId && item.service_id === originalServiceId) return true;
        return item.service_id !== null && item.service_id !== undefined;
    });

    let modifiedServiceItem: SyncedComandaItemInput | null = null;
    let preservedProductsCount = 0;

    const updatedItems = currentItems.map((item, index) => {
        const isService = item.service_id !== null && item.service_id !== undefined;

        if (!isService) {
            preservedProductsCount += 1;
            return { ...item };
        }

        const isTargetService = index === serviceIndex;
        const updatedItem: SyncedComandaItemInput = { ...item };

        if (isTargetService && newService) {
            updatedItem.service_id = newService.id;
            updatedItem.product_name = newService.name;
            updatedItem.unit_price = Number(newService.price) || 0;
        }

        if (newProfessionalId !== undefined && newProfessionalId !== null) {
            updatedItem.staff_id = newProfessionalId;
        }

        if (isTargetService) {
            modifiedServiceItem = updatedItem;
        }

        return updatedItem;
    });

    const nextTotal = updatedItems.reduce((acc, curr) => {
        const qty = Number(curr.quantity) || 1;
        const price = Number(curr.unit_price) || 0;
        return acc + qty * price;
    }, 0);

    return {
        updatedItems,
        preservedProductsCount,
        nextTotal: Math.round(nextTotal * 100) / 100,
        modifiedServiceItem,
    };
}

/**
 * Avalia o cancelamento em cascata de um agendamento com comanda vinculada.
 * - Sem comanda: cancela agendamento diretamente.
 * - Comanda limpa (apenas serviço e sem pagamento): cancelamento direto em cascata.
 * - Comanda com produtos avulsos do balcão: exige confirmação do operador com detalhes dos itens.
 * - Comanda com pagamentos: exige decisão de estorno/remarcação.
 */
export function evaluateCascadingCancel(
    params: EvaluateCascadingCancelParams,
): CascadingCancelEvaluation {
    const { comanda, comandaItems = [], hasPayments = false } = params;

    if (!comanda) {
        return {
            canDirectCancel: true,
            requiresConfirmation: false,
            reason: 'no_comanda',
            productItems: [],
            productsTotal: 0,
            message: 'Sem comanda vinculada ao agendamento.',
        };
    }

    const status = (comanda.status || '').toLowerCase().trim();
    if (status === 'closed' || status === 'paid' || status === 'billed') {
        return {
            canDirectCancel: false,
            requiresConfirmation: true,
            reason: 'already_closed',
            productItems: [],
            productsTotal: 0,
            message: 'A comanda vinculada já foi finalizada ou liquidada.',
        };
    }

    if (hasPayments) {
        return {
            canDirectCancel: false,
            requiresConfirmation: true,
            reason: 'has_payments',
            productItems: [],
            productsTotal: 0,
            message: 'A comanda possui pagamentos registrados. Necessário estornar ou manter crédito.',
        };
    }

    const productItems = comandaItems.filter(
        (item) => item.service_id === null || item.service_id === undefined,
    );

    const productsTotal = productItems.reduce((acc, curr) => {
        const qty = Number(curr.quantity) || 1;
        const price = Number(curr.unit_price) || 0;
        return acc + qty * price;
    }, 0);

    if (productItems.length > 0) {
        return {
            canDirectCancel: false,
            requiresConfirmation: true,
            reason: 'has_products',
            productItems,
            productsTotal: Math.round(productsTotal * 100) / 100,
            message: `A comanda possui ${productItems.length} produto(s) adicionado(s) no balcão (Total: R$ ${productsTotal.toFixed(2)}).`,
        };
    }

    return {
        canDirectCancel: true,
        requiresConfirmation: false,
        reason: 'clean_comanda',
        productItems: [],
        productsTotal: 0,
        message: 'Comanda limpa sem produtos avulsos. Cancelamento atômico direto liberado.',
    };
}
