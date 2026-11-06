/**
 * AUDIT-PIN-COMPETENCE — Teste de segurança da migration.
 *
 * Valida o contrato SQL acordado com o PO:
 * - R-01: PIN em public.manager_pins, com RLS habilitado SEM policy e sem
 *   GRANT para anon/authenticated (leitura via API negada).
 * - R-02: competência em caixa confirmado exige p_audit_pin.
 * - R-04: a migration original não declara set_audit_pin. O autoatendimento
 *   foi autorizado depois pelo PO e vive em 20261105190000_add_audit_pin_management.sql.
 * - Nenhuma coluna de PIN em profiles.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261105120000_add_audit_pin_and_retroactive_adjustment.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

describe('AUDIT-PIN-COMPETENCE — migration security contract', () => {
  describe('R-01 — manager_pins deny-all para a API', () => {
    it('should_create_manager_pins_with_user_tenant_and_hash_when_migration_runs', () => {
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.manager_pins');
      expect(sql).toMatch(/user_id\s+UUID NOT NULL REFERENCES auth\.users\(id\)/);
      expect(sql).toMatch(/tenant_id\s+UUID NOT NULL REFERENCES public\.tenants\(id\)/);
      expect(sql).toMatch(/pin_hash\s+TEXT NOT NULL/);
      expect(sql).toContain('PRIMARY KEY (user_id, tenant_id)');
    });

    it('should_enable_rls_without_any_policy_when_manager_pins_is_created', () => {
      expect(sql).toContain('ALTER TABLE public.manager_pins ENABLE ROW LEVEL SECURITY;');
      expect(sql).not.toMatch(/CREATE POLICY[^;]*public\.manager_pins/i);
    });

    it('should_revoke_api_grants_when_manager_pins_is_created', () => {
      expect(sql).toContain('REVOKE ALL ON TABLE public.manager_pins FROM PUBLIC;');
      expect(sql).toContain('REVOKE ALL ON TABLE public.manager_pins FROM anon;');
      expect(sql).toContain('REVOKE ALL ON TABLE public.manager_pins FROM authenticated;');
      expect(sql).not.toMatch(/GRANT [^;]*ON TABLE public\.manager_pins/i);
    });

    it('should_revoke_default_anon_grants_when_functions_are_created', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.validate_audit_pin(TEXT, UUID) FROM anon;');
      expect(sql).toContain(
        'REVOKE ALL ON FUNCTION public.finance_reverse_transaction(UUID, UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM anon;',
      );
    });

    it('should_expose_verify_audit_pin_only_as_security_definer_when_declared', () => {
      expect(sql).toMatch(/FUNCTION public\.verify_audit_pin\(\s*p_user_id\s+UUID,\s*p_tenant_id\s+UUID,\s*p_pin\s+TEXT\s*\)/);
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.verify_audit_pin(UUID, UUID, TEXT) FROM authenticated;');
      expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.verify_audit_pin/i);
    });

    it('should_not_add_audit_pin_to_profiles_when_migration_runs', () => {
      expect(sql).not.toMatch(/ALTER TABLE public\.profiles\s+ADD COLUMN[^;]*audit_pin/i);
      expect(sql).not.toContain('profiles.audit_pin');
      expect(sql).not.toContain('guard_profile_audit_pin');
    });
  });

  describe('R-02 — PIN obrigatório em competência retroativa', () => {
    it('should_raise_the_canonical_exception_when_cash_is_confirmed_and_pin_is_null', () => {
      expect(sql).toContain(
        "IF v_retroactive AND v_audit_pin IS NULL THEN\n    RAISE EXCEPTION 'Ajuste retroativo em caixa fechado exige PIN de gerente';",
      );
    });

    it('should_compute_retroactive_flag_before_enforcing_pin_when_reversing', () => {
      const retroactiveAt = sql.indexOf('INTO v_retroactive;');
      const exceptionAt = sql.indexOf('Ajuste retroativo em caixa fechado exige PIN de gerente');
      const insertAt = sql.indexOf('INSERT INTO public.transactions (');

      expect(retroactiveAt).toBeGreaterThan(0);
      expect(exceptionAt).toBeGreaterThan(retroactiveAt);
      expect(insertAt).toBeGreaterThan(exceptionAt);
    });

    it('should_mark_retroactive_adjustment_when_cash_is_confirmed', () => {
      expect(sql).toContain('ADD COLUMN IF NOT EXISTS retroactive_adjustment BOOLEAN NOT NULL DEFAULT false;');
      expect(sql).toContain("'retroactive_adjustment', v_retroactive");
      expect(sql).toContain('v_retroactive\n  )');
    });
  });

  describe('R-04 — migration original sem provisionamento de PIN', () => {
    it('should_not_declare_set_audit_pin_when_migration_runs', () => {
      expect(sql).not.toContain('FUNCTION public.set_audit_pin');
      expect(sql).not.toContain('set_audit_pin(');
    });
  });

  describe('R-03 — throttle sem lockout', () => {
    it('should_keep_the_250ms_throttle_when_pin_is_invalid', () => {
      expect(sql).toContain('PERFORM pg_sleep(0.25);');
    });
  });
});
