/**
 * [SMG][DOMAIN][BILLING] FeatureFlagService — contexto "Feature Flags"
 *
 * Contexto desacoplado do ADR-013 §2.4: resolve as flags EFETIVAS de um
 * tenant (funcionalidade/licenciamento) combinando:
 *
 *   PlanCatalog (plano → matriz)     │  FeatureOverrideStore (exceção tenant)
 *      +                             │      ↓
 *   estado do tenant (fornecido)   ───►  FeatureFlagService ──► FeatureResolution
 *
 * API PÚBLICA CONGELADA — PHASE_6_0_5_3_ENTRY_AUDIT §2.5 (PO, 2026-08-07).
 * A implementação NÃO altera este contrato.
 *
 * Regras da API (entry audit §2.5):
 *   - `can()` NUNCA lança por feature desconhecida — retorna `false`
 *     (fail-closed).
 *   - `resolve()` consolida: plano → matriz → override explícito (row em
 *     `feature_flags`) → suspensão (`false` se suspended/archived, sem rows).
 *   - Zero SQL/React no domínio: o estado do tenant e os overrides são
 *     fornecidos via DI (mesmo padrão de EventBus/Outbox).
 *
 * Escrita das flags: exclusiva superadmin/service_role (ver migration
 * 20260807000000_phase_6_0_5_3_feature_flags.sql). Este service é o
 * WRITER ÚNICO lógico das decisões de capacidade (ADR-013 §3.1).
 *
 * Domínio puro — zero dependência de Supabase/React.
 */

import { FEATURE_KEYS, type FeatureKey, type FeatureSet } from './featureKey';
import type { PlanCatalog, PlanLimits } from './planCatalog';
import type { TenantPlan } from './types';

// ─── Tipos da API congelada (entry audit §2.5) ────────────────────

export interface FeatureOverride {
  tenantId: string;
  featureKey: FeatureKey;
  override: boolean;
  reason?: string;
}

/** Resolução de flags efetivas de um tenant (plano + override + estado). */
export interface FeatureResolution {
  tenantId: string;
  /** Plano base (fonte: PlanCatalog). */
  planSlug: TenantPlan;
  /** Flags efetivas (FeatureKey[]). */
  enabledFeatures: FeatureSet;
  /** Flags com override ativo (diagnóstico). */
  overridden: FeatureKey[];
  /** Suspensão derruba flags (sem rows). */
  derivedFrom: 'active' | 'suspended';
}

/** Store de overrides (interface no domínio; adapter em application/). */
export interface FeatureOverrideStore {
  getOverrides(tenantId: string): Promise<FeatureOverride[]>;
  // setOverride/setOverrides: somente superadmin/service (escrita via adapter)
}

export interface FeatureFlagService {
  resolve(tenantId: string): Promise<FeatureResolution>;
  can(tenantId: string, featureKey: FeatureKey): Promise<boolean>;
  /** Via PlanCatalog.getLimits. */
  getLimits(planSlug: TenantPlan): Promise<PlanLimits>;
}

// ─── Dependências (DI) ─────────────────────────────────────────────

export interface FeatureFlagServiceDeps {
  catalog: PlanCatalog;
  overrides: FeatureOverrideStore;
  /** Estado do tenant fornecido pelo chamador (sem query de status aqui). */
  tenantState: (tenantId: string) => Promise<{ plan: TenantPlan; status: string }>;
}

// ─── Implementação ─────────────────────────────────────────────────

/** Status que removem todas as flags (ADR-013 §2.3/§5.3, derivado sem rows). */
const SUSPENDED_STATUSES = new Set(['suspended', 'archived']);

export class FeatureFlagServiceImpl implements FeatureFlagService {
  private readonly deps: FeatureFlagServiceDeps;

  constructor(deps: FeatureFlagServiceDeps) {
    this.deps = deps;
  }

  async resolve(tenantId: string): Promise<FeatureResolution> {
    const state = await this.deps.tenantState(tenantId);
    const suspended = SUSPENDED_STATUSES.has(state.status);

    if (suspended) {
      return {
        tenantId,
        planSlug: state.plan,
        enabledFeatures: [],
        overridden: [],
        derivedFrom: 'suspended',
      };
    }

    const matrix = this.deps.catalog.getFeatures(state.plan) ?? [];
    const overrides = await this.deps.overrides.getOverrides(tenantId);

    const overrideByKey = new Map<FeatureKey, boolean>();
    for (const override of overrides) {
      if (!FEATURE_KEYS.includes(override.featureKey)) continue;
      overrideByKey.set(override.featureKey, override.override);
    }

    const enabledFeatures = FEATURE_KEYS.filter((key) =>
      overrideByKey.has(key) ? overrideByKey.get(key) : matrix.includes(key),
    );
    const overridden = FEATURE_KEYS.filter((key) => overrideByKey.has(key));

    return {
      tenantId,
      planSlug: state.plan,
      enabledFeatures,
      overridden,
      derivedFrom: 'active',
    };
  }

  async can(tenantId: string, featureKey: FeatureKey): Promise<boolean> {
    // Fail-closed: feature desconhecida NUNCA lança (entry audit §2.5).
    if (!FEATURE_KEYS.includes(featureKey)) {
      return false;
    }
    const resolution = await this.resolve(tenantId);
    return resolution.enabledFeatures.includes(featureKey);
  }

  async getLimits(planSlug: TenantPlan): Promise<PlanLimits> {
    return this.deps.catalog.getLimits(planSlug);
  }
}

export const createFeatureFlagService = (
  deps: FeatureFlagServiceDeps,
): FeatureFlagService => new FeatureFlagServiceImpl(deps);
