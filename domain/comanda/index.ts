/**
 * [SMG][DOMAIN][COMANDA] barrel
 *
 * Domínio de comandas: tipos, repositório, labels.
 */

export * from './types';
export { comandaRepository, RepositoryError } from './repository';
export type { ComandaRepository } from './repository';
export { getPaymentMethodLabel, getPaymentMethodLabelFromString, isServiceItem } from './labels';
