/**
 * [SMG][SHARED][UTIL] clamp
 *
 * Limita um valor numérico a um intervalo [min, max].
 * Substitui padrões inline Math.min(Math.max(...)).
 *
 * Migração: Fase 2.1 — Padronização
 */

/**
 * Limita `value` ao intervalo [min, max].
 * Se value < min, retorna min. Se value > max, retorna max.
 */
export const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);
