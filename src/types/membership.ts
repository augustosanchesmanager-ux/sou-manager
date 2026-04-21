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