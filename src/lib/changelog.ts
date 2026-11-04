/**
 * [SMG][LIB] changelog — fonte única da versão do app e das novidades
 *
 * Usado por Layout (auto-open no login) e Sidebar (gatilho manual no rodapé).
 * Persistência em localStorage (mesmo padrão do tema): chave única por
 * navegador, última versão visualizada. Sem backend nesta frente.
 */

export const CHANGELOG_VERSION = '1.8.0';
export const CHANGELOG_STORAGE_KEY = 'smg_last_seen_changelog';

export interface ChangelogItem {
  title: string;
  description: string;
}

/** Itens reais da versão, derivados do histórico do repositório. Badge usa o length. */
export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    title: 'Cadeira Cativa & Agendamento Recorrente',
    description:
      'Projeção de sessões semanais e quinzenais com confirmação ágil via WhatsApp.',
  },
  {
    title: 'Checkout Expresso & Troco Inteligente',
    description:
      'Sugestão de cédulas em BRL, calculadora ágil de troco e bloqueio de valor insuficiente.',
  },
  {
    title: "Abertura Ágil de Comandas (Atalho 'N')",
    description:
      'Venda rápida de balcão para consumidor final e prevenção preventiva de comandas duplicadas.',
  },
  {
    title: 'Modo Barbeiro & Fila de Cadeira',
    description:
      'Visão móvel de 1 polegar com card Na Cadeira Agora e encaixe rápido walk-in.',
  },
  {
    title: 'Perfil 360° do Cliente & Combos',
    description:
      'Drawer com LTV, histórico de visitas e combos inteligentes de serviços com desconto.',
  },
  {
    title: 'Design System Atelier Tech Sofisticado',
    description:
      'Identidade visual refinada Dark-First com contraste WCAG AA e sem poluição de cores.',
  },
  {
    title: 'SMG Academy & Central de Ajuda',
    description:
      'Trilhas práticas de capacitação por papel e base de autoatendimento para suporte ágil.',
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
