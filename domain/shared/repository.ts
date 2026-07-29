/**
 * [SMG][DOMAIN][SHARED] IRepository<T>
 *
 * Base contract for all domain repositories.
 * Defines standard method signatures, return types, and behavioral rules.
 *
 * STANDARD METHODS:
 *   list(tenantId)       → T[]           (empty array if no results, never null)
 *   get(id, tenantId)    → T | null      (null when not found)
 *   exists(id, tenantId) → boolean       (true/false, never null)
 *
 * OPTIONAL WRITE METHODS:
 *   create(input, tenantId) → T
 *   update(id, input, tenantId) → void
 *   delete(id, tenantId) → void
 *
 * RETURN TYPE RULES:
 *   - list()   → T[]          (always; empty array if no results)
 *   - get()    → T | null     (always; null when not found)
 *   - exists() → boolean      (always)
 *   - create() → T            (the created entity)
 *   - update() → void
 *   - delete() → void
 *
 * ERROR HANDLING:
 *   - All methods throw RepositoryError on failure
 *   - Never return { data, error } tuples
 *   - Never silently swallow errors
 *
 * FILTERS:
 *   - Repos may accept additional filter parameters (options, appSlug)
 *   - All queries MUST filter by tenant_id
 */

export interface IRepository<T> {
  list(tenantId: string): Promise<T[]>;
  get(id: string, tenantId: string): Promise<T | null>;
  exists(id: string, tenantId: string): Promise<boolean>;
}

export interface ICreatableRepository<T, TInput = Record<string, unknown>> extends IRepository<T> {
  create(input: TInput, tenantId: string): Promise<T>;
}

export interface IUpdatableRepository<T, TInput = Record<string, unknown>> extends IRepository<T> {
  update(id: string, input: TInput, tenantId: string): Promise<void>;
}

export interface IDeletableRepository<T> extends IRepository<T> {
  delete(id: string, tenantId: string): Promise<void>;
}

export interface ICrudRepository<T, TInput = Record<string, unknown>>
  extends ICreatableRepository<T, TInput>,
    IUpdatableRepository<T, TInput>,
    IDeletableRepository<T> {}
