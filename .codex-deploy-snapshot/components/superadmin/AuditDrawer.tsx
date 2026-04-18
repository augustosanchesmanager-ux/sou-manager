import React from 'react';
import { Clock3, FileClock, MapPinned, X } from 'lucide-react';
import { AdminActivity } from './types';
import StatusBadge from './StatusBadge';

interface AuditDrawerProps {
  item: AdminActivity | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const AuditDrawer: React.FC<AuditDrawerProps> = ({ item, isOpen, onClose }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[95]" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-950/35 backdrop-blur-sm" />
      <aside
        className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl dark:border-[#262A33] dark:bg-[#101116]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">Detalhes do evento</p>
            <h3 className="mt-2 text-2xl font-black text-slate-950 dark:text-white display-font">{item.type}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={item.status} />
              <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                {formatDateTime(item.dateTime)}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:border-primary hover:text-primary dark:border-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Empresa vinculada</p>
            <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{item.company}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Responsavel</p>
            <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{item.actor}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Usuario impactado</p>
            <p className="mt-2 text-sm font-bold text-slate-950 dark:text-white">{item.user}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Origem</p>
            <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
              <MapPinned className="h-4 w-4 text-primary" />
              {item.origin}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Observacoes</p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{item.notes}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
              <FileClock className="h-4 w-4 text-primary" />
              Log tecnico
            </div>
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">{item.technicalLog}</pre>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Trilha de auditoria</p>
            <div className="mt-4 space-y-3">
              {item.auditTrail.map((step, index) => (
                <div key={`${item.id}-${index}`} className="flex gap-3">
                  <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <p className="text-sm font-bold text-slate-950 dark:text-white">Acoes disponiveis</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Revisar auditoria completa, reenviar notificacao, bloquear acesso relacionado ou escalar para suporte tecnico.</p>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default AuditDrawer;
