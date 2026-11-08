import { describe, it, expect, beforeEach } from 'vitest';
import { cardFeeRepository } from './cardFeeRepository';

describe('CardFeeRepository: Persistência de Políticas de Taxa de Cartão', () => {
  beforeEach(() => {
    cardFeeRepository.clearInMemory();
  });

  it('should_return_gross_by_default_for_tenant_and_staff', async () => {
    const defaultPolicy = await cardFeeRepository.getTenantDefaultPolicy('tenant-1');
    expect(defaultPolicy).toBe('gross');

    const staffPolicy = await cardFeeRepository.getStaffPolicy('tenant-1', 'staff-1');
    expect(staffPolicy).toBe('gross');
  });

  it('should_update_tenant_default_policy', async () => {
    await cardFeeRepository.setTenantDefaultPolicy('tenant-1', 'split');
    const updated = await cardFeeRepository.getTenantDefaultPolicy('tenant-1');
    expect(updated).toBe('split');

    // Barbeiro sem política própria deve herdar a nova política da barbearia
    const staffPolicy = await cardFeeRepository.getStaffPolicy('tenant-1', 'staff-no-custom');
    expect(staffPolicy).toBe('split');
  });

  it('should_allow_individual_staff_policy_override', async () => {
    await cardFeeRepository.setTenantDefaultPolicy('tenant-1', 'split');
    await cardFeeRepository.setStaffPolicy('tenant-1', 'barber-vip', 'gross');
    await cardFeeRepository.setStaffPolicy('tenant-1', 'barber-junior', 'deducted');

    expect(await cardFeeRepository.getStaffPolicy('tenant-1', 'barber-vip')).toBe('gross');
    expect(await cardFeeRepository.getStaffPolicy('tenant-1', 'barber-junior')).toBe('deducted');
    expect(await cardFeeRepository.getStaffPolicy('tenant-1', 'barber-other')).toBe('split');
  });

  it('should_list_all_custom_staff_policies', async () => {
    await cardFeeRepository.setStaffPolicy('tenant-1', 'st-1', 'deducted');
    await cardFeeRepository.setStaffPolicy('tenant-1', 'st-2', 'split');

    const map = await cardFeeRepository.listStaffPolicies('tenant-1');
    expect(map).toEqual({
      'st-1': 'deducted',
      'st-2': 'split',
    });
  });
});
