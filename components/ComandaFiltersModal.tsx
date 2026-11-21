import React, { useEffect } from 'react';
import DatePickerInput from './ui/DatePickerInput';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';

type QuickRange = 'today' | '7d' | '30d' | 'custom' | 'all';
type ConsumptionType = 'all' | 'service' | 'product' | 'mixed';

interface ComandaFiltersModalProps {
    isOpen: boolean;
    onClose: () => void;

    /** Período já aplicado na barra principal (somente leitura aqui). */
    periodLabel: string;

    dateFrom: string;
    dateTo: string;
    onApplyQuickRange: (range: QuickRange) => void;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;

    minTotal: string;
    maxTotal: string;
    onMinTotalChange: (value: string) => void;
    onMaxTotalChange: (value: string) => void;

    consumptionType: ConsumptionType;
    onConsumptionTypeChange: (value: ConsumptionType) => void;

    onClearAdvanced: () => void;
}

const ComandaFiltersModal: React.FC<ComandaFiltersModalProps> = ({
    isOpen,
    onClose,
    periodLabel,
    dateFrom,
    dateTo,
    onApplyQuickRange,
    onDateFromChange,
    onDateToChange,
    minTotal,
    maxTotal,
    onMinTotalChange,
    onMaxTotalChange,
    consumptionType,
    onConsumptionTypeChange,
    onClearAdvanced,
}) => {
    const { appSlug } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const orderLabelLower = labels.order.toLowerCase();
    const serviceLabel = labels.service;
    const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');

    const advancedFiltersCount = [Boolean(minTotal), Boolean(maxTotal), consumptionType !== 'all'].filter(Boolean).length;

    // Esc fecha; body travado enquanto o modal está aberto (mesma convenção do ui/Modal).
    useEffect(() => {
        if (!isOpen) return;
        document.body.classList.add('modal-open');

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.classList.remove('modal-open');
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-night/60 backdrop-blur-xs p-4">
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="comanda-filters-title"
                className="w-full max-w-lg rounded-2xl border border-line bg-card shadow-xl text-ink"
            >
                <div className="flex items-center justify-between border-b border-line px-5 py-4">
                    <div>
                        <h2 id="comanda-filters-title" className="text-lg font-black text-ink">Filtros avançados do {orderLabelLower}</h2>
                        {advancedFiltersCount > 0 && (
                            <p className="mt-0.5 text-xs font-semibold text-primary-dark">
                                {advancedFiltersCount} filtro(s) avançado(s) aplicado(s)
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar filtros"
                        className="flex size-8 items-center justify-center rounded-lg text-ink-soft transition-all duration-150 active:scale-95 touch-manipulation hover:bg-gold-pale hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                </div>

                <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
                    <div className="rounded-xl border border-line bg-gold-pale px-3 py-2.5">
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">Período aplicado</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{periodLabel}</p>
                        <p className="mt-1 text-[11px] text-ink-soft">
                            Presets e profissional são ajustados na barra da lista. Aqui ficam apenas as datas exatas e os filtros avançados.
                        </p>
                    </div>

                    <div>
                        <label className="mb-2 block text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            Datas exatas
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
                </div>

                <div className="flex gap-3 border-t border-line px-5 py-4">
                    <button
                        type="button"
                        onClick={onClearAdvanced}
                        disabled={advancedFiltersCount === 0}
                        className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft transition-all duration-150 active:scale-[0.98] touch-manipulation hover:bg-gold-pale hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        Limpar avançados
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-xl bg-gradient-to-r from-primary to-primary-dark py-2.5 text-sm font-black text-night shadow-smg-glow transition-all duration-150 active:scale-[0.98] touch-manipulation hover:from-primary-dark hover:to-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComandaFiltersModal;
