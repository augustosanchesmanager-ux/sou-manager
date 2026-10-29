/**
 * PublicBookingPage - Luxury mobile-first booking experience for SMG Barber.
 * Preserves 100% integration with usePublicBooking() hook and ADR-032 RPC engine.
 * Features:
 * - High-contrast dark luxury visual design (pure white titles, amber accents, crisp neutrals)
 * - Hero Cover Header with background banner, overlapping avatar, address and direct WhatsApp/Instagram links
 * - Guided 3-Phase Modal Booking Flow:
 *     Phase 1: Service Specification + Early Lead Capture (Name + WhatsApp)
 *     Phase 2: Staff Selection ('Any Staff Available' + active barbers)
 *     Phase 3: Date & Time Slot Picker + Summary + Booking confirmation
 * - Structured WhatsApp dispatch with official voucher display on completion
 */

import type React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Clock,
  Sparkles,
  AlertCircle,
  Edit2,
  Loader2,
  ChevronRight,
  Scissors,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { usePublicBooking } from './hooks/usePublicBooking';
import BookingHeader, {
  type BookingNavigationTab,
  buildSafeInstagramUrl,
  buildSafeWhatsAppUrl,
  buildSafeHttpsUrl,
} from './BookingHeader';
import { LeadCaptureModal } from './LeadCaptureModal';
import { ServicesCatalogTab } from './ServicesCatalogTab';
import { AboutUsTab } from './AboutUsTab';
import BookingSuccessVoucher, {
  buildStructuredWhatsAppConfirmationUrl,
} from './BookingSuccessVoucher';
import { ServiceSpecificationModal } from './modals/ServiceSpecificationModal';
import { StaffSelectionModal } from './modals/StaffSelectionModal';
import { DateTimeBookingModal } from './modals/DateTimeBookingModal';
import { PublicBookingCancelModal } from './modals/PublicBookingCancelModal';
import { ServicesGridSelector } from './components/ServicesGridSelector';
import { PublicProductsShowcase } from './components/PublicProductsShowcase';
import { BookingStickyBottomBar } from './components/BookingStickyBottomBar';
import { BookingUpsellBottomSheet } from './components/BookingUpsellBottomSheet';
import { getSuggestedUpsellServices } from './utils/upsellRecommendation';
import {
  ActiveBookingBanner,
  saveActiveBooking,
  clearActiveBooking,
  getSavedActiveBooking,
  type SavedClientBooking,
} from './components/ActiveBookingBanner';
import { Toast } from './Toast';
import type { PublicSlot, PublicService } from './hooks/types';

