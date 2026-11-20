export type ProductGoalPeriod = 'monthly' | 'biweekly' | 'weekly';

export type ProductGoalTargetRole = 'receptionist' | 'barber' | 'all';

export type ProductGoalTriggerType = 'amount_brl' | 'goal_percent';

export type ProductGoalRewardType = 'fixed_brl' | 'percent';

export type ProductGoalPercentBase = 'total_sold' | 'tier_target';

export interface ProductGoalTier {
  id: string;
  label: string;
  triggerType: ProductGoalTriggerType;
  thresholdValue: number;
  rewardType: ProductGoalRewardType;
  rewardValue: number;
  percentBase: ProductGoalPercentBase;
}

export interface ProductGoalTemplate {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  targetRole: ProductGoalTargetRole;
  periodType: ProductGoalPeriod;
  baseGoalAmount: number;
  tiers: ProductGoalTier[];
  active: boolean;
}

export interface StaffProductGoal {
  id: string;
  tenantId: string;
  staffId: string;
  templateId?: string | null;
  periodType: ProductGoalPeriod;
  baseGoalAmount: number;
  customTiers?: ProductGoalTier[] | null;
  active: boolean;
}

export interface ResolvedStaffProductGoal {
  source: 'individual' | 'template_override' | 'role_template';
  templateId?: string | null;
  templateName?: string;
  periodType: ProductGoalPeriod;
  baseGoalAmount: number;
  tiers: ProductGoalTier[];
}

export interface EvaluatedTier extends ProductGoalTier {
  effectiveThresholdBrl: number;
}

export interface ProductGoalEvaluationResult {
  hasGoal: boolean;
  soldAmount: number;
  baseGoalAmount: number;
  achievedTier: EvaluatedTier | null;
  nextTier: EvaluatedTier | null;
  missingToNextTier: number;
  progressPct: number;
  bonusAmount: number;
  evaluatedTiers: EvaluatedTier[];
}
