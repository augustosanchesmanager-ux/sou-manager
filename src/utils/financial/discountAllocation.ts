/**
 * src/utils/financial/discountAllocation.ts
 *
 * Motor puro e determinístico de rateio de descontos e cálculo de comissão.
 * Implementa Penny Reconciliation (reconciliação de centavos) para garantir
 * que a soma dos descontos rateados seja 100% idêntica ao desconto global da comanda,
 * eliminando resíduos de dízimas periódicas.
 *
 * Invariante contábil:
 * catalog_price - total_discount = applied_amount
 * commission_amount = roundCurrency(applied_amount * (commission_rate / 100))
 */

export interface RawComandaItem {
  id: string;
  comanda_id: string;
  item_name: string;
  item_type: 'service' | 'product' | 'club_service';
  barber_id: string;
  barber_name: string;
  quantity: number;
  unit_price: number; // Preço unitário de tabela
  item_discount?: number; // Desconto direto aplicado no item (opcional)
  commission_rate: number; // Percentual de comissão (0 a 100)
}

export interface AllocatedComandaItem extends RawComandaItem {
  catalog_price: number; // roundCurrency(unit_price * quantity)
  direct_discount: number; // Desconto direto no item (limitado ao catalog_price)
  allocated_order_discount: number; // Fatia proporcional do desconto global da comanda
  total_discount: number; // roundCurrency(direct_discount + allocated_order_discount)
  applied_amount: number; // roundCurrency(catalog_price - total_discount) -> Valor real pago
  commission_amount: number; // roundCurrency(applied_amount * (commission_rate / 100))
}

export interface AllocationSummary {
  totalCatalog: number;
  totalDirectDiscount: number;
  totalAllocatedGlobalDiscount: number;
  totalDiscount: number;
  totalApplied: number;
  totalCommission: number;
}

/**
 * Arredonda um valor numérico para exatamente 2 casas decimais usando Number.EPSILON
 * para evitar imprecisões de ponto flutuante binário da especificação IEEE 754.
 */
