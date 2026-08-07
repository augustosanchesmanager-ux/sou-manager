/**
 * [SMG][DOMAIN][BILLING] featureOverrideStoreDb tests
 *
 * Adapter DB-backed do FeatureOverrideStore (override tenant × feature da
 * tabela `feature_flags`, migration 20260807000000).
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createFeatureOverrideStore,
  FeatureOverrideStoreDbError,
} from './featureOverrideStoreDb';

const fakeDb = (rows: Array<{ feature_key: string; override: boolean }> | null, error: unknown = null) =>
  ({
    from: () => ({
      select: () => ({ eq: () => ({ data: rows, error }) }),
    }),
  }) as unknown as Pick<SupabaseClient, 'from'>;

describe('createFeatureOverrideStore', () => {
  it('should_return_empty_overrides_when_no_rows', async () => {
    const store = await createFeatureOverrideStore({ db: fakeDb([]) });

    await expect(store.getOverrides('tenant-1')).resolves.toEqual([]);
  });

  it('should_map_rows_to_feature_overrides', async () => {
    const store = await createFeatureOverrideStore({
      db: fakeDb([
        { feature_key: 'chef_club', override: true },
        { feature_key: 'bi', override: false },
      ]),
    });

    await expect(store.getOverrides('tenant-1')).resolves.toEqual([
      { tenantId: 'tenant-1', featureKey: 'chef_club', override: true },
      { tenantId: 'tenant-1', featureKey: 'bi', override: false },
    ]);
  });

  it('should_ignore_unknown_feature_keys (fail-closed, D-6.0.5.3-6)', async () => {
    const store = await createFeatureOverrideStore({
      db: fakeDb([{ feature_key: 'not_a_feature', override: true }]),
    });

    await expect(store.getOverrides('tenant-1')).resolves.toEqual([]);
  });

  it('should_throw_when_select_fails', async () => {
    const store = await createFeatureOverrideStore({
      db: fakeDb(null, new Error('boom')),
    });

    await expect(store.getOverrides('tenant-1')).rejects.toBeInstanceOf(
      FeatureOverrideStoreDbError,
    );
  });
});
