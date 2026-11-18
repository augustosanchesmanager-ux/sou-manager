import { describe, it, expect } from 'vitest';
import {
  allocateComandaDiscounts,
  roundCurrency,
  calculateAllocationSummary,
  type RawComandaItem,
} from '../discountAllocation';

describe('Motor de Rateio de Descontos e Comissão (allocateComandaDiscounts)', () => {
  it('1. deve manter applied_amount === catalog_price quando a comanda não possui nenhum desconto', () => {
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-1',
        item_name: 'Corte Cabelo',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 50.0,
        commission_rate: 50,
      },
      {
        id: 'item-2',
        comanda_id: 'cmd-1',
        item_name: 'Pomada Matte',
        item_type: 'product',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 2,
        unit_price: 30.0,
        commission_rate: 10,
      },
    ];

    const result = allocateComandaDiscounts(items, 0);

    expect(result).toHaveLength(2);

    // Item 1: Corte R$ 50
    expect(result[0].catalog_price).toBe(50.0);
    expect(result[0].direct_discount).toBe(0.0);
    expect(result[0].allocated_order_discount).toBe(0.0);
    expect(result[0].total_discount).toBe(0.0);
    expect(result[0].applied_amount).toBe(50.0);
    expect(result[0].commission_amount).toBe(25.0); // 50% de 50.00

    // Item 2: Pomada 2x 30 = 60
    expect(result[1].catalog_price).toBe(60.0);
    expect(result[1].direct_discount).toBe(0.0);
    expect(result[1].allocated_order_discount).toBe(0.0);
    expect(result[1].total_discount).toBe(0.0);
    expect(result[1].applied_amount).toBe(60.0);
    expect(result[1].commission_amount).toBe(6.0); // 10% de 60.00
  });

  it('2. deve aplicar desconto direto apenas no item correspondente sem afetar os outros itens', () => {
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-2',
        item_name: 'Corte Cabelo',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 60.0,
        item_discount: 10.0, // Desconto direto de R$ 10
        commission_rate: 50,
      },
      {
        id: 'item-2',
        comanda_id: 'cmd-2',
        item_name: 'Barba Terapia',
        item_type: 'service',
        barber_id: 'barber-2',
        barber_name: 'Everton',
        quantity: 1,
        unit_price: 40.0,
        commission_rate: 40,
      },
    ];

    const result = allocateComandaDiscounts(items, 0);

    // Item 1: 60 - 10 = 50. Comissão 50% = 25.00
    expect(result[0].catalog_price).toBe(60.0);
    expect(result[0].direct_discount).toBe(10.0);
    expect(result[0].allocated_order_discount).toBe(0.0);
    expect(result[0].total_discount).toBe(10.0);
    expect(result[0].applied_amount).toBe(50.0);
    expect(result[0].commission_amount).toBe(25.0);

    // Item 2: 40 - 0 = 40. Comissão 40% = 16.00
    expect(result[1].catalog_price).toBe(40.0);
    expect(result[1].direct_discount).toBe(0.0);
    expect(result[1].allocated_order_discount).toBe(0.0);
    expect(result[1].total_discount).toBe(0.0);
    expect(result[1].applied_amount).toBe(40.0);
    expect(result[1].commission_amount).toBe(16.0);
  });

  it('3. deve ratear desconto global proporcionalmente em itens com pesos diferentes e calcular comissões sobre o valor aplicado', () => {
    // Corte R$ 60 + Barba R$ 40 = R$ 100, Desconto global de R$ 10
    // Proporção: 60% e 40% -> Desconto: R$ 6,00 e R$ 4,00
    // Valor aplicado: R$ 54,00 e R$ 36,00. Comissão 50%: R$ 27,00 e R$ 18,00.
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-3',
        item_name: 'Corte Cabelo',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 60.0,
        commission_rate: 50,
      },
      {
        id: 'item-2',
        comanda_id: 'cmd-3',
        item_name: 'Barba Tradicional',
        item_type: 'service',
        barber_id: 'barber-2',
        barber_name: 'Everton',
        quantity: 1,
        unit_price: 40.0,
        commission_rate: 50,
      },
    ];

    const result = allocateComandaDiscounts(items, 10.0);

    expect(result[0].catalog_price).toBe(60.0);
    expect(result[0].direct_discount).toBe(0.0);
    expect(result[0].allocated_order_discount).toBe(6.0);
    expect(result[0].total_discount).toBe(6.0);
    expect(result[0].applied_amount).toBe(54.0);
    expect(result[0].commission_amount).toBe(27.0); // 50% de 54

    expect(result[1].catalog_price).toBe(40.0);
    expect(result[1].direct_discount).toBe(0.0);
    expect(result[1].allocated_order_discount).toBe(4.0);
    expect(result[1].total_discount).toBe(4.0);
    expect(result[1].applied_amount).toBe(36.0);
    expect(result[1].commission_amount).toBe(18.0); // 50% de 36

    const summary = calculateAllocationSummary(result);
    expect(summary.totalCatalog).toBe(100.0);
    expect(summary.totalAllocatedGlobalDiscount).toBe(10.0);
    expect(summary.totalDiscount).toBe(10.0);
    expect(summary.totalApplied).toBe(90.0);
    expect(summary.totalCommission).toBe(45.0);
  });

  it('4. deve realizar Penny Reconciliation exata em dízimas periódicas sem sobrar nem faltar centavos', () => {
    // 3 itens de R$ 30,00 com desconto global de R$ 10,00
    // Divisão matemática: 3.3333... por item
    // Penny reconciliation esperada: 3.33, 3.33 e 3.34
    // Valores aplicados esperados: 26.67, 26.67 e 26.66 = R$ 80,00 exatos
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-4',
        item_name: 'Serviço A',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 30.0,
        commission_rate: 50,
      },
      {
        id: 'item-2',
        comanda_id: 'cmd-4',
        item_name: 'Serviço B',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 30.0,
        commission_rate: 50,
      },
      {
        id: 'item-3',
        comanda_id: 'cmd-4',
        item_name: 'Serviço C',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 30.0,
        commission_rate: 50,
      },
    ];

    const result = allocateComandaDiscounts(items, 10.0);

    expect(result).toHaveLength(3);

    // Item 1
    expect(result[0].allocated_order_discount).toBe(3.33);
    expect(result[0].applied_amount).toBe(26.67);

    // Item 2
    expect(result[1].allocated_order_discount).toBe(3.33);
    expect(result[1].applied_amount).toBe(26.67);

    // Item 3 (absorve o resíduo de R$ 0,01)
    expect(result[2].allocated_order_discount).toBe(3.34);
    expect(result[2].applied_amount).toBe(26.66);

    // Somas exatas
    const sumDiscounts = roundCurrency(
      result.reduce((acc, it) => acc + it.total_discount, 0)
    );
    const sumApplied = roundCurrency(
      result.reduce((acc, it) => acc + it.applied_amount, 0)
    );

    expect(sumDiscounts).toBe(10.0);
    expect(sumApplied).toBe(80.0);
  });

  it('5. deve ignorar itens do Clube dos Chefes (R$ 0,00) no rateio e destinar 100% do desconto aos itens pagos', () => {
    // Item 1 (Clube): R$ 0,00
    // Item 2 (Produto): R$ 40,00
    // Desconto global: R$ 5,00 -> deve recair integralmente no Item 2
    const items: RawComandaItem[] = [
      {
        id: 'club-item',
        comanda_id: 'cmd-5',
        item_name: 'Corte Assinatura Clube',
        item_type: 'club_service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 0.0,
        commission_rate: 50,
      },
      {
        id: 'paid-product',
        comanda_id: 'cmd-5',
        item_name: 'Shampoo Especial',
        item_type: 'product',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 40.0,
        commission_rate: 20,
      },
    ];

    const result = allocateComandaDiscounts(items, 5.0);

    // Item do clube tem peso 0 e recebe 0 de desconto
    expect(result[0].catalog_price).toBe(0.0);
    expect(result[0].direct_discount).toBe(0.0);
    expect(result[0].allocated_order_discount).toBe(0.0);
    expect(result[0].total_discount).toBe(0.0);
    expect(result[0].applied_amount).toBe(0.0);
    expect(result[0].commission_amount).toBe(0.0);

    // Produto absorve todos os R$ 5,00
    expect(result[1].catalog_price).toBe(40.0);
    expect(result[1].direct_discount).toBe(0.0);
    expect(result[1].allocated_order_discount).toBe(5.0);
    expect(result[1].total_discount).toBe(5.0);
    expect(result[1].applied_amount).toBe(35.0);
    expect(result[1].commission_amount).toBe(7.0); // 20% de 35.00
  });

  it('6. deve proteger contra valores negativos se o desconto global for maior que o valor da comanda', () => {
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-6',
        item_name: 'Sobrancelha',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 25.0,
        commission_rate: 50,
      },
    ];

    // Desconto de R$ 40,00 em um item de R$ 25,00
    const result = allocateComandaDiscounts(items, 40.0);

    expect(result[0].catalog_price).toBe(25.0);
    expect(result[0].direct_discount).toBe(0.0);
    // Desconto alocado é limitado a 25.00 (não pode ultrapassar o saldo líquido)
    expect(result[0].allocated_order_discount).toBe(25.0);
    expect(result[0].total_discount).toBe(25.0);
    expect(result[0].applied_amount).toBe(0.0); // NUNCA negativo
    expect(result[0].commission_amount).toBe(0.0); // NUNCA negativo
  });

  it('7. deve suportar combinação de desconto direto + desconto global proporcional', () => {
    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-7',
        item_name: 'Corte Premium',
        item_type: 'service',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 1,
        unit_price: 100.0,
        item_discount: 20.0, // Saldo líquido = 80.00 (peso 80/100 = 80%)
        commission_rate: 50,
      },
      {
        id: 'item-2',
        comanda_id: 'cmd-7',
        item_name: 'Bebida Energética',
        item_type: 'product',
        barber_id: 'barber-1',
        barber_name: 'Carlos',
        quantity: 2,
        unit_price: 10.0, // 2x 10 = 20.00 (peso 20/100 = 20%)
        commission_rate: 10,
      },
    ];

    // Desconto global de R$ 10,00 sobre base líquida de R$ 100,00
    // Item 1 recebe 80% de 10 = 8.00 -> Desconto total: 20 + 8 = 28.00 -> Aplicado: 72.00
    // Item 2 recebe 20% de 10 = 2.00 -> Desconto total: 0 + 2 = 2.00 -> Aplicado: 18.00
    const result = allocateComandaDiscounts(items, 10.0);

    expect(result[0].catalog_price).toBe(100.0);
    expect(result[0].direct_discount).toBe(20.0);
    expect(result[0].allocated_order_discount).toBe(8.0);
    expect(result[0].total_discount).toBe(28.0);
    expect(result[0].applied_amount).toBe(72.0);
    expect(result[0].commission_amount).toBe(36.0); // 50% de 72.00

    expect(result[1].catalog_price).toBe(20.0);
    expect(result[1].direct_discount).toBe(0.0);
    expect(result[1].allocated_order_discount).toBe(2.0);
    expect(result[1].total_discount).toBe(2.0);
    expect(result[1].applied_amount).toBe(18.0);
    expect(result[1].commission_amount).toBe(1.8); // 10% de 18.00

    const summary = calculateAllocationSummary(result);
    expect(summary.totalCatalog).toBe(120.0);
    expect(summary.totalDirectDiscount).toBe(20.0);
    expect(summary.totalAllocatedGlobalDiscount).toBe(10.0);
    expect(summary.totalDiscount).toBe(30.0);
    expect(summary.totalApplied).toBe(90.0);
    expect(summary.totalCommission).toBe(37.8);
  });

  it('8. deve lidar com entradas vazias e parâmetros inválidos com segurança', () => {
    expect(allocateComandaDiscounts([])).toEqual([]);
    expect(allocateComandaDiscounts([], 50)).toEqual([]);

    const items: RawComandaItem[] = [
      {
        id: 'item-1',
        comanda_id: 'cmd-8',
        item_name: 'Teste',
        item_type: 'service',
        barber_id: 'b-1',
        barber_name: 'Barbeiro',
        quantity: -1, // Inválido -> tratado como 0
        unit_price: -50, // Inválido -> tratado como 0
        commission_rate: -10, // Inválido -> tratado como 0
      },
    ];

    const result = allocateComandaDiscounts(items, -10); // Desconto negativo -> tratado como 0
    expect(result[0].catalog_price).toBe(0.0);
    expect(result[0].direct_discount).toBe(0.0);
    expect(result[0].allocated_order_discount).toBe(0.0);
    expect(result[0].total_discount).toBe(0.0);
    expect(result[0].applied_amount).toBe(0.0);
    expect(result[0].commission_amount).toBe(0.0);
  });
});
