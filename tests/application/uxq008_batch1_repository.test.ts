import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  TenantLifecycleRepositoryImpl,
  type TenantLifecycleRepository,
  type TenantSubscriptionRpcRow,
} from '../../domain/tenant/lifecycleRepository';
import { TenantLifecycleServiceImpl } from '../../application/tenantLifecycle';

const BATCH_1_FILES = [
  'application/onboarding.ts',
  'application/teamInvitation.ts',
  'application/tenantLifecycle.ts',
  'application/tenantProvisioning.ts',
];

const SAMPLE_SUBSCRIPTION: TenantSubscriptionRpcRow = {
  id: 'sub-1',
  tenant_id: 'tenant-1',
  plan: 'pro',
  status: 'active',
  trial_started_at: '2026-11-01T00:00:00Z',
  trial_ends_at: '2026-11-15T00:00:00Z',
  current_period_start: '2026-11-15T00:00:00Z',
  current_period_end: '2026-12-15T00:00:00Z',
  cancel_at_period_end: null,
  canceled_at: null,
  created_at: '2026-11-01T00:00:00Z',
};

describe('UXQ-008 / ADR-056 — Lote 1: Tenant & Onboarding Repository Migration', () => {
  it('should_have_zero_direct_supabase_client_imports_in_batch_1_services', () => {
    for (const relPath of BATCH_1_FILES) {
      const content = readFileSync(resolve(process.cwd(), relPath), 'utf8');
      expect(content, `${relPath} still imports createSupabaseClient`).not.toContain('createSupabaseClient');
      expect(content, `${relPath} still imports supabaseClient`).not.toContain('supabaseClient');
    }
  });

  it('should_delegate_rpc_calls_cleanly_in_TenantLifecycleRepositoryImpl', async () => {
    const single = vi.fn().mockResolvedValue({ data: SAMPLE_SUBSCRIPTION, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const repo = new TenantLifecycleRepositoryImpl(() => ({ rpc }) as never);

    const sub = await repo.activateSubscription('tenant-1');

    expect(rpc).toHaveBeenCalledWith('activate_subscription', { p_tenant_id: 'tenant-1' });
    expect(sub.id).toBe('sub-1');
    expect(sub.status).toBe('active');
  });

  it('should_throw_contextual_error_when_rpc_fails_in_TenantLifecycleRepositoryImpl', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    const rpc = vi.fn().mockReturnValue({ single });
    const repo = new TenantLifecycleRepositoryImpl(() => ({ rpc }) as never);

    await expect(repo.changeTenantPlan('tenant-1', 'premium')).rejects.toThrow(
      'Erro ao alterar plano: forbidden'
    );
  });

  it('should_support_repository_injection_in_TenantLifecycleServiceImpl', async () => {
    const mockRepo: TenantLifecycleRepository = {
      provisionNewTenant: vi.fn(),
      saveOnboardingStep: vi.fn(),
      completeOnboarding: vi.fn(),
      startTrial: vi.fn(),
      activateSubscription: vi.fn(),
      cancelSubscription: vi.fn(),
      getSubscription: vi.fn().mockResolvedValue(SAMPLE_SUBSCRIPTION),
      changeTenantPlan: vi.fn(),
    };
    const service = new TenantLifecycleServiceImpl(mockRepo);

    const view = await service.getStatus();

    expect(mockRepo.getSubscription).toHaveBeenCalledTimes(1);
    expect(view?.tenantId).toBe('tenant-1');
    expect(view?.plan).toBe('pro');
  });
});
