/**
 * F3.1 — Teste de Segurança: guarda de autorização em approve_access_request
 *
 * Achado da auditoria de segurança (Categoria 3 — Autorização, severidade média):
 * a RPC legada `approve_access_request` é SECURITY DEFINER e cria tenant, marca
 * pedido e insere notificação sem nenhuma guarda de auth.uid()/superadmin no corpo.
 * A correção h6 (20260813120500) apenas revogou anon/PUBLIC e concedeu a
 * authenticated — qualquer usuário autenticado podia invocar a operação.
 *
 * Correção (migration 20260914120000): guardas canônicas no corpo, no mesmo
 * padrão das demais RPCs administrativas (20260807010000/20260807020000):
 *   (1) auth.uid() IS NULL                       -> 'Authentication required'
 *   (2) current_is_super_admin_from_auth_uid()   -> raise superadmin
 *
 * Estes testes validam por inspeção estática do SQL da migration (mesma técnica
 * do planCatalogMigrationSync.test.ts): asseguram que as sentinelas do fix
 * existem, estão ANTES do corpo de negócio (não executável sem autorização) e que
 * a função permanece SECURITY DEFINER.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20260914120000_fix_approve_access_request_auth_guard.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

describe('F3.1 Security — approve_access_request guard', () => {
  it('should_require_authentication_before_business_logic', () => {
    // Arrange — posição da primeira guarda deve preceder a primeira operação de negócio
    const authGuardPos = sql.indexOf("auth.uid() IS NULL");
    const firstBusinessOp = sql.indexOf("SELECT * FROM public.access_requests");

    // Act & Assert
    expect(authGuardPos).toBeGreaterThan(-1);
    expect(firstBusinessOp).toBeGreaterThan(-1);
    expect(authGuardPos).toBeLessThan(firstBusinessOp);
  });

  it('should_require_superadmin_before_business_logic', () => {
    // Arrange
    const superadminGuardPos = sql.indexOf('current_is_super_admin_from_auth_uid()');
    const raiseMessagePos = sql.indexOf('Insufficient permissions: superadmin required');
    const firstBusinessOp = sql.indexOf("SELECT * FROM public.access_requests");

    // Act & Assert
    expect(superadminGuardPos).toBeGreaterThan(-1);
    expect(raiseMessagePos).toBeGreaterThan(-1);
    expect(superadminGuardPos).toBeLessThan(firstBusinessOp);
  });

  it('should_raise_exception_when_unauthenticated', () => {
    // Arrange
    const authRaisePos = sql.indexOf("RAISE EXCEPTION 'Authentication required'");

    // Act & Assert
    expect(authRaisePos).toBeGreaterThan(-1);
    expect(authRaisePos).toBeLessThan(sql.indexOf('current_is_super_admin_from_auth_uid()'));
  });

  it('should_keep_security_definer', () => {
    // Act & Assert
    expect(sql).toContain('SECURITY DEFINER');
  });

  it('should_preserve_original_business_logic', () => {
    // Arrange — sentinelas do corpo original de 20260220150238
    const createsTenant = sql.includes('INSERT INTO public.tenants');
    const updatesRequest = sql.includes("UPDATE public.access_requests");
    const createsNotification = sql.includes('INSERT INTO public.notifications');

    // Act & Assert
    expect(createsTenant).toBe(true);
    expect(updatesRequest).toBe(true);
    expect(createsNotification).toBe(true);
  });
});