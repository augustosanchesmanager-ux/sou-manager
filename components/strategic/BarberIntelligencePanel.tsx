import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchStrategicDiagnosis,
  type AiAlertLevel,
  type AiAnalystResponse,
} from '../../services/aiAnalystService';

const ALERT_STYLES: Record<
  AiAlertLevel,
  { badge: string; label: string; icon: string; border: string }
> = {
  positive: {
    badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    label: 'Oportunidade',
    icon: 'trending_up',
    border: 'border-emerald-500/25',
  },
  warning: {
    badge: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    label: 'Atenção',
    icon: 'warning_amber',
    border: 'border-amber-500/30',
  },
  critical: {
    badge: 'bg-danger/10 text-danger border-danger/30',
    label: 'Crítico',
    icon: 'priority_high',
    border: 'border-danger/30',
  },
  info: {
    badge: 'bg-gold-soft text-primary-dark border-primary/30',
    label: 'Leitura',
    icon: 'insights',
    border: 'border-primary/25',
  },
};

export const BarberIntelligencePanel: React.FC = () => {
  const [diagnosis, setDiagnosis] = useState<AiAnalystResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadDiagnosis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchStrategicDiagnosis();
      setDiagnosis(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível carregar o diagnóstico inteligente.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnosis();
  }, [loadDiagnosis]);

  return (
    <section
      aria-label="Diagnóstico Inteligente de Gestão"
      className="rounded-3xl border border-line bg-card p-5 shadow-smg-shell sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-gold-soft px-3 py-1 text-[10px] font-black uppercase tracking-widest text-primary-dark">
              <span className="material-symbols-outlined text-sm">auto_awesome</span>
              Diagnóstico Inteligente
            </span>
            {diagnosis && (
              <span className="rounded-full border border-line bg-cream px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink-soft">
                {diagnosis.coldStart
                  ? 'Aguardando atendimentos'
                  : diagnosis.cached
                    ? 'Cache diário'
                    : 'Gerado hoje'}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-lg font-black text-ink">
            Leitura executiva dos últimos 7 dias
          </h3>
        </div>

        <button
          type="button"
          onClick={() => void loadDiagnosis()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-line bg-cream px-3.5 py-2 text-xs font-bold text-ink transition hover:bg-gold-pale disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <span className={`material-symbols-outlined text-base text-primary ${loading ? 'animate-spin' : ''}`}>
            refresh
          </span>
          {loading ? 'Analisando...' : 'Atualizar leitura'}
        </button>
      </div>

      {loading && !diagnosis && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((idx) => (
            <div
              key={idx}
              className="h-40 animate-pulse rounded-2xl border border-line bg-cream/70 p-4"
            />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadDiagnosis()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger px-3.5 py-2 text-xs font-bold text-white transition hover:bg-danger/90"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {diagnosis && !error && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {diagnosis.cards.map((card, index) => {
            const style = ALERT_STYLES[card.alertLevel] ?? ALERT_STYLES.info;
            return (
              <article
                key={`${card.title}-${index}`}
                className={`flex flex-col justify-between rounded-2xl border ${style.border} bg-cream/60 p-4 transition hover:bg-cream`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${style.badge}`}
                    >
                      <span className="material-symbols-outlined text-xs">{style.icon}</span>
                      {style.label}
                    </span>
                  </div>
                  <h4 className="mt-3 text-base font-black leading-snug text-ink">
                    {card.title}
                  </h4>
                  <p className="mt-2 text-xs font-medium leading-relaxed text-ink-soft">
                    {card.diagnosis}
                  </p>
                </div>

                <div className="mt-4 rounded-xl border border-line bg-card p-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                    Ação recomendada
                  </p>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-ink">
                    {card.recommendedAction}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
