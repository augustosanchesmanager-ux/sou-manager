import React from 'react';
import { Layers, Edit2 } from 'lucide-react';
import { formatCurrency } from '../../../shared/format/currency';
import type { ProductStockItem } from '../../../domain/stock/types';

interface CombosTableProps {
    combos: ProductStockItem[];
    onOpenEdit: (combo: ProductStockItem) => void;
}

export const CombosTable: React.FC<CombosTableProps> = ({
    combos,
    onOpenEdit,
}) => {
    return (
        <div className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
                <Layers className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-300">Kits Promocionais e Combos</h3>
                    <p className="text-xs text-ink-soft mt-0.5">
                        Agrupe produtos e insumos com preço especial. A baixa de estoque é realizada
                        automaticamente nos componentes individuais no momento da venda.
                    </p>
                </div>
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-ink">
                        <thead className="bg-cream/60 text-xs uppercase text-ink-soft border-b border-line">
                            <tr>
                                <th className="py-3 px-4">Nome do Combo</th>
                                <th className="py-3 px-4">Composição</th>
                                <th className="py-3 px-4 text-right">Custo dos Itens</th>
                                <th className="py-3 px-4 text-right">Preço de Venda</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {combos.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-ink-soft">
                                        Nenhum combo cadastrado no momento.
                                    </td>
                                </tr>
                            ) : (
                                combos.map(combo => (
                                    <tr key={combo.id} className="hover:bg-cream/60 transition-colors">
                                        <td className="py-3 px-4 font-medium text-ink">
                                            {combo.name}
                                        </td>
                                        <td className="py-3 px-4 text-xs text-ink-soft">
                                            {combo.combo_items?.map(ci => `${ci.quantity}x ${ci.product_name}`).join(', ') || 'Sem componentes'}
                                        </td>
                                        <td className="py-3 px-4 text-right text-ink-soft">
                                            {formatCurrency(combo.cost_price)}
                                        </td>
                                        <td className="py-3 px-4 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                                            {formatCurrency(combo.sale_price)}
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                                Ativo
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <button
                                                onClick={() => onOpenEdit(combo)}
                                                className="p-1.5 rounded hover:bg-ink/5 text-ink-soft hover:text-primary-dark dark:hover:text-amber-400 transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
