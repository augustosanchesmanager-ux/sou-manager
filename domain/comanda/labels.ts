/**
 * [SMG][DOMAIN][COMANDA] labels
 *
 * RESPONSABILIDADE: Funções de labels e classificação de comandas.
 *   - Label de forma de pagamento
 *   - Detecção de item de serviço
 *
 * USO:
 *   - Importar de application/ ou pages/
 *   - Zero dependência de React, UI, ou Supabase
 */

// ─── Types ───────────────────────────────────────────────────────

export interface ComandaLike {
    payment_method?: string | null;
    closure_mode?: string | null;
    financial_effect?: boolean | null;
}

export interface ServiceItemLike {
    service_id?: string | null;
    item_type?: string | null;
    type?: string | null;
}

// ─── Payment Method Label ────────────────────────────────────────

/**
 * Retorna o label amigável da forma de pagamento de uma comanda.
 *
 * Regras:
 * - Se closure_mode é 'legacy_membership' ou financial_effect é false → 'Club dos Chefes'
 * - Mapeamento padrão: credit → Crédito, debit → Débito, cash → Dinheiro, pix → Pix, other → Outro
 * - Fallback: valor raw ou 'Não informado'
 */
export const getPaymentMethodLabel = (comanda: ComandaLike): string => {
    if (comanda.closure_mode === 'legacy_membership' || comanda.financial_effect === false) {
        return 'Club dos Chefes';
    }

    const method = (comanda.payment_method || '').toLowerCase();

    switch (method) {
        case 'credit': return 'Crédito';
        case 'debit': return 'Débito';
        case 'cash': return 'Dinheiro';
        case 'pix': return 'Pix';
        case 'other': return 'Outro';
        default: return comanda.payment_method || 'Não informado';
    }
};

/**
 * Retorna o label amigável da forma de pagamento a partir de uma string simples.
 */
export const getPaymentMethodLabelFromString = (method: string): string => {
    const normalized = (method || '').toLowerCase();

    switch (normalized) {
        case 'credit': return 'Crédito';
        case 'debit': return 'Débito';
        case 'cash': return 'Dinheiro';
        case 'pix': return 'Pix';
        case 'other': return 'Outro';
        case 'legacy_membership': return 'Club dos Chefes';
        default: return method || 'Não informado';
    }
};

// ─── Service Item Detection ──────────────────────────────────────

/**
 * Detecta se um item de comanda é um serviço (não produto).
 *
 * Regras:
 * - Se possui service_id → é serviço
 * - Se item_type ou type é 'service', 'servico' ou 'serviço' → é serviço
 */
export const isServiceItem = (item: ServiceItemLike): boolean => {
    if (item.service_id) return true;

    const t = (item.item_type || item.type || '').toLowerCase();
    return t === 'service' || t === 'servico' || t === 'serviço';
};
