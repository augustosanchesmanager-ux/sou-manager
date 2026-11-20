import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  ProductGoalPercentBase,
  ProductGoalRewardType,
  ProductGoalTier,
  ProductGoalTriggerType,
} from '../../domain/productGoals/types';

interface ProductGoalTiersEditorProps {
  tiers: ProductGoalTier[];
  onChange: (next: ProductGoalTier[]) => void;
  roleHint?: 'barber' | 'receptionist' | 'all';
}

export const createEmptyTier = (index: number): ProductGoalTier => ({
  id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  label: `Meta ${index + 1}`,
  triggerType: 'amount_brl',
  thresholdValue: (index + 1) * 1000,
  rewardType: 'fixed_brl',
  rewardValue: (index + 1) * 100,
  percentBase: 'total_sold',
});

export const ProductGoalTiersEditor: React.FC<ProductGoalTiersEditorProps> = ({
  tiers,
  onChange,
  roleHint = 'all',
}) => {
  const updateTier = (index: number, patch: Partial<ProductGoalTier>) => {
    const next = tiers.map((t, i) => (i === index ? { ...t, ...patch } : t));
    onChange(next);
  };

  const removeTier = (index: number) => {
    onChange(tiers.filter((_, i) => i !== index));
  };

  const addTier = () => {
    onChange([...tiers, createEmptyTier(tiers.length)]);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-stone-400">
          Faixas Progressivas ({tiers.length})
        </span>
        <button
          type="button"
          onClick={addTier}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B88A44]/15 text-[#B88A44] hover:bg-[#B88A44]/25 text-[11px] font-bold transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar Faixa
        </button>
      </div>

      {tiers.length === 0 ? (
        <div className="p-3 rounded-lg border border-dashed border-slate-300 dark:border-[#2D2A26] text-center text-xs text-slate-400">
          Nenhuma faixa configurada. Clique em &quot;Adicionar Faixa&quot; para definir metas.
        </div>
      ) : (
        <div className="space-y-2">
          {tiers.map((tier, idx) => (
            <div
              key={tier.id}
              className="p-3 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-white dark:bg-[#0E0C0A] space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={tier.label}
                  onChange={(e) => updateTier(idx, { label: e.target.value })}
                  placeholder={`Meta ${idx + 1}`}
                  className="flex-1 bg-transparent border-b border-slate-200 dark:border-[#2D2A26] pb-1 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-[#B88A44]"
                />
                <button
                  type="button"
                  onClick={() => removeTier(idx)}
                  className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                  title="Remover faixa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Gatilho
                  </label>
                  <select
                    value={tier.triggerType}
                    onChange={(e) =>
                      updateTier(idx, { triggerType: e.target.value as ProductGoalTriggerType })
                    }
                    className="w-full bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="amount_brl">Vendeu a partir de (R$)</option>
                    <option value="goal_percent">Atingiu % da Meta Base</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    {tier.triggerType === 'amount_brl' ? 'Valor Mínimo (R$)' : '% da Meta Base'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={tier.triggerType === 'amount_brl' ? '10' : '5'}
                    value={tier.thresholdValue}
                    onChange={(e) =>
                      updateTier(idx, { thresholdValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    Tipo de Premiação
                  </label>
                  <select
                    value={tier.rewardType}
                    onChange={(e) =>
                      updateTier(idx, { rewardType: e.target.value as ProductGoalRewardType })
                    }
                    className="w-full bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  >
                    <option value="fixed_brl">Prêmio Fixo (R$)</option>
                    <option value="percent">Percentual (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-0.5">
                    {tier.rewardType === 'fixed_brl' ? 'Valor do Prêmio (R$)' : 'Percentual (%)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step={tier.rewardType === 'fixed_brl' ? '10' : '0.5'}
                    value={tier.rewardValue}
                    onChange={(e) =>
                      updateTier(idx, { rewardValue: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-lg px-2 py-1.5 text-xs text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              {tier.rewardType === 'percent' && (
                <div className="pt-1 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    Base do percentual:
                  </span>
                  <select
                    value={tier.percentBase}
                    onChange={(e) =>
                      updateTier(idx, { percentBase: e.target.value as ProductGoalPercentBase })
                    }
                    className="bg-slate-50 dark:bg-[#141210] border border-slate-200 dark:border-[#2D2A26] rounded-lg px-2 py-1 text-[11px] text-slate-900 dark:text-white outline-none"
                  >
                    <option value="total_sold">Sobre o total vendido no período</option>
                    <option value="tier_target">Sobre o valor da faixa atingida</option>
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-400 leading-relaxed">
        {roleHint === 'barber'
          ? 'Para barbeiros, esta bonificação é adicional à comissão padrão de produtos (%). Prevalece a maior faixa atingida.'
          : 'Prevalece a maior faixa atingida no período (progressiva, não cumulativa).'}
      </p>
    </div>
  );
};
