/**
 * BookingStickyBottomBar - Fixed Bottom Summary Bar with Total Price, Duration & Continue CTA.
 * Positioned fixed at the bottom with mobile safe-area padding.
 */

import type React from 'react';
import { ArrowRight, Clock } from 'lucide-react';

export interface BookingStickyBottomBarProps {
  selectedCount: number;
  totalPrice: number;
  totalDuration: number;
  onContinue: () => void;
  formatDuration: (minutes: number) => string;
  formatPriceBRL: (price: number) => string;
}

export const BookingStickyBottomBar: React.FC<BookingStickyBottomBarProps> = ({
  selectedCount,
  totalPrice,
  totalDuration,
  onContinue,
  formatDuration,
  formatPriceBRL,
}) => {
  const hasSelected = selectedCount > 0;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 max-w-sm sm:max-w-md mx-auto p-3.5 bg-neutral-950/95 backdrop-blur-md border-t border-neutral-800 z-30 shadow-2xl transition-all"
      style={{ paddingBottom: 'calc(0.875rem + env(safe-area-inset-bottom, 0px))' }}
      role="region"
      aria-label="Resumo dos serviços selecionados"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: Selected count, Price and Duration */}
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-neutral-400 font-medium truncate">
            {hasSelected
              ? `${selectedCount} ${selectedCount === 1 ? 'serviço selecionado' : 'serviços selecionados'}`
              : 'Nenhum serviço selecionado'}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-base sm:text-lg font-extrabold text-white tabular-nums">
              {formatPriceBRL(totalPrice)}
            </span>

            {hasSelected && totalDuration > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-200 text-[10px] font-bold">
                <Clock size={11} className="text-amber-400 flex-shrink-0" />
                <span>{formatDuration(totalDuration)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Right: Continue Action Button */}
        <button
          type="button"
          onClick={onContinue}
          disabled={!hasSelected}
          className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            hasSelected
              ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer'
              : 'bg-neutral-800 text-neutral-500 opacity-40 cursor-not-allowed'
          }`}
          aria-disabled={!hasSelected}
        >
          <span>Continuar</span>
          <ArrowRight size={14} className={hasSelected ? 'translate-x-0.5 transition-transform' : ''} />
        </button>
      </div>
    </div>
  );
};

export default BookingStickyBottomBar;
