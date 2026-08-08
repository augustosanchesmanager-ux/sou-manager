/**
 * [SMG][COMPONENT] StatusBanner — banner global de estado do tenant (6.0.5.5).
 *
 * D-6.0.5.5-2: consciência de `trial/past_due/suspended/cancelled` na UI.
 * Lê o Estado Efetivo (TenantRecord.status via useTenant — 6.0.5.1) e é
 * COSMÉTICO/INFORMATIVO: nunca derruba nem libera acesso por conta própria
 * (D-6.0.5-1/2; a autoridade de acesso continua no Estado Efetivo/guards).
 *
 * | status     | comportamento                          |
 * |------------|----------------------------------------|
 * | trial      | informativo (período de teste)         |
 * | past_due   | aviso read-only (D-6.0.5-1)            |
 * | suspended  | bloqueado + CTA de reativação          |
 * | cancelled  | somente leitura (D-6.0.5-2)            |
 * | active     | nenhum banner                          |
 * | draft      | nenhum banner (onboarding rege)        |
 * | archived   | nenhum banner                          |
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantOptional } from '../../src/context/TenantContext';
import type { TenantStatus } from '../../src/lib/supabase/tenant';

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
    message: 'Sua conta está em período de teste.',
    tone: 'info',
    cta: { label: 'Ver Meu Plano', to: '/settings' },
  },
  past_due: {
    icon: 'error',
    label: 'Pagamento em atraso',
    message: 'Há um pagamento pendente na sua conta. O acesso pode ser suspenso.',
    tone: 'warning',
    cta: { label: 'Ver Meu Plano', to: '/settings' },
  },
  suspended: {
    icon: 'block',
    label: 'Acesso suspenso',
    message: 'Sua assinatura foi suspensa. Entre em contato para reativar o acesso.',
    tone: 'danger',
    cta: { label: 'Ver Meu Plano', to: '/settings' },
  },
  cancelled: {
    icon: 'cancel',
    label: 'Assinatura cancelada',
    message: 'Sua assinatura foi cancelada. A conta está em modo somente leitura.',
    tone: 'muted',
  },
};

const TONE_CLASSES: Record<BannerSpec['tone'], string> = {
  info: 'border-sky-500/20 bg-sky-500/10 text-sky-200',
  warning: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
  danger: 'border-red-500/30 bg-red-500/10 text-red-200',
  muted: 'border-white/10 bg-white/5 text-slate-300',
};

const StatusBanner: React.FC = () => {
  const navigate = useNavigate();
  const tenantContext = useTenantOptional();
  const status = tenantContext?.tenant?.status;

  if (!status) return null;
  const spec = BANNER_BY_STATUS[status];
  if (!spec) return null;

  return (
    <div className="px-4 pt-3 sm:px-8">
      <div
        role="status"
        aria-live="polite"
        className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${TONE_CLASSES[spec.tone]}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="material-symbols-outlined shrink-0 text-lg">{spec.icon}</span>
          <div className="min-w-0">
            <p className="font-black text-xs uppercase tracking-wide">{spec.label}</p>
            <p className="text-xs opacity-80 leading-relaxed">{spec.message}</p>
          </div>
        </div>
        {spec.cta && (
          <button
            onClick={() => navigate(spec.cta!.to)}
            className="shrink-0 self-start sm:self-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-black uppercase tracking-wide transition-colors"
          >
            {spec.cta.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default StatusBanner;
