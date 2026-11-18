import React from 'react';
import {
    ShoppingCart,
    Scissors,
    Layers,
    ClipboardCheck,
    Search,
    Filter,
} from 'lucide-react';
import Button from '../ui/Button';
import type { StockTab, StockStatusFilter } from './types';

interface ProductsToolbarProps {
    activeTab: StockTab;
    onTabChange: (tab: StockTab) => void;
    auditDiscrepanciesCount: number;
    searchTerm: string;
    onSearchChange: (value: string) => void;
    stockStatusFilter: StockStatusFilter;
    onStockStatusFilterChange: (status: StockStatusFilter) => void;
    categoryFilter: string;
    onCategoryFilterChange: (category: string) => void;
    categories: string[];
    onOpenNewConsumption: () => void;
}

export const ProductsToolbar: React.FC<ProductsToolbarProps> = ({
    activeTab,
    onTabChange,
    auditDiscrepanciesCount,
    searchTerm,
    onSearchChange,
    stockStatusFilter,
    onStockStatusFilterChange,
    categoryFilter,
    onCategoryFilterChange,
    categories,
    onOpenNewConsumption,
}) => {
    return (
        <>
            {/* Abas Superiores (Atelier Tech) */}
            <div className="flex border-b border-[#2D2A26] gap-1 overflow-x-auto pb-px">
                <button
                    onClick={() => onTabChange('sale')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'sale'
                            ? 'border-[#B88A44] text-[#B88A44] bg-[#141210]'
                            : 'border-transparent text-stone-400 hover:text-[#F5F5F0] hover:bg-[#141210]/60'
                    }`}
                >
                    <ShoppingCart className="w-4 h-4" />
                    Disponível pra venda
                </button>

                <button
                    onClick={() => onTabChange('internal_use')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'internal_use'
                            ? 'border-[#B88A44] text-[#B88A44] bg-[#141210]'
                            : 'border-transparent text-stone-400 hover:text-[#F5F5F0] hover:bg-[#141210]/60'
                    }`}
                >
                    <Scissors className="w-4 h-4" />
                    Apenas para uso
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#B88A44]/20 text-[#B88A44] border border-[#B88A44]/30">
                        Bancada
                    </span>
                </button>

                <button
                    onClick={() => onTabChange('combos')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'combos'
                            ? 'border-[#B88A44] text-[#B88A44] bg-[#141210]'
                            : 'border-transparent text-stone-400 hover:text-[#F5F5F0] hover:bg-[#141210]/60'
                    }`}
                >
                    <Layers className="w-4 h-4" />
                    Combos
                </button>

                <button
                    onClick={() => onTabChange('audit')}
                    className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${
                        activeTab === 'audit'
                            ? 'border-[#B88A44] text-[#B88A44] bg-[#141210]'
                            : 'border-transparent text-stone-400 hover:text-[#F5F5F0] hover:bg-[#141210]/60'
                    }`}
                >
                    <ClipboardCheck className="w-4 h-4" />
                    Conferência
                    {auditDiscrepanciesCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-rose-500/20 text-rose-300">
                            {auditDiscrepanciesCount} div
                        </span>
                    )}
                </button>
            </div>

            {/* Barra de Filtros e Busca (para abas normais) */}
            {activeTab !== 'audit' && (
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-[#141210] p-3.5 rounded-xl border border-[#2D2A26]">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Buscar por produto, marca ou fornecedor..."
                            value={searchTerm}
                            onChange={e => onSearchChange(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-[#0E0C0A] border border-[#2D2A26] rounded-lg text-sm text-[#F5F5F0] focus:outline-none focus:border-[#B88A44]"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Pills rápidas de status de estoque */}
                        <div className="inline-flex items-center rounded-lg bg-[#0E0C0A] border border-[#2D2A26] p-0.5">
                            {[
                                { key: 'all' as const, label: 'Todos' },
                                { key: 'low' as const, label: 'Estoque Baixo' },
                                { key: 'out' as const, label: 'Sem Estoque' },
                            ].map((pill) => (
                                <button
                                    key={pill.key}
                                    type="button"
                                    onClick={() => onStockStatusFilterChange(pill.key)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                                        stockStatusFilter === pill.key
                                            ? 'bg-[#B88A44] text-[#0E0C0A]'
                                            : 'text-stone-400 hover:text-[#F5F5F0]'
                                    }`}
                                >
                                    {pill.label}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Filter className="w-4 h-4 text-stone-400" />
                            <select
                                value={categoryFilter}
                                onChange={e => onCategoryFilterChange(e.target.value)}
                                className="bg-[#0E0C0A] border border-[#2D2A26] rounded-lg text-xs text-[#F5F5F0] py-2 px-3 focus:outline-none focus:border-[#B88A44]"
                            >
                                <option value="all">Todas as Categorias</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        {/* Botão de Retirada rápido na aba de Uso Interno */}
                        {activeTab === 'internal_use' && (
                            <Button
                                variant="secondary"
                                onClick={onOpenNewConsumption}
                                className="bg-[#B88A44]/20 text-[#B88A44] border border-[#B88A44]/40 hover:bg-[#B88A44]/30"
                            >
                                <Scissors className="w-4 h-4 mr-1 text-[#B88A44]" />
                                Registrar Retirada / Consumo
                            </Button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
