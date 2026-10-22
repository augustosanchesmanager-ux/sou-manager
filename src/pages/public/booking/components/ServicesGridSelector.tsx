/**
 * ServicesGridSelector - 2-Column Grid of Barber Services with Multiple Selection.
 * Features:
 * - 2-column layout (grid grid-cols-2 gap-2.5)
 * - Category badge, custom checkbox indicator, 2-line clamp title, duration and price
 * - High contrast dark luxury styling (white titles, amber pricing & active border)
 */

import type React from 'react';
import { Clock, Check, Scissors } from 'lucide-react';
import type { PublicService } from '../hooks/types';

export interface ServicesGridSelectorProps {
  services: PublicService[];
  selectedServiceIds: string[];
  onToggleService: (service: PublicService) => void;
  formatPriceBRL: (price: number) => string;
}

export const ServicesGridSelector: React.FC<ServicesGridSelectorProps> = ({
  services,
  selectedServiceIds,
  onToggleService,
  formatPriceBRL,
}) => {
  if (services.length === 0) {
    return (
      <div className="p-8 text-center bg-neutral-950 border border-neutral-800 rounded-2xl space-y-2">
        <Scissors className="w-8 h-8 text-neutral-600 mx-auto" />
        <p className="text-xs text-neutral-400">Nenhum serviço disponível no momento.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Seleção de serviços">
      {services.map((service) => {
        const isSelected = selectedServiceIds.includes(service.id);

        return (
          <button
            key={service.id}
            type="button"
            onClick={() => onToggleService(service)}
            aria-pressed={isSelected}
            className={`w-full text-left p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col justify-between min-h-[125px] active:scale-[0.98] ${
              isSelected
                ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500 shadow-md'
                : 'bg-neutral-900/90 border-neutral-800 hover:border-neutral-700'
            }`}
          >
            {/* Top row: Category Badge & Selection Checkbox Indicator */}
            <div className="flex items-start justify-between gap-1.5 w-full">
              {service.category ? (
                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800/90 text-amber-400 truncate max-w-[90px]">
                  {service.category}
                </span>
              ) : (
                <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-neutral-800/50 text-neutral-400">
                  Serviço
                </span>
              )}

              {/* Circular Checkbox Indicator */}
              <div
                className={`size-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected
                    ? 'bg-amber-500 border border-amber-400 text-neutral-950 shadow-sm'
                    : 'border border-neutral-700 bg-neutral-800/60 text-transparent'
                }`}
                aria-hidden="true"
              >
                <Check size={12} strokeWidth={3} className={isSelected ? 'opacity-100' : 'opacity-0'} />
              </div>
            </div>

            {/* Middle: Service Name in pure white with line-clamp-2 */}
            <div className="my-2 flex-1 flex items-center">
              <h3 className="font-bold text-xs sm:text-sm text-white line-clamp-2 leading-snug">
                {service.name}
              </h3>
            </div>

            {/* Bottom Row: Duration and Price */}
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-neutral-800/60 w-full text-xs">
              <span className="flex items-center gap-1 text-[11px] text-neutral-300 font-medium">
                <Clock size={11} className="text-amber-400 flex-shrink-0" />
                <span>{service.duration} min</span>
              </span>

              <span className="text-amber-400 font-extrabold text-xs sm:text-sm tabular-nums">
                {formatPriceBRL(service.price)}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ServicesGridSelector;
