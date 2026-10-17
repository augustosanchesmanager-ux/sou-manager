/**
 * BookingHeader - Banner/logo area for the public booking page.
 * Shows logo (or monogram fallback), name, address with maps link, social tags.
 */

import React from 'react';
import { MapPin, Instagram, MessageCircle, Globe, ExternalLink } from 'lucide-react';
import type { PublicTenantProfile } from './hooks/types';

interface BookingHeaderProps {
  tenant: PublicTenantProfile;
}

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

  // Build Google Maps URL
  const mapsUrl = tenant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tenant.address)}`
    : null;

  // Social links
  const socialLinks = tenant.social_links
    ? [
        tenant.social_links.instagram && {
          label: 'Instagram',
          href: `https://instagram.com/${tenant.social_links.instagram.replace('@', '')}`,
          icon: Instagram,
        },
        tenant.social_links.whatsapp && {
          label: 'WhatsApp',
          href: `https://wa.me/${tenant.social_links.whatsapp.replace(/\D/g, '')}`,
          icon: MessageCircle,
        },
        tenant.social_links.website && {
          label: 'Site',
          href: tenant.social_links.website.startsWith('http')
            ? tenant.social_links.website
            : `https://${tenant.social_links.website}`,
          icon: Globe,
        },
      ].filter(Boolean)
    : [];

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
            className="flex items-center justify-center gap-1.5 text-sm text-ink-soft hover:text-primary transition-colors mb-4"
            aria-label={`Ver no Google Maps: ${tenant.address}`}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="line-clamp-2 text-left">{tenant.address}</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>
        )}

        {/* Social tags */}
        {socialLinks.length > 0 && (
          <div className="flex items-center justify-center gap-2 flex-wrap" role="list" aria-label="Redes sociais">
            {socialLinks.map((social, index) => {
              const Icon = social!.icon;
              return (
                <a
                  key={index}
                  href={social!.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-line bg-white/80 dark:bg-card-dark/80 text-xs font-medium text-ink-soft hover:border-primary/50 hover:text-primary transition-all"
                  aria-label={social!.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{social!.label}</span>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};

export default BookingHeader;