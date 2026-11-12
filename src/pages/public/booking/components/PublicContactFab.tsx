import type React from 'react';
import { MessageCircle, Instagram } from 'lucide-react';

interface PublicContactFabProps {
  whatsappUrl: string | null;
  instagramUrl: string | null;
}

export const PublicContactFab: React.FC<PublicContactFabProps> = ({
  whatsappUrl,
  instagramUrl,
}) => {
  if (!whatsappUrl && !instagramUrl) return null;

  return (
    <nav
      className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-6"
      aria-label="Atalhos rápidos de contato"
    >
      {instagramUrl && (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir Instagram da barbearia"
          className="w-11 h-11 rounded-full bg-neutral-950/95 border border-[#B88A44]/60 text-[#F5EFE6] hover:bg-[#B88A44] hover:text-neutral-950 shadow-lg shadow-black/60 flex items-center justify-center transition-all"
        >
          <Instagram className="w-5 h-5" />
        </a>
      )}
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Falar no WhatsApp da barbearia"
          className="px-4 py-2.5 rounded-full bg-[#B88A44] hover:bg-[#a37838] text-neutral-950 font-extrabold text-xs shadow-xl shadow-[#B88A44]/25 border border-[#F5EFE6]/30 flex items-center gap-2 transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp</span>
        </a>
      )}
    </nav>
  );
};
