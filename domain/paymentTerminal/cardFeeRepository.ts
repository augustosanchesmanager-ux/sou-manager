/**
 * [SMG][DOMAIN][PAYMENT_TERMINAL] cardFeeRepository.ts
 *
 * Repositório desacoplado para persistência e consulta das políticas
 * de rateio de taxas de maquininha de cartão (Frente B / Issue #382 FIN-005).
 *
 * ESTRUTURA:
 *   - Política padrão do tenant (`staff_id IS NULL`)
 *   - Políticas individuais por profissional (`staff_id = <uuid>`)
 *   - Persistência oficial no Supabase (`public.card_fee_policies` com RLS por `tenant_id`).
 */

import type { CardFeePolicy } from './cardFeeSplitEngine';
import { createSupabaseClient } from '../shared/supabase-client-factory';
import type { DatabaseClient } from '../shared/database-client';
import { RepositoryError } from '../shared/errors';

export interface CardFeePolicyStore {
  tenantDefault: CardFeePolicy;
  staffPolicies: Record<string, CardFeePolicy>;
}

interface CardFeePolicyRow {
  id?: string;
  tenant_id: string;
  staff_id: string | null;
  policy: CardFeePolicy;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_POLICIES: ReadonlySet<string> = new Set<CardFeePolicy>(['gross', 'split', 'deducted']);

const isUuid = (value: string | null | undefined): value is string =>
  typeof value === 'string' && UUID_REGEX.test(value);

const normalizePolicy = (value: unknown): CardFeePolicy =>
  typeof value === 'string' && VALID_POLICIES.has(value) ? (value as CardFeePolicy) : 'gross';

const memoryStore = new Map<string, CardFeePolicyStore>();

export class CardFeeRepository {
  private readonly injectedDb?: DatabaseClient;

  constructor(db?: DatabaseClient) {
    this.injectedDb = db;
  }

  clearInMemory(): void {
    memoryStore.clear();
  }

  private getOrCreateMemoryStore(tenantId: string): CardFeePolicyStore {
    const existing = memoryStore.get(tenantId);
    if (existing) return existing;
    const initial: CardFeePolicyStore = { tenantDefault: 'gross', staffPolicies: {} };
    memoryStore.set(tenantId, initial);
    return initial;
  }

  private resolveDb(tenantId: string): DatabaseClient | null {
    if (this.injectedDb) return this.injectedDb;
    if (!isUuid(tenantId)) return null;
    const hasEnv = Boolean(
      import.meta.env?.VITE_SUPABASE_URL && import.meta.env?.VITE_SUPABASE_ANON_KEY
    );
    if (!hasEnv) return null;
    return createSupabaseClient('card_fee_policies', 'barber');
  }

  private async fetchTenantStoreFromDb(
    db: DatabaseClient,
    tenantId: string
  ): Promise<CardFeePolicyStore> {
    const { data, error } = await db
      .from('card_fee_policies')
      .select('tenant_id, staff_id, policy')
      .eq('tenant_id', tenantId);

    if (error) {
      throw new RepositoryError(
        `Erro ao carregar políticas de taxa de cartão: ${error.message}`,
        'card_fee_policies',
        error
      );
    }

    const rows = (data as CardFeePolicyRow[] | null) ?? [];
    const store: CardFeePolicyStore = { tenantDefault: 'gross', staffPolicies: {} };
    for (const row of rows) {
      if (row.staff_id === null) {
        store.tenantDefault = normalizePolicy(row.policy);
      } else {
        store.staffPolicies[row.staff_id] = normalizePolicy(row.policy);
      }
    }

    memoryStore.set(tenantId, store);
    return store;
  }

  async getTenantDefaultPolicy(tenantId: string): Promise<CardFeePolicy> {
    const db = this.resolveDb(tenantId);
    if (!db) {
      return this.getOrCreateMemoryStore(tenantId).tenantDefault || 'gross';
    }

    const store = await this.fetchTenantStoreFromDb(db, tenantId);
    return store.tenantDefault || 'gross';
  }

