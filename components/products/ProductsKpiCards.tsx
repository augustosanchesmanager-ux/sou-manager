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
            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-4">
                <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Total de Produtos</span>
                    <Package className="w-4 h-4 text-[#B88A44]" />
                </div>
                <div className="text-2xl font-bold text-[#F5F5F0]">{metrics.totalItems}</div>
                <div className="text-xs text-stone-400 mt-1">Ativos no catálogo</div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-4">
                <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Valor do Estoque (Custo)</span>
                    <Tag className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(metrics.totalStockValue)}
                </div>
                <div className="text-xs text-stone-400 mt-1">
                    Potencial de venda: <strong className="text-[#F5F5F0]">{formatCurrency(potentialSaleValue)}</strong>
                </div>
            </div>

            <div className="bg-[#141210] border border-[#2D2A26] rounded-xl p-4">
                <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Insumos de Bancada</span>
                    <Scissors className="w-4 h-4 text-[#B88A44]" />
                </div>
                <div className="text-2xl font-bold text-[#F5F5F0]">{metrics.internalUseCount}</div>
                <div className="text-xs text-stone-400 mt-1">Uso interno e híbridos</div>
            </div>

            <button
                type="button"
                onClick={onToggleLowStockFilter}
                title="Clique para filtrar itens com estoque baixo"
                className={`text-left rounded-xl p-4 border transition-all ${
                    stockStatusFilter === 'low'
                        ? 'bg-amber-500/10 border-amber-500/50'
                        : 'bg-[#141210] border-[#2D2A26] hover:border-[#B88A44]/50'
                }`}
            >
                <div className="flex items-center justify-between text-stone-400 text-xs font-semibold uppercase tracking-wider mb-1">
                    <span>Alerta de Reposição</span>
                    <AlertTriangle className={`w-4 h-4 ${metrics.lowStockCount > 0 ? 'text-amber-400' : 'text-stone-500'}`} />
                </div>
                <div className={`text-2xl font-bold ${metrics.lowStockCount > 0 ? 'text-amber-400' : 'text-stone-400'}`}>
                    {metrics.lowStockCount}
                </div>
                <div className="text-xs text-stone-400 mt-1">
                    {stockStatusFilter === 'low' ? 'Filtro ativo (clique p/ limpar)' : 'Abaixo do estoque mínimo'}
                </div>
            </button>
        </div>
    );
};
