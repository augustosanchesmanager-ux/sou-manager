/**
 * [SMG][PERMISSIONS] Role casing normalization at the Supabase boundary.
 *
 * The role_permissions table stores lowercase roles ('barber', 'receptionist')
 * and the CHECK constraint role_permissions_role_check rejects anything else.
 * The UI layer uses PascalCase PermissionRole ('Barber' | 'Receptionist'), so
 * the service boundary must normalize before submitting to the RPCs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '../../../services/supabaseClient';
import { fetchRolePermissions, saveRolePermissions, resetRolePermissions } from './service';

vi.mock('../../../services/supabaseClient', () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = supabase.rpc as ReturnType<typeof vi.fn>;

describe('permissions/service role casing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send lowercase p_role to upsert_role_permissions when saving PascalCase role', async () => {
    // Given a PascalCase role from the UI layer
    rpc.mockResolvedValue({ data: null, error: null });

    // When saving permissions
    await saveRolePermissions('tenant-1', 'Barber', { checkout: true, reports: false });

    // Then the RPC receives the lowercase role required by the DB contract
    expect(rpc).toHaveBeenCalledWith(
      'upsert_role_permissions',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_role: 'barber',
      })
    );
  });

  it('should send lowercase p_role to get_role_permissions when fetching PascalCase role', async () => {
    // Given a PascalCase role from the UI layer
    rpc.mockResolvedValue({ data: [], error: null });

    // When fetching permissions
    await fetchRolePermissions('tenant-1', 'Receptionist');

    // Then the RPC receives the lowercase role (DB filters rp.role = p_role case-sensitively)
    expect(rpc).toHaveBeenCalledWith(
      'get_role_permissions',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_role: 'receptionist',
      })
    );
  });

  it('should send lowercase p_role to reset_role_permissions_to_default when resetting PascalCase role', async () => {
    // Given a PascalCase role from the UI layer
    rpc.mockResolvedValue({ data: null, error: null });

    // When resetting permissions to default
    await resetRolePermissions('tenant-1', 'Barber');

    // Then the RPC receives the lowercase role (reset compares p_role = 'barber')
    expect(rpc).toHaveBeenCalledWith(
      'reset_role_permissions_to_default',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_role: 'barber',
      })
    );
  });

  it('should forward RPC error when saving fails', async () => {
    // Given the RPC rejects the call (e.g. CHECK violation)
    rpc.mockResolvedValue({ data: null, error: { code: '23514', message: 'check constraint' } });

    // When saving permissions
    const promise = saveRolePermissions('tenant-1', 'Barber', { checkout: true });

    // Then the error propagates to the caller
    await expect(promise).rejects.toMatchObject({ code: '23514' });
  });
});
