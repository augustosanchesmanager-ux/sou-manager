import React, { useState, useEffect } from 'react';
import { validateBrazilianCellPhone } from '../src/utils/functionalValidation';

interface DemoBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPlan?: string | null;
}

const SHIFT_OPTIONS = [
  { id: 'manha', label: 'Manhã (09h às 12h)' },
  { id: 'tarde', label: 'Tarde (13h às 18h)' },
  { id: 'noite', label: 'Noite (18h às 21h)' },
];

const CHAIR_OPTIONS = [
  { id: '1-2', label: '1 a 2 profissionais (Cadeiras)' },
  { id: '3-6', label: '3 a 6 profissionais (Média Operação)' },
  { id: '7+', label: '7 ou mais profissionais (Grande Porte / Rede)' },
];

export const DemoBookingModal: React.FC<DemoBookingModalProps> = ({
  isOpen,
  onClose,
  initialPlan,
}) => {
  const [name, setName] = useState('');
  const [barbershopName, setBarbershopName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [chairs, setChairs] = useState('3-6');
  const [preferredShift, setPreferredShift] = useState('tarde');
  const [selectedPlan, setSelectedPlan] = useState(initialPlan || 'Gestão & Clube Pro');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (initialPlan) {
      setSelectedPlan(initialPlan);
    }
  }, [initialPlan]);

  // Fechar com a tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Bloqueio de scroll de fundo quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    let formatted = val;
    if (val.length <= 11) {
      if (val.length > 2 && val.length <= 7) {
        formatted = `(${val.slice(0, 2)}) ${val.slice(2)}`;
      } else if (val.length > 7) {
        formatted = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7, 11)}`;
      }
    }
    setPhone(formatted);
    if (phoneError) setPhoneError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const phoneValidation = validateBrazilianCellPhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Informe um celular válido com DDD.');
      return;
    }

    setSubmitted(true);
  };

  const getWhatsAppMessage = () => {
    const text = `Olá! Gostaria de agendar uma demonstração guiada do SMG Barber Intelligence.
    
