/**
 * LeadCaptureModal - Bottom Sheet modal for early lead identification on first click.
 * Collects Full Name and WhatsApp (with strict validation and mask).
 * Matches SMG Barber dark luxury / mobile-first design tokens.
 */

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { User, Phone, X, ShieldCheck } from 'lucide-react';

interface LeadCaptureModalProps {
  isOpen: boolean;
  initialName: string;
  initialPhoneDisplay: string;
  onSave: (name: string, phoneDisplay: string) => void;
  onClose: () => void;
  pendingServiceName?: string | null;
}

export const applyPhoneMask = (value: string): string => {
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

export const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
  isOpen,
  initialName,
  initialPhoneDisplay,
  onSave,
  onClose,
  pendingServiceName,
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhoneDisplay);
  const [touched, setTouched] = useState({ name: false, phone: false });

  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPhone(initialPhoneDisplay);
      setTouched({ name: false, phone: false });

      // Focus management
      const timer = setTimeout(() => {
        if (!initialName.trim()) {
          nameInputRef.current?.focus();
        } else {
          phoneInputRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, initialName, initialPhoneDisplay]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const phoneDigits = phone.replace(/\D/g, '');
  const isNameValid = name.trim().length >= 3;
  const isPhoneValid = phoneDigits.length >= 11;
  const isFormValid = isNameValid && isPhoneValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setPhone(masked);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, phone: true });
    if (!isFormValid) return;

    onSave(name.trim(), phone);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 transition-all duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lead-modal-title"
    >
      {/* Backdrop click dismiss */}
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal / Bottom Sheet Card */}
      <div className="w-full max-w-sm bg-surface-dark border-t sm:border border-border-dark rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-6 duration-200">
        {/* Mobile handle indicator */}
        <div className="w-12 h-1 bg-border-dark rounded-full mx-auto mb-4 sm:hidden" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 id="lead-modal-title" className="font-display font-black text-lg text-cream tracking-tight leading-tight">
                Identifique-se para continuar
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                {pendingServiceName
                  ? `Para agendar "${pendingServiceName}", informe seus dados:`
                  : 'Seus dados para confirmar a reserva no WhatsApp.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-ink-soft hover:text-cream hover:bg-card-dark transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome Completo */}
          <div>
            <label htmlFor="lead-name" className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              Nome Completo <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
                <User className="w-4 h-4" />
              </div>
              <input
                ref={nameInputRef}
                id="lead-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                placeholder="Como prefere ser chamado?"
                className={`w-full pl-10 pr-4 py-3 bg-card-dark border rounded-xl text-sm text-cream placeholder:text-ink-soft/60 transition-colors focus:outline-none focus:ring-1 ${
                  touched.name && !isNameValid
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-border-dark focus:border-primary focus:ring-primary/20'
                }`}
              />
            </div>
            {touched.name && !isNameValid && (
              <p className="text-[11px] text-red-400 mt-1 pl-1">
                Por favor, informe seu nome completo (mínimo 3 letras).
              </p>
            )}
          </div>

          {/* WhatsApp */}
          <div>
            <label htmlFor="lead-phone" className="block text-xs font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              WhatsApp <span className="text-primary">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-ink-soft">
                <Phone className="w-4 h-4" />
              </div>
              <input
                ref={phoneInputRef}
                id="lead-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                value={phone}
                onChange={handlePhoneChange}
                onBlur={() => setTouched((prev) => ({ ...prev, phone: true }))}
                placeholder="(11) 99999-9999"
                className={`w-full pl-10 pr-4 py-3 bg-card-dark border rounded-xl text-sm text-cream tabular-nums placeholder:text-ink-soft/60 transition-colors focus:outline-none focus:ring-1 ${
                  touched.phone && !isPhoneValid
                    ? 'border-red-500/80 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-border-dark focus:border-primary focus:ring-primary/20'
                }`}
              />
            </div>
            {touched.phone && !isPhoneValid ? (
              <p className="text-[11px] text-red-400 mt-1 pl-1">
                Informe o DDD + número com 9 dígitos (ex: 11 99999-9999).
              </p>
            ) : (
              <p className="text-[10px] text-ink-soft/80 mt-1 pl-1">
                Você receberá o comprovante e lembretes neste número.
              </p>
            )}
          </div>

          {/* Action button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={!isFormValid}
              className={`w-full py-3.5 px-4 font-bold text-sm rounded-xl transition-all shadow-lg active:scale-[0.99] flex items-center justify-center gap-2 ${
                isFormValid
                  ? 'bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary text-night shadow-primary/20 cursor-pointer'
                  : 'bg-card-dark border border-border-dark text-ink-soft/50 cursor-not-allowed'
              }`}
            >
              Continuar com o agendamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
