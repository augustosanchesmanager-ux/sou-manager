import React from 'react';
import { ClipboardCheck, Lock } from 'lucide-react';
import Button from '../../ui/Button';
import { formatCurrency } from '../../../shared/format/currency';
import type { InventoryAuditItem } from '../../../domain/stock/types';

interface InventoryAuditSectionProps {
    auditItems: InventoryAuditItem[];
    auditCounts: Record<string, number>;
    discrepanciesCount: number;
    totalDifferenceValue: number;
    onCountChange: (productId: string, value: string) => void;
    onApplyAudit: () => void;
}

export const InventoryAuditSection: React.FC<InventoryAuditSectionProps> = ({
    auditItems,
    auditCounts,
    discrepanciesCount,
    totalDifferenceValue,
    onCountChange,
    onApplyAudit,
}) => {
    return (
        <div className="space-y-4">
            <div className="bg-card border border-line rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                    <ClipboardCheck className="w-6 h-6 text-primary-dark dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-ink">Conferência Física Periódica (Inventário)</h3>
                        <p className="text-xs text-ink-soft mt-0.5">
                            Informe a contagem real de prateleira na coluna <strong>"Contagem Real"</strong>.
                            O sistema calcula as sobras e faltas automaticamente. O fechamento e ajuste de estoque
                            exige <strong>PIN do Gestor</strong> para garantir auditoria e segurança.
                        </p>
                    </div>
                </div>

                <Button
                    variant="primary"
                    onClick={onApplyAudit}
                    disabled={discrepanciesCount === 0}
                    className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shrink-0"
                >
                    <Lock className="w-4 h-4 mr-1" />
                    Aplicar Ajuste ({discrepanciesCount} divergências)
                </Button>
            </div>

            <div className="bg-card border border-line rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-ink">
                        <thead className="bg-cream/60 text-xs uppercase text-ink-soft border-b border-line">
                            <tr>
                                <th className="py-3 px-4">Produto / Insumo</th>
                                <th className="py-3 px-4">Finalidade</th>
                                <th className="py-3 px-4 text-right">Custo Unitário</th>
                                <th className="py-3 px-4 text-center">Estoque Sistema</th>
                                <th className="py-3 px-4 text-center w-36">Contagem Real</th>
                                <th className="py-3 px-4 text-center">Divergência</th>
                                <th className="py-3 px-4 text-right">Impacto Financeiro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                            {auditItems.map(item => {
                                const hasDiff = item.difference !== 0;
                                const isSurplus = item.difference > 0;
                                return (
                                    <tr key={item.product_id} className={`transition-colors ${hasDiff ? 'bg-amber-500/5' : 'hover:bg-cream/60'}`}>
                                        <td className="py-3 px-4 font-medium text-ink">
                                            {item.product_name}
                                            <div className="text-xs text-ink-soft">{item.category}</div>
                                        </td>
                                        <td className="py-3 px-4">
                                            <span className="px-2 py-0.5 rounded text-xs bg-cream border border-line text-ink-soft">
                                                {item.purpose === 'sale' ? 'Venda' : item.purpose === 'internal_use' ? 'Bancada' : 'Híbrido'}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-right text-ink-soft">
                                            {formatCurrency(item.unit_cost)}
                                        </td>
                                        <td className="py-3 px-4 text-center font-bold text-ink">
                                            {item.system_quantity} un
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                step="1"
                                                value={auditCounts[item.product_id] !== undefined ? auditCounts[item.product_id] : item.system_quantity}
                                                onChange={e => onCountChange(item.product_id, e.target.value)}
                                                className="w-24 text-center py-1 px-2 bg-cream border border-line rounded text-primary-dark dark:text-amber-300 font-bold focus:outline-none focus:border-primary"
                                            />
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                            {item.difference === 0 ? (
                                                <span className="text-xs text-ink-soft font-medium">Sem divergência</span>
                                            ) : (
                                                <span className={`inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded text-xs ${
                                                    isSurplus
                                                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                                                        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                                                }`}>
                                                    {isSurplus ? `+${item.difference} un (Sobra)` : `${item.difference} un (Falta)`}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-right font-semibold">
                                            {item.divergence_value === 0 ? (
                                                <span className="text-ink-soft">R$ 0,00</span>
                                            ) : (
                                                <span className={item.divergence_value > 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                                    {formatCurrency(item.divergence_value)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Barra de Totais da Conferência */}
                <div className="bg-cream p-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-ink-soft">
                        Divergências Identificadas:{' '}
                        <strong className="text-ink">{discrepanciesCount} item(ns)</strong>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <div className="text-xs text-ink-soft uppercase">Impacto Líquido</div>
                            <div className={`text-lg font-bold ${totalDifferenceValue >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {formatCurrency(totalDifferenceValue)}
                            </div>
                        </div>
                        <Button
                            variant="primary"
                            onClick={onApplyAudit}
                            disabled={discrepanciesCount === 0}
                            className="bg-amber-500 text-slate-950 font-bold"
                        >
                            <Lock className="w-4 h-4 mr-1" />
                            Ajustar Estoque com PIN
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
