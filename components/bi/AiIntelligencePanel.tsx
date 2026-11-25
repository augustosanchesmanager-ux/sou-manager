import React, { useCallback, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, ShieldAlert, Sparkles } from 'lucide-react';
import {
  fetchAiWeeklyDiagnosis,
  type AiAlertLevel,
  type AiAnalystResponse,
} from '../../src/modules/intelligence/aiAnalystService';

interface AiIntelligencePanelProps {
  unitName: string;
}

const CARD_STYLES: Record<
  AiAlertLevel,
  { border: string; badge: string; label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  positive: {
    border: 'border-emerald-500/25 bg-emerald-500/5',
    badge: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    label: 'Positivo',
    Icon: CheckCircle2,
  },
  warning: {
    border: 'border-amber-500/30 bg-amber-500/5',
    badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
    label: 'Atenção',
    Icon: AlertTriangle,
  },
  critical: {
    border: 'border-red-500/30 bg-red-500/5',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-300',
    label: 'Crítico',
    Icon: ShieldAlert,
  },
  info: {
    border: 'border-line bg-card',
    badge: 'bg-gold-soft text-gold-deep',
    label: 'Informativo',
    Icon: Info,
  },
};

export const AiIntelligencePanel: React.FC<AiIntelligencePanelProps> = ({ unitName }) => {
  const [data, setData] = useState<AiAnalystResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLoadDiagnosis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAiWeeklyDiagnosis();
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar diagnóstico inteligente.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <section
      aria-label="SMG Barber Intelligence — Diagnóstico Semanal"
      className="rounded-2xl border border-line bg-card p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-deep">
            <Sparkles className="h-3.5 w-3.5" />
            SMG Barber Intelligence • Fase 1
          </div>
          <h2 className="text-lg font-black text-ink">Diagnóstico Executivo Semanal</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Leitura determinística dos últimos 7 dias da {unitName} com cache diário (máx. 1 geração/dia).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data && (
            <span className="rounded-full border border-line bg-cream px-3 py-1 text-[11px] font-bold text-ink-soft">
              {data.coldStart
                ? 'Modo inicial (0 tokens)'
                : data.cached
                  ? 'Cache do dia (0 tokens)'
                  : 'Gerado agora'}
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleLoadDiagnosis()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-xs font-black text-night shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analisando...' : data ? 'Consultar cache do dia' : 'Gerar diagnóstico'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {data.cards.map((card, index) => {
            const style = CARD_STYLES[card.alertLevel] || CARD_STYLES.info;
            const Icon = style.Icon;
            return (
              <article
                key={`${card.title}-${index}`}
                className={`flex flex-col justify-between rounded-2xl border p-4 transition ${style.border}`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${style.badge}`}>
                      <Icon className="h-3 w-3" />
                      {style.label}
                    </span>
                    <span className="text-[10px] font-bold text-ink-soft">#{index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-black text-ink">{card.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-ink-soft">{card.diagnosis}</p>
                </div>

                <div className="mt-4 rounded-xl border border-line bg-cream/70 p-3">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gold-deep">
                    Ação recomendada
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ink">{card.recommendedAction}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
