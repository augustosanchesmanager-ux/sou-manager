/**
 * Main hook orchestrating the public booking flow state and service calls.
 * Manages the 5-step progressive flow: services → staff → datetime → client → success
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPublicTenantProfile,
  getPublicAvailableSlots,
  createPublicBooking,
  isUsingMock,
} from './bookingService';
import type {
  PublicTenantProfile,
  PublicService,
  PublicStaff,
  PublicSlot,
  PublicAvailableSlotsResponse,
  CreatePublicBookingResult,
  CreatePublicBookingRequest,
  PublicBookingError,
  PublicBookingErrorCode,
  BookingStep,
  BookingState,
  TimePeriodGroup,
} from './types';
import { STEP_LABELS } from './types';

// ============================================================================
// Constants
// ============================================================================

const STEPS: BookingStep[] = ['services', 'staff', 'datetime', 'client', 'success'];

const INITIAL_STATE: Omit<BookingState, 'tenantProfile' | 'idempotencyKey' | 'slotsResponse'> = {
  selectedServiceIds: [],
  selectedStaffId: null,
  selectedDate: null,
  selectedSlot: null,
  clientName: '',
  clientPhone: '',
  clientPhoneDisplay: '',
  clientNotes: '',
  bookingResult: null,
  currentStep: 'services',
  isLoading: false,
  error: null,
};

const ANY_STAFF_ID = 'any'; // Special ID for "Qualquer Profissional Disponível"

// ============================================================================
// Helper functions
// ============================================================================

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

function formatPhoneForDisplay(phoneE164: string): string {
  // Convert +5511999999999 -> (11) 99999-9999
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('55')) {
    // +55 (11) 99999-9999
    const ddd = digits.slice(2, 4);
    const part1 = digits.slice(4, 9);
    const part2 = digits.slice(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (digits.length === 11) {
    // (11) 99999-9999
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 7);
    const part2 = digits.slice(7, 11);
    return `(${ddd}) ${part1}-${part2}`;
  }
  if (digits.length === 10) {
    // (11) 9999-9999
    const ddd = digits.slice(0, 2);
    const part1 = digits.slice(2, 6);
    const part2 = digits.slice(6, 10);
    return `(${ddd}) ${part1}-${part2}`;
  }
  return phoneE164;
}

function parsePhoneToE164(phoneDisplay: string): string {
  // Convert (11) 99999-9999 -> +5511999999999
  const digits = phoneDisplay.replace(/\D/g, '');
  if (digits.length === 11) {
    return `+55${digits}`;
  }
  if (digits.length === 10) {
    return `+55${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  return `+55${digits}`;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

function formatPriceBRL(price: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
}

function formatDateForDisplay(dateStr: string): { dayLabel: string; weekday: string; day: string } {
  const date = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let dayLabel = '';
  if (date.getTime() === today.getTime()) {
    dayLabel = 'Hoje';
  } else if (date.getTime() === tomorrow.getTime()) {
    dayLabel = 'Amanhã';
  }

  const weekday = date.toLocaleDateString('pt-BR', { weekday: 'short' });
  const day = date.getDate().toString().padStart(2, '0');

  return { dayLabel, weekday, day };
}

function groupSlotsByPeriod(slots: PublicSlot[]): TimePeriodGroup[] {
  const periods: TimePeriodGroup[] = [
    { label: 'Manhã', slots: [], startHour: 0, endHour: 12 },
    { label: 'Tarde', slots: [], startHour: 12, endHour: 18 },
    { label: 'Noite', slots: [], startHour: 18, endHour: 24 },
  ];

  for (const slot of slots) {
    const hour = Number(slot.start_time.slice(11, 13));
    for (const period of periods) {
      if (hour >= period.startHour && hour < period.endHour) {
        period.slots.push(slot);
        break;
      }
    }
  }

  // Sort slots within each period by time
  for (const period of periods) {
    period.slots.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  return periods;
}

function getNextStep(currentStep: BookingStep): BookingStep | null {
  const index = STEPS.indexOf(currentStep);
  if (index < STEPS.length - 1) {
    return STEPS[index + 1];
  }
  return null;
}

function getPrevStep(currentStep: BookingStep): BookingStep | null {
  const index = STEPS.indexOf(currentStep);
  if (index > 0) {
    return STEPS[index - 1];
  }
  return null;
}

function canAdvanceFromStep(step: BookingStep, state: BookingState): boolean {
  switch (step) {
    case 'services':
      return state.selectedServiceIds.length > 0;
    case 'staff':
      return state.selectedStaffId !== null;
    case 'datetime':
      return state.selectedSlot !== null;
    case 'client':
      return state.clientName.trim().length >= 3 && state.clientPhone.replace(/\D/g, '').length >= 10;
    case 'success':
      return false;
    default:
      return false;
  }
}

// ============================================================================
// Extended State with slotsResponse
// ============================================================================

interface ExtendedBookingState extends BookingState {
  slotsResponse: PublicAvailableSlotsResponse | null;
}

// ============================================================================
// Main Hook
// ============================================================================

export function usePublicBooking() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [state, setState] = useState<ExtendedBookingState>({
    ...INITIAL_STATE,
    tenantProfile: null,
    idempotencyKey: generateIdempotencyKey(),
    slotsResponse: null,
  });

  const requestIdRef = useRef(0); // For stale-guard on async requests
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================================================
  // Step 0: Load Tenant Profile
  // ============================================================================

  useEffect(() => {
    if (!tenantSlug) return;

    let cancelled = false;

    const loadProfile = async () => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));
      try {
        const profile = await getPublicTenantProfile(tenantSlug);
        if (!cancelled && isMountedRef.current) {
          if (profile) {
            setState((prev) => ({
              ...prev,
              tenantProfile: profile,
              isLoading: false,
            }));
            // Set document title
            document.title = `${profile.name} · Agendar`;
          } else {
            setState((prev) => ({
              ...prev,
              tenantProfile: null,
              isLoading: false,
              error: {
                code: 'slot_occupied',
                message: 'Não encontramos essa barbearia',
              } as PublicBookingError,
            }));
          }
        }
      } catch (err) {
        if (!cancelled && isMountedRef.current) {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: err as PublicBookingError,
          }));
        }
      }
    };

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug]);

  // ============================================================================
  // Step 3: Load Slots when date/staff/services change
  // ============================================================================

  const loadSlots = useCallback(async () => {
    const { tenantProfile, selectedDate, selectedStaffId, selectedServiceIds } = state;
    if (!tenantProfile || !selectedDate || selectedServiceIds.length === 0) {
      setState((prev) => ({ ...prev, slotsResponse: null }));
      return;
    }

    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const staffId = selectedStaffId === ANY_STAFF_ID ? null : selectedStaffId;
      const response = await getPublicAvailableSlots(
        tenantProfile.slug,
        staffId,
        selectedServiceIds,
        selectedDate
      );

      // Stale-guard: only update if this is the latest request
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: false, slotsResponse: response }));
      }
    } catch (err) {
      if (requestId === requestIdRef.current && isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err as PublicBookingError,
          slotsResponse: null,
        }));
      }
    }
  }, [state.tenantProfile, state.selectedDate, state.selectedStaffId, state.selectedServiceIds]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  // ============================================================================
  // Actions
  // ============================================================================

  const toggleService = useCallback((serviceId: string) => {
    setState((prev) => {
      const isSelected = prev.selectedServiceIds.includes(serviceId);
      const newServiceIds = isSelected
        ? prev.selectedServiceIds.filter((id) => id !== serviceId)
        : [...prev.selectedServiceIds, serviceId];

      // Reset downstream steps when services change
      return {
        ...prev,
        selectedServiceIds: newServiceIds,
        selectedStaffId: null,
        selectedDate: null,
        selectedSlot: null,
        slotsResponse: null,
      };
    });
  }, []);

  const selectStaff = useCallback((staffId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedStaffId: staffId,
      selectedDate: null,
      selectedSlot: null,
      slotsResponse: null,
    }));
  }, []);

  const selectDate = useCallback((date: string) => {
    setState((prev) => ({
      ...prev,
      selectedDate: date,
      selectedSlot: null,
      slotsResponse: null,
    }));
  }, []);

  const selectSlot = useCallback((slot: PublicSlot) => {
    setState((prev) => ({
      ...prev,
      selectedSlot: slot,
    }));
  }, []);

  const setClientName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, clientName: name }));
  }, []);

  const setClientPhone = useCallback((phoneDisplay: string) => {
    const phoneE164 = parsePhoneToE164(phoneDisplay);
    setState((prev) => ({
      ...prev,
      clientPhoneDisplay: phoneDisplay,
      clientPhone: phoneE164,
    }));
  }, []);

  const setClientNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, clientNotes: notes }));
  }, []);

  const goToNextStep = useCallback(() => {
    setState((prev) => {
      if (!canAdvanceFromStep(prev.currentStep, prev)) return prev;

      const nextStep = getNextStep(prev.currentStep);
      if (!nextStep) return prev;

      return { ...prev, currentStep: nextStep, error: null };
    });
  }, []);

  const goToPrevStep = useCallback(() => {
    setState((prev) => {
      const prevStep = getPrevStep(prev.currentStep);
      if (!prevStep) return prev;
      return { ...prev, currentStep: prevStep, error: null };
    });
  }, []);

  const goToStep = useCallback((step: BookingStep) => {
    setState((prev) => {
      // Only allow going back, not skipping forward
      const currentIndex = STEPS.indexOf(prev.currentStep);
      const targetIndex = STEPS.indexOf(step);
      if (targetIndex > currentIndex) return prev;
      return { ...prev, currentStep: step, error: null };
    });
  }, []);

  const submitBooking = useCallback(async () => {
    const { tenantProfile, selectedServiceIds, selectedStaffId, selectedSlot, clientName, clientPhone, clientNotes, idempotencyKey } = state;

    if (!tenantProfile || !selectedSlot || selectedServiceIds.length === 0 || !selectedStaffId) {
      return;
    }

    if (clientName.trim().length < 3) {
      setState((prev) => ({
        ...prev,
        error: { code: 'slot_occupied', message: 'Nome deve ter pelo menos 3 caracteres' } as PublicBookingError,
      }));
      return;
    }

    if (clientPhone.replace(/\D/g, '').length < 10) {
      setState((prev) => ({
        ...prev,
        error: { code: 'slot_occupied', message: 'WhatsApp inválido' } as PublicBookingError,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const staffId = selectedStaffId === ANY_STAFF_ID ? selectedSlot.staff_id : selectedStaffId;

      const request: CreatePublicBookingRequest = {
        tenant_identifier: tenantProfile.slug,
        staff_id: staffId,
        service_ids: selectedServiceIds,
        start_time: selectedSlot.start_time,
        client_name: clientName.trim(),
        client_phone: clientPhone,
        client_notes: clientNotes.trim() || null,
        idempotency_key: idempotencyKey,
      };

      const result = await createPublicBooking(request);

      if (isMountedRef.current) {
        setState((prev) => ({
          ...prev,
          bookingResult: result,
          currentStep: 'success',
          isLoading: false,
          // Generate new idempotency key for next booking (only after success)
          idempotencyKey: generateIdempotencyKey(),
        }));
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const bookingError = err as PublicBookingError;

      // Handle slot_occupied: go back to datetime step, preserve client data
      if (bookingError.code === 'slot_occupied' || bookingError.code === 'ERR_SLOT_UNAVAILABLE') {
        setState((prev) => ({
          ...prev,
          currentStep: 'datetime',
          selectedSlot: null, // Force re-selection
          isLoading: false,
          error: bookingError,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: bookingError,
        }));
      }
    }
  }, [state]);

  const startNewBooking = useCallback(() => {
    setState({
      ...INITIAL_STATE,
      tenantProfile: state.tenantProfile,
      idempotencyKey: generateIdempotencyKey(),
      slotsResponse: null,
    });
  }, [state.tenantProfile]);

  const dismissError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // ============================================================================
  // Computed values
  // ============================================================================

  const availableServices = state.tenantProfile?.services.filter((s) => s.active) || [];
  const availableStaff = state.tenantProfile?.staff.filter((s) => s.status === 'active') || [];

  const selectedServices = availableServices.filter((s) => state.selectedServiceIds.includes(s.id));
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + s.price, 0);

  const selectedStaff = state.selectedStaffId
    ? availableStaff.find((s) => s.id === state.selectedStaffId) || null
    : null;

  const groupedSlots = state.slotsResponse
    ? groupSlotsByPeriod(state.slotsResponse.slots)
    : [];

  // ============================================================================
  // Return API
  // ============================================================================

  return {
    // State
    tenantSlug: tenantSlug || '',
    tenantProfile: state.tenantProfile,
    currentStep: state.currentStep,
    isLoading: state.isLoading,
    error: state.error,
    isUsingMock: isUsingMock(),

    // Step 1: Services
    availableServices,
    selectedServiceIds: state.selectedServiceIds,
    toggleService,

    // Step 2: Staff
    availableStaff,
    selectedStaffId: state.selectedStaffId,
    selectStaff,
    ANY_STAFF_ID,

    // Step 3: DateTime
    selectedDate: state.selectedDate,
    selectDate,
    selectedSlot: state.selectedSlot,
    selectSlot,
    slotsResponse: state.slotsResponse,
    groupedSlots,

    // Step 4: Client Form
    clientName: state.clientName,
    setClientName,
    clientPhoneDisplay: state.clientPhoneDisplay,
    setClientPhone,
    clientNotes: state.clientNotes,
    setClientNotes,

    // Step 5: Success
    bookingResult: state.bookingResult,

    // Summary
    selectedServices,
    totalDuration,
    totalPrice,
    formatDuration,
    formatPriceBRL,
    formatDateForDisplay,
    formatPhoneForDisplay,

    // Navigation
    canAdvance: canAdvanceFromStep(state.currentStep, state),
    goToNextStep,
    goToPrevStep,
    goToStep,
    submitBooking,
    startNewBooking,
    dismissError,

    // Step labels
    stepLabel: STEP_LABELS[state.currentStep],
    stepIndex: STEPS.indexOf(state.currentStep),
    totalSteps: STEPS.length - 1, // Exclude success step
  };
}