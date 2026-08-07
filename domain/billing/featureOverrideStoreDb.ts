/**
 * [SMG][DOMAIN][BILLING] featureOverrideStoreDb — adapter DB-backed do
 * FeatureOverrideStore (interface em domain/billing/featureFlagService.ts)
 *
 * Lê os overrides de `feature_flags` (migration 20260807000000). A tabela é
 * escrita exclusivamente por superadmin/service_role; a LEITURA no frontend é
 * SOMENTE via RPC `tenant_has_feature` (D-6.0.5.3-6) — este adapter serve a
 * contratos/contextos com privilégio (testes, service role, suporte), onde o
 * SELECT direto é autorizado por RLS.
 *
 * O domínio permanece puro: `FeatureFlagService` recebe a interface via DI e
 * nunca conhece SQL/Supabase.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FEATURE_KEYS, type FeatureKey } from './featureKey';
import type {
  FeatureOverride,
  FeatureOverrideStore,
} from './featureFlagService';
import { getSharedClient } from '../../src/lib/supabase/client';

export class FeatureOverrideStoreDbError extends Error {}

interface FeatureFlagRow {
  feature_key: string;
  override: boolean;
}

export interface FeatureOverrideStoreOptions {
  /** Injectable para testes; default = getSharedClient(). */
  db?: Pick<SupabaseClient, 'from'>;
}

export async function createFeatureOverrideStore(
  options: FeatureOverrideStoreOptions = {},
): Promise<FeatureOverrideStore> {
  const db = options.db ?? getSharedClient();

  return {
    async getOverrides(tenantId: string): Promise<FeatureOverride[]> {
      const { data, error } = await db
        .from('feature_flags')
        .select('feature_key, override')
        .eq('tenant_id', tenantId);

      if (error) {
        throw new FeatureOverrideStoreDbError(
          `Falha ao carregar overrides do tenant: ${String(error)}`,
        );
      }

      return ((data ?? []) as FeatureFlagRow[])
        .filter((row): row is FeatureFlagRow =>
          FEATURE_KEYS.includes(row.feature_key as FeatureKey),
        )
        .map((row) => ({
          tenantId,
          featureKey: row.feature_key as FeatureKey,
          override: row.override,
        }));
    },
  };
}
