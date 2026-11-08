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
