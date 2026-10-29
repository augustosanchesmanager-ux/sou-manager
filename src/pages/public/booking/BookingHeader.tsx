/**
 * BookingHeader - Mobile-first header with cover background, tenant profile and navigation tabs.
 * Includes ~170px cover image with dark gradient overlay, overlapping avatar with amber border,
 * high-contrast pure white typography, direct WhatsApp/Instagram buttons,
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
  Sparkles,
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

const DEFAULT_BARBER_COVER =
  'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=1200&q=80';

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

  const displayName = tenant.display_name || tenant.name;
  const displayAddress = tenant.display_address || tenant.address;
  const primaryColor = tenant.primary_color || '#B88A44';
  const monogram = getMonogram(displayName);
  const coverImage = tenant.cover_banner_url || tenant.cover_url || DEFAULT_BARBER_COVER;

  return (
    <header className="bg-neutral-950 border-b border-neutral-800 flex-shrink-0">
      {/* 1. Background Superior (Cover/Hero ~170px) */}
      <div className="relative h-40 sm:h-44 w-full overflow-hidden bg-neutral-950">
        <img
          src={coverImage}
          alt={`Capa ${displayName}`}
          className="w-full h-full object-cover"
        />
        {/* Soft dark gradient overlay for seamless merge to page background */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-neutral-950/60 to-neutral-950" />

        {/* Top Badges & Social Links */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-neutral-700/80 text-[10px] font-bold tracking-wider uppercase"
            style={{ color: primaryColor }}
          >
            <Sparkles size={11} style={{ color: primaryColor }} />
            Agendamento Online
          </span>

          {/* Social Quick Shortcuts */}
          <div className="flex items-center gap-1.5">
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Conversar no WhatsApp"
                className="size-8 rounded-full bg-black/60 backdrop-blur-md border border-emerald-500/50 text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all active:scale-95 shadow-md"
              >
                <MessageCircle size={15} />
              </a>
            )}

            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Visitar Instagram"
                className="size-8 rounded-full bg-black/60 backdrop-blur-md border border-pink-500/50 text-pink-400 flex items-center justify-center hover:bg-gradient-to-tr hover:from-amber-500 hover:to-pink-600 hover:text-white transition-all active:scale-95 shadow-md"
              >
                <Instagram size={15} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* 2. Overlapping Profile Area */}
      <div className="px-4 sm:px-5 pb-3.5 -mt-12 relative z-10">
        <div className="flex items-end gap-3.5">
          {/* Logo / Avatar with Primary Brand Ring */}
          <div
            className="size-18 sm:size-20 rounded-full border-2 p-0.5 flex-shrink-0 overflow-hidden bg-neutral-950 flex items-center justify-center shadow-xl ring-4 ring-neutral-950"
            style={{ borderColor: primaryColor }}
          >
            {tenant.logo_url ? (
              <img
                src={tenant.logo_url}
                alt={displayName}
                className="w-full h-full object-cover rounded-full"
                loading="lazy"
              />
            ) : (
              <div
                className="size-full rounded-full flex items-center justify-center text-neutral-950 font-display font-black text-xl shadow-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {monogram}
              </div>
            )}
          </div>

          {/* Identity & Location */}
          <div className="min-w-0 flex-1 pb-1">
            <h1 className="text-white font-extrabold text-lg sm:text-xl tracking-tight leading-tight truncate drop-shadow-sm">
              {displayName}
            </h1>

            {tenant.slogan && (
              <p
                className="text-[11px] font-semibold truncate mt-0.5"
                style={{ color: primaryColor }}
              >
                {tenant.slogan}
              </p>
            )}

            {/* Address with Google Maps link */}
            {displayAddress && (
              <div className="flex items-center gap-1.5 text-xs text-neutral-300 mt-1">
                <MapPin size={13} className="flex-shrink-0" style={{ color: primaryColor }} />
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:text-amber-400 transition-colors flex items-center gap-1"
                    title={displayAddress}
                  >
                    <span className="truncate">{displayAddress}</span>
                    <ExternalLink size={11} className="flex-shrink-0 opacity-70" />
                  </a>
                ) : (
                  <span className="truncate">{displayAddress}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs Bar with High-Contrast Typography */}
      <div
        role="tablist"
        className="grid grid-cols-4 bg-neutral-950 border-t border-neutral-800 text-center py-1 px-1"
        aria-label="Menu da Barbearia"
      >
        {/* Agendamento */}
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'agendamento'}
          onClick={() => onTabChange('agendamento')}
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'agendamento'
              ? 'font-black'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
          style={activeTab === 'agendamento' ? { color: primaryColor } : undefined}
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
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'servicos'
              ? 'font-black'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
          style={activeTab === 'servicos' ? { color: primaryColor } : undefined}
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
          className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'sobre'
              ? 'font-black'
              : 'text-neutral-400 hover:text-white font-medium'
          }`}
          style={activeTab === 'sobre' ? { color: primaryColor } : undefined}
        >
          <Info size={16} />
          <span className="text-[10px] uppercase tracking-tight">Sobre nós</span>
        </button>

        {/* Fale conosco (Abre WhatsApp direto) */}
        {whatsappUrl ? (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl text-neutral-400 hover:text-white font-medium transition-all"
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
            className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'contato'
                ? 'font-black'
                : 'text-neutral-400 hover:text-white font-medium'
            }`}
            style={activeTab === 'contato' ? { color: primaryColor } : undefined}
          >
            <MessageCircle size={16} />
            <span className="text-[10px] uppercase tracking-tight">Fale conosco</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default BookingHeader;
