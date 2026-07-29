import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from './ui/Button';
import { useAuth } from '../context/AuthContext';
import { getBusinessLabels } from '../src/lib/apps/businessLabels';
import { formatCurrency } from '../shared/format/currency';

interface ComandaItemType {
    id: string;
    client_id: string;
    staff_id?: string | null;
    appointment_id?: string | null;
    status: 'blocked' | 'open' | 'paid' | 'cancelled';
    cancellation_reason?: string | null;
    closure_mode?: 'standard' | 'legacy_membership' | null;
    closure_note?: string | null;
    financial_effect?: boolean;
    legacy_reference_month?: string | null;
    total: number;
    created_at: string;
    updated_at?: string;
    closed_at?: string | null;
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
}

interface ComandaSidebarProps {
    comanda: ComandaItemType | null;
    financialHistory?: ComandaFinancialHistory | null;
    onClose: () => void;
    onCancel: () => void;
    onPrint: () => void;
    onCheckout: () => void;
}

interface ComandaFinancialReversal {
    reversalTransactionId: string | null;
    reversalType: string;
    amount: number;
    reasonType: string;
    createdAt: string | null;
}

interface ComandaFinancialHistory {
    transactionId: string;
    amount: number;
    paymentMethod: string;
    date: string | null;
    status: string | null;
    reversedAmount: number;
    reversibleAmount: number;
    reversalStatus: 'none' | 'partial' | 'full';
    reversals: ComandaFinancialReversal[];
}

const formatDateLabel = (value: string) => new Date(value).toLocaleDateString('pt-BR');
const formatTimeLabel = (value: string) => new Date(value).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const getDisplayId = (id: string) => {
    const hexStr = id.replace(/-/g, '').slice(0, 8);
    const num = parseInt(hexStr, 16);
    return Number.isNaN(num) ? 1000 : (num % 89999) + 1000;
};

const getStatusMeta = (status: 'blocked' | 'open' | 'paid' | 'cancelled', isEsteticaApp = false) => {
    if (status === 'blocked') {
        return {
            label: isEsteticaApp ? 'Bloqueado' : 'Bloqueada',
            className: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
            dotClassName: 'bg-blue-400',
        };
    }
    if (status === 'open') {
        return {
            label: isEsteticaApp ? 'Aberto' : 'Aberta',
            className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
            dotClassName: 'bg-amber-400',
        };
    }
    if (status === 'paid') {
        return {
            label: isEsteticaApp ? 'Finalizado' : 'Paga',
            className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
            dotClassName: 'bg-emerald-400',
        };
    }
    return {
        label: isEsteticaApp ? 'Cancelado' : 'Cancelada',
        className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
        dotClassName: 'bg-slate-400',
    };
};

