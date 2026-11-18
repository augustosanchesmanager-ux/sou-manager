import type { ProductPurpose } from '../../domain/stock/types';

export type StockTab = 'sale' | 'internal_use' | 'combos' | 'audit';

export type StockStatusFilter = 'all' | 'low' | 'out';

export interface ProductsMetrics {
    totalItems: number;
    totalStockValue: number;
    internalUseCount: number;
    lowStockCount: number;
}

export interface ProductFormState {
    name: string;
    description: string;
    category: string;
    brand: string;
    cost_price: number;
    sale_price: number;
    commission_rate: number;
    stock_quantity: number;
    minimum_stock: number;
    purpose: ProductPurpose;
    supplier_name: string;
    active: boolean;
}

export interface PurchaseFormState {
    productId: string;
    quantity: number;
    unitCost: number;
    supplierName: string;
    invoiceNumber: string;
    notes: string;
}

export interface ConsumptionFormState {
    productId: string;
    staffId: string;
    quantity: number;
    notes: string;
}
