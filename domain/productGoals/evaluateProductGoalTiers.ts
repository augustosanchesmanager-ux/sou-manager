import { roundCurrency } from '../../src/utils/financial/discountAllocation';
import type {
  EvaluatedTier,
  ProductGoalEvaluationResult,
  ProductGoalTemplate,
  ProductGoalTier,
  ResolvedStaffProductGoal,
  StaffProductGoal,
} from './types';

function computeEffectiveThresholdBrl(tier: ProductGoalTier, baseGoalAmount: number): number | null {
  const safeThreshold = Math.max(0, Number(tier.thresholdValue) || 0);
  if (safeThreshold <= 0) return null;

  if (tier.triggerType === 'amount_brl') {
    return roundCurrency(safeThreshold);
  }

  const safeBase = Math.max(0, Number(baseGoalAmount) || 0);
  if (safeBase <= 0) return null;
  return roundCurrency((safeBase * safeThreshold) / 100);
}

/**
 * Avalia faixas progressivas de meta de produtos para um colaborador.
 * Regra (ADR-052): prevalece a maior faixa atingida (progressiva, não cumulativa).
 */
export function evaluateProductGoalTiers(params: {
  soldAmount: number;
  baseGoalAmount: number;
  tiers: ProductGoalTier[];
}): ProductGoalEvaluationResult {
  const soldAmount = roundCurrency(Math.max(0, Number(params.soldAmount) || 0));
  const baseGoalAmount = roundCurrency(Math.max(0, Number(params.baseGoalAmount) || 0));

  const evaluatedTiers: EvaluatedTier[] = [];
  for (const tier of params.tiers ?? []) {
    const threshold = computeEffectiveThresholdBrl(tier, baseGoalAmount);
    if (threshold !== null && threshold > 0) {
      evaluatedTiers.push({
        ...tier,
        effectiveThresholdBrl: threshold,
      });
    }
  }

  evaluatedTiers.sort((a, b) => a.effectiveThresholdBrl - b.effectiveThresholdBrl);

  if (evaluatedTiers.length === 0) {
    return {
      hasGoal: baseGoalAmount > 0,
      soldAmount,
      baseGoalAmount,
      achievedTier: null,
      nextTier: null,
      missingToNextTier: 0,
      progressPct: baseGoalAmount > 0 ? Math.round((soldAmount / baseGoalAmount) * 1000) / 10 : 0,
      bonusAmount: 0,
      evaluatedTiers: [],
    };
  }

  let achievedTier: EvaluatedTier | null = null;
  let nextTier: EvaluatedTier | null = null;

  for (const tier of evaluatedTiers) {
    if (soldAmount >= tier.effectiveThresholdBrl) {
      achievedTier = tier;
    } else if (!nextTier) {
      nextTier = tier;
    }
  }

  let bonusAmount = 0;
  if (achievedTier) {
    const safeReward = Math.max(0, Number(achievedTier.rewardValue) || 0);
    if (achievedTier.rewardType === 'fixed_brl') {
      bonusAmount = roundCurrency(safeReward);
    } else {
      const percentBaseAmount =
        achievedTier.percentBase === 'tier_target'
          ? achievedTier.effectiveThresholdBrl
          : soldAmount;
      bonusAmount = roundCurrency((percentBaseAmount * safeReward) / 100);
    }
  }

  const targetReference =
    nextTier?.effectiveThresholdBrl ??
    achievedTier?.effectiveThresholdBrl ??
    baseGoalAmount;

  const progressPct =
    targetReference > 0
      ? Math.round((soldAmount / targetReference) * 1000) / 10
      : 0;

  const missingToNextTier = nextTier
    ? roundCurrency(Math.max(0, nextTier.effectiveThresholdBrl - soldAmount))
    : 0;

  return {
    hasGoal: true,
    soldAmount,
    baseGoalAmount,
    achievedTier,
    nextTier,
    missingToNextTier,
    progressPct,
    bonusAmount,
    evaluatedTiers,
  };
}

function normalizeStaffRole(role?: string | null): 'receptionist' | 'barber' | 'other' {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'receptionist' || r === 'recepcionista') return 'receptionist';
  if (r === 'barber' || r === 'barbeiro') return 'barber';
  return 'other';
}

/**
 * Resolve a regra efetiva de meta de produtos para um colaborador:
 * 1) Regra individual com faixas customizadas;
 * 2) Vínculo individual a um modelo (com baseGoalAmount opcionalmente sobrescrito);
 * 3) Modelo padrão ativo para o cargo do colaborador (ou modelo 'all').
 */
export function resolveEffectiveProductGoal(params: {
  staffId: string;
  staffRole?: string | null;
  staffGoals: StaffProductGoal[];
  templates: ProductGoalTemplate[];
}): ResolvedStaffProductGoal | null {
  const { staffId, staffRole, staffGoals, templates } = params;
  const activeTemplates = templates.filter((t) => t.active);
  const templateById = new Map(activeTemplates.map((t) => [t.id, t]));

  const individual = staffGoals.find((g) => g.staffId === staffId && g.active);
  if (individual) {
    const customTiers = Array.isArray(individual.customTiers) ? individual.customTiers : [];
    if (customTiers.length > 0) {
      return {
        source: 'individual',
        templateId: individual.templateId ?? null,
        templateName: 'Personalizada',
        periodType: individual.periodType,
        baseGoalAmount: individual.baseGoalAmount,
        tiers: customTiers,
      };
    }

    if (individual.templateId && templateById.has(individual.templateId)) {
      const tpl = templateById.get(individual.templateId)!;
      return {
        source: 'template_override',
        templateId: tpl.id,
        templateName: tpl.name,
        periodType: individual.periodType || tpl.periodType,
        baseGoalAmount: individual.baseGoalAmount > 0 ? individual.baseGoalAmount : tpl.baseGoalAmount,
        tiers: tpl.tiers,
      };
    }
  }

  const normalizedRole = normalizeStaffRole(staffRole);
  const roleTemplate =
    (normalizedRole !== 'other'
      ? activeTemplates.find((t) => t.targetRole === normalizedRole)
      : undefined) ?? activeTemplates.find((t) => t.targetRole === 'all');

  if (!roleTemplate) return null;

  return {
    source: 'role_template',
    templateId: roleTemplate.id,
    templateName: roleTemplate.name,
    periodType: roleTemplate.periodType,
    baseGoalAmount: roleTemplate.baseGoalAmount,
    tiers: roleTemplate.tiers,
  };
}
