import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';

interface ComandaItemData {
    id: string;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: 'blocked' | 'open' | 'paid' | 'cancelled';
    total: number;
    created_at: string;
    clients: {
        name: string;
        avatar: string;
    };
    staff?: {
        name: string;
    };
    appointment?: {
        start_time: string | null;
    };
    comanda_items: Array<{
        id: string;
        product_name: string;
        quantity: number;
        unit_price: number;
    }>;
    staff_ids: string[];
    staff_names: string[];
    chefClubInfo?: {
        planName: string;
    } | null;
}

interface ComandaListItemProps {
    comanda: ComandaItemData;
    isSelected: boolean;
    isBulkSelected: boolean;
    onSelect: () => void;
    onToggleBulk: () => void;
    onSelectForSidebar: () => void;
    onCancel: () => void;
}

const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const formatTimeLabel = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatCurrency = (value: number) => `R$ ${value.toFixed(2).replace('.', ',')}`;
const getDisplayId = (id: string) => {
    const hexStr = id.replace(/-/g, '').slice(0, 8);
    const num = parseInt(hexStr, 16);
    return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};

const formatOpeningDate = (createdAt: string): { date: string; isToday: boolean; isYesterday: boolean } => {
    const date = new Date(createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    return {
        date: isToday ? 'Hoje' : isYesterday ? 'Ontem' : formatDateLabel(createdAt),
        isToday,
        isYesterday,
    };
};

const getConsumptionSummary = (comanda: ComandaItemData) => {
    if (comanda.comanda_items.length === 0) {
        return { title: 'Sem consumo', detail: '0 itens' };
    }

    const sortedItems = [...comanda.comanda_items].sort(
        (first, second) => (second.quantity * second.unit_price) - (first.quantity * first.unit_price),
    );
    const primaryItem = sortedItems[0];
    const remainingItems = comanda.comanda_items.length - 1;

    return {
        title: primaryItem.product_name,
        detail: remainingItems > 0
            ? `+${remainingItems}`
            : `${primaryItem.quantity}x`,
    };
};

const getStatusMeta = (status: 'blocked' | 'open' | 'paid' | 'cancelled') => {
    if (status === 'blocked') {
        return {
            label: 'Bloqueada',
            className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
            dotClassName: 'bg-blue-400',
        };
    }
    if (status === 'open') {
        return {
            label: 'Aberta',
            className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
            dotClassName: 'bg-amber-400',
        };
    }
    if (status === 'paid') {
        return {
            label: 'Paga',
            className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
            dotClassName: 'bg-emerald-400',
        };
    }
    return {
        label: 'Cancelada',
        className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        dotClassName: 'bg-slate-400',
    };
};

const ComandaListItem: React.FC<ComandaListItemProps> = ({
    comanda,
    isSelected,
    isBulkSelected,
    onSelect,
    onToggleBulk,
    onSelectForSidebar,
    onCancel,
}) => {
    const navigate = useNavigate();
    const statusMeta = getStatusMeta(comanda.status);
    const summary = getConsumptionSummary(comanda);
    const openingInfo = formatOpeningDate(comanda.created_at);

    const handleAction = (e: React.MouseEvent, action: () => void) => {
        e.stopPropagation();
        action();
    };

    return (
        <div
            className={`cursor-pointer px-4 py-3 transition ${
                isSelected
                    ? 'bg-amber-500/[0.07] dark:bg-amber-500/[0.08]'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.03]'
            } ${isBulkSelected ? 'ring-1 ring-amber-500/30 ring-inset' : ''}`}
            onClick={onSelect}
        >
            <div className="flex items-center gap-3">
                {comanda.status === 'open' && (
                    <button
                        type="button"
                        onClick={(e) => handleAction(e, onToggleBulk)}
                        className="flex size-7 items-center justify-center rounded-lg border border-amber-500/20 bg-white text-amber-600 transition hover:bg-amber-500/10 dark:bg-white/5"
                        title={isBulkSelected ? 'Desmarcar' : 'Selecionar'}
                    >
                        <span className="material-symbols-outlined text-[16px]">
                            {isBulkSelected ? 'check_box' : 'check_box_outline_blank'}
                        </span>
                    </button>
                )}

                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                    {comanda.clients.name.slice(0, 1).toUpperCase()}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                            {comanda.clients.name}
                        </span>
                        {comanda.chefClubInfo && (
                            <span className="flex items-center gap-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                                <span className="material-symbols-outlined text-[10px]">workspace_premium</span>
                                {comanda.chefClubInfo.planName}
                            </span>
                        )}
                        <span className="rounded-full border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                            #{getDisplayId(comanda.id)}
                        </span>
                    </div>

                    <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span className={`flex items-center gap-1 ${
                            openingInfo.isToday
                                ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                                : openingInfo.isYesterday
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : ''
                        }`}>
                            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                            {openingInfo.date}
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span>
                            {formatTimeLabel(comanda.created_at)}
                        </span>
                        {comanda.staff_names.length > 0 && (
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[12px]">badge</span>
                                {comanda.staff_names[0]}
                            </span>
                        )}
                    </div>
                </div>

                <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(comanda.total)}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {summary.title}
                        {summary.detail !== '0 itens' && ` (${summary.detail})`}
                    </p>
                </div>

                <div className="shrink-0">
                    <span
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusMeta.className}`}
                    >
                        <span className={`size-1.5 rounded-full ${statusMeta.dotClassName}`} />
                        {statusMeta.label}
                    </span>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                    {comanda.status === 'blocked' ? (
                        <>
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, onSelectForSidebar)}
                                className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                                title="Ver detalhes"
                            >
                                <span className="material-symbols-outlined text-[16px]">visibility</span>
                            </button>
                            <button
                                type="button"
                                onClick={(e) => handleAction(e, onCancel)}
                                className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                                title="Anular comanda"
                            >
                                <span className="material-symbols-outlined text-[14px]">block</span>
                                Anular
                            </button>
                        </>
                    ) : comanda.status === 'open' ? (
                        <button
                            type="button"
                            onClick={(e) => handleAction(e, () => navigate(`/checkout/${comanda.id}`))}
                            className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-amber-400 hover:text-amber-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                        >
                            <span className="material-symbols-outlined text-[14px]">point_of_sale</span>
                            Fechar
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={(e) => handleAction(e, onSelectForSidebar)}
                            className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:text-slate-900 dark:border-white/10 dark:text-slate-300 dark:hover:text-white"
                            title="Ver detalhes"
                        >
                            <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComandaListItem;
export type { ComandaItemData };