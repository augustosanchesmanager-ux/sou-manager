/**
 * [SMG][COMPONENT] StatusBanner — banner global de estado do tenant (6.0.5.5).
 *
 * Refatorado no padrão Impeccable Atelier Tech:
 * - Sem azuis desbotados (Corporate Accent Blue Ban)
 * - Badge horizontal minimalista de alto contraste
 * - Respeito integral ao Estado Efetivo do Tenant
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantOptional } from '../../src/context/TenantContext';
import type { TenantStatus } from '../../domain/tenant/types';

interface BannerSpec {
  icon: string;
  label: string;
  message: string;
  tone: 'info' | 'warning' | 'danger' | 'muted';
  cta?: { label: string; to: string };
}

const BANNER_BY_STATUS: Partial<Record<TenantStatus, BannerSpec>> = {
  trial: {
    icon: 'hourglass_top',
    label: 'Período de teste',
    message: 'Sua conta está em período de teste com acesso completo.',
    tone: 'info',
    cta: { label: 'Ver Plano', to: '/settings' },
  },
  past_due: {
    icon: 'error',
    label: 'Pagamento pendente',
    message: 'Regularize sua assinatura para manter o acesso sem interrupção.',
    tone: 'warning',
    cta: { label: 'Ver Fatura', to: '/settings' },
  },
  suspended: {
    icon: 'block',
    label: 'Acesso suspenso',
    message: 'Assinatura suspensa. Entre em contato para reativar seu acesso.',
    tone: 'danger',
    cta: { label: 'Reativar', to: '/settings' },
  },
  cancelled: {
    icon: 'cancel',
    label: 'Assinatura cancelada',
    message: 'A conta está operando em modo somente leitura.',
    tone: 'muted',
  },
};

const TONE_CLASSES: Record<BannerSpec['tone'], { container: string; icon: string; text: string; cta: string }> = {
  info: {
    container: 'border-primary/30 bg-primary/10 text-primary-light',
    icon: 'text-primary',
    text: 'text-ink dark:text-white',
    cta: 'bg-primary text-night hover:bg-primary-dark font-bold',
  },
  warning: {
    container: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: 'text-amber-400',
    text: 'text-ink dark:text-white',
    cta: 'bg-amber-400 text-slate-950 hover:bg-amber-300 font-bold',
  },
  danger: {
    container: 'border-danger/30 bg-danger/10 text-danger',
    icon: 'text-danger',
    text: 'text-ink dark:text-white',
    cta: 'bg-danger text-white hover:bg-danger/80 font-bold',
  },
  muted: {
    container: 'border-line dark:border-border-dark bg-card dark:bg-card-dark text-ink-soft',
    icon: 'text-ink-soft',
    text: 'text-ink dark:text-white',
    cta: 'bg-white/10 text-ink-soft hover:text-white font-bold',
  },
};

const StatusBanner: React.FC = () => {
  const navigate = useNavigate();
  const tenantContext = useTenantOptional();
  const status = tenantContext?.tenant?.status;

  if (!status) return null;
  const spec = BANNER_BY_STATUS[status];
  if (!spec) return null;

  const styles = TONE_CLASSES[spec.tone];

  return (
    <aside className="px-4 pt-3 sm:px-8">
      <div
        role="status"
        aria-live="polite"
        className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-xs transition-all shadow-xs ${styles.container}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`material-symbols-outlined shrink-0 text-base ${styles.icon}`}>
            {spec.icon}
          </span>
          <p className="truncate text-xs font-medium">
            <span className="font-bold uppercase tracking-wider mr-1.5 opacity-90">{spec.label}:</span>
            <span className={styles.text}>{spec.message}</span>
          </p>
        </div>

        {spec.cta && (
          <button
            type="button"
            onClick={() => navigate(spec.cta!.to)}
            className={`shrink-0 px-3 py-1 rounded-lg text-[11px] transition-all shadow-xs touch-manipulation active:scale-95 ${styles.cta}`}
          >
            {spec.cta.label}
          </button>
        )}
      </div>
    </aside>
  );
};

export default StatusBanner;
