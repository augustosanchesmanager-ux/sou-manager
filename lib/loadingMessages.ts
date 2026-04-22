export const LOADING_MESSAGES = {
  AUTH: 'Verificando credenciais...',
  TENANT: 'Carregando dados da empresa...',
  SCHEDULE: 'Atualizando agenda...',
  FINANCIAL: 'Processando dados financeiros...',
  SAVE: 'Salvando alterações...',
  DELETE: 'Removendo registro...',
  FETCH: 'Buscando informações...',
  SYNC: 'Sincronizando dados...',
  PAYMENT: 'Processando pagamento...',
  CLIENTS: 'Carregando clientes...',
  SERVICES: 'Carregando serviços...',
  PRODUCTS: 'Carregando produtos...',
  REPORTS: 'Gerando relatório...',
  EXPORT: 'Exportando dados...',
  IMPORT: 'Importando dados...',
  SEND: 'Enviando informações...',
  CALCULATE: 'Calculando valores...',
  GENERATE: 'Gerando informações...',
  UPDATE: 'Atualizando informações...',
  CREATE: 'Criando registro...',
  PROCESS: 'Processando informações...',
} as const;

export type LoadingMessageKey = keyof typeof LOADING_MESSAGES;

export const getLoadingMessage = (key: LoadingMessageKey | string): string => {
  if (key in LOADING_MESSAGES) {
    return LOADING_MESSAGES[key as LoadingMessageKey];
  }
  return key;
};
