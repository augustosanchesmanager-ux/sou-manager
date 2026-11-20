import React from 'react';
import { Trophy } from 'lucide-react';
import type {
  ProductGoalPeriod,
  ProductGoalTemplate,
  ProductGoalTier,
} from '../../domain/productGoals/types';
import { ProductGoalTiersEditor } from './ProductGoalTiersEditor';

export type StaffGoalMode = 'inherit_role' | 'template' | 'custom';

export interface StaffProductGoalFormState {
  mode: StaffGoalMode;
  templateId: string;
  periodType: ProductGoalPeriod;
  baseGoalAmount: string;
  customTiers: ProductGoalTier[];
}

interface StaffProductGoalSectionProps {
  role: string;
  templates: ProductGoalTemplate[];
  value: StaffProductGoalFormState;
  onChange: (next: StaffProductGoalFormState) => void;
}

export const StaffProductGoalSection: React.FC<StaffProductGoalSectionProps> = ({
  role,
  templates,
  value,
  onChange,
}) => {
  const isBarber = role === 'barber';
  const normalizedRole = role === 'receptionist' ? 'receptionist' : isBarber ? 'barber' : 'all';
  const inheritedTemplate =
    templates.find((t) => t.active && t.targetRole === normalizedRole) ??
    templates.find((t) => t.active && t.targetRole === 'all');

  return (
    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2D2A26] bg-slate-50/60 dark:bg-[#141210] space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#B88A44]" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isBarber
              ? 'Bonificação Adicional por Meta de Produtos'
              : 'Metas de Venda de Produtos (R$)'}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase text-[#B88A44]">
          {isBarber ? 'Extra além da comissão' : 'Premiação'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'inherit_role' })}
          className={`p-2 rounded-lg border text-left text-xs transition-all ${
            value.mode === 'inherit_role'
              ? 'border-[#B88A44] bg-[#B88A44]/10 text-slate-900 dark:text-white font-bold'
              : 'border-slate-200 dark:border-[#2D2A26] text-slate-500 dark:text-stone-400'
          }`}
        >
          Padrão do Cargo
          <span className="block text-[10px] font-normal opacity-80 truncate">
            {inheritedTemplate ? inheritedTemplate.name : 'Sem modelo padrão'}
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            onChange({
              ...value,
              mode: 'template',
              templateId: value.templateId || templates[0]?.id || '',
            })
          }
          className={`p-2 rounded-lg border text-left text-xs transition-all ${
            value.mode === 'template'
              ? 'border-[#B88A44] bg-[#B88A44]/10 text-slate-900 dark:text-white font-bold'
              : 'border-slate-200 dark:border-[#2D2A26] text-slate-500 dark:text-stone-400'
          }`}
        >
          Vincular Modelo
          <span className="block text-[10px] font-normal opacity-80">
            Escolher regra pronta
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'custom' })}
          className={`p-2 rounded-lg border text-left text-xs transition-all ${
            value.mode === 'custom'
              ? 'border-[#B88A44] bg-[#B88A44]/10 text-slate-900 dark:text-white font-bold'
              : 'border-slate-200 dark:border-[#2D2A26] text-slate-500 dark:text-stone-400'
          }`}
        >
          Personalizada
          <span className="block text-[10px] font-normal opacity-80">
            Faixas exclusivas
          </span>
        </button>
      </div>

      {value.mode === 'template' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Modelo Selecionado
            </label>
            <select
              value={value.templateId}
              onChange={(e) => onChange({ ...value, templateId: e.target.value })}
              className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
            >
              <option value="">Selecione um modelo...</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name} ({tpl.tiers.length} faixa(s))
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              Meta Base Individual (R$ opcional)
            </label>
            <input
              type="number"
              min="0"
              step="10"
              value={value.baseGoalAmount}
              onChange={(e) => onChange({ ...value, baseGoalAmount: e.target.value })}
              placeholder="0 = usar do modelo"
              className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Periodicidade
              </label>
              <select
                value={value.periodType}
                onChange={(e) =>
                  onChange({ ...value, periodType: e.target.value as ProductGoalPeriod })
                }
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
              >
                <option value="monthly">Mensal</option>
                <option value="biweekly">Quinzenal</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                Meta Base (R$)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={value.baseGoalAmount}
                onChange={(e) => onChange({ ...value, baseGoalAmount: e.target.value })}
                placeholder="Ex: 1500"
                className="w-full bg-white dark:bg-[#0E0C0A] border border-slate-200 dark:border-[#2D2A26] rounded-lg p-2 text-xs text-slate-900 dark:text-white outline-none"
              />
            </div>
          </div>

          <ProductGoalTiersEditor
            tiers={value.customTiers}
            onChange={(customTiers) => onChange({ ...value, customTiers })}
            roleHint={isBarber ? 'barber' : 'receptionist'}
          />
        </div>
      )}
    </div>
  );
};
