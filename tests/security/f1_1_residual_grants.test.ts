/**
 * F1.1 & F1.2 / Issue #225 — Teste de Segurança: Revogação de Grants Residuais
 *
 * Valida a integridade da migration 20261103160500_fix_sec_revoke_residual_table_grants.sql:
 * - Assegura revogação de ALL / mutação de anon em service_execution_participants
 * - Assegura revogação de INSERT, UPDATE e DELETE de authenticated em feature_flags
 * - Assegura GRANT SELECT em feature_flags para authenticated
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261103160500_fix_sec_revoke_residual_table_grants.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

describe('F1.1 & F1.2 / Issue #225 — Revoke Residual Grants Enforcement', () => {
  it('should revoke all permissions from anon on service_execution_participants', () => {
    expect(sql).toContain('REVOKE ALL ON TABLE public.service_execution_participants FROM anon;');
  });

  it('should revoke INSERT, UPDATE, DELETE on feature_flags from authenticated and PUBLIC', () => {
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.feature_flags FROM authenticated;');
    expect(sql).toContain('REVOKE INSERT, UPDATE, DELETE ON TABLE public.feature_flags FROM PUBLIC;');
  });

  it('should preserve SELECT grant on feature_flags for authenticated users', () => {
    expect(sql).toContain('GRANT SELECT ON TABLE public.feature_flags TO authenticated;');
  });
});
