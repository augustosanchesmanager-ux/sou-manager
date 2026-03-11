import React from 'react';
import { Search } from 'lucide-react';
import { FilterState } from './types';

interface SelectOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  filters: FilterState;
  onChange: (key: keyof FilterState, value: string) => void;
  accountOptions: SelectOption[];
  categoryOptions: SelectOption[];
  costCenterOptions: SelectOption[];
  paymentOptions: SelectOption[];
}

const baseInputClassName =
  'h-10 rounded-xl border border-slate-200 dark:border-border-dark bg-white/95 dark:bg-[#111111] px-3 text-sm text-slate-700 dark:text-slate-200 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition';

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onChange,
  accountOptions,
  categoryOptions,
  costCenterOptions,
  paymentOptions,
}) => {
  return (
    <section className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/90 dark:bg-card-dark/90 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.06)] backdrop-blur-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
        <select className={baseInputClassName} value={filters.period} onChange={(e) => onChange('period', e.target.value)}>
          <option value="hoje">Hoje</option>
          <option value="7dias">Últimos 7 dias</option>
          <option value="30dias">Últimos 30 dias</option>
          <option value="mesAtual">Mês atual</option>
          <option value="personalizado">Personalizado</option>
        </select>

        <select className={baseInputClassName} value={filters.accountId} onChange={(e) => onChange('accountId', e.target.value)}>
          {accountOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select className={baseInputClassName} value={filters.category} onChange={(e) => onChange('category', e.target.value)}>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select className={baseInputClassName} value={filters.costCenter} onChange={(e) => onChange('costCenter', e.target.value)}>
          {costCenterOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select className={baseInputClassName} value={filters.status} onChange={(e) => onChange('status', e.target.value)}>
          <option value="todos">Todos os status</option>
          <option value="realizado">Realizado</option>
          <option value="previsto">Previsto</option>
          <option value="vencido">Vencido</option>
        </select>

        <select className={baseInputClassName} value={filters.paymentMethod} onChange={(e) => onChange('paymentMethod', e.target.value)}>
          {paymentOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <label className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            value={filters.search}
            onChange={(e) => onChange('search', e.target.value)}
            placeholder="Buscar por descrição"
            className={`${baseInputClassName} w-full pl-9`}
          />
        </label>
      </div>

      {filters.period === 'personalizado' && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="date" value={filters.customStart} onChange={(e) => onChange('customStart', e.target.value)} className={baseInputClassName} />
          <input type="date" value={filters.customEnd} onChange={(e) => onChange('customEnd', e.target.value)} className={baseInputClassName} />
        </div>
      )}
    </section>
  );
};

export default FilterBar;