const getSettlementMeta = (comanda: ComandaItemType, isEsteticaApp = false) => {
    if (comanda.status !== 'paid' || comanda.financial_effect !== false) return null;

    return {
        label: !isEsteticaApp && comanda.closure_mode === 'legacy_membership' ? 'Baixa administrativa do Clube' : 'Baixa administrativa',
        helper: comanda.legacy_reference_month
            ? `Referencia: ${new Date(comanda.legacy_reference_month).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
            : 'Sem impacto financeiro.',
        className: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
    };
};

const getConsumptionType = (comanda: ComandaItemType, servicePluralLabel = 'Serviços'): string => {
    const hasServices = comanda.comanda_items.some((item) => Boolean((item as any).service_id));
    const hasProducts = comanda.comanda_items.some((item) => Boolean((item as any).product_id));

    if (hasServices && hasProducts) return 'Misto';
    if (hasServices) return servicePluralLabel;
    if (hasProducts) return 'Produtos';
    return 'Nao identificado';
};

const ComandaSidebar: React.FC<ComandaSidebarProps> = ({
    comanda,
    financialHistory,
    onClose,
    onCancel,
    onPrint,
    onCheckout,
}) => {
    const navigate = useNavigate();
    const { appSlug } = useAuth();
    const labels = getBusinessLabels(appSlug);
    const isEsteticaApp = appSlug === 'estetica';
    const orderLabel = labels.order;
    const orderLabelLower = orderLabel.toLowerCase();

    if (!comanda) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-sm text-slate-500 dark:text-slate-400">
                Selecione um {orderLabelLower}
            </div>
        );
    }

    const statusMeta = getStatusMeta(comanda.status, isEsteticaApp);
    const openingDate = new Date(comanda.created_at);
    const appointmentDate = comanda.appointment?.start_time
        ? new Date(comanda.appointment.start_time)
        : null;

    const formatOpeningInfo = () => {
        const today = new Date();
        const isSameDay = openingDate.toDateString() === today.toDateString();
        return {
            label: isSameDay ? 'Hoje' : formatDateLabel(comanda.created_at),
            isToday: isSameDay,
        };
    };

    const openingInfo = formatOpeningInfo();

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                <div className="mb-4 flex items-center justify-between">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            {orderLabel}
                        </p>
                        <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
                            #{getDisplayId(comanda.id)}
                        </h2>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                        <span
                            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusMeta.className}`}
                        >
                            <span className={`size-1.5 rounded-full ${statusMeta.dotClassName}`} />
                            {statusMeta.label}
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
                            aria-label={`Fechar painel do ${orderLabelLower}`}
                            title="Fechar painel"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{comanda.clients.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Abertura</p>
                        <p className={`mt-1 text-sm font-semibold ${
                            openingInfo.isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                        }`}>
                            {openingInfo.label}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatTimeLabel(comanda.created_at)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Agendamento</p>
                        {appointmentDate ? (
                            <>
                                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                    {appointmentDate.toLocaleDateString('pt-BR', { day: 'numeric' })}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatTimeLabel(comanda.appointment!.start_time!)}
                                </p>
                            </>
                        ) : (
                            <p className="mt-1 text-xs text-slate-400">Sem agendamento</p>
                        )}
                    </div>
                </div>

                <div className="mb-4 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Profissional</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {comanda.staff_names.join(' / ') || 'Sem profissional'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {comanda.comanda_items.length} {comanda.comanda_items.length === 1 ? 'item' : 'itens'}
                    </p>
                </div>

                <div className="mb-4 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Consumo</p>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {getConsumptionType(comanda, labels.servicePlural)}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {comanda.comanda_items.length > 0 ? (
                            comanda.comanda_items.slice(0, 5).map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center justify-between text-xs"
                                >
                                    <span className="truncate text-slate-700 dark:text-slate-300">
                                        {item.product_name}
                                    </span>
                                    <span className="shrink-0 font-medium text-slate-900 dark:text-white">
                                        {formatCurrency(item.unit_price * item.quantity)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400">Sem itens lancados</p>
                        )}
                        {comanda.comanda_items.length > 5 && (
                            <p className="text-xs text-slate-500">
                                +{comanda.comanda_items.length - 5} mais itens
                            </p>
                        )}
                    </div>
                </div>

                {financialHistory && (
                    <div className="mb-4 rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/8 dark:bg-[#0f172a]">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Historico financeiro</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                                    {formatCurrency(financialHistory.amount)}
                                </p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                financialHistory.reversalStatus === 'full'
                                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                                    : financialHistory.reversalStatus === 'partial'
                                    ? 'border-amber-500/20 bg-amber-500/10 text-amber-500'
                                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500'
                            }`}>
                                {financialHistory.reversalStatus === 'full'
                                    ? 'Estornado total'
                                    : financialHistory.reversalStatus === 'partial'
                                    ? 'Estornado parcial'
                                    : 'Baixa registrada'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                                <p className="font-semibold text-slate-500 dark:text-slate-400">Forma</p>
                                <p className="mt-1 text-slate-900 dark:text-white">{financialHistory.paymentMethod}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                                <p className="font-semibold text-slate-500 dark:text-slate-400">Data</p>
                                <p className="mt-1 text-slate-900 dark:text-white">
                                    {financialHistory.date ? new Date(financialHistory.date).toLocaleDateString('pt-BR') : 'Nao informada'}
                                </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                                <p className="font-semibold text-slate-500 dark:text-slate-400">Revertido</p>
                                <p className="mt-1 text-slate-900 dark:text-white">{formatCurrency(financialHistory.reversedAmount)}</p>
                            </div>
                            <div className="rounded-lg bg-slate-50 p-2 dark:bg-white/5">
                                <p className="font-semibold text-slate-500 dark:text-slate-400">Saldo reversivel</p>
                                <p className="mt-1 text-slate-900 dark:text-white">{formatCurrency(financialHistory.reversibleAmount)}</p>
                            </div>
                        </div>
                        {financialHistory.reversals.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {financialHistory.reversals.map((reversal, index) => (
                                    <div
                                        key={`${reversal.reversalTransactionId || financialHistory.transactionId}-${index}`}
                                        className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-slate-900 dark:text-white">{formatCurrency(reversal.amount)}</span>
                                            <span className="text-slate-500 dark:text-slate-400">
                                                {reversal.createdAt ? new Date(reversal.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-slate-600 dark:text-slate-300">
                                            {reversal.reversalType} | {reversal.reasonType}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 rounded-xl border border-slate-200/70 bg-white p-4 dark:border-white/8 dark:bg-[#0f172a]">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">Total</p>
                            <p className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                                {formatCurrency(comanda.total)}
                            </p>
                        </div>
                        <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-medium text-slate-500 dark:border-white/10 dark:text-slate-400">
                            {comanda.status === 'open' ? 'Pendente' : 'Finalizado'}
                        </span>
                    </div>
                </div>

                <div className="grid gap-2">
                    {comanda.status === 'open' ? (
                        <Button
                            onClick={onCheckout}
                            leftIcon="point_of_sale"
                            className="w-full justify-center"
                        >
                            {isEsteticaApp ? `Finalizar ${orderLabelLower}` : 'Fechar comanda'}
                        </Button>
                    ) : (
                        <Button
                            variant="secondary"
                            onClick={() => navigate(`/checkout/${comanda.id}`)}
                            leftIcon="edit"
                            className="w-full justify-center"
                        >
                            Reabrir edição
                        </Button>
                    )}
                    <Button
                        variant="secondary"
                        onClick={onPrint}
                        leftIcon="print"
                        className="w-full justify-center"
                    >
                        Imprimir
                    </Button>
                    {comanda.status === 'open' && (
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            leftIcon="block"
                            className="w-full justify-center text-red-400"
                        >
                            Cancelar {orderLabelLower}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComandaSidebar;
export type { ComandaFinancialHistory };
