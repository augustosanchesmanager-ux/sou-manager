import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientModule from '../../services/supabaseClient';
import {
  getPublicAvailableSlots,
  getPublicTenantProfile,
  isUsingMock,
} from '../../src/pages/public/booking/hooks/bookingService';

const BOOKING_SERVICE_PATH = path.resolve(
  process.cwd(),
  'src/pages/public/booking/hooks/bookingService.ts'
);

describe('AGD-001 (#385) isolate public booking mock from production bundle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    import.meta.env.PROD = false;
    import.meta.env.DEV = true;
  });

  it('should_not_contain_static_import_of_mock_service_in_booking_service', () => {
    const source = fs.readFileSync(BOOKING_SERVICE_PATH, 'utf8');
    expect(source).not.toMatch(/from\s+['"]\.\/mockService['"]/);
    expect(source).toContain("import('./mockService')");
    expect(source).toContain('import.meta.env.PROD');
    expect(source).toContain('import.meta.env.DEV');
  });

  it('should_never_enable_mock_or_fallback_on_42883_when_prod_build_is_active', async () => {
    import.meta.env.PROD = true;
    import.meta.env.DEV = false;
    vi.stubEnv('VITE_ENABLE_BOOKING_MOCK', 'true');
    vi.stubEnv('VITE_BOOKING_MOCK', 'true');

    expect(isUsingMock()).toBe(false);

    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42883',
        message: 'function public.get_public_tenant_profile(text) does not exist',
      },
    });
    vi.spyOn(clientModule, 'getPublicAnonymousClient').mockReturnValue({
      rpc: mockRpc,
    } as never);

    await expect(getPublicTenantProfile('barbearia-real')).rejects.toMatchObject({
      code: '42883',
    });

    await expect(
      getPublicAvailableSlots('barbearia-real', null, ['svc-1'], '2026-11-24')
    ).rejects.toMatchObject({
      code: '42883',
    });
  });
});
