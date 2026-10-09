import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onboardingProgressService, type OnboardingProgress } from '../../application/onboardingProgress';

const ITEM_META: Record<string, { icon: string; link?: string }> = {
  shop: { icon: 'storefront' },
  barbers: { icon: 'groups', link: '/team' },
  services: { icon: 'content_cut', link: '/services' },
  clients: { icon: 'person_add', link: '/clients' },
  firstAppointment: { icon: 'event_available', link: '/schedule' },
};

interface OnboardingChecklistProps {
  tenantId: string;
}

/**
 * Bloco 4 — Checklist de Onboarding (Fase 6.0.2).
 *
 * Exibido no dashboard enquanto a barbearia ainda não está em operação
 * completa. Deriva o progresso apenas de leitura (OnboardingProgressService);
 * nenhum estado é escrito aqui.
 */
const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ tenantId }) => {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void onboardingProgressService
      .getProgress(tenantId)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch(() => {
        if (!cancelled) setProgress(null);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  if (!progress) {
    return (
      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">rocket_launch</span>
          <h3 className="font-bold text-ink">Comece por aqui</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 rounded bg-gold-pale" />
          ))}
        </div>
      </div>
    );
  }

  if (progress.completed) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line p-5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary-dark">rocket_launch</span>
          <h3 className="font-bold text-ink">Comece por aqui</h3>
        </div>
        <span className="text-xs font-black text-primary-dark">{progress.percent}%</span>
      </div>

      <div className="border-b border-line p-5">
        <div className="h-1.5 bg-line rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-ink-soft">
          {progress.doneCount} de {progress.totalCount} passos — monte sua barbearia para receber os primeiros clientes.
        </p>
      </div>

      <div className="divide-y divide-line">
        {progress.items.map((item) => {
          const meta = ITEM_META[item.key] ?? { icon: 'check_circle' };
          return (
            <div key={item.key} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    item.done ? 'bg-success/10' : 'bg-gold-pale'
                  }`}
                >
                  {item.done ? (
                    <span className="material-symbols-outlined text-base text-success">check_circle</span>
                  ) : (
                    <span className="material-symbols-outlined text-base text-ink-soft">{meta.icon}</span>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    item.done
                      ? 'font-semibold text-ink-soft line-through'
                      : 'font-semibold text-ink'
                  }`}
                >
                  {item.label}
                </span>
              </div>
              {!item.done && meta.link && (
                <Link
                  to={meta.link}
                  className="inline-flex items-center gap-1 text-xs font-black text-primary transition hover:text-primary-dark"
                >
                  Começar
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingChecklist;