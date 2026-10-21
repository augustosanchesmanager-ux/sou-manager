/**
 * PublicBookingPage - Redesigned mobile-first booking experience for SMG Barber.
 * Preserves 100% integration with usePublicBooking() hook and ADR-032 RPC engine.
 * Includes lead capture on first click (Bottom Sheet) and structured WhatsApp confirmation.
 */

import type React from 'react';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Check,
  Clock,
  Zap,
  Calendar as CalendarIcon,
  AlertCircle,
  Edit2,
  Loader2,
  ChevronRight,
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
import BookingSuccessVoucher, { buildStructuredWhatsAppConfirmationUrl } from './BookingSuccessVoucher';
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

  // Lead capture Bottom Sheet state
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [isSubmittingBooking, setIsSubmittingBooking] = useState(false);

  // Horizontal date carousel ref
  const dateScrollRef = useRef<HTMLDivElement>(null);

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
    return buildSafeWhatsAppUrl(tenantProfile?.whatsapp_number || tenantProfile?.social_links?.whatsapp || tenantProfile?.phone);
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

  // Auto-select "Qualquer Profissional" by default when services are picked if none selected
  useEffect(() => {
    if (selectedServiceIds.length > 0 && selectedStaffId === null) {
      selectStaff(ANY_STAFF_ID);
    }
  }, [selectedServiceIds.length, selectedStaffId, selectStaff, ANY_STAFF_ID]);

  // Auto-select today as default date once staff is selected and no date is set
  useEffect(() => {
    if (selectedStaffId && !selectedDate && dateOptions.length > 0) {
      selectDate(dateOptions[0].value);
    }
  }, [selectedStaffId, selectedDate, dateOptions, selectDate]);

  // Intercept service click for Lead Capture on First Click
  const handleServiceClick = useCallback((serviceId: string) => {
    if (!isClientIdentified) {
      setPendingServiceId(serviceId);
      setIsLeadModalOpen(true);
      return;
    }
    toggleService(serviceId);
  }, [isClientIdentified, toggleService]);

  // Handle lead saved from modal
  const handleLeadSaved = useCallback((name: string, phone: string) => {
    setClientName(name);
    setClientPhone(phone);
    try {
      localStorage.setItem('smg_client_lead', JSON.stringify({ name, phone }));
    } catch {
      // Ignore storage errors
    }
    setIsLeadModalOpen(false);

    if (pendingServiceId) {
      toggleService(pendingServiceId);
      setPendingServiceId(null);
    }
  }, [setClientName, setClientPhone, pendingServiceId, toggleService]);

  // Format slot time for display
  const formatSlotTime = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    const timezone = tenantProfile?.booking_rules?.timezone || 'America/Sao_Paulo';
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    });
  }, [tenantProfile]);

  // Flattened available slots for active date
  const availableSlotsList = useMemo(() => {
    const list: PublicSlot[] = [];
    groupedSlots.forEach((group) => {
      list.push(...group.slots);
    });
    return list;
  }, [groupedSlots]);

  // Final booking submission with automatic WhatsApp dispatch
  const handleConfirmBooking = async () => {
    if (!tenantProfile || !selectedSlot || selectedServiceIds.length === 0 || !selectedStaffId) {
      return;
    }

    if (!isClientIdentified) {
      setIsLeadModalOpen(true);
      return;
    }

    setIsSubmittingBooking(true);

    try {
      const result = await submitBooking();

      if (result) {
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
  };

  // Loading state
  if (isLoading && !tenantProfile) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <Loader2 className="size-8 text-primary animate-spin mx-auto" />
          <p className="text-xs text-ink-soft">Carregando barbearia...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!tenantProfile) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center p-4 text-cream">
        <div className="text-center max-w-sm space-y-4">
          <div className="size-16 rounded-2xl bg-card-dark border border-border-dark flex items-center justify-center mx-auto text-ink-soft">
            <AlertCircle className="size-8" />
          </div>
          <h1 className="font-display font-black text-xl text-cream">Não encontramos essa barbearia</h1>
          <p className="text-xs text-ink-soft">
            Verifique o link informado ou entre em contato direto com o estabelecimento.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-xl bg-primary text-night font-bold text-xs hover:bg-primary-dark transition-colors cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-dark flex items-start sm:items-center justify-center p-0 sm:p-4 font-sans text-cream">
      {/* Container Mobile Card */}
      <div className="w-full max-w-sm sm:max-w-md bg-surface-dark text-cream rounded-none sm:rounded-3xl overflow-hidden shadow-2xl border-0 sm:border border-border-dark flex flex-col min-h-screen sm:min-h-0 sm:my-6">

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
            {/* Header with shop identity and navigation tabs */}
            <BookingHeader
              tenant={tenantProfile}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              whatsappUrl={whatsappUrl}
              instagramUrl={instagramUrl}
              mapsUrl={mapsUrl}
            />

            {/* Main Content Area */}
            <main className="p-4 sm:p-5 flex-1 bg-surface-dark">
              {/* Tab 2: Serviços Catalog */}
              {activeTab === 'servicos' && (
                <ServicesCatalogTab
                  services={availableServices}
                  selectedIds={selectedServiceIds}
                  onSelectService={(service: PublicService) => {
                    handleServiceClick(service.id);
                    setActiveTab('agendamento');
                  }}
                  formatPriceBRL={formatPriceBRL}
                />
              )}

              {/* Tab 3: Sobre Nós */}
              {activeTab === 'sobre' && (
                <AboutUsTab
                  tenant={tenantProfile}
                  mapsUrl={mapsUrl}
                  whatsappUrl={whatsappUrl}
                  instagramUrl={instagramUrl}
                />
              )}

              {/* Tab 4: Contato (Fallback if not opened via direct link) */}
              {activeTab === 'contato' && (
                <AboutUsTab
                  tenant={tenantProfile}
                  mapsUrl={mapsUrl}
                  whatsappUrl={whatsappUrl}
                  instagramUrl={instagramUrl}
                />
              )}

              {/* Tab 1: Agendamento Principal (Cascata Fluida) */}
              {activeTab === 'agendamento' && (
                <div className="space-y-5">
                  {/* Client Identification Bar (if identified) */}
                  {isClientIdentified ? (
                    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-card-dark border border-border-dark text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="size-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <div className="truncate">
                          <span className="text-ink-soft">Cliente: </span>
                          <strong className="text-cream truncate">{clientName}</strong>
                          <span className="text-ink-soft ml-1 truncate">({clientPhoneDisplay})</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsLeadModalOpen(true)}
                        className="text-[11px] font-bold text-primary hover:text-primary-light transition-colors flex items-center gap-1 flex-shrink-0 ml-2"
                      >
                        <Edit2 size={11} />
                        Alterar
                      </button>
                    </div>
                  ) : (
                    <div className="px-3.5 py-2 rounded-xl bg-primary/10 border border-primary/20 text-[11px] text-primary flex items-center justify-between">
                      <span>Ao selecionar o serviço, você informará seu WhatsApp para confirmação.</span>
                    </div>
                  )}

                  {/* Section 1: Serviços */}
                  <section>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                        1. Escolha o(s) Serviço(s)
                      </h2>
                      {selectedServiceIds.length > 0 && (
                        <span className="text-[11px] font-bold text-primary">
                          {selectedServiceIds.length} selecionado{selectedServiceIds.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {availableServices.map((service) => {
                        const isSelected = selectedServiceIds.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => handleServiceClick(service.id)}
                            className={`w-full p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer active:scale-[0.99] ${
                              isSelected
                                ? 'bg-primary/10 border-primary shadow-sm'
                                : 'bg-card-dark border-border-dark hover:border-primary/40'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {/* Checkbox indicator */}
                              <div
                                className={`size-5 rounded-lg border flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-primary border-primary text-night'
                                    : 'border-border-dark bg-surface-dark'
                                }`}
                              >
                                {isSelected && <Check size={12} strokeWidth={3} />}
                              </div>

                              {/* Service Info */}
                              <div className="min-w-0 flex-1">
                                <h3 className="font-bold text-xs text-cream truncate">{service.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                                  <span className="flex items-center gap-1 text-ink-soft">
                                    <Clock size={11} className="text-primary" />
                                    {service.duration} min
                                  </span>
                                  {service.category && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-border-dark text-ink-soft uppercase">
                                      {service.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Price */}
                            <span className="font-bold text-xs text-cream tabular-nums flex-shrink-0">
                              {formatPriceBRL(service.price)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Services summary bar */}
                    {selectedServiceIds.length > 0 && (
                      <div className="mt-2.5 p-2 rounded-xl bg-background-dark border border-border-dark flex items-center justify-between text-xs">
                        <span className="text-ink-soft">
                          Duração: <strong className="text-cream">{formatDuration(totalDuration)}</strong>
                        </span>
                        <span className="font-bold text-primary tabular-nums">
                          Total: {formatPriceBRL(totalPrice)}
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Section 2: Profissional */}
                  <section>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                        2. Profissional
                      </h2>
                    </div>

                    <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x">
                      {/* Qualquer Profissional Card */}
                      <button
                        type="button"
                        onClick={() => selectStaff(ANY_STAFF_ID)}
                        className={`relative flex flex-col items-center justify-center p-2 rounded-2xl flex-shrink-0 w-20 text-center transition-all cursor-pointer snap-start ${
                          selectedStaffId === ANY_STAFF_ID
                            ? 'ring-2 ring-primary bg-card-dark text-primary'
                            : 'bg-card-dark/80 border border-border-dark text-ink-soft hover:text-cream'
                        }`}
                      >
                        <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-1">
                          <Zap size={20} />
                        </div>
                        <span className="text-[11px] font-bold leading-tight line-clamp-1">Qualquer</span>
                        <span className="text-[9px] text-ink-soft leading-tight">1º livre</span>

                        {selectedStaffId === ANY_STAFF_ID && (
                          <span className="absolute top-1 right-1 bg-primary text-night rounded-full p-0.5">
                            <Check size={8} strokeWidth={3} />
                          </span>
                        )}
                      </button>

                      {/* Barbeiros ativos */}
                      {availableStaff.map((staff) => {
                        const isSelected = selectedStaffId === staff.id;
                        const initials = staff.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase();

                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => selectStaff(staff.id)}
                            className={`relative flex flex-col items-center justify-center p-2 rounded-2xl flex-shrink-0 w-20 text-center transition-all cursor-pointer snap-start ${
                              isSelected
                                ? 'ring-2 ring-primary bg-card-dark text-cream'
                                : 'bg-card-dark/80 border border-border-dark text-ink-soft hover:text-cream'
                            }`}
                          >
                            <div className="size-12 rounded-xl overflow-hidden bg-background-dark border border-border-dark flex items-center justify-center mb-1">
                              {staff.avatar_url ? (
                                <img
                                  src={staff.avatar_url}
                                  alt={staff.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="font-display font-bold text-xs text-primary">{initials}</span>
                              )}
                            </div>
                            <span className="text-[11px] font-medium leading-tight truncate w-full">
                              {staff.name.split(' ')[0]}
                            </span>
                            <span className="text-[9px] text-emerald-400 leading-tight">Ativo</span>

                            {isSelected && (
                              <span className="absolute top-1 right-1 bg-primary text-night rounded-full p-0.5">
                                <Check size={8} strokeWidth={3} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Section 3: Data */}
                  <section>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                        3. Escolha a Data
                      </h2>
                    </div>

                    <div
                      ref={dateScrollRef}
                      className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x"
                    >
                      {dateOptions.map((date) => {
                        const isSelected = selectedDate === date.value;
                        return (
                          <button
                            key={date.value}
                            type="button"
                            onClick={() => selectDate(date.value)}
                            className={`flex flex-col items-center justify-center py-2 px-2.5 rounded-2xl flex-shrink-0 min-w-[54px] transition-all cursor-pointer snap-start ${
                              isSelected
                                ? 'bg-primary text-night font-bold shadow-md shadow-primary/20 scale-[1.02]'
                                : 'bg-card-dark border border-border-dark text-ink-soft hover:text-cream'
                            }`}
                          >
                            <span className="text-[9px] font-semibold uppercase tracking-tight">
                              {date.dayLabel || date.weekday}
                            </span>
                            <span className="text-sm font-black mt-0.5 tabular-nums">{date.dayNumber}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {/* Section 4: Horários Disponíveis */}
                  <section>
                    <div className="flex items-center justify-between mb-2.5">
                      <h2 className="text-xs font-bold text-ink-soft uppercase tracking-wider">
                        4. Horários Disponíveis
                      </h2>
                      {selectedSlot && (
                        <span className="text-[11px] font-bold text-primary">
                          {formatSlotTime(selectedSlot.start_time)}
                        </span>
                      )}
                    </div>

                    {/* State: No date selected */}
                    {!selectedDate ? (
                      <div className="p-4 rounded-2xl bg-card-dark border border-border-dark text-center">
                        <CalendarIcon className="size-6 text-ink-soft mx-auto mb-1 opacity-50" />
                        <p className="text-xs text-ink-soft">Selecione uma data acima para visualizar os horários.</p>
                      </div>
                    ) : isLoading ? (
                      /* State: Loading slots */
                      <div className="grid grid-cols-3 gap-2 animate-pulse">
                        {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((slotId) => (
                          <div key={slotId} className="h-9 bg-card-dark border border-border-dark rounded-xl" />
                        ))}
                      </div>
                    ) : availableSlotsList.length === 0 ? (
                      /* State: No slots */
                      <div className="p-4 rounded-2xl bg-card-dark border border-border-dark text-center space-y-1">
                        <Clock className="size-6 text-ink-soft mx-auto mb-1 opacity-50" />
                        <p className="text-xs font-semibold text-cream">Nenhum horário livre nesta data</p>
                        <p className="text-[11px] text-ink-soft">
                          Tente escolher outro dia ou selecione &quot;Qualquer Profissional&quot;.
                        </p>
                      </div>
                    ) : (
                      /* State: Slot Grid */
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {availableSlotsList.map((slot) => {
                          const isSelected = selectedSlot?.start_time === slot.start_time;
                          const timeDisplay = formatSlotTime(slot.start_time);

                          return (
                            <button
                              key={slot.start_time}
                              type="button"
                              onClick={() => selectSlot(slot)}
                              className={`py-2 px-2.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer active:scale-95 ${
                                isSelected
                                  ? 'bg-primary/20 text-primary border-primary shadow-sm font-bold'
                                  : 'bg-card-dark text-cream border-border-dark hover:border-primary/40'
                              }`}
                            >
                              {timeDisplay}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Section 5: Confirmação e Ação */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      disabled={
                        selectedServiceIds.length === 0 ||
                        !selectedStaffId ||
                        !selectedDate ||
                        !selectedSlot ||
                        isSubmittingBooking
                      }
                      className={`w-full py-3.5 px-4 font-bold text-sm rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer ${
                        selectedServiceIds.length > 0 && selectedStaffId && selectedDate && selectedSlot
                          ? 'bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-night shadow-primary/25'
                          : 'bg-card-dark border border-border-dark text-ink-soft/50 cursor-not-allowed'
                      }`}
                    >
                      {isSubmittingBooking ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          <span>Confirmando agendamento...</span>
                        </>
                      ) : (
                        <>
                          <span>Confirmar Agendamento</span>
                          <ChevronRight size={16} />
                        </>
                      )}
                    </button>

                    {/* Hint */}
                    <p className="text-center text-[10px] text-ink-soft/70 mt-2">
                      Ao confirmar, seu horário será garantido e abriremos o WhatsApp com seu comprovante.
                    </p>
                  </div>
                </div>
              )}
            </main>
          </>
        )}
      </div>

      {/* Lead Capture Modal / Bottom Sheet */}
      <LeadCaptureModal
        isOpen={isLeadModalOpen}
        initialName={clientName}
        initialPhoneDisplay={clientPhoneDisplay}
        onSave={handleLeadSaved}
        onClose={() => {
          setIsLeadModalOpen(false);
          setPendingServiceId(null);
        }}
        pendingServiceName={
          pendingServiceId ? availableServices.find((s) => s.id === pendingServiceId)?.name : null
        }
      />
    </div>
  );
};

export default PublicBookingPage;
