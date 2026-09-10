/**
 * [SMG][FINANCE][ATTENDANCE] M4-P4/P5 tests
 *
 * Validates confirmAppointmentAttendance and correctAppointmentAttendance:
 *   - Calls RPCs with correct parameters
 *   - Returns typed result shape
 *   - Requires newAttendedAt/motivo for corrections
 *   - Throws on RPC errors and success=false
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  confirmAppointmentAttendance,
  correctAppointmentAttendance,
} from './attendance';

const mockRpc = vi.fn();
const mockSupabase = { rpc: mockRpc };

describe('M4-P5 — confirmAppointmentAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls confirm_appointment_attendance with tenant and appointment', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        appointment_id: 'appt-1',
        attended_at: '2026-08-30T12:00:00Z',
        status: 'completed',
        message: 'OK',
      },
      error: null,
    });

    await confirmAppointmentAttendance({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith(
      'confirm_appointment_attendance',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_appointment_id: 'appt-1',
      }),
    );
  });

  it('returns ConfirmAppointmentAttendanceResult shape on success', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        appointment_id: 'appt-1',
        attended_at: '2026-08-30T12:00:00Z',
        status: 'completed',
        message: 'Atendimento confirmado',
      },
      error: null,
    });

    const result = await confirmAppointmentAttendance({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      supabase: mockSupabase,
    });

    expect(result).toEqual({
      success: true,
      appointmentId: 'appt-1',
      attendedAt: '2026-08-30T12:00:00Z',
      status: 'completed',
      message: 'Atendimento confirmado',
    });
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Agendamento já foi confirmado' },
    });

    await expect(
      confirmAppointmentAttendance({
        tenantId: 'tenant-1',
        appointmentId: 'appt-1',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Agendamento já foi confirmado');
  });
});

describe('M4-P4 — correctAppointmentAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls correct_appointment_attendance with newAttendedAt and motivo', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        appointment_id: 'appt-1',
        before_attended_at: '2026-08-29T10:00:00Z',
        after_attended_at: '2026-08-28T14:30:00Z',
        message: 'OK',
      },
      error: null,
    });

    await correctAppointmentAttendance({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      newAttendedAt: '2026-08-28T14:30:00Z',
      motivo: 'Correção de registro',
      supabase: mockSupabase,
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'correct_appointment_attendance',
      expect.objectContaining({
        p_tenant_id: 'tenant-1',
        p_appointment_id: 'appt-1',
        p_new_attended_at: '2026-08-28T14:30:00Z',
        p_motivo: 'Correção de registro',
      }),
    );
  });

  it('returns before/after attended timestamps', async () => {
    mockRpc.mockResolvedValue({
      data: {
        success: true,
        appointment_id: 'appt-1',
        before_attended_at: '2026-08-29T10:00:00Z',
        after_attended_at: '2026-08-28T14:30:00Z',
        message: 'Corrigido',
      },
      error: null,
    });

    const result = await correctAppointmentAttendance({
      tenantId: 'tenant-1',
      appointmentId: 'appt-1',
      newAttendedAt: '2026-08-28T14:30:00Z',
      motivo: 'Correção de registro',
      supabase: mockSupabase,
    });

    expect(result.previousAttendedAt).toBe('2026-08-29T10:00:00Z');
    expect(result.correctedAttendedAt).toBe('2026-08-28T14:30:00Z');
  });

  it('throws when newAttendedAt is missing', async () => {
    await expect(
      correctAppointmentAttendance({
        tenantId: 'tenant-1',
        appointmentId: 'appt-1',
        newAttendedAt: '',
        motivo: 'Correção',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('nova data/hora de atendimento obrigatória');
  });

  it('throws when motivo is missing', async () => {
    await expect(
      correctAppointmentAttendance({
        tenantId: 'tenant-1',
        appointmentId: 'appt-1',
        newAttendedAt: '2026-08-28T14:30:00Z',
        motivo: '   ',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Motivo obrigatório');
  });

  it('throws on success=false from RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { success: false, message: 'Somente gestao pode corrigir' },
      error: null,
    });

    await expect(
      correctAppointmentAttendance({
        tenantId: 'tenant-1',
        appointmentId: 'appt-1',
        newAttendedAt: '2026-08-28T14:30:00Z',
        motivo: 'Correção',
        supabase: mockSupabase,
      }),
    ).rejects.toThrow('Não foi possível registrar a confirmação de atendimento');
  });
});