/**
 * comandaQuickActions.ts
 * Utilitário puro de lógica para abertura rápida de comandas,
 * detecção de concorrência, ranking de itens frequentes e cálculo de comissões.
 */

export interface QuickComandaSummary {
  id: string;
  client_id?: string | null;
  client_name?: string | null;
  status: string;
  created_at: string;
  total?: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
  type: 'service' | 'product';
  category?: string;
  duration?: number;
}

export interface HistoricalItemUsage {
  id?: string;
  service_id?: string | null;
  product_id?: string | null;
  product_name?: string;
  quantity?: number;
}

export interface ResolvedItemCommission {
  staffId: string | null;
  isHouseDirect: boolean;
  role: 'primary' | 'house';
  label: string;
}

/**
 * 1. Detecta se existe alguma comanda com status 'open' para o cliente selecionado hoje.
 * Ignora se customerId for nulo/vazio (ex: Consumidor Final / Balcão avulso).
 */
export function findActiveOpenComanda(
  comandas: QuickComandaSummary[],
  customerId: string | null | undefined,
  referenceDate: Date = new Date()
): QuickComandaSummary | null {
  if (!customerId || !customerId.trim()) {
    return null;
  }

  const todayStr = referenceDate.toISOString().split('T')[0];

  const found = comandas.find((c) => {
    if (c.status !== 'open') return false;
    if (c.client_id !== customerId) return false;

    // Checa se foi aberta no mesmo dia (hoje)
    if (c.created_at) {
      const comandaDate = c.created_at.split('T')[0];
      return comandaDate === todayStr;
    }
    return true;
  });

  return found || null;
}

/**
 * 2. Extrai os Top N itens frequentes (serviços ou produtos) a partir do histórico de uso,
 * mapeando contra o catálogo atual de itens ativos.
 */
export function getTopFrequentItems(
  itemsHistory: HistoricalItemUsage[],
  catalogItems: CatalogItem[],
  limit: number = 4
): CatalogItem[] {
  if (!itemsHistory || itemsHistory.length === 0 || !catalogItems || catalogItems.length === 0) {
    // Fallback: se não houver histórico, retorna os primeiros N do catálogo
    return catalogItems.slice(0, limit);
  }

  // Mapa de contagem de frequência por item ID
  const counts: Record<string, number> = {};

  for (const item of itemsHistory) {
    const itemId = item.service_id || item.product_id;
    if (itemId) {
      counts[itemId] = (counts[itemId] || 0) + (item.quantity || 1);
    } else if (item.product_name) {
      // Fallback por nome caso id de item não esteja preenchido
      const matched = catalogItems.find((c) => c.name.toLowerCase() === item.product_name?.toLowerCase());
      if (matched) {
        counts[matched.id] = (counts[matched.id] || 0) + (item.quantity || 1);
      }
    }
  }

  // Ordena os itens do catálogo com base na frequência
  const sorted = [...catalogItems].sort((a, b) => {
    const countA = counts[a.id] || 0;
    const countB = counts[b.id] || 0;
    if (countB !== countA) {
      return countB - countA;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.slice(0, limit);
}

/**
 * 3. Resolve a atribuição de comissão para o item na comanda.
 * Se houver um barbeiro/profissional selecionado, atribui como 'primary'.
 * Se for 'house' ou vazio, atribui como 'Venda Direta / Balcão' (sem comissionamento individual).
 */
export function resolveItemCommission(
  _item: CatalogItem,
  selectedProfessionalId: string | null | undefined,
  professionalName?: string
): ResolvedItemCommission {
  if (!selectedProfessionalId || selectedProfessionalId === 'house' || selectedProfessionalId === 'none') {
    return {
      staffId: null,
      isHouseDirect: true,
      role: 'house',
      label: 'Venda Direta / Balcão',
    };
  }

  return {
    staffId: selectedProfessionalId,
    isHouseDirect: false,
    role: 'primary',
    label: professionalName || 'Profissional Designado',
  };
}
