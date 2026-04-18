import React from 'react';
import { Clock3 } from 'lucide-react';
import { AdminActivity } from './types';
import StatusBadge from './StatusBadge';
import Button from '../ui/Button';
import EmptyState from './EmptyState';

interface ActivityTimelineProps {
  items: AdminActivity[];
  onOpenDetails: (item: AdminActivity) => void;
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ items, onOpenDetails }) => (
  <section className="card-boutique p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-bold text-slate-950 dark:text-white">Linha do tempo operacional</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">Eventos mais sensiveis com destaque para seguranca, faturamento e permissoes.</p>
      </div>
      <div className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 dark:bg-white/5 dark:text-slate-300">
        {items.length} eventos
      </div>
    </div>

    {items.length === 0 ? (
      <div className="mt-5">
        <EmptyState title="Nenhuma movimentacao encontrada" description="Ajuste os filtros para ver os eventos operacionais." />
      </div>
    ) : (
      <div className="mt-6 space-y-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-2xl border border-slate-200 bg-white/70 p-4 transition hover:border-primary/30 hover:shadow-lg dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-200">
                  <Clock3 className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-slate-950 dark:text-white">{item.type}</p>
                    <StatusBadge status={item.status} />
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.dateTime)}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">{item.summary}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>Empresa: {item.company}</span>
                    <span>Usuario: {item.user}</span>
                    <span>Origem: {item.origin}</span>
                    <span>Responsavel: {item.actor}</span>
                  </div>
                </div>
              </div>
              <Button variant="secondary" size="sm" className="rounded-xl self-start" onClick={() => onOpenDetails(item)}>
                Ver detalhes
              </Button>
            </div>
          </article>
        ))}
      </div>
    )}
  </section>
);

export default ActivityTimeline;
