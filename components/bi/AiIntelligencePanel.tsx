import React, { useCallback, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Info,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  fetchAiWeeklyDiagnosis,
  invokeAiStrategyCopilot,
  type AiAlertLevel,
  type AiAnalystResponse,
  type StrategyCopilotAction,
  type StrategyCopilotBiContext,
  type StrategyCopilotHistoryTurn,
  type StrategyCopilotResponse,
} from '../../src/modules/intelligence/aiAnalystService';

interface AiIntelligencePanelProps {
  unitName: string;
  biContext?: StrategyCopilotBiContext;
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
    badge: 'bg-gold-soft text-primary-dark dark:text-primary-light',
    label: 'Informativo',
    Icon: Info,
  },
};

const QUICK_ACTIONS: {
  id: Exclude<StrategyCopilotAction, 'free_chat'>;
  label: string;
  helper: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'campaign',
    label: 'Montar campanha',
    helper: 'WhatsApp, combos e retorno de inativos',
    Icon: Megaphone,
  },
  {
    id: 'paid_traffic',
    label: 'Criar plano de tráfego pago',
    helper: 'Anúncio local para horários ociosos',
    Icon: TrendingUp,
  },
  {
    id: 'goals',
    label: 'Ajustar metas',
    helper: 'Faturamento, ticket e metas da equipe',
    Icon: Target,
  },
];

interface CopilotConversationEntry {
  id: string;
  userLabel: string;
  response: StrategyCopilotResponse;
}

