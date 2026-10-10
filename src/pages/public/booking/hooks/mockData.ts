/**
 * Mock data for the public booking flow.
 * Realistic Brazilian barbershop data for "Barbearia Dom Zé".
 * Used when Supabase RPCs are not available (dev mode, demo mode, or function-not-found).
 */

import type {
  PublicTenantProfile,
  PublicService,
  PublicStaff,
  PublicAvailableSlotsResponse,
  PublicSlot,
  CreatePublicBookingResult,
  CreatePublicBookingService,
  CreatePublicBookingStaff,
} from './types';

// ============================================================================
// Tenant Profile - "Barbearia Dom Zé"
// ============================================================================

export const MOCK_TENANT_PROFILE: PublicTenantProfile = {
  tenant_id: '11111111-1111-1111-1111-111111111111',
  name: 'Barbearia Dom Zé',
  slug: 'domze',
  logo_url: null,
  address: 'Rua das Palmeiras, 123 - Vila Madalena, São Paulo - SP, 05432-010',
  phone: '(11) 99999-8888',
  social_links: {
    instagram: 'barbearia_domze',
    whatsapp: '5511999998888',
    website: 'https://barbeariadomze.com.br',
  },
  booking_enabled: true,
  booking_rules: {
    horizon_days: 30,
    min_booking_notice_minutes: 30,
    auto_confirm_online_bookings: true,
    public_cancel_window_minutes: 120,
    appointment_interval_minutes: 30,
    default_appointment_duration_minutes: 60,
    timezone: 'America/Sao_Paulo',
  },
  services: [
    {
      id: 'srv-001',
      name: 'Corte Masculino',
      price: 45.00,
      duration: 30,
      active: true,
      category: 'Corte',
    },
    {
      id: 'srv-002',
      name: 'Barba Completa',
      price: 35.00,
      duration: 30,
      active: true,
      category: 'Barba',
    },
    {
      id: 'srv-003',
      name: 'Corte + Barba',
      price: 70.00,
      duration: 50,
      active: true,
      category: 'Combo',
    },
    {
      id: 'srv-004',
      name: 'Sobrancelha',
      price: 20.00,
      duration: 15,
      active: true,
      category: 'Acabamento',
    },
    {
      id: 'srv-005',
      name: 'Hidratação Capilar',
      price: 40.00,
      duration: 25,
      active: true,
      category: 'Tratamento',
    },
    {
      id: 'srv-006',
      name: 'Pigmentação de Barba',
      price: 55.00,
      duration: 40,
      active: true,
      category: 'Barba',
    },
  ],
  staff: [
    {
      id: 'stf-001',
      name: 'Zé (Dono)',
      status: 'active',
    },
    {
      id: 'stf-002',
      name: 'Marcos Silva',
      status: 'active',
    },
    {
      id: 'stf-003',
      name: 'Rafael Santos',
      status: 'active',
    },
    {
      id: 'stf-004',
      name: 'Lucas Oliveira',
      status: 'active',
    },
  ],
};

// ============================================================================
// Helper: Generate slots for a given date
// ============================================================================

const BUSINESS_START_HOUR = 9; // 09:00
const BUSINESS_END_HOUR = 20; // 20:00
const SLOT_INTERVAL_MINUTES = 30;
const TIMEZONE = 'America/Sao_Paulo';

const pad2 = (n: number): string => String(n).padStart(2, '0');

const formatISO = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00-03:00`;

function generateSlotsForDate(date: string, staffId: string | null): PublicSlot[] {
  const slots: PublicSlot[] = [];
  const baseDate = new Date(`${date}T00:00:00`);
  const activeStaff = MOCK_TENANT_PROFILE.staff.filter((s) => s.status === 'active');
  let slotIndex = 0;

  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
    for (let minute = 0; minute < 60; minute += SLOT_INTERVAL_MINUTES) {
      const start = new Date(baseDate);
      start.setHours(hour, minute, 0, 0);

      const end = new Date(start);
      end.setMinutes(end.getMinutes() + SLOT_INTERVAL_MINUTES);

      const targetStaffId = staffId ?? activeStaff[slotIndex % activeStaff.length].id;

      slots.push({
        staff_id: targetStaffId,
        start_time: formatISO(start),
        end_time: formatISO(end),
        available: true,
      });
      slotIndex++;
    }
  }

  return slots;
}

// ============================================================================
// Mock Available Slots Response
// ============================================================================

export function createMockAvailableSlotsResponse(
  tenantIdentifier: string,
  staffId: string | null,
  serviceIds: string[],
  date: string
): PublicAvailableSlotsResponse {
  const allSlots = generateSlotsForDate(date, staffId);
  const availableSlots = allSlots.filter((_, index) => index % 3 !== 0);

  return {
    date,
    timezone: TIMEZONE,
    interval_minutes: SLOT_INTERVAL_MINUTES,
    slots: availableSlots,
  };
}

// ============================================================================
// Mock Create Booking Result
// ============================================================================

export function createMockBookingResult(
  request: {
    tenant_identifier: string;
    staff_id: string;
    service_ids: string[];
    start_time: string;
    client_name: string;
    client_phone: string;
    client_notes: string | null;
    idempotency_key: string | null;
  },
  isIdempotent = false
): CreatePublicBookingResult {
  const services = request.service_ids.map((id) => {
    const svc = MOCK_TENANT_PROFILE.services.find((s) => s.id === id);
    return {
      service_id: id,
      name: svc?.name || 'Serviço',
      duration: svc?.duration || 30,
      price: svc?.price || 0,
    };
  });

  const staff = MOCK_TENANT_PROFILE.staff.find((s) => s.id === request.staff_id);
  const totalDuration = services.reduce((sum, s) => sum + s.duration, 0);
  const startTime = new Date(request.start_time);
  const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 90); // 90 days per SPEC decision 4

  return {
    appointment_id: `apt-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    client_id: `cli-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    status: 'confirmed',
    public_token: isIdempotent ? null : `pub_${Math.random().toString(36).slice(2, 16)}${Date.now().toString(36)}`,
    public_token_id: `tok-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    expires_at: formatISO(expiresAt),
    services,
    staff: {
      id: request.staff_id,
      name: staff?.name || 'Profissional',
    },
    start_time: formatISO(startTime),
    end_time: formatISO(endTime),
    idempotent: isIdempotent,
  };
}

// ============================================================================
// Special error trigger: phone 11900000000 triggers slot_occupied error
// ============================================================================

export const MOCK_ERROR_TRIGGER_PHONE = '11900000000'; // E.164 format without +

export function shouldTriggerMockError(phoneE164: string): boolean {
  return phoneE164.replace(/\D/g, '') === MOCK_ERROR_TRIGGER_PHONE.replace(/\D/g, '');
}

// ============================================================================
// Artificial latency simulation
// ============================================================================

export const MOCK_LATENCY_MS = 400;

export async function simulateLatency(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}