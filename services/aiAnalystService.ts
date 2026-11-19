import { getSharedClient } from './supabaseClient';

export type AiAlertLevel = 'info' | 'warning' | 'critical' | 'positive';

export interface AiInsightCard {
  title: string;
  alertLevel: AiAlertLevel;
  diagnosis: string;
  recommendedAction: string;
}

export interface AiAnalystResponse {
  generatedAt: string;
  referenceDate: string;
  cached: boolean;
  coldStart: boolean;
  cards: AiInsightCard[];
}

const VALID_ALERT_LEVELS = new Set<AiAlertLevel>(['info', 'warning', 'critical', 'positive']);

const isValidInsightCard = (card: unknown): card is AiInsightCard => {
  if (!card || typeof card !== 'object') return false;
  const candidate = card as Record<string, unknown>;
  return (
    typeof candidate.title === 'string' &&
    candidate.title.trim().length > 0 &&
    typeof candidate.alertLevel === 'string' &&
    VALID_ALERT_LEVELS.has(candidate.alertLevel as AiAlertLevel) &&
    typeof candidate.diagnosis === 'string' &&
    candidate.diagnosis.trim().length > 0 &&
    typeof candidate.recommendedAction === 'string' &&
    candidate.recommendedAction.trim().length > 0
  );
};

/**
 * Invokes the dedicated `ai-analyst` Edge Function to fetch or generate
 * the daily 3-card strategic diagnosis for the authenticated tenant.
 */
export const fetchStrategicDiagnosis = async (): Promise<AiAnalystResponse> => {
  const client = getSharedClient();
  const { data, error } = await client.functions.invoke('ai-analyst', {
    body: {},
  });

  if (error) {
    const status = (error as { status?: number }).status;
    if (status === 401) {
      throw new Error('Sessão expirada. Faça login novamente para gerar o diagnóstico.');
    }
    if (status === 403) {
      throw new Error('Diagnóstico estratégico disponível apenas para proprietários e gerentes.');
    }
    if (status === 429) {
      throw new Error('Limite temporário da IA atingido. Tente novamente em alguns instantes.');
    }
    if (status === 503) {
      throw new Error('Serviço de IA indisponível no momento.');
    }
    throw new Error('Não foi possível carregar o diagnóstico inteligente.');
  }

  const payload = data as Partial<AiAnalystResponse> | null;
  if (!payload || !Array.isArray(payload.cards) || !payload.cards.every(isValidInsightCard)) {
    throw new Error('Resposta do diagnóstico inteligente em formato inválido.');
  }

  return {
    generatedAt: typeof payload.generatedAt === 'string' ? payload.generatedAt : new Date().toISOString(),
    referenceDate: typeof payload.referenceDate === 'string' ? payload.referenceDate : '',
    cached: Boolean(payload.cached),
    coldStart: Boolean(payload.coldStart),
    cards: payload.cards,
  };
};
