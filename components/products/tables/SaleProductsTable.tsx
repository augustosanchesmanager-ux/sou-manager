import React from 'react';
import { AlertTriangle, ShoppingCart, Edit2, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../shared/format/currency';
import { isStockLow } from '../../../domain/stock/stockEngine';
import type { ProductStockItem } from '../../../domain/stock/types';

interface SaleProductsTableProps {
    products: ProductStockItem[];
    loading: boolean;
    onOpenPurchase: (product: ProductStockItem) => void;
    onOpenEdit: (product: ProductStockItem) => void;
    onDelete: (product: ProductStockItem) => void;
}

export const SaleProductsTable: React.FC<SaleProductsTableProps> = ({
    products,
    loading,
    onOpenPurchase,
    onOpenEdit,
    onDelete,
}) => {
    return (
        <div className="bg-card border border-line rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-ink">
                    <thead className="bg-cream text-[10px] uppercase tracking-wider text-primary-dark dark:text-primary border-b border-line">
                        <tr>
                            <th className="py-3 px-4 font-semibold">Produto</th>
                            <th className="py-3 px-4 font-semibold">Categoria</th>
                            <th className="py-3 px-4 font-semibold text-right">Custo / Margem</th>
                            <th className="py-3 px-4 font-semibold text-right">Preço Venda</th>
                            <th className="py-3 px-4 font-semibold text-center">Comissão</th>
                            <th className="py-3 px-4 font-semibold text-center">Estoque Atual</th>
                            <th className="py-3 px-4 font-semibold text-right">Ações Rápidas</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                        {loading ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-ink-soft text-xs">
                                    Carregando produtos...
                                </td>
                            </tr>
                        ) : products.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-8 text-center text-ink-soft text-xs">
                                    Nenhum produto para venda encontrado.
                                </td>
                            </tr>
                        ) : (
                            products.map(prod => {
                                const isOut = prod.stock_quantity <= 0;
                                const lowStock = !isOut && isStockLow(prod);
                                const marginPct =
                                    prod.cost_price > 0 && prod.sale_price > 0
                                        ? Math.round(((prod.sale_price - prod.cost_price) / prod.sale_price) * 1000) / 10
                                        : null;

                                return (
                                    <tr key={prod.id} className="hover:bg-cream/80 dark:bg-white/5 transition-colors">
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-ink">{prod.name}</div>
                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-ink-soft">
                                                {prod.brand && <span>{prod.brand}</span>}
                                                <span className="px-1.5 py-0.2 rounded bg-primary/10 text-primary-dark dark:text-primary border border-primary/20 text-[10px]">
                                                    {prod.purpose === 'both' ? 'Híbrido' : 'Venda'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded text-xs bg-cream border border-line text-ink">
                                                {prod.category || 'Geral'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="text-ink text-xs">{formatCurrency(prod.cost_price)}</div>
                                            {marginPct !== null && (
                                                <div className="text-[10px] font-semibold text-emerald-400">
                                                    Margem {marginPct}%
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-semibold text-ink">
                                            {formatCurrency(prod.sale_price)}
                                        </td>
                                        <td className="py-3 px-4 text-center text-primary-dark dark:text-primary font-medium text-xs">
                                            {prod.commission_rate}%
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {isOut ? (
                                                <span className="inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded text-[11px] bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Esgotado ({prod.stock_quantity})
                                                </span>
                                            ) : lowStock ? (
                                                <span className="inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Estoque Baixo ({prod.stock_quantity} un)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 font-bold px-2.5 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                                    Normal ({prod.stock_quantity} un)
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenPurchase(prod)}
                                                    title="Ajustar / Entrada de Estoque"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-primary/15 text-primary-dark dark:text-primary border border-primary/30 hover:bg-primary hover:text-[#0E0C0A] transition-colors"
                                                >
                                                    <ShoppingCart className="w-3.5 h-3.5" />
                                                    Entrada
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenEdit(prod)}
                                                    title="Editar produto"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-cream text-ink border border-line hover:border-primary/50 hover:text-ink transition-colors"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(prod)}
                                                    title="Remover produto"
                                                    className="p-1.5 rounded-lg hover:bg-rose-500/15 text-ink-soft hover:text-rose-400 transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
