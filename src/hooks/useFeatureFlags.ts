/**
 * [SMG][HOOK] useFeatureFlags — camada FeatureFlagService no frontend
 *
 * Resolução das flags EFETIVAS do tenant atual, lendo SOMENTE via RPC
 * `tenant_has_feature` (D-6.0.5.3-6 — nenhum SELECT direto em
 * feature_flags/plans/features/plan_features).
 *
 * Comportamento:
 *   - Base provisória imediata = matriz tipada (`planCatalog`) + derivação de
 *     suspensão (mesma semântica da RPC para tenants sem override) — evita
 *     flash durante a resolução.
 *   - Resolução autoritativa = RPC `tenant_has_feature` (plano + override +
 *     suspensão, tudo no backend), cacheada por sessão/plano/status.
 *   - Superadmin bypass: todas as flags habilitadas (como na AccessPolicy).
 *   - Sem tenant (pré-provision) → nada habilitado.
 *
 * Consumidores: `<FeatureGuard>`, `FeatureUnavailablePage`, sidebar e gates
 * de rota. Decisões de ESCRITA permanecem no backend (RPCs com guarda).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../src/context/TenantContext';
import { getSharedClient } from '../../src/lib/supabase/client';
import { FEATURE_KEYS, type FeatureKey, type FeatureSet } from '../../domain/billing/featureKey';
import { planCatalog } from '../../domain/billing/planCatalog';

// ─── Cache de resolução (uma chamada por sessão/plano/status) ──────

const resolutionCache = new Map<string, FeatureSet | null>();

/** Interface mínima do cliente RPC (compatível com o SupabaseClient real). */
export interface RpcClient {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

/**
 * Resolve as flags via RPC `tenant_has_feature` (fonte de verdade).
 * Retorna `null` quando a RPC falha (ex.: migration ainda não aplicada,
 * modo demo sem handler) → o chamador usa a base tipada (fail-open de UI;
 * o enforcement real continua no backend).
 */
export async function resolveFeaturesViaRpc(
  tenantId: string,
  plan: string,
  status: string,
  client: RpcClient = getSharedClient() as unknown as RpcClient,
): Promise<FeatureSet | null> {
  const cacheKey = `${tenantId}|${plan}|${status}`;
  const cached = resolutionCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const results = await Promise.all(
      FEATURE_KEYS.map(async (feature) => {
        const { data, error } = await client.rpc('tenant_has_feature', {
          p_tenant_id: tenantId,
          p_feature: feature,
        });
        if (error) throw error;
        return { feature, enabled: data === true };
      }),
    );
    const resolved = results.filter((entry) => entry.enabled).map((entry) => entry.feature);
    resolutionCache.set(cacheKey, resolved);
    return resolved;
  } catch {
    resolutionCache.set(cacheKey, null);
    return null;
  }
}

// ─── Base provisória (matriz tipada + derivação de suspensão) ──────

export function computeBaseFeatures(
  plan: string,
  status: string,
  hasTenant: boolean,
): FeatureSet {
  if (!hasTenant) return [];
  if (status === 'suspended' || status === 'archived') return [];
  return planCatalog.getFeatures(plan as Parameters<typeof planCatalog.getFeatures>[0]) as FeatureSet;
}

// ─── Hook ──────────────────────────────────────────────────────────

export interface UseFeatureFlagsReturn {
  features: FeatureSet;
  can: (feature: FeatureKey) => boolean;
  isLoaded: boolean;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
  const { tenantId, tenant } = useTenant();
  const { canAccessSuperAdmin } = useAuth();

  const plan = tenant?.plan ?? 'free';
  const status = tenant?.status ?? 'active';
  const [resolved, setResolved] = useState<FeatureSet | null>(null);

  const base = useMemo<FeatureSet>(
    () => computeBaseFeatures(plan, status, Boolean(tenantId)),
    [plan, status, tenantId],
  );

  useEffect(() => {
    let cancelled = false;

    if (!tenantId || canAccessSuperAdmin) {
      setResolved(null);
      return undefined;
    }

    setResolved(null);
    void resolveFeaturesViaRpc(tenantId, plan, status).then((features) => {
      if (!cancelled) setResolved(features);
    });

    return () => {
      cancelled = true;
    };
  }, [canAccessSuperAdmin, plan, status, tenantId]);

  const features = useMemo<FeatureSet>(() => {
    if (canAccessSuperAdmin) return [...FEATURE_KEYS];
    return resolved ?? base;
  }, [base, canAccessSuperAdmin, resolved]);

  const can = useCallback(
    (feature: FeatureKey) => FEATURE_KEYS.includes(feature) && features.includes(feature),
    [features],
  );

  return { features, can, isLoaded: canAccessSuperAdmin || resolved !== null };
}
