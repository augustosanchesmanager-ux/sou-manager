import { logSupabaseError } from '../supabase/errors';

const RPC_TIMEOUT_MS = 30000;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
const ERROR_MESSAGE = 'Não foi possível desbloquear a comanda. Nenhuma alteração foi aplicada. Tente novamente ou acione o gestor.';

const toDateKeyInTimezone = (dateInput: string | Date, timezone = DEFAULT_TIMEZONE): string | null => {
  const parsed = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(parsed);
};

export const isAppointmentDateDueInTimezone = (
  appointmentStartTime?: string | null,
  timezone = DEFAULT_TIMEZONE,
  now: Date = new Date(),
): boolean => {
  if (!appointmentStartTime) return false;
  const appointmentKey = toDateKeyInTimezone(appointmentStartTime, timezone);
  const todayKey = toDateKeyInTimezone(now, timezone);
  if (!appointmentKey || !todayKey) return false;
  return appointmentKey <= todayKey;
};

const withRpcTimeout = async <T,>(promise: Promise<T>): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Tempo limite excedido ao desbloquear comanda.')), RPC_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

// ─── P6: unblock_comanda ───────────────────────────────────────
// Desbloqueia comanda (BLOCKED → OPEN), auditável.
// Modo 'manual': motivo obrigatório. Modo 'auto': sem motivo.
// NÃO preenche attended_at nem gera comissão.

export type UnblockMode = 'auto' | 'manual';

export interface UnblockComandaInput {
  tenantId: string;
  comandaId: string;
  mode: UnblockMode;
  reason?: string | null;
  operatorId?: string | null;
  supabase: any;
}

export interface UnblockComandaResult {
  success: boolean;
  comandaId: string;
  previousStatus: string;
  newStatus: string;
  mode: string;
  message: string;
}

export const unblockComanda = async ({
  tenantId,
  comandaId,
  mode,
  reason = null,
  operatorId = null,
  supabase,
}: UnblockComandaInput): Promise<UnblockComandaResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para desbloqueio de comanda.');
  if (!comandaId) throw new Error('comanda_id obrigatório para desbloqueio de comanda.');
  if (mode !== 'auto' && mode !== 'manual') throw new Error('Modo de desbloqueio inválido (auto ou manual).');
  if (mode === 'manual' && !reason?.trim()) throw new Error('Motivo obrigatório para desbloqueio manual.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('unblock_comanda', {
      p_tenant_id: tenantId,
      p_comanda_id: comandaId,
      p_mode: mode,
      p_reason: reason || null,
      p_operator_id: operatorId,
    }),
  );

  if (error) {
    logSupabaseError('[unblock] unblock_comanda failed', error, {
      comandaId,
      tenantId,
      mode,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[unblock] unblock_comanda returned an invalid result:', {
      result,
      comandaId,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    comandaId: result.comanda_id || comandaId,
    previousStatus: result.previous_status || 'blocked',
    newStatus: result.new_status || 'open',
    mode: result.mode || mode,
    message: result.message || 'Comanda desbloqueada com sucesso.',
  };
};

// ─── P6: batch_unblock_comandas ────────────────────────────────
// Desbloqueia múltiplas comandas em modo 'auto' (data do agendamento passada).
// Substitui o UPDATE direto que existia no frontend (sem auditoria).

export interface BatchUnblockComandasInput {
  tenantId: string;
  comandaIds: string[];
  supabase: any;
}

export interface BatchUnblockComandasResult {
  success: boolean;
  unblockedCount: number;
  comandaIds: string[];
  message: string;
}

export const batchUnblockComandas = async ({
  tenantId,
  comandaIds,
  supabase,
}: BatchUnblockComandasInput): Promise<BatchUnblockComandasResult> => {
  if (!tenantId) throw new Error('tenant_id obrigatório para desbloqueio de comandas.');
  if (!comandaIds || comandaIds.length === 0) throw new Error('Nenhuma comanda selecionada para desbloqueio.');

  const { data, error } = await withRpcTimeout<any>(
    supabase.rpc('batch_unblock_comandas', {
      p_tenant_id: tenantId,
      p_comanda_ids: comandaIds,
    }),
  );

  if (error) {
    logSupabaseError('[unblock] batch_unblock_comandas failed', error, {
      comandaIds,
      tenantId,
    });
    throw new Error(error.message || ERROR_MESSAGE);
  }

  const result = data || {};
  if (result.success !== true) {
    console.error('[unblock] batch_unblock_comandas returned an invalid result:', {
      result,
      comandaIds,
      tenantId,
    });
    throw new Error(ERROR_MESSAGE);
  }

  return {
    success: true,
    unblockedCount: Number(result.unblocked_count ?? result.unblocked ?? 0),
    comandaIds: result.comanda_ids || comandaIds,
    message: result.message || 'Comandas desbloqueadas com sucesso.',
  };
};

export interface UnblockComandaIfDueInput {
  tenantId: string;
  comandaId: string;
  status?: string | null;
  appointmentStartTime?: string | null;
  timezone?: string;
  now?: Date;
  supabase: any;
}

export interface UnblockComandaIfDueResult {
  unblocked: boolean;
  status: string;
  isFutureAppointment: boolean;
}

/**
 * Desbloqueia automaticamente uma comanda `blocked` vinculada a agendamento
 * quando a data do agendamento ja chegou (<= hoje no fuso do tenant).
 */
export const unblockComandaIfDue = async ({
  tenantId,
  comandaId,
  status,
  appointmentStartTime,
  timezone = DEFAULT_TIMEZONE,
  now = new Date(),
  supabase,
}: UnblockComandaIfDueInput): Promise<UnblockComandaIfDueResult> => {
  if (status !== 'blocked') {
    return {
      unblocked: false,
      status: status || 'open',
      isFutureAppointment: false,
    };
  }

  const isDue = isAppointmentDateDueInTimezone(appointmentStartTime, timezone, now);
  if (!isDue) {
    return {
      unblocked: false,
      status: 'blocked',
      isFutureAppointment: Boolean(appointmentStartTime),
    };
  }

  await unblockComanda({
    tenantId,
    comandaId,
    mode: 'auto',
    supabase,
  });

  return {
    unblocked: true,
    status: 'open',
    isFutureAppointment: false,
  };
};