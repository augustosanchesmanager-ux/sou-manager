/**
 * StepClientForm - Client data form.
 * Fields: Nome Completo (text), WhatsApp (auto-mask BR: (11) 99999-9999, storing E.164 +55...), Observações (textarea, optional).
 * Inline validation messages.
 */

import React, { useEffect, useRef } from 'react';
import { User, Phone, MessageSquare, AlertCircle, CheckCircle } from 'lucide-react';

interface StepClientFormProps {
  clientName: string;
  onNameChange: (name: string) => void;
  clientPhoneDisplay: string;
  onPhoneChange: (phoneDisplay: string) => void;
  clientNotes: string;
  onNotesChange: (notes: string) => void;
  errors?: {
    name?: string;
    phone?: string;
  };
  isSubmitting?: boolean;
}

const StepClientForm: React.FC<StepClientFormProps> = ({
  clientName,
  onNameChange,
  clientPhoneDisplay,
  onPhoneChange,
  clientNotes,
  onNotesChange,
  errors,
  isSubmitting,
}) => {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus name input on mount
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Phone mask: (11) 99999-9999
  const applyPhoneMask = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    let formatted = '';

    if (digits.length > 0) {
      formatted = `(${digits.slice(0, 2)}`;
    }
    if (digits.length >= 3) {
      formatted += `) ${digits.slice(2, 7)}`;
    }
    if (digits.length >= 8) {
      formatted += `-${digits.slice(7, 11)}`;
    }

    return formatted;
  };

  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    e.target.value = masked;
    onPhoneChange(masked);
  };

  const validateName = (name: string): string | undefined => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return 'Nome é obrigatório';
    if (trimmed.length < 3) return 'Nome deve ter pelo menos 3 caracteres';
    return undefined;
  };

  const validatePhone = (phoneDisplay: string): string | undefined => {
    const digits = phoneDisplay.replace(/\D/g, '');
    if (digits.length === 0) return 'WhatsApp é obrigatório';
    if (digits.length < 10) return 'WhatsApp inválido (DDD + número)';
    if (digits.length > 11) return 'Número muito longo';
    return undefined;
  };

  const nameError = errors?.name || validateName(clientName);
  const phoneError = errors?.phone || validatePhone(clientPhoneDisplay);
  const nameValid = !nameError && clientName.trim().length >= 3;
  const phoneValid = !phoneError && clientPhoneDisplay.replace(/\D/g, '').length >= 10;

  return (
    <div className="space-y-5" role="form" aria-label="Dados do cliente">
      {/* Nome Completo */}
      <div>
        <label htmlFor="client-name" className="block text-sm font-medium text-ink mb-2">
          Nome Completo <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <User className="w-5 h-5 text-line" aria-hidden="true" />
          </div>
          <input
            ref={nameInputRef}
            id="client-name"
            type="text"
            value={clientName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={() => {}}
            className={`w-full pl-10 pr-4 py-3.5 rounded-xl border-2 bg-white dark:bg-card-dark transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${
              nameError
                ? 'border-danger focus-visible:ring-danger/50'
                : nameValid
                ? 'border-emerald-300 dark:border-emerald-700 focus-visible:ring-primary/50'
                : 'border-line hover:border-primary/30 focus-visible:ring-primary/50'
            }`}
            placeholder="Seu nome completo"
            autoComplete="name"
            aria-invalid={nameError ? 'true' : 'false'}
            aria-describedby={nameError ? 'name-error' : nameValid ? 'name-success' : undefined}
            disabled={isSubmitting}
          />
          {nameError && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <AlertCircle className="w-5 h-5 text-danger" aria-hidden="true" />
            </div>
          )}
          {nameValid && clientName.trim().length > 0 && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />
            </div>
          )}
        </div>
        {nameError && (
          <p id="name-error" className="mt-1.5 text-sm text-danger flex items-center gap-1" role="alert">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {nameError}
          </p>
        )}
        {nameValid && clientName.trim().length > 0 && (
          <p id="name-success" className="mt-1.5 text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Nome válido
          </p>
        )}
      </div>

      {/* WhatsApp */}
      <div>
        <label htmlFor="client-phone" className="block text-sm font-medium text-ink mb-2">
          WhatsApp <span className="text-danger" aria-hidden="true">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Phone className="w-5 h-5 text-line" aria-hidden="true" />
          </div>
          <input
            ref={phoneInputRef}
            id="client-phone"
            type="tel"
            value={clientPhoneDisplay}
            onChange={handlePhoneInput}
            onBlur={() => {}}
            className={`w-full pl-10 pr-4 py-3.5 rounded-xl border-2 bg-white dark:bg-card-dark transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 ${
              phoneError
                ? 'border-danger focus-visible:ring-danger/50'
                : phoneValid
                ? 'border-emerald-300 dark:border-emerald-700 focus-visible:ring-primary/50'
                : 'border-line hover:border-primary/30 focus-visible:ring-primary/50'
            }`}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            inputMode="tel"
            aria-invalid={phoneError ? 'true' : 'false'}
            aria-describedby={phoneError ? 'phone-error' : phoneValid ? 'phone-success' : undefined}
            disabled={isSubmitting}
            maxLength={16} // (11) 99999-9999 = 15 chars
          />
          {phoneError && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <AlertCircle className="w-5 h-5 text-danger" aria-hidden="true" />
            </div>
          )}
          {phoneValid && clientPhoneDisplay.replace(/\D/g, '').length >= 10 && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <CheckCircle className="w-5 h-5 text-emerald-500" aria-hidden="true" />
            </div>
          )}
        </div>
        {phoneError && (
          <p id="phone-error" className="mt-1.5 text-sm text-danger flex items-center gap-1" role="alert">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {phoneError}
          </p>
        )}
        {phoneValid && clientPhoneDisplay.replace(/\D/g, '').length >= 10 && (
          <p id="phone-success" className="mt-1.5 text-sm text-emerald-600 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            WhatsApp válido
          </p>
        )}
        <p className="mt-1.5 text-xs text-ink-soft flex items-center gap-1">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
          Usaremos apenas para confirmação e lembretes do agendamento
        </p>
      </div>

      {/* Observações */}
      <div>
        <label htmlFor="client-notes" className="block text-sm font-medium text-ink mb-2">
          Observações <span className="text-ink-soft text-normal">(opcional)</span>
        </label>
        <div className="relative">
          <div className="absolute top-3 left-0 flex items-start pl-3 pointer-events-none">
            <MessageSquare className="w-5 h-5 text-line mt-0.5" aria-hidden="true" />
          </div>
          <textarea
            id="client-notes"
            value={clientNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            className="w-full pl-10 pr-4 py-3.5 rounded-xl border-2 border-line bg-white dark:bg-card-dark transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 resize-y min-h-[100px]"
            placeholder="Alguma preferência, alergia ou informação importante para o profissional?"
            aria-describedby="notes-hint"
            disabled={isSubmitting}
            rows={3}
          />
        </div>
        <p id="notes-hint" className="mt-1.5 text-xs text-ink-soft">
          Ex: "Prefiro corte com máquina", "Tenho alergia a talco", "Quero deixar barba mais cheia"
        </p>
      </div>
    </div>
  );
};

export default StepClientForm;