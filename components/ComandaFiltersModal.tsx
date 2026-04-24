import React from 'react';
import DatePickerInput from './ui/DatePickerInput';

type QuickRange = 'today' | '7d' | '30d' | 'custom' | 'all';
type ComandaStatus = 'open' | 'paid' | 'cancelled';
type SortField = 'date' | 'client' | 'status' | 'total';
type SortDirection = 'asc' | 'desc';
type ConsumptionType = 'all' | 'service' | 'product' | 'mixed';

interface ComandaFiltersModalProps {
    isOpen: boolean;
    onClose: () => void;

    dateFrom: string;
    dateTo: string;
    quickRange: QuickRange;
    onApplyQuickRange: (range: QuickRange) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;

    staffFilter: string;
    onStaffFilterChange: (value: string) => void;
    staffOptions: Array<{ id: string; name: string }>;

    minTotal: string;
    maxTotal: string;
    onMinTotalChange: (value: string) => void;
    onMaxTotalChange: (value: string) => void;

    consumptionType: ConsumptionType;
    onConsumptionTypeChange: (value: ConsumptionType) => void;
}

const COMANDAS_PREFERENCES_KEY = 'soumanager:comandas:preferences:v2';

const loadPreferences = (): Partial<{
    filterStatus: 'all' | ComandaStatus;
    searchTerm: string;
    dateFrom: string;
    dateTo: string;
    quickRange: QuickRange;
    sortField: SortField;
    sortDirection: SortDirection;
    staffFilter: string;
    minTotal: string;
    maxTotal: string;
    consumptionType: ConsumptionType;
}> => {
    if (typeof window === 'undefined') {
        return {};
    }

    try {
        const rawValue = localStorage.getItem(COMANDAS_PREFERENCES_KEY);
        if (!rawValue) return {};
        return JSON.parse(rawValue);
    } catch {
        return {};
    }
};

const ComandaFiltersModal: React.FC<ComandaFiltersModalProps> = ({
    isOpen,
    onClose,
    dateFrom,
    dateTo,
    quickRange,
    onApplyQuickRange,
    onDateFromChange,
    onDateToChange,
    staffFilter,
    onStaffFilterChange,
    staffOptions,
    minTotal,
    maxTotal,
    onMinTotalChange,
    onMaxTotalChange,
    consumptionType,
    onConsumptionTypeChange,
}) => {
    const prefs = loadPreferences();

    const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');

    const quickRanges: { key: QuickRange; label: string }[] = [
        { key: 'today', label: 'Hoje' },
        { key: '7d', label: '7 dias' },
        { key: '30d', label: '30 dias' },
        { key: 'custom', label: 'Personalizado' },
        { key: 'all', label: 'Todos' },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-[#121826]">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-white/8">
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Filtros</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Periodo rapido
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {quickRanges.map((range) => (
                                <button
                                    key={range.key}
                                    type="button"
                                    onClick={() => onApplyQuickRange(range.key)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                        quickRange === range.key
                                            ? 'border-sky-400/50 bg-sky-500/15 text-sky-100'
                                            : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:text-slate-400 dark:hover:text-white'
                                    }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(quickRange === 'custom' || quickRange === 'all') && (
                        <div>
                            <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                Periodo personalizado
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <DatePickerInput
                                    value={dateFrom}
                                    onChange={(e) => {
                                        onApplyQuickRange('custom');
                                        onDateFromChange(e.target.value);
                                    }}
                                    max={dateTo || undefined}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                    containerClassName="w-full"
                                />
                                <DatePickerInput
                                    value={dateTo}
                                    onChange={(e) => {
                                        onApplyQuickRange('custom');
                                        onDateToChange(e.target.value);
                                    }}
                                    min={dateFrom || undefined}
                                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                                    containerClassName="w-full"
                                />
                            </div>
                            {dateFrom && dateTo && (
                                <p className="mt-2 text-xs text-slate-500">
                                    {formatDateLabel(`${dateFrom}T00:00:00`)} até {formatDateLabel(`${dateTo}T00:00:00`)}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Profissional
                        </label>
                        <select
                            value={staffFilter}
                            onChange={(e) => onStaffFilterChange(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                        >
                            <option value="">Todos</option>
                            {staffOptions.map((staff) => (
                                <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Faixa de valor
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={minTotal}
                                onChange={(e) => onMinTotalChange(e.target.value)}
                                placeholder="Minimo"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                            />
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={maxTotal}
                                onChange={(e) => onMaxTotalChange(e.target.value)}
                                placeholder="Maximo"
                                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Tipo de consumo
                        </label>
                        <select
                            value={consumptionType}
                            onChange={(e) => onConsumptionTypeChange(e.target.value as ConsumptionType)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-amber-400 dark:border-white/10 dark:bg-[#0f172a]"
                        >
                            <option value="all">Todos</option>
                            <option value="service">Servico</option>
                            <option value="product">Produto</option>
                            <option value="mixed">Misto</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-slate-200 px-5 py-4 dark:border-white/8">
                    <button
                        type="button"
                        onClick={() => {
                            onStaffFilterChange('');
                            onMinTotalChange('');
                            onMaxTotalChange('');
                            onConsumptionTypeChange('all');
                            onApplyQuickRange('today');
                        }}
                        className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5"
                    >
                        Limpar tudo
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90"
                    >
                        Aplicar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComandaFiltersModal;