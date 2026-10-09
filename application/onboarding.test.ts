/**
 * [SMG][APPLICATION][ONBOARDING] CompleteOnboardingService tests
 *
 * Cobre o seed idempotente do catálogo inicial de serviços
 * (ensureInitialCatalog) — Fase 6.0.2, wizard de onboarding.
 *
 * Convenções: AAA, should_<result>_when_<condition>.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
// O módulo de onboarding importa singletons com side effects de load
// (repositories constroem clientes Supabase; event bus e lifecycle
// registram subscribers). Mockamos todos para isolar o método testado.

const mockServiceList = vi.fn();
const mockServiceCreateMany = vi.fn();

vi.mock('../domain/service/repository', () => ({
  serviceRepository: {
    list: (...args: unknown[]) => mockServiceList(...args),
    createMany: (...args: unknown[]) => mockServiceCreateMany(...args),
  },
}));

vi.mock('../domain/tenantSettings/repository', () => ({
  tenantSettingsRepository: {},
}));

vi.mock('../domain/shared/supabase-client-factory', () => ({
  createSupabaseClient: vi.fn(),
}));

vi.mock('../domain/events/app-bus', () => ({
  appEventBus: { publish: vi.fn() },
}));

vi.mock('./tenantLifecycle', () => ({
  tenantLifecycleService: { startTrial: vi.fn() },
}));

// ─── Imports (depois dos mocks) ───────────────────────────────────
import { completeOnboardingService } from './onboarding';
import type { InitialCatalogRow } from './onboarding';

const DEFAULT_ROWS: InitialCatalogRow[] = [
  { name: 'Corte masculino', category: 'Cabelo', price: 65, duration: 45 },
  { name: 'Barba', category: 'Barba', price: 55, duration: 35 },
  { name: 'Corte + Barba', category: 'Combo', price: 105, duration: 70 },
];

describe('CompleteOnboardingService.ensureInitialCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_seed_catalog_when_tenant_has_no_services', async () => {
    // Arrange
    mockServiceList.mockResolvedValue([]);
    mockServiceCreateMany.mockResolvedValue(undefined);

    // Act
    const result = await completeOnboardingService.ensureInitialCatalog({
      tenantId: 'tenant-1',
      services: DEFAULT_ROWS,
    });

    // Assert
    expect(result).toEqual({ seeded: true, count: 3 });
    expect(mockServiceCreateMany).toHaveBeenCalledTimes(1);
    expect(mockServiceCreateMany).toHaveBeenCalledWith('tenant-1', DEFAULT_ROWS);
  });

  it('should_skip_seed_when_tenant_already_has_services', async () => {
    // Arrange
    mockServiceList.mockResolvedValue([{ id: 'svc-1', name: 'Corte existente' }]);

    // Act
    const result = await completeOnboardingService.ensureInitialCatalog({
      tenantId: 'tenant-1',
      services: DEFAULT_ROWS,
    });

    // Assert
    expect(result).toEqual({ seeded: false, count: 1 });
    expect(mockServiceCreateMany).not.toHaveBeenCalled();
  });

  it('should_not_seed_when_rows_are_empty', async () => {
    // Arrange
    mockServiceList.mockResolvedValue([]);

    // Act
    const result = await completeOnboardingService.ensureInitialCatalog({
      tenantId: 'tenant-1',
      services: [],
    });

    // Assert
    expect(result).toEqual({ seeded: false, count: 0 });
    expect(mockServiceCreateMany).not.toHaveBeenCalled();
  });
});