export const AiIntelligencePanel: React.FC<AiIntelligencePanelProps> = ({ unitName, biContext }) => {
  const [data, setData] = useState<AiAnalystResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fase 2 (ADR-057): Copiloto Estratégico Interativo
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<StrategyCopilotAction | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [entries, setEntries] = useState<CopilotConversationEntry[]>([]);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const runCopilot = useCallback(
    async (actionType: StrategyCopilotAction, customPrompt?: string) => {
      const trimmedPrompt = (customPrompt || '').trim();
      if (actionType === 'free_chat' && !trimmedPrompt) return;

      setCopilotLoading(true);
      setCopilotError(null);
      setActiveAction(actionType);

      const history: StrategyCopilotHistoryTurn[] = entries.slice(-3).flatMap((entry) => [
        { role: 'user' as const, content: entry.userLabel },
        {
          role: 'assistant' as const,
          content: `${entry.response.plan.headline}: ${entry.response.plan.summary}`,
        },
      ]);

      const actionLabel =
        actionType === 'free_chat'
          ? trimmedPrompt
          : QUICK_ACTIONS.find((a) => a.id === actionType)?.label || 'Estratégia';

      try {
        const response = await invokeAiStrategyCopilot({
          actionType,
          prompt: trimmedPrompt,
          history,
          biContext,
        });
        setRemainingToday(response.remainingToday);
        setEntries((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, userLabel: actionLabel, response },
        ]);
        if (actionType === 'free_chat') {
          setChatInput('');
        }
      } catch (err) {
        setCopilotError(
          err instanceof Error ? err.message : 'Não foi possível gerar a estratégia agora.'
        );
      } finally {
        setCopilotLoading(false);
        setActiveAction(null);
      }
    },
    [biContext, entries]
  );

  const handleCopyMessage = useCallback(async (entryId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(entryId);
      setTimeout(() => setCopiedId((curr) => (curr === entryId ? null : curr)), 2500);
    } catch {
      // Clipboard API indisponível em contextos sem permissão
    }
  }, []);

  const handleSubmitChat = (e: React.FormEvent) => {
    e.preventDefault();
    void runCopilot('free_chat', chatInput);
  };

  return (
    <section
      aria-label="SMG Barber Intelligence — Diagnóstico e Copiloto Estratégico"
      className="rounded-2xl border border-line bg-card p-6 shadow-sm space-y-6"
    >
      {/* Bloco 1: Diagnóstico Semanal Automático (Fase 1 — Cache Diário) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-full bg-gold-soft px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-dark dark:text-primary-light">
            <Sparkles className="h-3.5 w-3.5" />
            SMG Barber Intelligence • Copiloto Estratégico
          </div>
          <h2 className="text-lg font-black text-ink">Diagnóstico &amp; Copiloto de Decisão</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Leitura real dos dados da {unitName} combinada com ações práticas de automação, tráfego pago e metas.
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
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-night shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Analisando...' : data ? 'Consultar cache do dia' : 'Gerar diagnóstico'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
                  <p className="text-[10px] font-black uppercase tracking-wider text-primary-dark dark:text-primary">
                    Ação recomendada
                  </p>
                  <p className="mt-1 text-xs font-semibold text-ink">{card.recommendedAction}</p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Bloco 2: Copiloto Interativo — Botões de Ação + Chat Livre (Fase 2 / ADR-057) */}
      <div className="border-t border-line pt-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary-dark dark:text-primary" />
            <h3 className="text-sm font-bold text-ink">
              Desenvolver Estratégia com o Copiloto IA
            </h3>
          </div>
          {remainingToday !== null && (
            <span className="text-[11px] font-semibold text-ink-soft">
              Consultas restantes hoje: <strong className="text-ink">{remainingToday}</strong>
            </span>
          )}
        </div>

        {/* 3 Botões Rápidos de Ação */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ id, label, helper, Icon }) => {
            const isRunning = copilotLoading && activeAction === id;
            return (
              <button
                key={id}
                type="button"
                disabled={copilotLoading}
                onClick={() => void runCopilot(id)}
                className="text-left p-3.5 rounded-xl border border-line bg-cream hover:border-primary/60 hover:bg-gold-pale/50 dark:hover:bg-white/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-ink">
                  <Icon className={`h-4 w-4 text-primary-dark dark:text-primary ${isRunning ? 'animate-pulse' : ''}`} />
                  <span>{isRunning ? 'Montando plano...' : label}</span>
                </div>
                <p className="text-[11px] text-ink-soft mt-1">{helper}</p>
              </button>
            );
          })}
        </div>

        {/* Chat Livre Contextualizado */}
        <form onSubmit={handleSubmitChat} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={copilotLoading}
            placeholder="Pergunte ao Copiloto (ex.: Como encher a agenda de terça à tarde? Qual combo lançar?)..."
            className="flex-1 rounded-xl border border-line bg-cream px-4 py-2.5 text-xs text-ink placeholder:text-ink-soft focus:border-primary focus:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={copilotLoading || !chatInput.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-black text-night shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {copilotLoading && activeAction === 'free_chat' ? 'Pensando...' : 'Perguntar'}
          </button>
        </form>

        {copilotError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-700 dark:text-red-300">
            {copilotError}
          </div>
        )}

        {/* Planos / Respostas Geradas na Sessão */}
        {entries.length > 0 && (
          <div className="space-y-4">
            {entries
              .slice()
              .reverse()
              .map((entry) => {
                const { plan } = entry.response;
                return (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-line bg-cream p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-primary-dark dark:text-primary">
                        {entry.userLabel}
                      </span>
                      <span className="text-[10px] text-ink-soft">
                        Baseado nos dados reais da {unitName}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-black text-ink">{plan.headline}</h4>
                      <p className="mt-1 text-xs text-ink-soft leading-relaxed">{plan.summary}</p>
                    </div>

                    <ol className="space-y-2">
                      {plan.steps.map((st, idx) => (
                        <li
                          key={`${entry.id}-step-${idx}`}
                          className="flex items-start gap-2.5 text-xs bg-card border border-line rounded-lg p-2.5"
                        >
                          <span className="size-5 shrink-0 rounded-full bg-primary/15 text-primary-dark dark:text-primary font-black text-[10px] flex items-center justify-center mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-bold text-ink">{st.step}</p>
                            <p className="text-ink-soft mt-0.5">{st.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ol>

                    {plan.readyMessage && (
                      <div className="rounded-lg border border-primary/30 bg-gold-pale/60 dark:bg-primary/10 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary-dark dark:text-primary">
                            Mensagem / Roteiro Pronto para Uso
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(entry.id, plan.readyMessage)}
                            className="inline-flex items-center gap-1 rounded-md border border-line bg-card px-2 py-1 text-[10px] font-bold text-ink hover:border-primary/50"
                          >
                            {copiedId === entry.id ? (
                              <>
                                <Check className="h-3 w-3 text-success" />
                                Copiado
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                Copiar
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-ink whitespace-pre-line leading-relaxed">
                          {plan.readyMessage}
                        </p>
                      </div>
                    )}

                    {plan.kpiToTrack && (
                      <p className="text-[11px] text-ink-soft">
                        <strong className="text-ink">Como medir em 7 dias:</strong> {plan.kpiToTrack}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
};
