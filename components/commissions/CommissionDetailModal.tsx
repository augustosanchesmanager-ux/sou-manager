import React from 'react';
import Modal from '../ui/Modal';
import type { CommissionRow, ProductionDateSource } from './types';

interface CommissionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedRow: CommissionRow | null;
}

const CLIENT_NAME_FALLBACK = 'Cliente não informado';

const normalizeClientName = (value?: string | null) => {
    const normalized = String(value || '').trim();
    return normalized || CLIENT_NAME_FALLBACK;
};

const getShortComandaRef = (id: string) => `#${String(id || '').slice(0, 8) || 'sem-id'}`;

const getProductionDateSourceLabel = (source: ProductionDateSource) => {
    if (source === 'appointment_start') return 'Data do atendimento';
    if (source === 'comanda_closed_at') return 'Dados legados: fechamento';
    return 'Dados legados: abertura';
};

export const CommissionDetailModal: React.FC<CommissionDetailModalProps> = ({
    isOpen,
    onClose,
    selectedRow,
}) => {
    if (!selectedRow) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Detalhamento de comissões - ${selectedRow.professionalName}`}
            maxWidth="5xl"
        >
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-border-dark">
                    <div className="flex items-center gap-3">
                        <img
                            src={selectedRow.avatar}
                            alt={selectedRow.professionalName}
                            className="size-12 rounded-full object-cover border border-slate-200 dark:border-border-dark"
                        />
                        <div>
                            <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{selectedRow.professionalName}</h4>
                            <p className="text-xs text-slate-500">{selectedRow.role} · Taxa padrão: {selectedRow.commissionRate}%</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Produção</p>
                            <p className="text-base font-black text-slate-900 dark:text-white">
                                {selectedRow.grossSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Liberado</p>
                            <p className="text-base font-black text-emerald-500">
                                {selectedRow.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-border-dark overflow-hidden">
                    <div className="overflow-x-auto max-h-[420px]">
                        <table className="w-full min-w-[1180px]">
                            <thead className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-border-dark">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Data</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Cliente</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Serviço</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Qtd</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Valor vendido</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Divisão/Regra</th>
                                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">Comissão</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-border-dark">
                                {selectedRow.items.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                            <div>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</div>
                                            <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                item.dateSource === 'appointment_start'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                    : 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200'
                                            }`}>
                                                {getProductionDateSourceLabel(item.dateSource)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">{normalizeClientName(item.clientName)}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                                            <div>{item.serviceName}</div>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                    item.isShared
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200'
                                                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                                                }`}>
                                                    {item.isShared ? 'Compartilhado' : 'Solo'}
                                                </span>
                                                {item.isFiado && (
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black ${
                                                        item.availableForPayout
                                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200'
                                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                                                    }`}>
                                                        {item.availableForPayout ? 'Fiado Quitado' : 'Aguardando Pagamento (Fiado)'}
                                                    </span>
                                                )}
                                                {item.discountAmount > 0 && (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-200">
                                                        Desconto informativo
                                                    </span>
                                                )}
                                            </div>
                                            {item.isShared && item.participantNames && (
                                                <div className="text-xs text-amber-600 dark:text-amber-300 mt-1">Participantes: {item.participantNames}</div>
                                            )}
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Comanda {getShortComandaRef(item.comandaId)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{item.quantity}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                            {item.itemValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                                            <div>{item.isShared ? item.divisionLaunched : 'Solo 100%'}</div>
                                            {item.isShared && (
                                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                                    Compartilhado: {item.sharedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </div>
                                            )}
                                            {item.discountAmount > 0 && (
                                                <div className="text-xs text-orange-600 dark:text-orange-300">
                                                    Desconto da comanda: {item.discountAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (não altera comissão aqui)
                                                </div>
                                            )}
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Base: {item.commissionBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Status: {item.commissionStatus}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold">
                                            {item.availableForPayout ? (
                                                <span className="text-emerald-500">
                                                    {item.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </span>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500 line-through">
                                                        {item.commissionValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </span>
                                                    <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">
                                                        R$ 0,00 (Pendente)
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default CommissionDetailModal;
