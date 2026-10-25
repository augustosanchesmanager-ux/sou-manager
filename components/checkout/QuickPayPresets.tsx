import React from 'react';

export type QuickPayPresetType = 'pix' | 'cash_exact' | 'debit' | 'credit';

interface QuickPayPresetsProps {
  onSelectPreset: (preset: QuickPayPresetType) => void;
  activeMethod: 'credit' | 'debit' | 'cash' | 'pix' | 'other';
  disabled?: boolean;
}

export const QuickPayPresets: React.FC<QuickPayPresetsProps> = ({
  onSelectPreset,
  activeMethod,
  disabled = false,
}) => {
  const presets: Array<{
    id: QuickPayPresetType;
    label: string;
    sublabel: string;
    icon: string;
    methodMatch: 'pix' | 'cash' | 'debit' | 'credit';
  }> = [
    {
      id: 'pix',
      label: 'Pix Expresso',
      sublabel: 'Integral',
      icon: 'qr_code_2',
      methodMatch: 'pix',
    },
    {
      id: 'cash_exact',
      label: 'Dinheiro',
      sublabel: 'Exato',
      icon: 'attach_money',
      methodMatch: 'cash',
    },
    {
      id: 'debit',
      label: 'Débito',
      sublabel: 'Cartão',
      icon: 'payments',
      methodMatch: 'debit',
    },
    {
      id: 'credit',
      label: 'Crédito',
      sublabel: 'Cartão',
      icon: 'credit_card',
      methodMatch: 'credit',
    },
  ];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-amber-500 text-sm animate-pulse">bolt</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Pagamento Rápido no Balcão
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
          1 toque + [Enter] confirma
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {presets.map((preset) => {
          const isActive = activeMethod === preset.methodMatch;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(preset.id)}
              className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'bg-white dark:bg-card-dark border-slate-200 dark:border-border-dark text-slate-700 dark:text-slate-300 hover:border-amber-400/60 hover:bg-amber-50/50 dark:hover:bg-amber-500/5'
              }`}
            >
              <div
                className={`size-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  isActive
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 group-hover:text-amber-500'
                }`}
              >
                <span className="material-symbols-outlined text-base">{preset.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate leading-tight">{preset.label}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate leading-none mt-0.5">
                  {preset.sublabel}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
