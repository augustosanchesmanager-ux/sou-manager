import React from 'react';

export type StandardStatus =
    | 'scheduled'
    | 'pending'
    | 'confirmed'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
    | 'no_show'
    | 'open'
    | 'blocked'
    | 'closed'
    | 'paid'
    | 'active'
    | 'paused'
    | 'draft'
    | 'settled'
    | 'failed'
    | string;

export interface StatusBadgeProps {
    status: StandardStatus;
    size?: 'sm' | 'md' | 'lg';
    showDot?: boolean;
    customLabel?: string;
    className?: string;
}

interface StatusConfig {
    label: string;
    style: string;
    dotColor: string;
}

const statusMap: Record<string, StatusConfig> = {
    // Agenda (tokens sched-*)
    scheduled: {
        label: 'Agendado',
        style: 'bg-sched-scheduled/15 text-sched-scheduled-strong border-sched-scheduled/30',
        dotColor: 'bg-sched-scheduled',
    },
    pending: {
        label: 'Pendente',
        style: 'bg-sched-pending/15 text-sched-pending-strong border-sched-pending/30',
        dotColor: 'bg-sched-pending',
    },
    confirmed: {
        label: 'Confirmado',
        style: 'bg-sched-confirmed/15 text-sched-confirmed-strong border-sched-confirmed/30',
        dotColor: 'bg-sched-confirmed',
    },
    in_progress: {
        label: 'Em Andamento',
        style: 'bg-sched-in-progress/15 text-sched-in-progress-strong border-sched-in-progress/30',
        dotColor: 'bg-sched-in-progress',
    },
    completed: {
        label: 'Concluído',
        style: 'bg-sched-completed/15 text-sched-completed-strong border-sched-completed/30',
        dotColor: 'bg-sched-completed',
    },
    cancelled: {
        label: 'Cancelado',
        style: 'bg-sched-cancelled/15 text-sched-cancelled-strong border-sched-cancelled/30',
        dotColor: 'bg-sched-cancelled',
    },
    no_show: {
        label: 'Não Compareceu',
        style: 'bg-sched-no-show/15 text-sched-no-show-strong border-sched-no-show/30',
        dotColor: 'bg-sched-no-show',
    },

    // Comandas & Checkout
    open: {
        label: 'Aberta',
        style: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
        dotColor: 'bg-teal-500',
    },
    blocked: {
        label: 'Bloqueada',
        style: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
        dotColor: 'bg-orange-500',
    },
    closed: {
        label: 'Fechada',
        style: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
        dotColor: 'bg-slate-400',
    },
    paid: {
        label: 'Paga',
        style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotColor: 'bg-emerald-500',
    },

    // Assinaturas / Club
    active: {
        label: 'Ativo',
        style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotColor: 'bg-emerald-500',
    },
    paused: {
        label: 'Pausado',
        style: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
        dotColor: 'bg-amber-500',
    },

    // Financeiro & Operacional
    draft: {
        label: 'Rascunho',
        style: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
        dotColor: 'bg-slate-400',
    },
    settled: {
        label: 'Liquidado',
        style: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
        dotColor: 'bg-emerald-500',
    },
    failed: {
        label: 'Falhou',
        style: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
        dotColor: 'bg-red-500',
    },
};

const fallbackConfig: StatusConfig = {
    label: 'Desconhecido',
    style: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/20',
    dotColor: 'bg-slate-400',
};

const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 gap-1 font-semibold',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-bold',
    lg: 'text-sm px-3 py-1.5 gap-2 font-bold',
};

const dotSizes = {
    sm: 'size-1.5',
    md: 'size-2',
    lg: 'size-2.5',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
    status,
    size = 'md',
    showDot = true,
    customLabel,
    className = '',
}) => {
    const normalizedKey = status ? String(status).toLowerCase().trim() : '';
    const config = statusMap[normalizedKey] || fallbackConfig;
    const label = customLabel || (statusMap[normalizedKey] ? config.label : status);

    return (
        <span
            className={`inline-flex items-center rounded-full border transition-colors ${config.style} ${sizeStyles[size]} ${className}`.trim()}
        >
            {showDot && (
                <span className={`rounded-full shrink-0 ${config.dotColor} ${dotSizes[size]}`} />
            )}
            <span>{label}</span>
        </span>
    );
};

export default StatusBadge;
