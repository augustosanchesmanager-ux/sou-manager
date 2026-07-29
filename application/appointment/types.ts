/**
 * [SMG][APPLICATION][APPOINTMENT] types
 *
 * Tipos compartilhados do AppointmentApplicationService.
 */

// ─── Params ───────────────────────────────────────────────────────

export interface CreateAppointmentParams {
    tenantId: string;
    appSlug: string;
    schema: string;
    userId: string;

    // Client
    clientId?: string;
    clientName: string;
    clientPhone?: string;

    // Staff
    staffId: string;

    // Services
    serviceIds: string[];
    serviceNames: string[];
    totalPrice: number;
    duration: number;

    // Schedule
    startTime: string;
    endTime: string;
    notes?: string;

    // Idempotency
    idempotencyKey: string;

    // Single-service only
    isOverbooked?: boolean;
}

export interface UpdateAppointmentParams {
    tenantId: string;
    appointmentId: string;
    updates: {
        staff_id?: string;
        start_time?: string;
        end_time?: string;
        price?: number;
        notes?: string;
    };
    syncComandaStaff?: boolean;
}

export interface ResolveFinalPriceParams {
    tenantId: string;
    serviceId: string;
    basePrice: number;
    promotions: Array<{
        target_type: 'all' | 'service';
        target_id?: string;
        discount_type: 'fixed' | 'percentage';
        discount_value: number;
    }>;
}

export interface OpenComandasByAppointment {
    [appointmentId: string]: string;
}

export interface CancelAppointmentParams {
    tenantId: string;
    appointmentId: string;
    cancellationType: 'client_request' | 'no_show' | 'registration_error' | 'test' | 'other';
    cancellationReason?: string;
    userId: string;
}

export interface RescheduleAppointmentParams {
    tenantId: string;
    appointmentId: string;
    newStaffId: string;
    newStaffName?: string;
    newStartTime: string;
    newEndTime: string;
}

export interface ChangeStatusParams {
    tenantId: string;
    appointmentId: string;
    newStatus: 'confirmed' | 'in_progress' | 'completed';
}

export interface CreateAppointmentResult {
    appointmentId: string;
    comandaId: string | null;
    totalPrice: number;
}

// ─── Errors ──────────────────────────────────────────────────────

export class AppointmentError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'AppointmentError';
    }
}
