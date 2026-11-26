import React from 'react';
import { Package, Tag, Scissors, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../shared/format/currency';
import type { ProductsMetrics, StockStatusFilter } from './types';

interface ProductsKpiCardsProps {
    metrics: ProductsMetrics;
    potentialSaleValue: number;
    stockStatusFilter: StockStatusFilter;
    onToggleLowStockFilter: () => void;
}

export const ProductsKpiCards: React.FC<ProductsKpiCardsProps> = ({
    metrics,
    potentialSaleValue,
    stockStatusFilter,
    onToggleLowStockFilter,
}) => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-line rounded-xl p-4">
                <div className="flex items-center justify-between text-ink-soft text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Total de Produtos</span>
                    <Package className="w-4 h-4 text-primary-dark dark:text-primary" />
                </div>
                <div className="text-2xl font-bold text-ink">{metrics.totalItems}</div>
                <div className="text-xs text-ink-soft mt-1">Ativos no catálogo</div>
            </div>

            <div className="bg-card border border-line rounded-xl p-4">
                <div className="flex items-center justify-between text-ink-soft text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Valor do Estoque (Custo)</span>
                    <Tag className="w-4 h-4 text-success" />
                </div>
                <div className="text-2xl font-bold text-success">
                    {formatCurrency(metrics.totalStockValue)}
                </div>
                <div className="text-xs text-ink-soft mt-1">
                    Potencial de venda: <strong className="text-ink">{formatCurrency(potentialSaleValue)}</strong>
                </div>
            </div>

            <div className="bg-card border border-line rounded-xl p-4">
                <div className="flex items-center justify-between text-ink-soft text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Insumos de Bancada</span>
                    <Scissors className="w-4 h-4 text-primary-dark dark:text-primary" />
                </div>
                <div className="text-2xl font-bold text-ink">{metrics.internalUseCount}</div>
                <div className="text-xs text-ink-soft mt-1">Uso interno e híbridos</div>
            </div>

            <button
                type="button"
                onClick={onToggleLowStockFilter}
                title="Clique para filtrar itens com estoque baixo"
                className={`text-left rounded-xl p-4 border transition-all ${
                    stockStatusFilter === 'low'
                        ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-400 dark:border-amber-500/50'
                        : 'bg-card border-line hover:border-primary/50'
                }`}
            >
                <div className="flex items-center justify-between text-ink-soft text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Alerta de Reposição</span>
                    <AlertTriangle className={`w-4 h-4 ${metrics.lowStockCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-ink-soft'}`} />
                </div>
                <div className={`text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-ink-soft'}`}>
                    {metrics.lowStockCount}
                </div>
                <div className="text-xs text-ink-soft mt-1">
                    {stockStatusFilter === 'low' ? 'Filtro ativo (clique p/ limpar)' : 'Abaixo do estoque mínimo'}
                </div>
            </button>
        </div>
    );
};
