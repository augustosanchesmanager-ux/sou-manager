/**
 * BookingHeader - Banner/logo area for the public booking page.
 * Shows logo (or monogram fallback), name, address with maps link, and social/location chips.
 */

import React from 'react';
import { MapPin, Instagram, MessageCircle, ExternalLink } from 'lucide-react';
import type { PublicTenantProfile } from './hooks/types';

interface BookingHeaderProps {
  tenant: PublicTenantProfile;
}

const buildSafeInstagramUrl = (raw?: string | null): string | null => {
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

const buildSafeWhatsAppUrl = (raw?: string | null): string | null => {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  const normalized =
    digits.length === 10 || digits.length === 11
      ? `55${digits}`
      : digits;
  return `https://wa.me/${normalized}`;
};

const buildSafeHttpsUrl = (raw?: string | null): string | null => {
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

const BookingHeader: React.FC<BookingHeaderProps> = ({ tenant }) => {
  // Generate monogram from tenant name
  const getMonogram = (name: string): string => {
    const words = name.trim().split(/\s+/);
    if (words.length === 1) {
      return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  };

  const monogram = getMonogram(tenant.name);

  // Resolve sanitized URLs from explicit columns with fallback to social_links
  const instagramUrl = buildSafeInstagramUrl(
    tenant.instagram_url || tenant.social_links?.instagram
  );
  const whatsappUrl = buildSafeWhatsAppUrl(
    tenant.whatsapp_number || tenant.social_links?.whatsapp
  );
  const explicitMapsUrl = buildSafeHttpsUrl(
    tenant.maps_url || tenant.social_links?.maps_url
  );
  const fallbackAddressMapsUrl = tenant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
    : null;
  const mapsUrl = explicitMapsUrl || fallbackAddressMapsUrl;

  return (
    <header className="relative bg-cream border-b border-line px-4 py-4">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--color-gold-pale)_0%,_transparent_70%)] opacity-50" aria-hidden="true" />

      <div className="relative max-w-2xl mx-auto">
        {/* Logo / Monogram */}
        <div className="flex items-center justify-center gap-4 mb-4">
          {tenant.logo_url ? (
            <img
              src={tenant.logo_url}
              alt={tenant.name}
              className="h-14 w-auto rounded-xl object-contain"
              loading="lazy"
            />
          ) : (
            <div
              className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-primary to-primary-dark shadow-smg-glow"
              aria-label={tenant.name}
            >
              <span className="font-display font-black text-2xl text-night tracking-tight">{monogram}</span>
            </div>
          )}
        </div>

        {/* Name */}
        <h1 className="font-display font-black text-2xl text-center text-ink mb-2">{tenant.name}</h1>

        {/* Address with Maps link */}
        {tenant.address && mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm text-ink-soft hover:text-primary transition-colors mb-2"
            aria-label={`Ver no Google Maps: ${tenant.address}`}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-2 text-left">{tenant.address}</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        )}

        {/* Social & Location Chips (SMG Barber Dark/Gold Minimalist Palette) */}
        {(whatsappUrl || instagramUrl || explicitMapsUrl) && (
          <div
            className="flex items-center justify-center gap-2 pt-2 flex-wrap"
            role="list"
            aria-label="Canais de atendimento e localização"
          >
            {/* WhatsApp */}
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir conversa no WhatsApp"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-emerald-500/50 hover:text-emerald-300 hover:bg-zinc-800/80 transition-all duration-200"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                <span>WhatsApp</span>
              </a>
            )}

            {/* Instagram */}
            {instagramUrl && (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir perfil no Instagram"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-pink-500/50 hover:text-pink-300 hover:bg-zinc-800/80 transition-all duration-200"
              >
                <Instagram className="w-3.5 h-3.5 text-pink-400" />
                <span>Instagram</span>
              </a>
            )}

            {/* Google Maps / Como Chegar */}
            {explicitMapsUrl && (
              <a
                href={explicitMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Abrir localização no Google Maps"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium tracking-wide bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:border-amber-500/50 hover:text-amber-300 hover:bg-zinc-800/80 transition-all duration-200"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Como chegar</span>
              </a>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

export default BookingHeader;