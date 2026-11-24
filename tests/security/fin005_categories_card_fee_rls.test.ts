import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { CategoriesRepositoryImpl } from '../../domain/categories/repository';
import { CardFeeRepository } from '../../domain/paymentTerminal/cardFeeRepository';
import type { DatabaseClient } from '../../domain/shared/database-client';

const ROOT = process.cwd();
const MIGRATION_PATH = path.join(
  ROOT,
  'supabase/migrations/20261124182500_security_fix_fin005_categories_and_card_fee_policies.sql'
);

function createChainMock(result: { data: unknown; error: unknown }) {
  const chain: Record<string, any> = {};
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'is', 'order']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn().mockResolvedValue(result);
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  // Make chain directly awaitable for queries ending in .eq/.order
  chain.then = (resolve: (value: unknown) => void) => resolve(result);
  return chain;
}

describe('FIN-005 (#382) categories & card_fee_policies Supabase persistence and RLS', () => {
  it('should_define_rls_and_least_privilege_grants_for_categories_and_card_fee_policies', () => {
    const sql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    expect(sql).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.categories');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.card_fee_policies');
    expect(sql).toContain('REVOKE ALL ON TABLE public.categories FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('REVOKE ALL ON TABLE public.card_fee_policies FROM PUBLIC, anon, authenticated;');
    expect(sql).toContain('uidx_card_fee_policies_tenant_default');
    expect(sql).toContain('uidx_card_fee_policies_tenant_staff');
    expect(sql).toContain("CHECK (policy IN ('gross', 'split', 'deducted'))");
  });

  it('should_remove_localStorage_persistence_from_categories_page_and_card_fee_repository', () => {
    const categoriesPage = fs.readFileSync(path.join(ROOT, 'pages/Categories.tsx'), 'utf8');
    const cardFeeRepoSource = fs.readFileSync(
      path.join(ROOT, 'domain/paymentTerminal/cardFeeRepository.ts'),
      'utf8'
    );

    expect(categoriesPage).not.toContain('localStorage');
    expect(categoriesPage).toContain('categoriesRepository');
    expect(cardFeeRepoSource).not.toContain('localStorage');
  });

  it('should_filter_categories_by_tenant_id_on_list_and_remove', async () => {
    const chain = createChainMock({
      data: [
        {
          id: 'cat-1',
          tenant_id: '11111111-1111-1111-1111-111111111111',
          name: 'Barba',
          description: 'Serviços de barba',
          active: true,
          created_at: '2026-11-24T12:00:00Z',
        },
      ],
      error: null,
    });
    const db: DatabaseClient = {
      from: vi.fn(() => chain) as any,
      rpc: vi.fn() as any,
    };

    const repo = new CategoriesRepositoryImpl(db);
    const tenantA = '11111111-1111-1111-1111-111111111111';
    const rows = await repo.listByTenant(tenantA);

    expect(rows).toHaveLength(1);
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', tenantA);

    await repo.remove(tenantA, 'cat-1');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'cat-1');
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', tenantA);
  });

  it('should_isolate_card_fee_policies_by_tenant_id_in_supabase_queries', async () => {
    const tenantA = '11111111-1111-1111-1111-111111111111';
    const staffA = '22222222-2222-2222-2222-222222222222';
    const chain = createChainMock({
      data: [
        { tenant_id: tenantA, staff_id: null, policy: 'split' },
        { tenant_id: tenantA, staff_id: staffA, policy: 'deducted' },
      ],
      error: null,
    });
    const db: DatabaseClient = {
      from: vi.fn(() => chain) as any,
      rpc: vi.fn() as any,
    };

    const repo = new CardFeeRepository(db);
    repo.clearInMemory();

    expect(await repo.getTenantDefaultPolicy(tenantA)).toBe('split');
    expect(await repo.getStaffPolicy(tenantA, staffA)).toBe('deducted');
    expect(await repo.getStaffPolicy(tenantA, '33333333-3333-3333-3333-333333333333')).toBe('split');
    expect(chain.eq).toHaveBeenCalledWith('tenant_id', tenantA);
  });
});
