/**
 * businessErrorMessages.ts
 * Utilitário puro para tradução e padronização de mensagens de erro no SMG Barber (Fase 7.3).
 * Elimina vazamento de mensagens cruas de banco/PostgREST (ex: 23505, 23P01, P0001, 42501)
 * e fornece mensagens canônicas em português amigável para exibição em Toasts e alertas.
 */

export type ErrorContext = 'general' | 'appointment' | 'comanda' | 'checkout' | 'client' | 'club';

export interface FormattedErrorMessage {
  title: string;
  message: string;
  code?: string;
  isRecoverable: boolean;
}

/**
 * Dicionário canônico de códigos PostgREST / PostgreSQL e RPCs da SMG Platform.
 */
const CANONICAL_ERROR_MAP: Record<string, { message: string; title: string }> = {
  // PostgreSQL Constraints & Concurrency
  '23505': {
    title: 'Registro Duplicado',
    message: 'Já existe um registro com estes mesmos dados no sistema.',
  },
  '23503': {
    title: 'Dependência Ausente',
    message: 'Esta operação depende de um registro que não foi encontrado ou já foi removido.',
  },
  '23P01': {
    title: 'Conflito de Horário',
    message: 'Este horário já está ocupado por outro atendimento para este profissional.',
  },
  '42501': {
    title: 'Acesso Negado',
    message: 'Você não possui permissão para executar esta operação. Contate o administrador.',
  },
  '42703': {
    title: 'Falha de Sincronização',
    message: 'Houve uma falha na sincronização dos dados da página. Por favor, recarregue a tela.',
  },

  // SMG Custom RPC Business Errors
  P0001: {
    title: 'Créditos Insuficientes',
    message: 'O cliente não possui créditos disponíveis para este serviço no plano contratado.',
  },
  P0002: {
    title: 'Comanda Liquidada',
    message: 'Esta comanda já foi finalizada ou liquidada e não admite novas alterações.',
  },
  P0003: {
    title: 'Operação Concorrente',
    message: 'O agendamento está sendo atualizado por outro operador. Tente novamente em instantes.',
  },
  P0004: {
    title: 'Justificativa Obrigatória',
    message: 'É obrigatório informar uma justificativa válida para estornar este lançamento.',
  },

  // HTTP / Gateway Status Codes
  '400': {
    title: 'Dados Incompletos',
    message: 'Dados da requisição inválidos ou incompletos. Verifique os campos informados.',
  },
  '401': {
    title: 'Sessão Expirada',
    message: 'Sua sessão expirou. Por favor, faça login novamente para continuar.',
  },
  '403': {
    title: 'Permissão Insuficiente',
    message: 'Seu perfil de acesso não tem permissão para realizar esta ação.',
  },
  '404': {
    title: 'Não Encontrado',
    message: 'O registro solicitado não foi localizado no sistema.',
  },
  '409': {
    title: 'Conflito de Operação',
    message: 'A operação conflitou com o estado atual do registro. Atualize a página e tente novamente.',
  },
  '500': {
    title: 'Serviço Indisponível',
    message: 'Ocorreu um erro temporário no servidor. Nossa equipe já foi notificada.',
  },
};

/**
 * Traduz qualquer erro (objeto Error, resposta PostgREST ou string) para uma mensagem amigável em pt-BR.
 */
export function getFriendlyErrorMessage(
  rawError: unknown,
  context: ErrorContext = 'general'
): FormattedErrorMessage {
  if (!rawError) {
    return {
      title: 'Erro Inesperado',
      message: 'Ocorreu um erro durante a operação. Tente novamente.',
      isRecoverable: true,
    };
  }

  // Extrai código e mensagem bruta
  let code = '';
  let rawMessage = '';

  if (typeof rawError === 'string') {
    rawMessage = rawError;
  } else if (typeof rawError === 'object' && rawError !== null) {
    const errObj = rawError as Record<string, unknown>;
    code = String(errObj.code || errObj.status || '');
    rawMessage = String(errObj.message || errObj.error_description || errObj.details || '');
  }

  // 1. Verificação por código PostgREST/PostgreSQL canônico
  if (code && CANONICAL_ERROR_MAP[code]) {
    if (code === '23505' && context === 'client') {
      return {
        title: 'Cliente Já Cadastrado',
        message: 'Já existe um cliente cadastrado com este telefone ou documento.',
        code: '23505',
        isRecoverable: true,
      };
    }

    const canonical = CANONICAL_ERROR_MAP[code];
    return {
      title: canonical.title,
      message: canonical.message,
      code,
      isRecoverable: code !== '42501' && code !== '401',
    };
  }

  // 2. Verificação de padrões conhecidos na mensagem de texto
  const lowerMsg = rawMessage.toLowerCase();

  // Conflito de agendamento na agenda
  if (lowerMsg.includes('overlap') || lowerMsg.includes('exclusion_violation') || lowerMsg.includes('23p01')) {
    return {
      title: 'Conflito de Horário',
      message: 'Este horário já está ocupado por outro atendimento para este profissional.',
      code: '23P01',
      isRecoverable: true,
    };
  }

  // Chave duplicada (ex: CPF, telefone, slug)
  if (lowerMsg.includes('unique constraint') || lowerMsg.includes('duplicate key') || lowerMsg.includes('23505')) {
    if (context === 'client') {
      return {
        title: 'Cliente Já Cadastrado',
        message: 'Já existe um cliente cadastrado com este telefone ou documento.',
        code: '23505',
        isRecoverable: true,
      };
    }
    return {
      title: 'Registro Duplicado',
      message: 'Já existe um registro com estes mesmos dados no sistema.',
      code: '23505',
      isRecoverable: true,
    };
  }

  // Permissão / RLS
  if (lowerMsg.includes('permission denied') || lowerMsg.includes('insufficient_privilege') || lowerMsg.includes('42501')) {
    return {
      title: 'Acesso Negado',
      message: 'Você não possui permissão para executar esta operação.',
      code: '42501',
      isRecoverable: false,
    };
  }

  // Comanda liquidada
  if (lowerMsg.includes('já foi finalizada') || lowerMsg.includes('comanda liquidada') || lowerMsg.includes('p0002')) {
    return {
      title: 'Comanda Liquidada',
      message: 'Esta comanda já foi finalizada ou liquidada e não admite novas alterações.',
      code: 'P0002',
      isRecoverable: false,
    };
  }

  // Falha de rede / offline
  if (lowerMsg.includes('failed to fetch') || lowerMsg.includes('networkerror') || lowerMsg.includes('sem conexao')) {
    return {
      title: 'Sem Conexão',
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet.',
      code: 'NETWORK',
      isRecoverable: true,
    };
  }

  // 3. Fallback seguro e amigável (sem vazar SQL ou identificadores de tabelas)
  return {
    title: 'Atenção',
    message: rawMessage.length > 0 && rawMessage.length < 120 && !rawMessage.includes('SELECT') && !rawMessage.includes('INSERT')
      ? rawMessage
      : 'Não foi possível concluir a operação. Por favor, tente novamente.',
    code: code || undefined,
    isRecoverable: true,
  };
}
