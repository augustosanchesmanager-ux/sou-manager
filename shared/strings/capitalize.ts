/**
 * [SMG][SHARED][UTIL] capitalize
 *
 * Capitaliza a primeira letra de uma string.
 * Substitui padrões inline como str.charAt(0).toUpperCase() + str.slice(1).
 *
 * Migração: Fase 2.1 — Padronização
 */

/**
 * Capitaliza a primeira letra de uma string.
 * capitalize("hello") → "Hello"
 * capitalize("") → ""
 * capitalize("a") → "A"
 */
export const capitalize = (str: string): string =>
  str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
