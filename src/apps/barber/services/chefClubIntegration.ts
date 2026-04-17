import type {
  ChefClubAppliedBenefit,
  ChefClubBenefitBalance,
  ChefClubCheckoutSummary,
  ChefClubConsumptionRecord,
  ChefClubContext,
  ChefClubItemInput,
  ChefClubItemResult,
  ChefClubPlanBenefit,
} from '../contracts/chefClub';

const normalizeValue = (value: string | null | undefined) => value?.trim().toLowerCase() || '';

const normalizeList = (values?: string[] | null) =>
  (values || []).map((value) => normalizeValue(value)).filter(Boolean);

const isServiceLikeName = (name: string) => {
  const normalized = normalizeValue(name);
  return (
    normalized.includes('corte') ||
    normalized.includes('cabelo') ||
    normalized.includes('barba') ||
    normalized.includes('sobrancelha') ||
    normalized.includes('hidrata') ||
    normalized.includes('botox')
  );
};

export const getChefClubBenefitPriority = (benefit: ChefClubPlanBenefit) => {
  return Number.isFinite(benefit.priority) ? Number(benefit.priority) : 0;
};

export const isChefClubEligibleService = (
  item: ChefClubItemInput,
  benefit: ChefClubPlanBenefit,
) => {
  if (item.type !== 'service') {
    return { eligible: false, reason: 'Produtos de revenda nao consomem Clube do Chefe.' };
  }

  if (benefit.active === false) {
    return { eligible: false, reason: 'Beneficio inativo no plano.' };
  }

  const serviceId = normalizeValue(item.service_id);
  const serviceName = normalizeValue(item.name);
  const serviceCategory = normalizeValue(item.category);

  const eligibleIds = normalizeList(benefit.eligible_service_ids);
  if (serviceId && eligibleIds.includes(serviceId)) {
    return { eligible: true, reason: `Elegivel por servico vinculado ao beneficio ${benefit.benefit_label}.` };
  }

  const eligibleNames = normalizeList(benefit.eligible_service_names);
  if (serviceName && eligibleNames.includes(serviceName)) {
    return { eligible: true, reason: `Elegivel por nome de servico no beneficio ${benefit.benefit_label}.` };
  }

  const eligibleCategories = normalizeList(benefit.eligible_service_categories);
  if (serviceCategory && eligibleCategories.includes(serviceCategory)) {
    return { eligible: true, reason: `Elegivel por categoria do beneficio ${benefit.benefit_label}.` };
  }

  if (!eligibleIds.length && !eligibleNames.length && !eligibleCategories.length && isServiceLikeName(item.name)) {
    return { eligible: true, reason: `Elegivel por regra generica do beneficio ${benefit.benefit_label}.` };
  }

  return { eligible: false, reason: `Servico nao configurado para o beneficio ${benefit.benefit_label}.` };
};

const pickBenefitDefinition = (
  item: ChefClubItemInput,
  benefits: ChefClubPlanBenefit[],
  balances: ChefClubBenefitBalance[],
  options?: {
    allowWithoutBalance?: boolean;
  },
) => {
  const activeBenefits = benefits
    .filter((benefit) => benefit.active !== false)
    .sort((a, b) => getChefClubBenefitPriority(b) - getChefClubBenefitPriority(a));

  for (const benefit of activeBenefits) {
    const match = isChefClubEligibleService(item, benefit);
    if (!match.eligible) continue;

    const matchingBalance = balances.find(
      (balance) => balance.benefit_code === benefit.benefit_code && balance.available_credits > 0,
    );

    if (matchingBalance) {
      return {
        benefit,
        balance: matchingBalance,
        reason: match.reason,
      };
    }

    if (!options?.allowWithoutBalance) {
      continue;
    }

    return {
      benefit,
      balance: null,
      reason: `${match.reason} Aplicacao retroativa sem consumo do saldo vigente.`,
    };
  }

  return null;
};

