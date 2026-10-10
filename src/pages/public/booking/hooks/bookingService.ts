/**
 * Booking service layer - tries real Supabase RPCs first, falls back to mock.
 * Uses the shared Supabase client pattern from the project.
 */

import { getSharedClient } from '../../../../../services/supabaseClient';
import type {
  PublicTenantProfile,
  PublicAvailableSlotsResponse,
  CreatePublicBookingResult,
  CreatePublicBookingRequest,
  PublicBookingError,
  PublicBookingErrorCode,
} from './types';
import {
  mockGetPublicTenantProfile,
  mockGetPublicAvailableSlots,
  mockCreatePublicBooking,
  mockCancelPublicBooking,
} from './mockService';

// ============================================================================
// Configuration
// ============================================================================

const RPC_NAMES = {
  GET_TENANT_PROFILE: 'get_public_tenant_profile',
  GET_AVAILABLE_SLOTS: 'get_public_available_slots',
  CREATE_BOOKING: 'create_public_booking',
  CANCEL_BOOKING: 'cancel_public_booking',
} as const;

// Check if we should use mock (dev mode with VITE_BOOKING_MOCK !== 'false')
const shouldUseMock = (): boolean => {
  // In demo mode (no Supabase env), always use mock
  if (import.meta.env.DEV) {
    const mockFlag = import.meta.env.VITE_BOOKING_MOCK;
    // Default to mock in dev unless explicitly disabled
    if (mockFlag === 'false') return false;
    return true;
  }
  return false;
};

// Check if error is "function not found" (PostgreSQL error code 42883)
const isFunctionNotFoundError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as Record<string, unknown>;
  // Supabase wraps Postgres errors with code property
  return err.code === '42883' || err.code === 'P0001' || (err.message && String(err.message).includes('function') && String(err.message).includes('does not exist'));
};

// ============================================================================
// RPC 1: get_public_tenant_profile
// ============================================================================

export async function getPublicTenantProfile(
  tenantIdentifier: string
): Promise<PublicTenantProfile | null> {
  if (shouldUseMock()) {
    return mockGetPublicTenantProfile(tenantIdentifier);
  }

  try {
    const client = getSharedClient();
    const { data, error } = await client.rpc(RPC_NAMES.GET_TENANT_PROFILE, {
      p_tenant_identifier: tenantIdentifier,
    });

    if (error) {
      // If function doesn't exist, fall back to mock
      if (isFunctionNotFoundError(error)) {
        console.warn('[BookingService] RPC not found, falling back to mock:', error.message);
        return mockGetPublicTenantProfile(tenantIdentifier);
      }
      throw error;
    }

    // RPC returns null if tenant not found or booking disabled
    return data as PublicTenantProfile | null;
  } catch (err) {
    // Network or other errors - fall back to mock in dev
    if (import.meta.env.DEV && isFunctionNotFoundError(err)) {
      console.warn('[BookingService] RPC error, falling back to mock:', err);
      return mockGetPublicTenantProfile(tenantIdentifier);
    }
    throw err;
  }
}

// ============================================================================
// RPC 2: get_public_available_slots
// ============================================================================

export async function getPublicAvailableSlots(
  tenantIdentifier: string,
  staffId: string | null,
  serviceIds: string[],
  date: string
): Promise<PublicAvailableSlotsResponse> {
  if (shouldUseMock()) {
    return mockGetPublicAvailableSlots(tenantIdentifier, staffId, serviceIds, date);
  }

  try {
    const client = getSharedClient();
    const { data, error } = await client.rpc(RPC_NAMES.GET_AVAILABLE_SLOTS, {
      p_tenant_identifier: tenantIdentifier,
      p_staff_id: staffId,
      p_service_ids: serviceIds,
      p_date: date,
    });

    if (error) {
      if (isFunctionNotFoundError(error)) {
        console.warn('[BookingService] RPC not found, falling back to mock:', error.message);
        return mockGetPublicAvailableSlots(tenantIdentifier, staffId, serviceIds, date);
      }
      throw error;
    }

    return data as PublicAvailableSlotsResponse;
  } catch (err) {
    if (import.meta.env.DEV && isFunctionNotFoundError(err)) {
      console.warn('[BookingService] RPC error, falling back to mock:', err);
      return mockGetPublicAvailableSlots(tenantIdentifier, staffId, serviceIds, date);
    }
    throw err;
  }
}

// ============================================================================
// RPC 3: create_public_booking
// ============================================================================

