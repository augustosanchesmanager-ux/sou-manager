/**
 * [SMG][API-GATEWAY] routes/appointments — Handler REST de agendamentos (/v1/appointments)
 *
 * Em conformidade com ADR-032 e requisitos de isolamento multi-tenant da Fase 8.
 */

import { hasRequiredScope } from '../auth.ts';
import type { AuthContext, ApiErrorResponse } from '../types.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AppointmentRecord {
  id: string;
  tenant_id: string;
  client_name: string;
  client_phone: string;
  service_id: string;
  service_name: string;
  staff_id: string;
  staff_name: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  status: string;
  source: string;
  created_at: string;
}

export interface CreateAppointmentPayload {
  client_name?: unknown;
  client_phone?: unknown;
  barber_id?: unknown;
  service_id?: unknown;
  start_time?: unknown;
  notes?: unknown;
}

export interface NewAppointmentInput {
  tenant_id: string;
  client_name: string;
  client_phone: string;
  staff_id: string;
  staff_name: string;
  service_id: string;
  service_name: string;
  start_time: string;
  end_time: string;
  duration: number;
  price: number;
  status: string;
  notes?: string;
  source: string;
}

export interface AppointmentsDbClient {
  getAppointments(params: {
    tenantId: string;
    startDate?: string;
    endDate?: string;
    barberId?: string;
  }): Promise<AppointmentRecord[]>;

  getBarber(tenantId: string, barberId: string): Promise<{ id: string; name: string } | null>;

  getService(
    tenantId: string,
    serviceId: string
  ): Promise<{ id: string; name: string; price: number; duration_minutes?: number } | null>;

  checkSlotOverlap(params: {
    tenantId: string;
    barberId: string;
    startTime: string;
    endTime: string;
  }): Promise<boolean>;

  createAppointment(appointment: NewAppointmentInput): Promise<AppointmentRecord>;
}

function buildJsonResponse(body: unknown, status: number, requestId: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': requestId,
    },
  });
}

function buildErrorResponse(
  code: string,
  message: string,
  status: number,
  requestId: string
): Response {
  const errorPayload: ApiErrorResponse = {
    error: {
      code,
      message,
      request_id: requestId,
    },
  };
  return buildJsonResponse(errorPayload, status, requestId);
}

/**
 * Validador e normalizador do payload de criação de agendamento
 */
export function validateCreateAppointmentPayload(
  raw: unknown,
  now: Date = new Date()
): {
  valid: boolean;
  error?: { code: string; message: string };
  data?: {
    client_name: string;
    client_phone: string;
    barber_id: string;
    service_id: string;
    start_time: string;
    notes?: string;
  };
} {
  if (!raw || typeof raw !== 'object') {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Payload da requisição deve ser um objeto JSON válido.',
      },
    };
  }

  const p = raw as CreateAppointmentPayload;

  // 1. client_name
  if (!p.client_name || typeof p.client_name !== 'string' || p.client_name.trim().length < 2) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "client_name" ausente ou inválido (mínimo 2 caracteres).',
      },
    };
  }

  // 2. client_phone
  if (!p.client_phone || typeof p.client_phone !== 'string' || p.client_phone.trim().length < 8) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "client_phone" ausente ou inválido.',
      },
    };
  }

  // 3. barber_id
  if (!p.barber_id || typeof p.barber_id !== 'string' || !UUID_REGEX.test(p.barber_id.trim())) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "barber_id" ausente ou com formato UUID inválido.',
      },
    };
  }

  // 4. service_id
  if (!p.service_id || typeof p.service_id !== 'string' || !UUID_REGEX.test(p.service_id.trim())) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "service_id" ausente ou com formato UUID inválido.',
      },
    };
  }

  // 5. start_time
  if (!p.start_time || typeof p.start_time !== 'string') {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Campo obrigatório "start_time" ausente.',
      },
    };
  }

  const startDate = new Date(p.start_time);
  if (isNaN(startDate.getTime())) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'Formato do campo "start_time" inválido. Esperado padrão ISO 8601.',
      },
    };
  }

  if (startDate.getTime() <= now.getTime()) {
    return {
      valid: false,
      error: {
        code: 'INVALID_REQUEST_PAYLOAD',
        message: 'O horário do agendamento deve ser uma data e hora futura.',
      },
    };
  }

  return {
    valid: true,
    data: {
      client_name: p.client_name.trim(),
      client_phone: p.client_phone.trim(),
      barber_id: p.barber_id.trim(),
      service_id: p.service_id.trim(),
      start_time: startDate.toISOString(),
      notes: typeof p.notes === 'string' ? p.notes.trim() : undefined,
    },
  };
}

/**
 * Handler HTTP principal para /v1/appointments
 */
