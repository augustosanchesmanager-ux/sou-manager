import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { SummaryCardData } from './types';

interface FinancialSummaryCardProps extends SummaryCardData {
  icon: React.ReactNode;
}

const toneMap = {
  positive: {
    value: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/20',
    iconWrap: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  negative: {
    value: 'text-rose-600 dark:text-rose-400',
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/20',
    iconWrap: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  },
  neutral: {
    value: 'text-slate-900 dark:text-white',
    badge: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
    iconWrap: 'bg-slate-500/10 text-slate-700 dark:text-slate-300',
  },
};

const FinancialSummaryCard: React.FC<FinancialSummaryCardProps> = ({
  title,
  value,
  changeText,
  trend,
  helperText,
  tone,
  icon,
}) => {
  const palette = toneMap[tone];

  return (
    <article className="rounded-2xl border border-slate-200/80 dark:border-border-dark bg-white/95 dark:bg-card-dark/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] dark:shadow-[0_14px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-500 dark:text-slate-400">{title}</span>
        <div className={`size-9 rounded-xl border border-current/10 grid place-items-center ${palette.iconWrap}`}>{icon}</div>
      </div>

      <p className={`mt-4 text-[1.7rem] leading-none font-black ${palette.value}`}>
        {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${palette.badge}`}>
          {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {changeText}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{helperText}</span>
      </div>
    </article>
  );
};

export default FinancialSummaryCard;
