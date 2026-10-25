/**
 * scheduleDuration.ts
 * Utilitário puro para normalização de tempo, duração customizada e detecção de sobreposição.
 * Frente 1.I (Fase 7.1 UX Review)
 */

export interface DurationPreset {
    label: string;
    minutes: number;
    decimalHours: number;
}

export const DURATION_PRESETS: DurationPreset[] = [
    { label: '15m', minutes: 15, decimalHours: 0.25 },
    { label: '30m', minutes: 30, decimalHours: 0.5 },
    { label: '45m', minutes: 45, decimalHours: 0.75 },
    { label: '1h', minutes: 60, decimalHours: 1.0 },
    { label: '1h15', minutes: 75, decimalHours: 1.25 },
    { label: '1h30', minutes: 90, decimalHours: 1.5 },
    { label: '2h', minutes: 120, decimalHours: 2.0 },
    { label: '2h30', minutes: 150, decimalHours: 2.5 },
    { label: '3h', minutes: 180, decimalHours: 3.0 },
];

export interface ServiceDurationInput {
    id: string;
    name?: string;
    duration?: number | null;
    duration_minutes?: number | null;
    buffer?: number | null;
}

export interface AppointmentDurationInput {
    id?: string;
    duration?: number | null;
    duration_minutes?: number | null;
    startTime?: string | null;
    start_time?: string | null;
    endTime?: string | null;
    end_time?: string | null;
    serviceId?: string | null;
    service_id?: string | null;
    serviceIds?: string[] | null;
    service_ids?: string[] | null;
}

export interface ResolvedAppointmentInterval {
    durationMinutes: number;
    durationDecimal: number;
    endTime: string;
    isCustom: boolean;
    nominalMinutes: number;
}

export interface TargetAppointmentSlot {
    id?: string;
    staffId: string;
    dateKey: string;
    startDecimal: number;
    durationDecimal: number;
}

export interface ExistingAppointmentSlot {
    id: string;
    staffId: string;
    dateKey: string;
    startDecimal: number;
    durationDecimal: number;
    status?: string | null;
    client?: string;
    service?: string;
}

/**
 * Calcula a duração nominal agregada de uma lista de serviços (soma em minutos).
 */
export function calculateServicesNominalDuration(
    serviceIds: string[],
    servicesList: ServiceDurationInput[],
): number {
    if (!serviceIds || serviceIds.length === 0) {
        return 30; // fallback padrão
    }

    const total = serviceIds.reduce((sum, id) => {
        const found = servicesList.find((s) => s.id === id);
        if (!found) return sum;
        const minutes = Number(found.duration_minutes) || Number(found.duration) || 30;
        const buffer = Number(found.buffer) || 0;
        return sum + minutes + buffer;
    }, 0);

    return total > 0 ? total : 30;
}

/**
 * Calcula o horário de término seguro a partir do início e duração em minutos.
 * Suporta strings ISO completas ou horários no formato "HH:mm".
 */
export function calculateEndTime(startTime: string, durationMinutes: number): string {
    if (!startTime) return '';

    // Formato ISO timestamp
    if (startTime.includes('T')) {
        const date = new Date(startTime);
        if (Number.isNaN(date.getTime())) return '';
        const endDate = new Date(date.getTime() + durationMinutes * 60 * 1000);
        return endDate.toISOString();
    }

    // Formato HH:mm
    if (startTime.includes(':')) {
        const [hoursStr, minutesStr] = startTime.split(':');
        const startHours = Number.parseInt(hoursStr, 10) || 0;
        const startMinutes = Number.parseInt(minutesStr, 10) || 0;

        const totalMinutes = startHours * 60 + startMinutes + durationMinutes;
        const endHours = Math.floor(totalMinutes / 60) % 24;
        const endMinutes = totalMinutes % 60;

        return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
    }

    return '';
}

/**
 * Normaliza o intervalo e determina se a duração diverge do catálogo nominal.
 */
export function getResolvedAppointmentInterval(
    apt: AppointmentDurationInput,
    servicesList: ServiceDurationInput[] = [],
): ResolvedAppointmentInterval {
    const rawIds = apt.serviceIds || apt.service_ids;
    const singleId = apt.serviceId || apt.service_id;
    const serviceIds = rawIds && rawIds.length > 0 ? rawIds : (singleId ? [singleId] : []);

    const nominalMinutes = calculateServicesNominalDuration(serviceIds, servicesList);
    const startTime = apt.startTime || apt.start_time || '';
    const endTimeRaw = apt.endTime || apt.end_time || '';

    let durationMinutes = nominalMinutes;

    if (apt.duration_minutes !== undefined && apt.duration_minutes !== null && Number(apt.duration_minutes) > 0) {
        durationMinutes = Math.round(Number(apt.duration_minutes));
    } else if (apt.duration !== undefined && apt.duration !== null && Number(apt.duration) > 0) {
        const num = Number(apt.duration);
        // Se <= 12, é hora decimal (ex.: 0.5 = 30min, 1.25 = 75min)
        // Se > 12, já está em minutos (ex.: 30, 45, 60)
        durationMinutes = num <= 12 ? Math.round(num * 60) : Math.round(num);
    } else if (startTime && endTimeRaw && startTime.includes('T') && endTimeRaw.includes('T')) {
        const startMs = new Date(startTime).getTime();
        const endMs = new Date(endTimeRaw).getTime();
        if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
            durationMinutes = Math.round((endMs - startMs) / (60 * 1000));
        }
    }

    durationMinutes = Math.max(5, durationMinutes);
    const durationDecimal = Math.round((durationMinutes / 60) * 100) / 100;
    const endTime = endTimeRaw || calculateEndTime(startTime, durationMinutes);
    const isCustom = nominalMinutes > 0 && durationMinutes !== nominalMinutes;

    return {
        durationMinutes,
        durationDecimal,
        endTime,
        isCustom,
        nominalMinutes,
    };
}

/**
 * Detecta sobreposições de agendamentos no mesmo profissional e data.
 * Ignora o próprio agendamento (edição) e agendamentos cancelados.
 * Agendamentos perfeitamente contíguos (onde término = início) NÃO são tratados como sobreposição.
 */
export function detectAppointmentOverlap(
    target: TargetAppointmentSlot,
    existingAppointments: ExistingAppointmentSlot[],
): { hasOverlap: boolean; conflictingAppointments: ExistingAppointmentSlot[] } {
    const targetStart = target.startDecimal;
    const targetEnd = target.startDecimal + target.durationDecimal;

    const conflicts = existingAppointments.filter((apt) => {
        if (target.id && apt.id === target.id) return false;
        if (apt.staffId !== target.staffId) return false;
        if (apt.dateKey !== target.dateKey) return false;

        const status = (apt.status || '').toLowerCase();
        if (status === 'cancelled' || status === 'no_show') return false;

        const aptStart = apt.startDecimal;
        const aptEnd = apt.startDecimal + apt.durationDecimal;

        // Sobreposição estrita: targetStart < aptEnd E targetEnd > aptStart
        return targetStart < aptEnd && targetEnd > aptStart;
    });

    return {
        hasOverlap: conflicts.length > 0,
        conflictingAppointments: conflicts,
    };
}
