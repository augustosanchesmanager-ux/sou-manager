import { describe, it, expect } from 'vitest';
import {
    calculateWeightedAverageCost,
    calculateInventoryDiscrepancy,
    filterStockByTab,
    isStockLow,
    calculateComboCostAndPrice,
} from './stockEngine';
import type { ProductStockItem, ComboComponent } from './types';

describe('stockEngine: Regras de Estoque 360 e Custos', () => {
    describe('calculateWeightedAverageCost', () => {
        it('deve calcular o custo médio ponderado corretamente', () => {
            // Estoque atual: 10 unidades a R$ 20 = R$ 200
            // Nova compra: 10 unidades a R$ 30 = R$ 300
            // Total: 20 unidades, Total valor: R$ 500 => Custo médio: R$ 25,00
            const avg = calculateWeightedAverageCost(10, 20, 10, 30);
            expect(avg).toBe(25.00);
        });

        it('deve assumir o novo custo se o estoque atual estiver zerado', () => {
            const avg = calculateWeightedAverageCost(0, 20, 15, 32.50);
            expect(avg).toBe(32.50);
        });

        it('deve manter o custo atual se a nova quantidade for zero', () => {
            const avg = calculateWeightedAverageCost(10, 25, 0, 40);
            expect(avg).toBe(25.00);
        });
    });

    describe('calculateInventoryDiscrepancy', () => {
        it('deve identificar falta de mercadoria (divergência negativa)', () => {
            // Sistema: 10 unidades, Contado: 8 unidades, Custo: R$ 15
            // Diferença: -2, Valor da perda: -R$ 30
            const result = calculateInventoryDiscrepancy(10, 8, 15);
            expect(result.difference).toBe(-2);
            expect(result.divergenceValue).toBe(-30.00);
        });

        it('deve identificar sobra de mercadoria (divergência positiva)', () => {
            // Sistema: 5 unidades, Contado: 7 unidades, Custo: R$ 20
            // Diferença: +2, Valor: +R$ 40
            const result = calculateInventoryDiscrepancy(5, 7, 20);
            expect(result.difference).toBe(2);
            expect(result.divergenceValue).toBe(40.00);
        });
    });

    describe('filterStockByTab', () => {
        const mockProducts: ProductStockItem[] = [
            {
                id: 'p1',
                tenant_id: 't1',
                name: 'Pomada Matte',
                description: 'Finalizador',
                category: 'Finalizadores',
                brand: 'BarberClub',
                cost_price: 15,
                sale_price: 35,
                commission_rate: 10,
                stock_quantity: 12,
                minimum_stock: 5,
                purpose: 'sale',
                active: true,
            },
            {
                id: 'p2',
                tenant_id: 't1',
                name: 'Gola Higiênica (Rolo 100un)',
                description: 'Proteção pescoço',
                category: 'Insumos',
                brand: 'ProtectBarber',
                cost_price: 12,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 4,
                minimum_stock: 5,
                purpose: 'internal_use',
                active: true,
            },
            {
                id: 'p3',
                tenant_id: 't1',
                name: 'Óleo para Barba',
                description: 'Hidratação',
                category: 'Barba',
                brand: 'BeardKing',
                cost_price: 18,
                sale_price: 45,
                commission_rate: 15,
                stock_quantity: 8,
                minimum_stock: 3,
                purpose: 'both',
                active: true,
            },
            {
                id: 'p4',
                tenant_id: 't1',
                name: 'Combo Barba de Respeito',
                description: 'Pomada + Óleo',
                category: 'Combos',
                brand: 'SMG',
                cost_price: 33,
                sale_price: 70,
                commission_rate: 12,
                stock_quantity: 0,
                minimum_stock: 0,
                purpose: 'sale',
                is_combo: true,
                active: true,
            },
        ];

        it('deve listar apenas produtos para venda na aba sale (excluindo combos)', () => {
            const saleItems = filterStockByTab(mockProducts, 'sale');
            expect(saleItems.map((p) => p.id)).toEqual(['p1', 'p3']);
        });

        it('deve listar produtos para uso interno na aba internal_use', () => {
            const useItems = filterStockByTab(mockProducts, 'internal_use');
            expect(useItems.map((p) => p.id)).toEqual(['p2', 'p3']);
        });

        it('deve listar apenas combos na aba combos', () => {
            const combos = filterStockByTab(mockProducts, 'combos');
            expect(combos.map((p) => p.id)).toEqual(['p4']);
        });

        it('deve listar todos os itens físicos na aba audit (conferência)', () => {
            const auditItems = filterStockByTab(mockProducts, 'audit');
            expect(auditItems.map((p) => p.id)).toEqual(['p1', 'p2', 'p3']);
        });
    });

    describe('isStockLow', () => {
        it('deve alertar estoque baixo quando quantidade for menor ou igual ao mínimo', () => {
            const lowProduct: ProductStockItem = {
                id: 'p-low',
                tenant_id: 't1',
                name: 'Lâmina',
                description: '',
                category: 'Insumos',
                brand: 'Wilkinson',
                cost_price: 10,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 3,
                minimum_stock: 5,
                purpose: 'internal_use',
                active: true,
            };
            expect(isStockLow(lowProduct)).toBe(true);
        });

        it('não deve alertar quando quantidade estiver acima do mínimo', () => {
            const okProduct: ProductStockItem = {
                id: 'p-ok',
                tenant_id: 't1',
                name: 'Lâmina',
                description: '',
                category: 'Insumos',
                brand: 'Wilkinson',
                cost_price: 10,
                sale_price: 0,
                commission_rate: 0,
                stock_quantity: 10,
                minimum_stock: 5,
                purpose: 'internal_use',
                active: true,
            };
            expect(isStockLow(okProduct)).toBe(false);
        });
    });

    describe('calculateComboCostAndPrice', () => {
        it('deve somar custo e preço sugerido dos componentes do combo', () => {
            const allProducts: ProductStockItem[] = [
                { id: '1', tenant_id: 't1', name: 'Pomada', description: '', category: '', brand: '', cost_price: 15, sale_price: 35, commission_rate: 0, stock_quantity: 10, minimum_stock: 0, purpose: 'sale', active: true },
                { id: '2', tenant_id: 't1', name: 'Shampoo', description: '', category: '', brand: '', cost_price: 20, sale_price: 45, commission_rate: 0, stock_quantity: 5, minimum_stock: 0, purpose: 'sale', active: true },
            ];

            const components: ComboComponent[] = [
                { product_id: '1', product_name: 'Pomada', quantity: 2 },
                { product_id: '2', product_name: 'Shampoo', quantity: 1 },
            ];

            const result = calculateComboCostAndPrice(components, allProducts);
            // 2 * 15 + 1 * 20 = 50
            expect(result.totalCost).toBe(50.00);
            // 2 * 35 + 1 * 45 = 115
            expect(result.suggestedPrice).toBe(115.00);
        });
    });
});