📍 *Barbearia:* ${barbershopName || 'Não informada'}
👤 *Responsável:* ${name || 'Não informado'}
💈 *Porte:* ${chairs} cadeiras
🏙️ *Cidade/UF:* ${city || 'Não informada'}
🎯 *Interesse:* ${selectedPlan}
⏰ *Melhor Turno:* ${SHIFT_OPTIONS.find(s => s.id === preferredShift)?.label || preferredShift}`;

    return encodeURIComponent(text);
  };

  const handleOpenWhatsApp = () => {
    window.open(`https://wa.me/5511982073536?text=${getWhatsAppMessage()}`, '_blank');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-booking-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-xl bg-[#0D0B09] border border-[#2B231B] rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/80 overflow-y-auto max-h-[90vh]">
        {/* Botão de Fechar */}
        <button
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-card-dark"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        {!submitted ? (
          <div>
            {/* Cabeçalho */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-2 mb-2">
                <span className="w-5 h-px bg-primary" />
                <span className="text-[10px] font-mono tracking-[0.2em] text-primary uppercase font-bold">
                  EXPERIÊNCIA EXCLUSIVA
                </span>
              </div>
              <h2
                id="demo-booking-title"
                className="text-2xl sm:text-3xl font-black text-white tracking-tight font-display"
              >
                AGENDAR DEMONSTRAÇÃO GUIADA
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
                Conheça a plataforma configurada para a realidade da sua barbearia. Apresentamos ao vivo como o Cockpit, o Clube dos Chefes e a IA Preditiva aumentam seu faturamento.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Plano / Momento de Interesse */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1.5 font-semibold">
                  Momento Operacional / Plano
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { name: 'Operação Essencial', desc: '1-2 Cadeiras' },
                    { name: 'Gestão & Clube Pro', desc: '3-6 Cadeiras' },
                    { name: 'Atelier Multi-Unidade', desc: 'Redes / IA' },
                  ].map((p) => (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => setSelectedPlan(p.name)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        selectedPlan === p.name
                          ? 'border-primary bg-primary/10 text-white shadow-sm'
                          : 'border-border-dark bg-card-dark/60 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <p className="text-xs font-bold leading-tight">{p.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid: Nome e Barbearia */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    Seu Nome *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Carlos Oliveira"
                    className="w-full px-3.5 py-2.5 bg-surface-dark border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs placeholder:text-slate-500 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    Nome da Barbearia *
                  </label>
                  <input
                    type="text"
                    required
                    value={barbershopName}
                    onChange={(e) => setBarbershopName(e.target.value)}
                    placeholder="Ex: Barbearia Dom Pedro"
                    className="w-full px-3.5 py-2.5 bg-surface-dark border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs placeholder:text-slate-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Grid: Celular/WhatsApp e Cidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    WhatsApp Comercial *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(11) 98765-4321"
                    maxLength={15}
                    className={`w-full px-3.5 py-2.5 bg-surface-dark border ${
                      phoneError ? 'border-red-500' : 'border-border-dark'
                    } focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs placeholder:text-slate-500 transition-all outline-none`}
                  />
                  {phoneError && <p className="text-[10px] text-red-400 mt-1">{phoneError}</p>}
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    Cidade / UF
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: São Paulo - SP"
                    className="w-full px-3.5 py-2.5 bg-surface-dark border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs placeholder:text-slate-500 transition-all outline-none"
                  />
                </div>
              </div>

              {/* Grid: Cadeiras e Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    Cadeiras Ativas
                  </label>
                  <select
                    value={chairs}
                    onChange={(e) => setChairs(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dark border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs transition-all outline-none cursor-pointer"
                  >
                    {CHAIR_OPTIONS.map((c) => (
                      <option key={c.id} value={c.id} className="bg-card-dark text-white">
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1 font-semibold">
                    Melhor Horário para Demonstração
                  </label>
                  <select
                    value={preferredShift}
                    onChange={(e) => setPreferredShift(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-surface-dark border border-border-dark focus:border-primary focus:ring-1 focus:ring-primary rounded-xl text-white text-xs transition-all outline-none cursor-pointer"
                  >
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.id} value={s.id} className="bg-card-dark text-white">
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botão de Submissão */}
              <div className="pt-3">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-primary hover:bg-primary-light text-night font-mono font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-smg-glow hover:-translate-y-0.5 flex items-center justify-center gap-2"
                >
                  <span>SOLICITAR DEMONSTRAÇÃO EXCLUSIVA</span>
                  <span className="material-symbols-outlined text-sm font-black">arrow_forward</span>
                </button>
                <p className="text-center text-[10px] text-slate-500 mt-2">
                  Atendimento executivo sem compromisso. Seus dados estão protegidos pela LGPD.
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* Tela de Confirmação */
          <div className="text-center py-6 animate-fadeIn">
            <div className="w-14 h-14 bg-primary/20 border border-primary text-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <span className="text-[10px] font-mono tracking-widest text-primary uppercase font-bold">
              SOLICITAÇÃO RECEBIDA COM SUCESSO
            </span>
            <h3 className="text-2xl font-black text-white mt-1 mb-2 font-display">
              PREPARAMOS SEU AGENDAMENTO
            </h3>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Obrigado, <strong>{name}</strong>! Nossa equipe executiva já recebeu os dados da <strong>{barbershopName}</strong> e entrará em contato para apresentar a demonstração guiada no turno selecionado.
            </p>

            <div className="p-4 bg-card-dark/80 border border-border-dark rounded-xl max-w-sm mx-auto mb-6 text-left space-y-1.5 text-xs text-slate-300">
              <p><strong className="text-white">Barbearia:</strong> {barbershopName}</p>
              <p><strong className="text-white">Cadeiras:</strong> {chairs}</p>
              <p><strong className="text-white">Plano de Interesse:</strong> {selectedPlan}</p>
              <p><strong className="text-white">Contato:</strong> {phone}</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="px-6 py-3 bg-[#25D366] hover:bg-[#20ba59] text-night font-mono font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <span className="material-symbols-outlined text-base">chat</span>
                <span>FALAR AGORA NO WHATSAPP</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-surface-dark hover:bg-card-dark border border-border-dark text-slate-300 hover:text-white font-mono text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                FECHAR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DemoBookingModal;
