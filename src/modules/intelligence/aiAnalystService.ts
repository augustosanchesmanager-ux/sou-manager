import { getSharedClient } from '../../lib/supabase/client';

export type AiAlertLevel = 'info' | 'warning' | 'critical' | 'positive';

export interface AiInsightCard {
  title: string;
  alertLevel: AiAlertLevel;
  diagnosis: string;
  recommendedAction: string;
}

export interface AiAnalystResponse {
  generatedAt: string;
  cached: boolean;
  coldStart?: boolean;
  cards: AiInsightCard[];
}

const VALID_ALERT_LEVELS = new Set<AiAlertLevel>(['info', 'warning', 'critical', 'positive']);

export function normalizeAiAnalystResponse(payload: unknown): AiAnalystResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida do diagnóstico inteligente.');
  }

  const raw = payload as Record<string, unknown>;
  const rawCards: unknown[] = Array.isArray(raw.cards) ? raw.cards : [];

  const cards: AiInsightCard[] = rawCards
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .slice(0, 3)
    .map((item) => {
      const level = String(item.alertLevel || 'info') as AiAlertLevel;
      return {
        title: String(item.title || 'Diagnóstico semanal').trim(),
        alertLevel: VALID_ALERT_LEVELS.has(level) ? level : 'info',
        diagnosis: String(item.diagnosis || '').trim(),
        recommendedAction: String(item.recommendedAction || '').trim(),
      };
    })
    .filter((card) => card.diagnosis.length > 0);

  if (cards.length === 0) {
    throw new Error('Nenhum card de diagnóstico foi retornado.');
  }

  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    cached: Boolean(raw.cached),
    coldStart: Boolean(raw.coldStart),
    cards,
  };
}

export async function fetchAiWeeklyDiagnosis(): Promise<AiAnalystResponse> {
  const client = getSharedClient();
  const { data, error } = await client.functions.invoke('ai-analyst', {
    method: 'POST',
    body: {},
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível gerar o diagnóstico inteligente agora.');
  }

  return normalizeAiAnalystResponse(data);
}
