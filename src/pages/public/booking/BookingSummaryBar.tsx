/**
 * BookingSummaryBar - Fixed bottom bar with total duration, total price, and primary CTA.
 * Safe-area padding for mobile. Gold gradient CTA.
 */

import React from 'react';
import { ArrowRight, ChevronLeft, Clock, Tag, Loader2 } from 'lucide-react';

interface BookingSummaryBarProps {
  totalDuration: number;
  totalPrice: number;
  canAdvance: boolean;
  canBack: boolean;
  onAdvance: () => void;
  onBack: () => void;
  isLoading?: boolean;
  ctaText?: string;
  formatDuration: (minutes: number) => string;
  formatPriceBRL: (price: number) => string;
}

const BookingSummaryBar: React.FC<BookingSummaryBarProps> = ({
  totalDuration,
  totalPrice,
  canAdvance,
  canBack,
  onAdvance,
  onBack,
  isLoading,
  ctaText = 'Avançar',
  formatDuration,
  formatPriceBRL,
}) => {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card-dark/95 backdrop-blur-xl border-t border-line px-4"
      style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      role="region"
      aria-label="Resumo do agendamento"
    >
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-4">
          {/* Duration */}
          <div className="flex items-center gap-2 text-sm font-medium text-ink-soft">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="font-bold text-ink tabular-nums">{formatDuration(totalDuration)}</span>
          </div>

          {/* Price highlight */}
          <div className="flex items-center gap-1.5 text-lg font-black text-ink tabular-nums">
            <Tag className="w-5 h-5 flex-shrink-0" />
            {formatPriceBRL(totalPrice)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {canBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={isLoading}
              className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl border-2 border-line bg-white dark:bg-card-dark text-ink font-bold text-sm transition-all hover:border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Voltar"
            >
              <ChevronLeft className="w-5 h-5" />
              Voltar
            </button>
          )}

          <button
            type="button"
            onClick={onAdvance}
            disabled={!canAdvance || isLoading}
            className={`flex-1 py-4 rounded-2xl font-black text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed ${
              canAdvance && !isLoading
                ? 'bg-gradient-to-r from-primary to-primary-dark text-night shadow-lg shadow-primary/30 hover:from-primary/90 hover:to-primary-dark/90 hover:-translate-y-0.5'
                : 'bg-line text-ink-soft'
            }`}
            aria-disabled={!canAdvance || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Processando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                {ctaText}
                <ArrowRight className="w-5 h-5" />
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingSummaryBar;