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
 * Emenda F3.1a: a função também declara SET search_path TO 'public', 'auth'.
 * Sem o SET explícito, CREATE OR REPLACE FUNCTION reatribui as propriedades
 * implícitas da definição — removendo silenciosamente o search_path fixado
 * que protege a função (doc PostgreSQL: "all other function properties are
 * assigned the values specified or implied in the command").
 *
 * Estes testes validam por inspeção estática do SQL da migration (mesma técnica
 * do planCatalogMigrationSync.test.ts): asseguram que as sentinelas do fix
 * existem, estão ANTES do corpo de negócio (não executável sem autorização),
 * que a função permanece SECURITY DEFINER e que o SET search_path não pode ser
 * removido silenciosamente (regressão detectada no preflight de 2026-09-14).
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

  it('should_keep_secure_search_path_in_definition', () => {
    // Arrange — F3.1a: o SET search_path deve estar na cláusula da função,
    // não apenas comentado no header (regressão detectada no preflight)
    const clauseStart = sql.indexOf('LANGUAGE plpgsql SECURITY DEFINER');
    const clauseEnd = sql.indexOf(';', clauseStart);

    // Act & Assert
    expect(clauseStart).toBeGreaterThan(-1);
    const clause = sql.slice(clauseStart, clauseEnd);
    expect(clause).toContain("SET search_path TO 'public', 'auth'");
  });

  it('should_not_regress_to_missing_search_path', () => {
    // Arrange — guarda contra regressão: nenhum bloco $$ ... $$ LANGUAGE pode
    // declarar SECURITY DEFINER sem o SET search_path de proteção
    const definitions = sql.match(/\$\$ LANGUAGE plpgsql SECURITY DEFINER[^;]*;/g) ?? [];

    // Act — cada definição de função com SECURITY DEFINER precisa do SET
    const defsWithoutSearchPath = definitions.filter(
      (def) => !def.includes("SET search_path TO 'public', 'auth'"),
    );

    // Assert
    expect(definitions.length).toBeGreaterThan(0);
    expect(defsWithoutSearchPath).toEqual([]);
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