export type ChefClubBenefitCode =
  | 'cut'
  | 'beard'
  | 'eyebrow'
  | 'hydration'
  | 'botox'
  | 'generic_service'
  | string;

export type ChefClubOverrideMode = 'auto' | 'manual' | 'none';

export interface ChefClubPlanBenefit {
  id: string;
  tenant_id?: string | null;
  plan_id: string;
  benefit_code: ChefClubBenefitCode;
  benefit_label: string;
  monthly_quantity: number;
  eligible_service_ids?: string[] | null;
  eligible_service_names?: string[] | null;
  eligible_service_categories?: string[] | null;
  active?: boolean | null;
  priority?: number | null;
}

export interface ChefClubBenefitBalance {
  id: string;
  subscription_id: string;
  client_id?: string | null;
  benefit_code: ChefClubBenefitCode;
  benefit_label: string;
  available_credits: number;
  used_credits: number;
  source_plan_benefit_id?: string | null;
}

export interface ChefClubSubscriptionSnapshot {
  id: string;
  plan_id: string;
  plan_name: string;
  status: 'active' | 'past_due' | 'canceled' | 'paused';
  cycle_start?: string | null;
  cycle_end?: string | null;
  next_billing_date?: string | null;
}

export interface ChefClubItemInput {
  id: string;
  type: 'service' | 'product';
  name: string;
  service_id?: string | null;
  product_id?: string | null;
  staff_id?: string | null;
  category?: string | null;
  quantity: number;
  unitPrice: number;
}

export interface ChefClubAppliedBenefit {
  benefitCode: ChefClubBenefitCode;
  benefitLabel: string;
  quantity: number;
  overrideMode: ChefClubOverrideMode;
  overrideReason?: string | null;
  balanceId?: string | null;
  planBenefitId?: string | null;
}

export interface ChefClubItemResult extends ChefClubItemInput {
  appliedBenefit?: ChefClubAppliedBenefit | null;
  finalUnitPrice: number;
  savings: number;
  isEligible: boolean;
  eligibilityReason: string;
}

export interface ChefClubCheckoutSummary {
  originalSubtotal: number;
  savingsTotal: number;
  finalTotal: number;
  appliedItems: number;
  appliedQuantity: number;
}

export interface ChefClubConsumptionRecord {
  subscription_id: string;
  client_id: string;
  comanda_id: string;
  comanda_item_id: string;
  plan_benefit_id?: string | null;
  benefit_code: ChefClubBenefitCode;
  benefit_label: string;
  quantity_used: number;
  original_unit_price: number;
  final_unit_price: number;
  override_mode: ChefClubOverrideMode;
  override_reason?: string | null;
}

export interface ChefClubContext {
  subscription: ChefClubSubscriptionSnapshot | null;
  balances: ChefClubBenefitBalance[];
  planBenefits: ChefClubPlanBenefit[];
}
