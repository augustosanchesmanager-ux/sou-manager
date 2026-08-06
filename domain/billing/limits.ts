/**
 * [SMG][DOMAIN][BILLING] limits
 *
 * Validação de limites por plano, reutilizando a lógica da 6.0.3
 * (RPC invite_team_member): free = 1, pro = 5, premium = ∞ (ilimitado).
 *
 * Funções puras — zero dependência de Supabase/React.
 */

import type { TenantPlan } from './types';

/** Limite de profissionais por plano (6.0.3). premium = ∞ (Infinity). */
export const PLAN_LIMITS: Readonly<Record<TenantPlan, number>> = {
  free: 1,
  pro: 5,
  premium: Number.POSITIVE_INFINITY,
};

/** Retorna o limite de profissionais de um plano. */
export const getStaffLimit = (plan: TenantPlan): number => PLAN_LIMITS[plan];

/**
 * Verifica se o número atual de profissionais excede o limite do plano.
 * premium (∞) nunca excede.
 */
export const isStaffLimitExceeded = (plan: TenantPlan, currentCount: number): boolean =>
  currentCount > PLAN_LIMITS[plan];

/** Verifica se um plano é ilimitado (premium). */
export const isUnlimited = (plan: TenantPlan): boolean =>
  !Number.isFinite(PLAN_LIMITS[plan]);
