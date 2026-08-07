/**
 * [SMG][DOMAIN][BILLING] planCatalog ↔ migration sync tests
 *
 * TESTE DE REGRESSÃO EXIGIDO PELO PO (6.0.5.2): mantém sincronizadas a matriz
 * persistida (seed da migration 20260806090000_phase_6_0_5_2_plans_catalog.sql)
 * e a matriz tipada (`PLAN_FEATURES`/`FEATURE_KEYS`). Qualquer divergência entre
 * BD e TS quebra este teste — proibindo duplicação de regras (ADR-013 §4.11).
 *
 * O seed é fonte congelada (6.0.5.1, commit 622a891): 3 planos × 20 features.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { FEATURE_KEYS, type FeatureKey } from './featureKey';
import { PLAN_FEATURES, CATALOG_FINGERPRINT, computeCatalogFingerprint } from './planCatalog';
import type { TenantPlan } from './types';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20260806090000_phase_6_0_5_2_plans_catalog.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf-8');

function extractInsertBlock(sqlText: string, insertMarker: string): string {
  const start = sqlText.indexOf(insertMarker);
  if (start === -1) throw new Error(`INSERT block not found: ${insertMarker}`);
  const end = sqlText.indexOf('ON CONFLICT', start);
  if (end === -1) throw new Error(`ON CONFLICT not found after: ${insertMarker}`);
  return sqlText.slice(start, end);
}

/** Extrai as keys de features do seed: ('key', 'name', 'desc', 'category', ...). */
function extractFeatureKeys(block: string): string[] {
  const re = /\(\s*'([a-z_]+)'\s*,\s*'[^']*'\s*,\s*'[^']*'\s*,\s*'(?:core|financial|engagement|integration|admin)'/g;
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) keys.push(match[1]);
  return keys;
}

/** Extrai (plan, feature) do seed de plan_features. */
function extractPlanFeatures(block: string): Array<{ plan: TenantPlan; feature: string }> {
  const re = /\(\s*'(free|pro|premium)'\s*,\s*'([a-z_]+)'\s*\)/g;
  const rows: Array<{ plan: TenantPlan; feature: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    rows.push({ plan: match[1] as TenantPlan, feature: match[2] });
  }
  return rows;
}

/** Extrai max_staff dos limits do seed de plans. */
function extractPlanLimits(block: string): Record<TenantPlan, number | null> {
  const re = /\(\s*'(free|pro|premium)'\s*,\s*'[^']*'\s*,\s*0\s*,\s*'\{"max_staff":\s*([0-9]+|null)\}'::jsonb/g;
  const limits: Record<string, number | null> = {};
  let match: RegExpExecArray | null;
  while ((match = re.exec(block)) !== null) {
    limits[match[1]] = match[2] === 'null' ? null : Number(match[2]);
  }
  return limits as Record<TenantPlan, number | null>;
}

const featuresBlock = extractInsertBlock(sql, 'INSERT INTO public.features (key,');
const planFeaturesBlock = extractInsertBlock(sql, 'INSERT INTO public.plan_features (plan_slug,');
const plansBlock = extractInsertBlock(sql, 'INSERT INTO public.plans (slug,');

const dbFeatureKeys = extractFeatureKeys(featuresBlock);
const dbPlanFeatures = extractPlanFeatures(planFeaturesBlock);
const dbPlanLimits = extractPlanLimits(plansBlock);

const matrixFromDb = (plan: TenantPlan): FeatureKey[] =>
  dbPlanFeatures
    .filter((row) => row.plan === plan)
    .map((row) => row.feature as FeatureKey);

/** Fingerprint derivado do seed da migration (espelho de computeCatalogFingerprint). */
const dbFingerprint = computeCatalogFingerprint({
  features: dbFeatureKeys as FeatureKey[],
  planFeatures: {
    free: matrixFromDb('free'),
    pro: matrixFromDb('pro'),
    premium: matrixFromDb('premium'),
  },
  limits: dbPlanLimits,
});

describe('sync migration → tipos TS (1:1, ADR-013 §4.11)', () => {
  it('should_have_100_percent_feature_key_equality_db_vs_ts', () => {
    const db = new Set<string>(dbFeatureKeys);
    const ts = new Set<string>(FEATURE_KEYS);
    for (const key of ts) {
      expect(db.has(key), `migration missing feature: ${key}`).toBe(true);
    }
    for (const key of db) {
      expect(ts.has(key), `unknown feature in migration: ${key}`).toBe(true);
    }
    expect(db.size).toBe(ts.size);
    expect(db.size).toBe(20);
  });

  it('should_have_100_percent_matrix_equality_db_vs_ts', () => {
    const plans: TenantPlan[] = ['free', 'pro', 'premium'];
    for (const plan of plans) {
      const db = new Set<string>(matrixFromDb(plan));
      const ts = new Set<string>(PLAN_FEATURES[plan]);
      for (const key of ts) {
        expect(db.has(key), `migration plan ${plan} missing feature: ${key}`).toBe(true);
      }
      for (const key of db) {
        expect(ts.has(key), `migration plan ${plan} has unknown feature: ${key}`).toBe(true);
      }
      expect(db.size).toBe(ts.size);
    }
  });

  it('should_match_plan_features_matrix_when_sorted', () => {
    const plans: TenantPlan[] = ['free', 'pro', 'premium'];
    for (const plan of plans) {
      expect(matrixFromDb(plan).sort()).toEqual([...PLAN_FEATURES[plan]].sort());
    }
  });

  it('should_have_frozen_counts_14_15_20', () => {
    expect(matrixFromDb('free')).toHaveLength(14);
    expect(matrixFromDb('pro')).toHaveLength(15);
    expect(matrixFromDb('premium')).toHaveLength(20);
  });

  it('should_only_reference_known_feature_keys_in_plan_features', () => {
    const known = new Set<string>(FEATURE_KEYS);
    for (const row of dbPlanFeatures) {
      expect(known.has(row.feature)).toBe(true);
    }
  });

  it('should_have_plan_limits_matching_typed_catalog (free=1, pro=5, premium=null)', () => {
    expect(dbPlanLimits['free']).toBe(1);
    expect(dbPlanLimits['pro']).toBe(5);
    expect(dbPlanLimits['premium']).toBeNull();
  });

  it('should_have_catalog_fingerprint_matching_db_seed', () => {
    expect(dbFingerprint).toBe(CATALOG_FINGERPRINT);
  });
});
