/**
 * Mock service layer implementing the 4 public booking RPCs.
 * Used when real Supabase RPCs are unavailable (dev mode, demo mode, or function-not-found).
 * Matches the exact contracts from SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md v1.1
 */

import type {
  PublicTenantProfile,
  PublicAvailableSlotsResponse,
  CreatePublicBookingResult,
  CreatePublicBookingRequest,
  PublicBookingErrorCode,
  PublicBookingError,
} from './types';
import {
  MOCK_TENANT_PROFILE,
  createMockAvailableSlotsResponse,
  createMockBookingResult,
  shouldTriggerMockError,
  simulateLatency,
  MOCK_ERROR_TRIGGER_PHONE,
} from './mockData';

// ============================================================================
// In-memory storage for idempotency and booking state
// ============================================================================

const idempotencyStore = new Map<string, CreatePublicBookingResult>();

// Extended booking type for internal storage (includes cancelled status)
interface StoredBooking {
  appointment_id: string;
  client_id: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  public_token: string | null;
  public_token_id: string;
  expires_at: string;
  services: Array<{ service_id: string; name: string; duration: number; price: number }>;
  staff: { id: string; name: string };
  start_time: string;
  end_time: string;
  idempotent: boolean;
}

const bookingStore = new Map<string, StoredBooking>();

// ============================================================================
// Error factory
// ============================================================================

function createBookingError(code: PublicBookingErrorCode, message: string): PublicBookingError {
  const error = new Error(message) as PublicBookingError;
  error.code = code;
  return error;
}

// ============================================================================
// RPC 1: get_public_tenant_profile
// ============================================================================

export async function mockGetPublicTenantProfile(
  tenantIdentifier: string
): Promise<PublicTenantProfile | null> {
  await simulateLatency();

  // Match by slug or ID
  const normalized = tenantIdentifier.trim().toLowerCase();
  const mockSlug = MOCK_TENANT_PROFILE.slug.toLowerCase();
  const mockId = MOCK_TENANT_PROFILE.tenant_id.toLowerCase();

  if (normalized !== mockSlug && normalized !== mockId) {
    return null; // Not found - per SPEC, return NULL not exception
  }

  if (!MOCK_TENANT_PROFILE.booking_enabled) {
    return null; // Booking disabled - hide profile
  }

  // Return a deep copy to prevent mutation
  return JSON.parse(JSON.stringify(MOCK_TENANT_PROFILE));
}

// ============================================================================
// RPC 2: get_public_available_slots
// ============================================================================

export async function mockGetPublicAvailableSlots(
  tenantIdentifier: string,
  staffId: string | null,
  serviceIds: string[],
  date: string
): Promise<PublicAvailableSlotsResponse> {
  await simulateLatency();

  // Validate tenant
  const normalized = tenantIdentifier.trim().toLowerCase();
  const mockSlug = MOCK_TENANT_PROFILE.slug.toLowerCase();
  const mockId = MOCK_TENANT_PROFILE.tenant_id.toLowerCase();

  if (normalized !== mockSlug && normalized !== mockId) {
    throw createBookingError('slot_occupied', 'Tenant não encontrado');
  }

  if (!MOCK_TENANT_PROFILE.booking_enabled) {
    throw createBookingError('slot_occupied', 'Agendamentos desativados para esta barbearia');
  }

  // Validate date is within horizon
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const targetDate = new Date(`${date}T00:00:00`);
  const horizonDays = MOCK_TENANT_PROFILE.booking_rules.horizon_days;
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + horizonDays);

  if (targetDate < today || targetDate > maxDate) {
    return {
      date,
      timezone: MOCK_TENANT_PROFILE.booking_rules.timezone,
      interval_minutes: MOCK_TENANT_PROFILE.booking_rules.appointment_interval_minutes,
      slots: [],
    };
  }

  const response = createMockAvailableSlotsResponse(tenantIdentifier, staffId, serviceIds, date);

  // Filter out slots that don't meet min booking notice (for today)
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (date === todayStr) {
    const minNoticeMinutes = MOCK_TENANT_PROFILE.booking_rules.min_booking_notice_minutes;
    const minAllowedTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);
    response.slots = response.slots.filter((slot) => {
      const slotStart = new Date(slot.start_time);
      return slotStart >= minAllowedTime;
    });
  }

  return response;
}

// ============================================================================
// RPC 3: create_public_booking
// ============================================================================

