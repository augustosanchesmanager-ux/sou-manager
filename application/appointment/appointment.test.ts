import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (topo do arquivo) ──────────────────────────────────────
const mockAppointmentUpdate = vi.fn();
const mockAppointmentGet = vi.fn();
const mockAppointmentCancel = vi.fn();
const mockAppointmentUpdateStatus = vi.fn();
const mockAppointmentList = vi.fn();

vi.mock('../../domain/appointment/repository', () => ({
  appointmentRepository: {
    update: (...args: unknown[]) => mockAppointmentUpdate(...args),
    get: (...args: unknown[]) => mockAppointmentGet(...args),
    cancel: (...args: unknown[]) => mockAppointmentCancel(...args),
    updateStatus: (...args: unknown[]) => mockAppointmentUpdateStatus(...args),
    list: (...args: unknown[]) => mockAppointmentList(...args),
  },
}));

const mockComandaList = vi.fn();
const mockComandaUpdate = vi.fn();

vi.mock('../../domain/comanda/repository', () => ({
  comandaRepository: {
    list: (...args: unknown[]) => mockComandaList(...args),
    update: (...args: unknown[]) => mockComandaUpdate(...args),
  },
}));

const mockRpc = vi.fn();
const mockFromChain = vi.fn();

vi.mock('../../services/supabaseClient', () => ({
  getScopedClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFromChain(...args),
  }),
  getSharedClient: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFromChain(...args),
  }),
  getClientForTable: () => ({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFromChain(...args),
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────
import {
  createAppointment,
  updateAppointment,
  cancelAppointment,
  resolveFinalPrice,
} from './lifecycle';
import {
  changeStatus,
  rescheduleAppointment,
  checkTimeConflict,
} from './movement';
import { AppointmentError } from './types';
import type { CreateAppointmentParams, CancelAppointmentParams } from './types';
import type { Appointment } from '../../domain/appointment/types';
import { appEventBus } from '../../domain/events/app-bus';

// ─── Builders ─────────────────────────────────────────────────────
const makeCreateParams = (overrides: Partial<CreateAppointmentParams> = {}): CreateAppointmentParams => ({
  tenantId: 'tenant-1',
  appSlug: 'barber',
  schema: 'barber',
  userId: 'user-1',
  clientName: 'João Silva',
  staffId: 'staff-1',
  serviceIds: ['svc-1'],
  serviceNames: ['Corte'],
  totalPrice: 50,
  duration: 30,
  startTime: '2026-07-23T10:00:00',
  endTime: '2026-07-23T10:30:00',
  idempotencyKey: 'idem-1',
  ...overrides,
});

const makeAppointment = (overrides: Partial<Appointment> = {}): Appointment => ({
  id: 'apt-1',
  tenant_id: 'tenant-1',
  client_id: 'client-1',
  client_name: 'João Silva',
  client_phone: '11999999999',
  staff_id: 'staff-1',
  staff_name: 'Barbeiro 1',
  service_id: 'svc-1',
  service_name: 'Corte',
  start_time: '2026-07-23T10:00:00',
  end_time: '2026-07-23T10:30:00',
  duration: 30,
  price: 50,
  status: 'pending',
  notes: '',
  source: 'manual',
  hidden_from_schedule: false,
  cancellation_reason: null,
  cancellation_type: null,
  cancelled_at: null,
  cancelled_by_user_id: null,
  created_at: '2026-07-23T09:00:00',
  ...overrides,
});

const makeFromChain = (result: unknown = null) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: result, error: null }),
  };
  return chain;
};

const makeTenantChain = (tenant: Record<string, unknown> | null) => {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: tenant, error: null }),
  };
  return chain;
};

// ═══════════════════════════════════════════════════════════════════
// AppointmentApplicationService
//
// Grupo A — Validation
// Grupo B — Lifecycle (create, update, cancel)
// Grupo C — Movement (changeStatus, reschedule, checkTimeConflict)
// Grupo D — Price Resolution
// ═══════════════════════════════════════════════════════════════════

