import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isManagerAccessRole } from '../../context/AuthContext';
import { createAccountsPayableRepository } from '../../domain/accountsPayable/repository';
import { scheduleBlocksApi } from '../../services/scheduleBlocksApi';
import { supabase } from '../../services/supabaseClient';

vi.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
  getScopedClient: vi.fn(),
}));

describe('SEC-007: Route Guards & Explicit tenant_id Filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_allow_only_manager_and_superadmin_in_isManagerAccessRole', () => {
    expect(isManagerAccessRole('manager')).toBe(true);
    expect(isManagerAccessRole('superadmin')).toBe(true);
    expect(isManagerAccessRole('barber')).toBe(false);
    expect(isManagerAccessRole('receptionist')).toBe(false);
    expect(isManagerAccessRole('unknown')).toBe(false);
  });

  it('should_filter_by_tenant_id_in_accounts_payable_repository_methods', async () => {
    const eqMock = vi.fn();
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'ap-1' }, error: null });
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { id: 'ap-1' }, error: null });
    const selectMock = vi.fn(() => ({
      eq: eqMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
    }));

    const chain: Record<string, unknown> = {
      eq: eqMock,
      select: selectMock,
      single: singleMock,
      maybeSingle: maybeSingleMock,
      then: (resolve: (value: unknown) => void) => resolve({ error: null }),
    };
    eqMock.mockReturnValue(chain);

    const mockClient = {
      from: vi.fn(() => ({
        update: vi.fn(() => chain),
        delete: vi.fn(() => chain),
        select: selectMock,
      })),
      rpc: vi.fn(),
    };

    const repo = createAccountsPayableRepository(mockClient as never);

    await repo.updateRecurringBill('bill-1', 'tenant-1', { name: 'Aluguel' });
    await repo.deleteRecurringBill('bill-1', 'tenant-1');
    await repo.getRecurringBillById('bill-1', 'tenant-1');
    await repo.getAccountsPayableById('ap-1', 'tenant-1');
    await repo.updateAccountPayable('ap-1', 'tenant-1', { notes: 'Pago' });

    const tenantCalls = eqMock.mock.calls.filter(
      ([column, value]) => column === 'tenant_id' && value === 'tenant-1',
    );
    expect(tenantCalls).toHaveLength(5);

    await expect(repo.deleteRecurringBill('bill-1', '')).rejects.toThrow(/tenantId/);
  });

  it('should_filter_by_tenant_id_in_schedule_blocks_update_and_remove', async () => {
    const eqMock = vi.fn();
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'blk-1' }, error: null });
    const chain: Record<string, unknown> = {
      eq: eqMock,
      select: vi.fn(() => ({ single: singleMock })),
      then: (resolve: (value: unknown) => void) => resolve({ error: null }),
    };
    eqMock.mockReturnValue(chain);

    (supabase.from as ReturnType<typeof vi.fn>).mockReturnValue({
      update: vi.fn(() => chain),
    });

    await scheduleBlocksApi.update('tenant-1', 'blk-1', { reason: 'Almoço' });
    await scheduleBlocksApi.remove('tenant-1', 'blk-1', 'user-1');

    const tenantCalls = eqMock.mock.calls.filter(
      ([column, value]) => column === 'tenant_id' && value === 'tenant-1',
    );
    expect(tenantCalls).toHaveLength(2);

    await expect(scheduleBlocksApi.remove('', 'blk-1', 'user-1')).rejects.toThrow(/tenantId/);
  });
});
