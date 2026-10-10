/**
 * PublicBookingPage - Main page component for the public booking flow.
 * Progressive step machine: services → staff → datetime → client → success.
 * Standalone public layout (NO app sidebar/auth).
 * Route: /#/agendar/:tenantSlug with redirect from /#/booking/:tenantSlug
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, AlertCircle } from 'lucide-react';
import { usePublicBooking } from './hooks/usePublicBooking';
import BookingHeader from './BookingHeader';
import StepServices from './StepServices';
import StepStaff from './StepStaff';
import StepDateTime from './StepDateTime';
import StepClientForm from './StepClientForm';
import BookingSummaryBar from './BookingSummaryBar';
import BookingSuccessVoucher from './BookingSuccessVoucher';
import { Toast } from './Toast';
import type { PublicTenantProfile, BookingStep } from './hooks/types';

const STEP_ORDER: BookingStep[] = ['services', 'staff', 'datetime', 'client', 'success'];

const STEP_LABELS: Record<BookingStep, { label: string; helper: string }> = {
  services: { label: 'Passo 1 de 4', helper: 'Escolha os serviços desejados' },
  staff: { label: 'Passo 2 de 4', helper: 'Selecione o profissional' },
  datetime: { label: 'Passo 3 de 4', helper: 'Escolha data e horário' },
  client: { label: 'Passo 4 de 4', helper: 'Seus dados para confirmação' },
  success: { label: 'Concluído', helper: 'Agendamento confirmado' },
};

const PublicBookingPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    tenantSlug,
    tenantProfile,
    currentStep,
    isLoading,
    error,
    isUsingMock,

    // Step 1
    availableServices,
    selectedServiceIds,
    toggleService,

    // Step 2
    availableStaff,
    selectedStaffId,
    selectStaff,
    ANY_STAFF_ID,

    // Step 3
    selectedDate,
    selectDate,
    selectedSlot,
    selectSlot,
    groupedSlots,

    // Step 4
    clientName,
    setClientName,
    clientPhoneDisplay,
    setClientPhone,
    clientNotes,
    setClientNotes,

    // Step 5
    bookingResult,

    // Summary
    selectedServices,
    totalDuration,
    totalPrice,
    formatDuration,
    formatPriceBRL,
    formatDateForDisplay,

    // Navigation
    canAdvance,
    goToNextStep,
    goToPrevStep,
    goToStep,
    submitBooking,
    startNewBooking,
    dismissError,

    // Step labels
    stepIndex,
    totalSteps,
  } = usePublicBooking();

  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  const handleAdvance = useCallback(() => {
    if (currentStep === 'client') {
      void submitBooking();
      return;
    }
    goToNextStep();
  }, [currentStep, submitBooking, goToNextStep]);

  // Focus management on step change
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  // Handle browser back button - go to previous step instead of leaving page
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (currentStep !== 'services' && currentStep !== 'success') {
        event.preventDefault();
        goToPrevStep();
        // Push a new state to keep history consistent
        history.pushState(null, '', window.location.href);
      }
    };

    // Push initial state
    history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentStep, goToPrevStep]);

  // Handle error dismissal
  const handleDismissError = () => {
    dismissError();
  };

  // Render step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6" role="navigation" aria-label="Progresso do agendamento">
      {STEP_ORDER.slice(0, -1).map((step, index) => {
        const isActive = index === stepIndex;
        const isCompleted = index < stepIndex;
        const isFuture = index > stepIndex;

        return (
          <React.Fragment key={step}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => goToStep(step)}
                disabled={isFuture || isLoading}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-primary text-night font-bold'
                    : isCompleted
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-medium'
                    : 'bg-line/40 text-ink-soft font-medium hover:bg-line'
                }`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={`${STEP_LABELS[step].label}: ${STEP_LABELS[step].helper}`}
              >
                <span className="text-[10px] font-black uppercase tracking-wide">{STEP_LABELS[step].label}</span>
              </button>
            </div>
            {index < STEP_ORDER.length - 2 && (
              <div className={`w-8 h-0.5 rounded ${isCompleted || isActive ? 'bg-primary' : 'bg-line'}`} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'services':
        return (
          <StepServices
            services={availableServices}
            selectedIds={selectedServiceIds}
            onToggle={toggleService}
            isLoading={isLoading && stepIndex === 0}
          />
        );

      case 'staff':
        return (
          <StepStaff
            staff={availableStaff}
            selectedId={selectedStaffId}
            onSelect={selectStaff}
            anyStaffId={ANY_STAFF_ID}
            isLoading={isLoading && stepIndex === 1}
          />
        );

      case 'datetime':
        return (
          <StepDateTime
            selectedDate={selectedDate}
            onSelectDate={selectDate}
            selectedSlot={selectedSlot}
            onSelectSlot={selectSlot}
            groupedSlots={groupedSlots}
            isLoading={isLoading && stepIndex === 2}
            horizonDays={tenantProfile?.booking_rules.horizon_days || 30}
            minBookingNoticeMinutes={tenantProfile?.booking_rules.min_booking_notice_minutes || 30}
            timezone={tenantProfile?.booking_rules.timezone || 'America/Sao_Paulo'}
          />
        );

      case 'client':
        return (
          <StepClientForm
            clientName={clientName}
            onNameChange={setClientName}
            clientPhoneDisplay={clientPhoneDisplay}
            onPhoneChange={setClientPhone}
            clientNotes={clientNotes}
            onNotesChange={setClientNotes}
            isSubmitting={isLoading && stepIndex === 3}
          />
        );

      case 'success':
        if (!bookingResult || !tenantProfile) return null;
        return (
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
        );

      default:
        return null;
    }
  };

  // Not found state
  if (tenantProfile === null && !isLoading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-line/50 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-ink-soft" />
          </div>
          <h1 className="font-display font-black text-2xl text-ink mb-2">Não encontramos essa barbearia</h1>
          <p className="text-ink-soft mb-6">Verifique o link ou entre em contato com o estabelecimento.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl bg-primary text-night font-black hover:bg-primary/90 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading && !tenantProfile) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-ink-soft">Carregando barbearia...</p>
        </div>
      </div>
    );
  }

  return (
      <div className={`min-h-screen bg-cream ${currentStep !== 'success' ? 'pb-40' : 'pb-8'}`}> {/* pb-40 clears fixed bottom bar; success has no bar */}
      {/* Toast for errors */}
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto pointer-events-auto animate-fade-in">
            <Toast
              message={error.message}
              variant="error"
              onClose={handleDismissError}
              autoCloseMs={0} // Don't auto-close error toasts
            />
          </div>
        </div>
      )}

      {/* Mock mode indicator */}
      {isUsingMock && import.meta.env.DEV && (
        <div className="fixed top-4 right-4 z-40 px-4 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-800">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Modo Demo (Mock)
          </span>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 pt-4">
        {/* Header */}
        {tenantProfile && <BookingHeader tenant={tenantProfile} />}

        {/* Step Indicator */}
        {currentStep !== 'success' && renderStepIndicator()}

        {/* Step Heading */}
        {currentStep !== 'success' && (
          <div className="mb-6">
            <h2
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display font-black text-xl text-ink"
            >
              {STEP_LABELS[currentStep]?.helper || ''}
            </h2>
          </div>
        )}

        {/* Step Content */}
        <div className="animate-fade-in" style={{ animationDuration: '200ms' }}>
          {renderStepContent()}
        </div>

        {/* Navigation Buttons (for non-success steps) */}
        {currentStep !== 'success' && (
          <div className="flex items-center mt-6 pt-4 border-t border-line">
            <button
              type="button"
              onClick={goToPrevStep}
              disabled={stepIndex === 0 || isLoading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-line bg-white dark:bg-card-dark text-ink font-medium transition-all hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </button>
          </div>
        )}

        {/* Success step actions rendered inside BookingSuccessVoucher */}
      </main>

      {/* Fixed Bottom Summary Bar (hidden on success step) */}
      {currentStep !== 'success' && tenantProfile && (
        <BookingSummaryBar
          totalDuration={totalDuration}
          totalPrice={totalPrice}
          canAdvance={canAdvance}
          onAdvance={handleAdvance}
          isLoading={isLoading}
          ctaText={stepIndex === totalSteps - 1 ? 'Confirmar agendamento' : 'Avançar'}
          formatDuration={formatDuration}
          formatPriceBRL={formatPriceBRL}
        />
      )}
    </div>
  );
};

export default PublicBookingPage;