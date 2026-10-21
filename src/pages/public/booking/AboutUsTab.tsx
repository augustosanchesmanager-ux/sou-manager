/**
 * AboutUsTab - Institutional information about the barber shop.
 * Displays address, map link, working hours, and booking rules.
 */

import type React from 'react';
import { MapPin, Clock, MessageCircle, Instagram, ExternalLink } from 'lucide-react';
import type { PublicTenantProfile } from './hooks/types';

interface AboutUsTabProps {
  tenant: PublicTenantProfile;
  mapsUrl: string | null;
  whatsappUrl: string | null;
  instagramUrl: string | null;
}

export const AboutUsTab: React.FC<AboutUsTabProps> = ({
  tenant,
  mapsUrl,
  whatsappUrl,
  instagramUrl,
}) => {
  const cancelWindowMinutes = tenant.booking_rules?.public_cancel_window_minutes || 120;
  const cancelHours = Math.floor(cancelWindowMinutes / 60);
  const cancelMins = cancelWindowMinutes % 60;
  const cancelText = cancelHours > 0
    ? `${cancelHours}h${cancelMins > 0 ? ` ${cancelMins}min` : ''}`
    : `${cancelMins}min`;

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 rounded-2xl bg-card-dark border border-border-dark space-y-3">
        <h3 className="font-display font-bold text-base text-cream">Sobre a Barbearia</h3>
        <p className="text-xs text-ink-soft leading-relaxed">
          Bem-vindo à <strong className="text-cream">{tenant.name}</strong>. Nossa equipe de profissionais experientes está pronta para oferecer o melhor atendimento, com produtos de qualidade e técnicas exclusivas.
        </p>

        {tenant.address && (
          <div className="pt-2 border-t border-border-dark">
            <div className="flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-cream">Endereço</p>
                <p className="text-xs text-ink-soft mt-0.5">{tenant.address}</p>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline mt-1.5"
                  >
                    <span>Abrir no Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rules & Policy Card */}
      <div className="p-4 rounded-2xl bg-card-dark border border-border-dark space-y-3">
        <h3 className="font-display font-bold text-sm text-cream flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Informações de Atendimento
        </h3>

        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2 text-ink-soft">
            <span className="text-primary font-bold">•</span>
            <span>
              <strong className="text-cream">Antecedência mínima:</strong>{' '}
              {tenant.booking_rules?.min_booking_notice_minutes || 30} minutos antes do horário desejado.
            </span>
          </div>

          <div className="flex items-start gap-2 text-ink-soft">
            <span className="text-primary font-bold">•</span>
            <span>
              <strong className="text-cream">Cancelamento gratuito:</strong> Até {cancelText} antes do horário agendado.
            </span>
          </div>

          <div className="flex items-start gap-2 text-ink-soft">
            <span className="text-primary font-bold">•</span>
            <span>
              <strong className="text-cream">Confirmação:</strong> Imediata via sistema e integrada ao WhatsApp da barbearia.
            </span>
          </div>
        </div>
      </div>

      {/* Direct Contact Buttons */}
      <div className="space-y-2 pt-1">
        {whatsappUrl && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-emerald-950/60 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Tirar dúvidas pelo WhatsApp
          </a>
        )}

        {instagramUrl && (
          <a
            href={instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-xl bg-card-dark border border-border-dark text-pink-400 hover:border-pink-500/50 hover:bg-surface-dark transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
          >
            <Instagram className="w-4 h-4" />
            Siga-nos no Instagram
          </a>
        )}
      </div>
    </div>
  );
};
