/**
 * [SMG][HOOK] useFeatureFlags — testes das funções puras
 *
 * Cobertura (6.0.5.3):
 *   - computeBaseFeatures: base tipada (matriz por plano) + derivação de
 *     suspensão/arquivamento + ausência de tenant.
 *   - resolveFeaturesViaRpc: resolução autoritativa (RPC tenant_has_feature),
 *     fallback `null` em erro, cache por sessão/plano/status.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */
import { describe, expect, it } from 'vitest';
import { computeBaseFeatures, resolveFeaturesViaRpc } from './useFeatureFlags';
import { FEATURE_KEYS } from '../../domain/billing/featureKey';

describe('useFeatureFlags (funções puras)', () => {
  describe('computeBaseFeatures', () => {
    it('should_return_full_feature_set_when_tenant_is_premium', () => {
      const features = computeBaseFeatures('premium', 'active', true);
      expect([...features].sort()).toEqual([...FEATURE_KEYS].sort());
    });

    it('should_return_pro_features_when_tenant_plan_is_pro', () => {
      const features = computeBaseFeatures('pro', 'active', true);
      expect(features).toContain('chef_club');
      expect(features).not.toContain('bi');
      expect(features).toHaveLength(15);
    });

    it('should_exclude_chef_club_when_tenant_plan_is_free', () => {
      const features = computeBaseFeatures('free', 'active', true);
      expect(features).not.toContain('chef_club');
      expect(features).not.toContain('bi');
      expect(features).toHaveLength(14);
    });

    it('should_return_empty_when_there_is_no_tenant', () => {
      expect(computeBaseFeatures('free', 'active', false)).toEqual([]);
    });

    it('should_return_empty_when_tenant_is_suspended', () => {
      expect(computeBaseFeatures('premium', 'suspended', true)).toEqual([]);
    });

    it('should_return_empty_when_tenant_is_archived', () => {
      expect(computeBaseFeatures('pro', 'archived', true)).toEqual([]);
    });
  });

  describe('resolveFeaturesViaRpc', () => {
    const rpcResult = (value: unknown, error: Error | null) => ({
      data: value,
      error,
    });

    const clientThat = (handler: (feature: string) => boolean) => ({
      rpc: async (_fn: string, params: Record<string, unknown>) =>
        rpcResult(handler(String(params.p_feature)), null),
    });

    it('should_return_only_enabled_features_from_rpc', async () => {
      const enabled = new Set(['appointments', 'finance']);
      const features = await resolveFeaturesViaRpc(
        'tenant-rpc-1',
        'free',
        'active',
        clientThat((feature) => enabled.has(feature)),
      );
      expect(features).toEqual(['appointments', 'finance']);
    });

    it('should_return_null_when_rpc_fails', async () => {
      const failingClient = {
        rpc: async () => rpcResult(null, new Error('rpc not found')),
      };
      const features = await resolveFeaturesViaRpc('tenant-rpc-2', 'free', 'active', failingClient);
      expect(features).toBeNull();
    });

    it('should_cache_resolution_per_session_plan_status', async () => {
      let calls = 0;
      const countingClient = {
        rpc: async (fn: string, params: Record<string, unknown>) => {
          calls += 1;
          return rpcResult(true, null);
        },
      };
      await resolveFeaturesViaRpc('tenant-rpc-3', 'free', 'active', countingClient);
      await resolveFeaturesViaRpc('tenant-rpc-3', 'free', 'active', countingClient);
      expect(calls).toBe(FEATURE_KEYS.length);
    });
  });
});
