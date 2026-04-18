import React from 'react';
import { TrendingUp } from 'lucide-react';
import { AdminKpi } from './types';

const toneAccent = {
  gold: 'from-amber-500/70 to-orange-500/50',
  emerald: 'from-emerald-500/70 to-teal-500/50',
  red: 'from-red-500/70 to-rose-500/50',
  slate: 'from-slate-400/70 to-slate-300/50',
  blue: 'from-sky-500/70 to-cyan-500/50',
};

const toneSurface = {
  gold: 'border-amber-200/60 bg-gradient-to-br from-amber-500/20 to-orange-500/10 text-amber-700 dark:border-amber-500/20 dark:text-amber-200',
  emerald: 'border-emerald-200/60 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 text-emerald-700 dark:border-emerald-500/20 dark:text-emerald-200',
  red: 'border-red-200/60 bg-gradient-to-br from-red-500/20 to-rose-500/10 text-red-700 dark:border-red-500/20 dark:text-red-200',
  slate: 'border-slate-200/60 bg-gradient-to-br from-slate-300/30 to-slate-200/10 text-slate-700 dark:border-white/10 dark:text-slate-200',
  blue: 'border-sky-200/60 bg-gradient-to-br from-sky-500/20 to-cyan-500/10 text-sky-700 dark:border-sky-500/20 dark:text-sky-200',
};

interface KpiCardProps {
  item: AdminKpi;
}

const KpiCard: React.FC<KpiCardProps> = ({ item }) => {
  const Icon = item.icon;

  return (
    <article className="card-boutique relative overflow-hidden p-5">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneAccent[item.tone]}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{item.title}</p>
          <p className="mt-4 text-3xl font-black text-slate-950 dark:text-white display-font">{item.value}</p>
        </div>
        <div className={`rounded-2xl border p-3 ${toneSurface[item.tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
        <span>{item.delta}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{item.context}</p>
    </article>
  );
};

export default KpiCard;