export const applyChefClubBenefitsToCart = (
  items: ChefClubItemInput[],
  context: ChefClubContext,
  manualOverrides: Record<string, boolean> = {},
  options?: {
    allowWithoutBalance?: boolean;
    autoApplyWithoutBalance?: boolean;
  },
) => {
  const results: ChefClubItemResult[] = [];
  const remainingByBenefitCode = new Map<ChefClubBenefitBalance['benefit_code'], number>();

  for (const balance of context.balances) {
    remainingByBenefitCode.set(balance.benefit_code, balance.available_credits);
  }

  for (const item of items) {
    const workingBalances = context.balances.map((balance) => ({
      ...balance,
      available_credits: remainingByBenefitCode.get(balance.benefit_code) ?? balance.available_credits,
    }));

    if (item.type !== 'service') {
      results.push({
        ...item,
        appliedBenefit: null,
        finalUnitPrice: item.unitPrice,
        savings: 0,
        isEligible: false,
        eligibilityReason: 'Produtos de revenda nao participam do Clube do Chefe.',
      });
      continue;
    }

    const pickedBenefit = pickBenefitDefinition(item, context.planBenefits, workingBalances, {
      allowWithoutBalance: options?.allowWithoutBalance,
    });
    const manualUse = manualOverrides[item.id];

    if (!pickedBenefit) {
      results.push({
        ...item,
        appliedBenefit: null,
        finalUnitPrice: item.unitPrice,
        savings: 0,
        isEligible: false,
        eligibilityReason: 'Sem beneficio disponivel no ciclo vigente.',
      });
      continue;
    }

    const hasCurrentBalance = Boolean(
      pickedBenefit.balance && pickedBenefit.balance.available_credits > 0,
    );
    const quantityLimit = hasCurrentBalance
      ? pickedBenefit.balance?.available_credits || item.quantity || 1
      : item.quantity || 1;
    const quantity = Math.max(1, Math.min(item.quantity || 1, quantityLimit));
    const shouldApply = manualUse === undefined
      ? (hasCurrentBalance ? true : Boolean(options?.autoApplyWithoutBalance))
      : manualUse;

    if (!shouldApply) {
      results.push({
        ...item,
        appliedBenefit: null,
        finalUnitPrice: item.unitPrice,
        savings: 0,
        isEligible: true,
        eligibilityReason: pickedBenefit.reason,
      });
      continue;
    }

    const finalUnitPrice = 0;
    results.push({
      ...item,
      appliedBenefit: {
        benefitCode: pickedBenefit.benefit.benefit_code,
        benefitLabel: pickedBenefit.benefit.benefit_label,
        quantity,
        overrideMode: manualUse === undefined && hasCurrentBalance ? 'auto' : 'manual',
        overrideReason: hasCurrentBalance ? null : 'Fechamento retroativo sem consumo do saldo atual.',
        balanceId: pickedBenefit.balance?.id || null,
        planBenefitId: pickedBenefit.benefit.id,
      },
      finalUnitPrice,
      savings: item.unitPrice * quantity,
      isEligible: true,
      eligibilityReason: pickedBenefit.reason,
    });

    if (hasCurrentBalance) {
      const remainingForCode = remainingByBenefitCode.get(pickedBenefit.benefit.benefit_code) || 0;
      remainingByBenefitCode.set(
        pickedBenefit.benefit.benefit_code,
        Math.max(0, remainingForCode - quantity),
      );
    }
  }

  return results;
};

export const getChefClubCheckoutSummary = (items: ChefClubItemResult[]): ChefClubCheckoutSummary => {
  const originalSubtotal = items.reduce((acc, item) => acc + item.unitPrice * item.quantity, 0);
  const savingsTotal = items.reduce((acc, item) => acc + item.savings, 0);
  const finalTotal = Math.max(0, originalSubtotal - savingsTotal);
  const appliedItems = items.filter((item) => Boolean(item.appliedBenefit)).length;
  const appliedQuantity = items.reduce(
    (acc, item) => acc + (item.appliedBenefit ? item.appliedBenefit.quantity : 0),
    0,
  );

  return {
    originalSubtotal,
    savingsTotal,
    finalTotal,
    appliedItems,
    appliedQuantity,
  };
};

export const buildChefClubConsumptionRecords = (
  items: ChefClubItemResult[],
  meta: {
    subscriptionId: string;
    clientId: string;
    comandaId: string;
  },
) => {
  const records: ChefClubConsumptionRecord[] = [];

  for (const item of items) {
    if (!item.appliedBenefit) continue;

    records.push({
      subscription_id: meta.subscriptionId,
      client_id: meta.clientId,
      comanda_id: meta.comandaId,
      comanda_item_id: item.id,
      plan_benefit_id: item.appliedBenefit.planBenefitId,
      benefit_code: item.appliedBenefit.benefitCode,
      benefit_label: item.appliedBenefit.benefitLabel,
      quantity_used: item.appliedBenefit.quantity,
      original_unit_price: item.unitPrice,
      final_unit_price: item.finalUnitPrice,
      override_mode: item.appliedBenefit.overrideMode,
      override_reason: item.appliedBenefit.overrideReason || null,
    });
  }

  return records;
};

export const formatChefClubBalanceLabel = (balance: ChefClubBenefitBalance) =>
  `${balance.benefit_label}: ${balance.available_credits} disponível(is)`;
