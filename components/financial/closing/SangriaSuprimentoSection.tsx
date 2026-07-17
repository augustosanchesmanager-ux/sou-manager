import React, { useState } from 'react';
import { MinusCircle, PlusCircle, Trash2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { formatCurrency, generateId } from '../cashCloseUtils';
import type { SangriaSuprimento } from '../cashCloseUtils';

interface SangriaSuprimentoSectionProps {
    extras: SangriaSuprimento[];
    onAdd: (type: 'sangria' | 'suprimento', value: number, description: string) => void;
    onRemove: (id: string) => void;
    loading: boolean;
}

const SangriaSuprimentoSection: React.FC<SangriaSuprimentoSectionProps> = ({
    extras,
    onAdd,
    onRemove,
    loading,
}) => {
    const [newType, setNewType] = useState<'sangria' | 'suprimento'>('sangria');
    const [newValue, setNewValue] = useState('');
    const [newDesc, setNewDesc] = useState('');

    if (loading) return null;

    const totalSangria = extras.filter(e => e.type === 'sangria').reduce((s, e) => s + e.value, 0);
    const totalSuprimento = extras.filter(e => e.type === 'suprimento').reduce((s, e) => s + e.value, 0);

    const handleAdd = () => {
        const value = parseFloat(newValue);
        if (!value || value <= 0) return;
        onAdd(newType, value, newDesc.trim());
        setNewValue('');
        setNewDesc('');
    };

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-4 shadow-[0_4px_30px_rgba(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                    Sangrias e Suprimentos
                </h3>
                <div className="flex items-center gap-3">
                    {totalSangria > 0 && (
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            Sangrias: {formatCurrency(totalSangria)}
                        </span>
                    )}
                    {totalSuprimento > 0 && (
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Suprimentos: {formatCurrency(totalSuprimento)}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <div className="flex rounded-lg border border-slate-200 dark:border-border-dark overflow-hidden">
                    <button
                        onClick={() => setNewType('sangria')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
                            newType === 'sangria'
                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <ArrowDownCircle size={12} /> Sangria
                    </button>
                    <button
                        onClick={() => setNewType('suprimento')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${
                            newType === 'suprimento'
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        <PlusCircle size={12} /> Suprimento
                    </button>
                </div>

                <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                    <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={newValue}
                        onChange={e => setNewValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAdd()}
                        className="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-7 pr-3 py-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                    />
                </div>

                <input
                    type="text"
                    placeholder="Descricao (opcional)"
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAdd()}
                    maxLength={200}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/30"
                />

                <button
                    onClick={handleAdd}
                    disabled={!newValue || parseFloat(newValue) <= 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-primary-gold-hover disabled:opacity-40 transition-colors shrink-0"
                >
                    <PlusCircle size={12} /> Adicionar
                </button>
            </div>

            {extras.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-white/5">
                                <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Tipo</th>
                                <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Valor</th>
                                <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Descricao</th>
                                <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">Hora</th>
                                <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {extras.map(ext => (
                                <tr key={ext.id} className="border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                                    <td className="py-2">
                                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                                            ext.type === 'sangria'
                                                ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20'
                                                : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                        }`}>
                                            {ext.type === 'sangria' ? (
                                                <><ArrowDownCircle size={9} /> Sangria</>
                                            ) : (
                                                <><ArrowUpCircle size={9} /> Suprimento</>
                                            )}
                                        </span>
                                    </td>
                                    <td className={`text-right py-2 font-bold ${ext.type === 'sangria' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {formatCurrency(ext.value)}
                                    </td>
                                    <td className="py-2 text-slate-600 dark:text-slate-300 text-xs">
                                        {ext.description || '—'}
                                    </td>
                                    <td className="text-center py-2 text-xs text-slate-400">
                                        {new Date(ext.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="text-center py-2">
                                        <button
                                            onClick={() => onRemove(ext.id)}
                                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                            title="Remover"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-3">
                    Nenhum registro de sangria ou suprimento.
                </p>
            )}
        </div>
    );
};

export default SangriaSuprimentoSection;
