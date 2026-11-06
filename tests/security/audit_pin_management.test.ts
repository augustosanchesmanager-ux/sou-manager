/**
 * AUDIT-PIN-COMPETENCE — autoatendimento do PIN gerencial.
 *
 * Valida o contrato SQL da migration 20261105190000, aprovado pelo PO em
 * 2026-11-05 (R-04 revisado):
 * - gestão do próprio PIN em Configurações;
 * - `set_audit_pin` sem `p_user_id` (alvo é sempre `auth.uid()`);
 * - PIN atual obrigatório quando já existe;
 * - auditoria sanitizada em `audit_logs`, sem `pin_hash`;
 * - `anon` sem EXECUTE e helper interno sem acesso pela API.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261105190000_add_audit_pin_management.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

const functionBlock = (name: string, nextMarker: string): string => {
  const start = sql.indexOf(`FUNCTION public.${name}`);
  const end = sql.indexOf(nextMarker, start);
  return sql.slice(start, end);
};

describe('AUDIT-PIN-COMPETENCE — migration de autoatendimento do PIN', () => {
  describe('R-04 revisado — gestão em Configurações', () => {
    it('should_declare_management_rpcs_when_migration_runs', () => {
      expect(sql).toContain('FUNCTION public.can_manage_audit_pin(');
      expect(sql).toContain('FUNCTION public.get_audit_pin_status(');
      expect(sql).toContain('FUNCTION public.set_audit_pin(');
    });

    it('should_target_the_authenticated_user_when_setting_pin', () => {
      const block = functionBlock('set_audit_pin', 'REVOKE ALL ON FUNCTION public.set_audit_pin');

      expect(block).toContain('v_auth_uid      UUID := auth.uid();');
      expect(block).not.toContain('p_user_id');
    });

    it('should_require_the_current_pin_when_a_pin_already_exists', () => {
      expect(sql).toContain("RAISE EXCEPTION 'PIN atual obrigatorio para alterar o PIN';");
      expect(sql).toContain('IF NOT public.verify_audit_pin(v_auth_uid, p_tenant_id, v_current_pin) THEN');
    });

    it('should_hash_the_new_pin_with_bcrypt_when_saving', () => {
      expect(sql).toContain("crypt(v_new_pin, gen_salt('bf', 12))");
      expect(sql).not.toMatch(/pin_hash\s*=\s*v_new_pin/);
    });
  });

  describe('R-01 — manager_pins continua deny-all para a API', () => {
    it('should_keep_manager_pins_denied_when_new_rpcs_are_created', () => {
      expect(sql).not.toMatch(/CREATE POLICY[^;]*public\.manager_pins/i);
      expect(sql).not.toMatch(/GRANT [^;]*ON TABLE public\.manager_pins/i);
      expect(sql).not.toContain('ALTER TABLE public.manager_pins ENABLE ROW LEVEL SECURITY;');
    });

    it('should_read_only_the_caller_row_when_status_and_set_are_called', () => {
      const statusBlock = functionBlock(
        'get_audit_pin_status',
        'REVOKE ALL ON FUNCTION public.get_audit_pin_status',
      );
      const setBlock = functionBlock('set_audit_pin', 'REVOKE ALL ON FUNCTION public.set_audit_pin');

      expect(statusBlock).toContain('WHERE mp.user_id = v_auth_uid');
      expect(statusBlock).toContain('AND mp.tenant_id = p_tenant_id');
      expect(setBlock).toContain('WHERE mp.user_id = v_auth_uid');
      expect(setBlock).toContain('AND mp.tenant_id = p_tenant_id');
    });

    it('should_never_select_the_hash_when_returning_status', () => {
      const statusBlock = functionBlock(
        'get_audit_pin_status',
        'REVOKE ALL ON FUNCTION public.get_audit_pin_status',
      );

      expect(statusBlock).toContain('SELECT mp.updated_at INTO v_updated_at');
      expect(statusBlock).not.toContain('pin_hash');
    });

    it('should_revoke_the_internal_helper_from_the_api_when_declared', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.can_manage_audit_pin(UUID, UUID) FROM anon;');
      expect(sql).toContain(
        'REVOKE ALL ON FUNCTION public.can_manage_audit_pin(UUID, UUID) FROM authenticated;',
      );
      expect(sql).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.can_manage_audit_pin/i);
    });

    it('should_grant_only_authenticated_when_exposing_management_rpcs', () => {
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.get_audit_pin_status(UUID) FROM anon;');
      expect(sql).toContain(
        'GRANT EXECUTE ON FUNCTION public.get_audit_pin_status(UUID) TO authenticated;',
      );
      expect(sql).toContain('REVOKE ALL ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) FROM anon;');
      expect(sql).toContain(
        'GRANT EXECUTE ON FUNCTION public.set_audit_pin(UUID, TEXT, TEXT) TO authenticated;',
      );
    });
  });

  describe('R-02/R-03 — enforcement preservado', () => {
    it('should_reject_creation_when_the_new_pin_is_out_of_range', () => {
      expect(sql).toContain("v_new_pin !~ '^[0-9]{6,8}$'");
      expect(sql).toContain("RAISE EXCEPTION 'PIN deve ter de 6 a 8 digitos';");
    });

    it('should_keep_the_250ms_throttle_when_current_pin_is_wrong', () => {
      expect(sql).toContain('PERFORM pg_sleep(0.25);');
      expect(sql).toContain("RAISE EXCEPTION 'PIN atual invalido';");
    });
  });

  describe('Auditoria — sem hash em audit_logs', () => {
    it('should_not_attach_the_generic_audit_trigger_when_manager_pins_is_managed', () => {
      expect(sql).not.toMatch(/CREATE TRIGGER[^;]*manager_pins/i);
      expect(sql).not.toContain('process_audit_log');
    });

    it('should_write_a_sanitized_audit_record_when_pin_is_created_or_changed', () => {
      const auditStart = sql.indexOf('INSERT INTO public.audit_logs (');
      const auditEnd = sql.indexOf('RETURN jsonb_build_object(', auditStart);
      const auditBlock = sql.slice(auditStart, auditEnd);

      expect(auditStart).toBeGreaterThan(0);
      expect(auditBlock).toContain("'manager_pins'");
      expect(auditBlock).toContain("CASE WHEN v_created THEN 'INSERT' ELSE 'UPDATE' END");
      expect(auditBlock).toContain("jsonb_build_object('configured', true)");
      expect(auditBlock).not.toContain('pin_hash');
      expect(auditBlock).not.toContain('to_jsonb(NEW)');
    });
  });
});
