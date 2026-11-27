import React from 'react';
import { Scissors, AlertTriangle, ShoppingCart, Edit2 } from 'lucide-react';
import { formatCurrency } from '../../../shared/format/currency';
import { isStockLow } from '../../../domain/stock/stockEngine';
import type { ProductStockItem } from '../../../domain/stock/types';

interface InternalUseProductsTableProps {
    products: ProductStockItem[];
    onOpenConsumption: (product: ProductStockItem) => void;
    onOpenPurchase: (product: ProductStockItem) => void;
    onOpenEdit: (product: ProductStockItem) => void;
}

export const InternalUseProductsTable: React.FC<InternalUseProductsTableProps> = ({
    products,
    onOpenConsumption,
    onOpenPurchase,
    onOpenEdit,
}) => {
    return (
        <div className="space-y-4">
            <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 flex items-start gap-3">
                <Scissors className="w-5 h-5 text-primary-dark dark:text-primary shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-primary-dark dark:text-primary">Insumos de Bancada e Lavatório</h3>
                    <p className="text-xs text-ink-soft mt-0.5">
                        Estes itens não geram comissão direta de venda ao cliente. Utilize o botão
                        <strong> "Registrar Retirada / Consumo"</strong> para abater o estoque físico
                        e vincular o uso a um barbeiro ou colaborador.
                    </p>
                </div>
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-ink">
                        <thead className="bg-cream/60 text-xs uppercase text-ink-soft border-b border-line">
                            <tr>
                                <th className="py-3 px-4">Insumo</th>
                                <th className="py-3 px-4">Categoria</th>
                                <th className="py-3 px-4 text-right">Custo Unitário</th>
                                <th className="py-3 px-4 text-center">Estoque Atual</th>
                                <th className="py-3 px-4 text-center">Estoque Mínimo</th>
                                <th className="py-3 px-4">Fornecedor</th>
                                <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {products.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-ink-soft">
                                        Nenhum insumo de uso interno cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                products.map(prod => {
                                    const lowStock = isStockLow(prod);
                                    return (
                                        <tr key={prod.id} className="hover:bg-cream/60 transition-colors">
                                            <td className="py-3 px-4 font-medium text-ink">
                                                {prod.name}
                                                {prod.brand && <div className="text-xs text-ink-soft">{prod.brand}</div>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="px-2 py-0.5 rounded text-xs bg-cream border border-line text-ink-soft">
                                                    {prod.category}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right text-ink-soft">
                                                {formatCurrency(prod.cost_price)}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                                                    lowStock
                                                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                                }`}>
                                                    {lowStock && <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />}
                                                    {prod.stock_quantity} un
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center text-ink-soft">
                                                {prod.minimum_stock} un
                                            </td>
                                            <td className="py-3 px-4 text-ink-soft">
                                                {prod.supplier_name || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => onOpenConsumption(prod)}
                                                        title="Registrar retirada de bancada"
                                                        className="p-1.5 rounded hover:bg-cream/80 dark:bg-white/5 text-primary-dark dark:text-primary hover:text-[#D4A359] transition-colors"
                                                    >
                                                        <Scissors className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onOpenPurchase(prod)}
                                                        title="Dar entrada de compra"
                                                        className="p-1.5 rounded hover:bg-ink/5 text-ink-soft hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                                                    >
                                                        <ShoppingCart className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => onOpenEdit(prod)}
                                                        title="Editar insumo"
                                                        className="p-1.5 rounded hover:bg-ink/5 text-ink-soft hover:text-primary-dark dark:hover:text-amber-400 transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
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
        </div>
    );
};
