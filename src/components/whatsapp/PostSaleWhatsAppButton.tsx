import type React from 'react';
import { useTenantCommunicationConfig } from '../../hooks/useTenantCommunicationConfig';
import {
  buildPostSaleThankYouMessage,
  generateWhatsAppLink,
  isValidWhatsAppPhone,
} from '../../utils/whatsappHub';

export interface PostSaleWhatsAppButtonProps {
  clientName?: string | null;
  clientPhone?: string | null;
  tenantId?: string | null;
  className?: string;
  showMissingPhoneHint?: boolean;
  label?: string;
}

/**
 * Shared Atelier Tech CTA button for sending the post-sale WhatsApp thank-you
 * (and optional Google Review link when configured by the tenant).
 */
export const PostSaleWhatsAppButton: React.FC<PostSaleWhatsAppButtonProps> = ({
  clientName,
  clientPhone,
  tenantId,
  className = '',
  showMissingPhoneHint = false,
  label = 'Enviar Agradecimento (WhatsApp)',
}) => {
  const { barbershopName, bookingUrl, googleReviewUrl } = useTenantCommunicationConfig(tenantId);

  const hasValidPhone = isValidWhatsAppPhone(clientPhone);
  const message = buildPostSaleThankYouMessage({
    clientName: clientName || 'Cliente',
    barbershopName,
    bookingUrl,
    googleReviewUrl,
  });
  const whatsAppUrl = hasValidPhone ? generateWhatsAppLink(clientPhone, message) : null;
  const isDisabled = !hasValidPhone || !whatsAppUrl;

  return (
    <div className={className}>
      {showMissingPhoneHint && !hasValidPhone && (
        <div
          role="status"
          className="mb-2.5 rounded-xl bg-[#1C1A17] border border-[#262626] px-3.5 py-2.5 text-xs text-[#F5F2EB]/75 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-base text-[#B88A44]">
            phone_disabled
          </span>
          <span>Cliente sem telefone cadastrado para envio via WhatsApp.</span>
        </div>
      )}
      <button
        type="button"
        disabled={isDisabled}
        title={
          isDisabled
            ? 'Cliente sem telefone cadastrado'
            : 'Enviar agradecimento e link de avaliação pelo WhatsApp'
        }
        onClick={() => {
          if (whatsAppUrl) {
            window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
          }
        }}
        className="w-full py-3.5 px-5 rounded-xl font-bold text-sm bg-[#B88A44] hover:bg-[#a67a38] text-[#141414] transition-all flex items-center justify-center gap-2 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer shadow-sm"
      >
        <span className="material-symbols-outlined text-lg">chat</span>
        <span>{label}</span>
      </button>
    </div>
  );
};
