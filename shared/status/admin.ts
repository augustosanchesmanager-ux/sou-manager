/**
 * [SMG][SHARED][STATUS] admin
 *
 * Status de administração (SuperAdmin): labels, ícones, cores.
 * Substitui definições em StatusBadge.tsx, SuperAdmin.tsx.
 */

export type AdminStatus =
  | 'ativo'
  | 'inativo'
  | 'aguardando ativacao'
  | 'pendente'
  | 'aguardando pagamento'
  | 'inadimplente'
  | 'bloqueado'
  | 'suspenso'
  | 'expirado'
  | 'critico'
  | 'analise'
  | 'cancelado'
  | 'aprovado'
  | 'recusado';

export interface AdminStatusMeta {
  className: string;
  iconName: string;
}

/**
 * Metadados de status administrativo (cor + ícone Lucide).
 */
export const adminStatusMeta: Record<AdminStatus, AdminStatusMeta> = {
  ativo: {
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    iconName: 'CheckCircle2',
  },
  inativo: {
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
    iconName: 'Clock3',
  },
  'aguardando ativacao': {
    className:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/20',
    iconName: 'Clock3',
  },
  pendente: {
    className:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20',
    iconName: 'Clock3',
  },
  'aguardando pagamento': {
    className:
      'bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-200 dark:border-yellow-500/20',
    iconName: 'Clock3',
  },
  inadimplente: {
    className:
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:border-orange-500/20',
    iconName: 'AlertTriangle',
  },
  bloqueado: {
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
    iconName: 'ShieldAlert',
  },
  suspenso: {
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20',
    iconName: 'XCircle',
  },
  expirado: {
    className:
      'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/10 dark:text-zinc-300 dark:border-zinc-500/20',
    iconName: 'XCircle',
  },
  critico: {
    className:
      'bg-red-100 text-red-800 border-red-300 dark:bg-red-500/15 dark:text-red-200 dark:border-red-500/30',
    iconName: 'AlertTriangle',
  },
  analise: {
    className:
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:border-cyan-500/20',
    iconName: 'ShieldCheck',
  },
  cancelado: {
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10',
    iconName: 'XCircle',
  },
  aprovado: {
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20',
    iconName: 'CheckCircle2',
  },
  recusado: {
    className:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/20',
    iconName: 'XCircle',
  },
};

/**
 * Mapeia status de plano para AdminStatus.
 */
export const mapPlanStatus = (status: string): AdminStatus =>
  status === 'approved'
    ? 'aprovado'
    : status === 'rejected'
      ? 'recusado'
      : 'pendente';

/**
 * Mapeia status de ticket para AdminStatus.
 */
export const mapTicketStatus = (status: string): AdminStatus =>
  status === 'closed'
    ? 'aprovado'
    : status === 'responded'
      ? 'analise'
      : 'pendente';

/**
 * Verifica se um valor é um AdminStatus válido.
 */
export const isAdminStatus = (value: string): value is AdminStatus =>
  value in adminStatusMeta;
