/**
 * TypeScript interfaces mirroring EXACTLY the SPEC contracts from
 * docs/SPEC_RPC_AGENDAMENTO_ONLINE_PUBLICO.md v1.1
 * These types are the single source of truth for the public booking flow.
 */

// ============================================================================
// RPC 1: get_public_tenant_profile
// ============================================================================

export interface PublicTenantProfile {
  tenant_id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  social_links: PublicSocialLinks | null;
  booking_enabled: boolean;
  booking_rules: PublicBookingRules;
  services: PublicService[];
  staff: PublicStaff[];
}

export interface PublicSocialLinks {
  instagram: string;
  whatsapp: string;
  website: string;
}

export interface PublicBookingRules {
  horizon_days: number;
  min_booking_notice_minutes: number;
  auto_confirm_online_bookings: boolean;
  public_cancel_window_minutes: number;
  appointment_interval_minutes: number;
  default_appointment_duration_minutes: number;
  timezone: string;
}

export interface PublicService {
  id: string;
  name: string;
  price: number;
  duration: number;
  active: boolean;
  category: string | null;
}

export interface PublicStaff {
  id: string;
  name: string;
  status: 'active' | 'inactive';
}

// ============================================================================
// RPC 2: get_public_available_slots
// ============================================================================

export interface PublicAvailableSlotsRequest {
  tenant_identifier: string;
  staff_id: string | null;
  service_ids: string[];
  date: string; // YYYY-MM-DD
}

export interface PublicAvailableSlotsResponse {
  date: string;
  timezone: string;
  interval_minutes: number;
  slots: PublicSlot[];
}

export interface PublicSlot {
  staff_id: string;
  start_time: string; // ISO 8601 with timezone
  end_time: string; // ISO 8601 with timezone
  available: true; // Always true per SPEC
}

// ============================================================================
// RPC 3: create_public_booking
// ============================================================================

export interface CreatePublicBookingRequest {
  tenant_identifier: string;
  staff_id: string;
  service_ids: string[];
  start_time: string; // ISO 8601 with timezone
  client_name: string;
  client_phone: string;
  client_notes: string | null;
  idempotency_key: string | null;
}

export interface CreatePublicBookingResult {
  appointment_id: string;
  client_id: string;
  status: 'confirmed' | 'pending';
  public_token: string | null; // plaintext-once, null on idempotent retry
  public_token_id: string;
  expires_at: string; // ISO 8601
  services: CreatePublicBookingService[];
  staff: CreatePublicBookingStaff;
  start_time: string;
  end_time: string;
  idempotent: boolean;
}

export interface CreatePublicBookingService {
  service_id: string;
  name: string;
  duration: number;
  price: number;
}

export interface CreatePublicBookingStaff {
  id: string;
  name: string;
}

// ============================================================================
// RPC 4: cancel_public_booking (OUT OF SCOPE for this UI front)
// ============================================================================

export interface CancelPublicBookingRequest {
  tenant_identifier: string;
  public_token: string;
}

export interface CancelPublicBookingResult {
  appointment_id: string;
  status: 'cancelled';
  cancelled_at: string;
  cancelled: true;
  idempotent: boolean;
}

// ============================================================================
// Error codes from SPEC
// ============================================================================

export type PublicBookingErrorCode =
  | 'booking_too_soon'
  | 'booking_too_far'
  | 'slot_occupied'
  | 'invalid_token'
  | 'token_expired'
  | 'token_revoked'
  | 'cancellation_window_closed'
  | 'ERR_SLOT_UNAVAILABLE'; // Legacy alias for slot_occupied

export interface PublicBookingError extends Error {
  code: PublicBookingErrorCode;
  message: string;
}

// ============================================================================
// Internal UI State Types
// ============================================================================

export type BookingStep = 'services' | 'staff' | 'datetime' | 'client' | 'success';

export interface BookingState {
  // Step 1: Services
  selectedServiceIds: string[];
  // Step 2: Staff
  selectedStaffId: string | null; // null = "Qualquer Profissional Disponível"
  // Step 3: DateTime
  selectedDate: string | null; // YYYY-MM-DD
  selectedSlot: PublicSlot | null;
  // Step 4: Client Form
  clientName: string;
  clientPhone: string; // Stored as E.164 (+55...)
  clientPhoneDisplay: string; // Display format (11) 99999-9999
  clientNotes: string;
  // Step 5: Success
  bookingResult: CreatePublicBookingResult | null;
  // Meta
  currentStep: BookingStep;
  isLoading: boolean;
  error: PublicBookingError | null;
  tenantProfile: PublicTenantProfile | null;
  idempotencyKey: string;
}

export interface TimePeriodGroup {
  label: string;
  slots: PublicSlot[];
  startHour: number;
  endHour: number;
}

export const TIME_PERIODS: TimePeriodGroup[] = [
  { label: 'Manhã', slots: [], startHour: 0, endHour: 12 },
  { label: 'Tarde', slots: [], startHour: 12, endHour: 18 },
  { label: 'Noite', slots: [], startHour: 18, endHour: 24 },
];

export const STEP_ORDER: BookingStep[] = ['services', 'staff', 'datetime', 'client', 'success'];

export const STEP_LABELS: Record<BookingStep, { label: string; helper: string }> = {
  services: { label: 'Passo 1 de 4', helper: 'Escolha os serviços desejados' },
  staff: { label: 'Passo 2 de 4', helper: 'Selecione o profissional' },
  datetime: { label: 'Passo 3 de 4', helper: 'Escolha data e horário' },
  client: { label: 'Passo 4 de 4', helper: 'Seus dados para confirmação' },
  success: { label: 'Concluído', helper: 'Agendamento confirmado' },
};