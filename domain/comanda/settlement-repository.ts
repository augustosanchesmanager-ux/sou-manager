/**
 * [SMG][DOMAIN][COMANDA] ComandaSettlementRepository (ADR-056 — Lote 3)
 *
 * RESPONSABILIDADE: Encapsula a resolução do cliente de banco escopado para
 * settlement e fechamento de valor zero de comandas, removendo o acoplamento
 * direto ao cliente Supabase em `application/checkout.ts`.
 */

import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';

export interface ComandaSettlementRepository {
  getClient(): DatabaseClient;
}

export class ComandaSettlementRepositoryImpl implements ComandaSettlementRepository {
  constructor(
    private readonly clientFactory: () => DatabaseClient = () =>
      createSupabaseClient('comandas', 'barber')
  ) {}

  getClient(): DatabaseClient {
    return this.clientFactory();
  }
}

export const comandaSettlementRepository: ComandaSettlementRepository =
  new ComandaSettlementRepositoryImpl();
