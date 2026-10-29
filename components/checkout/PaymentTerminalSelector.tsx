import React, { useMemo } from 'react';
import type { PaymentTerminalWithRates } from '../../domain/paymentTerminal/types';
import { calculateTerminalFee, findMatchingRate } from '../../domain/paymentTerminal/calculateFee';

interface PaymentTerminalSelectorProps {
  terminals: PaymentTerminalWithRates[];
  selectedTerminalId: string | null;
  onSelectTerminal: (terminalId: string | null) => void;
  method: 'credit' | 'debit';
  amount: number;
  className?: string;
}

export const PaymentTerminalSelector: React.FC<PaymentTerminalSelectorProps> = ({
  terminals,
  selectedTerminalId,
  onSelectTerminal,
  method,
  amount,
  className = '',
}) => {
  // Se não houver maquininhas cadastradas, degradação graciosa para PDV Simples
  if (!terminals || terminals.length === 0) {
    return null;
  }

  const rateMethod = method === 'debit' ? 'debit' : 'credit_sight';

  const selectedTerminal = useMemo(() => {
    return terminals.find((t) => t.id === selectedTerminalId) || null;
  }, [terminals, selectedTerminalId]);

  const feeCalculation = useMemo(() => {
    if (!selectedTerminal) return null;
    const rate = findMatchingRate(selectedTerminal.rates, rateMethod);
    return calculateTerminalFee({
      amount,
      rate,
      paymentDate: new Date(),
    });
  }, [selectedTerminal, rateMethod, amount]);

  return (
    <div className={`mt-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-border-dark animate-fade-in ${className}`}>
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-base">point_of_sale</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Maquininha de Cartão
          </span>
        </div>
        {selectedTerminalId && (
          <button
            type="button"
            onClick={() => onSelectTerminal(null)}
            className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
          >
            Sem maquininha
          </button>
        )}
      </div>

      {/* Chips largos para seleção rápida em 1 clique */}
      <div className="flex flex-wrap gap-2">
        {terminals.map((terminal) => {
          const isSelected = selectedTerminalId === terminal.id;
          const terminalRate = findMatchingRate(terminal.rates, rateMethod);

          return (
            <button
              key={terminal.id}
              type="button"
              onClick={() => onSelectTerminal(terminal.id)}
              className={`flex-1 min-w-[120px] p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                isSelected
                  ? 'bg-primary text-night border-primary shadow-sm shadow-primary/20'
                  : 'bg-white dark:bg-card-dark border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-200 hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-bold truncate">{terminal.name}</span>
                <span
                  className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {terminal.acquirer}
                </span>
              </div>

              {terminalRate && (
                <div
                  className={`text-[10px] font-medium ${
                    isSelected ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Taxa {terminalRate.rate_percentage}% (D+{terminalRate.settlement_days})
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Snapshot informativo de cálculo de taxas e líquido previsto */}
      {selectedTerminal && feeCalculation && feeCalculation.feeAmount > 0 && (
        <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-white/5 flex items-center justify-between text-xs">
          <div className="text-slate-500 dark:text-slate-400">
            <span>Taxa estimada: </span>
            <span className="font-bold text-rose-500">
              -{feeCalculation.feeAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} ({feeCalculation.feePercentage}%)
            </span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 dark:text-slate-400">Líquido previsto: </span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              {feeCalculation.netAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            {feeCalculation.estimatedSettlementDate && (
              <span className="text-[10px] text-slate-400 ml-1">
                (D+{feeCalculation.settlementDays})
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
