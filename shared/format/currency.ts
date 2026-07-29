/**
 * [SMG][SHARED][UTIL] formatCurrency
 *
 * Formata um valor numérico para BRL usando Intl.NumberFormat.
 * Substitui 38+ cópias espalhadas pelo codebase.
 *
 * Canonical source: pages/ChefClubReceivables.tsx:75
 * Migração: Fase 2.1 — Padronização
 */

const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Formata um valor para BRL (R$ 1.234,56).
 * Aceita number, string, null ou undefined.
 * Fallback para R$ 0,00.
 */
export const formatCurrency = (
  value: number | string | null | undefined,
): string => BRL_FORMATTER.format(Number(value || 0));

/**
 * Converte uma string BRL ("R$ 1.234,56") para número (1234.56).
 * Retorna 0 para entradas inválidas.
 */
export const parseCurrency = (value: string | null | undefined): number => {
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,-]/g, '').replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};
