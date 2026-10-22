/**
 * ServiceSpecificationModal - Modal / Bottom Sheet for Phase 1 of Booking:
 * Service Specification, details, highlights and lead identification trigger.
 */

import type React from 'react';
import { useState, useEffect } from 'react';
import { Clock, Tag, X, User, Phone, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import type { PublicService } from '../hooks/types';
import { applyPhoneMask } from '../LeadCaptureModal';

interface ServiceSpecificationModalProps {
  isOpen: boolean;
  service: PublicService | null;
  clientName: string;
  clientPhoneDisplay: string;
  onSaveLead: (name: string, phone: string) => void;
  onProceedToStaff: () => void;
  onClose: () => void;
  formatPriceBRL: (price: number) => string;
}

export const ServiceSpecificationModal: React.FC<ServiceSpecificationModalProps> = ({
  isOpen,
  service,
  clientName,
  clientPhoneDisplay,
  onSaveLead,
  onProceedToStaff,
  onClose,
  formatPriceBRL,
}) => {
  const [name, setName] = useState(clientName);
  const [phone, setPhone] = useState(clientPhoneDisplay);
  const [isEditingLead, setIsEditingLead] = useState(false);
  const [touched, setTouched] = useState({ name: false, phone: false });

  const phoneDigits = clientPhoneDisplay.replace(/\D/g, '');
  const isAlreadyIdentified = clientName.trim().length >= 3 && phoneDigits.length >= 11;

  useEffect(() => {
    if (isOpen) {
      setName(clientName);
      setPhone(clientPhoneDisplay);
      setIsEditingLead(!isAlreadyIdentified);
      setTouched({ name: false, phone: false });
    }
  }, [isOpen, clientName, clientPhoneDisplay, isAlreadyIdentified]);

  if (!isOpen || !service) return null;

  const currentPhoneDigits = phone.replace(/\D/g, '');
  const isCurrentNameValid = name.trim().length >= 3;
  const isCurrentPhoneValid = currentPhoneDigits.length >= 11;
  const isLeadValid = isAlreadyIdentified && !isEditingLead
    ? true
    : isCurrentNameValid && isCurrentPhoneValid;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyPhoneMask(e.target.value);
    setPhone(masked);
  };

  const handleConfirmLeadAndProceed = () => {
    if (isEditingLead || !isAlreadyIdentified) {
      setTouched({ name: true, phone: true });
      if (!isCurrentNameValid || !isCurrentPhoneValid) return;
      onSaveLead(name.trim(), phone);
    }
    onProceedToStaff();
  };

  // High quality themed photo fallback based on category/name
  const getServicePhoto = (s: PublicService): string => {
    if (s.image_url) return s.image_url;
    const lower = (s.name + (s.category || '')).toLowerCase();
    if (lower.includes('barba')) {
      return 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?auto=format&fit=crop&w=800&q=80';
    }
    if (lower.includes('combo') || lower.includes('completo')) {
      return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80';
    }
    return 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80';
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spec-modal-title"
    >
      {/* Backdrop dismiss */}
      <div className="fixed inset-0 -z-10" onClick={onClose} aria-hidden="true" />

      {/* Modal Card */}
      <div className="w-full max-w-md bg-neutral-900 border-t sm:border border-neutral-800 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in slide-in-from-bottom-6 duration-200">
        
        {/* Mobile handle */}
        <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-1 sm:hidden flex-shrink-0" aria-hidden="true" />

        {/* Hero Header with Service Image */}
        <div className="relative h-44 sm:h-48 w-full overflow-hidden flex-shrink-0 bg-neutral-950">
          <img
            src={getServicePhoto(service)}
            alt={service.name}
            className="w-full h-full object-cover"
          />
          {/* Dark gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/60 to-black/30" />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 size-9 rounded-full bg-black/60 border border-neutral-700 text-white hover:bg-black/90 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>

          {/* Category Pill */}
          {service.category && (
            <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500/90 text-neutral-950 text-[10px] font-extrabold uppercase tracking-wider shadow">
              {service.category}
            </div>
          )}

          {/* Service Title on Image */}
          <div className="absolute bottom-3 left-4 right-4">
            <h2 id="spec-modal-title" className="text-white font-black text-xl sm:text-2xl tracking-tight leading-tight drop-shadow">
              {service.name}
            </h2>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Key Metrics: Price & Duration */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Tag size={16} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Investimento</span>
                <span className="text-amber-400 font-extrabold text-lg tabular-nums">
                  {formatPriceBRL(service.price)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-right">
              <div>
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">Tempo Estimado</span>
                <span className="text-white font-bold text-sm tabular-nums flex items-center justify-end gap-1">
                  <Clock size={13} className="text-amber-400" />
                  {service.duration} min
                </span>
              </div>
            </div>
          </div>

          {/* Description & Inclusions */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-400" />
              O que está incluso no atendimento
            </h3>
            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
              {service.description ||
                'Procedimento completo e personalizado com produtos de alto padrão, toalha quente, alinhamento capilar e acabamento profissional com lâmina descartável.'}
            </p>

            <ul className="grid grid-cols-1 gap-1.5 pt-1 text-xs text-neutral-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 flex-shrink-0" />
                <span>Profissionais qualificados da casa</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 flex-shrink-0" />
                <span>Produtos de finalização e styling inclusos</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 size={14} className="text-amber-400 flex-shrink-0" />
                <span>Ambiente climatizado e garantia de horário</span>
              </li>
            </ul>
          </div>

          {/* Lead Capture Section (Primeiro Clique) */}
          <div className="pt-2 border-t border-neutral-800">
            {isAlreadyIdentified && !isEditingLead ? (
              <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block">
                    Agendando para:
                  </span>
                  <p className="text-white font-bold mt-0.5">{clientName}</p>
                  <p className="text-neutral-400 text-[11px] tabular-nums">{clientPhoneDisplay}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingLead(true)}
                  className="px-3 py-1.5 rounded-lg border border-neutral-700 text-amber-400 hover:text-white hover:bg-neutral-800 transition-colors text-xs font-semibold"
                >
                  Alterar dados
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div>
                  <h4 className="text-white font-bold text-xs uppercase tracking-wider">
                    Identifique-se para continuar
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Precisamos do seu nome e WhatsApp para confirmar a reserva.
                  </p>
                </div>

                {/* Name */}
                <div>
                  <label htmlFor="spec-lead-name" className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    Nome Completo <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <User size={14} />
                    </div>
                    <input
                      id="spec-lead-name"
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, name: true }))}
                      placeholder="Seu nome"
                      className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  {touched.name && !isCurrentNameValid && (
                    <p className="text-[10px] text-red-400 mt-1">Informe pelo menos 3 caracteres.</p>
                  )}
                </div>

                {/* WhatsApp */}
                <div>
                  <label htmlFor="spec-lead-phone" className="block text-[11px] font-semibold text-neutral-300 mb-1">
                    WhatsApp <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                      <Phone size={14} />
                    </div>
                    <input
                      id="spec-lead-phone"
                      type="tel"
                      inputMode="numeric"
                      value={phone}
                      onChange={handlePhoneChange}
                      onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-9 pr-3 py-2 bg-neutral-900 border border-neutral-700 rounded-xl text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500 transition-colors tabular-nums"
                    />
                  </div>
                  {touched.phone && !isCurrentPhoneValid && (
                    <p className="text-[10px] text-red-400 mt-1">Informe DDD + número (11 dígitos).</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex-shrink-0">
          <button
            type="button"
            onClick={handleConfirmLeadAndProceed}
            disabled={!isLeadValid}
            className={`w-full py-3.5 px-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.99] shadow-lg ${
              isLeadValid
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-950 shadow-amber-500/20 cursor-pointer'
                : 'bg-neutral-800 text-neutral-500 border border-neutral-700 cursor-not-allowed'
            }`}
          >
            <span>Escolher Profissional</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
