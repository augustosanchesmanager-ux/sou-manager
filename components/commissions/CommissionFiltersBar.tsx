import React from 'react';
import DateRangeFilter from '../ui/DateRangeFilter';
import Button from '../ui/Button';
import type { CommissionTypeFilter, CommissionRow } from './types';
import { commissionStatusLabels, type CommissionStatusFilter } from '../../shared/status/commission';

interface CommissionFiltersBarProps {
    startDate: string;
    endDate: string;
    onStartDateChange: (val: string) => void;
    onEndDateChange: (val: string) => void;
    searchTerm: string;
    onSearchTermChange: (val: string) => void;
    professionalFilter: string;
    onProfessionalFilterChange: (val: string) => void;
    professionalOptions: CommissionRow[];
    commissionTypeFilter: CommissionTypeFilter;
    onCommissionTypeFilterChange: (val: CommissionTypeFilter) => void;
    statusFilter: CommissionStatusFilter;
    onStatusFilterChange: (val: CommissionStatusFilter) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
}

export const CommissionFiltersBar: React.FC<CommissionFiltersBarProps> = ({
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    searchTerm,
    onSearchTermChange,
    professionalFilter,
    onProfessionalFilterChange,
    professionalOptions,
    commissionTypeFilter,
    onCommissionTypeFilterChange,
    statusFilter,
    onStatusFilterChange,
    hasActiveFilters,
    onClearFilters,
}) => {
    return (
        <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-border-dark flex flex-wrap gap-4 items-end">
            <DateRangeFilter
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={onStartDateChange}
                onEndDateChange={onEndDateChange}
                showPresets={true}
            />
            <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Busca</label>
                <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => onSearchTermChange(e.target.value)}
                        placeholder="Cliente, serviço, profissional ou comanda..."
                        className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary outline-none"
                    />
                </div>
            </div>
            <div className="min-w-[180px]">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Profissional</label>
                <select
                    value={professionalFilter}
                    onChange={(event) => onProfessionalFilterChange(event.target.value)}
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                    <option value="all">Todos</option>
                    {professionalOptions.map((row) => (
                        <option key={row.id} value={row.id}>{row.professionalName}</option>
                    ))}
                </select>
            </div>
            <div className="min-w-[160px]">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Tipo</label>
                <select
                    value={commissionTypeFilter}
                    onChange={(event) => onCommissionTypeFilterChange(event.target.value as CommissionTypeFilter)}
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                    <option value="all">Todos os tipos</option>
                    <option value="solo">Solo</option>
                    <option value="shared">Compartilhado</option>
                </select>
            </div>
            <div className="min-w-[180px]">
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 ml-1">Status da comanda</label>
                <select
                    value={statusFilter}
                    onChange={(event) => onStatusFilterChange(event.target.value as CommissionStatusFilter)}
                    className="w-full bg-slate-50 dark:bg-background-dark border border-slate-200 dark:border-border-dark rounded-xl py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                    <option value="all">Todos</option>
                    {Object.entries(commissionStatusLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                    ))}
                </select>
            </div>
            {hasActiveFilters && (
                <Button variant="secondary" onClick={onClearFilters}>
                    Limpar
                </Button>
            )}
        </div>
    );
};

export default CommissionFiltersBar;
