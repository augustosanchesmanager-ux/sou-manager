/**
 * checkoutQuickPay.ts
 *
 * Utilitários puros para o Checkout Expresso e Balcão Ágil (Fase 7.1 — Frente 1.D).
 * Fornece geração dinâmica de cédulas BRL, cálculo preciso de troco e formatação.
 */

export interface ChangeCalculationResult {
  total: number;
  tendered: number;
  change: number;
  remaining: number;
  isSufficient: boolean;
  status: 'exact' | 'over' | 'under';
}

const COMMON_BRL_BANKNOTES = [10, 20, 50, 100, 200];

/**
 * Gera sugestões inteligentes de cédulas e valores em circulação (BRL)
 * para pagamento de uma comanda em dinheiro.
 *
 * @param total Valor total da comanda
 * @returns Lista contendo o valor exato + até 3 cédulas/combinações superiores comuns
 */
export function generateCashSuggestions(total: number): number[] {
  const exact = Math.round(total * 100) / 100;
  if (exact <= 0) return [];

  const candidates = new Set<number>();
  candidates.add(exact);

  // 1. Cédulas individuais reais maiores que o total
  for (const note of COMMON_BRL_BANKNOTES) {
    if (note > exact) {
      candidates.add(note);
    }
  }

  // 2. Próximo múltiplo de 10 superior (ex: R$ 15 -> 20; R$ 35 -> 40)
  const next10 = Math.ceil((exact + 0.01) / 10) * 10;
  if (next10 > exact) candidates.add(next10);

  // 3. Próximo múltiplo de 20 superior (ex: duas de 20 para R$ 35 -> 40)
  const next20 = Math.ceil((exact + 0.01) / 20) * 20;
  if (next20 > exact) candidates.add(next20);

  // 4. Próximo múltiplo de 50 superior
  const next50 = Math.ceil((exact + 0.01) / 50) * 50;
  if (next50 > exact) candidates.add(next50);

  // 5. Próximo múltiplo de 100 superior
  const next100 = Math.ceil((exact + 0.01) / 100) * 100;
  if (next100 > exact) candidates.add(next100);

  // Ordena os números em ordem crescente
  const sorted = Array.from(candidates).sort((a, b) => a - b);
  const above = sorted.filter((val) => val > exact);

  // Retorna o valor exato + as próximas 3 opções práticas superiores
  return [exact, ...above.slice(0, 3)];
}

/**
 * Calcula troco e valor faltante de forma segura com 2 casas decimais.
 *
 * @param total Valor total da comanda
 * @param tendered Valor entregue em dinheiro pelo cliente
 */
export function calculateCashChange(total: number, tendered: number): ChangeCalculationResult {
  const normTotal = Math.round(total * 100) / 100;
  const normTendered = Math.round(tendered * 100) / 100;

  const diff = Math.round((normTendered - normTotal) * 100) / 100;

  if (diff < 0) {
    return {
      total: normTotal,
      tendered: normTendered,
      change: 0,
      remaining: Math.abs(diff),
      isSufficient: false,
      status: 'under',
    };
  }

  if (diff === 0) {
    return {
      total: normTotal,
      tendered: normTendered,
      change: 0,
      remaining: 0,
      isSufficient: true,
      status: 'exact',
    };
  }

  return {
    total: normTotal,
    tendered: normTendered,
    change: diff,
    remaining: 0,
    isSufficient: true,
    status: 'over',
  };
}

/**
 * Formata um valor numérico em moeda BRL (ex: R$ 35,00)
 */
export function formatBrlCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}
