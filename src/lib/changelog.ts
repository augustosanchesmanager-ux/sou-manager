/**
 * [SMG][LIB] changelog — fonte única da versão do app e das novidades
 *
 * Usado por Layout (auto-open no login) e Sidebar (gatilho manual no rodapé).
 * Persistência em localStorage (mesmo padrão do tema): chave única por
 * navegador, última versão visualizada. Sem backend nesta frente.
 */

export const CHANGELOG_VERSION = '1.7.1';
export const CHANGELOG_STORAGE_KEY = 'smg_last_seen_changelog';

export interface ChangelogItem {
  title: string;
  description: string;
}

/** Itens reais da versão, derivados do histórico do repositório. Badge usa o length. */
export const CHANGELOG_ITEMS: ChangelogItem[] = [
  {
    title: 'Identidade visual renovada',
    description:
      'Nova paleta cream + gold em todo o aplicativo, com o modo claro como padrão.',
  },
  {
    title: 'Tema escuro corrigido',
    description:
      'Superfícies escuras quentes e legibilidade restaurada em todas as telas.',
  },
  {
    title: 'Navegação redesenhada',
    description:
      'Sidebar e barra inferior mobile agrupadas pela rotina de trabalho da barbearia.',
  },
  {
    title: 'Segurança reforçada',
    description:
      'Duas ondas de hardening em RPC, permissões e índices do banco de dados.',
  },
  {
    title: 'Fechamento de caixa em base de caixa',
    description:
      'Faturamento reconhecido na data de pagamento da comanda (ADR-018).',
  },
  {
    title: 'Motor de repasse e adiantamentos',
    description:
      'Folha com estados, idempotência e histórico de adiantamentos (ADR-030).',
  },
  {
    title: 'Indicadores unificados',
    description:
      'MetricCard padrão com tons semânticos em todas as métricas (ADR-031).',
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
