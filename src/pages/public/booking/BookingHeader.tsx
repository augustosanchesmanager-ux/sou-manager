/**
 * BookingHeader - Mobile-first header with tenant profile and navigation tabs.
 * Includes logo/avatar, shop name, address with maps link, direct WhatsApp/Instagram buttons,
 * and top navigation tabs (Agendamento, Serviços, Sobre nós, Fale conosco).
 */

import type React from 'react';
import {
  Calendar as CalendarIcon,
  Scissors,
  Info,
  MessageCircle,
  MapPin,
  Instagram,
  ExternalLink,
} from 'lucide-react';
import type { PublicTenantProfile } from './hooks/types';

export type BookingNavigationTab = 'agendamento' | 'servicos' | 'sobre' | 'contato';

interface BookingHeaderProps {
  tenant: PublicTenantProfile;
  activeTab: BookingNavigationTab;
  onTabChange: (tab: BookingNavigationTab) => void;
  whatsappUrl: string | null;
  instagramUrl: string | null;
  mapsUrl: string | null;
}

export const buildSafeInstagramUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^https?:\/\//i.test(trimmed)) {
    const secureUrl = trimmed.replace(/^http:\/\//i, 'https://');
    try {
      const parsed = new URL(secureUrl);
      return parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  const handle = trimmed
    .replace(/^@+/, '')
    .replace(/^(www\.)?instagram\.com\//i, '')
    .replace(/\/+$/, '')
    .trim();

  if (!handle) return null;
  return `https://instagram.com/${encodeURIComponent(handle)}`;
};

export const buildSafeWhatsAppUrl = (raw?: string | null, customMsg?: string): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const normalized =
    digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits;

  const query = customMsg ? `?text=${encodeURIComponent(customMsg)}` : '';
  return `https://wa.me/${normalized}${query}`;
};

export const buildSafeHttpsUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidate = /^https?:\/\//i.test(trimmed)
    ? trimmed.replace(/^http:\/\//i, 'https://')
    : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
};

const BookingHeader: React.FC<BookingHeaderProps> = ({
  tenant,
  activeTab,
  onTabChange,
  whatsappUrl,
  instagramUrl,
  mapsUrl,
}) => {
  // Generate monogram from tenant name
  const getMonogram = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const monogram = getMonogram(tenant.name);

  return (
    <header className="bg-gradient-to-b from-surface-dark to-card-dark border-b border-border-dark flex-shrink-0">
      {/* Top Profile Area */}
      <div className="p-4 sm:p-5 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Avatar and Identity */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Logo / Monogram */}
            <div className="size-13 sm:size-14 rounded-full border-2 border-primary/70 p-0.5 flex-shrink-0 overflow-hidden bg-background-dark flex items-center justify-center shadow-inner">
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                />
              ) : (
                <div className="size-full rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-night font-display font-black text-base shadow-sm">
                  {monogram}
                </div>
              )}
            </div>

            {/* Shop Info */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">
                SMG Agendamentos
              </span>
              <h1 className="text-base font-bold text-cream tracking-tight leading-tight truncate">
                {tenant.name}
              </h1>

              {/* Address with Google Maps link */}
              {tenant.address && (
                <div className="flex items-center gap-1 text-[11px] text-ink-soft mt-1">
                  <MapPin size={12} className="text-primary flex-shrink-0" />
                  {mapsUrl ? (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate hover:text-primary transition-colors flex items-center gap-1"
                      title={tenant.address}
                    >
                      <span className="truncate">{tenant.address}</span>
                      <ExternalLink size={10} className="flex-shrink-0 opacity-60" />
                    </a>
                  ) : (
                    <span className="truncate">{tenant.address}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Social Hyperlinks (WhatsApp and Instagram) */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {/* WhatsApp */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Conversar no WhatsApp"
                className="size-8 rounded-full bg-emerald-950/70 border border-emerald-600/40 text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <MessageCircle size={16} />
              </a>
            )}

            {/* Instagram */}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Visitar Instagram"
                className="size-8 rounded-full bg-pink-950/70 border border-pink-600/40 text-pink-400 flex items-center justify-center hover:bg-pink-600 hover:text-white transition-all active:scale-95 shadow-sm"
              >
                <Instagram size={16} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav
        className="grid grid-cols-4 bg-background-dark/90 border-t border-border-dark text-center py-1.5 px-1"
        aria-label="Menu da Barbearia"
      >
        {/* Agendamento */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'agendamento'}
          onClick={() => onTabChange('agendamento')}
          className={`flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'agendamento'
              ? 'text-primary font-bold'
              : 'text-ink-soft hover:text-cream font-medium'
          }`}
        >
          <CalendarIcon size={16} />
          <span className="text-[10px] uppercase tracking-tight">Agendamento</span>
        </button>

        {/* Serviços */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'servicos'}
          onClick={() => onTabChange('servicos')}
          className={`flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'servicos'
              ? 'text-primary font-bold'
              : 'text-ink-soft hover:text-cream font-medium'
          }`}
        >
          <Scissors size={16} />
          <span className="text-[10px] uppercase tracking-tight">Serviços</span>
        </button>

        {/* Sobre nós */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sobre'}
          onClick={() => onTabChange('sobre')}
          className={`flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'sobre'
              ? 'text-primary font-bold'
              : 'text-ink-soft hover:text-cream font-medium'
          }`}
        >
          <Info size={16} />
          <span className="text-[10px] uppercase tracking-tight">Sobre nós</span>
        </button>

        {/* Fale conosco (Abre WhatsApp direto se disponível ou muda tab) */}
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            role="tab"
            className="flex flex-col items-center gap-1 py-1 px-1 rounded-xl text-ink-soft hover:text-cream font-medium transition-all"
          >
            <MessageCircle size={16} />
            <span className="text-[10px] uppercase tracking-tight">Fale conosco</span>
          </a>
        ) : (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'contato'}
            onClick={() => onTabChange('contato')}
            className={`flex flex-col items-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'contato'
                ? 'text-primary font-bold'
                : 'text-ink-soft hover:text-cream font-medium'
            }`}
          >
            <MessageCircle size={16} />
            <span className="text-[10px] uppercase tracking-tight">Fale conosco</span>
          </button>
        )}
      </nav>
    </header>
  );
};

export default BookingHeader;
