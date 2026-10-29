/**
 * AboutUsTab - Institutional information about the barber shop.
 * High-contrast dark luxury typography, address, map link, working hours, and policies.
 */

import type React from 'react';
import { MapPin, Clock, MessageCircle, Instagram, ExternalLink, ShieldCheck } from 'lucide-react';
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

  const displayName = tenant.display_name || tenant.name;
  const displayAddress = tenant.display_address || tenant.address;
  const primaryColor = tenant.primary_color || '#B88A44';

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-sm">
        <div>
          <h3 className="font-display font-bold text-base text-white">Sobre a Barbearia</h3>
          {tenant.slogan && (
            <p
              className="text-xs font-semibold mt-0.5"
              style={{ color: primaryColor }}
            >
              {tenant.slogan}
            </p>
          )}
        </div>

        {tenant.about_text ? (
          <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
            {tenant.about_text}
          </p>
        ) : (
          <p className="text-xs text-neutral-300 leading-relaxed">
            Bem-vindo à <strong className="text-white font-bold">{displayName}</strong>. Nossa equipe de profissionais experientes está pronta para oferecer o melhor atendimento, com produtos de qualidade, ambiente climatizado e técnicas exclusivas.
          </p>
        )}

        {displayAddress && (
          <div className="pt-2 border-t border-neutral-800">
            <div className="flex items-start gap-2.5">
              <MapPin
                className="w-4 h-4 flex-shrink-0 mt-0.5"
                style={{ color: primaryColor }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">Endereço</p>
                <p className="text-xs text-neutral-300 mt-0.5">{displayAddress}</p>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold hover:underline mt-1.5"
                    style={{ color: primaryColor }}
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
      <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3 shadow-sm">
        <h3 className="font-display font-bold text-sm text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          Regras de Atendimento
        </h3>

        <div className="space-y-2.5 text-xs">
          <div className="flex items-start gap-2 text-neutral-300">
            <ShieldCheck className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Antecedência mínima:</strong>{' '}
              {tenant.booking_rules?.min_booking_notice_minutes || 30} minutos antes do horário desejado.
            </span>
          </div>

          <div className="flex items-start gap-2 text-neutral-300">
            <ShieldCheck className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Cancelamento gratuito:</strong> Até {cancelText} antes do horário agendado.
            </span>
          </div>

          <div className="flex items-start gap-2 text-neutral-300">
            <ShieldCheck className="size-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong className="text-white">Confirmação:</strong> Imediata via sistema e integrada ao WhatsApp oficial da barbearia.
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
            className="w-full py-3 px-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
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
            className="w-full py-3 px-4 rounded-xl bg-neutral-900 border border-neutral-800 text-pink-400 hover:border-pink-500/50 hover:bg-neutral-800 transition-all text-xs font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <Instagram className="w-4 h-4" />
            Siga-nos no Instagram
          </a>
        )}
      </div>
    </div>
  );
};
