/**
 * [SMG][UTILS][CLIENT_FAMILY_SEARCH]
 *
 * Busca unificada e enriquecimento de contexto familiar (Responsável <-> Filhos/Dependentes).
 * Funções puras reutilizadas na Agenda, Encaixe Rápido, Lista de Clientes e Ficha 360.
 */

export interface SearchableFamilyClient {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  parent_client_id?: string | null;
  is_shared_phone?: boolean | null;
}

export type FamilyEnrichedClient<T extends SearchableFamilyClient = SearchableFamilyClient> = T & {
  parentName: string | null;
  effectivePhone: string;
  dependentsCount: number;
  isDependent: boolean;
  matchedViaParent: boolean;
};

export interface FamilySearchOptions {
  limit?: number;
  includeAllOnEmpty?: boolean;
}

export function normalizeSearchText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function enrichClientsWithFamilyContext<T extends SearchableFamilyClient>(
  clients: readonly T[],
): FamilyEnrichedClient<T>[] {
  const clientById = new Map<string, T>();
  const dependentsCountMap = new Map<string, number>();

  for (const client of clients) {
    clientById.set(client.id, client);
    if (client.parent_client_id) {
      dependentsCountMap.set(
        client.parent_client_id,
        (dependentsCountMap.get(client.parent_client_id) || 0) + 1,
      );
    }
  }

  return clients.map((client) => {
    const parent = client.parent_client_id ? clientById.get(client.parent_client_id) : undefined;
    const ownPhone = (client.phone || '').trim();
    const parentPhone = (parent?.phone || '').trim();

    return {
      ...client,
      parentName: parent?.name || null,
      effectivePhone: ownPhone || parentPhone,
      dependentsCount: dependentsCountMap.get(client.id) || 0,
      isDependent: Boolean(client.parent_client_id),
      matchedViaParent: false,
    };
  });
}

function matchesClientDirectly<T extends SearchableFamilyClient>(
  client: FamilyEnrichedClient<T>,
  normTerm: string,
  rawTerm: string,
  digitTerm: string,
): boolean {
  if (normalizeSearchText(client.name).includes(normTerm)) {
    return true;
  }

  if (client.email && client.email.toLowerCase().includes(rawTerm)) {
    return true;
  }

  if (client.effectivePhone && client.effectivePhone.toLowerCase().includes(rawTerm)) {
    return true;
  }

  if (digitTerm.length >= 3) {
    const clientDigits = client.effectivePhone.replace(/\D/g, '');
    if (clientDigits.includes(digitTerm)) {
      return true;
    }
  }

  return false;
}

/**
 * Busca clientes titulares e dependentes:
 * - Buscar pelo nome ou telefone do responsável retorna o responsável seguido imediatamente de seus filhos.
 * - Buscar pelo nome do filho retorna o filho com `parentName` preenchido (permitindo distinguir homônimos).
 */
export function searchClientsWithDependents<T extends SearchableFamilyClient>(
  clients: readonly T[],
  query: string,
  options?: FamilySearchOptions,
): FamilyEnrichedClient<T>[] {
  const enriched = enrichClientsWithFamilyContext(clients);
  const rawTerm = (query || '').trim().toLowerCase();
  const normTerm = normalizeSearchText(query);
  const digitTerm = (query || '').replace(/\D/g, '');

  if (!normTerm && !digitTerm) {
    if (!options?.includeAllOnEmpty) {
      return [];
    }
    return typeof options.limit === 'number' ? enriched.slice(0, options.limit) : enriched;
  }

  const dependentsByParentId = new Map<string, FamilyEnrichedClient<T>[]>();
  for (const item of enriched) {
    if (item.parent_client_id) {
      const group = dependentsByParentId.get(item.parent_client_id) || [];
      group.push(item);
      dependentsByParentId.set(item.parent_client_id, group);
    }
  }

  const results: FamilyEnrichedClient<T>[] = [];
  const seenIds = new Set<string>();

  const pushUnique = (item: FamilyEnrichedClient<T>) => {
    if (seenIds.has(item.id)) return;
    seenIds.add(item.id);
    results.push(item);
  };

  // 1) Titulares que batem diretamente + seus dependentes vinculados logo abaixo
  for (const item of enriched) {
    if (item.isDependent) continue;
    const isDirectMatch = matchesClientDirectly(item, normTerm, rawTerm, digitTerm);
    if (!isDirectMatch) continue;

    pushUnique(item);

    const children = dependentsByParentId.get(item.id) || [];
    for (const child of children) {
      const childDirect = matchesClientDirectly(child, normTerm, rawTerm, digitTerm);
      pushUnique({
        ...child,
        matchedViaParent: !childDirect,
      });
    }
  }

  // 2) Dependentes que batem diretamente (pelo próprio nome/telefone) ou pelo nome do responsável
  for (const item of enriched) {
    if (!item.isDependent) continue;
    if (seenIds.has(item.id)) continue;

    const isDirectMatch = matchesClientDirectly(item, normTerm, rawTerm, digitTerm);
    const isParentNameMatch = Boolean(
      item.parentName && normalizeSearchText(item.parentName).includes(normTerm),
    );

    if (isDirectMatch || isParentNameMatch) {
      pushUnique({
        ...item,
        matchedViaParent: !isDirectMatch && isParentNameMatch,
      });
    }
  }

  if (typeof options?.limit === 'number' && options.limit > 0) {
    return results.slice(0, options.limit);
  }

  return results;
}

/**
 * Filtra clientes existentes que podem ser vinculados como dependentes de `parentClientId`
 * respeitando a regra de no máximo 1 nível de hierarquia.
 */
export function getEligibleDependentCandidates<T extends SearchableFamilyClient>(
  clients: readonly T[],
  parentClientId: string,
  query = '',
  limit = 8,
): FamilyEnrichedClient<T>[] {
  const enriched = enrichClientsWithFamilyContext(clients);
  const parent = enriched.find((c) => c.id === parentClientId);
  if (!parent || parent.isDependent) {
    return [];
  }

  const normTerm = normalizeSearchText(query);
  const rawTerm = query.trim().toLowerCase();
  const digitTerm = query.replace(/\D/g, '');

  const eligible = enriched.filter((candidate) => {
    if (candidate.id === parentClientId) return false;
    if (candidate.isDependent) return false;
    if (candidate.dependentsCount > 0) return false;

    if (!normTerm && !digitTerm) return true;
    return matchesClientDirectly(candidate, normTerm, rawTerm, digitTerm);
  });

  return limit > 0 ? eligible.slice(0, limit) : eligible;
}
