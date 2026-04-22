import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

const genAI = apiKey && apiKey !== 'PLACEHOLDER_API_KEY' && apiKey.startsWith('AIza')
  ? new GoogleGenerativeAI(apiKey)
  : null;

interface GeminiError {
  message: string;
  code?: string;
}

const isImageNotSupportedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const err = error as GeminiError;
  const msg = err.message || '';
  return msg.includes('image') || 
         msg.includes('png') || 
         msg.includes('not support') ||
         msg.includes('IMAGE_INPUT_NOT_SUPPORTED');
};

const generateContentSafe = async (model: any, prompt: string): Promise<string> => {
  try {
    const result = await model.generateContent(prompt);
    if (result?.response?.text) {
      return result.response.text();
    }
    throw new Error('Resposta vazia do modelo');
  } catch (error: any) {
    console.error('[Gemini] Erro na geração de conteúdo:', error?.message);
    
    if (isImageNotSupportedError(error)) {
      throw new Error('IMAGE_INPUT_NOT_SUPPORTED');
    }
    
    if (error?.message?.includes('403') || error?.message?.includes('API_KEY_INVALID')) {
      throw new Error('PERMISSION_DENIED');
    }
    
    if (error?.message?.includes('429')) {
      throw new Error('QUOTA_EXCEEDED');
    }
    
    throw error;
  }
};

export const generateBusinessInsights = async (metrics: any): Promise<string> => {
  if (!genAI) {
    if (!apiKey) return "Configuração pendente: A chave VITE_GEMINI_API_KEY não foi encontrada.";
    if (!apiKey.startsWith('AIza')) return "Chave Inválida: Verifique sua chave no arquivo .env.local.";
    return "Configuração da IA pendente.";
  }

  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.0-flash-exp",
    "gemini-pro",
  ];

  const m = {
    revenue: metrics.revenue || 0,
    growth: metrics.growth || 0,
    avgTicket: metrics.avgTicket || 0,
    retention: metrics.retentionRate || 'N/A',
    noShow: metrics.noShowRate || 0,
    top: metrics.topService || 'Geral',
  };

  const prompt = `Analise estes dados de barbearia (Faturamento R$ ${m.revenue}, Crescimento ${m.growth}%, Ticket R$ ${m.avgTicket}, Retenção ${m.retention}%, No-Show ${m.noShow}%, Top: ${m.top}) e dê um conselho estratégico curto em Português do Brasil.`;

  for (const modelName of modelNames) {
    try {
      console.log(`[Gemini] Tentando modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const text = await generateContentSafe(model, prompt);
      if (text) return text;
    } catch (error: any) {
      console.warn(`[Gemini] Falha com ${modelName}:`, error?.message);

      if (error.message === 'IMAGE_INPUT_NOT_SUPPORTED') {
        return "Funcionalidade de IA temporariamente indisponível. Nossa equipe já foi notificada.";
      }

      if (error.message === 'PERMISSION_DENIED') {
        return "Erro de Permissão: Sua chave de API não tem acesso ao Gemini. Verifique se a 'Generative Language API' está ativada.";
      }

      if (error.message === 'QUOTA_EXCEEDED') {
        return "Cota de uso excedida. Tente novamente em alguns minutos.";
      }

      if (modelName === modelNames[modelNames.length - 1]) {
        console.error('[Gemini] Todos os modelos falharam:', error);
        return "No momento não foi possível gerar insights. Tente novamente mais tarde.";
      }
    }
  }

  return "Não foi possível encontrar um modelo de IA ativo. Verifique se a 'Generative Language API' está ativada.";
};

export const generateSupportResponse = async (userQuestion: string): Promise<string> => {
  if (!genAI) {
    return "Desculpe, o sistema de IA do assistente não está disponível ou configurado corretamente. Verifique sua chave API.";
  }

  const knowledgeBase = `
    SMG | Sou.Manager | Barber - Sistema de Gestão para Barbearias e Centros de Estética:

    1. Cadastro de Clientes:
    - Vá em Operacional -> Cadastros -> Clientes.
    - Clique em + Novo Cliente para adicionar nome, telefone e e-mail.

    2. Agendamentos e Agenda:
    - Vá em Operacional -> Vendas -> Agendamentos.
    - Clique em qualquer horário vazio na grade para agendar.
    - Barbeiros só visualizam sua própria agenda para privacidade.

    3. Equipe, Profissionais e Comissões:
    - Vá em Operacional -> Cadastros -> Equipe / Profissionais.
    - Configure comissões manuais para cada profissional aqui.

    4. Checkout, PDV e Pagamentos:
    - O Checkout (venda rápida) está em Operacional -> Vendas -> Checkout.
    - Aceita Dinheiro, Cartão e PIX. O lucro e comissões são calculados na hora.
    - O fechamento de caixa fica em Gestão -> Operações do Dia.

    5. Folha de Pagamento e Recibos:
    - Vá em Gestão -> Folha de Pagamento para calcular salários e vales.
    - Após o pagamento, o sistema gera recibos digitais assináveis automaticamente.

    6. Relatórios e Business Intelligence (IA):
    - Relatórios financeiros detalhados em Gestão -> Relatórios.
    - Insights estratégicos feitos por mim (Gemini) em Gestão -> Visão de Negócio (BI).

    7. Inventário e Produtos:
    - Controle de estoque e avisos de reposição em Operacional -> Cadastros -> Produtos / Estoque.

    8. Níveis de Acesso:
    - Super Admin: Tudo liberado.
    - Gerente: Quase tudo, exceto logs de sistema críticos.
    - Barbeiro/Profissional: Apenas Agenda, Checkout e seus próprios resultados.
    - Recepcionista: Agenda, Cadastros e Checkout.
  `;

  const modelNames = ["gemini-1.5-flash", "gemini-pro"];
  const prompt = `
    Atue como o Assistente Virtual SMG | Sou.Manager | Barber.
    Use estritamente a base de conhecimento abaixo para responder à dúvida do usuário.
    Se a resposta não estiver na base, diga educadamente que não possuo essa informação e sugira entrar em contato com o suporte humano no menu lateral.

    Base de Conhecimento:
    ${knowledgeBase}

    Dúvida do Usuário: "${userQuestion}"

    Responda em Português do Brasil de forma clara, prestativa e curta (máximo 4 linhas).
    Sempre use negrito para nomes de menus, botões ou telas (ex: **Operacional -> Vendas**).
  `;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const text = await generateContentSafe(model, prompt);
      if (text) return text;
    } catch (e: any) {
      console.warn(`[Gemini] Assistant failed with ${modelName}:`, e?.message);

      if (e.message === 'IMAGE_INPUT_NOT_SUPPORTED') {
        return "Assistente temporariamente indisponível para análise de imagem.";
      }
    }
  }

  return "🤖 No momento não consegui processar sua dúvida. Por favor, tente novamente ou fale com nosso suporte no menu lateral.";
};