export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'paused';

export interface MembershipFilters {
  status?: SubscriptionStatus | 'all';
  search?: string;
}

export interface SubscriptionClient {
  id: string;
  name: string;
  phone: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthlyPrice: number;
  serviceCredits: number;
  serviceCreditMap?: unknown;
}

export interface ServiceBalanceEntry {
  serviceId: string;
  serviceName: string;
  available: number;
  used: number;
}

export interface Subscription {
  id: string;
  client: SubscriptionClient;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  nextBillingDate: string;
  cycleEnd: string;
  availableCredits: number;
  usedCredits: number;
  serviceBalances: ServiceBalanceEntry[];
  createdAt: string;
  canceledAt?: string;
}

export interface MembershipMetrics {
  mrr: number;
  arr: number;
  activeSubscribers: number;
  totalSubscribers: number;
  churnRate: number;
  churnCount: number;
  totalOverdue: number;
  overduePercent: number;
  pendingAmount: number;
  expiringNext30Days: number;
  newSubscribersThisMonth: number;
}

export interface CollectionQueueItem {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  planName: string;
  amount: number;
  dueDate: string;
  daysOverdue: number;
  priority: 'high' | 'medium' | 'low';
}

export interface PlanDistribution {
  planId: string;
  planName: string;
  subscriberCount: number;
  monthlyRevenue: number;
  percentOfTotal: number;
}

export interface MembershipOverviewData {
  loading: boolean;
  error: string | null;
  metrics: MembershipMetrics;
  subscriptions: Subscription[];
  collectionQueue: CollectionQueueItem[];
  plans: PlanDistribution[];
}

export interface MembershipOverviewResponse {
  metrics: MembershipMetrics;
  subscriptions: Subscription[];
  collectionQueue: CollectionQueueItem[];
  plans: PlanDistribution[];
}

// ============================================================
// Phase 3A: Club Club Credit Types
// ============================================================

export type ChefClubEligibilityStatus =
  | 'eligible'
  | 'no_subscription'
  | 'subscription_expired'
  | 'service_not_in_plan'
  | 'credits_exhausted'
  | 'subscription_inactive';

export interface ChefClubCreditPreview {
  eligible: boolean;
  reason: string;
  available_credits: number;
  subscription_id: string | null;
  plan_id: string | null;
  credit_key: string | null;
  service_id?: string;
  service_name?: string;
  checked_at?: string;
}

export interface ChefClubPlanStatus {
  has_active_subscription: boolean;
  subscription_id: string | null;
  plan_id: string | null;
  plan_name: string | null;
  plan_monthly_price: number | null;
  status: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  total_credits: number;
  used_credits: number;
  available_credits: number;
  service_credits: unknown;
  services_eligible: string[];
}

export interface ChefClubCreditUsage {
  id: string;
  client_id: string;
  subscription_id: string;
  plan_id: string;
  service_id: string | null;
  service_name: string | null;
  comanda_id: string | null;
  comanda_item_id: string | null;
  professional_id: string | null;
  professional_name: string | null;
  credit_key: string;
  quantity_used: number;
  original_price: number | null;
  credit_effect: number | null;
  used_at: string;
  created_by: string | null;
}

export type ChefClubItemCreditState =
  | 'none'
  | 'eligible'
  | 'credits_exhausted'
  | 'service_not_in_plan'
  | 'subscription_expired'
  | 'paid_with_credit';

export interface ChefClubItemStatus {
  serviceId: string;
  state: ChefClubItemCreditState;
  availableCredits: number;
  reason: string | null;
  creditKey: string | null;
}