import type React from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, Phone, Sparkles, User, X } from 'lucide-react';
import { applyPhoneMask } from './LeadCaptureModal';
import { registerPublicBookingPromoLead } from './hooks/bookingService';
import { applyCpfMask, getCanonicalBrPhone, isValidBrCpf, normalizeCpf } from '../../../lib/utils/phone';

interface PromoLeadModalProps {
  isOpen: boolean;
  tenantIdentifier: string;
  initialName?: string;
  initialPhoneDisplay?: string;
  onClose: () => void;
  onRegistered?: (name: string, phoneDisplay: string) => void;
}

export const PromoLeadModal: React.FC<PromoLeadModalProps> = ({
  isOpen,
  tenantIdentifier,
  initialName = '',
  initialPhoneDisplay = '',
  onClose,
  onRegistered,
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhoneDisplay);
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ reconciled: boolean; maskedName: string | null } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPhone(initialPhoneDisplay);
      setCpf('');
      setError(null);
      setResult(null);
    }
  }, [isOpen, initialName, initialPhoneDisplay]);

  if (!isOpen) return null;

  const phoneDigits = phone.replace(/\D/g, '');
  const isNameValid = name.trim().length >= 3;
  const isPhoneValid = phoneDigits.length >= 11 && getCanonicalBrPhone(phone) !== null;
  const isCpfValid = isValidBrCpf(cpf);
  const canSubmit = isNameValid && isPhoneValid && isCpfValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await registerPublicBookingPromoLead({
        tenant_identifier: tenantIdentifier,
        client_name: name.trim(),
        client_phone: phoneDigits,
        client_email: email.trim() || null,
        birthday: birthday || null,
        client_cpf: normalizeCpf(cpf),
      });
      setResult({ reconciled: response.reconciled, maskedName: response.masked_name });
      onRegistered?.(response.client_name?.trim() || name.trim(), phone);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir seu cadastro agora.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="promo-lead-title"
    >
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 id="promo-lead-title" className="text-lg font-extrabold text-white tracking-tight">
                Clube de Promoções
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Receba ofertas exclusivas e descontos da barbearia.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">
                {result.reconciled ? 'Cadastro conciliado com sucesso!' : 'Cadastro realizado com sucesso!'}
              </p>
              <p className="text-xs text-neutral-300">
                {result.maskedName ? `Titular: ${result.maskedName}. ` : ''}
                Você já está participando das nossas promoções e novidades.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition-colors cursor-pointer"
            >
              Voltar para o agendamento
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="promo-name" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                Seu Nome <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="promo-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome completo"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="promo-phone" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                WhatsApp <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Phone className="w-4 h-4" />
                </div>
                <input
                  id="promo-phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(applyPhoneMask(e.target.value))}
                  placeholder="(11) 99999-9999"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white tabular-nums placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="promo-cpf" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                CPF <span className="text-amber-400">*</span>
              </label>
              <input
                id="promo-cpf"
                type="text"
                inputMode="numeric"
                value={cpf}
                onChange={(e) => setCpf(applyCpfMask(e.target.value))}
                placeholder="000.000.000-00"
                required
                className="w-full px-3 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white tabular-nums placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
              />
              {cpf.length > 0 && !isCpfValid && (
                <p className="text-[11px] text-red-400 mt-1 pl-1">Informe um CPF válido.</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="promo-email" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  E-mail (opcional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="promo-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@email.com"
                    className="w-full pl-10 pr-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="promo-birthday" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-1.5">
                  Aniversário (opcional)
                </label>
                <input
                  id="promo-birthday"
                  type="date"
                  value={birthday}
                  onChange={(e) => setBirthday(e.target.value)}
                  className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className={`w-full py-3.5 px-4 font-bold text-sm rounded-xl transition-all cursor-pointer ${
                canSubmit
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20'
                  : 'bg-neutral-800 border border-neutral-700 text-neutral-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? 'Salvando cadastro...' : 'Quero participar das promoções'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PromoLeadModal;
