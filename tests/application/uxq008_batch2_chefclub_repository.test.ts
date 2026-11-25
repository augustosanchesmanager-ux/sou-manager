import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ChefClubRpcRepositoryImpl } from '../../domain/chefClub/rpc-repository';

const BATCH_2_FILES = [
  'application/chefClub/credits.ts',
  'application/chefClub/operations.ts',
  'application/chefClub/receivables.ts',
  'application/chefClub/subscriptions.ts',
];

describe('UXQ-008 / ADR-056 — Lote 2: Chef Club Repository Migration', () => {
  it('should_have_zero_direct_supabase_client_imports_in_chef_club_application_services', () => {
    for (const relPath of BATCH_2_FILES) {
      const content = readFileSync(resolve(process.cwd(), relPath), 'utf8');
      expect(content, `${relPath} still imports createSupabaseClient`).not.toContain('createSupabaseClient');
      expect(content, `${relPath} still imports supabaseClient`).not.toContain('supabaseClient');
    }
  });

  it('should_delegate_deduct_credits_rpc_in_ChefClubRpcRepositoryImpl', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const repo = new ChefClubRpcRepositoryImpl(() => ({ rpc }) as never);

    const res = await repo.deductCredits({
      subscriptionId: 'sub-1',
      serviceId: 'svc-1',
      amount: 1,
      reference: 'comanda-1',
    });

    expect(rpc).toHaveBeenCalledWith('deduct_chef_club_credits', {
      p_subscription_id: 'sub-1',
      p_service_id: 'svc-1',
      p_amount: 1,
      p_reference: 'comanda-1',
    });
    expect(res.error).toBeNull();
  });

  it('should_delegate_cancel_receivables_rpc_and_coerce_count_in_ChefClubRpcRepositoryImpl', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: '3', error: null });
    const repo = new ChefClubRpcRepositoryImpl(() => ({ rpc }) as never);

    const res = await repo.cancelReceivables({
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
      cancelReason: 'client_request',
      cancelObservation: null,
    });

    expect(rpc).toHaveBeenCalledWith('cancel_club_receivables', {
      p_subscription_id: 'sub-1',
      p_tenant_id: 'tenant-1',
      p_cancel_reason: 'client_request',
      p_cancel_observation: null,
    });
    expect(res.data).toBe(3);
    expect(res.error).toBeNull();
  });
});
