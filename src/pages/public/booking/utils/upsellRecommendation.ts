/**
 * Utilitário puro de heurística de recomendação para Upsell e Cross-Sell
 * no Agendamento Público Online (SMG Barber).
 *
 * Regras:
 * 1. Se o cliente selecionou apenas Cabelo/Corte, sugere Barba ou Sobrancelha/Acabamento.
 * 2. Se o cliente selecionou apenas Barba, sugere Corte/Cabelo ou Sobrancelha.
 * 3. Se o cliente já selecionou o combo completo (Cabelo + Barba), não insiste (retorna vazio).
 * 4. Não sugere itens já selecionados.
 * 5. Limita a 2 sugestões de maior compatibilidade/menor atrito.
 */

import type { PublicService } from '../hooks/types';

export type ServiceDomainType = 'hair' | 'beard' | 'finish' | 'other';

/**
 * Classifica o serviço por palavras-chave no nome, categoria ou descrição.
 */
export function classifyServiceDomain(service: PublicService): ServiceDomainType {
  const text = `${service.name} ${service.category || ''} ${service.description || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (
    text.includes('barba') ||
    text.includes('barboterapia') ||
    text.includes('bigode') ||
    text.includes('cavanhaque')
  ) {
    return 'beard';
  }

  if (
    text.includes('sobrancelha') ||
    text.includes('pezi') ||
    text.includes('pezinho') ||
    text.includes('acabamento') ||
    text.includes('limpeza de pele') ||
    text.includes('depilacao') ||
    text.includes('orelha') ||
    text.includes('nariz')
  ) {
    return 'finish';
  }

  if (
    text.includes('corte') ||
    text.includes('cabelo') ||
    text.includes('degrade') ||
    text.includes('fade') ||
    text.includes('social') ||
    text.includes('navalhado') ||
    text.includes('platinado') ||
    text.includes('luzes') ||
    text.includes('selagem') ||
    text.includes('progressiva') ||
    text.includes('hidratacao')
  ) {
    return 'hair';
  }

  return 'other';
}

/**
 * Retorna até 2 serviços recomendados para Upsell / Cross-Sell com base na seleção atual.
 */
export function getSuggestedUpsellServices(
  availableServices: PublicService[],
  selectedServiceIds: string[]
): PublicService[] {
  if (!availableServices || availableServices.length === 0 || selectedServiceIds.length === 0) {
    return [];
  }

  // Apenas serviços ativos e que ainda não foram selecionados
  const unselectedServices = availableServices.filter(
    (s) => s.active !== false && !selectedServiceIds.includes(s.id)
  );

  if (unselectedServices.length === 0) {
    return [];
  }

  const selectedServices = availableServices.filter((s) => selectedServiceIds.includes(s.id));
  const hasHair = selectedServices.some((s) => classifyServiceDomain(s) === 'hair');
  const hasBeard = selectedServices.some((s) => classifyServiceDomain(s) === 'beard');

  // Regra (e): se o cliente já marcou combo completo Cabelo + Barba, não insiste
  if (hasHair && hasBeard) {
    return [];
  }

  let primaryDomain: ServiceDomainType | null = null;
  let secondaryDomain: ServiceDomainType | null = null;

  if (hasHair && !hasBeard) {
    // Escolheu cabelo: sugere barba primeiro, acabamento/sobrancelha depois
    primaryDomain = 'beard';
    secondaryDomain = 'finish';
  } else if (hasBeard && !hasHair) {
    // Escolheu barba: sugere corte/cabelo primeiro, acabamento depois
    primaryDomain = 'hair';
    secondaryDomain = 'finish';
  } else {
    // Outros ou acabamento puro: sugere corte primeiro, barba depois
    primaryDomain = 'hair';
    secondaryDomain = 'beard';
  }

  const primaryMatches = unselectedServices.filter(
    (s) => classifyServiceDomain(s) === primaryDomain
  );
  const secondaryMatches = unselectedServices.filter(
    (s) => classifyServiceDomain(s) === secondaryDomain
  );

  // Ordenação preferencial por menor duração (menor atrito de agenda) e preço acessível
  const sortByFriction = (a: PublicService, b: PublicService) => {
    if (a.duration !== b.duration) {
      return a.duration - b.duration;
    }
    return a.price - b.price;
  };

  primaryMatches.sort(sortByFriction);
  secondaryMatches.sort(sortByFriction);

  const result: PublicService[] = [];

  // Pega o melhor do domínio primário
  if (primaryMatches.length > 0) {
    result.push(primaryMatches[0]);
  }

  // Pega o segundo item (outro do primário ou o melhor do secundário)
  if (primaryMatches.length > 1 && result.length < 2) {
    result.push(primaryMatches[1]);
  } else if (secondaryMatches.length > 0 && result.length < 2) {
    result.push(secondaryMatches[0]);
  }

  return result.slice(0, 2);
}

/**
 * Seleciona os serviços "Mais Pedidos / Populares" para exibição em destaque no topo da grade.
 * Heurística: Cabelo/Corte clássico, Barba clássica ou serviços com menor duração e maior procura.
 */
export function getPopularServices(
  availableServices: PublicService[],
  limit = 2
): PublicService[] {
  if (!availableServices || availableServices.length === 0) {
    return [];
  }

  const activeServices = availableServices.filter((s) => s.active !== false);

  // Prioriza itens clássicos de barbearia: Corte de Cabelo e Barba
  const popularKeywords = ['corte', 'cabelo', 'barba', 'degrade', 'barboterapia'];

  const scoreService = (s: PublicService): number => {
    const text = `${s.name} ${s.category || ''}`.toLowerCase();
    let score = 0;

    popularKeywords.forEach((kw, idx) => {
      if (text.includes(kw)) {
        score += 10 - idx;
      }
    });

    // Menor duração ganha leve preferência por facilidade de encaixe
    if (s.duration <= 45) {
      score += 2;
    }

    return score;
  };

  const sorted = [...activeServices].sort((a, b) => scoreService(b) - scoreService(a));
  return sorted.slice(0, limit);
}
