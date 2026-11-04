/**
 * F2.1 / Issue #223 — Teste de Segurança: RLS em tabelas mestres com escrita restrita a gerentes
 *
 * Valida a integridade da migration 20261103160000_fix_sec_rls_master_tables_manager_write.sql:
 * - Assegura que ENABLE ROW LEVEL SECURITY esteja ativo nas 4 tabelas
 * - Assegura que SELECT seja concedido a authenticated por tenant
 * - Assegura que INSERT, UPDATE e DELETE exijam current_is_manager_from_auth_uid(tenant_id)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(
  process.cwd(),
  'supabase/migrations/20261103160000_fix_sec_rls_master_tables_manager_write.sql',
);

const sql = readFileSync(MIGRATION, 'utf-8');

describe('F2.1 / Issue #223 — RLS Master Tables Manager Write Enforcement', () => {
  const tables = ['services', 'products', 'suppliers', 'payment_terminals'];

  it('should enable RLS on all 4 master tables', () => {
    for (const table of tables) {
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
  });

  it('should guarantee helper current_is_manager_from_auth_uid definition', () => {
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.current_is_manager_from_auth_uid');
    expect(sql).toContain('SECURITY DEFINER');
    expect(sql).toContain("SET search_path = public");
  });

  it('should restrict INSERT on services and products to managers', () => {
    expect(sql).toContain('CREATE POLICY "services_insert_manager" ON public.services');
    expect(sql).toContain('public.current_is_manager_from_auth_uid(tenant_id)');

    expect(sql).toContain('CREATE POLICY "products_insert_manager" ON public.products');
    expect(sql).toContain('CREATE POLICY "suppliers_insert_manager" ON public.suppliers');
    expect(sql).toContain('CREATE POLICY "payment_terminals_insert_manager" ON public.payment_terminals');
  });

  it('should restrict UPDATE and DELETE on services, products, suppliers and terminals', () => {
    expect(sql).toContain('CREATE POLICY "services_update_manager" ON public.services');
    expect(sql).toContain('CREATE POLICY "services_delete_manager" ON public.services');

    expect(sql).toContain('CREATE POLICY "products_update_manager" ON public.products');
    expect(sql).toContain('CREATE POLICY "products_delete_manager" ON public.products');

    expect(sql).toContain('CREATE POLICY "suppliers_update_manager" ON public.suppliers');
    expect(sql).toContain('CREATE POLICY "suppliers_delete_manager" ON public.suppliers');

    expect(sql).toContain('CREATE POLICY "payment_terminals_update_manager" ON public.payment_terminals');
    expect(sql).toContain('CREATE POLICY "payment_terminals_delete_manager" ON public.payment_terminals');
  });

  it('should maintain SELECT for authenticated users in services, products and suppliers', () => {
    expect(sql).toContain('CREATE POLICY "services_select_tenant" ON public.services');
    expect(sql).toContain('CREATE POLICY "products_select_tenant" ON public.products');
    expect(sql).toContain('CREATE POLICY "suppliers_select_tenant" ON public.suppliers');
  });
});
