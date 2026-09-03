import React, { useState } from 'react';
import {
    CheckCircle, AlertTriangle, Edit3, Clock, Scissors,
    ShoppingBag, Award, ArrowDownCircle, User, ListChecks
} from 'lucide-react';
import { formatCurrency } from '../cashCloseUtils';
import type { BarberClosingDetail, TimelineEvent } from '../cashCloseUtils';

interface BarberClosingDetailProps {
    barber: BarberClosingDetail;
    onCloseBarberCash?: (barberStaffId: string, conference: { countedCash: number; justification: string }) => void;
    onSaveBarberCash?: (barberStaffId: string) => void;
    onExportBarberPDF?: (barber: BarberClosingDetail) => void;
}

const ChecklistItem: React.FC<{ label: string; passed: boolean }> = ({ label, passed }) => (
    <div className="flex items-center gap-2 py-1">
        {passed ? (
            <CheckCircle size={14} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
        ) : (
            <AlertTriangle size={14} className="text-amber-500 dark:text-amber-400 shrink-0" />
        )}
        <span className={`text-xs font-medium ${passed ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300'}`}>
            {label}
        </span>
    </div>
);

const BarberClosingDetailPanel: React.FC<BarberClosingDetailProps> = ({
    barber,
    onCloseBarberCash,
    onSaveBarberCash,
    onExportBarberPDF,
}) => {
    const [countedCash, setCountedCash] = useState('');
    const [justification, setJustification] = useState('');
    const [activeTab, setActiveTab] = useState<'financial' | 'clients' | 'products' | 'commissions' | 'checklist'>('financial');

    const countedValue = parseFloat(countedCash) || 0;
    const cashDifference = countedValue - barber.conference.expectedCash;

    const tabs = [
        { id: 'financial' as const, label: 'Financeiro', icon: <Scissors size={12} /> },
        { id: 'clients' as const, label: 'Clientes', icon: <User size={12} /> },
        { id: 'products' as const, label: 'Produtos', icon: <ShoppingBag size={12} /> },
        { id: 'commissions' as const, label: 'Comissões', icon: <Award size={12} /> },
        { id: 'checklist' as const, label: 'Checklist', icon: <ListChecks size={12} /> },
    ];

    return (
        <div className="p-4 space-y-4">
            {/* Tab Navigation */}
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                            activeTab === tab.id
                                ? 'bg-primary/10 text-primary'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Financial Tab */}
            {activeTab === 'financial' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { label: 'Produzido', value: barber.totalProduced, tone: 'default' },
                            { label: 'Recebido', value: barber.totalReceived, tone: 'default' },
                            { label: 'Comissao', value: barber.commission, tone: 'accent' },
                            { label: 'Repasse', value: barber.repasse, tone: 'default' },
                        ].map(item => (
                            <div key={item.label} className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                                <p className={`mt-0.5 text-sm font-extrabold ${
                                    item.tone === 'accent' ? 'text-primary' : 'text-slate-900 dark:text-white'
                                }`}>
                                    {formatCurrency(item.value)}
                                </p>
                            </div>
                        ))}
                    </div>

                    {barber.discounts > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 p-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-rose-600">Descontos</p>
                                <p className="mt-0.5 text-sm font-extrabold text-rose-600">{formatCurrency(barber.discounts)}</p>
                            </div>
                            <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-600">Adiantamentos</p>
                                <p className="mt-0.5 text-sm font-extrabold text-amber-600">{formatCurrency(barber.advances)}</p>
                            </div>
                        </div>
                    )}

                    {/* Payment Methods */}
                    {Object.keys(barber.paymentMethods).length > 0 && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
                                Formas de Pagamento
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(barber.paymentMethods).map(([method, value]) => (
                                    <div key={method} className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-2.5 py-1.5">
                                        <span className="text-[10px] font-bold text-slate-500">{method}</span>
                                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">{formatCurrency(Number(value))}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Clients Tab */}
            {activeTab === 'clients' && (
                <div>
                    {barber.clientsServed.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-white/5">
                                        <th className="text-left py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                                        <th className="text-left py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Servico</th>
                                        <th className="text-right py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Valor</th>
                                        <th className="text-left py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Pgto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barber.clientsServed.map((client, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                                            <td className="py-2 font-semibold text-slate-900 dark:text-white text-xs">{client.clientName}</td>
                                            <td className="py-2 text-slate-600 dark:text-slate-300 text-xs">{client.serviceName}</td>
                                            <td className="py-2 text-right font-bold text-slate-900 dark:text-white text-xs">{formatCurrency(client.value)}</td>
                                            <td className="py-2 text-xs text-slate-500">{client.paymentMethod}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 text-center py-3">Nenhum cliente atendido.</p>
                    )}
                </div>
            )}

            {/* Products Tab */}
            {activeTab === 'products' && (
                <div>
                    {barber.productsSold.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-white/5">
                                        <th className="text-left py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Produto</th>
                                        <th className="text-center py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Qtd</th>
                                        <th className="text-right py-2 text-[9px] font-bold uppercase tracking-wider text-slate-500">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barber.productsSold.map((product, i) => (
                                        <tr key={i} className="border-b border-slate-100 dark:border-white/5 last:border-0">
                                            <td className="py-2 font-semibold text-slate-900 dark:text-white text-xs">{product.name}</td>
                                            <td className="py-2 text-center text-slate-600 dark:text-slate-300 text-xs">{product.quantity}</td>
                                            <td className="py-2 text-right font-bold text-slate-900 dark:text-white text-xs">{formatCurrency(product.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-xs text-slate-400 text-center py-3">Nenhum produto vendido.</p>
                    )}
                </div>
            )}

            {/* Commissions Tab */}
            {activeTab === 'commissions' && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { label: 'Servicos', value: barber.commissions.services, tone: 'default' },
                            { label: 'Produtos', value: barber.commissions.products, tone: 'default' },
                            { label: 'Bonus', value: barber.commissions.bonus, tone: 'default' },
                            { label: 'Descontos', value: barber.commissions.discounts, tone: 'danger' },
                        ].map(item => (
                            <div key={item.label} className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-2.5">
                                <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{item.label}</p>
                                <p className={`mt-0.5 text-sm font-extrabold ${
                                    item.tone === 'danger' ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                                }`}>
                                    {formatCurrency(item.value)}
                                </p>
                            </div>
                        ))}
                    </div>
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-primary">Valor Final da Comissao</p>
                        <p className="mt-1 text-lg font-extrabold text-primary">{formatCurrency(barber.commissions.finalValue)}</p>
                    </div>
                </div>
            )}

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
                <div className="space-y-3">
                    <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-3">
                        <ChecklistItem label="Todas as comandas encerradas" passed={barber.checklist.allCommandsClosed} />
                        <ChecklistItem label="Todos os pagamentos concluidos" passed={barber.checklist.allPaymentsCompleted} />
                        <ChecklistItem label="Nenhum estorno pendente" passed={barber.checklist.noPendingReversals} />
                        <ChecklistItem label="Nenhuma comanda aberta" passed={barber.checklist.noOpenCommands} />
                        <ChecklistItem label="Nenhuma comissao inconsistente" passed={barber.checklist.noInconsistentCommissions} />
                        <ChecklistItem label="Caixa conferido" passed={barber.checklist.conferenceDone} />
                    </div>

                    {/* Physical Conference */}
                    <div className="rounded-lg border border-slate-200 dark:border-border-dark p-3">
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
                            Conferência Física
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-1 block">Dinheiro em maos</label>
                                <div className="relative">
                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0,00"
                                        value={countedCash}
                                        onChange={e => setCountedCash(e.target.value)}
                                        className="w-full rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-surface-dark pl-7 pr-2 py-1.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-1 block">Esperado em caixa</label>
                                <p className="text-sm font-extrabold text-slate-900 dark:text-white py-1.5">
                                    {formatCurrency(barber.conference.expectedCash)}
                                </p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 mb-1 block">Diferenca</label>
                                <p className={`text-sm font-extrabold py-1.5 ${
                                    countedValue > 0 && Math.abs(cashDifference) > 0.01
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                }`}>
                                    {countedValue > 0 ? formatCurrency(cashDifference) : '—'}
                                </p>
                            </div>
                        </div>
                        {countedValue > 0 && Math.abs(cashDifference) > 0.01 && (
                            <div className="mt-2">
                                <label className="text-[9px] font-bold text-amber-600 mb-1 block">Justificativa da divergencia</label>
                                <textarea
                                    rows={2}
                                    maxLength={200}
                                    placeholder="Motivo da diferenca encontrada..."
                                    value={justification}
                                    onChange={e => setJustification(e.target.value)}
                                    className="w-full rounded-lg border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-amber-400/30 resize-none"
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Individual Timeline */}
            {barber.timeline.length > 0 && (
                <div className="rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark p-3">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 mb-2">
                        Timeline Individual
                    </p>
                    <div className="space-y-1.5">
                        {barber.timeline.map((event, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                                <Clock size={10} className="text-slate-400 shrink-0" />
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{event.label}</span>
                                {event.detail && (
                                    <span className="text-slate-400 dark:text-slate-500">· {event.detail}</span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-slate-200 dark:border-border-dark">
                <button
                    onClick={() => onSaveBarberCash?.(barber.staffId)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    Salvar
                </button>
                <button
                    onClick={() => {
                        if (onCloseBarberCash && countedValue >= 0) {
                            onCloseBarberCash(barber.staffId, {
                                countedCash: countedValue,
                                justification,
                            });
                        }
                    }}
                    disabled={!onCloseBarberCash || countedValue <= 0}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                    Fechar Caixa do Barbeiro
                </button>
                <button
                    onClick={() => onExportBarberPDF?.(barber)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 dark:border-border-dark bg-white dark:bg-card-dark px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                    PDF
                </button>
            </div>
        </div>
    );
};

export default BarberClosingDetailPanel;