describe('AppointmentApplicationService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // ═══════════════════════════════════════════════════════════════
  // Grupo A — Validation
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo A — Validation', () => {
    describe('createAppointment', () => {
      it('should_throw_when_clientName_is_empty', async () => {
        await expect(
          createAppointment(makeCreateParams({ clientName: '' })),
        ).rejects.toThrow(AppointmentError);
      });

      it('should_throw_VALIDATION_ERROR_when_clientName_is_empty', async () => {
        await expect(
          createAppointment(makeCreateParams({ clientName: '' })),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });

      it('should_throw_when_serviceIds_is_empty', async () => {
        await expect(
          createAppointment(makeCreateParams({ serviceIds: [] })),
        ).rejects.toThrow(AppointmentError);
      });

      it('should_throw_VALIDATION_ERROR_when_serviceIds_is_empty', async () => {
        await expect(
          createAppointment(makeCreateParams({ serviceIds: [] })),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });

      it('should_throw_when_clientName_is_only_whitespace', async () => {
        await expect(
          createAppointment(makeCreateParams({ clientName: '   ' })),
        ).rejects.toThrow(AppointmentError);
      });
    });

    describe('updateAppointment', () => {
      it('should_throw_when_appointmentId_is_empty', async () => {
        await expect(
          updateAppointment({ tenantId: 't-1', appointmentId: '', updates: {} }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });
    });

    describe('cancelAppointment', () => {
      it('should_throw_when_appointmentId_is_empty', async () => {
        await expect(
          cancelAppointment({ tenantId: 't-1', appointmentId: '', cancellationType: 'client_request', userId: 'u-1' }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });
    });

    describe('changeStatus', () => {
      it('should_throw_when_appointmentId_is_empty', async () => {
        await expect(
          changeStatus({ tenantId: 't-1', appointmentId: '', newStatus: 'confirmed' }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });
    });

    describe('rescheduleAppointment', () => {
      it('should_throw_when_appointmentId_is_empty', async () => {
        await expect(
          rescheduleAppointment({
            tenantId: 't-1', appointmentId: '',
            newStaffId: 's-1', newStartTime: 'T10:00', newEndTime: 'T10:30',
          }),
        ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo B — Lifecycle (create, update, cancel)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo B — Lifecycle', () => {
    describe('createAppointment', () => {
      it('should_call_RPC_create_appointment_with_comanda_for_single_service', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1', comanda_id: 'com-1', total_price: 50 }, error: null });

        await createAppointment(makeCreateParams());

        expect(mockRpc).toHaveBeenCalledWith(
          'create_appointment_with_comanda',
          expect.objectContaining({ p_tenant_id: 'tenant-1', p_service_id: 'svc-1' }),
        );
      });

      it('should_call_RPC_create_appointment_with_services_for_multi_service', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1', comanda_id: null, total_price: 100 }, error: null });

        await createAppointment(makeCreateParams({
          serviceIds: ['svc-1', 'svc-2'],
          serviceNames: ['Corte', 'Barba'],
          totalPrice: 100,
        }));

        expect(mockRpc).toHaveBeenCalledWith(
          'create_appointment_with_services',
          expect.objectContaining({ p_services: [{ service_id: 'svc-1' }, { service_id: 'svc-2' }] }),
        );
      });

      it('should_throw_RPC_ERROR_when_RPC_fails', async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } });

        await expect(createAppointment(makeCreateParams())).rejects.toMatchObject({ code: 'RPC_ERROR' });
      });

      it('should_return_correct_shape_from_RPC_result', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-99', comanda_id: 'com-99', total_price: 75 }, error: null });

        const result = await createAppointment(makeCreateParams({ totalPrice: 75 }));

        expect(result).toEqual({ appointmentId: 'apt-99', comandaId: 'com-99', totalPrice: 75 });
      });

      it('should_return_defaults_when_RPC_result_missing_fields', async () => {
        mockRpc.mockResolvedValue({ data: {}, error: null });

        const result = await createAppointment(makeCreateParams({ totalPrice: 50 }));

        expect(result).toEqual({ appointmentId: '', comandaId: null, totalPrice: 50 });
      });

      it('should_include_isOverbooked_in_RPC_params_for_single_service', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1' }, error: null });

        await createAppointment(makeCreateParams({ isOverbooked: true }));

        expect(mockRpc).toHaveBeenCalledWith(
          'create_appointment_with_comanda',
          expect.objectContaining({ p_is_overbooked: true }),
        );
      });

      it('should_default_isOverbooked_to_false', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1' }, error: null });

        await createAppointment(makeCreateParams());

        expect(mockRpc).toHaveBeenCalledWith(
          'create_appointment_with_comanda',
          expect.objectContaining({ p_is_overbooked: false }),
        );
      });

      it('should_publish_TenantFirstAppointmentReached_when_tenant_has_no_first_appointment', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1', comanda_id: 'com-1', total_price: 50 }, error: null });
        mockFromChain.mockReturnValue(makeTenantChain({
          id: 'tenant-1',
          name: 'Barbearia Teste',
          status: 'active',
          plan: 'free',
          app_slug: 'barber',
          first_appointment_at: null,
          created_at: '2026-07-23T09:00:00.000Z',
        }));

        const published: string[] = [];
        const unsub = appEventBus.subscribeAll((event) => { published.push(event.eventType); });
        try {
          await createAppointment(makeCreateParams());
          expect(published).toContain('TenantFirstAppointmentReached');
        } finally {
          unsub();
        }
      });

      it('should_NOT_publish_TenantFirstAppointmentReached_when_tenant_already_has_first_appointment', async () => {
        mockRpc.mockResolvedValue({ data: { appointment_id: 'apt-1', comanda_id: 'com-1', total_price: 50 }, error: null });
        mockFromChain.mockReturnValue(makeTenantChain({
          id: 'tenant-1',
          name: 'Barbearia Teste',
          status: 'active',
          plan: 'free',
          app_slug: 'barber',
          first_appointment_at: '2026-07-23T10:00:00.000Z',
          created_at: '2026-07-23T09:00:00.000Z',
        }));

        const published: string[] = [];
        const unsub = appEventBus.subscribeAll((event) => { published.push(event.eventType); });
        try {
          await createAppointment(makeCreateParams());
          expect(published).not.toContain('TenantFirstAppointmentReached');
        } finally {
          unsub();
        }
      });
    });

    describe('updateAppointment', () => {
      it('should_call_appointmentRepository_update', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);

        await updateAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          updates: { staff_id: 'staff-2' },
        });

        expect(mockAppointmentUpdate).toHaveBeenCalledWith('apt-1', { staff_id: 'staff-2' }, 'tenant-1');
      });

      it('should_sync_comanda_staff_when_syncComandaStaff_and_staff_id', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }, { id: 'com-2' }]);
        mockComandaUpdate.mockResolvedValue(undefined);

        await updateAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          updates: { staff_id: 'staff-2' },
          syncComandaStaff: true,
        });

        expect(mockComandaList).toHaveBeenCalledWith('tenant-1', { appointmentId: 'apt-1', status: 'open' });
        expect(mockComandaUpdate).toHaveBeenCalledTimes(2);
        expect(mockComandaUpdate).toHaveBeenCalledWith('com-1', { staff_id: 'staff-2' }, 'tenant-1');
        expect(mockComandaUpdate).toHaveBeenCalledWith('com-2', { staff_id: 'staff-2' }, 'tenant-1');
      });

      it('should_skip_comanda_sync_when_syncComandaStaff_is_false', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);

        await updateAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          updates: { staff_id: 'staff-2' },
          syncComandaStaff: false,
        });

        expect(mockComandaList).not.toHaveBeenCalled();
        expect(mockComandaUpdate).not.toHaveBeenCalled();
      });

      it('should_not_throw_when_comanda_update_fails', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }]);
        mockComandaUpdate.mockRejectedValue(new Error('db error'));

        await expect(
          updateAppointment({
            tenantId: 'tenant-1',
            appointmentId: 'apt-1',
            updates: { staff_id: 'staff-2' },
            syncComandaStaff: true,
          }),
        ).resolves.toBeUndefined();
      });

      it('should_skip_comanda_sync_when_no_staff_id_in_updates', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);

        await updateAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          updates: { notes: 'updated' },
          syncComandaStaff: true,
        });

        expect(mockComandaList).not.toHaveBeenCalled();
      });
    });

    describe('cancelAppointment', () => {
      it('should_set_status_to_no_show_when_cancellationType_is_no_show', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'no_show',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ status: 'no_show' }),
          'tenant-1',
        );
      });

      it('should_set_status_to_cancelled_when_cancellationType_is_client_request', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'client_request',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ status: 'cancelled' }),
          'tenant-1',
        );
      });

      it('should_set_hidden_true_when_registration_error', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'registration_error',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ hidden_from_schedule: true }),
          'tenant-1',
        );
      });

      it('should_set_hidden_true_when_test', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'test',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ hidden_from_schedule: true }),
          'tenant-1',
        );
      });

      it('should_set_hidden_false_when_client_request', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'client_request',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ hidden_from_schedule: false }),
          'tenant-1',
        );
      });

      it('should_cancel_open_comandas', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }, { id: 'com-2' }]);
        mockComandaUpdate.mockResolvedValue(undefined);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'client_request',
          userId: 'user-1',
        });

        expect(mockComandaUpdate).toHaveBeenCalledTimes(2);
        expect(mockComandaUpdate).toHaveBeenCalledWith('com-1', { status: 'cancelled' }, 'tenant-1');
        expect(mockComandaUpdate).toHaveBeenCalledWith('com-2', { status: 'cancelled' }, 'tenant-1');
      });

      it('should_not_throw_when_comanda_cancel_fails', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }]);
        mockComandaUpdate.mockRejectedValue(new Error('db error'));

        await expect(
          cancelAppointment({
            tenantId: 'tenant-1',
            appointmentId: 'apt-1',
            cancellationType: 'client_request',
            userId: 'user-1',
          }),
        ).resolves.toBeUndefined();
      });

      it('should_include_comandaCancelFailed_in_event_when_comanda_cancel_fails', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }]);
        mockComandaUpdate.mockRejectedValue(new Error('db error'));

        const published: unknown[] = [];
        const unsub = appEventBus.subscribeAll((event) => { published.push(event); });
        try {
          await cancelAppointment({
            tenantId: 'tenant-1',
            appointmentId: 'apt-1',
            cancellationType: 'client_request',
            userId: 'user-1',
          });

          const cancelEvent = published.find(
            (e: any) => e.eventType === 'AppointmentCancelled',
          ) as any;
          expect(cancelEvent).toBeDefined();
          expect(cancelEvent.payload.comandaCancelFailed).toBe(true);
          expect(cancelEvent.payload.failedComandaIds).toEqual(['com-1']);
        } finally {
          unsub();
        }
      });

      it('should_include_cancellation_reason_in_payload', async () => {
        mockAppointmentCancel.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await cancelAppointment({
          tenantId: 'tenant-1',
          appointmentId: 'apt-1',
          cancellationType: 'other',
          cancellationReason: 'Mudou de ideia',
          userId: 'user-1',
        });

        expect(mockAppointmentCancel).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({ cancellation_reason: 'Mudou de ideia', cancellation_type: 'other' }),
          'tenant-1',
        );
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo C — Movement (changeStatus, reschedule, checkTimeConflict)
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo C — Movement', () => {
    describe('changeStatus', () => {
      it('should_throw_NOT_FOUND_when_appointment_not_found', async () => {
        mockAppointmentGet.mockResolvedValue(null);

        await expect(
          changeStatus({ tenantId: 't-1', appointmentId: 'apt-x', newStatus: 'confirmed' }),
        ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      });

      it('should_throw_INVALID_TRANSITION_when_status_is_cancelled', async () => {
        mockAppointmentGet.mockResolvedValue(makeAppointment({ status: 'cancelled' }));

        await expect(
          changeStatus({ tenantId: 't-1', appointmentId: 'apt-1', newStatus: 'confirmed' }),
        ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      });

      it('should_throw_INVALID_TRANSITION_when_status_is_no_show', async () => {
        mockAppointmentGet.mockResolvedValue(makeAppointment({ status: 'no_show' }));

        await expect(
          changeStatus({ tenantId: 't-1', appointmentId: 'apt-1', newStatus: 'completed' }),
        ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
      });

      it('should_call_updateStatus_when_status_is_valid', async () => {
        mockAppointmentGet.mockResolvedValue(makeAppointment({ status: 'pending' }));
        mockAppointmentUpdateStatus.mockResolvedValue(undefined);

        await changeStatus({ tenantId: 't-1', appointmentId: 'apt-1', newStatus: 'confirmed' });

        expect(mockAppointmentUpdateStatus).toHaveBeenCalledWith('apt-1', 'confirmed', 't-1');
      });

      it('should_allow_transition_from_in_progress_to_completed', async () => {
        mockAppointmentGet.mockResolvedValue(makeAppointment({ status: 'in_progress' }));
        mockAppointmentUpdateStatus.mockResolvedValue(undefined);

        await changeStatus({ tenantId: 't-1', appointmentId: 'apt-1', newStatus: 'completed' });

        expect(mockAppointmentUpdateStatus).toHaveBeenCalledWith('apt-1', 'completed', 't-1');
      });
    });

    describe('rescheduleAppointment', () => {
      it('should_call_appointmentRepository_update_with_new_times', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([]);

        await rescheduleAppointment({
          tenantId: 't-1',
          appointmentId: 'apt-1',
          newStaffId: 'staff-2',
          newStaffName: 'Barbeiro 2',
          newStartTime: '2026-07-24T14:00:00',
          newEndTime: '2026-07-24T14:30:00',
        });

        expect(mockAppointmentUpdate).toHaveBeenCalledWith(
          'apt-1',
          expect.objectContaining({
            staff_id: 'staff-2',
            staff_name: 'Barbeiro 2',
            start_time: '2026-07-24T14:00:00',
            end_time: '2026-07-24T14:30:00',
          }),
          't-1',
        );
      });

      it('should_sync_open_comandas_with_new_staff_id', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }]);
        mockComandaUpdate.mockResolvedValue(undefined);

        await rescheduleAppointment({
          tenantId: 't-1',
          appointmentId: 'apt-1',
          newStaffId: 'staff-2',
          newStartTime: '2026-07-24T14:00:00',
          newEndTime: '2026-07-24T14:30:00',
        });

        expect(mockComandaUpdate).toHaveBeenCalledWith('com-1', { staff_id: 'staff-2' }, 't-1');
      });

      it('should_not_throw_when_comanda_sync_fails', async () => {
        mockAppointmentUpdate.mockResolvedValue(undefined);
        mockComandaList.mockResolvedValue([{ id: 'com-1' }]);
        mockComandaUpdate.mockRejectedValue(new Error('db error'));

        await expect(
          rescheduleAppointment({
            tenantId: 't-1',
            appointmentId: 'apt-1',
            newStaffId: 'staff-2',
            newStartTime: '2026-07-24T14:00:00',
            newEndTime: '2026-07-24T14:30:00',
          }),
        ).resolves.toBeUndefined();
      });
    });

    describe('checkTimeConflict', () => {
      it('should_return_true_when_conflict_exists', async () => {
        mockAppointmentList.mockResolvedValue([makeAppointment({ id: 'apt-other', status: 'pending' })]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30');

        expect(result).toBe(true);
      });

      it('should_return_false_when_no_conflict', async () => {
        mockAppointmentList.mockResolvedValue([]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30');

        expect(result).toBe(false);
      });

      it('should_exclude_specified_appointment', async () => {
        mockAppointmentList.mockResolvedValue([
          makeAppointment({ id: 'apt-1', status: 'pending' }),
        ]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30', 'apt-1');

        expect(result).toBe(false);
      });

      it('should_exclude_cancelled_appointments', async () => {
        mockAppointmentList.mockResolvedValue([
          makeAppointment({ id: 'apt-2', status: 'cancelled' }),
        ]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30');

        expect(result).toBe(false);
      });

      it('should_exclude_no_show_appointments', async () => {
        mockAppointmentList.mockResolvedValue([
          makeAppointment({ id: 'apt-3', status: 'no_show' }),
        ]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30');

        expect(result).toBe(false);
      });

      it('should_return_true_for_confirmed_appointment', async () => {
        mockAppointmentList.mockResolvedValue([
          makeAppointment({ id: 'apt-4', status: 'confirmed' }),
        ]);

        const result = await checkTimeConflict('t-1', 'staff-1', 'T10:00', 'T10:30');

        expect(result).toBe(true);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Grupo D — Price Resolution
  // ═══════════════════════════════════════════════════════════════
  describe('Grupo D — Price Resolution', () => {
    it('should_return_basePrice_when_no_promotion_and_no_DB_price', async () => {
      mockFromChain.mockReturnValue(makeFromChain(null));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 50, promotions: [],
      });

      expect(result).toBe(50);
    });

    it('should_return_DB_price_when_available', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 60 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 50, promotions: [],
      });

      expect(result).toBe(60);
    });

    it('should_apply_fixed_discount', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 100 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 100,
        promotions: [{ target_type: 'all', discount_type: 'fixed', discount_value: 20 }],
      });

      expect(result).toBe(80);
    });

    it('should_floor_at_zero_for_fixed_discount', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 30 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 30,
        promotions: [{ target_type: 'all', discount_type: 'fixed', discount_value: 50 }],
      });

      expect(result).toBe(0);
    });

    it('should_apply_percentage_discount', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 200 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 200,
        promotions: [{ target_type: 'all', discount_type: 'percentage', discount_value: 10 }],
      });

      expect(result).toBe(180);
    });

    it('should_match_promotion_target_type_service_only_when_target_id_matches', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 100 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 100,
        promotions: [{ target_type: 'service', target_id: 'svc-2', discount_type: 'fixed', discount_value: 10 }],
      });

      expect(result).toBe(100);
    });

    it('should_apply_promotion_when_target_id_matches', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 100 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 100,
        promotions: [{ target_type: 'service', target_id: 'svc-1', discount_type: 'fixed', discount_value: 10 }],
      });

      expect(result).toBe(90);
    });

    it('should_apply_first_matching_promotion', async () => {
      mockFromChain.mockReturnValue(makeFromChain({ price: 100 }));

      const result = await resolveFinalPrice({
        tenantId: 't-1', serviceId: 'svc-1', basePrice: 100,
        promotions: [
          { target_type: 'all', discount_type: 'fixed', discount_value: 10 },
          { target_type: 'all', discount_type: 'fixed', discount_value: 50 },
        ],
      });

      expect(result).toBe(90);
    });
  });
});
