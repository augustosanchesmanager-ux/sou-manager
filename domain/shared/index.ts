/**
 * [SMG][DOMAIN][SHARED] barrel
 *
 * Infraestrutura compartilhada: erros, base class, interfaces, app definition.
 */

export { RepositoryError, extractSupabaseError, logSupabaseError } from './errors';
export type { SupabaseErrorPayload } from './errors';
export { SupabaseRepository } from './supabase-repository';
export type { DatabaseClient } from './database-client';
export type { IRepository, ICreatableRepository, IUpdatableRepository, IDeletableRepository, ICrudRepository } from './repository';
export { APP_SLUGS, DEFAULT_APP_SLUG } from './app';
export type { AppSlug } from './app';
