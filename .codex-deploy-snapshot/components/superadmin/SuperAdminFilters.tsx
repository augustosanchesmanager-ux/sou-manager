import React from 'react';
import Button from '../ui/Button';
import { AdminFilterState } from './types';

interface FilterOption {
  value: string;
  label: string;
}

interface SuperAdminFiltersProps {
  value: AdminFilterState;
  onChange: (next: AdminFilterState) => void;
  onReset: () => void;
  onSaveView: () => void;
  options: {
    periods: FilterOption[];
    companies: FilterOption[];
    statuses: FilterOption[];
    movementTypes: FilterOption[];
    plans: FilterOption[];
    users: FilterOption[];
    financialStates: FilterOption[];
    blockedStates: FilterOption[];
  };
}

const FilterSelect: React.FC<{
  label: string;
  selected: string;
  onChange: (value: string) => void;
  options: FilterOption[];
}> = ({ label, selected, onChange, options }) => (
  <label className="flex min-w-[150px] flex-1 flex-col gap-2">
    <span className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">{label}</span>
    <select
      value={selected}
      onChange={(event) => onChange(event.target.value)}
      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-[#262A33] dark:bg-white/5 dark:text-slate-100"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

const SuperAdminFilters: React.FC<SuperAdminFiltersProps> = ({ value, onChange, onReset, onSaveView, options }) => (
  <section className="card-boutique p-5">
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">Filtros avancados</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Refine periodo, risco, tenant, plano e trilhas administrativas.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onReset}>
            Limpar filtros
          </Button>
          <Button variant="secondary" size="sm" onClick={onSaveView}>
            Salvar visao
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <FilterSelect label="Periodo" selected={value.period} onChange={(period) => onChange({ ...value, period })} options={options.periods} />
        <FilterSelect label="Empresa" selected={value.company} onChange={(company) => onChange({ ...value, company })} options={options.companies} />
        <FilterSelect label="Status" selected={value.status} onChange={(status) => onChange({ ...value, status })} options={options.statuses} />
        <FilterSelect label="Movimentacao" selected={value.movementType} onChange={(movementType) => onChange({ ...value, movementType })} options={options.movementTypes} />
        <FilterSelect label="Plano" selected={value.plan} onChange={(plan) => onChange({ ...value, plan })} options={options.plans} />
        <FilterSelect label="Usuario" selected={value.user} onChange={(user) => onChange({ ...value, user })} options={options.users} />
        <FilterSelect label="Financeiro" selected={value.financial} onChange={(financial) => onChange({ ...value, financial })} options={options.financialStates} />
        <FilterSelect label="Bloqueio" selected={value.blockedState} onChange={(blockedState) => onChange({ ...value, blockedState })} options={options.blockedStates} />
      </div>
    </div>
  </section>
);

export default SuperAdminFilters;
