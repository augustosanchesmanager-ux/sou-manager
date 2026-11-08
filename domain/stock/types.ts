/**
 * [SMG][DOMAIN][STOCK] types.ts
 *
 * Modelagem de tipos para o módulo de Estoque 360, Consumo Interno de Bancada,
 * Combos e Conferência de Inventário com PIN do Gestor.
 */

export type ProductPurpose = 'sale' | 'internal_use' | 'both';

export type StockMovementType =
    | 'purchase'              // Entrada de mercadoria / compra de fornecedor
    | 'internal_consumption' // Retirada de bancada / lavatório por colaborador
    | 'inventory_adjustment' // Ajuste de inventário / contagem física
    | 'sale'                 // Baixa automática por venda no caixa/comanda
    | 'loss';                // Perda, avaria, quebra ou vencimento

export interface ComboComponent {
    product_id: string;
    product_name: string;
    quantity: number;
}

export interface ProductStockItem {
    id: string;
    tenant_id: string;
    name: string;
    description: string;
    category: string;
    brand: string;
    cost_price: number;
    sale_price: number;
    commission_rate: number; // Porcentagem de comissão do barbeiro (ex: 10 = 10%)
    stock_quantity: number;
    minimum_stock: number;
    purpose: ProductPurpose;
    supplier_id?: string | null;
    supplier_name?: string | null;
    is_combo?: boolean;
    combo_items?: ComboComponent[];
    active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface StockMovement {
    id: string;
    tenant_id: string;
    product_id: string;
    product_name: string;
    type: StockMovementType;
    quantity: number; // Positivo para entrada, negativo para saída
    balance_before: number;
    balance_after: number;
    unit_cost: number;
    total_cost: number;
    staff_id?: string | null;
    staff_name?: string | null;
    supplier_id?: string | null;
    supplier_name?: string | null;
    reason?: string | null;
    authorized_by_pin?: boolean;
    created_at: string;
}

export interface InventoryAuditItem {
    product_id: string;
    product_name: string;
    category: string;
    purpose: ProductPurpose;
    system_quantity: number;
    counted_quantity: number;
    difference: number; // counted - system (negativo = falta/perda, positivo = sobra)
    unit_cost: number;
    divergence_value: number; // difference * unit_cost
}

export interface PurchaseEntryInput {
    tenantId: string;
    productId: string;
    quantity: number;
    unitCost: number;
    supplierId?: string | null;
    supplierName?: string | null;
    invoiceNumber?: string | null;
    notes?: string | null;
}

export interface InternalConsumptionInput {
    tenantId: string;
    productId: string;
    staffId: string;
    staffName: string;
    quantity: number;
    notes?: string | null;
}

export interface InventoryAdjustmentBatchInput {
    tenantId: string;
    items: Array<{
        productId: string;
        countedQuantity: number;
        reason?: string;
    }>;
    managerPin: string;
}

export interface InventoryAdjustmentResult {
    success: boolean;
    adjustedCount: number;
    totalDivergenceValue: number;
    message: string;
}
