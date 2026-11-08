/**
 * [SMG][DOMAIN][STOCK] stockEngine.ts
 *
 * Motor puro de regras de estoque 360, custo médio ponderado,
 * divergências de inventário e segregação por finalidade de uso.
 */

import type {
    ProductStockItem,
    ProductPurpose,
    ComboComponent,
} from './types';

export function roundToDecimals(value: number, decimals = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Calcula o custo médio ponderado na entrada de uma nova compra de mercadoria.
 */
export function calculateWeightedAverageCost(
    currentQuantity: number,
    currentCost: number,
    newQuantity: number,
    newCost: number
): number {
    if (newQuantity <= 0) return roundToDecimals(currentCost);

    const safeCurrentQty = Math.max(0, currentQuantity);
    const safeCurrentCost = Math.max(0, currentCost);
    const safeNewCost = Math.max(0, newCost);

    if (safeCurrentQty === 0) {
        return roundToDecimals(safeNewCost);
    }

    const currentTotalValue = safeCurrentQty * safeCurrentCost;
    const newTotalValue = newQuantity * safeNewCost;
    const totalQuantity = safeCurrentQty + newQuantity;

    if (totalQuantity <= 0) return roundToDecimals(safeNewCost);

    const avg = (currentTotalValue + newTotalValue) / totalQuantity;
    return roundToDecimals(avg);
}

/**
 * Calcula a divergência física de inventário (Sobras / Faltas).
 * difference = counted - system
 * Negativo: Falta/Perda física
 * Positivo: Sobra física
 */
export function calculateInventoryDiscrepancy(
    systemQuantity: number,
    countedQuantity: number,
    unitCost: number
): { difference: number; divergenceValue: number } {
    const safeSys = Number(systemQuantity) || 0;
    const safeCount = Number(countedQuantity) || 0;
    const safeCost = Number(unitCost) || 0;

    const difference = safeCount - safeSys;
    const divergenceValue = roundToDecimals(difference * safeCost);

    return {
        difference,
        divergenceValue,
    };
}

/**
 * Verifica se o produto atingiu o nível de alerta de estoque mínimo.
 */
export function isStockLow(product: ProductStockItem): boolean {
    if (product.minimum_stock <= 0) return false;
    return product.stock_quantity <= product.minimum_stock;
}

/**
 * Filtra produtos com base na aba visual do AppBarber:
 * - 'sale': Produtos disponíveis para venda ('sale' ou 'both') e que não são combos
 * - 'internal_use': Produtos para uso de bancada/lavatório ('internal_use' ou 'both')
 * - 'combos': Apenas produtos marcados como combos promocionais
 * - 'audit': Todos os itens físicos gerenciáveis em estoque
 */
export function filterStockByTab(
    products: ProductStockItem[],
    tab: 'sale' | 'internal_use' | 'combos' | 'audit'
): ProductStockItem[] {
    return products.filter((p) => {
        if (!p.active) return false;

        if (tab === 'combos') {
            return Boolean(p.is_combo);
        }

        // Combos não entram nas abas normais de itens físicos
        if (p.is_combo) return false;

        if (tab === 'sale') {
            return p.purpose === 'sale' || p.purpose === 'both';
        }

        if (tab === 'internal_use') {
            return p.purpose === 'internal_use' || p.purpose === 'both';
        }

        // Aba audit / conferência inclui todos os itens físicos
        return true;
    });
}

/**
 * Calcula o custo total e preço sugerido de um combo com base nos seus componentes.
 */
export function calculateComboCostAndPrice(
    comboItems: ComboComponent[],
    allProducts: ProductStockItem[]
): { totalCost: number; suggestedPrice: number } {
    let totalCost = 0;
    let suggestedPrice = 0;

    const productMap = new Map<string, ProductStockItem>(
        allProducts.map((p) => [p.id, p])
    );

    for (const item of comboItems) {
        const prod = productMap.get(item.product_id);
        if (prod) {
            const qty = item.quantity || 1;
            totalCost += (prod.cost_price || 0) * qty;
            suggestedPrice += (prod.sale_price || 0) * qty;
        }
    }

    return {
        totalCost: roundToDecimals(totalCost),
        suggestedPrice: roundToDecimals(suggestedPrice),
    };
}
