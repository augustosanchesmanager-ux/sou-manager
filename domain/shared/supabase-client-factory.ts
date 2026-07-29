/**
 * [SMG][DOMAIN][SHARED] Supabase Client Factory
 *
 * ÚNICO ponto de acoplamento entre domain e Supabase.
 * Cria instâncias de DatabaseClient a partir do cliente Supabase real.
 *
 * Repositories usam DatabaseClient (interface pura).
 * Este factory é usado apenas para criar os singletons de produção.
 */

import { getClientForTable, getSharedClient } from '../../services/supabaseClient';
import type { DatabaseClient } from './database-client';
import type { AppSlug } from './app';

/**
 * Cria um DatabaseClient que delega para o Supabase real.
 * Escopo: table + schema resolvidos pelo appSlug.
 */
export function createSupabaseClient(table: string, appSlug: AppSlug): DatabaseClient {
  const client = getClientForTable(table, appSlug);
  return {
    from: (tableName: string) => client.from(tableName) as any,
    rpc: (fn: string, params?: Record<string, unknown>) =>
      client.rpc(fn, params as any) as any,
  };
}

/**
 * Cria um DatabaseClient para tabelas compartilhadas (schema public).
 */
export function createSharedSupabaseClient(): DatabaseClient {
  const client = getSharedClient();
  return {
    from: (tableName: string) => client.from(tableName) as any,
    rpc: (fn: string, params?: Record<string, unknown>) =>
      client.rpc(fn, params as any) as any,
  };
}
