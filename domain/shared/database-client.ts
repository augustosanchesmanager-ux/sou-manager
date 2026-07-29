/**
 * [SMG][DOMAIN][SHARED] DatabaseClient
 *
 * Interface abstrata para acesso a dados.
 * Qualquer implementação (Supabase, mock, test) pode satisfazê-la.
 *
 * GARANTIAS:
 *   - Sem dependência de framework (React, etc.)
 *   - Sem dependência de infraestrutura (Supabase, etc.)
 *   - Apenas contrato de dados puro
 */

export interface DatabaseClient {
  from(table: string): any;
  rpc(fn: string, params?: Record<string, unknown>): Promise<any>;
}
