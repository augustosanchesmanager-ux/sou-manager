/**
 * [SMG][DOMAIN][SHARED] SupabaseRepository
 *
 * Classe base para todos os repositories.
 * Fornece: cliente via DI, helpers de erro, casting seguro.
 *
 * GARANTIAS:
 *   - Lança RepositoryError em falhas (nunca retorna { data, error })
 *   - Zero conhecimento de React, UI, navigate, toast
 *   - DatabaseClient injetado via construtor (testável sem Supabase)
 */

import type { DatabaseClient } from './database-client';
import { RepositoryError } from './errors';

export abstract class SupabaseRepository {
  protected readonly tableName: string;
  protected readonly db: DatabaseClient;

  constructor(table: string, db: DatabaseClient) {
    this.tableName = table;
    this.db = db;
  }

  /** Builder .from(table) — encadeie .eq('tenant_id', ...) normalmente. */
  protected from(): any {
    return this.db.from(this.tableName);
  }

  /**
   * Lança RepositoryError com contexto. Chamado em todo catch.
   */
  protected throwOnError(error: unknown, context: string): never {
    if (error instanceof RepositoryError) throw error;
    const err = error as { message?: string; code?: string } | null;
    throw new RepositoryError(
      `${context}: ${err?.message || 'Erro desconhecido'}`,
      err?.code,
      this.tableName,
      error,
    );
  }

  /**
   * Extrai data de uma resposta { data, error }, lança RepositoryError se error.
   */
  protected extractData<T>(result: { data: T | null; error: unknown }, context: string): T {
    if (result.error) {
      const err = result.error as { message?: string; code?: string };
      throw new RepositoryError(
        `${context}: ${err?.message || 'Erro desconhecido'}`,
        err?.code,
        this.tableName,
      );
    }
    return result.data as T;
  }

  /**
   * Se data for null/empty, lança RepositoryError (uso: after .single()).
   */
  protected requireData<T>(data: T | null, context: string): T {
    if (data === null || data === undefined) {
      throw new RepositoryError(
        `${context}: registro não encontrado`,
        'PGRST116',
        this.tableName,
      );
    }
    return data;
  }
}
