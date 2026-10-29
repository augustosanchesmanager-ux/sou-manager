import React from 'react';
import { CalendarRange, ArrowUpDown, SlidersHorizontal } from 'lucide-react';
import type {
    ARFilters,
    SortKey,
    SourceFilter,
    StatusFilter,
    ViewMode,
} from './types';
import {
    SORT_OPTIONS,
    SOURCE_FILTER_OPTIONS,
    STATUS_FILTER_OPTIONS,
} from './types';

export interface AccountsReceivableFiltersProps {
    filterMonth: string;
    onFilterMonthChange: (month: string) => void;
    sortKey: SortKey;
    onSortKeyChange: (key: SortKey) => void;
    showFilters: boolean;
    onToggleShowFilters: () => void;
    listFilters: ARFilters;
    onListFiltersChange: (updater: (prev: ARFilters) => ARFilters) => void;
    activeFilterCount: number;
    listScopeLabel: string;
    dateScopeLabel: string;
    selectedSortLabel: string;
    onResetFilters: () => void;
}

const AccountsReceivableFilters: React.FC<AccountsReceivableFiltersProps> = ({
    filterMonth,
    onFilterMonthChange,
    sortKey,
    onSortKeyChange,
    showFilters,
    onToggleShowFilters,
    listFilters,
    onListFiltersChange,
    activeFilterCount,
    listScopeLabel,
    dateScopeLabel,
    selectedSortLabel,
    onResetFilters,
}) => {
    return (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-border-dark dark:bg-card-dark">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400">Lista operacional</p>
                    <h3 className="text-base font-black text-slate-950 dark:text-white">
                        {listScopeLabel}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {dateScopeLabel} · Ordenado por {selectedSortLabel.toLowerCase()}
                    </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                        <CalendarRange className="h-4 w-4 text-slate-400" />
                        <input
                            type="month"
                            value={filterMonth}
                            onChange={(event) => onFilterMonthChange(event.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-700 dark:text-slate-200 outline-none [color-scheme:light] dark:[color-scheme:dark]"
                        />
                    </label>

                    <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                        <ArrowUpDown className="size-4 text-slate-400" />
                        Ordenar
                        <select
                            value={sortKey}
                            onChange={(event) => onSortKeyChange(event.target.value as SortKey)}
                            className="min-w-[9.5rem] bg-transparent text-xs font-black text-slate-800 outline-none dark:text-white"
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="button"
                        onClick={onToggleShowFilters}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                    >
                        <SlidersHorizontal className="size-4" />
                        Filtros
                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] text-night">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {showFilters && (
                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 dark:border-white/10 md:grid-cols-2 xl:grid-cols-4">
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Origem</span>
                        <select
                            value={listFilters.source}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, source: event.target.value as SourceFilter }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        >
                            {SOURCE_FILTER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Status</span>
                        <select
                            value={listFilters.status}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, status: event.target.value as StatusFilter }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        >
                            {STATUS_FILTER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Data inicial</span>
                        <input
                            type="date"
                            value={listFilters.dateFrom}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, dateFrom: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Data final</span>
                        <input
                            type="date"
                            value={listFilters.dateTo}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, dateTo: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Valor mínimo</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={listFilters.amountMin}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, amountMin: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        />
                    </label>
                    <label className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Valor máximo</span>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={listFilters.amountMax}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, amountMax: event.target.value }))}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        />
                    </label>
                    <label className="space-y-1.5 md:col-span-2">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Cliente, telefone ou referência</span>
                        <input
                            type="search"
                            value={listFilters.search}
                            onChange={(event) => onListFiltersChange((current) => ({ ...current, search: event.target.value }))}
                            placeholder="Buscar cliente, telefone ou comanda"
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 outline-none dark:border-white/10 dark:bg-[#1A1A1A] dark:text-slate-200"
                        />
                    </label>
                    <div className="space-y-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">Visualização</span>
                        <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-white/10 dark:bg-white/5">
                            {[
                                { value: 'list' as ViewMode, label: 'Lista' },
                                { value: 'grouped' as ViewMode, label: 'Por cliente' },
                            ].map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onListFiltersChange((current) => ({ ...current, viewMode: option.value }))}
                                    className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                                        listFilters.viewMode === option.value
                                            ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white'
                                            : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-end">
                        <button
                            type="button"
                            onClick={onResetFilters}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                        >
                            Limpar filtros
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default AccountsReceivableFilters;
