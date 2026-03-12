import { supabase } from './supabaseClient';

export type ScheduleBlockType = 'full_day' | 'time_range';
export type ScheduleBlockRecurrence = 'none' | 'weekly';
export type ScheduleBlockStatus = 'active' | 'cancelled';
export type ExistingAppointmentsAction = 'keep' | 'review' | 'cancel';

export interface ScheduleBlock {
  id: string;
  tenant_id: string;
  professional_id: string | null;
  block_type: ScheduleBlockType;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  notes: string | null;
  recurrence_type: ScheduleBlockRecurrence;
  recurrence_until: string | null;
  existing_appointments_action: ExistingAppointmentsAction;
  created_by: string | null;
  removed_by: string | null;
  removed_at: string | null;
  created_at: string;
  updated_at: string;
  status: ScheduleBlockStatus;
}

export interface ScheduleBlockInput {
  professional_id: string | null;
  block_type: ScheduleBlockType;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  reason: string;
  notes?: string | null;
  recurrence_type?: ScheduleBlockRecurrence;
  recurrence_until?: string | null;
  existing_appointments_action?: ExistingAppointmentsAction;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export const SCHEDULE_BLOCK_LABELS: Record<string, string> = {
  agenda_fechada: 'Agenda fechada',
  pausa: 'Pausa',
  almoco: 'Almoço',
  feriado: 'Feriado',
  reuniao_interna: 'Reunião interna',
};

export const toDateKey = (date: Date | string): string => {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const timeToHourDecimal = (time: string | null | undefined): number | null => {
  if (!time) return null;
  const normalized = time.slice(0, 5);
  const [h, m] = normalized.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h + m / 60;
};

const dateKeyToDate = (dateKey: string): Date => new Date(`${dateKey}T12:00:00`);

const isDateInRange = (dateKey: string, startDate: string, endDate: string) => {
  const current = dateKeyToDate(dateKey).getTime();
  const start = dateKeyToDate(startDate).getTime();
  const end = dateKeyToDate(endDate).getTime();
  return current >= start && current <= end;
};

const shouldApplyWeeklyRecurrence = (block: ScheduleBlock, dateKey: string) => {
  const until = block.recurrence_until || block.end_date;
  if (!isDateInRange(dateKey, block.start_date, until)) return false;

  const startWeekDay = dateKeyToDate(block.start_date).getDay();
  const dateWeekDay = dateKeyToDate(dateKey).getDay();
  return startWeekDay === dateWeekDay;
};

export const blockAppliesToDate = (block: ScheduleBlock, dateKey: string) => {
  if (block.status !== 'active') return false;

  if (block.recurrence_type === 'weekly') {
    return shouldApplyWeeklyRecurrence(block, dateKey);
  }

  return isDateInRange(dateKey, block.start_date, block.end_date);
};

export const blockMatchesProfessional = (block: ScheduleBlock, professionalId?: string | null) => {
  if (!block.professional_id) return true;
  if (!professionalId) return false;
  return block.professional_id === professionalId;
};

export const blockOverlapsTimeRange = (
  block: ScheduleBlock,
  startHour: number,
  endHour: number,
) => {
  if (block.block_type === 'full_day') return true;

  const blockStart = timeToHourDecimal(block.start_time);
  const blockEnd = timeToHourDecimal(block.end_time);
  if (blockStart == null || blockEnd == null) return false;

  return startHour < blockEnd && endHour > blockStart;
};

export const isDateFullyBlocked = (blocks: ScheduleBlock[], dateKey: string, professionalId?: string | null) => {
  return blocks.some(
    (block) =>
      block.block_type === 'full_day' &&
      blockMatchesProfessional(block, professionalId) &&
      blockAppliesToDate(block, dateKey),
  );
};

export const getBlocksForDate = (blocks: ScheduleBlock[], dateKey: string, professionalId?: string | null) => {
  return blocks.filter(
    (block) => blockMatchesProfessional(block, professionalId) && blockAppliesToDate(block, dateKey),
  );
};

const rangesOverlap = (startA: string, endA: string, startB: string, endB: string) => {
  const aStart = dateKeyToDate(startA).getTime();
  const aEnd = dateKeyToDate(endA).getTime();
  const bStart = dateKeyToDate(startB).getTime();
  const bEnd = dateKeyToDate(endB).getTime();
  return aStart <= bEnd && bStart <= aEnd;
};

const timesOverlap = (startA?: string | null, endA?: string | null, startB?: string | null, endB?: string | null) => {
  const aStart = timeToHourDecimal(startA || null);
  const aEnd = timeToHourDecimal(endA || null);
  const bStart = timeToHourDecimal(startB || null);
  const bEnd = timeToHourDecimal(endB || null);

  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart < bEnd && bStart < aEnd;
};

export const detectBlockConflicts = (existing: ScheduleBlock[], draft: ScheduleBlockInput) => {
  return existing.filter((block) => {
    if (block.status !== 'active') return false;

    const sameProfessional = (block.professional_id || null) === (draft.professional_id || null);
    if (!sameProfessional) return false;

    if (!rangesOverlap(block.start_date, block.end_date, draft.start_date, draft.end_date)) return false;

    if (block.block_type === 'full_day' || draft.block_type === 'full_day') return true;

    return timesOverlap(block.start_time, block.end_time, draft.start_time, draft.end_time);
  });
};

export const scheduleBlocksApi = {
  async listByRange(tenantId: string, range: DateRange) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('tenant_id', tenantId)
      .neq('status', 'cancelled')
      .order('start_date', { ascending: true });

    if (error) throw error;

    const hasAnyDateWithinRange = (block: ScheduleBlock) => {
      const rangeStart = dateKeyToDate(range.startDate).getTime();
      const rangeEnd = dateKeyToDate(range.endDate).getTime();

      if (block.recurrence_type === 'weekly') {
        const recurrenceEnd = dateKeyToDate(block.recurrence_until || block.end_date).getTime();
        const start = dateKeyToDate(block.start_date).getTime();
        return recurrenceEnd >= rangeStart && start <= rangeEnd;
      }

      const start = dateKeyToDate(block.start_date).getTime();
      const end = dateKeyToDate(block.end_date).getTime();
      return start <= rangeEnd && end >= rangeStart;
    };

    return ((data || []) as ScheduleBlock[]).filter(hasAnyDateWithinRange);
  },

  async listHistory(tenantId: string, limit = 100) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data || []) as ScheduleBlock[];
  },

  async create(tenantId: string, userId: string | null, payload: ScheduleBlockInput) {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .insert({
        tenant_id: tenantId,
        created_by: userId,
        professional_id: payload.professional_id,
        block_type: payload.block_type,
        start_date: payload.start_date,
        end_date: payload.end_date,
        start_time: payload.start_time || null,
        end_time: payload.end_time || null,
        reason: payload.reason,
        notes: payload.notes || null,
        recurrence_type: payload.recurrence_type || 'none',
        recurrence_until: payload.recurrence_until || null,
        existing_appointments_action: payload.existing_appointments_action || 'keep',
        status: 'active',
      })
      .select('*')
      .single();

    if (error) throw error;
    return data as ScheduleBlock;
  },

  async update(blockId: string, payload: Partial<ScheduleBlockInput>) {
    const updateData: Record<string, unknown> = {};

    if (payload.professional_id !== undefined) updateData.professional_id = payload.professional_id;
    if (payload.block_type !== undefined) updateData.block_type = payload.block_type;
    if (payload.start_date !== undefined) updateData.start_date = payload.start_date;
    if (payload.end_date !== undefined) updateData.end_date = payload.end_date;
    if (payload.start_time !== undefined) updateData.start_time = payload.start_time;
    if (payload.end_time !== undefined) updateData.end_time = payload.end_time;
    if (payload.reason !== undefined) updateData.reason = payload.reason;
    if (payload.notes !== undefined) updateData.notes = payload.notes;
    if (payload.recurrence_type !== undefined) updateData.recurrence_type = payload.recurrence_type;
    if (payload.recurrence_until !== undefined) updateData.recurrence_until = payload.recurrence_until;
    if (payload.existing_appointments_action !== undefined) updateData.existing_appointments_action = payload.existing_appointments_action;

    const { data, error } = await supabase
      .from('schedule_blocks')
      .update(updateData)
      .eq('id', blockId)
      .select('*')
      .single();

    if (error) throw error;
    return data as ScheduleBlock;
  },

  async remove(blockId: string, userId: string | null) {
    const { error } = await supabase
      .from('schedule_blocks')
      .update({
        status: 'cancelled',
        removed_by: userId,
        removed_at: new Date().toISOString(),
      })
      .eq('id', blockId);

    if (error) throw error;
  },
};
