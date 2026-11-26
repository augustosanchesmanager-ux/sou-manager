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

export type StrategyCopilotAction = 'campaign' | 'paid_traffic' | 'goals' | 'free_chat';

export interface StrategyCopilotStep {
  step: string;
  detail: string;
}

export interface StrategyCopilotPlan {
  headline: string;
  summary: string;
  steps: StrategyCopilotStep[];
  readyMessage: string;
  kpiToTrack: string;
}

export interface StrategyCopilotResponse {
  generatedAt: string;
  actionType: StrategyCopilotAction;
  remainingToday: number;
  plan: StrategyCopilotPlan;
}

export interface StrategyCopilotHistoryTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface StrategyCopilotBiContext {
  revenue?: number;
  avgTicket?: number;
  profitMargin?: number;
  inactiveClients60Days?: number;
  retentionRate?: number;
  topServices?: { name: string; count: number; revenue: number }[];
  staffCount?: number;
}

const VALID_ALERT_LEVELS = new Set<AiAlertLevel>(['info', 'warning', 'critical', 'positive']);
const VALID_ACTIONS = new Set<StrategyCopilotAction>(['campaign', 'paid_traffic', 'goals', 'free_chat']);

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

export function normalizeStrategyCopilotResponse(payload: unknown): StrategyCopilotResponse {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida do Copiloto Estratégico.');
  }

  const raw = payload as Record<string, unknown>;
  const rawPlan = raw.plan && typeof raw.plan === 'object' ? (raw.plan as Record<string, unknown>) : null;
  if (!rawPlan) {
    throw new Error('Plano estratégico ausente na resposta do Copiloto IA.');
  }

  const headline = String(rawPlan.headline || '').trim();
  const summary = String(rawPlan.summary || '').trim();
  const rawSteps: unknown[] = Array.isArray(rawPlan.steps) ? rawPlan.steps : [];
  const steps: StrategyCopilotStep[] = rawSteps
    .filter((s): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
    .slice(0, 6)
    .map((s) => ({
      step: String(s.step || '').trim(),
      detail: String(s.detail || '').trim(),
    }))
    .filter((s) => s.step.length > 0 && s.detail.length > 0);

  if (!headline || steps.length === 0) {
    throw new Error('O Copiloto IA retornou um plano incompleto.');
  }

  const rawAction = String(raw.actionType || 'free_chat') as StrategyCopilotAction;
  const actionType = VALID_ACTIONS.has(rawAction) ? rawAction : 'free_chat';
  const remainingToday = Math.max(0, Number(raw.remainingToday ?? 0) || 0);

  return {
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : new Date().toISOString(),
    actionType,
    remainingToday,
    plan: {
      headline,
      summary,
      steps,
      readyMessage: String(rawPlan.readyMessage || '').trim(),
      kpiToTrack: String(rawPlan.kpiToTrack || '').trim(),
    },
  };
}

export async function fetchAiWeeklyDiagnosis(): Promise<AiAnalystResponse> {
  const client = getSharedClient();
  const { data, error } = await client.functions.invoke('ai-analyst', {
    method: 'POST',
    body: { mode: 'daily_diagnosis' },
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível gerar o diagnóstico inteligente agora.');
  }

  return normalizeAiAnalystResponse(data);
}

export async function invokeAiStrategyCopilot(params: {
  actionType: StrategyCopilotAction;
  prompt?: string;
  history?: StrategyCopilotHistoryTurn[];
  biContext?: StrategyCopilotBiContext;
}): Promise<StrategyCopilotResponse> {
  const client = getSharedClient();
  const { data, error } = await client.functions.invoke('ai-analyst', {
    method: 'POST',
    body: {
      mode: 'strategy_copilot',
      actionType: params.actionType,
      prompt: params.prompt?.trim() || '',
      history: (params.history || []).slice(-6),
      biContext: params.biContext,
    },
  });

  if (error) {
    throw new Error(error.message || 'Não foi possível consultar o Copiloto Estratégico agora.');
  }

  return normalizeStrategyCopilotResponse(data);
}