export async function createPublicBooking(
  request: CreatePublicBookingRequest
): Promise<CreatePublicBookingResult> {
  if (shouldUseMock()) {
    return mockCreatePublicBooking(request);
  }

  try {
    const client = getSharedClient();
    const { data, error } = await client.rpc(RPC_NAMES.CREATE_BOOKING, {
      p_tenant_identifier: request.tenant_identifier,
      p_staff_id: request.staff_id,
      p_service_ids: request.service_ids,
      p_start_time: request.start_time,
      p_client_name: request.client_name,
      p_client_phone: request.client_phone,
      p_notes: request.client_notes,
      p_idempotency_key: request.idempotency_key,
    });

    if (error) {
      if (isFunctionNotFoundError(error)) {
        console.warn('[BookingService] RPC not found, falling back to mock:', error.message);
        return mockCreatePublicBooking(request);
      }
      // Map Postgres error codes to our error types
      const bookingError = mapPostgresError(error);
      throw bookingError;
    }

    return data as CreatePublicBookingResult;
  } catch (err) {
    if (import.meta.env.DEV && isFunctionNotFoundError(err)) {
      console.warn('[BookingService] RPC error, falling back to mock:', err);
      return mockCreatePublicBooking(request);
    }
    throw err;
  }
}

// ============================================================================
// RPC 4: cancel_public_booking (OUT OF SCOPE for UI but exported for completeness)
// ============================================================================

export async function cancelPublicBooking(
  tenantIdentifier: string,
  publicToken: string
): Promise<{ appointment_id: string; status: 'cancelled'; cancelled_at: string; cancelled: true; idempotent: boolean }> {
  if (shouldUseMock()) {
    return mockCancelPublicBooking(tenantIdentifier, publicToken);
  }

  try {
    const client = getSharedClient();
    const { data, error } = await client.rpc(RPC_NAMES.CANCEL_BOOKING, {
      p_tenant_identifier: tenantIdentifier,
      p_public_token: publicToken,
    });

    if (error) {
      if (isFunctionNotFoundError(error)) {
        console.warn('[BookingService] RPC not found, falling back to mock:', error.message);
        return mockCancelPublicBooking(tenantIdentifier, publicToken);
      }
      const bookingError = mapPostgresError(error);
      throw bookingError;
    }

    return data as { appointment_id: string; status: 'cancelled'; cancelled_at: string; cancelled: true; idempotent: boolean };
  } catch (err) {
    if (import.meta.env.DEV && isFunctionNotFoundError(err)) {
      console.warn('[BookingService] RPC error, falling back to mock:', err);
      return mockCancelPublicBooking(tenantIdentifier, publicToken);
    }
    throw err;
  }
}

// ============================================================================
// Error mapping from Postgres/Supabase errors to our typed errors
// ============================================================================

function mapPostgresError(error: unknown): PublicBookingError {
  const err = error as Record<string, unknown>;
  const code = (err.code as string) || '';
  const message = (err.message as string) || 'Erro desconhecido';
  const details = (err.details as string) || '';
  const hint = (err.hint as string) || '';

  // Map specific error codes from SPEC
  let errorCode: PublicBookingErrorCode = 'slot_occupied';
  let userMessage = message;

  if (code === '23P01' || message.includes('slot_occupied') || details.includes('slot_occupied')) {
    errorCode = 'slot_occupied';
    userMessage = 'Esse horário acabou de ser reservado. Escolha outro.';
  } else if (message.includes('booking_too_soon') || details.includes('booking_too_soon')) {
    errorCode = 'booking_too_soon';
    userMessage = 'Agendamento muito próximo. Respeite o tempo mínimo de antecedência.';
  } else if (message.includes('booking_too_far') || details.includes('booking_too_far')) {
    errorCode = 'booking_too_far';
    userMessage = 'Agendamento muito distante. Respeite o horizonte máximo de agendamento.';
  } else if (message.includes('invalid_token') || details.includes('invalid_token')) {
    errorCode = 'invalid_token';
    userMessage = 'Token de agendamento inválido.';
  } else if (message.includes('token_expired') || details.includes('token_expired')) {
    errorCode = 'token_expired';
    userMessage = 'Token de agendamento expirado.';
  } else if (message.includes('token_revoked') || details.includes('token_revoked')) {
    errorCode = 'token_revoked';
    userMessage = 'Este token já foi utilizado.';
  } else if (message.includes('cancellation_window_closed') || details.includes('cancellation_window_closed')) {
    errorCode = 'cancellation_window_closed';
    userMessage = 'Janela de cancelamento encerrada. Não é mais possível cancelar.';
  } else if (code === 'ERR_SLOT_UNAVAILABLE' || message.includes('ERR_SLOT_UNAVAILABLE')) {
    errorCode = 'ERR_SLOT_UNAVAILABLE';
    userMessage = 'Esse horário não está mais disponível.';
  }

  const bookingError = new Error(userMessage) as PublicBookingError;
  bookingError.code = errorCode;
  return bookingError;
}

// ============================================================================
// Utility: Check if we're currently using mock mode
// ============================================================================

export function isUsingMock(): boolean {
  return shouldUseMock();
}