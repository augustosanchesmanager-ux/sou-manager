import { describe, it, expect, beforeEach, vi } from 'vitest';
import { stockRepository } from './stockRepository';

describe('stockRepository: Operações de Estoque 360 e PIN do Gestor', () => {
    const tenantId = 'tenant-stock-test';

    beforeEach(() => {
        vi.clearAllMocks();
        stockRepository.clearInMemory();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
        } catch {
            // ignore
        }
    });

    it('deve listar os produtos padrão de semente quando vazio', async () => {
        const products = await stockRepository.listProducts(tenantId);
        expect(Array.isArray(products)).toBe(true);
        expect(products.length).toBeGreaterThan(0);
        expect(products.some((p) => p.purpose === 'internal_use')).toBe(true);
        expect(products.some((p) => p.is_combo === true)).toBe(true);
    });

    it('deve registrar entrada de compra e recalcular custo médio ponderado', async () => {
        const products = await stockRepository.listProducts(tenantId);
        const target = products[0]; // Pomada Matte: 14 un a R$ 18 = 252

        // Compra: 6 unidades a R$ 28 = 168
        // Novo total: 20 un, Total R$ 420 => Custo médio: R$ 21,00
        const result = await stockRepository.recordPurchaseEntry({
            tenantId,
            productId: target.id,
            quantity: 6,
            unitCost: 28.00,
            supplierName: 'Distribuidora Teste',
            invoiceNumber: 'NF-1020',
        });

        expect(result.success).toBe(true);
        expect(result.newQuantity).toBe(20);
        expect(result.newAverageCost).toBe(21.00);

        const movements = await stockRepository.listStockMovements(tenantId, target.id);
        expect(movements.length).toBe(1);
        expect(movements[0].type).toBe('purchase');
    });

    it('deve registrar consumo interno de bancada e abater quantidade', async () => {
        const products = await stockRepository.listProducts(tenantId);
        // Gola higiênica tem 12 unidades
        const gola = products.find((p) => p.purpose === 'internal_use')!;
        const initialQty = gola.stock_quantity;

        const result = await stockRepository.recordInternalConsumption({
            tenantId,
            productId: gola.id,
            staffId: 'staff-1',
            staffName: 'Barbeiro Thiago',
            quantity: 2,
            notes: 'Uso na bancada 2',
        });

        expect(result.success).toBe(true);
        expect(result.newQuantity).toBe(initialQty - 2);

        const movements = await stockRepository.listStockMovements(tenantId, gola.id);
        expect(movements.length).toBe(1);
        expect(movements[0].type).toBe('internal_consumption');
        expect(movements[0].staff_name).toBe('Barbeiro Thiago');
    });

    it('deve rejeitar ajuste de inventário se o PIN do gestor for inválido', async () => {
        await expect(
            stockRepository.adjustInventoryWithPin({
                tenantId,
                items: [{ productId: 'prod-seed-1', countedQuantity: 20 }],
                managerPin: '123', // Formato inválido (< 6 dígitos)
            })
        ).rejects.toThrow('PIN do Gestor inválido ou não autorizado.');
    });

    it('deve aplicar ajuste de inventário quando o PIN for válido', async () => {
        const result = await stockRepository.adjustInventoryWithPin({
            tenantId,
            items: [
                { productId: 'prod-seed-1', countedQuantity: 25, reason: 'Contagem física conferida' },
            ],
            managerPin: '123456',
        });

        expect(result.success).toBe(true);
        expect(result.adjustedCount).toBe(1);

        const products = await stockRepository.listProducts(tenantId);
        const updated = products.find((p) => p.id === 'prod-seed-1');
        expect(updated?.stock_quantity).toBe(25);
    });
});
