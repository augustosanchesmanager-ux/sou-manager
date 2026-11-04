import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import type { Client } from '../../domain/client';
import {
  getClientInactivityStatus,
  generateReengagementMessage,
  buildWhatsAppUrl,
  sanitizePhoneNumberForWhatsApp,
} from '../../src/utils/clientReengagement';

export interface ClientReengagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  shopName?: string;
  bookingUrl?: string;
}

const ClientReengagementModal: React.FC<ClientReengagementModalProps> = ({
  isOpen,
  onClose,
  client,
  shopName = '',
  bookingUrl = '',
}) => {
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (client && isOpen) {
      const status = getClientInactivityStatus(client.last_visit);
      const initialMsg = generateReengagementMessage({
        clientName: client.name,
        shopName,
        daysSinceVisit: status.days,
        bookingUrl,
      });
      setMessage(initialMsg);
      setCopied(false);
    }
  }, [client, isOpen, shopName, bookingUrl]);

  if (!client) return null;

  const status = getClientInactivityStatus(client.last_visit);
  const cleanPhone = sanitizePhoneNumberForWhatsApp(client.phone || '');
  const hasValidPhone = Boolean(cleanPhone && cleanPhone.length >= 10);
  const whatsAppUrl = hasValidPhone ? buildWhatsAppUrl(client.phone, message) : '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback silencioso
    }
  };

  const handleSend = () => {
    if (!whatsAppUrl) return;
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleResetDefault = () => {
    const defaultMsg = generateReengagementMessage({
      clientName: client.name,
      shopName,
      daysSinceVisit: status.days,
      bookingUrl,
    });
    setMessage(defaultMsg);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reengajar Cliente via WhatsApp"
      maxWidth="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">
              {copied ? 'check' : 'content_copy'}
            </span>
            {copied ? 'Copiado!' : 'Copiar Texto'}
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={!hasValidPhone}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 ${
                hasValidPhone
                  ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20 active:scale-95'
                  : 'bg-slate-400 cursor-not-allowed opacity-60'
              }`}
            >
              <span className="material-symbols-outlined text-base">chat</span>
              Abrir no WhatsApp
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Card do Cliente & Inatividade */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 overflow-hidden border border-slate-300 dark:border-white/10">
              {client.avatar ? (
                <img src={client.avatar} alt={client.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-slate-400 text-lg">person</span>
                </div>
              )}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {client.name}
              </h4>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {client.phone ? client.phone : 'Sem telefone cadastrado'}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${status.badgeClass}`}>
              <span className="material-symbols-outlined text-xs">history</span>
              {status.label}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Status da visita</p>
          </div>
        </div>

        {/* Alerta caso não tenha telefone válido */}
        {!hasValidPhone && (
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">warning</span>
            <span>
              Este cliente não possui um telefone celular válido cadastrado. Adicione o telefone no cadastro para habilitar o envio pelo WhatsApp.
            </span>
          </div>
        )}

        {/* Editor de Mensagem */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold uppercase text-slate-500">
              Mensagem Personalizada
            </label>
            <button
              type="button"
              onClick={handleResetDefault}
              className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">restart_alt</span>
              Restaurar Padrão
            </button>
          </div>

          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full bg-white dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl p-3 text-xs leading-relaxed text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-primary shadow-inner custom-scrollbar resize-y"
            placeholder="Digite a mensagem personalizada de reengajamento..."
          />

          <p className="text-[11px] text-slate-400 flex items-center justify-between">
            <span>Você pode editar o texto antes de abrir no WhatsApp.</span>
            <span>{message.length} caracteres</span>
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default ClientReengagementModal;
