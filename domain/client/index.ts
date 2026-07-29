/**
 * [SMG][DOMAIN][CLIENT] barrel
 *
 * Domínio de clientes: tipos, repositório.
 */

export * from './types';
export { clientRepository, RepositoryError } from './repository';
export type { ClientRepository } from './repository';