export function roundCurrency(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Rateia descontos diretos de item e desconto global da comanda proporcionalmente
 * ao peso de cada item com saldo positivo, aplicando reconciliação do último centavo
 * (Penny Reconciliation) para evitar sobras ou faltas em dízimas periódicas.
 *
 * @param items Lista de itens brutos da comanda
 * @param comandaGlobalDiscount Valor do desconto global da comanda (default 0)
 * @returns Lista de itens com os descontos rateados e comissões calculadas
 */
export function allocateComandaDiscounts(
  items: RawComandaItem[],
  comandaGlobalDiscount: number = 0
): AllocatedComandaItem[] {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  // 1. Passo inicial: calcular catalog_price, direct_discount e saldo líquido antes do global
  interface PreCalculatedItem {
    raw: RawComandaItem;
    catalogPrice: number;
    directDiscount: number;
    netBeforeGlobal: number;
  }

  const precalculated: PreCalculatedItem[] = items.map((item) => {
    const qty = Math.max(0, item.quantity ?? 1);
    const unitPrice = Math.max(0, item.unit_price ?? 0);
    const catalogPrice = roundCurrency(unitPrice * qty);

    const directDiscountCandidate = Math.max(0, item.item_discount ?? 0);
    const directDiscount = roundCurrency(Math.min(catalogPrice, directDiscountCandidate));
    const netBeforeGlobal = roundCurrency(Math.max(0, catalogPrice - directDiscount));

    return {
      raw: item,
      catalogPrice,
      directDiscount,
      netBeforeGlobal,
    };
  });

  // 2. Determinar a base total elegível para rateio do desconto global
  const totalNetBeforeGlobal = roundCurrency(
    precalculated.reduce((acc, curr) => acc + curr.netBeforeGlobal, 0)
  );

  // Desconto global efetivo não pode ser negativo nem superar o total líquido disponível
  const safeGlobalDiscount = Math.max(0, comandaGlobalDiscount ?? 0);
  const effectiveGlobalDiscount = roundCurrency(
    Math.min(safeGlobalDiscount, totalNetBeforeGlobal)
  );

  // 3. Identificar índices dos itens elegíveis (itens com saldo positivo > 0)
  const eligibleIndices: number[] = [];
  precalculated.forEach((item, index) => {
    if (item.netBeforeGlobal > 0) {
      eligibleIndices.push(index);
    }
  });

  const allocatedGlobalDiscounts = new Array<number>(items.length).fill(0);

  if (effectiveGlobalDiscount > 0 && eligibleIndices.length > 0 && totalNetBeforeGlobal > 0) {
    let remainingDiscountToAllocate = effectiveGlobalDiscount;

    for (let k = 0; k < eligibleIndices.length; k++) {
      const itemIndex = eligibleIndices[k];
      const currentItem = precalculated[itemIndex];
      const isLastEligible = k === eligibleIndices.length - 1;

      if (!isLastEligible) {
        // Cálculo proporcional do peso do item sobre a base líquida elegível
        const weight = currentItem.netBeforeGlobal / totalNetBeforeGlobal;
        const rawShare = weight * effectiveGlobalDiscount;
        let share = roundCurrency(rawShare);

        // Não pode exceder nem o saldo líquido do item nem o desconto remanescente
        share = Math.min(share, currentItem.netBeforeGlobal);
        share = Math.min(share, remainingDiscountToAllocate);

        allocatedGlobalDiscounts[itemIndex] = share;
        remainingDiscountToAllocate = roundCurrency(remainingDiscountToAllocate - share);
      } else {
        // Penny Reconciliation: O último item elegível absorve exatamente o resíduo do centavo
        const finalShare = roundCurrency(
          Math.min(remainingDiscountToAllocate, currentItem.netBeforeGlobal)
        );
        allocatedGlobalDiscounts[itemIndex] = finalShare;
        remainingDiscountToAllocate = roundCurrency(remainingDiscountToAllocate - finalShare);
      }
    }
  }

  // 4. Montar os itens finais com reconciliação garantida
  return precalculated.map((prep, index) => {
    const raw = prep.raw;
    const catalogPrice = prep.catalogPrice;
    const directDiscount = prep.directDiscount;
    const allocatedOrderDiscount = allocatedGlobalDiscounts[index];

    const totalDiscount = roundCurrency(directDiscount + allocatedOrderDiscount);
    const appliedAmount = roundCurrency(Math.max(0, catalogPrice - totalDiscount));

    const safeCommissionRate = Math.max(0, raw.commission_rate ?? 0);
    const commissionAmount = roundCurrency(appliedAmount * (safeCommissionRate / 100));

    return {
      ...raw,
      catalog_price: catalogPrice,
      direct_discount: directDiscount,
      allocated_order_discount: allocatedOrderDiscount,
      total_discount: totalDiscount,
      applied_amount: appliedAmount,
      commission_amount: commissionAmount,
    };
  });
}

/**
 * Calcula o sumário financeiro consolidado de uma lista de itens rateados.
 */
export function calculateAllocationSummary(
  items: AllocatedComandaItem[]
): AllocationSummary {
  return items.reduce<AllocationSummary>(
    (acc, curr) => ({
      totalCatalog: roundCurrency(acc.totalCatalog + curr.catalog_price),
      totalDirectDiscount: roundCurrency(acc.totalDirectDiscount + curr.direct_discount),
      totalAllocatedGlobalDiscount: roundCurrency(
        acc.totalAllocatedGlobalDiscount + curr.allocated_order_discount
      ),
      totalDiscount: roundCurrency(acc.totalDiscount + curr.total_discount),
      totalApplied: roundCurrency(acc.totalApplied + curr.applied_amount),
      totalCommission: roundCurrency(acc.totalCommission + curr.commission_amount),
    }),
    {
      totalCatalog: 0,
      totalDirectDiscount: 0,
      totalAllocatedGlobalDiscount: 0,
      totalDiscount: 0,
      totalApplied: 0,
      totalCommission: 0,
    }
  );
}
