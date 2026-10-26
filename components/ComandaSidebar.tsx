import React from 'react';
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
    canManageFinancialReversal?: boolean;
    onClose: () => void;
    onCancel: () => void;
    onPrint: () => void;
    onCheckout: () => void;
    onReopenPaid?: () => void;
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
            className: 'bg-gold-soft text-primary-dark border-primary-light/60',
            dotClassName: 'bg-primary-dark',
        };
    }
    if (status === 'open') {
        return {
            label: isEsteticaApp ? 'Aberto' : 'Aberta',
            className: 'bg-primary/10 text-primary-dark border-primary/30',
            dotClassName: 'bg-primary',
        };
    }
    if (status === 'paid') {
        return {
            label: isEsteticaApp ? 'Finalizado' : 'Paga',
            className: 'bg-success/10 text-success border-success/30',
            dotClassName: 'bg-success',
        };
    }
    return {
        label: isEsteticaApp ? 'Cancelado' : 'Cancelada',
        className: 'bg-line/40 text-ink-soft border-line',
        dotClassName: 'bg-line',
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
    canManageFinancialReversal = false,
    onClose,
    onCancel,
    onPrint,
    onCheckout,
    onReopenPaid,
}) => {
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
            <div className="rounded-2xl border border-line bg-card p-4 text-ink shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-wider text-ink-soft">
                            {orderLabel}
                        </p>
                        <h2 className="text-xl font-black tabular-nums tracking-[-0.02em] text-ink">
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
                            className="flex size-8 items-center justify-center rounded-lg border border-line bg-card text-ink-soft transition-all duration-150 active:scale-95 touch-manipulation hover:border-primary-light hover:bg-gold-pale hover:text-ink"
                            aria-label={`Fechar painel do ${orderLabelLower}`}
                            title="Fechar painel"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <p className="text-lg font-bold text-ink">{comanda.clients.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl border border-line bg-card p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Abertura</p>
                        <p className={`mt-1 text-sm font-semibold ${
                            openingInfo.isToday ? 'text-success' : 'text-ink'
                        }`}>
                            {openingInfo.label}
                        </p>
                        <p className="text-xs tabular-nums text-ink-soft">
                            {formatTimeLabel(comanda.created_at)}
                        </p>
                    </div>
                    <div className="rounded-xl border border-line bg-card p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Agendamento</p>
                        {appointmentDate ? (
                            <>
                                <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                                    {appointmentDate.toLocaleDateString('pt-BR', { day: 'numeric' })}
                                </p>
                                <p className="text-xs tabular-nums text-ink-soft">
                                    {formatTimeLabel(comanda.appointment!.start_time!)}
                                </p>
                            </>
                        ) : (
                            <p className="mt-1 text-xs text-ink-soft">Sem agendamento</p>
                        )}
                    </div>
                </div>

                <div className="mb-4 rounded-xl border border-line bg-card p-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Profissional</p>
                    <p className="mt-1 text-sm font-semibold text-ink">
                        {comanda.staff_names.join(' / ') || 'Sem profissional'}
                    </p>
                    <p className="text-xs text-ink-soft">
                        {comanda.comanda_items.length} {comanda.comanda_items.length === 1 ? 'item' : 'itens'}
                    </p>
                </div>

                <div className="mb-4 rounded-xl border border-line bg-card p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Consumo</p>
                        <span className="text-[10px] text-ink-soft">
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
                                    <span className="truncate text-ink-soft">
                                        {item.product_name}
                                    </span>
                                    <span className="shrink-0 font-medium tabular-nums tracking-[-0.02em] whitespace-nowrap text-ink">
                                        {formatCurrency(item.unit_price * item.quantity)}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-ink-soft">Sem itens lançados</p>
                        )}
                        {comanda.comanda_items.length > 5 && (
                            <p className="text-xs text-ink-soft">
                                +{comanda.comanda_items.length - 5} mais itens
                            </p>
                        )}
                    </div>
                </div>

                {financialHistory && (
                    <div className="mb-4 rounded-xl border border-line bg-card p-3">
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Histórico financeiro</p>
                                <p className="mt-1 text-sm font-semibold tabular-nums tracking-[-0.02em] whitespace-nowrap text-ink">
                                    {formatCurrency(financialHistory.amount)}
                                </p>
                            </div>
                            <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                                financialHistory.reversalStatus === 'full'
                                    ? 'border-danger/30 bg-danger/10 text-danger'
                                    : financialHistory.reversalStatus === 'partial'
                                    ? 'border-primary/30 bg-gold-soft text-primary-dark'
                                    : 'border-success/30 bg-success/10 text-success'
                            }`}>
                                {financialHistory.reversalStatus === 'full'
                                    ? 'Estornado total'
                                    : financialHistory.reversalStatus === 'partial'
                                    ? 'Estornado parcial'
                                    : 'Baixa registrada'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="rounded-lg bg-gold-pale p-2">
                                <p className="font-semibold text-ink-soft">Forma</p>
                                <p className="mt-1 text-ink">{financialHistory.paymentMethod}</p>
                            </div>
                            <div className="rounded-lg bg-gold-pale p-2">
                                <p className="font-semibold text-ink-soft">Data</p>
                                <p className="mt-1 text-ink tabular-nums">
                                    {financialHistory.date ? new Date(financialHistory.date).toLocaleDateString('pt-BR') : 'Não informada'}
                                </p>
                            </div>
                            <div className="rounded-lg bg-gold-pale p-2">
                                <p className="font-semibold text-ink-soft">Revertido</p>
                                <p className="mt-1 text-ink tabular-nums tracking-[-0.02em] whitespace-nowrap">{formatCurrency(financialHistory.reversedAmount)}</p>
                            </div>
                            <div className="rounded-lg bg-gold-pale p-2">
                                <p className="font-semibold text-ink-soft">Saldo reversível</p>
                                <p className="mt-1 text-ink tabular-nums tracking-[-0.02em] whitespace-nowrap">{formatCurrency(financialHistory.reversibleAmount)}</p>
                            </div>
                        </div>
                        {financialHistory.reversals.length > 0 && (
                            <div className="mt-3 space-y-2">
                                {financialHistory.reversals.map((reversal, index) => (
                                    <div
                                        key={`${reversal.reversalTransactionId || financialHistory.transactionId}-${index}`}
                                        className="rounded-lg border border-primary/30 bg-gold-soft/40 p-2 text-xs"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-ink tabular-nums whitespace-nowrap">{formatCurrency(reversal.amount)}</span>
                                            <span className="text-ink-soft tabular-nums">
                                                {reversal.createdAt ? new Date(reversal.createdAt).toLocaleDateString('pt-BR') : 'Sem data'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-ink-soft">
                                            {reversal.reversalType} | {reversal.reasonType}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mb-4 rounded-xl border border-line bg-card p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-wider text-ink-soft">Total</p>
                            <p className="text-2xl font-black tabular-nums tracking-[-0.02em] whitespace-nowrap text-ink">
                                {formatCurrency(comanda.total)}
                            </p>
                        </div>
                        <span className="rounded-full border border-line bg-gold-pale px-2 py-1 text-[10px] font-bold text-ink-soft">
                            {comanda.status === 'open' ? 'Pendente' : 'Finalizado'}
                        </span>
                    </div>
                </div>

                <div className="grid gap-2">
                    {comanda.status === 'open' && (
                        <Button
                            onClick={onCheckout}
                            leftIcon="point_of_sale"
                            className="w-full justify-center"
                        >
                            {isEsteticaApp ? `Finalizar ${orderLabelLower}` : 'Fechar comanda'}
                        </Button>
                    )}
                    {comanda.status === 'paid' && (
                        canManageFinancialReversal && onReopenPaid && financialHistory && financialHistory.reversalStatus === 'none' && financialHistory.reversibleAmount > 0 ? (
                            <Button
                                variant="secondary"
                                onClick={onReopenPaid}
                                leftIcon="undo"
                                className="w-full justify-center border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                            >
                                Reabrir Comanda
                            </Button>
                        ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                {canManageFinancialReversal
                                    ? financialHistory && financialHistory.reversalStatus !== 'none'
                                        ? `Baixa financeira já possui estorno registrado (${financialHistory.reversalStatus === 'full' ? 'total' : 'parcial'}).`
                                        : 'Baixa sem lançamento financeiro reversível (fechamento administrativo ou saldo zero).'
                                    : `${orderLabel} finalizado. Apenas gestores podem estornar a baixa financeira para reabrir a comanda.`}
                            </div>
                        )
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
