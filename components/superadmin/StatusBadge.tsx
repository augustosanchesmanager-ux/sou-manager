import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert, ShieldCheck, XCircle } from 'lucide-react';
import { AdminStatus } from './types';

const statusMap: Record<AdminStatus, string> = {
  ativo: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  inativo: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
  'aguardando ativacao': 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
  pendente: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
  'aguardando pagamento': 'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-200 dark:border-yellow-500/20',
  inadimplente: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
  bloqueado: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
  suspenso: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
  expirado: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-500/20',
  critico: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/30',
  analise: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20',
  cancelado: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
  aprovado: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
  recusado: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
};

const iconMap: Record<AdminStatus, React.ReactNode> = {
  ativo: <CheckCircle2 className="h-3.5 w-3.5" />,
  inativo: <Clock3 className="h-3.5 w-3.5" />,
  'aguardando ativacao': <Clock3 className="h-3.5 w-3.5" />,
  pendente: <Clock3 className="h-3.5 w-3.5" />,
  'aguardando pagamento': <Clock3 className="h-3.5 w-3.5" />,
  inadimplente: <AlertTriangle className="h-3.5 w-3.5" />,
  bloqueado: <ShieldAlert className="h-3.5 w-3.5" />,
  suspenso: <XCircle className="h-3.5 w-3.5" />,
  expirado: <XCircle className="h-3.5 w-3.5" />,
  critico: <AlertTriangle className="h-3.5 w-3.5" />,
  analise: <ShieldCheck className="h-3.5 w-3.5" />,
  cancelado: <XCircle className="h-3.5 w-3.5" />,
  aprovado: <CheckCircle2 className="h-3.5 w-3.5" />,
  recusado: <XCircle className="h-3.5 w-3.5" />,
};

interface StatusBadgeProps {
  status: AdminStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => (
  <span
    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize ${statusMap[status]}`}
  >
    {iconMap[status]}
    {status}
  </span>
);

export default StatusBadge;
