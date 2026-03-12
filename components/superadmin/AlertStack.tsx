import React from 'react';
import { AlertTriangle, ArrowRight, BellRing, Siren, Zap } from 'lucide-react';
import { RiskAlert } from './types';

const severityStyles = {
  alto: {
    wrapper: 'border-red-200 bg-red-50/80 dark:border-red-500/20 dark:bg-red-500/10',
    badge: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
    icon: Siren,
  },
  medio: {
    wrapper: 'border-amber-200 bg-amber-50/80 dark:border-amber-500/20 dark:bg-amber-500/10',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    icon: AlertTriangle,
  },
  baixo: {
    wrapper: 'border-sky-200 bg-sky-50/80 dark:border-sky-500/20 dark:bg-sky-500/10',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-200',
    icon: BellRing,
  },
};

interface AlertStackProps {
  items: RiskAlert[];
  onOpenAlert: (alert: RiskAlert) => void;
}

const AlertStack: React.FC<AlertStackProps> = ({ items, onOpenAlert }) => (
  <section className="card-boutique p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white">Alertas e riscos</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Fila de priorizacao para seguranca, faturamento e integracoes.</p>
      </div>
      <div className="rounded-full bg-red-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/20 dark:text-red-200">
        Criticidade
      </div>
    </div>

    <div className="mt-5 space-y-3">
      {items.map((item) => {
        const Icon = severityStyles[item.severity].icon;
        return (
          <button
            key={item.id}
            onClick={() => onOpenAlert(item)}
            className={`w-full rounded-2xl border p-4 text-left transition hover:shadow-lg ${severityStyles[item.severity].wrapper}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="rounded-2xl bg-white/80 p-2 text-slate-700 shadow-sm dark:bg-white/10 dark:text-white">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-950 dark:text-white">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{item.description}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-slate-950 dark:text-white display-font">{item.count}</p>
                <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${severityStyles[item.severity].badge}`}>
                  {item.severity}
                </span>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
              <span>{item.sla}</span>
              <span className="inline-flex items-center gap-1">
                {item.cta}
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </div>
          </button>
        );
      })}
    </div>

    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
        <Zap className="h-4 w-4 text-primary" />
        Resumo de criticidade do dia
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        3 incidentes exigem escalacao imediata. O principal risco esta concentrado em login suspeito, inadimplencia prolongada e falha de integracao de cobranca.
      </p>
    </div>
  </section>
);

export default AlertStack;
