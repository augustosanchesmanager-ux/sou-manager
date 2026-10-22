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
import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Toast } from './Toast';
import type { PublicSlot, PublicService } from './hooks/types';

const PublicBookingPage: React.FC = () => {
  const {
    tenantProfile,
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

  // Standalone Lead Capture Modal state (for editing identity directly from bar)
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

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
    },
    [setClientName, setClientPhone]
  );

  // Launch guided 3-phase booking flow starting from service specification
  const handleOpenServiceModal = useCallback(
    (service: PublicService) => {
      setSelectedServiceForModal(service);

      // Ensure this service is selected in hook
      if (!selectedServiceIds.includes(service.id)) {
        // Clear previous selections to focus on this single booking
        for (const id of selectedServiceIds) {
          toggleService(id);
        }
        toggleService(service.id);
      }

      // Default staff to ANY_STAFF_ID if none selected
      if (!selectedStaffId) {
        selectStaff(ANY_STAFF_ID);
      }

      // Default date to today if none selected
      if (!selectedDate && dateOptions.length > 0) {
        selectDate(dateOptions[0].value);
      }

      setIsSpecModalOpen(true);
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
    ]
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

  // Return to Phase 1 from Phase 2
  const handleBackToSpec = useCallback(() => {
    setIsStaffModalOpen(false);
    setIsSpecModalOpen(true);
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

  return (
    <div className="min-h-screen bg-neutral-950 flex items-start sm:items-center justify-center p-0 sm:p-4 font-sans text-white">
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
            <main className="p-4 sm:p-5 flex-1 bg-neutral-900">
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
                        <Scissors className="w-4 h-4 text-amber-400" />
                        Serviços Disponíveis
                      </h2>
                      <p className="text-[11px] text-neutral-400">
                        Toque no serviço para ver detalhes e iniciar o agendamento
                      </p>
                    </div>
                    <span className="text-xs font-bold text-amber-400">
                      {availableServices.length} {availableServices.length === 1 ? 'item' : 'itens'}
                    </span>
                  </div>

                  {/* Services Vitrine */}
                  <div className="space-y-2.5">
                    {availableServices.length === 0 ? (
                      <div className="p-8 text-center bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
                        <Scissors className="w-8 h-8 text-neutral-600 mx-auto" />
                        <p className="text-xs text-neutral-400">Nenhum serviço disponível no momento.</p>
                      </div>
                    ) : (
                      availableServices.map((service) => {
                        const isSelected = selectedServiceIds.includes(service.id);

                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleOpenServiceModal(service)}
                            className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500/40 shadow-md'
                                : 'bg-neutral-950 border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-950/80'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Service Icon / Photo */}
                              <div className="size-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden text-amber-400">
                                {service.image_url ? (
                                  <img
                                    src={service.image_url}
                                    alt={service.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Scissors className="w-5 h-5 text-amber-400" />
                                )}
                              </div>

                              {/* Service Info */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-sm text-white truncate">{service.name}</h3>
                                  {service.category && (
                                    <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.2 rounded-full bg-neutral-800 text-amber-400">
                                      {service.category}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-xs">
                                  <span className="flex items-center gap-1 text-neutral-300 font-medium">
                                    <Clock size={12} className="text-amber-400" />
                                    {service.duration} min
                                  </span>
                                  <span className="text-neutral-600">•</span>
                                  <span className="text-amber-400 font-extrabold tabular-nums">
                                    {formatPriceBRL(service.price)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Action Button Indicator */}
                            <span
                              className={`flex-shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                                isSelected
                                  ? 'bg-amber-500 text-neutral-950 hover:bg-amber-400'
                                  : 'bg-neutral-800 border border-neutral-700 text-white hover:border-amber-500 hover:text-amber-400'
                              }`}
                            >
                              <span>{isSelected ? 'Configurar' : 'Agendar'}</span>
                              <ChevronRight size={13} />
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>

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
            </main>
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
        selectedSlot={selectedSlot}
        onSelectSlot={selectSlot}
        isLoadingSlots={isLoading}
        serviceName={selectedServiceForModal?.name || 'Serviço Selecionado'}
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
    </div>
  );
};

export default PublicBookingPage;
