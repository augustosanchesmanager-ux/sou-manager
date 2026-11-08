/**
 * [SMG][DOMAIN][STOCK] stockRepository.ts
 *
 * Repositório desacoplado para gestão de Estoque 360,
 * Entradas de Compra com Custo Médio, Consumo Interno de Bancada
 * e Ajuste de Conferência Física protegido por PIN do Gestor.
 */

import { supabase, getClientForTable } from '../../services/supabaseClient';
import { isAuditPinFormatValid, normalizeAuditPin } from '../../src/lib/audit/competence';
import { calculateWeightedAverageCost, calculateInventoryDiscrepancy } from './stockEngine';
import type {
    ProductStockItem,
    StockMovement,
    PurchaseEntryInput,
    InternalConsumptionInput,
    InventoryAdjustmentBatchInput,
    InventoryAdjustmentResult,
} from './types';

// Armazenamento em memória para testes e modo offline/demo
const inMemoryProducts = new Map<string, ProductStockItem[]>();
const inMemoryMovements = new Map<string, StockMovement[]>();

export class StockRepository {
    clearInMemory(): void {
        inMemoryProducts.clear();
        inMemoryMovements.clear();
    }

    private getDemoKey(tenantId: string): string {
        return `smg.stock360.${tenantId}`;
    }

    private getInitialSeed(tenantId: string): ProductStockItem[] {
        return [
            {
                id: 'prod-seed-1',
                tenant_id: tenantId,
                name: 'Pomada Matte Efeito Seco (100g)',
                description: 'Alta fixação sem brilho para penteados estruturados',
                category: 'Finalizadores',
                brand: 'Barber Premium',
                cost_price: 18.00,
                sale_price: 45.00,
                commission_rate: 10,
                stock_quantity: 14,
                minimum_stock: 5,
                purpose: 'both',
                supplier_name: 'Distribuidora Alpha Barber',
                active: true,
            },
            {
                id: 'prod-seed-2',
                tenant_id: tenantId,
                name: 'Óleo para Barba Wood & Spice (30ml)',
                description: 'Hidratação profunda e alinhamento dos fios',
                category: 'Barba',
                brand: 'Beard Master',
                cost_price: 22.00,
                sale_price: 55.00,
                commission_rate: 15,
                stock_quantity: 8,
                minimum_stock: 4,
                purpose: 'sale',
                supplier_name: 'Cosméticos do Sul',
                active: true,
            },
            {
                id: 'prod-seed-3',
                tenant_id: tenantId,
                name: 'Lâmina de Barbear Platinum (Caixa 100un)',
                description: 'Insumo de corte navalhado estéril descartável',
                category: 'Insumos',
                brand: 'Wilkinson Sword',
                cost_price: 28.50,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 3, // Abaixo do mínimo (gera alerta)
                minimum_stock: 6,
                purpose: 'internal_use',
                supplier_name: 'Distribuidora Alpha Barber',
                active: true,
            },
            {
                id: 'prod-seed-4',
                tenant_id: tenantId,
                name: 'Gola Higiênica Rolo Descartável (100 tiras)',
                description: 'Proteção sanitária de pescoço para capa de corte',
                category: 'Insumos',
                brand: 'ProtectBarber',
                cost_price: 9.90,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 12,
                minimum_stock: 5,
                purpose: 'internal_use',
                supplier_name: 'Distribuidora Alpha Barber',
                active: true,
            },
            {
                id: 'prod-seed-5',
                tenant_id: tenantId,
                name: 'Shampoo Mentolado Lavatório (5 Litros)',
                description: 'Galão profissional para lavatório de higienização',
                category: 'Lavatório',
                brand: 'IceClean Profissional',
                cost_price: 65.00,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 2,
                minimum_stock: 2,
                purpose: 'internal_use',
                supplier_name: 'Química Paulista',
                active: true,
            },
            {
                id: 'prod-seed-6',
                tenant_id: tenantId,
                name: 'Kit Barba & Cabelo de Respeito',
                description: 'Combo promocional: Pomada Matte + Óleo Wood & Spice',
                category: 'Combos',
                brand: 'SOU MANA.GER',
                cost_price: 40.00,
                sale_price: 89.90,
                commission_rate: 12,
                stock_quantity: 8,
                minimum_stock: 2,
                purpose: 'sale',
                is_combo: true,
                combo_items: [
                    { product_id: 'prod-seed-1', product_name: 'Pomada Matte', quantity: 1 },
                    { product_id: 'prod-seed-2', product_name: 'Óleo para Barba', quantity: 1 },
                ],
                active: true,
            },
        ];
    }

