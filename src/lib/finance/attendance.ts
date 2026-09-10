import { logSupabaseError } from '../supabase/errors';

const RPC_TIMEOUT_MS = 30000;
const ERROR_MESSAGE = 'Não foi possível registrar a confirmação de atendimento. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';

const withRpcTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao confirmar atendimento.')), RPC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── P4/P5: confirm_appointment_attendance ─────────────────────
// Confirma presença do cliente (attended_at = now()).
// Gate: barbeiro-próprio, recepção e gestão. Não reativa agendamento cancelado.

export interface ConfirmAppointmentAttendanceInput {
  tenantId: string;
  appointmentId: string;
  supabase: any;
}

export interface ConfirmAppointmentAttendanceResult {
  success: boolean;
  appointmentId: string;
  attendedAt: string;
  status: string;
  message: string;
}

export const confirmAppointmentAttendance = async ({
  tenantId,
  appointmentId,
  supabase,
}: ConfirmAppointmentAttendanceInput): Promise<ConfirmAppointmentAttendanceResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para confirmação de atendimento.');
  if (!appointmentId) throw new Error('appointment_id obrigatório para confirmação de atendimento.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('confirm_appointment_attendance', {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
    }),
  );

  if (error) {
    logSupabaseError('[attendance] confirm_appointment_attendance failed', error, {
      appointmentId,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[attendance] confirm_appointment_attendance returned an invalid result:', {
      result,
      appointmentId,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    appointmentId: result.appointment_id || appointmentId,
    attendedAt: result.attended_at || new Date().toISOString(),
    status: result.status || 'completed',
    message: result.message || 'Atendimento confirmado com sucesso.',
  };
};

// ─── P4: correct_appointment_attendance ────────────────────────
// Corrige attended_at retroativo. Gate: gestão. Motivo obrigatório.
// Registra before/after em appointment_attendance_corrections (append-only).

export interface CorrectAppointmentAttendanceInput {
  tenantId: string;
  appointmentId: string;
  newAttendedAt: string;
  motivo: string;
  supabase: any;
}

export interface CorrectAppointmentAttendanceResult {
  success: boolean;
  appointmentId: string;
  previousAttendedAt: string | null;
  correctedAttendedAt: string;
  message: string;
}

export const correctAppointmentAttendance = async ({
  tenantId,
  appointmentId,
  newAttendedAt,
  motivo,
  supabase,
}: CorrectAppointmentAttendanceInput): Promise<CorrectAppointmentAttendanceResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para correção de atendimento.');
  if (!appointmentId) throw new Error('appointment_id obrigatório para correção de atendimento.');
  if (!newAttendedAt) throw new Error('nova data/hora de atendimento obrigatória.');
  if (!motivo?.trim()) throw new Error('Motivo obrigatório para correção de atendimento.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('correct_appointment_attendance', {
      p_tenant_id: tenantId,
      p_appointment_id: appointmentId,
      p_new_attended_at: newAttendedAt,
      p_motivo: motivo.trim(),
    }),
  );

  if (error) {
    logSupabaseError('[attendance] correct_appointment_attendance failed', error, {
      appointmentId,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[attendance] correct_appointment_attendance returned an invalid result:', {
      result,
      appointmentId,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    appointmentId: result.appointment_id || appointmentId,
    previousAttendedAt: result.before_attended_at || null,
    correctedAttendedAt: result.after_attended_at || newAttendedAt,
    message: result.message || 'Atendimento corrigido com sucesso.',
  };
};