import React, { useState } from 'react';
import type { DashboardAppointment } from '../../src/modules/dashboard/types';

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: DashboardAppointment | null;
  businessName?: string;
}

interface MessageTemplate {
  id: string;
  title: string;
  icon: string;
  description: string;
  buildText: (params: { clientName: string; time: string; service: string; barber: string; business: string }) => string;
}

const TEMPLATES: MessageTemplate[] = [
  {
    id: 'confirmation',
    title: 'Confirmar horário',
    icon: 'check_circle',
    description: 'Solicita confirmação de presença com detalhes do atendimento',
    buildText: ({ clientName, time, service, barber, business }) =>
      `Olá, ${clientName}! Passando para confirmar seu horário hoje às ${time} para ${service}${barber ? ` com o profissional ${barber}` : ''} na ${business}. Você confirma sua presença? Obrigado!`,
  },
  {
    id: 'reminder',
    title: 'Lembrete de horário',
    icon: 'schedule',
    description: 'Avisa que o horário está próximo para evitar atrasos',
    buildText: ({ clientName, time, barber, business }) =>
      `Oi, ${clientName}! Seu horário na ${business} é hoje às ${time}${barber ? ` com ${barber}` : ''}. Estamos te esperando!`,
  },
  {
    id: 'ready',
    title: 'Cadeira liberada (Pode vir)',
    icon: 'chair',
    description: 'Avisa que o barbeiro já está livre para atender',
    buildText: ({ clientName, barber, business }) =>
      `Fala, ${clientName}! A cadeira já está liberada${barber ? ` com ${barber}` : ''} aqui na ${business}. Pode chegar que estamos prontos para começar!`,
  },
  {
    id: 'reschedule',
    title: 'Ajuste / Reagendamento',
    icon: 'edit_calendar',
    description: 'Pergunta se o cliente precisa ajustar o horário marcado',
    buildText: ({ clientName, time, business }) =>
      `Olá, ${clientName}! Vimos que você tem um horário hoje às ${time} na ${business}. Teve algum imprevisto ou precisa ajustar o horário? Nos avise aqui!`,
  },
];

const formatTimeOnly = (isoString?: string): string => {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({
  isOpen,
  onClose,
  appointment,
  businessName = 'nossa barbearia',
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('confirmation');
  const [customText, setCustomText] = useState<string>('');
  const [hasEdited, setHasEdited] = useState(false);

  if (!isOpen || !appointment) return null;

  const clientName = appointment.client_name ? appointment.client_name.split(' ')[0] : 'Cliente';
  const time = formatTimeOnly(appointment.start_time);
  const service = appointment.service_name || 'seu atendimento';
  const barber = appointment.staff_name || '';

  const activeTemplate = TEMPLATES.find((t) => t.id === selectedTemplateId) || TEMPLATES[0];
  const defaultText = activeTemplate.buildText({
    clientName,
    time,
    service,
    barber,
    business: businessName,
  });

  const displayText = hasEdited ? customText : defaultText;

  const handleSelectTemplate = (id: string) => {
    setSelectedTemplateId(id);
    setHasEdited(false);
  };

  const cleanPhone = (appointment.client_phone || '').replace(/\D/g, '');
  const isValidPhone = cleanPhone.length >= 10 && cleanPhone.length <= 11;

  const handleSend = () => {
    if (!isValidPhone) return;
    const encoded = encodeURIComponent(displayText);
    const url = `https://wa.me/55${cleanPhone}?text=${encoded}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-night/70 backdrop-blur-xs animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="whatsapp-modal-title"
        className="relative w-full max-w-lg rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark p-6 shadow-2xl transition-all"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-line dark:border-border-dark">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <span className="material-symbols-outlined text-xl">chat</span>
            </div>
            <div>
              <h3 id="whatsapp-modal-title" className="font-display text-base font-bold text-ink dark:text-white">
                Mensagem WhatsApp
              </h3>
              <p className="text-xs text-ink-soft">
                {appointment.client_name || 'Cliente'} • {time} {barber && `• ${barber}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-gold-pale dark:hover:bg-surface-dark transition-colors"
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Validação de Telefone */}
        {!isValidPhone && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            <span className="material-symbols-outlined text-base">warning</span>
            <span>
              Este cliente não possui telefone válido cadastrado ({appointment.client_phone || 'sem telefone'}).
            </span>
          </div>
        )}

        {/* Lista de Templates */}
        <div className="mt-4 space-y-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">Escolha um modelo:</label>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((tmpl) => {
              const isSelected = tmpl.id === selectedTemplateId;
              return (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tmpl.id)}
                  className={`flex items-start gap-2 rounded-xl border p-2.5 text-left transition-all touch-manipulation ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary-dark dark:text-primary-light shadow-xs'
                      : 'border-line dark:border-border-dark bg-card dark:bg-surface-dark text-ink dark:text-ink-soft hover:border-primary/40'
                  }`}
                >
                  <span className={`material-symbols-outlined text-base shrink-0 ${isSelected ? 'text-primary' : 'text-ink-soft'}`}>
                    {tmpl.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate leading-tight">{tmpl.title}</p>
                    <p className="text-[10px] text-ink-soft truncate leading-normal mt-0.5">{tmpl.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Prévia / Edição do Texto */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="whatsapp-message-preview" className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              Mensagem personalizada:
            </label>
            {hasEdited && (
              <button
                type="button"
                onClick={() => setHasEdited(false)}
                className="text-[10px] font-semibold text-primary hover:underline"
              >
                Restaurar original
              </button>
            )}
          </div>
          <textarea
            id="whatsapp-message-preview"
            rows={4}
            value={displayText}
            onChange={(e) => {
              setCustomText(e.target.value);
              setHasEdited(true);
            }}
            className="w-full rounded-xl border border-line dark:border-border-dark bg-card dark:bg-surface-dark p-3 text-xs text-ink dark:text-white leading-relaxed focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
          />
        </div>

        {/* Rodapé de Ações */}
        <div className="mt-5 flex items-center justify-end gap-2.5 pt-4 border-t border-line dark:border-border-dark">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line dark:border-border-dark px-4 py-2 text-xs font-semibold text-ink-soft hover:bg-gold-pale dark:hover:bg-surface-dark transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!isValidPhone}
            onClick={handleSend}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
          >
            <span className="material-symbols-outlined text-sm">send</span>
            Abrir no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppModal;