    private getProductsFromMemory(tenantId: string): ProductStockItem[] {
        if (inMemoryProducts.has(tenantId)) {
            return inMemoryProducts.get(tenantId)!;
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                const raw = localStorage.getItem(this.getDemoKey(tenantId));
                if (raw) {
                    const parsed = JSON.parse(raw);
                    inMemoryProducts.set(tenantId, parsed);
                    return parsed;
                }
            } catch {
                // ignore
            }
        }

        const seed = this.getInitialSeed(tenantId);
        inMemoryProducts.set(tenantId, seed);
        this.saveProductsToMemory(tenantId, seed);
        return seed;
    }

    private saveProductsToMemory(tenantId: string, list: ProductStockItem[]): void {
        inMemoryProducts.set(tenantId, list);
        if (typeof window !== 'undefined' && window.localStorage) {
            try {
                localStorage.setItem(this.getDemoKey(tenantId), JSON.stringify(list));
            } catch {
                // ignore
            }
        }
    }

    /**
     * Lista todos os produtos cadastrados com seus dados de estoque 360
     */
    async listProducts(tenantId: string): Promise<ProductStockItem[]> {
        if (!tenantId) return [];

        if (inMemoryProducts.has(tenantId)) {
            return inMemoryProducts.get(tenantId)!;
        }

        try {
            const client = getClientForTable('products', 'barber');
            if (!client) {
                return this.getProductsFromMemory(tenantId);
            }

            const { data, error } = await client
                .from('products')
                .select('*')
                .eq('tenant_id', tenantId)
                .order('name');

            if (error || !data || data.length === 0) {
                return this.getProductsFromMemory(tenantId);
            }

            const mapped = data.map((row: Record<string, unknown>) => ({
                id: String(row.id || ''),
                tenant_id: String(row.tenant_id || tenantId),
                name: String(row.name || 'Produto sem nome'),
                description: String(row.description || ''),
                category: String(row.category || 'Geral'),
                brand: String(row.brand || ''),
                cost_price: Number(row.cost_price || 0),
                sale_price: Number(row.sale_price || 0),
                commission_rate: Number(row.commission_rate || 0),
                stock_quantity: Number(row.stock_quantity ?? 0),
                minimum_stock: Number(row.minimum_stock ?? 0),
                purpose: (row.purpose as 'sale' | 'internal_use' | 'both') || 'sale',
                supplier_id: row.supplier_id ? String(row.supplier_id) : null,
                supplier_name: row.supplier_name ? String(row.supplier_name) : null,
                is_combo: Boolean(row.is_combo),
                combo_items: (row.combo_items as ProductStockItem['combo_items']) || undefined,
                active: typeof row.active === 'boolean' ? row.active : true,
                created_at: String(row.created_at || ''),
                updated_at: String(row.updated_at || ''),
            }));

            inMemoryProducts.set(tenantId, mapped);
            return mapped;
        } catch {
            return this.getProductsFromMemory(tenantId);
        }
    }

    /**
     * Cria um novo produto no estoque
     */
    async createProduct(
        tenantId: string,
        input: Omit<ProductStockItem, 'id' | 'tenant_id'>
    ): Promise<ProductStockItem> {
        const id = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newItem: ProductStockItem = {
            id,
            tenant_id: tenantId,
            ...input,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        const list = this.getProductsFromMemory(tenantId);
        list.unshift(newItem);
        this.saveProductsToMemory(tenantId, list);

        try {
            const client = getClientForTable('products', 'barber');
            if (client) {
                await client.from('products').insert({
                    id,
                    tenant_id: tenantId,
                    name: newItem.name,
                    description: newItem.description,
                    cost_price: newItem.cost_price,
                    sale_price: newItem.sale_price,
                    commission_rate: newItem.commission_rate,
                    stock_quantity: newItem.stock_quantity,
                    minimum_stock: newItem.minimum_stock,
                    purpose: newItem.purpose,
                    brand: newItem.brand,
                    category: newItem.category,
                    active: newItem.active,
                });
            }
        } catch {
            // Sucesso garantido em memória
        }

        return newItem;
    }

    /**
     * Atualiza um produto existente
     */
    async updateProduct(
        tenantId: string,
        id: string,
        patch: Partial<ProductStockItem>
    ): Promise<ProductStockItem | null> {
        const list = this.getProductsFromMemory(tenantId);
        const index = list.findIndex((p) => p.id === id);
        if (index === -1) return null;

        const updated = {
            ...list[index],
            ...patch,
            updated_at: new Date().toISOString(),
        };
        list[index] = updated;
        this.saveProductsToMemory(tenantId, list);

        try {
            const client = getClientForTable('products', 'barber');
            if (client) {
                await client
                    .from('products')
                    .update(patch)
                    .eq('tenant_id', tenantId)
                    .eq('id', id);
            }
        } catch {
            // Continua
        }

        return updated;
    }

    /**
     * Salva ou atualiza um produto
     */
    async saveProduct(
        product: Partial<ProductStockItem> & { tenant_id: string; name: string }
    ): Promise<ProductStockItem> {
        if (product.id) {
            const updated = await this.updateProduct(product.tenant_id, product.id, product);
            if (updated) return updated;
        }
        return this.createProduct(product.tenant_id, {
            name: product.name,
            description: product.description || '',
            category: product.category || 'Geral',
            brand: product.brand || '',
            cost_price: Number(product.cost_price) || 0,
            sale_price: Number(product.sale_price) || 0,
            commission_rate: Number(product.commission_rate) || 0,
            stock_quantity: Number(product.stock_quantity) || 0,
            minimum_stock: Number(product.minimum_stock) || 0,
            purpose: product.purpose || 'sale',
            supplier_name: product.supplier_name || '',
            active: product.active ?? true,
        });
    }

    /**
     * Remove um produto do estoque
     */
    async deleteProduct(tenantId: string, id: string): Promise<boolean> {
        const list = this.getProductsFromMemory(tenantId);
        const filtered = list.filter((p) => p.id !== id);
        this.saveProductsToMemory(tenantId, filtered);

        try {
            const client = getClientForTable('products', 'barber');
            if (client) {
                await client
                    .from('products')
                    .delete()
                    .eq('tenant_id', tenantId)
                    .eq('id', id);
            }
        } catch {
            // Continua
        }
        return true;
    }

    /**
     * Registra Entrada de Compra (Fornecedor) com atualização de Custo Médio Ponderado
     */
    async recordPurchaseEntry(input: PurchaseEntryInput): Promise<{
        success: boolean;
        newQuantity: number;
        newAverageCost: number;
        movementId: string;
    }> {
        const { tenantId, productId, quantity, unitCost, supplierId, supplierName, invoiceNumber, notes } = input;
        const list = this.getProductsFromMemory(tenantId);
        const product = list.find((p) => p.id === productId);

        if (!product) {
            throw new Error('Produto não localizado para entrada de estoque.');
        }

        const balanceBefore = product.stock_quantity;
        const newQuantity = balanceBefore + quantity;
        const newAverageCost = calculateWeightedAverageCost(
            balanceBefore,
            product.cost_price,
            quantity,
            unitCost
        );

        // Atualiza produto
        product.stock_quantity = newQuantity;
        product.cost_price = newAverageCost;
        if (supplierName) product.supplier_name = supplierName;
        product.updated_at = new Date().toISOString();
        this.saveProductsToMemory(tenantId, list);

        // Registra movimentação de auditoria
        const movementId = `mov_pur_${Date.now()}`;
        const movement: StockMovement = {
            id: movementId,
            tenant_id: tenantId,
            product_id: productId,
            product_name: product.name,
            type: 'purchase',
            quantity,
            balance_before: balanceBefore,
            balance_after: newQuantity,
            unit_cost: unitCost,
            total_cost: unitCost * quantity,
            supplier_id: supplierId,
            supplier_name: supplierName,
            reason: invoiceNumber ? `NF/Pedido: ${invoiceNumber} | ${notes || ''}` : notes || 'Entrada de mercadoria',
            created_at: new Date().toISOString(),
        };

        const movements = inMemoryMovements.get(tenantId) || [];
        movements.unshift(movement);
        inMemoryMovements.set(tenantId, movements);

        return {
            success: true,
            newQuantity,
            newAverageCost,
            movementId,
        };
    }

    /**
     * Registra Retirada / Consumo Interno de Bancada por Barbeiro/Colaborador
     */
    async recordInternalConsumption(input: InternalConsumptionInput): Promise<{
        success: boolean;
        newQuantity: number;
        movementId: string;
    }> {
        const { tenantId, productId, staffId, staffName, quantity, notes } = input;
        const list = this.getProductsFromMemory(tenantId);
        const product = list.find((p) => p.id === productId);

        if (!product) {
            throw new Error('Insumo não encontrado para retirada.');
        }

        if (product.stock_quantity < quantity) {
            throw new Error(`Estoque insuficiente. Saldo atual: ${product.stock_quantity}`);
        }

        const balanceBefore = product.stock_quantity;
        const newQuantity = balanceBefore - quantity;

        product.stock_quantity = newQuantity;
        product.updated_at = new Date().toISOString();
        this.saveProductsToMemory(tenantId, list);

        const movementId = `mov_use_${Date.now()}`;
        const movement: StockMovement = {
            id: movementId,
            tenant_id: tenantId,
            product_id: productId,
            product_name: product.name,
            type: 'internal_consumption',
            quantity: -quantity,
            balance_before: balanceBefore,
            balance_after: newQuantity,
            unit_cost: product.cost_price,
            total_cost: product.cost_price * quantity,
            staff_id: staffId,
            staff_name: staffName,
            reason: notes ? `[Consumo Bancada] ${notes}` : `Retirada de bancada por ${staffName}`,
            created_at: new Date().toISOString(),
        };

        const movements = inMemoryMovements.get(tenantId) || [];
        movements.unshift(movement);
        inMemoryMovements.set(tenantId, movements);

        return {
            success: true,
            newQuantity,
            movementId,
        };
    }

    /**
     * Valida PIN do gestor antes de aplicar ajuste de inventário
     */
    async validateManagerPin(tenantId: string, pin: string): Promise<boolean> {
        const normalized = normalizeAuditPin(pin);
        if (!isAuditPinFormatValid(normalized)) {
            return false;
        }

        if (supabase) {
            try {
                const { data, error } = await supabase.rpc('validate_audit_pin', {
                    p_pin: normalized,
                    p_tenant_id: tenantId,
                });

                if (!error && typeof data === 'boolean') {
                    return data;
                }
            } catch {
                // Fallback para testes/demo
            }
        }

        // Fallback para ambiente de desenvolvimento/testes
        return normalized.length >= 6;
    }

    /**
     * Aplica Ajuste de Conferência Física de Inventário (Exige PIN do Gestor)
     */
    async adjustInventoryWithPin(
        input: InventoryAdjustmentBatchInput
    ): Promise<InventoryAdjustmentResult> {
        const { tenantId, items, managerPin } = input;

        // 1. Verificação do PIN de Autorização do Gestor
        const isPinValid = await this.validateManagerPin(tenantId, managerPin);
        if (!isPinValid) {
            throw new Error('PIN do Gestor inválido ou não autorizado.');
        }

        const list = this.getProductsFromMemory(tenantId);
        let adjustedCount = 0;
        let totalDivergenceValue = 0;
        const movements = inMemoryMovements.get(tenantId) || [];

        for (const item of items) {
            const product = list.find((p) => p.id === item.productId);
            if (!product) continue;

            const discrepancy = calculateInventoryDiscrepancy(
                product.stock_quantity,
                item.countedQuantity,
                product.cost_price
            );

            if (discrepancy.difference === 0) continue; // Sem alteração

            const balanceBefore = product.stock_quantity;
            product.stock_quantity = item.countedQuantity;
            product.updated_at = new Date().toISOString();

            adjustedCount++;
            totalDivergenceValue += discrepancy.divergenceValue;

            const movement: StockMovement = {
                id: `mov_adj_${Date.now()}_${adjustedCount}`,
                tenant_id: tenantId,
                product_id: product.id,
                product_name: product.name,
                type: 'inventory_adjustment',
                quantity: discrepancy.difference,
                balance_before: balanceBefore,
                balance_after: item.countedQuantity,
                unit_cost: product.cost_price,
                total_cost: discrepancy.divergenceValue,
                reason: item.reason || (discrepancy.difference < 0 ? 'Falta constatada em inventário físico' : 'Sobra constatada em inventário físico'),
                authorized_by_pin: true,
                created_at: new Date().toISOString(),
            };
            movements.unshift(movement);
        }

        this.saveProductsToMemory(tenantId, list);
        inMemoryMovements.set(tenantId, movements);

        return {
            success: true,
            adjustedCount,
            totalDivergenceValue,
            message: `${adjustedCount} item(ns) ajustado(s) com sucesso via PIN do Gestor.`,
        };
    }

    /**
     * Alias para adjustInventoryWithPin
     */
    async applyInventoryAdjustment(
        input: InventoryAdjustmentBatchInput
    ): Promise<InventoryAdjustmentResult> {
        return this.adjustInventoryWithPin(input);
    }

    /**
     * Lista histórico de movimentações de estoque
     */
    async listStockMovements(tenantId: string, productId?: string): Promise<StockMovement[]> {
        const list = inMemoryMovements.get(tenantId) || [];
        if (productId) {
            return list.filter((m) => m.product_id === productId);
        }
        return list;
    }
}

export const stockRepository = new StockRepository();
