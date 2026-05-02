const QUICK_ANSWER_ENTRIES: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['cliente', 'cadastrar cliente', 'novo cliente'],
    response:
      'Vá em **Cadastros -> Clientes** e clique em **Novo Cliente**. Preencha nome, telefone e e-mail para salvar o cadastro.',
  },
  {
    keywords: ['caixa', 'fechar caixa', 'comanda', 'fechar comanda'],
    response:
      'Para finalizar uma venda, abra **Comandas** ou **Checkout**, confirme os itens e conclua o pagamento. O lançamento entra no financeiro automaticamente.',
  },
  {
    keywords: ['agendar', 'agenda', 'horário', 'horario'],
    response:
      'Abra **Agenda**, escolha um horário livre e selecione cliente, profissional e serviço. Depois confirme para registrar o atendimento.',
  },
  {
    keywords: ['profissional', 'barbeiro', 'equipe'],
    response:
      'A gestão da equipe fica em **Equipe**. Lá você cadastra profissionais, ajusta papéis e acompanha o status de cada um.',
  },
  {
    keywords: ['relatório', 'relatorio', 'bi', 'insight'],
    response:
      'Os indicadores ficam em **Visão de Negócio** e **Relatórios**. O app já monta insights automáticos a partir dos dados operacionais, sem chave externa.',
  },
  {
    keywords: ['financeiro', 'despesa', 'receita'],
    response:
      'Use **Financeiro**, **Despesas** e **Recibos** para acompanhar entradas e saídas. O fechamento das vendas alimenta essas telas automaticamente.',
  },
  {
    keywords: ['suporte', 'ajuda', 'atendimento'],
    response:
      'Se a dúvida sair do fluxo operacional, siga por **Suporte** no menu lateral para abrir um chamado e registrar o contexto com o time.',
  },
];

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const generateSupportResponse = async (userQuestion: string): Promise<string> => {
  const normalizedQuestion = normalizeText(userQuestion);

  const directMatch = QUICK_ANSWER_ENTRIES.find((entry) =>
    entry.keywords.some((keyword) => normalizedQuestion.includes(normalizeText(keyword))),
  );

  if (directMatch) {
    return directMatch.response;
  }

  return 'Posso ajudar com **clientes**, **agenda**, **comandas**, **equipe**, **financeiro** e **relatórios**. Se preferir, abra **Suporte** no menu lateral para registrar a solicitação com mais contexto.';
};
