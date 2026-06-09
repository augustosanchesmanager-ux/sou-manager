import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { SummaryCardData } from './types';

interface FinancialSummaryCardProps extends SummaryCardData {
  icon: React.ReactNode;
}

const toneMap = {
  positive: {
    value: 'text-emerald-300',
    badge: 'bg-emerald-400/15 text-emerald-100 border-emerald-300/25',
    iconWrap: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/20',
  },
  negative: {
    value: 'text-rose-300',
    badge: 'bg-rose-400/15 text-rose-100 border-rose-300/25',
    iconWrap: 'bg-rose-400/15 text-rose-200 border-rose-300/20',
  },
  neutral: {
    value: 'text-slate-50',
    badge: 'bg-white/10 text-slate-100 border-white/15',
    iconWrap: 'bg-white/10 text-slate-200 border-white/15',
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
    <article className="rounded-2xl border border-white/10 bg-[#243241] p-5 text-slate-100 shadow-[0_18px_36px_rgba(15,23,42,0.18)] backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-[0.16em] font-bold text-slate-300">{title}</span>
        <div className={`size-9 rounded-xl border grid place-items-center ${palette.iconWrap}`}>{icon}</div>
      </div>

      <p className={`mt-4 text-[1.7rem] leading-none font-black ${palette.value}`}>
        {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-bold ${palette.badge}`}>
          {trend === 'up' ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {changeText}
        </span>
        <span className="text-xs text-slate-300">{helperText}</span>
      </div>
    </article>
  );
};

export default FinancialSummaryCard;