export async function mockCreatePublicBooking(
  request: CreatePublicBookingRequest
): Promise<CreatePublicBookingResult> {
  await simulateLatency();

  // Check idempotency key first
  if (request.idempotency_key) {
    const existing = idempotencyStore.get(request.idempotency_key);
    if (existing) {
      // Return existing result with idempotent: true and public_token: null
      return {
        ...existing,
        idempotent: true,
        public_token: null,
      };
    }
  }

  // Validate tenant
  const normalized = request.tenant_identifier.trim().toLowerCase();
  const mockSlug = MOCK_TENANT_PROFILE.slug.toLowerCase();
  const mockId = MOCK_TENANT_PROFILE.tenant_id.toLowerCase();

  if (normalized !== mockSlug && normalized !== mockId) {
    throw createBookingError('slot_occupied', 'Tenant não encontrado');
  }

  if (!MOCK_TENANT_PROFILE.booking_enabled) {
    throw createBookingError('slot_occupied', 'Agendamentos desativados para esta barbearia');
  }

  // Validate required fields
  if (!request.client_name.trim()) {
    throw createBookingError('slot_occupied', 'Nome do cliente é obrigatório');
  }

  if (!request.client_phone.trim()) {
    throw createBookingError('slot_occupied', 'Telefone é obrigatório');
  }

  if (!request.service_ids.length) {
    throw createBookingError('slot_occupied', 'Selecione pelo menos um serviço');
  }

  // Check special error trigger phone
  if (shouldTriggerMockError(request.client_phone)) {
    throw createBookingError('slot_occupied', 'Esse horário acabou de ser reservado. Escolha outro.');
  }

  // Validate staff
  const staff = MOCK_TENANT_PROFILE.staff.find((s) => s.id === request.staff_id);
  if (!staff || staff.status !== 'active') {
    throw createBookingError('slot_occupied', 'Profissional não disponível');
  }

  // Validate services
  const services = request.service_ids.map((id) => MOCK_TENANT_PROFILE.services.find((s) => s.id === id));
  if (services.some((s) => !s || !s.active)) {
    throw createBookingError('slot_occupied', 'Serviço inválido ou inativo');
  }

  // Validate booking notice and horizon
  const startTime = new Date(request.start_time);
  const now = new Date();
  const minNoticeMinutes = MOCK_TENANT_PROFILE.booking_rules.min_booking_notice_minutes;
  const minAllowedTime = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);

  if (startTime < minAllowedTime) {
    throw createBookingError('booking_too_soon', `Agendamento deve ser feito com pelo menos ${minNoticeMinutes} minutos de antecedência`);
  }

  const horizonDays = MOCK_TENANT_PROFILE.booking_rules.horizon_days;
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + horizonDays);
  maxDate.setHours(23, 59, 59, 999);

  if (startTime > maxDate) {
    throw createBookingError('booking_too_far', `Agendamento só pode ser feito até ${horizonDays} dias à frente`);
  }

  // Create booking result
  const result = createMockBookingResult(request, false);

  // Store for idempotency
  if (request.idempotency_key) {
    idempotencyStore.set(request.idempotency_key, result);
  }

  // Store booking for potential cancellation (RPC 4 - out of scope but kept for completeness)
  bookingStore.set(result.appointment_id, result);

  return result;
}

// ============================================================================
// RPC 4: cancel_public_booking (OUT OF SCOPE for UI but implemented for completeness)
// ============================================================================

export async function mockCancelPublicBooking(
  tenantIdentifier: string,
  publicToken: string
): Promise<{ appointment_id: string; status: 'cancelled'; cancelled_at: string; cancelled: true; idempotent: boolean }> {
  await simulateLatency();

  // Find booking by token (in real implementation, token is hashed)
  // For mock, we'll search through stored bookings
  for (const [, booking] of bookingStore) {
    if (booking.public_token === publicToken) {
      const now = new Date();
      const formatISO = (d: Date) => d.toISOString();

      // Check cancellation window (120 min default)
      const cancelWindowMinutes = MOCK_TENANT_PROFILE.booking_rules.public_cancel_window_minutes;
      const startTime = new Date(booking.start_time);
      const cutoffTime = new Date(startTime.getTime() - cancelWindowMinutes * 60 * 1000);

      if (now > cutoffTime) {
        throw createBookingError('cancellation_window_closed', 'Janela de cancelamento encerrada');
      }

      // Check if already cancelled
      if (booking.status === 'cancelled') {
        return {
          appointment_id: booking.appointment_id,
          status: 'cancelled',
          cancelled_at: formatISO(now),
          cancelled: true,
          idempotent: true,
        };
      }

      // Cancel it
      booking.status = 'cancelled';
      return {
        appointment_id: booking.appointment_id,
        status: 'cancelled',
        cancelled_at: formatISO(now),
        cancelled: true,
        idempotent: false,
      };
    }
  }

  throw createBookingError('invalid_token', 'Token inválido ou expirado');
}

// ============================================================================
// Utility: Clear mock stores (for testing/reset)
// ============================================================================

export function clearMockStores(): void {
  idempotencyStore.clear();
  bookingStore.clear();
}

// ============================================================================
// Export error trigger constant for documentation
// ============================================================================

export { MOCK_ERROR_TRIGGER_PHONE };