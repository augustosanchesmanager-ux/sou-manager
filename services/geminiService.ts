import { getSharedClient } from './supabaseClient';

export interface BusinessMetrics {
  revenue?: number;
  growth?: number;
  avgTicket?: number;
  retentionRate?: number | string;
  noShowRate?: number;
  topService?: string;
}

/**
 * Invoca a Edge Function segura do backend (gemini-assistant) para gerar
 * conselho e insights estratégicos para o gestor.
 */
export const generateBusinessInsights = async (metrics: BusinessMetrics): Promise<string> => {
  try {
    const client = getSharedClient();
    const { data, error } = await client.functions.invoke('gemini-assistant', {
      body: { metrics, mode: 'insights' },
    });

    if (error) {
      console.warn('[Gemini Service] Falha ao obter insights da Edge Function:', error);
      if (error.status === 401) {
        return "Sessão não autenticada. Faça login para acessar os insights.";
      }
      if (error.status === 429) {
        return "Cota de uso temporariamente excedida. Tente novamente em alguns minutos.";
      }
      return "No momento não foi possível gerar insights. Tente novamente mais tarde.";
    }

    if (data?.text) {
      return data.text;
    }

    return "Insights indisponíveis no momento.";
  } catch (err: unknown) {
    console.error('[Gemini Service] Exceção ao invocar gemini-assistant:', err);
    return "No momento não foi possível gerar insights. Tente novamente mais tarde.";
  }
};

/**
 * Invoca a Edge Function segura do backend (gemini-assistant) para responder
 * dúvidas do usuário com base no contexto do app ativo (Barber / Estética).
 */
export const generateSupportResponse = async (userQuestion: string, appSlug?: string | null): Promise<string> => {
  if (!userQuestion || !userQuestion.trim()) {
    return "Por favor, digite sua dúvida.";
  }

  try {
    const client = getSharedClient();
    const { data, error } = await client.functions.invoke('gemini-assistant', {
      body: { userQuestion, appSlug },
    });

    if (error) {
      console.warn('[Gemini Service] Falha ao obter resposta do assistente:', error);
      if (error.status === 401) {
        return "Sua sessão expirou ou não está autenticada. Por favor, faça login novamente para consultar o assistente.";
      }
      if (error.status === 429) {
        return "O assistente está com alta demanda no momento. Aguarde alguns instantes e pergunte novamente.";
      }
      return "Assistente de IA temporariamente indisponível. Tente novamente em instantes.";
    }

    if (data?.text) {
      return data.text;
    }

    return "Não foi possível obter uma resposta do assistente no momento.";
  } catch (err: unknown) {
    console.error('[Gemini Service] Exceção na chamada do assistente:', err);
    return "Assistente de IA temporariamente indisponível.";
  }
};