  async setTenantDefaultPolicy(tenantId: string, policy: CardFeePolicy): Promise<void> {
    const db = this.resolveDb(tenantId);
    if (!db) {
      const store = this.getOrCreateMemoryStore(tenantId);
      store.tenantDefault = policy;
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: existing, error: selectError } = await db
      .from('card_fee_policies')
      .select('id')
      .eq('tenant_id', tenantId)
      .is('staff_id', null)
      .maybeSingle();

    if (selectError) {
      throw new RepositoryError(
        `Erro ao consultar política padrão de taxa: ${selectError.message}`,
        'card_fee_policies',
        selectError
      );
    }

    const existingId = (existing as { id?: string } | null)?.id;
    if (existingId) {
      const { error } = await db
        .from('card_fee_policies')
        .update({ policy, updated_at: nowIso })
        .eq('id', existingId)
        .eq('tenant_id', tenantId);
      if (error) {
        throw new RepositoryError(
          `Erro ao atualizar política padrão de taxa: ${error.message}`,
          'card_fee_policies',
          error
        );
      }
    } else {
      const { error } = await db.from('card_fee_policies').insert({
        tenant_id: tenantId,
        staff_id: null,
        policy,
        updated_at: nowIso,
      });
      if (error) {
        throw new RepositoryError(
          `Erro ao salvar política padrão de taxa: ${error.message}`,
          'card_fee_policies',
          error
        );
      }
    }

    const store = this.getOrCreateMemoryStore(tenantId);
    store.tenantDefault = policy;
  }

  async getStaffPolicy(tenantId: string, staffId: string): Promise<CardFeePolicy> {
    const db = this.resolveDb(tenantId);
    if (!db) {
      const store = this.getOrCreateMemoryStore(tenantId);
      return store.staffPolicies[staffId] || store.tenantDefault || 'gross';
    }

    const store = await this.fetchTenantStoreFromDb(db, tenantId);
    return store.staffPolicies[staffId] || store.tenantDefault || 'gross';
  }

  async setStaffPolicy(tenantId: string, staffId: string, policy: CardFeePolicy): Promise<void> {
    const db = this.resolveDb(tenantId);
    if (!db) {
      const store = this.getOrCreateMemoryStore(tenantId);
      store.staffPolicies[staffId] = policy;
      return;
    }

    const nowIso = new Date().toISOString();
    const { data: existing, error: selectError } = await db
      .from('card_fee_policies')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('staff_id', staffId)
      .maybeSingle();

    if (selectError) {
      throw new RepositoryError(
        `Erro ao consultar política individual de taxa: ${selectError.message}`,
        'card_fee_policies',
        selectError
      );
    }

    const existingId = (existing as { id?: string } | null)?.id;
    if (existingId) {
      const { error } = await db
        .from('card_fee_policies')
        .update({ policy, updated_at: nowIso })
        .eq('id', existingId)
        .eq('tenant_id', tenantId);
      if (error) {
        throw new RepositoryError(
          `Erro ao atualizar política individual de taxa: ${error.message}`,
          'card_fee_policies',
          error
        );
      }
    } else {
      const { error } = await db.from('card_fee_policies').insert({
        tenant_id: tenantId,
        staff_id: staffId,
        policy,
        updated_at: nowIso,
      });
      if (error) {
        throw new RepositoryError(
          `Erro ao salvar política individual de taxa: ${error.message}`,
          'card_fee_policies',
          error
        );
      }
    }

    const store = this.getOrCreateMemoryStore(tenantId);
    store.staffPolicies[staffId] = policy;
  }

  async listStaffPolicies(tenantId: string): Promise<Record<string, CardFeePolicy>> {
    const db = this.resolveDb(tenantId);
    if (!db) {
      return { ...this.getOrCreateMemoryStore(tenantId).staffPolicies };
    }

    const store = await this.fetchTenantStoreFromDb(db, tenantId);
    return { ...store.staffPolicies };
  }
}

export const cardFeeRepository = new CardFeeRepository();