export async function handleAppointmentsRoute(
  req: Request,
  authContext: AuthContext,
  dbClient: AppointmentsDbClient,
  requestId: string,
  now: Date = new Date()
): Promise<Response> {
  const method = req.method.toUpperCase();

  // =========================================================================
  // GET /v1/appointments — Listar agendamentos do tenant
  // =========================================================================
  if (method === 'GET') {
    if (!hasRequiredScope(authContext.scopes, 'appointments:read')) {
      return buildErrorResponse(
        'INSUFFICIENT_SCOPE',
        "Permissão insuficiente: requer o escopo 'appointments:read'.",
        403,
        requestId
      );
    }

    const url = new URL(req.url);
    const dateParam = url.searchParams.get('date');
    const startDateParam = url.searchParams.get('start_date');
    const endDateParam = url.searchParams.get('end_date');
    const barberIdParam = url.searchParams.get('barber_id');

    let startDate: string | undefined = startDateParam || undefined;
    let endDate: string | undefined = endDateParam || undefined;

    if (dateParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        return buildErrorResponse(
          'INVALID_REQUEST_PAYLOAD',
          'Parâmetro "date" inválido. Esperado formato YYYY-MM-DD.',
          400,
          requestId
        );
      }
      startDate = `${dateParam}T00:00:00.000Z`;
      endDate = `${dateParam}T23:59:59.999Z`;
    }

    if (barberIdParam && !UUID_REGEX.test(barberIdParam)) {
      return buildErrorResponse(
        'INVALID_REQUEST_PAYLOAD',
        'Parâmetro "barber_id" com formato UUID inválido.',
        400,
        requestId
      );
    }

    try {
      const appointments = await dbClient.getAppointments({
        tenantId: authContext.tenantId,
        startDate,
        endDate,
        barberId: barberIdParam || undefined,
      });

      return buildJsonResponse(
        {
          data: appointments,
          count: appointments.length,
          meta: {
            tenant_id: authContext.tenantId,
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        200,
        requestId
      );
    } catch (err) {
      console.error(`[API-GATEWAY] [${requestId}] Failed to fetch appointments:`, err);
      return buildErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Erro ao consultar agendamentos.',
        500,
        requestId
      );
    }
  }

  // =========================================================================
  // POST /v1/appointments — Criar novo agendamento
  // =========================================================================
  if (method === 'POST') {
    if (!hasRequiredScope(authContext.scopes, 'appointments:write')) {
      return buildErrorResponse(
        'INSUFFICIENT_SCOPE',
        "Permissão insuficiente: requer o escopo 'appointments:write'.",
        403,
        requestId
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return buildErrorResponse(
        'INVALID_REQUEST_PAYLOAD',
        'Corpo da requisição deve ser um JSON válido.',
        400,
        requestId
      );
    }

    const validation = validateCreateAppointmentPayload(bodyJson, now);
    if (!validation.valid || !validation.data) {
      return buildErrorResponse(
        validation.error?.code || 'INVALID_REQUEST_PAYLOAD',
        validation.error?.message || 'Payload inválido.',
        400,
        requestId
      );
    }

    const payload = validation.data;

    try {
      // 1. Validar existência do profissional no tenant
      const barber = await dbClient.getBarber(authContext.tenantId, payload.barber_id);
      if (!barber) {
        return buildErrorResponse(
          'INVALID_REQUEST_PAYLOAD',
          'Profissional (barber_id) não encontrado ou não pertence a este estabelecimento.',
          400,
          requestId
        );
      }

      // 2. Validar existência do serviço no tenant
      const service = await dbClient.getService(authContext.tenantId, payload.service_id);
      if (!service) {
        return buildErrorResponse(
          'INVALID_REQUEST_PAYLOAD',
          'Serviço (service_id) não encontrado ou não pertence a este estabelecimento.',
          400,
          requestId
        );
      }

      // 3. Calcular horário de término
      const durationMinutes = service.duration_minutes && service.duration_minutes > 0
        ? service.duration_minutes
        : 30; // default 30 min se não configurado
      const durationHours = Number((durationMinutes / 60).toFixed(2));

      const startTimeDate = new Date(payload.start_time);
      const endTimeDate = new Date(startTimeDate.getTime() + durationMinutes * 60 * 1000);
      const endTime = endTimeDate.toISOString();

      // 4. Checar sobreposição de horário (double-booking)
      const hasConflict = await dbClient.checkSlotOverlap({
        tenantId: authContext.tenantId,
        barberId: payload.barber_id,
        startTime: payload.start_time,
        endTime,
      });

      if (hasConflict) {
        return buildErrorResponse(
          'SLOT_UNAVAILABLE',
          'Horário indisponível: o profissional já possui agendamento no intervalo solicitado.',
          409,
          requestId
        );
      }

      // 5. Criar agendamento
      const newAppointment = await dbClient.createAppointment({
        tenant_id: authContext.tenantId,
        client_name: payload.client_name,
        client_phone: payload.client_phone,
        staff_id: payload.barber_id,
        staff_name: barber.name,
        service_id: payload.service_id,
        service_name: service.name,
        start_time: payload.start_time,
        end_time: endTime,
        duration: durationHours,
        price: service.price ?? 0,
        status: 'confirmed',
        notes: payload.notes,
        source: 'public_api',
      });

      return buildJsonResponse(
        {
          data: newAppointment,
          meta: {
            request_id: requestId,
            timestamp: new Date().toISOString(),
          },
        },
        201,
        requestId
      );
    } catch (err) {
      console.error(`[API-GATEWAY] [${requestId}] Error creating appointment:`, err);
      return buildErrorResponse(
        'INTERNAL_SERVER_ERROR',
        'Erro interno ao registrar agendamento.',
        500,
        requestId
      );
    }
  }

  // Método HTTP não suportado
  return buildErrorResponse(
    'METHOD_NOT_ALLOWED',
    `Método ${method} não permitido para este recurso.`,
    405,
    requestId
  );
}
