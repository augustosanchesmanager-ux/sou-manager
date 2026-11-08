/**
 * [SMG][DOMAIN][CHEF_CLUB] clientCreditCheck
 *
 * Verificação de elegibilidade de créditos e liquidação automática de comandas
 * para membros ativos do Club dos Chefes (Eixo C do Plano de Crescimento).
 */

import { getClientForTable } from '../../services/supabaseClient';
import { closeZeroAmountComanda, type ZeroCloseResult } from '../../src/lib/finance/zeroClose';
import { normalizeCreditBalances, type ServiceBalanceEntry } from './credits';

export interface ComandaItemCheckInput {
  id?: string;
  service_id?: string | null;
  product_id?: string | null;
  quantity?: number;
  name?: string | null;
  unit_price?: number;
}

export interface ClientCreditEligibility {
  isClubMember: boolean;
  subscriptionId: string | null;
  planName: string | null;
  totalAvailableCredits: number;
  totalUsedCredits: number;
  isFullyCoveredByCredits: boolean;
  hasServicesToCover: boolean;
  serviceBalances: ServiceBalanceEntry[];
  reason?: string;
}

/**
 * Consulta a elegibilidade do cliente no Clube dos Chefes e verifica
 * se os itens da comanda podem ser 100% cobertos pelos créditos do plano.
 */
export const checkClientCreditEligibility = async (
  tenantId: string,
  clientId: string,
  comandaItems: ComandaItemCheckInput[] = [],
): Promise<ClientCreditEligibility> => {
  const fallback: ClientCreditEligibility = {
    isClubMember: false,
    subscriptionId: null,
    planName: null,
    totalAvailableCredits: 0,
    totalUsedCredits: 0,
    isFullyCoveredByCredits: false,
    hasServicesToCover: false,
    serviceBalances: [],
  };

  if (!tenantId || !clientId) {
    return fallback;
  }

  try {
    const client = getClientForTable('customer_subscriptions');

    // 1. Buscar assinatura ativa do cliente
    const { data: subData, error: subError } = await client
      .from('customer_subscriptions')
      .select('id, plan_id, status, plan:customer_plans(name)')
      .eq('tenant_id', tenantId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !subData) {
      return fallback;
    }

    const subscriptionId = subData.id;
    const planName = (subData as any)?.plan?.name || 'Clube dos Chefes';

    // 2. Buscar registro de créditos da assinatura
    const creditsClient = getClientForTable('customer_credits');
    const { data: creditData, error: creditError } = await creditsClient
      .from('customer_credits')
      .select('available_credits, used_credits, service_balance_map')
      .eq('tenant_id', tenantId)
      .eq('subscription_id', subscriptionId)
      .maybeSingle();

    if (creditError || !creditData) {
      return {
        ...fallback,
        isClubMember: true,
        subscriptionId,
        planName,
      };
    }

    const totalAvailable = Number(creditData.available_credits) || 0;
    const totalUsed = Number(creditData.used_credits) || 0;
    const serviceBalances = normalizeCreditBalances(creditData.service_balance_map);

    // 3. Avaliar itens da comanda
    const servicesInComanda = comandaItems.filter((item) => Boolean(item.service_id));
    const productsInComanda = comandaItems.filter((item) => Boolean(item.product_id));

    const hasServicesToCover = servicesInComanda.length > 0;
    // Se a comanda tiver produtos físicos, não pode ser 100% coberta com créditos de serviço do clube
    const hasProducts = productsInComanda.length > 0;

    let isFullyCovered = false;
    let reason: string | undefined;

    if (hasProducts) {
      reason = 'Comanda possui produtos físicos que não são cobertos por créditos de assinatura.';
    } else if (!hasServicesToCover) {
      reason = 'Nenhum serviço identificado para consumo de créditos.';
    } else if (totalAvailable <= 0) {
      reason = 'Assinante sem créditos disponíveis no momento.';
    } else {
      const totalServicesQuantity = servicesInComanda.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0,
      );

      // Se há créditos gerais suficientes
      if (totalAvailable < totalServicesQuantity) {
        reason = `Saldo insuficiente (${totalAvailable} crédito(s) para ${totalServicesQuantity} serviço(s)).`;
      } else if (serviceBalances.length > 0) {
        const allServicesAvailable = servicesInComanda.every((item) => {
          const entry = serviceBalances.find((s) => s.service_id === item.service_id);
          return entry ? entry.available >= (item.quantity || 1) : false;
        });
        if (allServicesAvailable) {
          isFullyCovered = true;
        } else {
          reason = 'O saldo do plano não cobre todos os serviços específicos da comanda.';
        }
      } else {
        isFullyCovered = true;
      }
    }

    return {
      isClubMember: true,
      subscriptionId,
      planName,
      totalAvailableCredits: totalAvailable,
      totalUsedCredits: totalUsed,
      isFullyCoveredByCredits: isFullyCovered,
      hasServicesToCover,
      serviceBalances,
      reason,
    };
  } catch (err) {
    console.warn('[SMG_CHEF_CLUB] Erro ao consultar créditos do cliente:', err);
    return fallback;
  }
};

/**
 * Liquida a comanda com créditos do Clube dos Chefes sem fricção.
 */
export const settleComandaWithClubCredits = async (
  supabaseClient: any,
  tenantId: string,
  comandaId: string,
  userId?: string | null,
): Promise<ZeroCloseResult> => {
  return closeZeroAmountComanda({
    supabase: supabaseClient,
    tenantId,
    comandaId,
    origin: 'club_credit',
    source: 'checkout',
    authorizedBy: userId,
    userId,
    reason: 'Liquidação automática via créditos do Club dos Chefes',
  });
};
