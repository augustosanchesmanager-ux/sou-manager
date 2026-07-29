/**
 * [SMG][DOMAIN][CHEF_CLUB] validation
 *
 * Regras de validação de estado do Club dos Chefes.
 * Funções puras — sem side effects.
 */

import type { SubscriptionStatus } from './types';

/**
 * Estado final de assinatura (não pode ser reativada).
 */
export const isTerminalStatus = (status: SubscriptionStatus): boolean =>
  status === 'canceled';

/**
 * Estado que permite operações de crédito.
 */
export const isCreditOperableStatus = (status: SubscriptionStatus): boolean =>
  status === 'active' || status === 'past_due';

/**
 * Estado que permite gerar recebíveis.
 */
export const isReceivableGenerableStatus = (status: SubscriptionStatus): boolean =>
  status === 'active' || status === 'past_due' || status === 'paused';

/**
 * Valida se uma transição de status é permitida.
 * Retorna { valid: true } ou { valid: false, reason: string }.
 */
export const validateStatusTransition = (
  current: SubscriptionStatus,
  target: SubscriptionStatus,
): { valid: true } | { valid: false; reason: string } => {
  if (current === target) {
    return { valid: true };
  }

  if (isTerminalStatus(current)) {
    return {
      valid: false,
      reason: `Assinatura cancelada não pode ser alterada para "${target}"`,
    };
  }

  const allowedTransitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
    active: ['paused', 'canceled'],
    past_due: ['active', 'paused', 'canceled'],
    paused: ['active', 'canceled'],
    canceled: [],
  };

  const allowed = allowedTransitions[current];
  if (!allowed.includes(target)) {
    return {
      valid: false,
      reason: `Transição de "${current}" para "${target}" não é permitida`,
    };
  }

  return { valid: true };
};
