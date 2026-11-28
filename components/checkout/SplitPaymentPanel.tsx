import React from 'react';
import { formatCurrency } from '../../shared/format/currency';

export type SplitMethodId = 'credit' | 'debit' | 'pix' | 'cash' | 'other';

export interface SplitPaymentDraft {
  id: string;
  paymentMethod: SplitMethodId;
  amount: string;
  description?: string;
}

const METHOD_OPTIONS: Array<{ id: SplitMethodId; label: string; icon: string }> = [
  { id: 'pix', label: 'Pix', icon: 'qr_code_2' },
  { id: 'credit', label: 'Crédito', icon: 'credit_card' },
  { id: 'debit', label: 'Débito', icon: 'payments' },
  { id: 'cash', label: 'Dinheiro', icon: 'attach_money' },
  { id: 'other', label: 'Outro', icon: 'more_horiz' },
];

interface SplitPaymentPanelProps {
  enabled: boolean;
  isSplitMode: boolean;
  onToggleSplitMode: (next: boolean) => void;
  remainingTotal: number;
  splits: SplitPaymentDraft[];
  onChangeSplits: (next: SplitPaymentDraft[]) => void;
  disabled?: boolean;
}

export const SplitPaymentPanel: React.FC<SplitPaymentPanelProps> = ({
  enabled,
  isSplitMode,
  onToggleSplitMode,
  remainingTotal,
  splits,
  onChangeSplits,
  disabled = false,
}) => {
  if (!enabled) return null;

  const parseAmount = (val: string) => {
    const parsed = parseFloat(val.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const sumAllocated = splits.reduce((acc, row) => acc + parseAmount(row.amount), 0);
  const diffRemaining = Math.round((remainingTotal - sumAllocated) * 100) / 100;

  const handleEnableSplit = () => {
    const half = Math.round((remainingTotal / 2) * 100) / 100;
    const rest = Math.max(0, Math.round((remainingTotal - half) * 100) / 100);
    onChangeSplits([
      { id: `split-1-${Date.now()}`, paymentMethod: 'pix', amount: half > 0 ? half.toFixed(2) : '' },
      { id: `split-2-${Date.now()}`, paymentMethod: 'credit', amount: rest > 0 ? rest.toFixed(2) : '' },
    ]);
    onToggleSplitMode(true);
  };

  const handleAddRow = () => {
    const suggested = diffRemaining > 0.01 ? diffRemaining.toFixed(2) : '';
    onChangeSplits([
      ...splits,
      { id: `split-${splits.length + 1}-${Date.now()}`, paymentMethod: 'cash', amount: suggested },
    ]);
  };

  const handleRemoveRow = (id: string) => {
    const next = splits.filter((row) => row.id !== id);
    if (next.length < 2) {
      onToggleSplitMode(false);
      onChangeSplits([]);
      return;
    }
    onChangeSplits(next);
  };

  const handleUpdateRow = (id: string, patch: Partial<SplitPaymentDraft>) => {
    onChangeSplits(splits.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  if (!isSplitMode) {
    return (
      <div className="mt-3">
        <button
          type="button"
          disabled={disabled || remainingTotal <= 0}
          onClick={handleEnableSplit}
          className="w-full py-2.5 px-3 rounded-xl border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 text-primary-dark dark:text-primary text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-base">call_split</span>
          Dividir em múltiplas formas de pagamento (Split)
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 p-4 rounded-xl border border-primary/40 bg-cream space-y-3 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-primary text-base">call_split</span>
          <span className="text-xs font-black uppercase tracking-wider text-ink">
            Múltiplas Formas (ADR-059)
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            onToggleSplitMode(false);
            onChangeSplits([]);
          }}
          className="text-[11px] font-bold text-ink-soft hover:text-ink underline"
        >
          Voltar para 1 forma
        </button>
      </div>

      <div className="space-y-2.5">
        {splits.map((row, idx) => (
          <div key={row.id} className="p-2.5 rounded-lg bg-card border border-line space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={row.paymentMethod}
                disabled={disabled}
                onChange={(e) => handleUpdateRow(row.id, { paymentMethod: e.target.value as SplitMethodId })}
                aria-label={`Forma de pagamento ${idx + 1}`}
                className="flex-1 bg-cream border border-line rounded-lg px-2.5 py-2 text-xs font-bold text-ink outline-none focus:border-primary"
              >
                {METHOD_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-ink-soft">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  disabled={disabled}
                  value={row.amount}
                  onChange={(e) => handleUpdateRow(row.id, { amount: e.target.value })}
                  placeholder="0,00"
                  className="w-full pl-8 pr-2 py-2 bg-cream border border-line rounded-lg text-xs font-bold text-ink text-right tabular-nums outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => handleRemoveRow(row.id)}
                title="Remover parcela"
                className="p-1.5 text-ink-soft hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>

            {row.paymentMethod === 'other' && (
              <input
                type="text"
                disabled={disabled}
                value={row.description || ''}
                onChange={(e) => handleUpdateRow(row.id, { description: e.target.value })}
                placeholder="Descreva a forma de pagamento..."
                className="w-full bg-cream border border-line rounded-lg px-2.5 py-1.5 text-xs text-ink outline-none focus:border-primary"
              />
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={handleAddRow}
        className="w-full py-2 rounded-lg border border-line bg-card hover:border-primary/50 text-xs font-bold text-ink-soft hover:text-ink flex items-center justify-center gap-1 transition-colors"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Adicionar outra forma de pagamento
      </button>

      {/* Resumo de conferência */}
      <div className="pt-2 border-t border-line flex flex-col gap-1 text-xs">
        <div className="flex items-center justify-between text-ink-soft">
          <span>Saldo a pagar</span>
          <span className="font-bold text-ink tabular-nums">{formatCurrency(remainingTotal)}</span>
        </div>
        <div className="flex items-center justify-between text-ink-soft">
          <span>Soma das parcelas</span>
          <span className="font-bold text-ink tabular-nums">{formatCurrency(sumAllocated)}</span>
        </div>
        <div className="flex items-center justify-between pt-1">
          <span className="font-bold text-ink-soft">Resultado</span>
          {diffRemaining < -0.01 ? (
            <span className="font-black text-danger">
              Excede {formatCurrency(Math.abs(diffRemaining))}
            </span>
          ) : Math.abs(diffRemaining) <= 0.01 ? (
            <span className="font-black text-success">
              Quita 100% no Caixa
            </span>
          ) : (
            <span className="font-black text-warning">
              Parcial · Restam {formatCurrency(diffRemaining)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SplitPaymentPanel;
