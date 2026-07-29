/**
 * [SMG][DOMAIN][CHEF_CLUB] cycle
 *
 * Regras puras de ciclo de cobrança do Club dos Chefes.
 * Extraídas de application/chefClub.ts.
 */

/**
 * Verifica se uma data de ciclo está no futuro ou é aberta.
 * Regra: null = sem data = ciclo aberto = válido.
 */
export const isCycleDateValid = (dateStr: string | null): boolean => {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  return date.getTime() >= Date.now();
};

/**
 * Verifica se uma data está no futuro ou é aberta (mais permissiva).
 * Diferença de isCycleDateValid: trata datas inválidas como válidas.
 * Usada no Checkout para validar ciclo e período de créditos.
 */
export const isFutureOrOpenDate = (value?: string | null): boolean => {
  if (!value) return true;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) || parsed.getTime() >= Date.now();
};

/**
 * Calcula se um ciclo de cobrança está ativo com base em start/end.
 */
export const isCycleActive = (
  cycleStart: string | null,
  cycleEnd: string | null,
): boolean => {
  if (!isCycleDateValid(cycleEnd)) return false;

  if (cycleStart) {
    const startDate = new Date(cycleStart);
    if (!Number.isNaN(startDate.getTime()) && startDate.getTime() > Date.now()) {
      return false;
    }
  }

  return true;
};

/**
 * Calcula os dias restantes no ciclo atual.
 * Retorna null se não há data de fim.
 */
export const daysRemainingInCycle = (cycleEnd: string | null): number | null => {
  if (!cycleEnd) return null;
  const endDate = new Date(cycleEnd);
  if (Number.isNaN(endDate.getTime())) return null;

  const diffMs = endDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
};
