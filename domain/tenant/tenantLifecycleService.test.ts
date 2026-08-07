/**
 * [SMG][DOMAIN][TENANT] tenantLifecycleService tests
 *
 * Cobre a API congelada (entry audit 6.0.5.4 §2.5 / LIFECYCLE_MODEL §4.1):
 *   - VALID_TRANSITIONS por matriz completa (7 estados)
 *   - transitionTo aceita transições válidas e rejeita inválidas
 *     (e.g. cancelled → active, active → trial)
 *   - canAccess espelha o Estado Efetivo (D-6.0.5-1/2)
 *   - tenant inexistente -> erro
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  TenantLifecycleServiceImpl,
  VALID_TRANSITIONS,
} from './tenantLifecycleService';
import type { Tenant, TenantStatus } from './types';
import type { TenantRepository } from './repository';

const freshTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: 'tenant-1',
  name: 'Studio Teste',
  slug: 'studio-teste',
  status: 'active',
  plan: 'pro',
  app_slug: 'barber',
  first_appointment_at: null,
  created_at: '2026-08-06T00:00:00.000Z',
  updated_at: '2026-08-06T00:00:00.000Z',
  ...overrides,
});

const makeRepo = (
  tenants: Record<string, Tenant> = { [freshTenant().id]: freshTenant() },
): TenantRepository => ({
  getById: vi.fn(async (id: string) => tenants[id] ?? null),
  getBySlug: vi.fn(async () => null),
  existsBySlug: vi.fn(async () => false),
  updateStatus: vi.fn(async (id: string, status: Tenant['status']) => {
    const t = tenants[id];
    if (!t) throw new Error('Tenant não encontrado');
    tenants[id] = { ...t, status };
    return tenants[id];
  }),
});

describe('VALID_TRANSITIONS (matriz congelada ADR-013 §5.2)', () => {
  it('should_cover_all_7_tenant_statuses', () => {
    const expected: Record<TenantStatus, TenantStatus[]> = {
      draft: ['trial', 'cancelled'],
      trial: ['active', 'past_due', 'cancelled'],
      active: ['past_due', 'cancelled'],
      past_due: ['active', 'suspended', 'cancelled'],
      suspended: ['active', 'cancelled'],
      cancelled: ['archived'],
      archived: [],
    };
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual(Object.keys(expected).sort());
    for (const status of Object.keys(expected) as TenantStatus[]) {
      expect([...VALID_TRANSITIONS[status]]).toEqual(expected[status]);
    }
  });

  it('should_not_allow_cancelled_to_active (máquina congelada)', () => {
    expect(VALID_TRANSITIONS.cancelled).not.toContain('active');
  });

  it('should_not_allow_reactivation_via_cycle_from_suspended_except_active_or_cancelled', () => {
    expect(VALID_TRANSITIONS.suspended).toEqual(['active', 'cancelled']);
  });
});

describe('TenantLifecycleService.transitionTo', () => {
  it('should_apply_valid_transition_when_in_matrix', async () => {
    const repo = makeRepo();
    const service = new TenantLifecycleServiceImpl(repo);

    await service.transitionTo('tenant-1', 'past_due', 'grace iniciado');

    expect(repo.updateStatus).toHaveBeenCalledWith('tenant-1', 'past_due');
  });

  it('should_apply_suspension_transition (past_due → suspended)', async () => {
    const repo = makeRepo({ 'tenant-1': freshTenant({ status: 'past_due' }) });
    const service = new TenantLifecycleServiceImpl(repo);

    await service.transitionTo('tenant-1', 'suspended', 'grace expirado');

    expect(repo.updateStatus).toHaveBeenCalledWith('tenant-1', 'suspended');
  });

  it('should_reactivate_suspended (suspended → active)', async () => {
    const repo = makeRepo({ 'tenant-1': freshTenant({ status: 'suspended' }) });
    const service = new TenantLifecycleServiceImpl(repo);

    await service.transitionTo('tenant-1', 'active', 'pagamento confirmado');

    expect(repo.updateStatus).toHaveBeenCalledWith('tenant-1', 'active');
  });

  it('should_reject_invalid_transition_cancelled_to_active', async () => {
    const repo = makeRepo({ 'tenant-cx': freshTenant({ id: 'tenant-cx', status: 'cancelled' }) });
    const service = new TenantLifecycleServiceImpl(repo);

    await expect(
      service.transitionTo('tenant-cx', 'active', 'reativação proibida'),
    ).rejects.toThrow('Transição inválida de tenant: cancelled → active');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('should_reject_invalid_transition_active_to_trial', async () => {
    const repo = makeRepo();
    const service = new TenantLifecycleServiceImpl(repo);

    await expect(
      service.transitionTo('tenant-1', 'trial', 'rollback proibido'),
    ).rejects.toThrow('Transição inválida de tenant: active → trial');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });

  it('should_throw_when_tenant_not_found', async () => {
    const repo = makeRepo({});
    const service = new TenantLifecycleServiceImpl(repo);

    await expect(
      service.transitionTo('tenant-inexistente', 'active', 'x'),
    ).rejects.toThrow('Tenant não encontrado');
    expect(repo.updateStatus).not.toHaveBeenCalled();
  });
});

describe('TenantLifecycleService.getValidTransitions', () => {
  it('should_return_past_due_transitions_per_matrix', () => {
    const service = new TenantLifecycleServiceImpl(makeRepo());
    expect(service.getValidTransitions('past_due')).toEqual(['active', 'suspended', 'cancelled']);
  });

  it('should_return_copy_not_reference', () => {
    const service = new TenantLifecycleServiceImpl(makeRepo());
    const transitions = service.getValidTransitions('suspended');
    transitions.push('archived'); // mutação não pode afetar a matriz
    expect(VALID_TRANSITIONS.suspended).toEqual(['active', 'cancelled']);
  });
});

describe('TenantLifecycleService.canAccess (espelho Estado Efetivo — D-6.0.5-1/2)', () => {
  it('should_allow_trial_active_past_due_cancelled', () => {
    const service = new TenantLifecycleServiceImpl(makeRepo());
    expect(service.canAccess('trial')).toBe(true);
    expect(service.canAccess('active')).toBe(true);
    expect(service.canAccess('past_due')).toBe(true);
    expect(service.canAccess('cancelled')).toBe(true);
  });

  it('should_block_draft_suspended_archived', () => {
    const service = new TenantLifecycleServiceImpl(makeRepo());
    expect(service.canAccess('draft')).toBe(false);
    expect(service.canAccess('suspended')).toBe(false);
    expect(service.canAccess('archived')).toBe(false);
  });
});
