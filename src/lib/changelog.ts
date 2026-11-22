/**
 * [SMG][LIB] changelog — fonte única da versão do app e das novidades
 *
 * Usado por Layout (auto-open no login) e Sidebar (gatilho manual no rodapé).
 * Persistência em localStorage (mesmo padrão do tema): chave única por
 * navegador, última versão visualizada. Sem backend nesta frente.
 */

export const CHANGELOG_VERSION = '1.9.0';
export const CHANGELOG_STORAGE_KEY = 'smg_last_seen_changelog';

export interface ChangelogItem {
  title: string;
  description: string;
}

/** Itens reais da versão, derivados do histórico do repositório. Badge usa o length. */
export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    title: 'Dependentes Familiares & Agendamento em Família',
    description:
      'Vincule familiares ao cadastro do cliente, compartilhe créditos do Club dos Chefes e agende para dependentes direto no link público.',
  },
  {
    title: 'Metas de Produtos & Vendas por Barbeiro',
    description:
      'Acompanhe o desempenho de venda de produtos por profissional em Relatórios e defina faixas de metas flexíveis para a equipe.',
  },
  {
    title: 'Agendamento Online Mais Fluido',
    description:
      'Seleção de serviços ajustada para qualquer tela, consulta de horários livres no mesmo dia mais estável e janelas sem sobreposição.',
  },
  {
    title: 'Agenda com Precisão de Horários e Bloqueios',
    description:
      'Agendamentos cancelados ou de não comparecimento liberam o horário na hora, com suporte refinado a durações de 45 min e bloqueio personalizado.',
  },
  {
    title: 'Teste Grátis de 7 Dias no Plano Pro',
    description:
      'Novas barbearias já começam com acesso completo aos recursos Pro durante 7 dias para experimentar toda a operação sem compromisso.',
  },
  {
    title: 'Datas Consistentes e Menu Mais Limpo',
    description:
      'Filtros e exibições de datas alinhados ao horário local da barbearia, além de uma navegação mais direta no dia a dia.',
  },
  {
    title: 'Mais Segurança, Estabilidade e Desempenho',
    description:
      'Blindagem reforçada dos dados da sua barbearia e modernização completa do sistema, incluindo Totem e QR Code, para respostas mais rápidas.',
  },
];

/** true quando a versão atual ainda não foi vista neste navegador. */
export function hasUnseenChangelog(): boolean {
  try {
    return localStorage.getItem(CHANGELOG_STORAGE_KEY) !== CHANGELOG_VERSION;
  } catch {
    return true;
  }
}

/** Marca a versão atual como vista. Retorna false se o storage estiver indisponível. */
export function markChangelogSeen(): boolean {
  try {
    localStorage.setItem(CHANGELOG_STORAGE_KEY, CHANGELOG_VERSION);
    return true;
  } catch {
    return false;
  }
}
