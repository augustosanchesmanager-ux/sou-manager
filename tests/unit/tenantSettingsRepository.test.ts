import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tenantSettingsRepository } from '../../domain/tenantSettings/repository';
import type { DatabaseClient } from '../../domain/shared/database-client';

describe('domain/tenantSettings: Repository appointment_interval_minutes persistence', () => {
  const tenantId = 'tenant-test-interval-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should_include_appointment_interval_minutes_when_updating_working_hours', async () => {
    let capturedPayload: Record<string, unknown> | null = null;

    const mockDb: DatabaseClient = {
      from: vi.fn(() => ({
        upsert: vi.fn((payload: Record<string, unknown>) => {
          capturedPayload = payload;
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'ts-1',
                  tenant_id: tenantId,
                  appointment_interval_minutes: payload.appointment_interval_minutes ?? 30,
                  work_start_time: payload.work_start_time,
                  work_end_time: payload.work_end_time,
                  booking_enabled: payload.booking_enabled,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              })),
            })),
          };
        }),
      })) as any,
    } as unknown as DatabaseClient;

    // Instancia o repositório com o client mockado
    const repo = new (tenantSettingsRepository.constructor as any)(mockDb);

    const result = await repo.updateWorkingHours(tenantId, {
      work_start_time: '08:00:00',
      work_end_time: '19:00:00',
      appointment_interval_minutes: 45,
    });

    expect(capturedPayload).not.toBeNull();
    expect(capturedPayload?.appointment_interval_minutes).toBe(45);
    expect(result.appointment_interval_minutes).toBe(45);
  });

  it('should_propagate_appointment_interval_minutes_through_upsertOnlineBookingSettings', async () => {
    let updateWorkingHoursCalledWith: any = null;

    const mockDb: DatabaseClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'tenant_settings') {
          return {
            upsert: vi.fn((payload: Record<string, unknown>) => {
              updateWorkingHoursCalledWith = payload;
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'ts-1',
                      tenant_id: tenantId,
                      ...payload,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }
        // online_booking_settings
        return {
          upsert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'obs-1',
                  tenant_id: tenantId,
                  ...payload,
                },
                error: null,
              })),
            })),
          })),
        };
      }) as any,
    } as unknown as DatabaseClient;

    const repo = new (tenantSettingsRepository.constructor as any)(mockDb);

    await repo.upsertOnlineBookingSettings({
      tenant_id: tenantId,
      is_active: true,
      display_name: 'Barbearia Sr. Avante',
      work_start_time: '08:00:00',
      work_end_time: '20:00:00',
      appointment_interval_minutes: 45,
    });

    expect(updateWorkingHoursCalledWith).not.toBeNull();
    expect(updateWorkingHoursCalledWith?.appointment_interval_minutes).toBe(45);
  });
});

describe('TenantSettingsRepositoryImpl - google_review_url', () => {
  it('should_return_and_persist_google_review_url_when_managing_online_booking_settings', async () => {
    const persistedByTable: Record<string, Record<string, unknown>> = {};

    const onlineRow = {
      id: 'obs-1',
      tenant_id: 'tenant-1',
      enabled: true,
      barbershop_name: 'Sanchez Barber',
      booking_slug: 'sanchezbarber',
      slot_interval_minutes: 30,
      min_advance_hours: 1,
      max_advance_days: 30,
      cancellation_hours: 2,
      confirmation_mode: 'auto',
      require_phone: true,
      allow_notes: true,
      theme_color: '#B88A44',
      logo_url: null,
      welcome_message: null,
      working_hours: {},
      maps_url: null,
      google_review_url: 'https://g.page/r/sanchez/review',
      created_at: '2026-11-15T00:00:00Z',
      updated_at: '2026-11-15T00:00:00Z',
    };

    const createTableBuilder = (table: string) => {
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        update: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          persistedByTable[table] = payload;
          return builder;
        }),
        upsert: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
          persistedByTable[table] = payload;
          return builder;
        }),
        maybeSingle: vi.fn().mockResolvedValue(
          table === 'online_booking_settings'
            ? { data: onlineRow, error: null }
            : { data: null, error: null },
        ),
        single: vi.fn().mockResolvedValue({ data: onlineRow, error: null }),
      };
      return builder;
    };

    const clientMock = {
      from: vi.fn().mockImplementation((table: string) => createTableBuilder(table)),
    } as unknown as DatabaseClient;

    const repository = new (tenantSettingsRepository.constructor as any)(clientMock);

    const loaded = await repository.getOnlineBookingSettings('tenant-1');
    expect(loaded?.google_review_url).toBe('https://g.page/r/sanchez/review');

    const saved = await repository.upsertOnlineBookingSettings({
      tenant_id: 'tenant-1',
      enabled: true,
      barbershop_name: 'Sanchez Barber',
      booking_slug: 'sanchezbarber',
      slot_interval_minutes: 30,
      min_advance_hours: 1,
      max_advance_days: 30,
      cancellation_hours: 2,
      confirmation_mode: 'auto',
      require_phone: true,
      allow_notes: true,
      theme_color: '#B88A44',
      logo_url: null,
      welcome_message: null,
      maps_url: null,
      google_review_url: 'https://g.page/r/updated/review',
    });

    expect(persistedByTable.online_booking_settings).toMatchObject({
      google_review_url: 'https://g.page/r/updated/review',
    });
    expect(saved.google_review_url).toBe('https://g.page/r/sanchez/review');
  });

  it('should_include_and_propagate_booking_horizon_days_in_working_hours_and_upsert', async () => {
    const targetTenantId = 'tenant-test-horizon-123';
    let capturedWorkingHours: Record<string, unknown> | null = null;

    const mockDb: DatabaseClient = {
      from: vi.fn((tableName: string) => {
        if (tableName === 'tenant_settings') {
          return {
            upsert: vi.fn((payload: Record<string, unknown>) => {
              capturedWorkingHours = payload;
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({
                    data: {
                      id: 'ts-horizon-1',
                      tenant_id: targetTenantId,
                      ...payload,
                    },
                    error: null,
                  })),
                })),
              };
            }),
          };
        }
        return {
          upsert: vi.fn((payload: Record<string, unknown>) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'obs-horizon-1',
                  tenant_id: targetTenantId,
                  ...payload,
                },
                error: null,
              })),
            })),
          })),
        };
      }) as any,
    } as unknown as DatabaseClient;

    const repo = new (tenantSettingsRepository.constructor as any)(mockDb);

    await repo.upsertOnlineBookingSettings({
      tenant_id: targetTenantId,
      is_active: true,
      display_name: 'Barbearia Modelo',
      slug: 'barbearia-modelo',
      booking_horizon_days: 60,
    });

    expect(capturedWorkingHours).not.toBeNull();
    expect(capturedWorkingHours?.booking_horizon_days).toBe(60);
  });
});
