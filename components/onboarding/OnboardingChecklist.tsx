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

const getStorageKey = (tenantId: string) => `smg:onboarding:dismissed:${tenantId}`;

/**
 * Bloco 4 — Checklist de Onboarding (Fase 6.0.2).
 *
 * Exibido no dashboard enquanto a barbearia ainda não está em operação completa.
 * Inclui opção de dispensar/minimizar com persistência no localStorage por tenant.
 */
const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ tenantId }) => {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(getStorageKey(tenantId)) === 'true';
    } catch {
      return false;
    }
  });
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

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

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      localStorage.setItem(getStorageKey(tenantId), 'true');
    } catch {
      // Ignora falha de storage isolada
    }
  };

  const handleReopen = () => {
    setIsDismissed(false);
    try {
      localStorage.removeItem(getStorageKey(tenantId));
    } catch {
      // Ignora falha de storage isolada
    }
  };

  if (!progress || progress.completed) {
    return null;
  }

  // Se foi dispensado pelo usuário, exibe apenas uma pílula sutil caso queira reabrir
  if (isDismissed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleReopen}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line dark:border-border-dark bg-card dark:bg-card-dark text-[11px] font-semibold text-ink-soft hover:text-ink dark:hover:text-white hover:border-primary/40 transition-colors shadow-xs touch-manipulation"
        >
          <span className="material-symbols-outlined text-sm text-primary">rocket_launch</span>
          <span>Guia inicial ({progress.percent}%)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line dark:border-border-dark bg-card dark:bg-card-dark shadow-sm transition-colors">
      <div className="flex items-center justify-between border-b border-line dark:border-border-dark p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-primary text-lg">rocket_launch</span>
          <div>
            <h3 className="font-display font-bold text-sm sm:text-base text-ink dark:text-white">Comece por aqui</h3>
            <p className="text-[11px] text-ink-soft">
              {progress.doneCount} de {progress.totalCount} passos concluídos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-display font-bold tabular-nums text-xs text-primary-dark dark:text-primary-light px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
            {progress.percent}%
          </span>

          {/* Minimizar / Recolher */}
          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? 'Expandir checklist' : 'Minimizar checklist'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line dark:border-border-dark bg-card dark:bg-surface-dark text-ink-soft hover:text-ink dark:hover:text-white transition-colors"
          >
            <span className={`material-symbols-outlined text-base transition-transform duration-200 ${isCollapsed ? 'rotate-180' : ''}`}>
              expand_less
            </span>
          </button>

          {/* Fechar / Dispensar */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dispensar guia Comece por aqui"
            title="Dispensar guia"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line dark:border-border-dark bg-card dark:bg-surface-dark text-ink-soft hover:text-danger hover:border-danger/30 transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div className="border-b border-line dark:border-border-dark p-4 sm:p-5 bg-gold-pale/30 dark:bg-white/[0.01]">
            <div className="h-1.5 bg-line dark:bg-border-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-ink-soft">
              Configure sua barbearia para começar a receber os primeiros agendamentos.
            </p>
          </div>

          <div className="divide-y divide-line dark:divide-border-dark">
            {progress.items.map((item) => {
              const meta = ITEM_META[item.key] ?? { icon: 'check_circle' };
              return (
                <div key={item.key} className="flex items-center justify-between p-3.5 sm:p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        item.done
                          ? 'border-success/30 bg-success/10 text-success'
                          : 'border-line dark:border-border-dark bg-card dark:bg-surface-dark text-ink-soft'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">
                        {item.done ? 'check_circle' : meta.icon}
                      </span>
                    </div>
                    <span
                      className={`text-xs sm:text-sm ${
                        item.done
                          ? 'font-medium text-ink-soft/70 line-through'
                          : 'font-semibold text-ink dark:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>

                  {!item.done && meta.link && (
                    <Link
                      to={meta.link}
                      className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:text-primary-dark transition-colors shrink-0"
                    >
                      <span>Começar</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default OnboardingChecklist;
