import React, { useMemo } from 'react';
import {
  generateCashSuggestions,
  calculateCashChange,
  formatBrlCurrency,
} from '../../src/utils/checkoutQuickPay';

interface QuickCashCalculatorProps {
  total: number;
  tenderedAmount: number;
  onTenderedChange: (amount: number) => void;
  className?: string;
}

export const QuickCashCalculator: React.FC<QuickCashCalculatorProps> = ({
  total,
  tenderedAmount,
  onTenderedChange,
  className = '',
}) => {
  const suggestions = useMemo(() => {
    return generateCashSuggestions(total);
  }, [total]);

  const changeResult = useMemo(() => {
    return calculateCashChange(total, tenderedAmount);
  }, [total, tenderedAmount]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onTenderedChange(total);
    }
  };

  return (
    <div
      className={`mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-border-dark animate-fade-in ${className}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-emerald-500 text-base">point_of_sale</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Calculadora de Cédulas & Troco
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          [Esc] volta para o valor exato
        </span>
      </div>

      {/* Cédulas e presets rápidos */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {suggestions.map((suggestion, index) => {
          const isSelected = Math.abs(tenderedAmount - suggestion) < 0.001;
          const isExact = index === 0;

          return (
            <button
              key={suggestion}
              type="button"
              onClick={() => onTenderedChange(suggestion)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-500/20'
                  : 'bg-white dark:bg-card-dark border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:border-emerald-500/60 hover:text-emerald-600'
              }`}
            >
              <span className="text-[11px] opacity-80">{isExact ? 'Exato:' : 'Cédula:'}</span>
              <span>{formatBrlCurrency(suggestion)}</span>
            </button>
          );
        })}
      </div>

      {/* Campo livre de valor entregue */}
      <div className="mb-3">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
          Valor Entregue pelo Cliente (R$)
        </label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
            R$
          </span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={tenderedAmount > 0 ? tenderedAmount : ''}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              onTenderedChange(isNaN(val) ? 0 : val);
            }}
            onKeyDown={handleKeyDown}
            placeholder="0,00"
            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-card-dark border border-slate-200 dark:border-border-dark rounded-xl text-sm font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      {/* Indicador de Troco / Saldo Faltante */}
      {changeResult.status === 'over' && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-emerald-600 dark:text-emerald-400">
              price_check
            </span>
            <span className="text-xs font-bold uppercase tracking-wide">Troco a Devolver:</span>
          </div>
          <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
            {formatBrlCurrency(changeResult.change)}
          </span>
        </div>
      )}

      {changeResult.status === 'exact' && (
        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-border-dark bg-slate-100/50 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400 flex items-center justify-between text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-slate-400">check_circle</span>
            Pagamento em valor exato
          </span>
          <span className="font-bold">Sem troco</span>
        </div>
      )}

      {changeResult.status === 'under' && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-lg text-amber-600 dark:text-amber-400">
              warning
            </span>
            <span className="text-xs font-bold uppercase tracking-wide">Valor Insuficiente:</span>
          </div>
          <span className="text-sm font-black text-amber-600 dark:text-amber-400">
            Faltam {formatBrlCurrency(changeResult.remaining)}
          </span>
        </div>
      )}
    </div>
  );
};