const PublicBookingPage: React.FC = () => {
  const {
    tenantProfile,
    showcaseProducts,
    currentStep,
    isLoading,
    error,
    isUsingMock,

    // Step 1: Services
    availableServices,
    selectedServiceIds,
    toggleService,

    // Step 2: Staff
    availableStaff,
    selectedStaffId,
    selectStaff,
    ANY_STAFF_ID,

    // Step 3: DateTime
    selectedDate,
    selectDate,
    selectedSlot,
    selectSlot,
    groupedSlots,

    // Step 4: Client
    clientName,
    setClientName,
    clientPhoneDisplay,
    setClientPhone,

    // Step 5: Success
    bookingResult,

    // Summary calculations
    selectedServices,
    totalDuration,
    totalPrice,
    formatDuration,
    formatPriceBRL,
    formatDateForDisplay,

    // Actions
    submitBooking,
    startNewBooking,
    dismissError,
  } = usePublicBooking();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<BookingNavigationTab>('agendamento');

  // Guided 3-Phase Modals State
  const [selectedServiceForModal, setSelectedServiceForModal] = useState<PublicService | null>(null);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState(false);

  // Upsell Bottom Sheet State
  const [isUpsellSheetOpen, setIsUpsellSheetOpen] = useState(false);
  const [hasShownUpsell, setHasShownUpsell] = useState(false);

  // Standalone Lead Capture Modal state (for editing identity directly from bar)
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);
  const pendingAdvanceToStaffRef = useRef(false);

  // Cancellation Modal State & Query Param ?token= handling
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelModalToken, setCancelModalToken] = useState('');
  const [cancelModalDetails, setCancelModalDetails] = useState<{
    appointmentId?: string;
    staffName?: string;
    servicesNames?: string;
    formattedDateTime?: string;
  } | null>(null);

  // Check URL query param for ?token= on mount or param change
  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (tokenParam) {
      setCancelModalToken(tokenParam);
      if (tenantProfile?.slug) {
        const saved = getSavedActiveBooking(tenantProfile.slug);
        if (saved && saved.publicToken === tokenParam) {
          setCancelModalDetails({
            appointmentId: saved.appointmentId,
            staffName: saved.staffName,
            servicesNames: saved.servicesNames,
            formattedDateTime: saved.formattedDateTime,
          });
        }
      }
      setIsCancelModalOpen(true);
    }
  }, [searchParams, tenantProfile?.slug]);

  // Safely close cancel modal without breaking the tenant vitrine
  const handleCloseCancelModal = useCallback(() => {
    setIsCancelModalOpen(false);
    setCancelModalToken('');
    setCancelModalDetails(null);
    if (searchParams.has('token')) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('token');
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // On successful cancellation: clean storage and clear state
  const handleCancellationSuccess = useCallback(() => {
    clearActiveBooking();
  }, []);

  // Restore client lead data from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('smg_client_lead');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.name && !clientName) {
          setClientName(parsed.name);
        }
        if (parsed.phone && !clientPhoneDisplay) {
          setClientPhone(parsed.phone);
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }, [clientName, clientPhoneDisplay, setClientName, setClientPhone]);

  // Derived client identification status
  const phoneDigits = clientPhoneDisplay.replace(/\D/g, '');
  const isClientIdentified = clientName.trim().length >= 3 && phoneDigits.length >= 11;

  // Sanitized URLs
  const instagramUrl = useMemo(() => {
    return buildSafeInstagramUrl(tenantProfile?.instagram_url || tenantProfile?.social_links?.instagram);
  }, [tenantProfile]);

  const whatsappUrl = useMemo(() => {
    return buildSafeWhatsAppUrl(
      tenantProfile?.whatsapp_number || tenantProfile?.social_links?.whatsapp || tenantProfile?.phone
    );
  }, [tenantProfile]);

  const mapsUrl = useMemo(() => {
    const explicit = buildSafeHttpsUrl(tenantProfile?.maps_url || tenantProfile?.social_links?.maps_url);
    if (explicit) return explicit;
    if (tenantProfile?.address) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenantProfile.address)}`;
    }
    return null;
  }, [tenantProfile]);

  // Generate date options based on tenant's booking horizon
  const dateOptions = useMemo(() => {
    const horizon = tenantProfile?.booking_rules?.horizon_days || 14;
    const list: Array<{ value: string; weekday: string; dayNumber: string; dayLabel: string }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= horizon; i++) {
      const current = new Date(today);
      current.setDate(today.getDate() + i);

      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const value = `${y}-${m}-${d}`;

      let dayLabel = '';
      if (i === 0) dayLabel = 'Hoje';
      else if (i === 1) dayLabel = 'Amanhã';

      const weekday = current.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
      const dayNumber = d;

      list.push({ value, weekday, dayNumber, dayLabel });
    }
    return list;
  }, [tenantProfile]);

  // Format slot time for display
  const formatSlotTime = useCallback(
    (isoString: string): string => {
      const date = new Date(isoString);
      const timezone = tenantProfile?.booking_rules?.timezone || 'America/Sao_Paulo';
      return date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
      });
    },
    [tenantProfile]
  );

  // Flattened available slots for active date
  const availableSlotsList = useMemo(() => {
    const list: PublicSlot[] = [];
    groupedSlots.forEach((group) => {
      list.push(...group.slots);
    });
    return list;
  }, [groupedSlots]);

  // Handle lead saved from LeadCaptureModal or ServiceSpecificationModal
  const handleLeadSaved = useCallback(
    (name: string, phone: string) => {
      setClientName(name);
      setClientPhone(phone);
      try {
        localStorage.setItem('smg_client_lead', JSON.stringify({ name, phone }));
      } catch {
        // Ignore storage errors
      }
      setIsLeadModalOpen(false);

      if (pendingAdvanceToStaffRef.current) {
        pendingAdvanceToStaffRef.current = false;
        setIsStaffModalOpen(true);
      }
    },
    [setClientName, setClientPhone]
  );

  // Handle toggling services in 2-column grid with multiple selection
  const handleToggleService = useCallback(
    (service: PublicService) => {
      const isCurrentlySelected = selectedServiceIds.includes(service.id);
      toggleService(service.id);
      setSelectedServiceForModal(service);

      // Default staff and date if not set
      if (!selectedStaffId) {
        selectStaff(ANY_STAFF_ID);
      }
      if (!selectedDate && dateOptions.length > 0) {
        selectDate(dateOptions[0].value);
      }

      // First click lead capture if client is not yet identified
      if (!isCurrentlySelected && !isClientIdentified) {
        setIsLeadModalOpen(true);
      }
    },
    [
      selectedServiceIds,
      toggleService,
      selectedStaffId,
      selectStaff,
      ANY_STAFF_ID,
      selectedDate,
      dateOptions,
      selectDate,
      isClientIdentified,
    ]
  );

  // Suggested complementary upsell services
  const suggestedUpsellServices = useMemo(() => {
    return getSuggestedUpsellServices(availableServices, selectedServiceIds);
  }, [availableServices, selectedServiceIds]);

  // Proceed directly to Phase 2 (Staff Selection) or Lead Capture
  const proceedToStaffOrLead = useCallback(() => {
    if (!selectedStaffId) {
      selectStaff(ANY_STAFF_ID);
    }
    if (!selectedDate && dateOptions.length > 0) {
      selectDate(dateOptions[0].value);
    }

    if (!isClientIdentified) {
      pendingAdvanceToStaffRef.current = true;
      setIsLeadModalOpen(true);
      return;
    }

    setIsStaffModalOpen(true);
  }, [
    selectedStaffId,
    selectStaff,
    ANY_STAFF_ID,
    selectedDate,
    dateOptions,
    selectDate,
    isClientIdentified,
  ]);

  // Handle CTA "Continuar" from Sticky Bottom Bar
  const handleContinueFromBottomBar = useCallback(() => {
    if (selectedServiceIds.length === 0) return;

    // Se houver serviços complementares e o upsell ainda não foi exibido nesta sessão
    if (!hasShownUpsell && suggestedUpsellServices.length > 0) {
      setHasShownUpsell(true);
      setIsUpsellSheetOpen(true);
      return;
    }

    proceedToStaffOrLead();
  }, [
    selectedServiceIds.length,
    hasShownUpsell,
    suggestedUpsellServices.length,
    proceedToStaffOrLead,
  ]);

  // Adicionar serviço sugerido via Upsell Bottom Sheet
  const handleAddUpsellService = useCallback(
    (service: PublicService) => {
      toggleService(service.id);
      setIsUpsellSheetOpen(false);
      proceedToStaffOrLead();
    },
    [toggleService, proceedToStaffOrLead]
  );

  // Continuar sem adicionar serviço sugerido no Upsell
  const handleContinueWithoutUpsell = useCallback(() => {
    setIsUpsellSheetOpen(false);
    proceedToStaffOrLead();
  }, [proceedToStaffOrLead]);

  // Launch guided 3-phase booking flow starting from service specification
  const handleOpenServiceModal = useCallback(
    (service: PublicService) => {
      handleToggleService(service);
    },
    [handleToggleService]
  );

  // Advance Phase 1 (Service Spec) -> Phase 2 (Staff Selection)
  const handleProceedToStaff = useCallback(() => {
    setIsSpecModalOpen(false);
    setIsStaffModalOpen(true);
  }, []);

  // Advance Phase 2 (Staff Selection) -> Phase 3 (Date/Time Slot)
  const handleSelectStaff = useCallback(
    (staffId: string) => {
      selectStaff(staffId);
      setIsStaffModalOpen(false);
      setIsDateTimeModalOpen(true);
    },
    [selectStaff]
  );

  // Return from Phase 2 (Staff Selection) back to services grid
  const handleBackToSpec = useCallback(() => {
    setIsStaffModalOpen(false);
  }, []);

  // Return to Phase 2 from Phase 3
  const handleBackToStaff = useCallback(() => {
    setIsDateTimeModalOpen(false);
    setIsStaffModalOpen(true);
  }, []);

  // Final booking submission with automatic WhatsApp dispatch
  const handleConfirmBooking = useCallback(async () => {
    if (!tenantProfile || !selectedSlot || selectedServiceIds.length === 0 || !selectedStaffId) {
      return;
    }

    setIsSubmittingBooking(true);

    try {
      const result = await submitBooking();

      if (result) {
        // Close Phase 3 modal
        setIsDateTimeModalOpen(false);

        // Build structured confirmation message
        const dateStr = result.start_time.split('T')[0];
        const dateDisplay = formatDateForDisplay(dateStr);
        const formattedDate = dateDisplay.dayLabel
          ? `${dateDisplay.dayLabel} (${dateDisplay.weekday}, ${dateDisplay.day})`
          : `${dateDisplay.weekday}, ${dateDisplay.day}`;

        const startDate = new Date(result.start_time);
        const timezone = tenantProfile.booking_rules?.timezone || 'America/Sao_Paulo';
        const timeStr = startDate.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: timezone,
        });

        // Save active booking for client reminder banner & quick management
        if (result.public_token) {
          const servicesNames = result.services.map((s) => s.name).join(', ');
          saveActiveBooking({
            tenantSlug: tenantProfile.slug,
            appointmentId: result.appointment_id,
            publicToken: result.public_token,
            servicesNames,
            staffName: result.staff.name,
            startTime: result.start_time,
            formattedDateTime: `${formattedDate} às ${timeStr}`,
          });
        }

        const targetWhatsAppUrl = buildStructuredWhatsAppConfirmationUrl(
          tenantProfile,
          result,
          clientName,
          formattedDate,
          timeStr
        );

        // Open WhatsApp directly in new window/tab
        try {
          window.open(targetWhatsAppUrl, '_blank');
        } catch {
          // If popup is blocked, the user can click the button in BookingSuccessVoucher
        }
      }
    } finally {
      setIsSubmittingBooking(false);
    }
  }, [
    tenantProfile,
    selectedSlot,
    selectedServiceIds.length,
    selectedStaffId,
    submitBooking,
    formatDateForDisplay,
    clientName,
  ]);

  // Aggregated service name display for Phase 3 summary
  const serviceNameDisplay = useMemo(() => {
    if (selectedServices.length === 0) {
      return selectedServiceForModal?.name || 'Serviço Selecionado';
    }
    if (selectedServices.length === 1) {
      return selectedServices[0].name;
    }
    if (selectedServices.length === 2) {
      return `${selectedServices[0].name} + ${selectedServices[1].name}`;
    }
    return `${selectedServices[0].name} (+${selectedServices.length - 1} serviços)`;
  }, [selectedServices, selectedServiceForModal]);

  // Active staff name display for Phase 3 summary
  const selectedStaffName = useMemo(() => {
    if (selectedStaffId === ANY_STAFF_ID) {
      return 'Qualquer Profissional (1º livre)';
    }
    const staff = availableStaff.find((s) => s.id === selectedStaffId);
    return staff?.name || 'Qualquer Profissional';
  }, [selectedStaffId, ANY_STAFF_ID, availableStaff]);

  // Loading state
  if (isLoading && !tenantProfile) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-neutral-400 font-medium">Carregando barbearia...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!tenantProfile) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 text-white">
        <div className="text-center max-w-sm space-y-4">
          <div className="size-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mx-auto text-neutral-400">
            <AlertCircle className="size-8 text-amber-500" />
          </div>
          <h1 className="font-display font-black text-xl text-white">Barbearia não encontrada</h1>
          <p className="text-xs text-neutral-400">
            Verifique o link informado ou entre em contato direto com o estabelecimento.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer shadow-lg shadow-amber-500/20"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = tenantProfile.primary_color || '#B88A44';
  const isLightMode = tenantProfile.theme_mode === 'light';

  return (
    <div
      className={`min-h-screen ${
        isLightMode ? 'bg-neutral-100' : 'bg-neutral-950'
      } flex items-start sm:items-center justify-center p-0 sm:p-4 font-sans text-white`}
      style={{ '--brand-primary': primaryColor } as React.CSSProperties}
      data-theme-mode={tenantProfile.theme_mode || 'dark'}
    >
      {/* Container Mobile Card */}
      <div className="w-full max-w-sm sm:max-w-md bg-neutral-900 text-white rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-0 sm:border border-neutral-800 flex flex-col min-h-screen sm:min-h-0 sm:my-6">
        {/* Error Toast notification */}
        {error && (
          <div className="fixed top-4 left-4 right-4 z-50 px-4 pointer-events-none">
            <div className="max-w-sm mx-auto pointer-events-auto">
              <Toast
                message={error.message}
                variant="error"
                onClose={dismissError}
                autoCloseMs={5000}
              />
            </div>
          </div>
        )}

        {/* Demo Mode Badge */}
        {isUsingMock && (
          <div className="bg-amber-950/80 border-b border-amber-800/60 px-3 py-1.5 text-center">
            <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
              Ambiente de Demonstração (Mock Ativo)
            </span>
          </div>
        )}

        {/* Success step overrides normal tabs with voucher */}
        {currentStep === 'success' && bookingResult ? (
          <BookingSuccessVoucher
            result={bookingResult}
            tenant={tenantProfile}
            clientName={clientName}
            clientPhone={clientPhoneDisplay}
            onNewBooking={startNewBooking}
            onCancelBooking={() => {
              if (bookingResult.public_token) {
                const dateStr = bookingResult.start_time.split('T')[0];
                const dateDisplay = formatDateForDisplay(dateStr);
                const startDate = new Date(bookingResult.start_time);
                const timezone = tenantProfile.booking_rules?.timezone || 'America/Sao_Paulo';
                const timeStr = startDate.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                  timeZone: timezone,
                });
                const formattedDate = dateDisplay.dayLabel
                  ? `${dateDisplay.dayLabel} (${dateDisplay.weekday}, ${dateDisplay.day}) às ${timeStr}`
                  : `${dateDisplay.weekday}, ${dateDisplay.day} às ${timeStr}`;

                setCancelModalToken(bookingResult.public_token);
                setCancelModalDetails({
                  appointmentId: bookingResult.appointment_id,
                  staffName: bookingResult.staff.name,
                  servicesNames: bookingResult.services.map((s) => s.name).join(', '),
                  formattedDateTime: formattedDate,
                });
                setIsCancelModalOpen(true);
              }
            }}
            formatDuration={formatDuration}
            formatPriceBRL={formatPriceBRL}
            formatDateForDisplay={formatDateForDisplay}
          />
        ) : (
          <>
            {/* Header with shop cover, avatar, rating and navigation tabs */}
            <BookingHeader
              tenant={tenantProfile}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              whatsappUrl={whatsappUrl}
              instagramUrl={instagramUrl}
              mapsUrl={mapsUrl}
            />

            {/* Main Content Area */}
            <main className="p-4 sm:p-5 flex-1 bg-neutral-900 pb-28 sm:pb-32">
              {/* Tab 2: Serviços Catalog */}
              {activeTab === 'servicos' && (
                <ServicesCatalogTab
                  services={availableServices}
                  selectedIds={selectedServiceIds}
                  onSelectService={handleOpenServiceModal}
                  formatPriceBRL={formatPriceBRL}
                />
              )}

              {/* Tab 3: Sobre Nós */}
              {(activeTab === 'sobre' || activeTab === 'contato') && (
                <AboutUsTab
                  tenant={tenantProfile}
                  mapsUrl={mapsUrl}
                  whatsappUrl={whatsappUrl}
                  instagramUrl={instagramUrl}
                />
              )}

              {/* Tab 1: Agendamento Principal (Vitrine de Alto Padrão) */}
              {activeTab === 'agendamento' && (
                <div className="space-y-4">
                  {/* Active Booking Reminder Banner */}
                  {tenantProfile?.slug && (
                    <ActiveBookingBanner
                      tenantSlug={tenantProfile.slug}
                      onOpenManage={(saved) => {
                        setCancelModalToken(saved.publicToken);
                        setCancelModalDetails({
                          appointmentId: saved.appointmentId,
                          staffName: saved.staffName,
                          servicesNames: saved.servicesNames,
                          formattedDateTime: saved.formattedDateTime,
                        });
                        setIsCancelModalOpen(true);
                      }}
                    />
                  )}
                  {/* Client Identification Bar */}
                  {isClientIdentified ? (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-neutral-400">Cliente: </span>
                          <strong className="text-white truncate">{clientName}</strong>
                          <span className="text-neutral-400 ml-1 truncate">({clientPhoneDisplay})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLeadModalOpen(true)}
                        className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1 flex-shrink-0 ml-2 cursor-pointer"
                      >
                        <Edit2 size={11} />
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span className="text-[11px] leading-snug">
                        Selecione um serviço abaixo para escolher o profissional e horário.
                      </span>
                    </div>
                  )}

                  {/* Section Title */}
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Scissors className="w-4 h-4" style={{ color: primaryColor }} />
                        Serviços Disponíveis
                      </h2>
                      <p className="text-[11px] text-neutral-400">
                        Selecione um ou mais serviços para agendar
                      </p>
                    </div>
                    <span
                      className="text-xs font-bold"
                      style={{ color: primaryColor }}
                    >
                      {availableServices.length} {availableServices.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  {/* 2-Column Grid of Services with Multi-selection */}
                  <ServicesGridSelector
                    services={availableServices}
                    selectedServiceIds={selectedServiceIds}
                    onToggleService={handleToggleService}
                    formatPriceBRL={formatPriceBRL}
                  />

                  {/* Vitrine de Produtos Recomendados (Home Care) */}
                  {Boolean(tenantProfile.show_products) && showcaseProducts.length > 0 && (
                    <PublicProductsShowcase
                      products={showcaseProducts}
                      formatPriceBRL={formatPriceBRL}
                      primaryColor={primaryColor}
                    />
                  )}

                  {/* Reassurance Features */}
                  <div className="mt-4 pt-3 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-neutral-950/40">
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                      <span>Sem pagamento antecipado</span>
                    </div>
                    <div className="flex items-center gap-1.5 p-2 rounded-xl bg-neutral-950/40">
                      <Sparkles size={13} className="text-amber-400 flex-shrink-0" />
                      <span>Confirmação no WhatsApp</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Institutional Signature Footer */}
              <footer className="mt-12 pb-6 text-center text-xs text-zinc-500">
                <span>Powered by </span>
                <a
                  href="https://barber.soumanager.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  SMG Intelligence
                </a>
              </footer>
            </main>

            {/* Sticky Bottom Summary Bar */}
            {(activeTab === 'agendamento' || activeTab === 'servicos') && (
              <BookingStickyBottomBar
                selectedCount={selectedServiceIds.length}
                totalPrice={totalPrice}
                totalDuration={totalDuration}
                onContinue={handleContinueFromBottomBar}
                formatDuration={formatDuration}
                formatPriceBRL={formatPriceBRL}
              />
            )}
          </>
        )}
      </div>

      {/* Phase 1 Modal: Service Specification & Lead Capture */}
      <ServiceSpecificationModal
        isOpen={isSpecModalOpen}
        service={selectedServiceForModal}
        clientName={clientName}
        clientPhoneDisplay={clientPhoneDisplay}
        onSaveLead={handleLeadSaved}
        onProceedToStaff={handleProceedToStaff}
        onClose={() => setIsSpecModalOpen(false)}
        formatPriceBRL={formatPriceBRL}
      />

      {/* Upsell / Cross-Sell Bottom Sheet */}
      <BookingUpsellBottomSheet
        isOpen={isUpsellSheetOpen}
        suggestedServices={suggestedUpsellServices}
        onAddService={handleAddUpsellService}
        onContinue={handleContinueWithoutUpsell}
        onClose={() => setIsUpsellSheetOpen(false)}
        formatPriceBRL={formatPriceBRL}
      />

      {/* Phase 2 Modal: Staff Selection */}
      <StaffSelectionModal
        isOpen={isStaffModalOpen}
        staffList={availableStaff}
        selectedStaffId={selectedStaffId}
        anyStaffId={ANY_STAFF_ID}
        onSelectStaff={handleSelectStaff}
        onBack={handleBackToSpec}
        onClose={() => setIsStaffModalOpen(false)}
      />

      {/* Phase 3 Modal: Date & Time Slots Selection + Final Confirmation */}
      <DateTimeBookingModal
        isOpen={isDateTimeModalOpen}
        dateOptions={dateOptions}
        selectedDate={selectedDate}
        onSelectDate={selectDate}
        availableSlots={availableSlotsList}
        groupedSlots={groupedSlots}
        selectedSlot={selectedSlot}
        onSelectSlot={selectSlot}
        isLoadingSlots={isLoading}
        serviceName={serviceNameDisplay}
        staffName={selectedStaffName}
        totalPrice={totalPrice > 0 ? totalPrice : (selectedServiceForModal?.price || 0)}
        totalDuration={totalDuration > 0 ? totalDuration : (selectedServiceForModal?.duration || 30)}
        isSubmitting={isSubmittingBooking}
        onConfirmBooking={handleConfirmBooking}
        onBack={handleBackToStaff}
        onClose={() => setIsDateTimeModalOpen(false)}
        formatPriceBRL={formatPriceBRL}
        formatDuration={formatDuration}
        formatSlotTime={formatSlotTime}
      />

      {/* Direct Lead Edit Modal */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        initialName={clientName}
        initialPhoneDisplay={clientPhoneDisplay}
        onSave={handleLeadSaved}
        onClose={() => setIsLeadModalOpen(false)}
        pendingServiceName={selectedServiceForModal?.name}
      />

      {/* Cancellation & Management Modal */}
      {tenantProfile && (
        <PublicBookingCancelModal
          isOpen={isCancelModalOpen}
          tenantSlug={tenantProfile.slug}
          tenantName={tenantProfile.name}
          publicToken={cancelModalToken}
          bookingDetails={cancelModalDetails}
          whatsappUrl={whatsappUrl}
          cancelWindowMinutes={tenantProfile.booking_rules?.public_cancel_window_minutes ?? 120}
          onSuccess={handleCancellationSuccess}
          onClose={handleCloseCancelModal}
        />
      )}
    </div>
  );
};

export default PublicBookingPage;
