import React from 'react';
import DatePickerInput from './ui/DatePickerInput';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';

type QuickRange = 'today' | '7d' | '30d' | 'custom' | 'all';
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

    sortField: SortField;
    onSortFieldChange: (value: SortField) => void;
    sortDirection: SortDirection;
    onSortDirectionChange: (value: SortDirection) => void;
    activeFiltersCount: number;
    onClearAll: () => void;
}

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
    sortField,
    onSortFieldChange,
    sortDirection,
    onSortDirectionChange,
    activeFiltersCount,
    onClearAll,
}) => {
    const { appSlug } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const orderLabelLower = labels.order.toLowerCase();
    const serviceLabel = labels.service;
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-night/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border border-line bg-card shadow-xl text-ink">
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <div>
                        <h2 className="text-lg font-black text-ink">Filtros do {orderLabelLower}</h2>
                        {activeFiltersCount > 0 && (
                            <p className="mt-0.5 text-xs font-semibold text-primary-dark">
                                {activeFiltersCount} filtro(s) aplicado(s)
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex size-8 items-center justify-center rounded-lg text-ink-soft transition-all duration-150 active:scale-95 touch-manipulation hover:bg-gold-pale hover:text-ink"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Período rápido
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {quickRanges.map((range) => (
                                <button
                                    key={range.key}
                                    type="button"
                                    onClick={() => onApplyQuickRange(range.key)}
                                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 touch-manipulation ${
                                        quickRange === range.key
                                            ? 'border-primary/60 bg-gold-soft text-primary-dark'
                                            : 'border-line text-ink-soft hover:border-primary-light hover:bg-gold-pale hover:text-ink'
                                    }`}
                                >
                                    {range.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {(quickRange === 'custom' || quickRange === 'all') && (
                        <div>
                            <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                                Período personalizado
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <DatePickerInput
                                    value={dateFrom}
                                    onChange={(e) => {
                                        onApplyQuickRange('custom');
                                        onDateFromChange(e.target.value);
                                    }}
                                    max={dateTo || undefined}
                                    className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
                                    containerClassName="w-full"
                                />
                                <DatePickerInput
                                    value={dateTo}
                                    onChange={(e) => {
                                        onApplyQuickRange('custom');
                                        onDateToChange(e.target.value);
                                    }}
                                    min={dateFrom || undefined}
                                    className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
                                    containerClassName="w-full"
                                />
                            </div>
                            {dateFrom && dateTo && (
                                <p className="mt-2 text-xs tabular-nums text-ink-soft">
                                    {formatDateLabel(`${dateFrom}T00:00:00`)} até {formatDateLabel(`${dateTo}T00:00:00`)}
                                </p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Profissional
                        </label>
                        <select
                            value={staffFilter}
                            onChange={(e) => onStaffFilterChange(e.target.value)}
                            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
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
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Faixa de valor
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={minTotal}
                                onChange={(e) => onMinTotalChange(e.target.value)}
                                placeholder="Mínimo"
                                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-primary"
                            />
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={maxTotal}
                                onChange={(e) => onMaxTotalChange(e.target.value)}
                                placeholder="Máximo"
                                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm tabular-nums text-ink outline-none focus:border-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Tipo de consumo
                        </label>
                        <select
                            value={consumptionType}
                            onChange={(e) => onConsumptionTypeChange(e.target.value as ConsumptionType)}
                            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
                        >
                            <option value="all">Todos</option>
                            <option value="service">{serviceLabel}</option>
                            <option value="product">Produto</option>
                            <option value="mixed">Misto</option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Ordenação
                        </label>
                        <select
                            value={`${sortField}:${sortDirection}`}
                            onChange={(e) => {
                                const [nextField, nextDirection] = e.target.value.split(':') as [SortField, SortDirection];
                                onSortFieldChange(nextField);
                                onSortDirectionChange(nextDirection);
                            }}
                            className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
                        >
                            <option value="date:desc">Mais recentes primeiro</option>
                            <option value="date:asc">Mais antigas primeiro</option>
                            <option value="total:desc">Maior valor</option>
                            <option value="total:asc">Menor valor</option>
                            <option value="client:asc">Cliente A-Z</option>
                            <option value="client:desc">Cliente Z-A</option>
                            <option value="status:asc">Status</option>
                            <option value="status:desc">Status invertido</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 border-t border-line px-5 py-4">
                    <button
                        type="button"
                        onClick={onClearAll}
                        className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft transition-all duration-150 active:scale-[0.98] touch-manipulation hover:bg-gold-pale hover:text-ink"
                    >
                        Limpar tudo
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-dark py-2.5 text-sm font-black text-night shadow-smg-glow transition-all duration-150 active:scale-[0.98] touch-manipulation hover:from-primary-dark hover:to-primary"
                    >
                        Aplicar filtros
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComandaFiltersModal;
