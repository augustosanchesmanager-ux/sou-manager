/**
 * comboCalculation.ts
 * Lógica pura para composição e precificação de combos inteligentes (Fase 7.1).
 * Calcula a soma de preços e durações dos serviços componentes, aplica desconto
 * promocional de pacote (fixo ou percentual) e calcula a economia final.
 */

export interface ServiceItemForCombo {
  id: string;
  name: string;
  price: number;
  duration: number;
}

export type ComboDiscountType = 'fixed' | 'percentage';

export interface ComboTotalsResult {
  sumPrice: number;
  sumDuration: number;
  discountValue: number;
  finalPrice: number;
  savings: number;
}

/**
 * 1. Calcula a soma dos preços de tabela, duração total agregada, desconto aplicado e preço final sugerido.
 */
export function calculateComboTotals(params: {
  services: ServiceItemForCombo[];
  discountAmount?: number;
  discountType?: ComboDiscountType;
}): ComboTotalsResult {
  const { services, discountAmount = 0, discountType = 'fixed' } = params;

  if (!services || services.length === 0) {
    return {
      sumPrice: 0,
      sumDuration: 0,
      discountValue: 0,
      finalPrice: 0,
      savings: 0,
    };
  }

  let sumPrice = 0;
  let sumDuration = 0;

  for (const s of services) {
    sumPrice += Number.isFinite(s.price) && s.price > 0 ? s.price : 0;
    sumDuration += Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0;
  }

  const rawDiscount = Number.isFinite(discountAmount) && discountAmount > 0 ? discountAmount : 0;
  let discountValue = 0;

  if (discountType === 'percentage') {
    const clampedPercentage = Math.min(100, rawDiscount);
    discountValue = (sumPrice * clampedPercentage) / 100;
  } else {
    // Fixed BRL discount
    discountValue = Math.min(sumPrice, rawDiscount);
  }

  const finalPrice = Math.max(0, sumPrice - discountValue);

  return {
    sumPrice: Math.round(sumPrice * 100) / 100,
    sumDuration: Math.round(sumDuration),
    discountValue: Math.round(discountValue * 100) / 100,
    finalPrice: Math.round(finalPrice * 100) / 100,
    savings: Math.round(discountValue * 100) / 100,
  };
}

/**
 * 2. Formata texto de economia ou descrição de itens do combo.
 * Ex: "Corte Degradê + Barba Terapia (R$ 10,00 de economia)"
 */
export function formatComboSummary(params: {
  includedServiceNames: string[];
  savings?: number;
}): string {
  const { includedServiceNames, savings = 0 } = params;
  if (!includedServiceNames || includedServiceNames.length === 0) {
    return 'Nenhum serviço vinculado';
  }

  const namesList = includedServiceNames.join(' + ');
  if (savings > 0) {
    const formattedSavings = savings.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    return `${namesList} (${formattedSavings} de economia)`;
  }

  return namesList;
}
