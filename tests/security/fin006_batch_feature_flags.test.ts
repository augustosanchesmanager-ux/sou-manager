import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFeatureFlagsCache,
  resolveFeaturesBatchViaRpc,
} from '../../src/hooks/useFeatureFlags';

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261124191500_security_fix_fin006_batch_feature_flags_rpc.sql'
);

describe('FIN-006 (#387) batch feature flags RPC & cache hygiene', () => {
  beforeEach(() => {
    clearFeatureFlagsCache();
  });

  it('should_resolve_all_tenant_features_in_1_single_rpc_call', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: ['appointments', 'pos', 'finance', 'bi'],
      error: null,
    });

    const features = await resolveFeaturesBatchViaRpc('tenant-batch-1', 'premium', 'active', {
      rpc,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_tenant_feature_flags', {
      p_tenant_id: 'tenant-batch-1',
    });
    expect(features).toEqual(['appointments', 'pos', 'finance', 'bi']);

    // Second call hits cache without extra RPC
    await resolveFeaturesBatchViaRpc('tenant-batch-1', 'premium', 'active', { rpc });
    expect(rpc).toHaveBeenCalledTimes(1);

    // clearFeatureFlagsCache (called on signOut) invalidates cache
    clearFeatureFlagsCache();
    await resolveFeaturesBatchViaRpc('tenant-batch-1', 'premium', 'active', { rpc });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('should_not_cache_transient_rpc_errors_across_retries', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: new Error('network timeout') })
      .mockResolvedValueOnce({ data: ['appointments', 'clients'], error: null });

    const first = await resolveFeaturesBatchViaRpc('tenant-retry-1', 'free', 'active', { rpc });
    expect(first).toBeNull();

    const second = await resolveFeaturesBatchViaRpc('tenant-retry-1', 'free', 'active', { rpc });
    expect(second).toEqual(['appointments', 'clients']);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('should_define_secure_batch_rpc_in_migration_and_clear_cache_on_signout', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');
    const authContextSource = fs.readFileSync(path.join(ROOT, 'context/AuthContext.tsx'), 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.get_tenant_feature_flags');
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION public.get_tenant_feature_flags');
    expect(sql).toContain('public.current_tenant_id_from_auth_uid()');
    expect(authContextSource).toContain('clearFeatureFlagsCache()');
  });
});
