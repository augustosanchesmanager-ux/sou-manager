import React from 'react';
import { Filter, X, Users, Package, Crown } from 'lucide-react';
import type { CashCloseFilters } from './cashCloseUtils';

interface StaffMember {
    id: string;
    name: string;
    role?: string | null;
}

interface CashCloseFiltersBarProps {
    filters: CashCloseFilters;
    onFiltersChange: (filters: Partial<CashCloseFilters>) => void;
    operators: StaffMember[];
    filteredCount: number;
    totalCount: number;
}

const CashCloseFiltersBar: React.FC<CashCloseFiltersBarProps> = ({
    filters,
    onFiltersChange,
    operators,
    filteredCount,
    totalCount,
}) => {
    const hasActiveFilters = filters.operatorId || filters.showOnlyOpenComandas || filters.onlyClubMembers;

    return (
        <div className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Filter size={16} className="text-slate-400" />
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">Filtros</span>
                    {hasActiveFilters && (
                        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-black uppercase">
                            Ativos
                        </span>
                    )}
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {filteredCount} de {totalCount} lancamentos
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                    <label htmlFor="cash-close-operator" className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        Operador:
                    </label>
                    <select
                        id="cash-close-operator"
                        value={filters.operatorId || ''}
                        onChange={e => onFiltersChange({ operatorId: e.target.value || null })}
                        className="rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                    >
                        <option value="">Todos</option>
                        {operators.map(op => (
                            <option key={op.id} value={op.id}>{op.name}</option>
                        ))}
                    </select>
                </div>

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <fieldset className="flex items-center gap-1">
                    <legend className="sr-only">Status da comanda</legend>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                            type="radio"
                            name="comanda-status"
                            checked={!filters.showOnlyOpenComandas}
                            onChange={() => onFiltersChange({ showOnlyOpenComandas: false })}
                            className="accent-primary"
                        />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Todas</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer ml-2">
                        <input
                            type="radio"
                            name="comanda-status"
                            checked={filters.showOnlyOpenComandas}
                            onChange={() => onFiltersChange({ showOnlyOpenComandas: true })}
                            className="accent-primary"
                        />
                        <Package size={12} className="text-amber-500" />
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Abertas</span>
                    </label>
                </fieldset>

                <div className="h-5 w-px bg-slate-200 dark:bg-white/10 hidden sm:block" />

                <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={filters.onlyClubMembers}
                        onChange={e => onFiltersChange({ onlyClubMembers: e.target.checked })}
                        className="accent-primary rounded"
                    />
                    <Crown size={12} className="text-amber-500" />
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Somente Clube do Chefe</span>
                </label>

                {hasActiveFilters && (
                    <button
                        onClick={() => onFiltersChange({ operatorId: null, showOnlyOpenComandas: false, onlyClubMembers: false })}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-border-dark px-2.5 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                    >
                        <X size={12} />
                        Limpar
                    </button>
                )}
            </div>
        </div>
    );
};

export default CashCloseFiltersBar;
