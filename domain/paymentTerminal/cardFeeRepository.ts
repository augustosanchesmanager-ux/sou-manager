/**
 * [SMG][DOMAIN][PAYMENT_TERMINAL] cardFeeRepository.ts
 *
 * Repositório desacoplado para persistência e consulta das políticas
 * de rateio de taxas de maquininha de cartão (Frente B).
 *
 * ESTRUTURA:
 *   - Política padrão do tenant (barbearia)
 *   - Políticas individuais por profissional (ajuste por barbeiro)
 */

import type { CardFeePolicy } from './cardFeeSplitEngine';

export interface CardFeePolicyStore {
  tenantDefault: CardFeePolicy;
  staffPolicies: Record<string, CardFeePolicy>;
}

const memoryStore = new Map<string, CardFeePolicyStore>();

export class CardFeeRepository {
  clearInMemory(): void {
    memoryStore.clear();
  }

  private getStorageKey(tenantId: string): string {
    return `smg.card_fee_policies.${tenantId}`;
  }

  private loadStore(tenantId: string): CardFeePolicyStore {
    if (memoryStore.has(tenantId)) {
      return memoryStore.get(tenantId)!;
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(this.getStorageKey(tenantId));
        if (raw) {
          const parsed = JSON.parse(raw) as CardFeePolicyStore;
          if (parsed && parsed.tenantDefault) {
            memoryStore.set(tenantId, parsed);
            return parsed;
          }
        }
      } catch {
        // Fallback silencioso
      }
    }

    const defaultStore: CardFeePolicyStore = {
      tenantDefault: 'gross',
      staffPolicies: {},
    };
    memoryStore.set(tenantId, defaultStore);
    return defaultStore;
  }

  private saveStore(tenantId: string, store: CardFeePolicyStore): void {
    memoryStore.set(tenantId, store);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(this.getStorageKey(tenantId), JSON.stringify(store));
      } catch {
        // Fallback silencioso
      }
    }
  }

  async getTenantDefaultPolicy(tenantId: string): Promise<CardFeePolicy> {
    const store = this.loadStore(tenantId);
    return store.tenantDefault || 'gross';
  }

  async setTenantDefaultPolicy(tenantId: string, policy: CardFeePolicy): Promise<void> {
    const store = this.loadStore(tenantId);
    store.tenantDefault = policy;
    this.saveStore(tenantId, store);
  }

  async getStaffPolicy(tenantId: string, staffId: string): Promise<CardFeePolicy> {
    const store = this.loadStore(tenantId);
    return store.staffPolicies[staffId] || store.tenantDefault || 'gross';
  }

  async setStaffPolicy(tenantId: string, staffId: string, policy: CardFeePolicy): Promise<void> {
    const store = this.loadStore(tenantId);
    store.staffPolicies[staffId] = policy;
    this.saveStore(tenantId, store);
  }

  async listStaffPolicies(tenantId: string): Promise<Record<string, CardFeePolicy>> {
    const store = this.loadStore(tenantId);
    return { ...store.staffPolicies };
  }
}

export const cardFeeRepository = new CardFeeRepository();
