/**
 * GAP-03 (Issue #216) — Teste de Segurança: adoção de perfil órfão em accept_invite
 *
 * Valida o contrato SQL da migration 20261110090000_fix_accept_invite_orphan_tenant.sql:
 * - permite vincular perfil/staff órfão (`tenant_id IS NULL`) ao tenant do convite;
 * - mantém bloqueio estrito cross-tenant (`SQLSTATE 42501`) quando `tenant_id IS NOT NULL AND <> v_invite.tenant_id`;
 * - protege contra race conditions com `FOR UPDATE` em `team_invitations`, `profiles` e `staff`;
 * - registra auditoria em `public.audit_logs` respeitando `audit_logs_action_check`;
 * - mantém `SECURITY DEFINER`, `SET search_path TO 'public'` e grants apenas para `authenticated`;
 * - mantém `trg_f5_profiles_tenant_status_guard` intacto.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATION_PATH = resolve(
  process.cwd(),
  'supabase/migrations/20261110090000_fix_accept_invite_orphan_tenant.sql',
);

const sql = readFileSync(MIGRATION_PATH, 'utf-8');

describe('GAP-03 Security (#216) — accept_invite orphan tenant adoption', () => {
  it('should_require_authenticated_user_before_locking_invite', () => {
    const authGuardPos = sql.indexOf('IF auth.uid() IS NULL THEN');
    const inviteLockPos = sql.indexOf('FROM public.team_invitations t');

    expect(authGuardPos).toBeGreaterThan(-1);
    expect(inviteLockPos).toBeGreaterThan(authGuardPos);
  });

  it('should_lock_invite_profile_and_staff_with_for_update_before_membership_checks', () => {
    const inviteLockPos = sql.indexOf('FROM public.team_invitations t');
    const profileLockPos = sql.indexOf('FROM public.profiles p');
    const staffLockPos = sql.indexOf('FROM public.staff s');
    const crossTenantCheckPos = sql.indexOf('v_existing_profile_tenant_id <> v_invite.tenant_id');

    expect(inviteLockPos).toBeGreaterThan(-1);
    expect(profileLockPos).toBeGreaterThan(inviteLockPos);
    expect(staffLockPos).toBeGreaterThan(profileLockPos);
    expect(sql.slice(profileLockPos, staffLockPos)).toContain('FOR UPDATE');
    expect(sql.slice(staffLockPos, crossTenantCheckPos)).toContain('FOR UPDATE');
  });

  it('should_allow_orphan_profile_and_staff_while_blocking_cross_tenant_with_42501', () => {
    // Regressão: não usar IS DISTINCT FROM na guarda de tenant (rejeitaria NULL)
    expect(sql).not.toContain('p.tenant_id IS DISTINCT FROM v_invite.tenant_id');
    expect(sql).not.toContain('s.tenant_id IS DISTINCT FROM v_invite.tenant_id');

    // Guarda explícita: só bloqueia quando já existe outro tenant não-nulo
    expect(sql).toContain('v_existing_profile_tenant_id IS NOT NULL');
    expect(sql).toContain('v_existing_profile_tenant_id <> v_invite.tenant_id');
    expect(sql).toContain('v_existing_staff_tenant_id IS NOT NULL');
    expect(sql).toContain('v_existing_staff_tenant_id <> v_invite.tenant_id');
    expect(sql).toContain("USING ERRCODE = '42501'");
  });

  it('should_write_audit_log_when_orphan_profile_is_attached', () => {
    expect(sql).toContain('IF v_orphan_profile_attached THEN');
    expect(sql).toContain('INSERT INTO public.audit_logs');
    expect(sql).toContain("'profiles'");
    expect(sql).toContain("'UPDATE'");
    expect(sql).toContain("'profile_tenant_attached'");
    expect(sql).toContain("'invited_by', v_invite.invited_by");
    expect(sql).toContain("'source', 'accept_invite'");
  });

  it('should_preserve_security_definer_search_path_and_grants_without_touching_f5_trigger', () => {
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path TO 'public'");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.accept_invite(text, text, text) FROM PUBLIC, anon;');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.accept_invite(text, text, text) TO authenticated;');
    expect(sql).not.toMatch(/DROP TRIGGER[^;]*trg_f5_profiles_tenant_status_guard/i);
    expect(sql).not.toMatch(/CREATE OR REPLACE FUNCTION public\.f5_guard_profiles_tenant_status/i);
  });
});
