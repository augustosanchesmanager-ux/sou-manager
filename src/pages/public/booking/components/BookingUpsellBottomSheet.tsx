/**
 * BookingUpsellBottomSheet - Bottom Sheet de Upsell & Cross-Sell
 * para o Agendamento Público Online (SMG Barber).
 *
 * Exibido quando o cliente clica em "Continuar" tendo selecionado serviços
 * com complementares diretos (ex: Barba para quem escolheu Corte).
 */

import type React from 'react';
import { useEffect } from 'react';
import { Sparkles, Clock, Plus, ChevronRight, X } from 'lucide-react';
import type { PublicService } from '../hooks/types';

export interface BookingUpsellBottomSheetProps {
  isOpen: boolean;
  suggestedServices: PublicService[];
  onAddService: (service: PublicService) => void;
  onContinue: () => void;
  onClose: () => void;
  formatPriceBRL: (price: number) => string;
}

export const BookingUpsellBottomSheet: React.FC<BookingUpsellBottomSheetProps> = ({
  isOpen,
  suggestedServices,
  onAddService,
  onContinue,
  onClose,
  formatPriceBRL,
}) => {
  // Fecha com a tecla ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || suggestedServices.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upsell-modal-title"
    >
      {/* Backdrop escurecido */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet deslizante inferior */}
      <div className="relative w-full max-w-sm sm:max-w-md bg-neutral-900 border-t border-neutral-800 rounded-t-3xl p-5 shadow-2xl z-10 animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[85vh]">
        {/* Puxador decorativo */}
        <div className="w-10 h-1 bg-neutral-700/80 rounded-full mx-auto mb-3 flex-shrink-0" />

        {/* Header com botão de fechar */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-[10px] tracking-wider uppercase">
              <Sparkles size={11} className="text-amber-400" />
              Complete seu Visual
            </span>
            <h2
              id="upsell-modal-title"
              className="text-base sm:text-lg font-extrabold text-white leading-tight"
            >
              Que tal adicionar ao seu atendimento?
            </h2>
            <p className="text-xs text-neutral-400">
              Aproveite o mesmo horário e saia com o cuidado completo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors flex-shrink-0 cursor-pointer"
            aria-label="Fechar sugestões"
          >
            <X size={16} />
          </button>
        </div>

        {/* Lista de Serviços Sugeridos */}
        <div className="space-y-2.5 overflow-y-auto mb-5 pr-0.5">
          {suggestedServices.map((service) => (
            <div
              key={service.id}
              className="p-3.5 rounded-2xl bg-neutral-950/90 border border-neutral-800/90 hover:border-amber-500/40 transition-all flex items-center justify-between gap-3 shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                    {service.name}
                  </h3>
                  {service.category && (
                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 flex-shrink-0">
                      {service.category}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <span className="flex items-center gap-1 text-[11px] text-neutral-400">
                    <Clock size={11} className="text-amber-400" />
                    +{service.duration} min
                  </span>
                  <span className="font-extrabold text-amber-400 text-xs sm:text-sm tabular-nums">
                    +{formatPriceBRL(service.price)}
                  </span>
                </div>
              </div>

              {/* Botão de Adição Rápida */}
              <button
                type="button"
                onClick={() => onAddService(service)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 text-neutral-950 hover:bg-amber-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 active:scale-95 flex-shrink-0 cursor-pointer"
              >
                <Plus size={14} strokeWidth={2.5} />
                Adicionar
              </button>
            </div>
          ))}
        </div>

        {/* Rodapé / Botão de Avanço sem Adicionar */}
        <button
          type="button"
          onClick={onContinue}
          className="w-full py-3 px-4 rounded-xl bg-neutral-800/90 hover:bg-neutral-800 text-neutral-200 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-neutral-700/60"
        >
          <span>Continuar para o Barbeiro</span>
          <ChevronRight size={14} className="text-neutral-400" />
        </button>
      </div>
    </div>
  );
};

export default BookingUpsellBottomSheet;
