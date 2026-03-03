import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = (import.meta.env.VITE_GEMINI_API_KEY || '').trim();

const genAI = apiKey && apiKey !== 'PLACEHOLDER_API_KEY' && apiKey.startsWith('AIza')
  ? new GoogleGenerativeAI(apiKey)
  : null;

export const generateBusinessInsights = async (metrics: any): Promise<string> => {
  if (!genAI) {
    if (!apiKey) return "Configuração pendente: A chave VITE_GEMINI_API_KEY não foi encontrada.";
    if (!apiKey.startsWith('AIza')) return "Chave Inválida: Verifique sua chave no arquivo .env.local.";
    return "Configuração da IA pendente.";
  }

  // Lista expandida com prefixos e variantes estáveis
  const modelNames = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-pro-latest",
    "gemini-2.0-flash-exp",
    "gemini-pro",
    "gemini-1.0-pro"
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
      console.log(`Tentando modelo: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);

      // Se chegamos aqui, o modelo existe e respondeu
      const text = result.response.text();
      if (text) return text;

    } catch (error: any) {
      console.warn(`Falha na tentativa com ${modelName}:`, error.message);

      // Se for erro de autenticação/permissão, não adianta tentar outros
      if (error.message?.includes('403') || error.message?.includes('API_KEY_INVALID')) {
        return "Erro de Permissão: Sua chave de API não tem acesso ao Gemini. Verifique se ativou a 'Generative Language API' no Google Cloud Console.";
      }

      // Se for erro de cota
      if (error.message?.includes('429')) {
        return "Cota excedida ou muitas requisições. Tente novamente em 60 segundos.";
      }

      // Se não for 404, reporta como erro técnico se for o último
      if (!error.message?.includes('404') && modelName === modelNames[modelNames.length - 1]) {
        return `Erro Técnico: ${error.message}`;
      }

      // Se for 404, apenas continua para o próximo
    }
  }

  return "Não foi possível encontrar um modelo de IA ativo para sua chave (Erro 404). Isso normalmente significa que a 'Generative Language API' não foi ativada para o projeto desta chave no Google Cloud Console.";
};

export const generateSupportResponse = async (userQuestion: string): Promise<string> => {
  if (!genAI) {
    return "Desculpe, o sistema de IA do assistente não está disponível ou configurado corretamente. Verifique sua chave API.";
  }

  // Knowledge base baseada na documentação FUNCIONALIDADES.md e ARQUITETURA.md
  // Adicionei detalhes comuns de navegação e uso
  const knowledgeBase = `
    SOU MANA.GER - Sistema de Gestão para Barbearias e Centros de Estética:
    
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
    Atue como o Assistente Virtual SOU MANA.GER.
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
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text) return text;
    } catch (e: any) {
      console.warn(`Assistant failed with ${modelName}:`, e.message);
      // Fallback para o próximo modelo se este (404) falhar
    }
  }

  return "🤖 No momento não consegui processar sua dúvida. Por favor, tente novamente ou fale com nosso suporte no menu lateral.";
};